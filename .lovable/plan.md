
# Bloxberg integracija za izdate MK (revidirano)

Cilj: pri svakom izdavanju mikrokredencijala asinhrono se šalje transakcija na korisnikov Bloxberg smart contract. On-chain ide minimalan, GDPR-bezbedan zapis; sve PII i puni VC ostaju u Supabase.

## On-chain payload (CredentialRecord)

Smart contract prima jedan poziv po credentialu sa sledećom strukturom:

```
struct CredentialRecord {
  bytes32 documentHash;        // sha256 nad kanonskim VC JSON-om
  bytes32 learnerCommitment;   // sha256(earnerId || randomSecret)
  bytes32 templateRef;         // sha256(templateId)
  address issuerAddress;       // wallet potpisnika
  uint64  issuedAt;            // unix sec
  uint64  expiresAt;           // unix sec, 0 ako nema
  CredentialStatus status;     // enum: Active/Revoked/Expired
  string  issuerNameSnapshot;  // ime issuera u trenutku izdavanja
}
```

ABI funkcije se čita iz `BLOXBERG_CONTRACT_ABI`; default ime funkcije iz `BLOXBERG_FUNCTION_NAME` (npr. `storeCredential`). Status enum mapiramo: `active=0`, `revoked=1`, `expired=2`.

**Hash konstrukcija:**
- `documentHash` = SHA-256 nad kanonskim JSON-om punog VC-a (sortirani ključevi, ISO datumi).
- `learnerCommitment` = SHA-256(`earnerId` ‖ `randomSecret`) — `randomSecret` se generiše po credentialu (32B, crypto.getRandomValues), čuva u DB, nikada ne ide on-chain. Earner može kasnije dokazati vlasništvo preimage-om.
- `templateRef` = SHA-256(`templateId`) — stabilan, ne otkriva interne UUID-eve.

## Off-chain (Supabase)

U DB ostaju: `credentialId`, `earnerId`, `randomSecret`, pun VC JSON, EU metadata (level/ECTS/skills/QA/supervision/stackability iz templejta), issuer detalji, evidence (URLs/storage paths), PDF reprezentacija (storage path) — sve već postoji ili dodajemo gde fali.

## DB šema (nova migracija)

Nove kolone na `credentials`:
- `credential_hash text` — hex documentHash-a
- `learner_commitment text` — hex
- `learner_secret text` — 32B hex, **never exposed via public RPC**
- `template_ref text` — hex
- `vc_json jsonb` — kanonski VC payload (snapshot u trenutku izdavanja)
- `pdf_storage_path text` — opciono, gde sedi PDF
- `chain_status text default 'pending'` — `pending | submitted | confirmed | failed | disabled`
- `chain_tx_hash text`
- `chain_block_number bigint`
- `chain_issuer_address text`
- `chain_contract_address text`
- `chain_error text`
- `chain_submitted_at timestamptz`
- `chain_confirmed_at timestamptz`

Nova tabela `chain_anchor_jobs` (queue/retry):
- `id uuid pk`, `credential_id uuid fk → credentials on delete cascade`
- `status text` (`queued|running|done|failed`), `attempts int default 0`, `last_error text`
- `created_at`, `updated_at` (sa trigger-om)
- unique index na `credential_id` gde `status != 'done'`

Storage bucket `credential-pdfs` (private) za PDF-ove — opcionalno u ovoj fazi.

GRANT/RLS:
- `credentials`: postojeće policy ostaju; nove kolone naslediti; **`learner_secret` i `vc_json` se NE vraćaju iz `get_public_credential`**.
- `chain_anchor_jobs`: samo `service_role` (interno).

Update `get_public_credential` RPC → dodati: `credential_hash`, `learner_commitment`, `template_ref`, `chain_tx_hash`, `chain_block_number`, `chain_status`, `chain_issuer_address`, `chain_contract_address`. (PII i secret ne.)

Update revoke flow: pri postavljanju `status='revoked'` enqueue novi anchor job (re-call contracta sa status=1) — ako contract ima `updateStatus` funkciju (opciono u sledećoj fazi, sad samo `Active` na izdavanju).

## Backend

1. **`src/lib/chain/hash.ts`** — `canonicalize(obj)`, `sha256Hex(str|Uint8Array)`, helper `to32Bytes(hex)` za `bytes32` prefiks.
2. **`src/lib/chain/vc.ts`** — `buildVcJson(credential, template, earner, issuerOrg)` vraća kanonski W3C-style payload (id, type, issuer, credentialSubject, issuanceDate, expirationDate, EU metadata u `credentialSubject`/`evidence`).
3. **`src/lib/chain/bloxberg.server.ts`** — server-only, dinamički import `ethers` v6:
   - `getSigner()` → `Wallet(BLOXBERG_PRIVATE_KEY, JsonRpcProvider(BLOXBERG_RPC_URL))`
   - `submitAnchor(record)` poziva `contract[fn](documentHash, learnerCommitment, templateRef, issuerAddress, issuedAt, expiresAt, status, issuerNameSnapshot)`, `tx.wait(1)`, vraća `{txHash, blockNumber, issuerAddress, contractAddress}`.
   - Bez bilo kog env-a → `ChainNotConfiguredError` (dry-run).
4. **`src/lib/chain/anchor.functions.ts`** (TanStack server fn, `requireSupabaseAuth`):
   - `enqueueAnchor({credentialId})` — generiše `randomSecret` ako fali, izračuna `vc_json`, `credential_hash`, `learner_commitment`, `template_ref`, upiše u DB, insert job. Idempotentno.
   - `processAnchor({credentialId})` (interno, pozivano iz crona, koristi `supabaseAdmin` unutar handler-a) — fetch credentiala, poziva `submitAnchor`, upiše tx polja, status `confirmed`. Na error: `failed` + increment attempts.
5. **Hook u izdavanju**: posle insert-a u `credentials` (direct issue u `src/lib/store.tsx` realnoj putanji + flow odobrenja aplikacije) — fire-and-forget `enqueueAnchor`. UI ne čeka.
6. **Cron route** `src/routes/api/public/hooks/process-chain-anchors.ts` (POST, `apikey` provera anon ključem) — pokupi `queued|failed` jobove (`attempts < 5`), obrađuje serijski (Bloxberg nonce), backoff. pg_cron svakih minut, body `{}`.

## Frontend

- **`src/components/EbsiPlaceholderCard.tsx`** → zameniti sa `BlockchainAnchorCard`:
  - prikaz: `chain_status` badge, `chain_tx_hash` (link na `https://blockexplorer.bloxberg.org/tx/{hash}`), `chain_block_number`, `chain_issuer_address`, `chain_contract_address`, `credential_hash`, `learner_commitment`, `template_ref`, copy buttons.
  - earner detail dodatno: dugme "Reveal proof secret" otkriva `learnerSecret` (samo vlasniku) za off-chain dokaz commitmenta.
- **`src/routes/issuer.credentials.tsx`**: kolona/badge sa `chain_status`.
- **`src/routes/issuer.microcredential-templates.$id.tsx`** (detalj izdatih iz templejta): isti badge.
- **`src/routes/earner.credentials.$id.tsx`**: `BlockchainAnchorCard` umesto EbsiPlaceholder.
- **`src/routes/verify.$id.tsx`** (javni share): "Blockchain verification" sekcija — sva ne-PII polja + explorer link, plus uputstvo kako verifikovati hash protiv contracta.
- **`src/lib/types.ts`**: `BlockchainPlaceholder` → `BlockchainAnchor` sa novim poljima; ostavi backward-compat alias.

## Dependencies

- `bun add ethers@^6` — koristi se samo u `*.server.ts` (dinamički import u handler-u).

## Secrets (kasnije dodajemo, kad korisnik dostavi)

`BLOXBERG_RPC_URL`, `BLOXBERG_CONTRACT_ADDRESS`, `BLOXBERG_CONTRACT_ABI` (JSON), `BLOXBERG_FUNCTION_NAME` (default `storeCredential`), `BLOXBERG_PRIVATE_KEY`. Dok nisu setovani: dry-run — hash/commitment/ref se računaju i čuvaju, status ostaje `pending`, badge u UI prikazuje "Awaiting blockchain configuration".

## Van opsega (sad)

- Re-anchor postojećih credential-a (backfill kasnije).
- On-chain revoke/update status (contract `updateStatus` ako bude postojao — sledeća iteracija).
- EBSI integracija (ostaje placeholder).
- PDF generisanje (kolona ostaje slobodna; postojeća logika netaknuta).

## Implementacioni red

1. Migracija: kolone, `chain_anchor_jobs`, GRANT/RLS, update RPC.
2. `chain/hash.ts`, `chain/vc.ts`, `chain/bloxberg.server.ts`, `chain/anchor.functions.ts`.
3. Cron route + pg_cron schedule.
4. Kuke u flow izdavanja (direct + application approval).
5. UI: `BlockchainAnchorCard` + badge-vi + verify sekcija.
6. `bun add ethers`.

Tx-evi krenu čim korisnik dostavi contract + ključ.

## Problem

Kada earner prihvati micro-credential, server izvršava anchor na Bloxbergu (`acceptCredential` → `enqueueAcceptedAnchor` → `processCredentialAnchor`). Za kredencijal `Fundamentals of Micro-Credentials` (6a9b32c1…) poziv `issueCredential` revert-uje sa CALL_EXCEPTION i porukom "missing revert data".

**Korijenski uzrok** (provjereno direktnim RPC pozivom na Bloxberg):
- Wallet ima `ISSUER_ROLE`: ✔
- Kontrakt nije pauziran: ✔
- `getCredential(credentialId)` već vraća validan zapis (docHash, commit, templateRef, issuer = naš wallet, state = Active, snapshot = "Faculty of Organizational Sciences").
- Kontrakt vraća custom error `0x87dbb506` koji odgovara `CredentialAlreadyExists(bytes32)`. ethers v6 ga ne dekodira → "missing revert data".

Drugim riječima: prethodni anchor je **uspio na lancu**, ali DB nije obilježio `chain_status='confirmed'` (npr. failover prije nego što je transakcija potvrđena, ili ranija putanja izdavanja koja je već anchor-ovala prije prelaska na flow "prihvati pa anchor"). Svaki sledeći retry sad revert-uje.

Trigger nakon prihvatanja je već implementiran — kod je u `src/lib/chain/anchor.functions.ts:1219` (`await enqueueAcceptedAnchor(...)`). Ne treba ga dodavati; treba ispraviti rukovanje duplikatima i izvještavanje.

## Plan

### 1. Detekcija "već anchor-ovano" prije slanja transakcije
`src/lib/chain/bloxberg.server.ts` — u `submitCredentialAnchor`, prije `contract.issueCredential(...)`:
- Pozvati `contract.getCredential(credentialIdBytes32)`.
- Ako vraća zapis sa `documentHash` koji matchuje naš `record.documentHashHex` i `issuer == wallet.address` → vratiti specijalan rezultat `{ alreadyAnchored: true, txHash: null, blockNumber: 0, ... }` umjesto da šaljemo tx.
- Ako matchuje sa **drugačijim** docHash-om → baciti jasnu grešku "Credential already exists on chain with a different document hash" (znači verzija/podaci se razlikuju, zahtijeva supersede).
- Isto za `submitTemplateAnchor`: provjeriti postojeću verziju u TemplateRegistry pre slanja.

### 2. Dekodiranje custom revert selektora
`src/lib/chain/bloxberg.server.ts` — dodati mapu poznatih selektora:
- `0x87dbb506` → `CredentialAlreadyExists`
- pokušati dekodirati `e.info?.error?.data` ako počinje sa "Reverted 0x…" da izvučemo selector i argument.
- Wrap pozive `issueCredential` / `registerTemplateVersion` / `revokeCredential` u try/catch koji prevodi nepoznat revert u čitljivu poruku (`"Contract reverted: CredentialAlreadyExists(...)"`), tako da krajnji `chain_error` u DB-u nije više "missing revert data".

### 3. Idempotentno tretiranje "alreadyAnchored" u workeru
`src/lib/chain/anchor.functions.ts` `processAnchor` (linije ~240–270) i ekvivalentni put u `src/lib/chain/worker.server.ts` `processCredentialAnchor`:
- Ako `submitCredentialAnchor` vrati `alreadyAnchored: true`:
  - Postaviti `credentials.chain_status = 'confirmed'`, `chain_error = null`, `chain_confirmed_at = now()`, `chain_issuer_address` i `chain_contract_address` (tx hash i block number ostaju `NULL` jer originalnu tx ne znamo).
  - U `credential_blockchain_records` postaviti `blockchain_status = 'confirmed'`.
  - Anchor job → `done`.
- Isto za template put.

### 4. Sanacija postojećih pogođenih redova
Jednokratni `supabase--migration` koji za svaki `credentials` red sa `chain_status IN ('failed','queued','pending','cancelled')` provjeri (kroz worker poziv nakon deploy-a) i, ako kontrakt već ima zapis sa istim docHash-om, prebaci u `confirmed`. Implementacija: nakon deploy-a pozvati novi admin server fn `reconcileCredentialAnchor(credentialId)` za 2 trenutno pogođena kredencijala (6a9b32c1… i f029d7f5…) — drugi je već revoked, samo počistiti `chain_status` na `cancelled` bez poruke "missing revert data".

Server fn `reconcileCredentialAnchor` (zaštićen `requireSupabaseAuth` + `has_role(platform_admin)` provjerom) pokreće isti put kao worker, ali sa novom "alreadyAnchored" granom. Može se dugme dodati na `/issuer/anchoring-queue` da admin ručno re-tretira "failed" job — opcionalno u istom passu.

### 5. UI poruka pri prihvatanju
`src/routes/earner.credentials.$id.tsx` — toast nakon prihvatanja već prikazuje "Blockchain confirmation is pending". Ne treba mijenjati. Ako želiš, dodati badge "Already on chain (recovered)" kad je `chain_tx_hash` null ali `chain_status='confirmed'` — opcionalno.

## Tehnički detalji

- Custom error selector `0x87dbb506` = prva 4 bajta `keccak256("CredentialAlreadyExists(bytes32)")`.
- `getCredential` ABI već postoji u `CredentialRegistry.json` (vidim `getCredential` u listi funkcija).
- Pre-check dodaje 1 RPC `eth_call` po anchor pokušaju (~50ms) — prihvatljivo, štedi nam reverted gas i daje idempotentnost.
- Cijela promjena je u 2 fajla (`bloxberg.server.ts`, `anchor.functions.ts`) + 1 mali helper za dekodiranje + opciono admin server fn za rekonsilijaciju.

## Šta NE diramo

- Trigger nakon prihvatanja — već radi.
- RLS polise — problem nije u polisama, već u contract-side duplikatu.
- ABI fajlove i adrese kontrakta.

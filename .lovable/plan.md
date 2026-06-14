
# Inkrementalni plan — dvoslojno Bloxberg sidrenje (template + credential)

Polazna osnova (već postoji, reuse, ne duplirati):
- `templates` (status draft/published/archived, version, sva spec polja, qa/supervision/stackability, expiry, assignees).
- `credentials` (status active/revoked/expired) + već dodata `chain_*` polja (`credential_hash`, `learner_commitment`, `learner_secret`, `template_ref`, `vc_json`, `chain_status/tx_hash/block_number/issuer_address/contract_address/error/submitted_at/confirmed_at`).
- `chain_anchor_jobs` queue (queued/running/done/failed, unique partial index po credential_id).
- `src/lib/chain/{hash,vc,bloxberg.server,anchor.functions}.ts`, cron route `process-chain-anchors`, `BlockchainAnchorCard`.
- RLS i role: `has_role_in_org`, `is_template_assignee`, `is_platform_admin`.
- Ruta `issuer.ebsi.tsx` (mock placeholder) i `EbsiPlaceholderCard` — biće uklonjeni/zamenjeni.

Sve menjamo bez rušenja postojećih flow-ova; svaka faza je samostalno isporučiva.

---

## Faza 1 — Šema i lifecycle razdvajanje (jedna migracija)

Cilj: jasno odvojiti template/credential lifecycle od blockchain statusa i uvesti template verzionisanje.

**templates**
- Dodati `blockchain_status text not null default 'not_requested'` CHECK in (`not_requested,queued,submitting,submitted,confirmed,failed,cancelled`).
- Dodati `document_hash text`, `template_ref text`, `canonical_payload jsonb`, `published_at timestamptz`, `issuer_name_snapshot text`, `published_by uuid`.
- `version` već postoji kao text — koristimo ga kao "current published version".

**Nova tabela `template_versions`** (immutable snapshot po publish-u)
- `id uuid pk`, `template_id uuid fk`, `version text`, `canonical_payload jsonb`, `document_hash text`, `template_ref text`, `issuer_name_snapshot text`, `published_at`, `published_by`, `created_at`.
- UNIQUE (`template_id`, `version`).
- RLS: SELECT za članove org-a i platform_admin; INSERT samo preko server fn-a (service_role).

**credentials**
- Dodati `credential_lifecycle text not null default 'issued'` CHECK in (`draft,pending_earner_acceptance,issued,revoked,expired,superseded`). Postojeći enum `status` ostaje za bekompatibilnost, novi je izvor istine za UI. Trigger sinhronizuje (`active`↔`issued`, `revoked`↔`revoked`, `expired`↔`expired`).
- Dodati `vc_id text`, `template_version text`, `canonical_payload jsonb` (sinonim za `vc_json` ubuduće — `vc_json` ostaje), `issuer_name_snapshot text`, `superseded_by_id uuid references credentials(id)`, `chain_attempts int default 0`, `chain_last_attempt_at timestamptz`.
- Mapirati postojeći `chain_status='pending'` → `queued`; default postaje `not_requested`.
- Vrednosti CHECK-a: `not_requested,queued,submitting,submitted,confirmed,failed,cancelled`.

**Dve nove tabele blockchain zapisa**
- `template_blockchain_records`: id, template_id, template_version, network ('bloxberg'), chain_id (8995), contract_address, document_hash, template_ref, blockchain_status, transaction_hash, block_number, anchored_at, attempt_count, last_attempt_at, last_error, timestamps. UNIQUE (template_id, template_version, network, contract_address).
- `credential_blockchain_records`: id, credential_id, network, chain_id, contract_address, contract_credential_id, document_hash, blockchain_status, transaction_hash, block_number, anchored_at, attempt_count, last_attempt_at, last_error, timestamps. UNIQUE (credential_id, network, contract_address).
- RLS:
  - SELECT: članovi org-a issuer-a (preko `template/credential.issuer_id`), platform_admin, i (za credential-level) earner-vlasnik. Bez `anon`.
  - INSERT/UPDATE: samo `service_role`.
  - GRANT SELECT za authenticated, ALL za service_role.

**chain_anchor_jobs proširenje (jedinstveni queue za oba entiteta)**
- Dodati `entity_type text not null default 'credential'` CHECK in (`template,credential`).
- Dodati `entity_id uuid not null` (popunjeno iz `credential_id` migracijom), `operation text not null default 'anchor_credential'` CHECK in (`anchor_template,anchor_credential,revoke_credential,supersede_credential`).
- Dodati `next_attempt_at timestamptz`, `transaction_hash text`.
- Postojeći `credential_id` ostaje (nullable, FK) radi bekompatibilnosti za jedan release; novi kod čita `entity_type+entity_id`.
- Zameniti unique partial index sa: UNIQUE(`entity_type`, `entity_id`, `operation`) WHERE `status not in ('done','cancelled')`.

**RPC**
- Update `get_public_credential` da vraća: novi `credential_lifecycle`, mapirani `blockchain_status`, `vc_id`, `template_version` (i dalje bez `learner_secret`, bez UUID-a).
- Novi `get_template_blockchain(_template_id, _version)` — vraća samo safe template-level proof podatke (za public verify ako bude potrebno).

---

## Faza 2 — Server-side primitive proširenje

Cilj: keccak256 commitment, sigurnosna verifikacija, dva publish/anchor pravca.

- `src/lib/chain/hash.ts`: dodati `keccak256Hex(string|Uint8Array)` (preko `ethers.keccak256` u server-only branch-u — koristiti `js-sha3` ili lokalni helper da ostane izomorfan; **commitment računamo isključivo server-side**). Ako treba klijent helper, ostaje samo SHA-256.
- `src/lib/chain/vc.ts`: već gradi VC; dodati `buildTemplateCanonicalPayload(template)` za template snapshot (sva polja iz specifikacije, sortirani ključevi).
- `src/lib/chain/bloxberg.server.ts`:
  - Razdvojiti env varijable: `BLOXBERG_RPC_URL`, `BLOXBERG_CHAIN_ID` (default 8995), `BLOXBERG_PRIVATE_KEY`, `TEMPLATE_REGISTRY_ADDRESS`, `CREDENTIAL_REGISTRY_ADDRESS` (uz fallback na postojeći `BLOXBERG_CONTRACT_ADDRESS` ako je jedan kontrakt za oba).
  - Nove funkcije: `submitTemplateAnchor(record)`, `submitCredentialAnchor(record)` (postojeća `submitAnchor` postaje alias), `submitRevokeCredential(record)`.
  - Nova `getChainAvailability()` koja vraća diskriminisani objekat: `{ status: 'ok' | 'rpc_unavailable' | 'missing_config' | 'no_contract' | 'insufficient_balance', detail? }`. Timeout 3s. Nikad ne baca u pozivajući UI.
- `src/lib/chain/anchor.functions.ts`:
  - Nove server fn: `getChainAvailabilityFn()`, `publishTemplateAndAnchor({templateId, anchorMode})`, `issueCredentialsBatch({templateId, recipients, shared, anchorMode})`, `anchorTemplateNow(templateId, version)`, `anchorCredentialNow(credentialId)`, `retryAnchor(jobId)`, `cancelAnchor(jobId)`, `revokeCredential(credentialId, reason)`.
  - Sve sa `requireSupabaseAuth` i nezavisnom RBAC proverom (issuer_admin / staff sa pristupom template-u / platform_admin).
  - Učitavaju `supabaseAdmin` samo unutar handler-a.

---

## Faza 3 — Publish template flow + view template

Cilj: razdvojiti "publish" od "anchor", uvesti immutable version.

`publishTemplateAndAnchor`:
1. Verifikuje permisije, validira sva mandatorna polja.
2. Određuje sledeći `version` (bump iz trenutnog).
3. Generiše `canonical_payload` (sortirani JSON) iz live template polja.
4. `document_hash = sha256(canonical_payload)`.
5. `template_ref = keccak256(templateIdHash || versionHash || documentHash)`.
6. INSERT u `template_versions`; UPDATE templates: `status='published'`, `published_at`, `published_by`, snapshot polja, `version`.
7. INSERT `template_blockchain_records` (`blockchain_status='not_requested'`).
8. `anchorMode='now'` → sinhroni `submitTemplateAnchor` (sa timeoutom); `'later'` → INSERT `chain_anchor_jobs` (`entity_type='template'`, op `anchor_template`, status `queued`).
9. Greška kod sidrenja: template ostaje `published`, blockchain_status `failed`. Nikad rollback publish-a.

UI:
- `src/routes/issuer.microcredential-templates.new.tsx` i `.($id).edit` (ako postoji edit) — dodati sekciju "Blockchain registration" sa 2 radio opcije (default "Publish now and anchor later"). Vidljiva samo na Publish dugmetu; Save as draft je ignoriše. Disable opcije A ako `getChainAvailabilityFn().status !== 'ok'`, prikazati banner.
- `src/routes/issuer.microcredential-templates.$id.tsx`: ukloniti `EbsiPlaceholderCard`, dodati novi `TemplateBlockchainProofCard` koji čita iz `template_blockchain_records` + `template_versions`. Polja: Template ID, version, document_hash, template_ref, network, chain_id, contract_address, blockchain_status (sa zahtevanim safe tekstovima), tx hash, block number, anchored_at, last_attempt_at, attempt_count, explorer link. Akcije (issuer/admin): Anchor now, Retry, View tx, View error, Cancel. Informativni tekst kao u spec-u.
- Ukloniti rutu `src/routes/issuer.ebsi.tsx` i sidebar link.

Edit publikovanog template-a: forsira novu verziju (zadržava prethodne versions/recorde).

---

## Faza 4 — Issue credentials flow (bulk + per-recipient)

Cilj: jedan credential po recipient-u, jasna issuance/anchoring razdvojenost, per-row rezultat.

`issueCredentialsBatch({templateId, recipients[{userId, gradeOverride?, expiresAtOverride?}], shared{issuedAt, grade?}, anchorMode})`:
- Validira permisije i da template ima `status='published'` i resolvovanu `version`.
- Za svakog recipient-a nezavisno (try/catch po recipientu, ne batch-rollback):
  1. Resolve effective grade/expiry (shared + override).
  2. Generiše `credentialId`, `vc_id = urn:microcred:{credentialId}`.
  3. Snapshot iz `template_versions` (template_version, template_ref).
  4. `canonical_payload` (postojeći `buildVcJson` + sva snapshot polja).
  5. `document_hash = sha256(canonical_payload)`.
  6. Learner commitment server-side (keccak): `earnerIdHash = keccak256(userId)`, `credentialIdHash = keccak256(credentialId)`, `randomSecret = crypto.randomBytes(32)`, `learner_commitment = keccak256(earnerIdHash || credentialIdHash || randomSecret)`. `randomSecret` snima se u `credentials.learner_secret` (pristup samo earneru kroz dedikovani server fn `revealLearnerSecret`).
  7. INSERT credential sa `credential_lifecycle='issued'`, snapshot poljima, hashes, vc_id, template_version, template_ref, issuer_name_snapshot.
  8. INSERT u `credential_blockchain_records` (`blockchain_status='not_requested'`).
  9. `anchorMode='now'` → sinhroni `submitCredentialAnchor` per credential (paralelno sa limitom); `'later'` → INSERT `chain_anchor_jobs` (`entity_type='credential'`, op `anchor_credential`).
- Vraća array rezultata: `{ recipientId, credentialId?, credentialStatus, blockchainStatus, error? }`.

UI:
- `src/routes/issuer.issue.index.tsx` i `issuer.issue.bulk.tsx`: dodati karticu "Blockchain registration" iznad Issue dugmeta (2 radio, default later, disable A kad nije dostupno + banner).
- Posle submit-a, prikazati tabelu rezultata: Recipient | Credential status | Blockchain status | Action (View tx / Retry / View credential). Bez generičkog "X credentials issued" toasta kao jedinog feedback-a.
- `issuer.requests.tsx` (approve application → issue): isti confirm dialog sa "Blockchain registration" sekcijom.
- Postojeća `store.directIssue` / `store.issueFromApplication` refaktorisati da pozivaju `issueCredentialsBatch` umesto direktnog client insert-a.

---

## Faza 5 — Blockchain Anchoring Queue (jedan ekran, oba tipa)

- Nova ruta `src/routes/issuer.anchoring-queue.tsx`, link u sidebar-u za issuer_admin/staff/platform_admin.
- Filteri: All / Templates / Credentials × Queued / Failed / Confirmed.
- Kolone: type, title, version-or-learner, datum (published_at / issued_at), internal status, blockchain_status, attempts, last_attempt, akcije.
- Akcije po redu: Anchor now, Retry, View tx, View error, Cancel.
- Multi-select: Anchor selected, Anchor all queued.
- Pre retry-ja: server fn proverava postojeći `transaction_hash`, attempts cap, i (kad contract postoji) read-only `exists` poziv da spreči duplikat. Bez beskonačnog retry-ja.
- Cron `process-chain-anchors` proširiti da obrađuje oba `entity_type`-a i sve operacije; serijski po nonce-u; backoff preko `next_attempt_at`.

---

## Faza 6 — Issued credential details + earner pogled + revocation

- `src/routes/earner.credentials.$id.tsx`, `verify.$id.tsx`, issuer pregled: zameniti `BlockchainAnchorCard` novim `CredentialBlockchainVerificationCard`:
  - Polja: credential_id, vc_id, template_ref, network, chain_id, contract_address, blockchain_status, document_hash, learner_commitment, transaction_hash, block_number, anchored_at, explorer link.
  - Ne prikazuje: internal earner UUID, `learner_secret`, private key. "Reveal proof secret" ostaje samo za vlasnika preko `revealLearnerSecret` server fn-a (auth.uid() = earner_id).
  - Earner labele: queued/submitting/submitted → "Credential issued · Blockchain verification pending"; confirmed → "...confirmed"; failed → "...temporarily unavailable"; not_requested → bez blockchain reda.
- Revocation (`revokeCredential` server fn):
  - Ako nema confirmed tx-a → `credential_lifecycle='revoked'`, otkazati `anchor_credential` job (status `cancelled`), `blockchain_status='cancelled'`.
  - Ako je confirmed → INSERT `chain_anchor_jobs` (`operation='revoke_credential'`); originalni issuance zapis ostaje, revocation tx se piše kao novi red u `credential_blockchain_records` ili kao audit polje (final-decision pri implementaciji ove faze).
- Template archive ne menja credential statuse.

---

## Faza 7 — Status badge sistem, tooltips, cleanup

- `src/lib/status-labels.ts`: 3 odvojene mape (Template, Credential, Blockchain) sa zahtevanim labelama i tooltipovima koji objašnjavaju razdvojenost.
- `StatusBadge` proširiti da prima `kind: 'template' | 'credential' | 'blockchain'`.
- Ukloniti `EbsiPlaceholderCard`, `BlockchainPlaceholder` alias (ili ostaviti deprecated alias jedan release), `issuer.ebsi.tsx` rutu i sidebar link.
- pg_cron job (svakih minut) na `/api/public/hooks/process-chain-anchors` (već postoji) — proširen handler iz Faze 5.

---

## Tehnički invarijanti kroz sve faze

- Tajne strogo server-side. `BLOXBERG_CHAIN_ID` novi env (default 8995). Bez tajni u logovima/error response-ima.
- Bez mock tx hash-eva. Bez konfiguracije: UI prikazuje "Bloxberg integration is not configured. Records can still be created and queued for later anchoring." i opcija A je disabled.
- Sve write operacije idu kroz server fn sa nezavisnom RBAC + status proverom; klijent nije security boundary.
- Issuance i publish nikad ne fail-uju zbog Bloxberg-a; samo blockchain_status reflektuje grešku.
- `credentials.chain_*` polja ostaju kao denormalizovani brzi pogled za liste; izvor istine je `credential_blockchain_records`. Worker piše u oba.
- `chain_anchor_jobs.entity_type+entity_id` je novi unique kontekst; backfill stari `credential_id` redovi popunjavaju `entity_type='credential'`.

## Van opsega (svesno ostavljeno za kasnije)

- Stvarni deploy smart contract-a i finalni ABI (radi se kad korisnik dostavi).
- PENDING_EARNER_ACCEPTANCE UI flow (šema dozvoljava, UI kasnije).
- Multi-network anchoring (tabele su agnostične, ali UI je trenutno samo Bloxberg).
- Automatski retry beyond cap (Faza 5 ostavlja samo manual retry + jednostavni next_attempt_at backoff).

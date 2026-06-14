## Cilj

1. Razdvojiti anchoring queue u dve tabele: `template_anchor_jobs` (za MK šablone) i `credential_anchor_jobs` (za izdate MK).
2. Svaki izdati MK se automatski dodaje u `credential_anchor_jobs` čak i kada nije odmah anchor-ovan (umesto trenutnog ponašanja gde "anchor now" preskače red).
3. Pri pokušaju anchor-ovanja kredencijala (iz Queue-a, retry ili "anchor now") proveriti da li je template `confirmed` na blockchain-u — ako nije, vratiti grešku: *"Nije moguće anchor-ovati: MK šablon još nije na blockchain-u."*

## Promene baze (migracija)

**Nove tabele** (oba sa standardnim `id, created_at, updated_at, status, attempts, last_attempt_at, next_attempt_at, last_error, transaction_hash, operation`):

- `public.template_anchor_jobs` — kolona `template_id uuid` + `template_version text`
- `public.credential_anchor_jobs` — kolona `credential_id uuid`

Za obe: `GRANT SELECT` (i INSERT/UPDATE za authenticated samo ako su platform admin / issuer_admin org-a; provera kroz postojeće `is_platform_admin` / `has_role_in_org`), `GRANT ALL` za `service_role`. RLS politike paralelne sa postojećim `chain_anchor_jobs`.

**Migracija podataka**: kopirati postojeće `chain_anchor_jobs` redove u odgovarajuću novu tabelu na osnovu `entity_type`. Stara tabela ostaje (read-only) radi sigurnosti — može se obrisati u sledećoj iteraciji.

**Jedinstveni parcijalni indeksi** (idempotentnost): jedan aktivan job po entitetu kada je `status IN ('queued','running','failed')`.

## Promene koda

### `src/lib/chain/anchor.functions.ts`

- `publishTemplateAndAnchor` → upisuje u `template_anchor_jobs` umesto `chain_anchor_jobs`.
- `issueCredentialsBatch` → **uvek** ubacuje red u `credential_anchor_jobs` po izdatom MK. Ako je `anchorMode === "now"`, prvo proveriti da li je template `confirmed`:
  - ako jeste → odmah pokrenuti `processCredentialAnchor`, ažurirati job na `done`/`failed`;
  - ako nije → red ostaje u statusu `queued`, vratiti upozorenje u `results[].warning` i `blockchainStatus: "queued"`.
- `anchorCredentialNow` i `retryAnchorJob` (za credential jobs) → pre poziva `processCredentialAnchor` proveriti `template_blockchain_records.blockchain_status === 'confirmed'`. Ako nije, baciti `Error("Cannot anchor credential: template is not yet anchored on blockchain.")` i ostaviti job u `queued` (ili `failed` sa porukom).
- `cancelAnchorJob` i `retryAnchorJob` → primati `{ jobId, entityKind: "template" | "credential" }` i raditi nad odgovarajućom tabelom.
- `listAnchorJobs` → fetch-uje obe tabele paralelno, mapira u isti `QueueRow` oblik (sa `entity_type`), spaja i sortira po `created_at desc`. Ostaje jedan endpoint pa UI ne mora bitno da se menja.
- `revokeCredentialOnChain` → upisuje revoke job u `credential_anchor_jobs`; cancel pending issuance jobs takođe nad novom tabelom.

### `src/routes/api/public/hooks/process-chain-anchors.ts`

Cron worker povlači do `MAX_PER_RUN` redova iz obe tabele (UNION-like: prvo template-e, zatim credential-e ili obrnuto; ili 5+5). Za svaki credential job pre obrade proveriti template anchor status — ako nije confirmed, postaviti `status='failed'`, `last_error='Template not yet anchored'`, povećati `attempts` i postaviti `next_attempt_at` (backoff). Tako će se automatski retry-ovati kasnije kada se template anchor-uje.

### `src/routes/issuer.anchoring-queue.tsx`

Manje promene: postojeći filteri po `entity_type` već postoje. Mutacije `retry`/`cancel` će slati i `entityKind` (iz `row.entity_type`). Dodati vidljivu napomenu na credential redovima čiji template još nije anchor-ovan ("Template još nije na blockchain-u — anchoring čeka").

### UI napomena na izdatim MK koji nisu na blockchain-u

Već postoji `BlockchainAnchorCard` / `CredentialBlockchainVerificationCard`; potvrditi da prikazuju jasnu napomenu *"Nije još na blockchain-u — u redu za anchoring"* kada je `chain_status` u `queued`/`pending`/`not_requested`, i dugme "Anchor now" koje poziva `anchorCredentialNow` (sa novom proverom template-a).

## Tehnički detalji

- Provera template anchor statusa centralizovana u helper `assertTemplateAnchored(templateId)` koji čita `template_blockchain_records` (najnoviji red) i baca grešku ako `blockchain_status !== 'confirmed'`.
- `processCredentialAnchor` u `worker.server.ts` već postoji — provera se radi **pre** poziva, ne unutar njega, da bi se izbeglo skupo retry-ovanje.
- Backoff za "template not yet anchored" failure: kraći (npr. 2 min) jer očekujemo da će template uskoro biti potvrđen.
- Stara `chain_anchor_jobs` tabela ostaje, ali se više ne piše u nju; označiti komentarom kao deprecated.

## Pitanje pre implementacije

Da li želiš da staru tabelu `chain_anchor_jobs` odmah **obrišemo** nakon migracije podataka, ili da ostane (read-only) još neko vreme za audit/rollback?

## Problem

Kredencijali izdati pre poslednjeg fix-a imaju sva blockchain polja `NULL`. Prethodno dodati `ensureCredentialChainFields` u `worker.server.ts` radi auto-heal samo kad cron pokrene job — ali:

1. Postojeći `credential_anchor_jobs` red je `status=failed, attempts=2` sa starom porukom; ako objavljena verzija nije svežija od fix-a, retry ponovo "padne" pre nego što auto-heal stigne da se izvrši.
2. Ako `ensureCredentialChainFields` UPDATE iz nekog razloga ne uspe (RLS, kolona, race), niko to ne vidi jer rezultat update-a nije proveravan.

## Plan

### 1. Eksplicitan repair server fn
Dodati `repairCredentialChainFields(credentialId)` u `src/lib/chain/anchor.functions.ts`:
- `requireSupabaseAuth` + provera `has_role(issuer_admin/issuer_staff)` u org-u kredencijala
- Učita kredencijal + template, izračuna `vc_json`, `credential_hash`, `learner_secret`, `learner_commitment`, `template_ref`, `template_version`, `vc_id` (ista logika kao `ensureCredentialChainFields`)
- **Proverava grešku UPDATE-a** i baca jasnu poruku ako ne uspe (trenutno se `.update()` rezultat ignoriše)
- Resetuje `chain_status='not_requested'`, `chain_error=NULL`
- Resetuje postojeći `credential_anchor_jobs` red: `status='queued', attempts=0, next_attempt_at=now, last_error=NULL` (ili insert ako ne postoji)
- Vraća rezime: koja polja su izračunata

### 2. Bulk backfill server fn (jednokratno čišćenje)
`backfillAllPendingCredentials()` — platform_admin only:
- Nađe sve `credentials` gde je bilo koje od `credential_hash / learner_commitment / template_ref / vc_json` `NULL`
- Za svaki pozove istu repair logiku
- Vraća listu `{id, ok, error}` rezultata

### 3. UI: "Repair & retry" dugme
U `src/routes/issuer.anchoring-queue.tsx`, za svaki red kredencijala u listi (posebno one sa `failed` ili nedostajućim hash-evima) — dugme koje zove `repairCredentialChainFields` i invalidira query.

Opciono: u admin sekciji dugme "Backfill all" koje zove bulk fn.

### 4. Verifikacija deploy-a
Posle merge-a, korisnik mora ponovo da objavi (Publish), jer trenutna published verzija (`micro-credential-platform.lovable.app`) još uvek baca staru poruku `Cannot read properties of null (reading 'startsWith')`. Bez novog publish-a, ni auto-heal ni repair fn neće raditi na produkciji.

## Tehnički detalji

**Files to edit:**
- `src/lib/chain/anchor.functions.ts` — dodati `repairCredentialChainFields` i `backfillAllPendingCredentials`; izdvojiti zajedničku logiku iz `ensureCredentialChainFields` u helper koji se reuse-uje
- `src/lib/chain/worker.server.ts` — `ensureCredentialChainFields` da poziva isti helper i proverava grešku UPDATE-a
- `src/routes/issuer.anchoring-queue.tsx` — dodati Repair dugme na red sa failed/nedostajućim hash-evima

**Nema migracije** — sve potrebne kolone već postoje.

**Test plan:**
1. Pozvati `repairCredentialChainFields("f029d7f5-654a-4f57-970c-1e221f2b2ad2")` (ručno preko UI)
2. Proveriti da li su `credential_hash / learner_commitment / template_ref / vc_json` popunjeni u bazi
3. Sačekati cron (ili pozvati `triggerCredentialAnchor`) — anchor bi trebalo da prođe
4. Verifikovati `chain_status='confirmed'` i da `credential_blockchain_records.transaction_hash` postoji
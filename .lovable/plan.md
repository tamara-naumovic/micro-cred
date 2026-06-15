## Šta je problem

Kredencijal koji ti je failovao (`4037f511-…`, "Web3 Bootcamp - Solidity…", izdat 15.06. u 15:34) u bazi ima:

- `template_ref` = NULL
- `credential_hash` = NULL
- `learner_commitment` = NULL
- `chain_status` = `failed`
- `chain_error` = **`Cannot read properties of null (reading 'startsWith')`**

Kada earner prihvati kredencijal, anchor worker (`worker.server.ts → submitCredentialAnchor`) zove `to0x(c.template_ref!)`, `to0x(c.credential_hash!)`, `to0x(c.learner_commitment!)`. `to0x` interno radi `hex.startsWith("0x")` — i puca jer je `hex` `null`.

### Zašto je `template_ref` null

Kredencijal NIJE izdat preko ispravne putanje `issueCredentialsBatch` (server fn u `src/lib/chain/anchor.functions.ts`, linija ~579 — ona pravilno računa `vcId`, `templateRef`, `docHash`, `learnerCommitment`, `learnerSecret`).

Umesto toga, izdat je preko jedne od tri **legacy klijent-side putanje** u `src/lib/store.tsx`:

- `issueFromApplication` (linija 592) — koristi se kad issuer **odobri aplikaciju** sa `/issuer/requests`
- `directIssue` (linija 676)
- `bulkIssue` (linija 699)

Sve tri zovu `buildCredentialInsert` (linija 564) koji `INSERT`-uje u `credentials` samo osnovna polja (`title`, `earner_id`, `level`…) i **ne računa** `vc_id`, `template_version`, `template_ref`, `credential_hash`, `learner_commitment`, `learner_secret`, `canonical_payload`, `vc_json`. Anchor zatim puca.

Tvoj kredencijal je verovatno izašao iz "Approve application" toka.

## Plan popravke

### 1. Preusmeriti legacy putanje na ispravan server fn

Dodati novi server fn `issueCredentialFromApplication(applicationId, opts)` u `src/lib/chain/anchor.functions.ts` koji deli istu logiku kao `issueCredentialsBatch` (računa `vcId`, `docHash`, `learnerCommitment`, `learnerSecret`, `templateRef`, snima `vc_json`/`canonical_payload`), pa onda update-uje `applications.status='issued'` i upisuje timeline.

Izmeniti `store.tsx`:

- `issueFromApplication` → poziva novi server fn umesto direktnog `supabase.from("credentials").insert`.
- `directIssue` → poziva postojeći `issueCredentialsBatch`.
- `bulkIssue` → poziva postojeći `issueCredentialsBatch`.

Obrisati `buildCredentialInsert` ili ga ostaviti samo kao internu pomoćnu funkciju koja se više ne koristi za insert.

### 2. Hardening — jasna greška umesto kriptičnog `startsWith`

U `src/lib/chain/worker.server.ts → processCredentialAnchor`, pre poziva `submitCredentialAnchor` dodati guard:

```ts
if (!c.credential_hash || !c.learner_commitment || !c.template_ref) {
  throw new Error(
    `Credential ${credentialId} is missing chain fields ` +
    `(credential_hash/learner_commitment/template_ref) — ` +
    `it was issued via a legacy path that didn't compute them. Re-issue or backfill.`
  );
}
```

Isto u `processTemplateAnchor` za `v.template_ref` / `v.document_hash`.

U `src/lib/chain/hash.ts → to0x` i `hexToBytes`, baciti čistu poruku kada uđe `null`/`undefined` (umesto da puca na `startsWith`).

### 3. Backfill postojećeg failed kredencijala

Jednokratan server fn `backfillCredentialChainFields(credentialId)` (poziva se ručno iz UI dugmeta "Repair" u anchoring queue ili ručno) koji:

- učita kredencijal + njegov template
- ponovo izgradi VC JSON (`buildVcJson`), izračuna `credential_hash`, generiše `learner_secret`, izračuna `learner_commitment`, koristi `template_ref` sa templejta (ili rekomputuje ako i tamo fali)
- update-uje red kredencijala, resetuje `chain_status='not_requested'`, `chain_error=NULL`
- earner zatim može ponovo da pokrene accept/anchor

Tvoj `Web3 Bootcamp` kredencijal će biti popravljen ovim putem.

### Tehnički detalji — fajlovi koje menjam

```text
src/lib/chain/anchor.functions.ts
  + export const issueCredentialFromApplication = createServerFn(...)
  + export const backfillCredentialChainFields = createServerFn(...)

src/lib/chain/worker.server.ts
  ~ processCredentialAnchor: dodat pre-flight guard za null hex polja
  ~ processTemplateAnchor:   dodat pre-flight guard

src/lib/chain/hash.ts
  ~ to0x / hexToBytes: throw new Error("…expected hex string, got null") ako je null/undefined

src/lib/store.tsx
  ~ issueFromApplication → useServerFn(issueCredentialFromApplication)
  ~ directIssue          → useServerFn(issueCredentialsBatch)
  ~ bulkIssue            → useServerFn(issueCredentialsBatch)
  - buildCredentialInsert (više se ne koristi za insert)

src/routes/issuer.anchoring-queue.tsx  (opciono)
  + "Repair" dugme pored failed redova → poziva backfillCredentialChainFields
```

Nema migracija — sve postojeće kolone već postoje (`credential_hash`, `learner_commitment`, `learner_secret`, `template_ref`, `vc_id`, `vc_json`, `canonical_payload`).

### Šta neću dirati

- `issueCredentialsBatch` (već radi ispravno).
- Smart contract ABI, kontrakt adrese, environment secrets.
- RLS policies (postojeće dozvoljavaju ono što treba).

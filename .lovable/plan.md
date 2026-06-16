## Cilj

Na javnoj verifikacionoj stranici kredencijala (`/verify/:share_token`), **Learning outcomes** (skills/competencies) i **QA dokumenti** treba uvek da budu prikazani — earner ne sme moći da ih sakrije, jer su to ključne informacije koje potvrđuju znanja i kompetencije.

## Trenutno stanje

- `credentials.share_show_skills` (boolean) kontroliše prikaz skills-a; earner ga može isključiti u Visibility kartici (`/earner/credentials/:id`).
- RPC `get_public_credential` vraća skills samo kada je `share_show_skills = true`, a od QA podataka vraća samo `qa_type` i jedan `qa_document_path` (single).
- Template ima i `qa_document_paths text[]` (više fajlova), ali to nije izloženo javno.
- Bucket `qa-documents` je privatan — za javni preuzimanje treba signed URL.

## Promene

### 1) Baza — `get_public_credential` (migracija)

- Skills se uvek vraćaju (ukloniti `CASE WHEN share_show_skills`).
- Dodati u povratni skup `qa_document_paths text[]` (iz `templates.qa_document_paths`).
- Ostali `share_show_*` togglovi ostaju netaknuti.
- Takođe ažurirati `get_public_profile` da uvek vraća skills (uklanja se `case when c.share_show_skills`).

### 2) Public signed URL za QA dokumente (server funkcija)

Nova javna `createServerFn` (`src/lib/public-credential.functions.ts`) — `getPublicQaDocumentUrl({ shareToken, path })`:
- Validira da `share_token` postoji, da je kredencijal `share_is_public = true`, i da je `path` deo `templates.qa_document_paths` (ili jednako legacy `qa_document_path`) za pripadajući template.
- Vraća signed URL (npr. 5 min) iz buckta `qa-documents` koristeći `supabaseAdmin` (učitan unutar handlera).
- Bez auth middleware-a (javno dostupno preko share linka), ali sa strogom validacijom prema share tokenu.

### 3) Verify stranica — `src/routes/verify.$id.tsx`

- Skills sekciju prikazivati uvek kada `cred.skills.length > 0` (ukloniti uslov `cred.sharing.showSkills`); naslov sekcije preimenovati u **"Learning outcomes"** radi jasnoće.
- Dodati novu sekciju **"Quality assurance documents"** ispod Credential details:
  - lista svih `qa_document_paths` sa prikazom naziva fajla i dugmetom "Download" koje poziva `getPublicQaDocumentUrl` i otvara dobijeni signed URL.
  - Ako nema dokumenata, sekcija se ne prikazuje.

### 4) Earner Visibility kartica — `src/routes/earner.credentials.$id.tsx`

- Ukloniti red `["showSkills", "Show skills"]` iz togglova (skills se više ne mogu sakriti).
- Kolona `share_show_skills` ostaje u bazi radi kompatibilnosti, ali se ignoriše.
- Dodati malu napomenu ispod togglova: *"Learning outcomes and quality assurance documents are always visible on the shared verification page."*

## Tehnički detalji

```text
RPC: public.get_public_credential(_share_token)
  + qa_document_paths text[]      ← novo polje
  ~ skills                         ← uvek c.skills (bez toggle-a)

Server fn (public): getPublicQaDocumentUrl
  in:  { shareToken: string, path: string }
  out: { url: string, expiresInSec: number }
  guard: credential.share_is_public = true
         AND (path = template.qa_document_path
              OR path = ANY(template.qa_document_paths))
```

## Van opsega

- Ne menjamo izgled/sadržaj internog earner prikaza kredencijala.
- Ne uklanjamo kolonu `share_show_skills` iz baze (izbegavamo nepotrebnu migraciju podataka i breaking change za eksterne integracije).

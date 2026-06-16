## Problem

Template ima dva odvojena polja: **Learning outcomes** (`templates.outcomes`) i **Skills** (`templates.skills`). Na kredencijalu se čuva samo `credentials.skills`, a stranica za verifikaciju (`/verify/:id`) prikazuje te skill-ove pod oznakom **"Learning outcomes"** — što je pogrešno. Pravi learning outcomes iz šablona se uopšte ne pojavljuju ni na verifikaciji ni na earner-ovoj stranici kredencijala. Šablonska stranica (`issuer.microcredential-templates.$id`) je već ispravna (prikazuje oba odvojeno).

## Rešenje

Dovući `outcomes` iz povezanog šablona u javnu RPC-u i prikazati ih kao zasebnu sekciju, a Skills vratiti pod ispravnu oznaku.

### 1. DB migracija — `get_public_credential`

Dodati `outcomes text[]` u povratni tip funkcije (LEFT JOIN na `templates` preko `c.template_id`):

```sql
DROP FUNCTION IF EXISTS public.get_public_credential(text);
CREATE OR REPLACE FUNCTION public.get_public_credential(_share_token text)
RETURNS TABLE(
  ... postojeća polja ...,
  skills text[],
  outcomes text[],            -- NOVO
  ... ostalo ...
)
...
  SELECT
    ...,
    c.skills,
    COALESCE(t.outcomes, '{}'::text[]) AS outcomes,
    ...
  FROM credentials c
  LEFT JOIN templates t ON t.id = c.template_id
  WHERE c.share_token = _share_token AND c.share_is_public = true;
```

Takođe dodati `outcomes` u `get_public_credential_evidence` JSON payload (ako se koristi) i ažurirati `get_public_profile` da vraća `outcomes` po kredencijalu na isti način.

### 2. `src/routes/verify.$id.tsx` (Cloud grana, ~linije 139–165)

- Preimenovati postojeću sekciju "Learning outcomes" (koja zapravo prikazuje `cred.skills`) → **"Skills"**.
- Iznad nje dodati novu sekciju **"Learning outcomes"** koja renderuje `cred.outcomes` kao bullet listu (isti format kao na template detail-u: `<ul class="list-disc">`).
- Obe sekcije se prikazuju bezuslovno ako imaju sadržaja (outcomes su obavezni za public share po prethodnoj odluci).

Mock grana (linije 252–261): isti tretman — Skills ostaje, ali pošto mock store nema outcomes, prikazati outcomes samo ako postoji `cred.outcomes` (neobavezno za demo).

### 3. `src/routes/earner.credentials.$id.tsx`

- U Cloud preview kartici (oko linije 110/164, gde se prosleđuje `skills={cred.skills}`) dovući i prikazati `outcomes` iz povezanog šablona. Učitati `templates.outcomes` zajedno sa postojećim template fetch-om (već postoji `template_id`).
- Render: dve odvojene sekcije — **Learning outcomes** (bullet lista) iznad **Skills** (badge-ovi). Isti raspored kao na verifikaciji da bi earner video tačno ono što gledalac vidi.

### 4. Types

- `src/integrations/supabase/types.ts`: dodati `outcomes: string[]` u Returns tip za `get_public_credential` (i `get_public_profile` ako se ažurira).

## Van obima

- Promene na `issuer.microcredential-templates.$id.tsx` i `.new.tsx` (već ispravno razdvajaju outcomes/skills).
- Denormalizacija `outcomes` u sam `credentials` red — dovoljno je čitanje preko JOIN-a; sprečava razilaženje sa šablonom.
- Promene na VC/blockchain payload-ima.

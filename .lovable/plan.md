# Issuer Staff permissions — audit i dopune

## Trenutno stanje (provereno)

### Backend (DB RLS) — već ispravno, ne menja se
- `templates`: INSERT / UPDATE / DELETE dozvoljeno samo `issuer_admin` (iste org) ili `platform_admin`. Staff je blokiran na DB nivou. SELECT je javan, ali UI lista filtrira po dodeli.
- `template_assignees`: INSERT/DELETE samo admin. SELECT za staff vraća samo njegove redove.
- `organizations`: UPDATE samo `issuer_admin` (iste org) ili `platform_admin`.
- Server fn `publishTemplateAndAnchor` poziva `assertIssuerForTemplate`, koja zahteva `issuer_admin` ili `platform_admin` i baca `Forbidden` ako staff pokuša.

### Frontend — već implementirano
- Sidebar (`AppSidebarLayout`): staff nav nema "Create Micro-credential" ni "Staff" stavku.
- `/issuer/microcredential-templates` (lista): za staff prikazuje samo dodeljene template (filter po `template_assignees`); skriva "Create" i "Archive" dugmad.
- `/issuer/microcredential-templates/$id`: staff koji nije dodeljen biva preusmeren; `QaDocumentsEditor` i `TemplateBlockchainProofCard` su read-only za staff; `AssigneesCard` je read-only prikaz.
- `/issuer/microcredential-templates/new`: `Guarded` blok preusmeri staff na listu.
- `/issuer/staff`: staff preusmeren na `/issuer`.
- `/issuer/settings`: polja Website/About/Accreditation onemogućena za staff; DB RLS dodatno blokira pisanje.

## Manje izmene (cilj: jasna 403 poruka umesto tihog redirect-a)

Backend zaštita je već potpuna; izmene su čisto UX kako bi staff dobio eksplicitnu poruku po direktnom pristupu zabranjenoj ruti.

1. **`src/routes/issuer.microcredential-templates.new.tsx`** — `Guarded` komponenta:
   - Pre `<Navigate>` prikazati `toast.error("You don't have permission to create micro-credentials.")` jednom (useEffect) i preusmeriti na `/issuer/microcredential-templates`.

2. **`src/routes/issuer.microcredential-templates.$id.tsx`** — staff bez dodele:
   - Pre `<Navigate>` prikazati `toast.error("This micro-credential is not assigned to you.")` (useEffect, jednom).

3. **`src/routes/issuer.staff.tsx`** — staff koji direktno otvori `/issuer/staff`:
   - Dodati isti toast pattern ("Only institution admins can manage staff.") pre redirect-a.

## Tehnički detalji

- Implementacija toast-a u render-time `Navigate` granama: pomeriti poziv u `useEffect(() => { toast.error(...); }, [])` i renderovati `<Navigate to=... replace />`. Time se izbegava upozorenje React-a o set-state-during-render i toast se prikazuje tačno jednom.
- Nikakve izmene na DB-u, RLS-u, server funkcijama, niti na store layeru.
- Nikakve izmene na admin nav-u (Issuer Admin zadržava pun pristup).

## Šta NEĆE biti urađeno

- Promene RLS-a (nije potrebno — pokriveno).
- Skrivanje `templates` SELECT-a za staff (lista mora moći da pročita dodeljene; UI filter to obavlja, a `template_assignees` SELECT je već scoped).
- Izmena `publishTemplateAndAnchor` (već vraća Forbidden za staff).

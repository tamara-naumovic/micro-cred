## 1. Staff filter → searchable multi-select (templates list)

Fajl: `src/routes/issuer.microcredential-templates.index.tsx`

- Zameniti postojeći `Select` za staff sa **Popover + Command** (shadcn `cmdk`) komponentom:
  - Trigger: `Button` koji pokazuje "Svi staff" ili "N odabranih" (sa malim X chip-om za reset).
  - Sadržaj: `Command` sa `CommandInput` (search po imenu/emailu), `CommandList` sa `CommandItem` za svakog staff člana iz `orgStaff`, plus stavka "Bez dodeljenog staff-a" (`__unassigned__`).
  - Svaka stavka prikazuje checkbox (✓ ikona) za multi-select; klik toggluje izbor.
  - Dodati "Clear" dugme u footeru popovera.
- State: `staffFilter: string[]` (umesto string-a). Filter logika: template prolazi ako ima bar jednog assignee-a iz selektovanog skupa (ili je neassigned kad je `__unassigned__` izabran). Prazan niz = bez filtera.
- `resetFilters` postavlja na `[]`.
- Prevodi u `src/i18n/locales/{en,sr}/issuer/templates.json` (sekcija `filters`):
  - `staffPlaceholder` ("Pretraži staff…"), `staffSelectedCount` ("{{count}} odabranih"), `staffNoResults` ("Nema rezultata"), `staffClear` ("Poništi izbor"). Postojeći `staffAll`, `staffUnassigned` ostaju.

## 2. User menu (gornji desni ugao) — ukloniti Switch role, dodati Public profile + Settings

Fajl: `src/components/layouts/AppSidebarLayout.tsx` (linije 304–306 i okolina)

- Ukloniti `DropdownMenuItem` koji navigira na `/login` ("Switch role").
- Dodati dve nove stavke iznad "Sign out", po ulozi:
  - **Public profile** (ikona `UserCircle`):
    - earner → `/earner/profile`
    - issuer (admin i staff) → `/issuer/profile`
    - admin → sakriti stavku (nema javnog profila)
  - **Settings** (ikona `Settings`):
    - earner → `/earner/settings`
    - issuer → `/issuer/settings`
    - admin → `/admin/settings`
- Prevodi: dodati u `src/i18n/locales/{en,sr}/common.json` pod `header`:
  - `publicProfile` ("Javni profil" / "Public profile")
  - `settings` ("Podešavanja" / "Settings")
- Ukloniti neiskorišćen `header.switchRole` ključ (opciono ostaviti radi kompatibilnosti).

## Tehničke napomene

- Nema promene u store-u ili tipovima — `staffFilter` postaje `string[]` lokalno u komponenti.
- `Command` komponenta već postoji (`src/components/ui/command.tsx`), `Popover` takođe.
- Issuer staff vidi templates listu ali ne vidi staff filter (postojeći `isIssuerAdmin` gate ostaje).

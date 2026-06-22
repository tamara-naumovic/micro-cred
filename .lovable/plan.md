## Cilj

Preneti kompletnu issuer sekciju (sve stavke iz menija + manual + tour) na isti i18n model kao earner — `react-i18next` namespace-ovi sa `en` i `sr` fajlovima, koristeći već postojeći `LanguageSwitcher` u headeru.

## Terminologija (sr)

- **Issuer** → „Izdavalac" (org), „izdavaočev" kao pridev
- **Issuer admin** → „Administrator izdavaoca"
- **Issuer staff** → „Zaposleni"
- **Earner** → „Nosilac"
- **Micro-credential** → „mikrokredencijal"
- **Template** → „šablon (mikrokredencijala)"
- **Anchoring queue** → „Red za upis na blockchain"
- **Revocations** → „Opozivi"
- **Requests** → „Zahtevi"

Sve poruke koje se već čuvaju u bazi sa engleskim tekstom (notifikacije, audit log) ostaju van obima — već postoji obrasci za to gde je potrebno.

## Struktura prevoda

Dodajemo dva nova namespace fajla u `src/i18n/locales/{en,sr}/`:

- `issuer.json` — sav UI tekst issuer ruta. Top-level grupe poklapaju se sa rutama: `overview`, `templates` (`.index`, `.new`, `.detail`), `issue` (`.single`, `.bulk`), `requests`, `credentials`, `revocations`, `earners`, `staff`, `anchoringQueue`, `settings`, `profile`, `notifications`. Svaka grupa ima `title`, `description`, podgrupe za sekcije, kartice, dugmiće, prazna stanja, toast poruke, dialoge.
- `issuerManual.json` — sekcije sa stranice `/issuer/manual` (jedna grupa po sekciji: `title`, `linkLabel`, `body`).

Postojeći `tour.json` proširujemo `issuer.*` granom (analogno `earner.*` koja već postoji) i `src/lib/tour/issuerTour.ts` se rekonfiguriše da koristi `i18n.t("issuer.<step>.title/description")`. Engleski tekstovi ostaju 1:1 sa trenutnim u kodu.

`src/i18n/index.ts` dobija registraciju nova dva namespace-a (lazy import iste forme kao postojeći).

## Rute koje se refaktorišu

| Fajl | i18n grupa |
| --- | --- |
| `src/routes/issuer.index.tsx` | `overview` |
| `src/routes/issuer.microcredential-templates.index.tsx` | `templates.index` |
| `src/routes/issuer.microcredential-templates.new.tsx` | `templates.new` |
| `src/routes/issuer.microcredential-templates.$id.tsx` | `templates.detail` |
| `src/routes/issuer.issue.index.tsx` | `issue.single` |
| `src/routes/issuer.issue.bulk.tsx` | `issue.bulk` |
| `src/routes/issuer.requests.tsx` | `requests` |
| `src/routes/issuer.credentials.tsx` | `credentials` |
| `src/routes/issuer.revocations.tsx` | `revocations` |
| `src/routes/issuer.earners.tsx` | `earners` |
| `src/routes/issuer.staff.tsx` | `staff` |
| `src/routes/issuer.anchoring-queue.tsx` | `anchoringQueue` |
| `src/routes/issuer.settings.tsx` | `settings` |
| `src/routes/issuer.profile.tsx` | `profile` |
| `src/routes/issuer.notifications.tsx` | `notifications` (samo header — sama lista već koristi `earner` namespace + nove `events` ključeve) |
| `src/routes/issuer.manual.tsx` | `issuerManual` (statični SECTIONS niz se gradi iz `t(...)`) |

Sidebar i navigacija (`src/components/layouts/AppSidebarLayout.tsx`): već dohvaća labele preko `common` namespace-a za earner — dodajemo paralelne `common.nav.issuer.*` ključeve i koristimo ih za issuer stavke menija.

## Šta se ne menja

- Engleski tekst svih stranica ostaje identičan trenutnom — samo se izmešta iz JSX-a u `en/issuer.json` 1:1.
- Backend, RLS, šeme, server fn-ovi — bez promene. Notifikacije su već lokalizovane.
- Dinamički sadržaj iz baze (naslovi šablona, imena institucija, ishodi učenja) ostaje na jeziku unosa.
- Validacione poruke iz Zod schema-e ostaju engleske (van obima ovog plana).

## Verifikacija

Nakon implementacije, vizuelno proveriti:
- `/issuer` u SR i EN
- `/issuer/microcredential-templates`, `/issuer/issue`, `/issuer/requests`, `/issuer/credentials`, `/issuer/manual`
- jednom otvoriti tour kao novi issuer i potvrditi da koraci čitaju iz `tour.json`

Promena jezika preko `LanguageSwitcher` u headeru već prosleđuje izbor kroz `react-i18next`, pa ne treba dodatno ožičavanje.
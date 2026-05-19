
## Cilj
Skloniti "Demo" tab sa login stranice i mock personas, i napraviti 4 prava korisnika u bazi — po jednog za svaku rolu.

## Test nalozi

Svi nalozi koriste lozinku: **`Test1234`**

| Rola | Email | Lozinka |
|---|---|---|
| Earner (student) | `earner@test.com` | `Test1234` |
| Issuer (izdavalac) | `issuer@test.com` | `Test1234` |
| Verifier (poslodavac) | `verifier@test.com` | `Test1234` |
| Admin (platforma) | `admin@test.com` | `Test1234` |

## Koraci

1. **Uključiti auto-confirm email** u Supabase auth podešavanjima — da se nalozi mogu prijaviti odmah, bez verifikacije.
2. **Kreirati 4 naloga** preko Supabase admin API-ja (kroz migraciju koja koristi `auth.users` insert sa hash-ovanom lozinkom, ili kroz seed skriptu). Trigger `handle_new_user` automatski pravi profil i dodeljuje rolu `earner`.
3. **Dodeliti prave role** u `user_roles` tabeli:
   - `earner@test.com` → `earner` (već postavljeno triggerom)
   - `issuer@test.com` → `issuer_admin` (vezano za organizaciju "Faculty of Organizational Sciences")
   - `verifier@test.com` → `earner` (Verifier nema posebnu DB rolu — pristupa javnim verify linkovima; rola se mapira na frontend `verifier` preko ad-hoc rešenja ili dodajemo `verifier` u enum)
   - `admin@test.com` → `platform_admin`
4. **Verifier rola** — trenutno `app_role` enum u bazi nema `verifier`. Opcije:
   - **(A)** Dodati `verifier` u enum i mapirati ga u `auth.tsx` (čistije).
   - **(B)** Verifier ostaje običan ulogovan korisnik koji koristi `/issuers` i `/verify/$id` rute (one su javne ionako).
   - Preporuka: **(A)** — dodati u enum radi pravilnog redirekta nakon logina.
5. **Frontend izmene u `src/routes/login.tsx`**:
   - Skloniti "Demo" tab i `DemoPersonas` komponentu.
   - Tabovi ostaju samo "Sign in" i "Sign up".
   - Nakon prijave, redirect ide na home rute prema roli (`/earner`, `/issuer`, `/issuers` za verifier, `/admin`) umesto fiksno `/earner`.
6. **Skloniti mock korisnike iz `mock-data.ts`** (`mockUsers` array) i sve import-e koji ga koriste samo za demo prikaz. Mock organizacije, šabloni i kredencijali ostaju jer ih druge stranice još koriste kao fallback.

## Tehnički detalji

- Migracija dodaje `verifier` u `app_role` enum.
- Kreiranje auth korisnika ide kroz `supabase--insert` na `auth.users` sa `crypt('Test1234', gen_salt('bf'))` i `email_confirmed_at = now()`, plus eksplicitan `INSERT` u `user_roles` sa pravom rolom (jer `handle_new_user` trigger po defaultu dodeljuje samo `earner`).
- `auth.tsx` `mapRole` proširuje se na `verifier`.
- Login `onSubmit` čita aktivnu rolu iz bridge-ovanog `activeUser` i navigira na odgovarajući home.

## Šta korisnik dobija nakon implementacije

Login stranica sa 2 taba (Sign in / Sign up). Može odmah da se prijavi sa bilo kojim od 4 naloga gore i biće preusmeren u odgovarajući dashboard.

## Šta ću uraditi

### 1) Migracija (DB) ✓ već pripremljena
- Kreirati nedostajući `on_auth_user_created` trigger na `auth.users` → `public.handle_new_user()`.
- Backfill `public.profiles` za sve postojeće `auth.users` koji nemaju profil.
- Backfill `earner` uloge samo za korisnike koji nemaju **nijednu** ulogu (postojeće `issuer_admin`/`issuer_staff` se NE diraju).

### 2) `src/lib/admin-users.functions.ts` — `provisionUser`
- Posle `createUser` / `inviteUserByEmail` eksplicitno **upsert** profila (`id, email, display_name`) pre upisa uloge. Više se ne oslanjamo isključivo na trigger.
- Logika za brisanje default `earner` uloge i upis ciljane uloge ostaje ista.

### 3) `src/lib/auth.tsx` — sprečiti prevremeni "earner" redirect
- U `bridgeToActiveUser`: kada postoji `user`, ali `user_roles` vraća prazno **i** ne postoji profil (tipično za invite sesiju pre nego što stigne upis), ne raditi fallback na `"earner"`. Ostaviti `activeUser = null` (RoleGuard tada čeka), što sprečava skok u `/earner` na prvi klik invite linka.

### 4) `src/routes/set-password.tsx` — ne dozvoliti dvostruki set-password
- Na ulasku proveriti razlog za sesiju:
  - Ako URL hash sadrži `type=invite` ili `type=recovery` → normalan flow.
  - Ako nema tih parametara, a korisnik **je već ulogovan** (znači lozinka je već postavljena ranije) → redirect na `/` (ili na odgovarajući dashboard preko `RoleGuard`-a kad ga ruter raspodeli).
  - Ako nema parametara ni sesije → već postojeća poruka "link je nevažeći".
- Na taj način korisnik koji je već prošao kroz set-password ne može ponovo da uđe na `/set-password`.

### 5) Verifikacija
- `/admin/users` prikazuje sve naloge (5/5).
- Novi invite → klik link → `/set-password` → unos lozinke 2x → `/login` → login odlazi pravo u tačnu ulogu, bez međukoraka u `/earner`.
- Direktan odlazak na `/set-password` posle uspešnog postavljanja lozinke → automatski redirect dalje.

### Šta NE menjam
- RLS politike (`profiles_select_all`, `user_roles_select_own_or_admin` su OK).
- UI `admin.users.tsx` — postaje kompletan čim podaci budu kompletni.

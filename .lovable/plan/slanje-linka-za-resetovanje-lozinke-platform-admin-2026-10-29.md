# Slanje linka za resetovanje lozinke (Platform Admin)

## Šta korisnik dobija
- Na stranici **Admin → Korisnici**, u meniju akcija svakog korisnika, nova stavka **"Pošalji link za resetovanje lozinke"**.
- Potvrdni dijalog ("Poslati link na email@…?"), zatim poruka o uspehu ili grešci.
- Korisnik dobija email sa linkom koji vodi na novu stranicu **/reset-password**, gde unosi i potvrđuje novu lozinku (min. 6 karaktera), pa se preusmerava na prijavu.
- Akciju beleži audit log (ko je poslao, kome, kada).
- Sve je prevedeno na engleski i srpski.

## Tehnički detalji
- Nova server funkcija `adminSendPasswordReset` u `src/lib/admin-users.functions.ts`: `requireSupabaseAuth`, provera da je pozivalac platform admin (isti obrazac kao `adminUpdateUser`), pronalazi email korisnika, šalje reset preko `supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })`, upisuje audit zapis.
- Nova javna ruta `src/routes/reset-password.tsx`: čeka recovery sesiju (`onAuthStateChange` / `type=recovery`), forma sa `supabase.auth.updateUser({ password })` bez `current_password`, zatim odjava i redirect na `/login`; prikaz greške ako je link istekao.
- Izmene u `src/routes/admin.users.tsx` (stavka menija + AlertDialog) i ključevi u `admin.json` / `common.json` (en, sr).
- Koristi se podrazumevani email za autentifikaciju — nije potrebno podešavanje domena.

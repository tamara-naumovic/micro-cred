# Ažuriranje dokumentacije nakon RLS ispravke na `public.profiles`

Cilj: uskladiti postojeće izveštaje sa stvarnim stanjem u bazi, bez regenerisanja nepovezanih sekcija.

## Prvo: ponovna verifikacija (pre bilo kakve izmene teksta)

Pre nego što se nedostatak označi kao rešen, ponovo se izvršava provera na bazi:

1. Ispis aktuelnog SQL-a politike `profiles_select_staff` i tela funkcije `can_view_profile`.
2. Test pristupa simulacijom JWT-a za četiri naloga: admin institucije A (FON), admin institucije B (Oxford), nosilac, platform admin — broj vidljivih profila po nalogu i eksplicitna provera da admin A ne vidi profil admina B i obrnuto.

Ako oba naloga iz različitih institucija ne pokažu očekivano ograničenje, dokumentacija se NE menja i prijavljuje se stvarni nalaz.

## Izmene u dokumentima (ciljano, samo pogođeni redovi)

### 1. `/mnt/documents/Matrica_sledljivosti_CredSeal.md`
- Red „Nosioci institucije (earner-i)": kolona „Poznato ograničenje" — ukloniti navod da `profiles_select_staff` dozvoljava uvid van sopstvene institucije; zameniti napomenom da je izolacija sada sprovedena na nivou baze preko `can_view_profile`.

### 2. `/mnt/documents/Bezbednost_i_privatnost_CredSeal.md`
- Sekcija 3 (izolacija po instituciji): red o `profiles_select_staff` menja status iz „Delimično — poznati nedostatak" u „Implementirano", sa opisom nove logike.
- Sekcija sa listom nedostataka (tačka 1 na kraju dokumenta): ukloniti stavku o `has_role` vs `has_role_in_org`.
- Dodati kratak pododeljak sa: imenom politike, logikom `can_view_profile`, ko sada može čitati profile, rezultatom testa iz dve institucije i referencom na migraciju.

### 3. `/mnt/documents/data-model.md`
- Red u tabeli RLS politika: zameniti stari `qual` izraz aktuelnim `can_view_profile(id)`.

## Sadržaj koji se dokumentuje

- **Politika:** `profiles_select_staff` na `public.profiles`, `SELECT`, `USING (public.can_view_profile(id))`.
- **Logika `can_view_profile(_profile_id)`** (`SECURITY DEFINER`, `search_path = public`): pristup ako je to sopstveni profil; ako je korisnik platform admin; ili ako je `issuer_admin`/`issuer_staff` i ciljni profil je povezan sa istom organizacijom preko `earner_institutions`, `user_roles`, `applications` ili `credentials`.
- **Ko čita profile:** vlasnik profila; platform admin (svi); admin/zaposleni institucije (samo profili povezani sa njihovom institucijom); ostali korisnici — samo sopstveni profil.
- **Rezultat testa:** brojevi vidljivih profila po nalogu iz koraka verifikacije, uključujući obostrano odbijen pristup između dve institucije.
- **Izvor ispravke:** migracioni fajl u `supabase/migrations/` koji uvodi `can_view_profile` i zamenjuje politiku (tačan naziv fajla se navodi nakon provere).

## Napomena

Menjaju se isključivo navedeni redovi/pododeljci u tri MD fajla. Aplikacija, baza i ostale sekcije izveštaja ostaju netaknute.

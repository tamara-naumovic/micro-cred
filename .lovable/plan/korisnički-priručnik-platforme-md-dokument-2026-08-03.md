# Korisnički priručnik platforme (MD dokument)

Kreiraću jedan dokument `Korisnicki_prirucnik.md` u dokumentima (za pregled i preuzimanje), na srpskom, sa tri tražene celine.

## Struktura dokumenta

1. **Uvod i uloge**
   - Kratak opis platforme i uloga: platform admin, issuer admin, issuer staff, earner (nosilac), javni/anonimni posetilac.
   - Tabela: koja uloga vidi koje sekcije menija.

2. **Funkcionalnosti po ulozi**
   - Za svaku ulogu lista funkcionalnosti sa kratkim opisom (šta radi, gde se nalazi, koji je rezultat).
   - Earner: prijava za mikrokredencijal, praćenje statusa, prihvatanje/odbijanje, evidencija i fajlovi, javni profil i deljenje, privatnost po polju, obaveštenja, jezik i podešavanja.
   - Issuer staff: dodeljeni šabloni, zahtevi za izdavanje, direktno i grupno izdavanje, izdati kredencijali (izmena i ponovno slanje, prihvatanje odbijanja, produženje roka), blockchain red.
   - Issuer admin: sve navedeno + upravljanje šablonima (formalni/neformalni, filteri), zaposleni i role, nosioci, opozivi, javni profil institucije, podešavanja.
   - Platform admin: institucije, korisnici i role, registracije, aktivnost, audit, sistemska podešavanja.
   - Javni korisnik: katalog izdavača, javni šabloni, verifikacija kredencijala, javni profil nosioca.

3. **Detaljan vodič kroz platformu (tour guide)**
   - Korak-po-korak scenariji: prvo logovanje, guided tour, kompletan tok earnera od prijave do deljenja, kompletan tok izdavača od kreiranja šablona do izdavanja i opoziva, tok produženja roka, tok grupnog izdavanja.
   - Svaki korak: gde kliknuti, šta se unosi, šta se očekuje kao rezultat.

4. **Objašnjenje svake stranice po ulozi**
   - Tabelarno/po sekcijama za sve rute: putanja, uloga koja joj pristupa, svrha stranice, ključni elementi na ekranu, dostupne akcije.
   - Pokriva earner (8 stranica), issuer (14), admin (8), javne stranice (7).

## Tehnički detalji

- Sadržaj se izvodi iz stvarnog koda: `src/routes/*`, `src/components/layouts/AppSidebarLayout.tsx` (navigacija po ulogama), manual/tour fajlovi (`src/routes/*manual.tsx`, `src/lib/tour/*`) i postojeći `docs/business-rules.md`.
- Fajl se upisuje u `/mnt/documents/Korisnicki_prirucnik.md` i biće prikazan kao artefakt za preuzimanje; kopija u `docs/` po potrebi.
- Jezik: srpski, terminologija „mikrokredencijal“, naziv platforme CredSeal.

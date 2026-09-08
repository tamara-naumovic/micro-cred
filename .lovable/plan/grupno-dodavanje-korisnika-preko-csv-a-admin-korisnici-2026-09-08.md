# Grupno dodavanje korisnika preko CSV-a (admin / Korisnici)

## Cilj
Na stranici Korisnici administrator platforme dobija drugi način dodavanja: umesto unosa jednog po jednog, može da otpremi CSV listu i sve njih kreira odjednom, uz izbor institucije u formi.

## Kako će izgledati
U dijalogu "Dodaj korisnika" dodaju se dve kartice:
- **Pojedinačno** — postojeća forma, nepromenjena.
- **Grupno (CSV)** — nova.

U grupnoj kartici:
1. Polje za otpremanje `.csv` fajla (ili nalepljivanje teksta), sa primerom formata.
2. Padajući izbor institucije koji važi za sve redove iz fajla.
3. Pregled: koliko redova je ispravno, koliko ima grešaka, sa listom prvih nekoliko grešaka (loš email, prekratka lozinka, nepoznata uloga, red bez svih kolona).
4. Dugme "Dodaj N korisnika" i, po završetku, rezime: koliko je kreirano, koliko nije, i zašto.

## Format CSV-a
Kolone: `display_name, role, email, password` (zaglavlje opciono, razdvajanje zarezom/tačka-zarezom/tabom).

- `role` prihvata `earner` i `issuer`.
- Za `issuer` redove institucija je obavezna — uzima se iz forme. Podrazumevana pod-uloga je **zaposleni (staff)**; u formi postoji kvačica "issuer korisnici iz fajla su i administratori institucije" ako se žele obe pod-uloge.
- Za `earner` redove institucija iz forme je opciona: ako je izabrana, svaki novi nosilac se automatski povezuje s njom.
- Lozinka minimum 6 znakova; nalog se kreira odmah potvrđen (bez slanja pozivnice).
- Ako korisnik s tim email-om već postoji, ne pravi se duplikat — samo mu se dodeljuje uloga/institucija i to se prikazuje u rezimeu.

## Tehnički detalji
- Nova serverska funkcija `adminBulkCreateUsers` u `src/lib/admin-users.functions.ts`: provera `assertPlatformAdmin`, zatim po redu poziva postojeći `provisionUser` (mode `password`) i, za earner-e sa izabranom institucijom, upisuje u `earner_institutions`. Vraća `{ created, skippedExisting, failed, errors[] }`. Bez izmena baze.
- Validacija ulaza na serveru (email regex, dužina lozinke, dozvoljene uloge), ne samo u pregledaču.
- Nova komponenta `src/components/admin/BulkUsersCsvUpload.tsx` (po uzoru na postojeći `BulkUsersUpload`, ali sa kolonom `role` i izborom institucije). Postojeći `BulkUsersUpload` za issuer stranu ostaje netaknut.
- `AddUserDialog` u `src/routes/admin.users.tsx` dobija `Tabs` sa dve kartice; posle uspeha poziva `storeReset()` da se lista osveži.
- Svi novi tekstovi idu u `src/i18n/locales/en/admin.json` i `sr/admin.json` pod `users.bulk.*`.

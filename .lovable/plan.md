# Plan: Scenario testiranja za Issuer-Administrator ulogu

Kreiraću MD fajl `/mnt/documents/Issuer_Administrator_scenario.md` po ugledu na priloženi earner scenario (E1–E11), prilagođen ulozi administratora institucije (issuer sa `subRole = admin`).

## Struktura dokumenta

**Uvod** — isti okvir kao earner dokument: cilj testiranja, upotreba testnih podataka, kriterijumi na koje testeri obraćaju pažnju.

**Scenariji (IA1–IA12):**

- **IA1. Prijava i pregled kontrolne table** — login, pregled metrika institucije, glavne sekcije (Zaposleni, Nosioci, Mikrokredencijali, Zahtevi, Kredencijali, Anchoring, Revocations, Notifikacije, Profil, Podešavanja).
- **IA2. Uređivanje javnog profila institucije** — izmena naziva, opisa, logotipa, kontakt podataka; provera javne stranice institucije.
- **IA3. Upravljanje zaposlenima (Staff panel)** — dodavanje postojećeg korisnika, kreiranje novog naloga, grupno dodavanje, pretraga, paginacija.
- **IA4. Upravljanje ulogama zaposlenih** — dodela/oduzimanje admin i staff role, kombinovane role (admin+staff), zaštita od menjanja sopstvene role, uklanjanje člana iz institucije.
- **IA5. Upravljanje nosiocima (Earners)** — povezivanje postojećeg earnera, kreiranje novog earner naloga, grupno dodavanje, pretraga.
- **IA6. Kreiranje šablona mikrokredencijala** — kreiranje draft šablona sa svim poljima (naziv, opis, veštine, ishodi učenja, nivo, preduslovi, trajanje, rok važenja).
- **IA7. Objavljivanje šablona i blockchain anchoring** — objavljivanje šablona, dodela staff članova, Bloxberg anchoring, verifikacija dokaza.
- **IA8. Obrada zahteva za izdavanje** — pregled zahteva, filtriranje, komentari na timeline-u, napredovanje kroz statuse (review → evidence → verification → issuance), odbijanje sa razlogom.
- **IA9. Manuelno izdavanje kredencijala** — pojedinačno izdavanje kredencijala nosiocu (izbor šablona, ocena, datum isteka), i grupno izdavanje.
- **IA10. Anchoring queue i upravljanje kredencijalima** — praćenje statusa anchoring poslova, pregled izdatih kredencijala, revocation sa razlogom.
- **IA11. Obaveštenja** — pregled i navigacija do povezanog entiteta iz notifikacije.
- **IA12. Odjava sa platforme** — provera da zaštićene stranice više nisu dostupne.

## Format svakog scenarija (isti kao PDF)

- **Situacija** — kontekst.
- **Preduslov** — po potrebi (npr. institucija je registrovana i odobrena).
- **Zadatak** — numerisani koraci.
- **Zadatak je uspešno završen kada** — merljiv kriterijum.
- **Obratite pažnju na sledeće** — checklista za testera (kod ključnih scenarija: IA3/IA4, IA7, IA8, IA9, IA10).
- **Važan očekivani tok / izuzeci** — gde su statusni tokovi bitni (IA7 anchoring, IA8 lifecycle, IA10 revocation).

Napomene o testnim podacima ponavljam u scenarijima koji uključuju unos (IA3, IA5, IA6, IA9).

## Isporuka

- Jedan fajl: `/mnt/documents/Issuer_Administrator_scenario.md`
- Jezik: srpski (isti stil i terminologija kao priloženi PDF)
- Bez izmena u kodu projekta
- Emitujem `<presentation-artifact>` tag za preuzimanje

# Poslovna pravila platforme MicroCred

Dokument opisuje funkcije sistema iz poslovne perspektive: ko ih izvršava, pod kojim uslovima, šta se menja, kakvi su statusi pre i posle, koja su ograničenja, alternativni tokovi i povezani entiteti, kao i trenutni status implementacije.

## Uloge u sistemu

| Uloga (kod) | Opis |
|---|---|
| `platform_admin` | Administrator platforme. Upravlja institucijama, korisnicima, sistemskim podešavanjima i auditom. |
| `issuer_admin` | Administrator institucije izdavača. Upravlja članovima institucije, šablonima i izdavanjem. |
| `issuer_staff` | Zaposleni institucije. Radi sa dodeljenim šablonima i zahtevima za izdavanje. |
| `earner` | Nosilac kredencijala. Aplicira, prihvata, deli i preuzima evidenciju. |
| Javni / anoniman | Korisnik bez prijave. Pregleda javne profile institucija, javne šablone i verifikuje kredencijale. |
| Sistem / cron | Pozadinski procesi (anchor worker, podsetnici na istek, audit logger). |

> Napomena: jedan korisnik može istovremeno imati i `issuer_admin` i `issuer_staff` rolu u istoj instituciji. Dodelu obe role obavljaju `platform_admin` i `issuer_admin`.

## Glavni entiteti (tabele)

`profiles`, `user_roles`, `organizations`, `earner_institutions`, `templates`, `template_versions`, `template_assignees`, `template_anchor_jobs`, `template_blockchain_records`, `applications`, `application_comments`, `application_timeline`, `credentials`, `credential_secrets`, `credential_anchor_jobs`, `credential_blockchain_records`, `chain_anchor_jobs`, `notifications`, `registration_requests`, `audit_log`, `platform_events`.

## Legenda statusa implementacije

- ✅ implementirano — postoji backend handler i UI tok.
- 🟡 delimično implementirano — postoji deo (samo UI, samo backend, ili nedostaju ivični slučajevi/notifikacije).
- ⏳ planirano — predviđeno, ali još bez implementacije u kodu.

---

## 1. Autentikacija i nalozi

### 1.1 Prijava korisnika
- **Uloga:** svi prijavljeni nalozi (`platform_admin`, `issuer_admin`, `issuer_staff`, `earner`).
- **Preduslovi:** postojeći nalog sa potvrđenom e-adresom; ako se koristi Google, povezan Google identitet.
- **Ulazni podaci:** e-adresa + lozinka, ili Google OAuth flow.
- **Rezultat:** aktivna sesija (JWT) u browseru; korisnik se preusmerava na odgovarajući dashboard prema roli.
- **Statusi pre/posle:** nalog `bez sesije` → `aktivna sesija`.
- **Ograničenja:** nije dozvoljen anonimni signup; broj pokušaja kontroliše Auth servis.
- **Izuzeci i alternativni tokovi:** pogrešni kredencijali → poruka o grešci; neaktiviran nalog → preusmerenje na "Postavljanje lozinke"; OAuth provider nije konfigurisan → "Unsupported provider".
- **Povezani entiteti:** `auth.users`, `profiles`, `user_roles`.
- **Status:** ✅

### 1.2 Postavljanje lozinke (invite / reset)
- **Uloga:** svi nalozi.
- **Preduslovi:** validan invite ili reset token poslat e-poštom.
- **Ulazni podaci:** nova lozinka (min. 6 karaktera).
- **Rezultat:** lozinka je postavljena, sesija aktivna.
- **Statusi pre/posle:** `invited` / `password_reset_requested` → `active`.
- **Ograničenja:** token istekao → odbijanje sa porukom; minimalna dužina lozinke.
- **Izuzeci:** istekao link → korisnik traži novi reset.
- **Povezani entiteti:** `auth.users`.
- **Status:** ✅

### 1.3 Promena lozinke iz profila
- **Uloga:** svi prijavljeni korisnici.
- **Preduslovi:** aktivna sesija.
- **Ulazni podaci:** trenutna i nova lozinka.
- **Rezultat:** ažurirana lozinka.
- **Ograničenja:** minimalna dužina; provera stare lozinke.
- **Povezani entiteti:** `auth.users`.
- **Status:** ✅

### 1.4 Odjava
- **Uloga:** svi prijavljeni korisnici.
- **Rezultat:** sesija prekinuta; preusmerenje na `/login`.
- **Status:** ✅

### 1.5 Inicijalizacija profila pri kreiranju naloga
- **Uloga:** sistem (trigger).
- **Preduslovi:** novi red u `auth.users`.
- **Rezultat:** kreiran red u `profiles` (id, email, display_name, language) i podrazumevana rola `earner` u `user_roles`. Provisioning tokovi za staff/admin uklanjaju ovu default rolu.
- **Povezani entiteti:** `profiles`, `user_roles`.
- **Status:** ✅

---

## 2. Registracija institucija

### 2.1 Podnošenje zahteva za registraciju institucije
- **Uloga:** javni korisnik.
- **Preduslovi:** popunjen formular sa kontakt podacima i osnovnim podacima o instituciji.
- **Ulazni podaci:** naziv institucije, kontakt osoba, kontakt e-adresa, država, dokumentacija o akreditaciji (opciono).
- **Rezultat:** novi red u `registration_requests` sa statusom `pending`.
- **Statusi pre/posle:** — → `pending`.
- **Ograničenja:** validacija e-adrese; jedan aktivni zahtev po e-adresi (preporuka, nije strogo na bazi).
- **Povezani entiteti:** `registration_requests`.
- **Status:** ✅

### 2.2 Pregled zahteva za registraciju
- **Uloga:** `platform_admin`.
- **Preduslovi:** rola platformskog admina.
- **Rezultat:** lista zahteva sa filterima po statusu.
- **Status:** ✅

### 2.3 Odobravanje zahteva za registraciju
- **Uloga:** `platform_admin`.
- **Preduslovi:** zahtev u statusu `pending`.
- **Ulazni podaci:** opciono — preuređeni podaci o organizaciji, način provizioniranja admina (`password` ili `invite`).
- **Rezultat:** kreirana `organizations` (tip `issuer`), kreiran / invajtovan `issuer_admin` korisnik, dodeljen u `user_roles` (organizacijski), `registration_requests.status = approved`. Notifikacija podnosiocu.
- **Statusi pre/posle:** `pending` → `approved`.
- **Ograničenja:** ako provizioniranje admina ne uspe, kreiranje organizacije se poništava (rollback).
- **Izuzeci:** duplikat naziva organizacije; e-adresa već postoji kao drugi tip naloga.
- **Povezani entiteti:** `registration_requests`, `organizations`, `profiles`, `user_roles`, `notifications`.
- **Status:** ✅

### 2.4 Odbijanje zahteva za registraciju
- **Uloga:** `platform_admin`.
- **Ulazni podaci:** razlog odbijanja (opciono).
- **Rezultat:** `registration_requests.status = rejected`; notifikacija podnosiocu.
- **Statusi pre/posle:** `pending` → `rejected`.
- **Status:** ✅

---

## 3. Platformska administracija

### 3.1 Listanje i pretraga korisnika
- **Uloga:** `platform_admin`.
- **Rezultat:** paginirana lista svih korisnika sa rolama i organizacijama.
- **Povezani entiteti:** `profiles`, `user_roles`, `organizations`.
- **Status:** ✅

### 3.2 Kreiranje korisnika (bilo koja rola)
- **Uloga:** `platform_admin` (`adminCreateUser`).
- **Ulazni podaci:** e-adresa, ime, role (jedna ili više), organizacija (ako je rola institucionalna), mode `password`/`invite`, lozinka ili `redirectTo`.
- **Rezultat:** novi nalog u `auth.users`, profil, rola(e) u `user_roles`. Default `earner` rola se uklanja ako nije eksplicitno tražena.
- **Ograničenja:** za `issuer_admin`/`issuer_staff` obavezna je `organizationId`; lozinka ≥ 6 karaktera za password mode.
- **Izuzeci:** korisnik sa istom e-adresom već postoji → reuse postojećeg `user_id` i dodavanje role.
- **Povezani entiteti:** `auth.users`, `profiles`, `user_roles`, `organizations`.
- **Status:** ✅

### 3.3 Izmena korisnika
- **Uloga:** `platform_admin` (`adminUpdateUser`).
- **Ulazni podaci:** `userId`, opcionalno e-adresa, ime, lista rola, organizacija.
- **Rezultat:** ažurirane vrednosti; ako su prosleđene role, kompletno se zamenjuju.
- **Ograničenja:** za institucionalne role obavezna `organizationId`.
- **Status:** ✅

### 3.4 Brisanje korisnika
- **Uloga:** `platform_admin` (`adminDeleteUser`).
- **Preduslovi:** ne sme da bude lični nalog.
- **Rezultat:** korisnik obrisan iz `auth.users` (kaskadno čisti profil i role).
- **Izuzeci:** sopstveni nalog → odbijeno.
- **Status:** ✅

### 3.5 Kreiranje institucije sa adminom u jednom koraku
- **Uloga:** `platform_admin` (`adminCreateInstitution`).
- **Ulazni podaci:** podaci o organizaciji + podaci o adminu (mode `password`/`invite`).
- **Rezultat:** nova `organizations`, kreiran admin korisnik, dodeljena `issuer_admin` rola.
- **Izuzeci:** ako provizioniranje admina padne, organizacija se briše (rollback).
- **Status:** ✅

### 3.6 Upravljanje organizacijama (lista, izmena, brisanje)
- **Uloga:** `platform_admin`.
- **Rezultat:** ažurirani podaci o organizaciji, akreditacioni dokumenti, status (aktivna/arhivirana).
- **Povezani entiteti:** `organizations`.
- **Status:** 🟡 (osnovne operacije implementirane, naprednija arhivacija/merge planirano).

### 3.7 Konfiguracija definicija rola
- **Uloga:** `platform_admin`.
- **Rezultat:** pregled rola sistema; sama lista rola je definisana enumom u bazi.
- **Status:** 🟡 (read-only pregled; izmena rola nije podržana).

### 3.8 Sistemska podešavanja
- **Uloga:** `platform_admin`.
- **Rezultat:** podešavanja platforme (npr. defaultni jezici, vrednosti).
- **Status:** 🟡

### 3.9 Audit log
- **Uloga:** `platform_admin`.
- **Rezultat:** pregled bezbednosno relevantnih događaja: provizioniranje korisnika, promene rola, izdavanje, revokacije.
- **Povezani entiteti:** `audit_log`.
- **Status:** ✅

### 3.10 Aktivnost platforme
- **Uloga:** `platform_admin`.
- **Rezultat:** stream poslovnih događaja: izdavanja, registracije, aplikacije, prijave.
- **Povezani entiteti:** `platform_events`.
- **Status:** ✅

### 3.11 Bulk upload korisnika
- **Uloga:** `platform_admin`.
- **Ulazni podaci:** CSV/lista redova (ime, e-adresa, rola, organizacija).
- **Rezultat:** redom kreira naloge; vraća broj uspešnih i listu grešaka.
- **Izuzeci:** pojedinačni red ne prekida obradu ostalih.
- **Status:** 🟡 (osnovni tok kroz `BulkUsersUpload` komponentu).

---

## 4. Institucija — dashboard i podešavanja

### 4.1 Dashboard institucije
- **Uloga:** `issuer_admin`, `issuer_staff`.
- **Rezultat:** ključne metrike: broj kredencijala, aktivnih zahteva, statusa anchoringa.
- **Status:** ✅

### 4.2 Javni profil institucije (uređivanje)
- **Uloga:** `issuer_admin`.
- **Ulazni podaci:** opis, sajt, država, logo, akreditacioni dokumenti.
- **Rezultat:** ažurirana `organizations`.
- **Povezani entiteti:** `organizations`.
- **Status:** ✅

### 4.3 Podešavanja institucije
- **Uloga:** `issuer_admin`.
- **Rezultat:** podešavanja vezana za način anchoringa, default jezika, šablona obaveštenja.
- **Status:** 🟡

---

## 5. Institucija — članovi (staff i admin)

### 5.1 Listanje članova institucije
- **Uloga:** `issuer_admin` (`listIssuerStaff`).
- **Preduslovi:** rola admina u organizaciji.
- **Rezultat:** lista svih korisnika sa rolama `issuer_admin` ili `issuer_staff` u organizaciji, sa flagovima `isAdmin` i `isStaff` i datumom dodavanja.
- **Povezani entiteti:** `user_roles`, `profiles`.
- **Status:** ✅

### 5.2 Pretraga članova
- **Uloga:** `issuer_admin`.
- **Ulazni podaci:** slobodni tekst.
- **Rezultat:** filter po imenu, e-adresi i lokalizovanim terminima role (admin/staff).
- **Status:** ✅

### 5.3 Dodavanje postojećeg korisnika kao staff
- **Uloga:** `issuer_admin` (`addIssuerStaff`, mode `existing`).
- **Preduslovi:** korisnik već ima nalog na platformi.
- **Ulazni podaci:** e-adresa.
- **Rezultat:** novi red u `user_roles` (rola `issuer_staff`, organizacija).
- **Izuzeci:** korisnik ne postoji → poruka da se prebaci na "Kreiraj novi nalog".
- **Status:** ✅

### 5.4 Kreiranje novog naloga (staff) sa lozinkom
- **Uloga:** `issuer_admin` (`addIssuerStaff`, mode `password`).
- **Ulazni podaci:** e-adresa, ime, lozinka (≥ 6).
- **Rezultat:** kreiran auth korisnik, profil, dodeljena `issuer_staff` rola, uklonjena podrazumevana `earner` rola.
- **Status:** ✅

### 5.5 Invite novog staff naloga e-poštom
- **Uloga:** `issuer_admin` (`addIssuerStaff`, mode `invite`).
- **Ulazni podaci:** e-adresa, ime, `redirectTo`.
- **Rezultat:** poslat invite mejl; nalog ostaje neaktivan dok korisnik ne postavi lozinku.
- **Status:** ✅

### 5.6 Grupno dodavanje staff naloga (bulk)
- **Uloga:** `issuer_admin` (`bulkAddIssuerStaff`).
- **Ulazni podaci:** lista redova (ime, e-adresa, lozinka).
- **Rezultat:** za svaki red — kreiran nalog (ili reuse), dodeljena `issuer_staff` rola; vraća se broj uspešnih i lista grešaka.
- **Izuzeci:** pojedinačna greška ne prekida ostatak.
- **Status:** ✅

### 5.7 Dodela / oduzimanje admin role
- **Uloga:** `issuer_admin` (`setIssuerAdminRole`).
- **Ulazni podaci:** `userId`, `makeAdmin`.
- **Rezultat:** dodaje/uklanja `issuer_admin` red u `user_roles`.
- **Ograničenja:** zabranjeno samoukidanje admin role; zabranjeno uklanjanje poslednjeg admina; ako bi korisnik nakon uklanjanja ostao bez ijedne role u organizaciji → greška (preporuka: ukloniti člana).
- **Povezani entiteti:** `user_roles`.
- **Status:** ✅

### 5.8 Dodela / oduzimanje staff role
- **Uloga:** `issuer_admin` (`setIssuerStaffRole`).
- **Ulazni podaci:** `userId`, `makeStaff`.
- **Rezultat:** dodaje/uklanja `issuer_staff` red.
- **Ograničenja:** ako bi nakon oduzimanja korisnik ostao bez ijedne role → greška.
- **Status:** ✅

### 5.9 Uklanjanje člana iz institucije
- **Uloga:** `issuer_admin` (`removeIssuerMember`).
- **Ulazni podaci:** `userId`, `organizationId`.
- **Rezultat:** atomarno briše sve `user_roles` redove (admin + staff) za tu organizaciju i sve `template_assignees` zapise tog korisnika.
- **Ograničenja:** zabranjeno samoukidanje; zabranjeno uklanjanje poslednjeg admina.
- **Povezani entiteti:** `user_roles`, `template_assignees`.
- **Status:** ✅

---

## 6. Institucija — nosioci (earners)

### 6.1 Listanje nosilaca institucije
- **Uloga:** `issuer_admin`, `issuer_staff`.
- **Rezultat:** lista nosilaca povezanih sa institucijom (`earner_institutions`).
- **Status:** ✅

### 6.2 Pretraga nosilaca
- **Uloga:** `issuer_admin`, `issuer_staff`.
- **Ulazni podaci:** slobodan tekst (samo ime).
- **Status:** ✅

### 6.3 Dodavanje postojećeg nosioca instituciji
- **Uloga:** `platform_admin` ili `issuer_admin` (`assignEarnerInstitution`).
- **Ulazni podaci:** `earnerId`, `organizationId`.
- **Rezultat:** red u `earner_institutions`.
- **Ograničenja:** duplikati se ignorišu.
- **Status:** ✅

### 6.4 Uklanjanje nosioca iz institucije
- **Uloga:** `platform_admin` ili `issuer_admin` (`removeEarnerInstitution`).
- **Rezultat:** brisanje veze u `earner_institutions`.
- **Status:** ✅

### 6.5 Kreiranje novog nosioca pri instituciji
- **Uloga:** `issuer_admin` (`orgCreateEarner`).
- **Ulazni podaci:** e-adresa, ime, mode `password`/`invite`.
- **Rezultat:** novi nalog sa `earner` rolom, dodat u `earner_institutions`.
- **Status:** ✅

### 6.6 Bulk kreiranje nosilaca
- **Uloga:** `issuer_admin` (`orgBulkCreateEarners`).
- **Status:** ✅

---

## 7. Šabloni mikrokredencijala

### 7.1 Listanje šablona institucije
- **Uloga:** `issuer_admin`, `issuer_staff`.
- **Rezultat:** šabloni institucije sa statusima `draft` / `active` / `archived`.
- **Status:** ✅

### 7.2 Kreiranje šablona
- **Uloga:** `issuer_admin` (po pravilima institucije i `issuer_staff` sa pravom).
- **Ulazni podaci:** naslov, opis, ishodi, veštine, ECTS, nivo, izvor učenja, kategorija (formalno/neformalno), ocenjivanje, QA tip i dokument, supervizija, stackability, način učešća, datum isteka.
- **Rezultat:** nov red u `templates` (status `draft`), inicijalna `template_versions` v1.
- **Status:** ✅

### 7.3 Izmena šablona (draft)
- **Uloga:** `issuer_admin`.
- **Statusi pre/posle:** `draft` → `draft`.
- **Status:** ✅

### 7.4 Objavljivanje šablona
- **Uloga:** `issuer_admin`.
- **Preduslovi:** popunjena obavezna polja.
- **Rezultat:** `templates.status = active`, kreira se konačna `template_versions`, blockchain anchoring se po opciji stavlja u red.
- **Statusi pre/posle:** `draft` → `active`.
- **Status:** ✅

### 7.5 Verzionisanje šablona
- **Uloga:** `issuer_admin`.
- **Rezultat:** nova verzija u `template_versions` (nov hash sadržaja); prethodno izdati kredencijali pokazuju verziju u kojoj su izdati.
- **Status:** 🟡 (verzionisanje radi, UI tok za eksplicitno objavljivanje sledeće verzije bira se po šablonu).

### 7.6 Arhiviranje šablona
- **Uloga:** `issuer_admin`.
- **Statusi pre/posle:** `active` → `archived` (više nije dostupno za nove aplikacije).
- **Status:** ✅

### 7.7 Dodela staff-a šablonu
- **Uloga:** `issuer_admin`.
- **Ulazni podaci:** `templateId`, `userId` (mora biti `issuer_staff`/`issuer_admin` u istoj instituciji).
- **Rezultat:** red u `template_assignees`. Samo dodeljeni članovi vide šablon u svom radnom prostoru i mogu izdavati.
- **Povezani entiteti:** `template_assignees`.
- **Status:** ✅

### 7.8 Anchoring šablona na Bloxberg
- **Uloga:** sistem (worker) na zahtev `issuer_admin`-a.
- **Statusi:** `not_requested` → `queued` → `submitting` → `submitted` → `confirmed`/`failed`/`cancelled`.
- **Ograničenja:** dostupnost Bloxberg-a ne utiče na to da li je šablon objavljen.
- **Povezani entiteti:** `template_anchor_jobs`, `template_blockchain_records`, `chain_anchor_jobs`.
- **Status:** ✅

### 7.9 Javni pregled šablona
- **Uloga:** javni korisnik.
- **Rezultat:** prikaz objavljenih šablona sa anchor statusom.
- **Status:** ✅

---

## 8. Aplikacije i zahtevi za izdavanje

### 8.1 Aplikacija nosioca na šablon
- **Uloga:** `earner`.
- **Preduslovi:** šablon `active`; nosilac mora biti povezan sa institucijom ako šablon to zahteva.
- **Ulazni podaci:** osnovna potvrda + opciono propratni tekst.
- **Rezultat:** nov red u `applications` (`status = submitted`), `application_timeline` događaj.
- **Statusi pre/posle:** — → `submitted`.
- **Povezani entiteti:** `applications`, `application_timeline`.
- **Status:** ✅

### 8.2 Pregled zahteva (issuer)
- **Uloga:** `issuer_admin`, `issuer_staff` (samo dodeljeni šabloni za staff).
- **Rezultat:** lista zahteva sa filterima po nosiocu, šablonu i statusu.
- **Status:** ✅

### 8.3 Komentari na zahtev
- **Uloga:** `issuer_admin`, `issuer_staff`, `earner` (na svojim zahtevima).
- **Rezultat:** nov red u `application_comments` + timeline događaj.
- **Status:** ✅

### 8.4 Napredovanje zahteva kroz lifecycle
- **Uloga:** `issuer_admin`, `issuer_staff` (dodeljeni).
- **Statusi pre/posle:** `submitted` → `in_review` → `evidence_collected` → `verified_by_provider` → `issued`.
- **Rezultat:** ažurira se `applications.status` + timeline.
- **Ograničenja:** ne može se preskočiti korak unazad; završni korak izdaje kredencijal.
- **Status:** ✅

### 8.5 Odbijanje zahteva
- **Uloga:** `issuer_admin`, `issuer_staff` (dodeljeni).
- **Ulazni podaci:** razlog odbijanja.
- **Statusi pre/posle:** bilo koji aktivan → `rejected`.
- **Rezultat:** notifikacija nosiocu.
- **Status:** ✅

### 8.6 Izdavanje i potpisivanje kredencijala iz zahteva
- **Uloga:** `issuer_admin`, `issuer_staff` (dodeljeni).
- **Preduslovi:** zahtev u `verified_by_provider`.
- **Ulazni podaci:** ocena (opciono), datum isteka (opciono; default iz šablona).
- **Rezultat:** kreira se `credentials` red (lifecycle `pending_earner_acceptance`), VC payload se generiše i hashira, opcioni anchor job se postavlja, nosilac dobija notifikaciju.
- **Statusi pre/posle:** `verified_by_provider` → `issued` (na strani zahteva); kredencijal `draft` → `pending_earner_acceptance`.
- **Povezani entiteti:** `applications`, `credentials`, `credential_secrets`, `credential_anchor_jobs`.
- **Status:** ✅

---

## 9. Izdavanje kredencijala (manuelno)

### 9.1 Pojedinačno izdavanje
- **Uloga:** `issuer_admin`, `issuer_staff` (samo dodeljeni šabloni).
- **Preduslovi:** šablon `active`; postoji nosilac.
- **Ulazni podaci:** šablon, nosilac, opciono ocena/datum isteka/evidencija.
- **Rezultat:** novi kredencijal u `credentials`, notifikacija nosiocu, opcioni anchor.
- **Statusi pre/posle:** — → `pending_earner_acceptance`.
- **Povezani entiteti:** `credentials`, `credential_secrets`, `credential_anchor_jobs`.
- **Status:** ✅

### 9.2 Bulk izdavanje
- **Uloga:** `issuer_admin`, `issuer_staff` (dodeljeni).
- **Ulazni podaci:** lista nosilaca + zajednički šablon.
- **Rezultat:** redom se izdaju kredencijali; izveštaj o uspesima i greškama.
- **Status:** ✅

### 9.3 Anchoring kredencijala
- **Uloga:** sistem (`chain/worker.server.ts`).
- **Statusi:** `not_requested` → `queued` → `submitting` → `submitted` → `confirmed` / `failed` / `cancelled`.
- **Ograničenja:** kredencijal je validan internim potpisom čim je izdat, bez obzira na status anchora.
- **Povezani entiteti:** `credential_anchor_jobs`, `credential_blockchain_records`, `chain_anchor_jobs`.
- **Status:** ✅

### 9.4 Anchoring queue (pregled)
- **Uloga:** `issuer_admin`.
- **Rezultat:** uvid u sve anchor poslove sa retry opcijama.
- **Status:** ✅

---

## 10. Životni ciklus kredencijala

### 10.1 Prihvatanje kredencijala (nosilac)
- **Uloga:** `earner`.
- **Statusi pre/posle:** `pending_earner_acceptance` → `issued`.
- **Rezultat:** kredencijal postaje javno verifikovan (ako je sharing public).
- **Status:** ✅

### 10.2 Odbijanje kredencijala (nosilac)
- **Uloga:** `earner`.
- **Statusi pre/posle:** `pending_earner_acceptance` → `rejected`.
- **Rezultat:** notifikacija izdavaču sa opcionim razlogom.
- **Status:** ✅

### 10.3 Pregled kredencijala (issuer)
- **Uloga:** `issuer_admin`, `issuer_staff`.
- **Rezultat:** lista svih kredencijala institucije sa filterima.
- **Status:** ✅

### 10.4 Revokacija kredencijala
- **Uloga:** `issuer_admin`.
- **Ulazni podaci:** razlog revokacije.
- **Statusi pre/posle:** `issued` → `revoked`.
- **Rezultat:** ažurira se `credentials.lifecycle`, anchor status na lancu, notifikacija nosiocu.
- **Povezani entiteti:** `credentials`, `chain_anchor_jobs`.
- **Status:** ✅

### 10.5 Istek kredencijala i podsetnici
- **Uloga:** sistem (cron `api/public/hooks/expiry-reminders`).
- **Rezultat:** kredencijali sa proteklim `expiresAt` se obeležavaju kao `expired`; nosioci i izdavači primaju podsetnike pre isteka.
- **Statusi pre/posle:** `issued` → `expired`.
- **Povezani entiteti:** `credentials`, `notifications`.
- **Status:** ✅

### 10.6 Generisanje evidence paketa (download)
- **Uloga:** `earner` (svoji), `issuer_admin`/`issuer_staff` (institucijski).
- **Rezultat:** paket sa VC JSON-om, dokumentima, dokazom o anchoru.
- **Povezani entiteti:** `evidence/package.functions.ts`, `credentials`.
- **Status:** ✅

---

## 11. Iskustvo nosioca (earner)

### 11.1 Dashboard nosioca
- **Uloga:** `earner`.
- **Status:** ✅

### 11.2 Lista i detalji kredencijala
- **Uloga:** `earner`.
- **Rezultat:** uvid u sopstvene kredencijale i sharing podešavanja.
- **Status:** ✅

### 11.3 Sharing podešavanja kredencijala
- **Uloga:** `earner`.
- **Ulazni podaci:** isPublic + per-field vidljivost (ocena, izvor, istek, veštine, nivo, preduslovi, supervizija, integracija).
- **Rezultat:** ažurira se `credentials.sharing` i `shareToken`.
- **Status:** ✅

### 11.4 Apliciranje na šablon
- Vidi 8.1.

### 11.5 Lista aplikacija
- **Uloga:** `earner`.
- **Status:** ✅

### 11.6 Profil nosioca (privatni i javni)
- **Uloga:** `earner` (uređivanje); javni korisnik (pristup preko `shareToken`).
- **Rezultat:** ažuriran `profiles.about`; javni link kroz `/profile/$token`.
- **Status:** ✅

### 11.7 Podešavanja jezika i lozinke
- **Uloga:** svi korisnici (`updateMyLanguage`, ChangePasswordForm).
- **Status:** ✅

### 11.8 Notifikacije nosioca
- **Uloga:** `earner`.
- **Status:** ✅

---

## 12. Javne stranice i verifikacija

### 12.1 Katalog institucija
- **Uloga:** javni korisnik.
- **Rezultat:** lista institucija sa filterima po državi i tipu.
- **Status:** ✅

### 12.2 Javni profil institucije
- **Uloga:** javni korisnik.
- **Rezultat:** podaci o instituciji, akreditacije, javni šabloni.
- **Status:** ✅

### 12.3 Verifikacija kredencijala
- **Uloga:** javni korisnik (`/verify/$id`, `public-credential.functions.ts`).
- **Ulazni podaci:** ID kredencijala (i opciono `shareToken`).
- **Rezultat:** statusi: interna validnost, blockchain anchor (sa linkom na Bloxberg explorer), trenutni lifecycle.
- **Ograničenja:** vidljiva polja se određuju po `sharing` podešavanjima nosioca.
- **Povezani entiteti:** `credentials`, `credential_blockchain_records`.
- **Status:** ✅

### 12.4 Javni profil nosioca (token link)
- **Uloga:** javni korisnik.
- **Preduslovi:** validan `shareToken`.
- **Status:** ✅

---

## 13. Notifikacije

### 13.1 Generisanje sistemskih notifikacija
- **Uloga:** sistem.
- **Okidači:** registracija (odobrenje/odbijanje), aplikacija (status, komentar), izdavanje, prihvatanje/odbijanje kredencijala, revokacija, podsetnik na istek, promene rola.
- **Rezultat:** redovi u `notifications` (po korisniku/roli, sa `titleKey`/`bodyKey` za lokalizaciju).
- **Status:** ✅

### 13.2 Pregled notifikacija
- **Uloga:** svi prijavljeni korisnici.
- **Rezultat:** lista sa stanjem `read`/`unread`.
- **Status:** ✅

---

## 14. Sistemski / cron procesi

### 14.1 Anchor worker
- **Uloga:** sistem (`chain/worker.server.ts`).
- **Rezultat:** uzima `chain_anchor_jobs` u redu, šalje transakcije na Bloxberg, ažurira statuse na šablonima i kredencijalima.
- **Izuzeci:** retry sa eksponencijalnim povlačenjem na `failed`; ručno otkazivanje moguće (`cancelled`).
- **Status:** ✅

### 14.2 Podsetnici na istek
- **Uloga:** sistem (`api/public/hooks/expiry-reminders`).
- **Rezultat:** šalje notifikacije pre i nakon isteka; postavlja `expired` status.
- **Bezbednost:** ruta je javna ali zahteva potpis/secret.
- **Status:** ✅

### 14.3 Audit logging
- **Uloga:** sistem.
- **Rezultat:** upis u `audit_log` i `platform_events` pri svakoj poslovnoj akciji od značaja.
- **Status:** ✅

---

## Pregled statusa implementacije

| Modul | Status |
|---|---|
| Autentikacija i nalozi | ✅ |
| Registracija institucija | ✅ |
| Platformska administracija | ✅ / 🟡 (sistemska podešavanja i napredna org operacije) |
| Institucija — dashboard i podešavanja | ✅ / 🟡 |
| Institucija — članovi | ✅ |
| Institucija — nosioci | ✅ |
| Šabloni mikrokredencijala | ✅ |
| Aplikacije i zahtevi | ✅ |
| Izdavanje kredencijala | ✅ |
| Životni ciklus kredencijala | ✅ |
| Iskustvo nosioca | ✅ |
| Javne stranice i verifikacija | ✅ |
| Notifikacije | ✅ |
| Sistemski / cron procesi | ✅ |

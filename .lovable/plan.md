# Dokument poslovnih pravila — `docs/business-rules.md`

Cilj: jedan Markdown fajl koji za svaku funkciju platforme opisuje poslovna pravila po traženom šablonu (10 stavki), na srpskom jeziku.

## Lokacija i format
- Fajl: `docs/business-rules.md` (kreira se nov direktorijum `docs/` u rootu repozitorijuma).
- Jezik: srpski (latinica), isti stil kao postojeći planovi u `.lovable/`.
- Struktura: kratak uvod (uloge, entiteti, legenda statusa implementacije) + sekcije po modulima, a unutar svake sekcije po jedna pod-sekcija za svaku funkciju.

## Šablon po funkciji
Svaka funkcija će biti opisana tabelom/spiskom sa tačno ovim poljima:
1. Naziv funkcije
2. Korisnička uloga koja je izvršava (`platform_admin`, `issuer_admin`, `issuer_staff`, `earner`, javni/anoniman korisnik, sistem/cron)
3. Preduslovi (autentikacija, role, stanje entiteta, postojanje povezanih objekata)
4. Ulazni/izmenjeni podaci (polja forme ili payload server funkcije)
5. Rezultat funkcije (šta se kreira/menja, povratna vrednost, notifikacije)
6. Statusi pre i posle izvršenja (vrednosti iz `status-labels`/`credentials`/`applications`/`registration_requests`/anchor jobs)
7. Ograničenja (RLS, validacije, jedinstvenost, limiti, biznis pravila tipa "poslednji admin")
8. Izuzeci i alternativni tokovi (greške, fallback putanje, odbijanja, retry)
9. Povezani entiteti (tabele iz baze i ključne veze)
10. Status implementacije: ✅ implementirano / 🟡 delimično / ⏳ planirano

## Moduli i pokrivene funkcije

Spisak nastao iz mapiranja ruta (`src/routes/*`), server funkcija (`src/lib/*.functions.ts`, `src/lib/chain/*`, `src/lib/evidence/*`) i tabela u bazi.

### 1. Autentikacija i nalozi
- Prijava (email+lozinka, Google OAuth) — `/login`
- Postavljanje lozinke nakon invite/reset — `/set-password`
- Zaboravljena lozinka / reset
- Promena lozinke (`ChangePasswordForm`)
- Odjava
- Inicijalno popunjavanje profila (trigger → `profiles`, default role)

### 2. Registracija institucija
- Podnošenje zahteva za registraciju institucije — `registration_requests`
- Pregled zahteva (platform admin) — `/admin/registrations`
- Odobravanje / odbijanje zahteva (kreira `organizations` + `issuer_admin`)

### 3. Platform administracija
- Pregled i pretraga korisnika — `/admin/users` (`admin-users.functions.ts`)
- Dodela/oduzimanje platformskih i institucionalnih rola
- Upravljanje organizacijama — `/admin/organizations`
- Konfiguracija role definicija — `/admin/roles`
- Sistemska podešavanja — `/admin/settings`
- Audit log — `/admin/audit`
- Aktivnost platforme — `/admin/activity`
- Bulk upload korisnika (`BulkUsersUpload`)

### 4. Issuer — institucija
- Pregled (dashboard) — `/issuer`
- Profil institucije — `/issuer/profile`
- Podešavanja institucije — `/issuer/settings`

### 5. Issuer — staff i članstvo (relevantno za nedavne izmene)
- Listanje članova (admin + staff) — `listIssuerStaff`
- Dodavanje postojećeg korisnika kao staff — `addIssuerStaff` (mode `existing`)
- Kreiranje novog naloga sa lozinkom — `addIssuerStaff` (mode `password`)
- Invite korisnika emailom — `addIssuerStaff` (mode `invite`)
- Bulk dodavanje staff-a — `bulkAddIssuerStaff`
- Dodela/oduzimanje admin role — `setIssuerAdminRole` (sa zaštitom poslednjeg admina i samoukidanja)
- Dodela/oduzimanje staff role — `setIssuerStaffRole` (sa zaštitom poslednje role)
- Uklanjanje člana iz institucije — `removeIssuerMember` (atomarno)
- Pretraga staff-a po imenu/emailu/roli

### 6. Issuer — earners
- Listanje povezanih nosilaca — `/issuer/earners`
- Pretraga po imenu
- Veza `earner_institutions`

### 7. Šabloni mikrokredencijala
- Listanje — `/issuer/microcredential-templates`
- Kreiranje — `/issuer/microcredential-templates/new`
- Izmena / verzionisanje — `template_versions`
- Dodela staff-a šablonu — `template_assignees`
- Anchoring šablona na blockchain — `template_anchor_jobs`, `template_blockchain_records`
- Javni pregled šablona — `/issuers/$id/microcredential-templates/$templateId`

### 8. Apliciranje i zahtevi za izdavanje
- Earner aplikacija na šablon — `/earner/apply` → `applications`
- Komentari i timeline aplikacije — `application_comments`, `application_timeline`
- Issuer pregled zahteva — `/issuer/requests`
- Napredovanje kroz lifecycle (status pre/posle)
- Odbijanje zahteva
- Izdavanje i potpisivanje kredencijala (finalni korak)

### 9. Izdavanje kredencijala
- Pojedinačno izdavanje — `/issuer/issue`
- Bulk izdavanje — `/issuer/issue/bulk`
- Kreiranje VC i tajni — `credentials`, `credential_secrets`
- Anchoring kredencijala — `credential_anchor_jobs`, `credential_blockchain_records`, `chain_anchor_jobs`
- Anchoring queue prikaz — `/issuer/anchoring-queue`

### 10. Životni ciklus kredencijala
- Pregled kredencijala (issuer) — `/issuer/credentials`
- Revokacija — `/issuer/revocations`
- Istek i reminderi — cron `api/public/hooks/expiry-reminders`
- Evidence paket — `evidence/package.functions.ts`

### 11. Earner iskustvo
- Dashboard — `/earner`
- Lista kredencijala — `/earner/credentials`
- Detalj kredencijala — `/earner/credentials/$id`
- Prihvatanje izdatog kredencijala
- Aplikacije — `/earner/applications`
- Profil i javni profil tokenom — `/earner/profile`, `/profile/$token`
- Podešavanja — `/earner/settings`
- Notifikacije — `/earner/notifications`

### 12. Javne stranice i verifikacija
- Lista institucija — `/issuers`
- Profil institucije — `/issuers/$id`
- Verifikacija kredencijala — `/verify/$id` (`public-credential.functions.ts`)
- Blockchain provera (`CredentialBlockchainVerificationCard`)

### 13. Notifikacije
- Generisanje notifikacija (sistem) — `notifications`
- Pregled notifikacija (issuer/earner)

### 14. Sistemski/cron procesi
- Expiry reminders webhook
- Anchor worker (`chain/worker.server.ts`)
- Audit logging (`audit_log`, `platform_events`)

## Šta NIJE u opsegu
- Tehnički API ugovori (tipovi, šeme) — dokument je poslovan, ne developerski.
- Detalji RLS politika red-po-red — pominje se samo gde je biznis-relevantno (npr. "samo admin org-a").
- UI copy i prevodi.

## Tehnički detalji izvora
Za svaku funkciju izvor istine biće:
- Server funkcije: `src/lib/*.functions.ts`, `src/lib/chain/anchor.functions.ts`, `src/lib/evidence/package.functions.ts`, `src/lib/public-credential.functions.ts`.
- Rute i tokovi: `src/routes/*`.
- Statusi: `src/lib/status-labels.ts`, `src/lib/types.ts`.
- Entiteti i ograničenja: tabele iz baze (`applications`, `credentials`, `user_roles`, `organizations`, `template_*`, `*_anchor_jobs`, `notifications`, `registration_requests`, itd.).
- Status implementacije: ako u kodu postoji handler + UI → ✅; ako postoji deo (npr. samo UI bez backend handlera ili obrnuto) → 🟡; ako se pominje u planovima/i18n a nema implementacije → ⏳.

Procenjena dužina dokumenta: ~1500–2500 linija, jedan fajl `docs/business-rules.md`.


# Plan: Završetak earner i18n + dropdown za jezik u header-u

## 1. Dropdown za promenu jezika u header-u

Pored ikonice za obaveštenja u `AppSidebarLayout` dodajem kompaktan dropdown (`Globe` ikonica + kratak indikator EN/SR) sa dve opcije: English / Srpski.

- Prikazuje se samo kada je korisnik earner (issuer i admin za sada nisu u obuhvatu).
- On-change: poziva `updateMyLanguage` server fn i `setAppLanguage`, pokazuje toast.
- Inicijalna vrednost: trenutni `i18n.language`.

## 2. Terminologija na srpskom

Ispravka u svim postojećim i novim srpskim prevodima: **mikrokredencijal** (jedna reč, bez crtice), padeži:
- mikrokredencijal / mikrokredencijala / mikrokredencijale / mikrokredencijalima
- "micro-credentials" → "mikrokredencijali"
- "Micro-credential templates" → "Šabloni mikrokredencijala"

Ažuriram postojeće `sr/common.json`, `sr/earner.json`, `sr/tour.json`, `sr/manual.json` gde se pojavljuje "mikro-kredencijal".

## 3. Prevod preostalih earner ruta

Redosled (svaka ruta dobija novi namespace ključ u `earner.json` na oba jezika):

1. **`earner.credentials.index.tsx`** — naslovi, filteri, kolone tabele, prazna stanja, dugmad.
2. **`earner.credentials.$id.tsx`** — naslovi sekcija (Details, Evidence, Blockchain proof, Sharing/privacy), dugmad (Accept/Reject, Copy link, Download), labele za sve toggle-ove privatnosti.
3. **`earner.applications.tsx`** — naslov, filteri, status labele (kroz `common.credentialStatus` + nove `applicationStatus`), prazna stanja, akcije ("Edit & resend", "Accept rejection").
4. **`earner.apply.tsx`** — naslov, filteri (po izdavaocu / oblasti / nivou), kartice šablona, dugme "Apply".
5. **`earner.profile.tsx`** — naslov, sekcije, dugmad za deljenje.
6. **`earner.notifications.tsx`** — naslov, "Mark all as read", prazno stanje.
7. **`earner.microcredential-templates.$id.tsx`** — naslovi sekcija (Description, Outcomes, Skills, Prerequisites, Quality assurance), dugme za prijavu.

Za svaku rutu:
- `useTranslation("earner")` u komponenti.
- Sve hardcoded UI tekstove zameniti `t(...)` pozivima.
- Dinamički sadržaj iz baze (naslovi šablona, imena izdavaoca, opisi) ostaje na originalnom jeziku — ne prevodi se.

## 4. Status labele

Refaktorisati `src/lib/status-labels.ts` i `src/lib/evidence/labels.ts`:
- Dodati helper `useCredentialLifecycleLabel()` i `useBlockchainLabel()` koji koriste `i18n.t`.
- Postojeće `CREDENTIAL_LIFECYCLE_LABEL` itd. mape ostaju (za server kontekst / fallback), ali komponente koje ih trenutno koriste u earner ruti prelaze na hook.
- `StatusBadge` komponenta — prepraviti da pokušava prevod preko `i18n.t("credentialStatus.<key>", { ns: "common" })` sa fallback-om na original string (tako issuer/admin koji prosleđuje drugi enum ne pukne).

## 5. Tehnički detalji

- Novi UI elementi (dropdown za jezik) koriste postojeću `DropdownMenu` shadcn komponentu i `Globe` ikonicu iz `lucide-react`.
- Dropdown u header-u i Select u `earner/settings` slušaju isti i18n state — promena na jednom mestu odmah se odražava na drugom.
- Default vrednost ostaje `en`; svi novi korisnici dobijaju engleski.

## Van obuhvata (i dalje)

- Issuer i admin rute, njihovi tour-i i manual.
- Public stranice (login, verify, profile/$token, issuers/*).
- Email notifikacije i sadržaj iz baze.
- SEO meta tagovi, Zod validacione poruke.

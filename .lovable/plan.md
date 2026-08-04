# Lokalizacija dela za administratora platforme (EN/SR)

Cilj: sve stranice sistemskog administratora prevesti na srpski, po istom obrascu koji je već korišćen za nosioca i izdavaoca — bez promene logike, samo tekst.

## Šta se prevodi

- Bočni meni administratora: Overview, Users, Organizations, Roles & Permissions, Registrations, Activity, Audit Trail, Settings
- `/admin` — naslovi, kartice sa brojevima, „Recent platform activity", „Audit trail (latest)"
- `/admin/users` — najveća stranica: tabela, filteri, pretraga, dijalozi za kreiranje/izmenu korisnika, dodela uloga, poruke (toast) i validacije
- `/admin/organizations` — lista, forma, statusi, akcije
- `/admin/registrations` — zahtevi za registraciju, odobravanje/odbijanje, poruke
- `/admin/roles` — uloge i dozvole
- `/admin/activity` — događaji, tipovi događaja, relativno/apsolutno vreme
- `/admin/audit` — revizorski trag, akcije i ciljevi
- `/admin/settings` — podešavanja, uključujući postojeći izbor jezika
- Naslovi stranica (head/meta) — trenutno još stoji „MicroCred", prelazi na CredSeal i lokalizovan naslov

## Terminologija (srpski)

- Platform administrator → administrator platforme
- Organization → institucija/organizacija (usklađeno sa postojećim prevodima)
- Registrations → zahtevi za registraciju
- Audit trail → revizorski trag
- Roles & Permissions → uloge i dozvole
- Micro-credential → mikrokredencijal

## Tehnički deo

- Novi prostor imena `admin` u i18n-u, podeljen po stranicama:
  `src/i18n/locales/{en,sr}/admin/{common,overview,users,organizations,registrations,roles,activity,audit,settings}.json`,
  spojen u jedan `admin` namespace u `src/i18n/index.ts` (isti obrazac kao `issuer`).
- Svaka admin ruta koristi `useTranslation("admin")`; zajednički statusi ostaju u `common.json`.
- Nazivi stavki menija u `AppSidebarLayout.tsx` prelaze na ključeve pod `common.sidebar.admin.*`.
- Datumi i vremena preko postojećih pomoćnih formata sa aktivnim jezikom, ne preko tvrdog `toLocaleString()`.
- Bez izmena u bazi, RLS-u ili poslovnoj logici.

## Redosled rada

1. Struktura prevoda + meni i `/admin` pregled
2. `/admin/users` (najobimnije, uključujući dijaloge i poruke)
3. `/admin/organizations`, `/admin/registrations`, `/admin/roles`
4. `/admin/activity`, `/admin/audit`, `/admin/settings` + naslovi stranica
5. Provera prebacivanjem jezika kroz prekidač u zaglavlju

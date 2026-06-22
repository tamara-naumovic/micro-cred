
# Plan: Višejezičnost (EN/SR) za earner deo

Ovaj plan uvodi internacionalizaciju samo za **earner** deo aplikacije, sa engleskim kao podrazumevanim jezikom i srpskim kao alternativom. Jezik se čuva na nivou korisničkog profila i sinhronizuje između uređaja. Vodiči (guided tours) i ručno uputstvo (manual) za earner-a se prevode na srpski.

## Obuhvat

**U obuhvatu (earner):**
- Sve `src/routes/earner.*.tsx` stranice
- Earner navigacija i sidebar grupe za earner ulogu
- `src/lib/tour/earnerTour.ts` (svi koraci tour-a)
- `src/routes/earner.manual.tsx` (kompletan sadržaj)
- Earner notifikacije UI tekstovi (ne i sadržaj iz baze)
- Zajedničke UI komponente koje earner koristi (StatusBadge labele, dugmad, dijalozi) — samo prikazni tekstovi
- Status/lifecycle labele iz `src/lib/status-labels.ts` i `src/lib/evidence/labels.ts` koje vidi earner

**Van obuhvata (za sada):**
- Issuer i admin rute, tour-i, manual
- Public rute (login, verify, profile/$token, issuers/*) — ostaju EN
- Email šabloni i server-side notifikacije (sadržaj iz baze, triggera)
- SEO meta tagovi (ostavljamo EN)
- Zod validacione poruke (ostaju EN)

## Korisničko iskustvo

1. Novi korisnik dobija engleski po defaultu.
2. U `src/routes/earner.settings.tsx` se dodaje sekcija "Language / Jezik" sa dva izbora: English / Srpski.
3. Promena se odmah primenjuje u UI-u i upisuje u `profiles.language` u bazi.
4. Pri sledećoj prijavi (i na drugim uređajima) jezik se učitava iz profila.
5. Ako je jezik srpski i korisnik prvi put otvori earner stranicu sa tour-om, tour se prikazuje na srpskom.
6. Manual (`/earner/manual`) prikazuje sadržaj na izabranom jeziku.

## Tehnički pristup

**Biblioteka:** `react-i18next` + `i18next` (laka integracija sa TanStack Start, ne zahteva SSR konfiguraciju jer earner rute idu kroz `_authenticated` layout sa `ssr: false`).

**Struktura prevoda:**
```
src/i18n/
  index.ts                 # i18next inicijalizacija
  LanguageProvider.tsx     # context provider + sync sa profilom
  locales/
    en/
      common.json          # zajedničke labele, dugmad, statusi
      earner.json          # earner rute (po sekcijama)
      tour.json            # tour koraci
      manual.json          # manual sadržaj
    sr/
      common.json
      earner.json
      tour.json
      manual.json
```

**Baza podataka:**
- Migracija: `ALTER TABLE public.profiles ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','sr'));`
- Postojeća RLS politika za update sopstvenog profila pokriva ovo polje.

**Provider:**
- `LanguageProvider` čita `language` iz `profiles` pri mountu (preko postojećeg auth context-a), poziva `i18n.changeLanguage(lang)`.
- Fallback redosled: profil → `localStorage` (za brz inicijalni prikaz pre nego što auth učita profil) → `'en'`.
- Provider se uključuje u `src/routes/__root.tsx`.

**Switcher:**
- U `src/routes/earner.settings.tsx`: Select sa dve opcije, on-change poziva server fn `updateLanguagePreference(lang)` koji upisuje u `profiles`, zatim `i18n.changeLanguage(lang)` i `localStorage.setItem`.

**Tour-ovi:**
- `earnerTour.ts` se refaktoriše da uzima `t` funkciju (ili da čita `i18n.t('tour:...')`) umesto hardcoded stringova.
- `startEarnerTour(...)` čita trenutni jezik iz `i18n.language` i bira odgovarajuće tekstove.

**Manual:**
- `earner.manual.tsx` koristi `useTranslation('manual')` za sve sekcije.

**Komponente:**
- Svaka earner ruta dobija `const { t } = useTranslation('earner')` i zamenjuje hardcoded tekstove sa `t('section.key')`.
- Zajedničke komponente (StatusBadge, dugmad u dijalozima) koriste `useTranslation('common')`.

## Plan rada (sekvencijalno)

1. **Infrastruktura** — instaliranje `i18next` + `react-i18next`, kreiranje `src/i18n/`, provider, migracija za `profiles.language`, server fn za update jezika.
2. **Switcher** — UI u `earner.settings.tsx`.
3. **Zajednički prevodi** — `common.json` (statusi, lifecycle, dugmad, "Cancel", "Save", "Loading", "Error" itd.) i refaktor `status-labels.ts` / `evidence/labels.ts`.
4. **Earner rute** — redom: `earner.index`, `earner.credentials.index`, `earner.credentials.$id`, `earner.applications`, `earner.apply`, `earner.profile`, `earner.settings`, `earner.notifications`, `earner.microcredential-templates.$id`.
5. **Tour** — `earnerTour.ts` na oba jezika.
6. **Manual** — `earner.manual.tsx` na oba jezika.
7. **Sidebar** — earner grupe i stavke u `AppSidebarLayout.tsx` (samo earner deo navigacije).

## Šta ostaje na engleskom (za sada)

- Issuer/admin UI i tour-ovi
- Public stranice
- Email i baza-pokretane notifikacije
- Validacione poruke i SEO meta

## Otvorena pitanja

Nijedno — sve glavne odluke su definisane iz korisničkih odgovora (samo earner, srpski tour, EN default, čuvanje na profilu).

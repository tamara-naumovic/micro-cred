## Cilj

Pojedinačna obaveštenja u sekciji `earner/notifications` (i `issuer/notifications`) trenutno se snimaju u bazu sa fiksnim engleskim tekstom (`title`, `body`). Zbog toga ostaju na engleskom čak i kada je interfejs prebačen na srpski. Plan je da se obaveštenja prevode na klijentu pomoću `react-i18next`, uz minimalnu izmenu šeme i bekfilom za postojeće zapise.

## Pristup

Umesto da pokušavamo da parsiramo engleski tekst, dodajemo strukturisana polja u tabelu `notifications`:

- `title_key text` — i18n ključ (npr. `notifications.events.credentialIssued.title`)
- `body_key text` — i18n ključ za telo
- `params jsonb` — parametri za interpolaciju (npr. `{ "title": "Web razvoj", "reason": "..." }`)

Postojeća polja `title` / `body` ostaju (kao fallback i za stara obaveštenja). Renderer u `NotificationsList` koristi `title_key`/`body_key` kada postoje, inače pada na `title`/`body`.

## Promene

### 1. Migracija baze
- `ALTER TABLE public.notifications ADD COLUMN title_key text, body_key text, params jsonb`.
- Ažurirati sve PL/pgSQL trigger funkcije koje upisuju u `notifications` da popunjavaju nove kolone (uz zadržavanje `title`/`body` radi kompatibilnosti):
  - `notify_on_application_insert` — „Nova prijava poslata"
  - `notify_on_credential_revoked` — „Mikrokredencijal je opozvan"
  - `notify_on_template_archived` — „Šablon mikrokredencijala je arhiviran"
  - `notify_on_earner_institution_link` — „Povezani ste sa institucijom"
  - `notify_on_template_assignee` — „Dodeljen vam je mikrokredencijal"
  - `notify_on_credential_insert` — dve varijante (awaiting acceptance / issued)
  - (i sve ostale postojeće okidače u ranijim migracijama koji upisuju u `notifications`)

### 2. TypeScript inserti
Ažurirati sve `from("notifications").insert(...)` pozive da prosleđuju i nove ključeve:
- `src/lib/chain/anchor.functions.ts` (5 mesta): prihvatanje/odbijanje od strane earnera, ponovno slanje, produženje isteka, prihvatanje odbijanja.
- `src/routes/api/public/hooks/expiry-reminders.ts`: podsetnik o isteku.

### 3. Klijent
- `src/lib/store.tsx`: `mapNotification` čita `title_key`, `body_key`, `params` (mapirano u `AppNotification`).
- `src/lib/types.ts`: proširiti `AppNotification` sa opcionim `titleKey`, `bodyKey`, `params`.
- `src/components/NotificationsList.tsx`: ako postoji `titleKey`, koristi `t(titleKey)` i `t(bodyKey, params)`, inače fallback na `n.title` / `n.body`. Datumi se interpoliraju kao već formatirani string u `params` (lokalizacija datuma u trenutku slanja je već problematična pa zadržavamo zapis stringa, ali ćemo na klijentu reformatirati kada je u `params` `expiresAt` ISO string).

### 4. Prevodi
U `src/i18n/locales/{en,sr}/earner.json` i `common.json` dodati grupu `notifications.events.*`. Konzistentno koristiti „mikrokredencijal" u srpskoj verziji.

Primer (SR):
```
"events": {
  "credentialIssued": {
    "title": "Mikrokredencijal je izdat",
    "body": "{{title}} je sada u vašem novčaniku."
  },
  "credentialAwaitingAcceptance": {
    "title": "Mikrokredencijal čeka vaše prihvatanje",
    "body": "{{title}} vam je izdat. Pregledajte i prihvatite ili odbijte."
  },
  "credentialRevoked": {
    "title": "Mikrokredencijal je opozvan",
    "body": "{{title}} je opozvan{{reasonSuffix}}"
  },
  "credentialExpiryExtended": {
    "title": "Produžen je rok važenja",
    "body": "Rok važenja za {{title}} je produžen do {{expiresAt}}."
  },
  "credentialExpiryReminder": {
    "title": "Mikrokredencijal uskoro ističe",
    "body": "„{{title}}" ističe {{expiresAt}}."
  },
  "templateArchived": {
    "title": "Šablon mikrokredencijala je arhiviran",
    "body": "Mikrokredencijal „{{title}}" je arhiviran od strane izdavaoca."
  },
  "linkedToInstitution": {
    "title": "Povezani ste sa novom institucijom",
    "body": "Povezani ste sa {{org}}."
  },
  "applicationSubmitted": {
    "title": "Nova prijava je poslata",
    "body": "Nova prijava za {{template}}."
  },
  "earnerAccepted": {
    "title": "Earner je prihvatio mikrokredencijal",
    "body": "{{title}} je prihvaćen."
  },
  "earnerRejected": {
    "title": "Earner je odbio mikrokredencijal",
    "body": "{{title}} je odbijen. Razlog: {{reason}}"
  },
  "rejectionAccepted": {
    "title": "Izdavalac je prihvatio odbijanje",
    "body": "Vaše odbijanje „{{title}}" je prihvaćeno. Mikrokredencijal je odbačen."
  },
  "credentialResent": {
    "title": "Mikrokredencijal je ponovo poslat",
    "body": "{{title}} je ažuriran i ponovo poslat. Pregledajte i prihvatite ili odbijte."
  },
  "assignedToTemplate": {
    "title": "Dodeljen vam je mikrokredencijal",
    "body": "Dodeljeni ste da izdate „{{template}}"."
  }
}
```
Engleski prevodi paralelno u `en/`.

### 5. Stara obaveštenja
Postojeća obaveštenja u bazi nemaju nove ključeve. NotificationsList renderuje njihov `title`/`body` kao i do sada (engleski). Novi zapisi (od trenutka primene migracije) biće prevedeni. Bez backfill skripte (rizično za stare neaktivne).

## Van obima
- Push notifikacije / email šabloni (samo in-app lista).
- Prevod „lifecycle" događaja u `platform_events`/`audit_log` (interni admin).

Posle implementacije ćemo proveriti vizuelno na `/earner/notifications` kako u SR, tako i u EN.
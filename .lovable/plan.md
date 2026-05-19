## Analiza polja za izdavanje MK (Direct Issuance)

EU standard nalaže 11 obaveznih + 5 opcionih elemenata na svakoj mikro-kredencijali. U trenutnom toku **issuer prvo bira Template** (koji nosi većinu metapodataka) i zatim **odabira primaoca**. Zato neka polja **dolaze iz Template-a**, a neka se moraju **uneti po izdavanju** (per-recipient).

### Mandatory elements — mapiranje

| # | EU element | Izvor | Status u aplikaciji |
|---|---|---|---|
| 1 | Identification of the learner | Per-issuance (odabir earnera) | ✅ već postoji (checkbox lista earnera) |
| 2 | Title of the micro-credential | Template (`title`) | ✅ |
| 3 | Country/Region of the issuer | Template (`country`, naslijeđuje od organizacije) | ✅ |
| 4 | Awarding body(ies) | Template (`issuerName` / `issuerId`) | ✅ |
| 5 | Date of issuing | Auto na izdavanju (`issuedAt = now()`) | ✅ automatski |
| 6 | Learning outcomes | Template (`outcomes[]`) | ✅ |
| 7 | Notional workload (ECTS) | Template (`ects`) | ✅ |
| 8 | Level (EQF/QF-EHEA) | Template (`level`) | ✅ |
| 9 | Type of assessment | Template (`assessment`) | ✅ |
| 10 | Form of participation | Template (`participation`) | ✅ |
| 11 | Quality assurance | Template (`qualityAssurance`) | ✅ |

➡️ **Svih 11 obaveznih** je pokriveno — 10 dolazi iz Template-a, 1 (learner) + datum se postavljaju na izdavanju. **Ne treba dodavati nova obavezna polja u Direct Issuance formu.**

### Optional elements — mapiranje

| # | EU element | Izvor | Status |
|---|---|---|---|
| 1 | Prerequisites | Template (`prerequisites`) | ✅ |
| 2 | Supervision & identity verification | Template (`supervision`) | ✅ |
| 3 | **Grade achieved** | **Per-issuance** (po studentu) | ✅ već postoji u formi |
| 4 | Stackability | Template (`stackability`) | ✅ |
| 5 | Further information | Template (`furtherInfo`) | ✅ postoji u tipu, opciono |

### Ono što fali u Direct Issuance formi (per-recipient)

Trenutna forma (`/issuer/issue`) nudi samo: **Template, Recipients (multi), Grade**. Da bi forma bila kompletno usklađena sa EU standardom (jer su pojedina polja vezana za konkretno izdavanje a ne za šablon), preporučujem da se doda:

1. **Issue date** — input (default = danas), trenutno se postavlja samo automatski na `now()`. Korisno ako issuer izdaje retroaktivno za završen kurs.
2. **Expiry date** — opciono, već postoji u `BulkRow` ali ne i u single-issue formi; treba dodati input.
3. **Grade** — već postoji ✅ (per-recipient bi bilo idealno, sad je shared za sve odabrane — videti pitanje).

### Otvoreno pitanje

Trenutno se u Direct Issuance jedan "Grade" primenjuje na **sve** označene primaoce. Po EU standardu grade je per-learner.

➡️ Predlog: kada se odabere više primaoca, prikazati tabelu sa kolonama **Recipient | Grade | Expiry** umesto jednog shared polja.

### Šta NE menjam

- Template forma (`/issuer/templates/new`) već pokriva sve mandatory metapodatke iz template-a; ne dodajem nova polja tamo.
- Ne diram bulk CSV (već ima `grade`, `expiryDate` per-row).
- Ne diram bazu — sva polja već postoje u `credentials` tabeli (`issued_at`, `expires_at`, `grade`).

### Rezime izmena (samo Direct Issuance forma)

1. Dodati **Issue date** input (default today).
2. Dodati **Expiry date** input (opciono).
3. Konvertovati listu primaoca u tabelu sa per-recipient **Grade** i **Expiry** kolonama (zamenjuje sadašnji shared "Grade" input).
4. Update-ovati `directIssue` u `store.tsx` da prima per-recipient overrides.

Reci da li ti odgovara, pa krećem u implementaciju.
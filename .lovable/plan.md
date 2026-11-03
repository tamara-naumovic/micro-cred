# Slobodan unos verzije kampanje

## Šta se menja
- U formi za kreiranje kampanje na /admin/evaluation padajuća lista se zamenjuje poljem za slobodan unos (npr. v2, jesen-2026).
- Ispod polja su prikazani predlozi postojećih verzija scenarija (trenutno v1), pa se mogu izabrati klikom.
- Ako za unetu oznaku ne postoje scenariji, ispod polja piše: „Za ovu verziju nema posebnih scenarija – koristiće se v1." Kreiranje kampanje ostaje dozvoljeno.
- Kod nosilaca i u izveštajima se i dalje koristi postojeće automatsko prebacivanje na v1, pa se scenariji E1–E11 prikazuju bez obzira na oznaku.

## Tehnički detalji
- `src/routes/admin.evaluation.tsx`: `Select` se menja u `Input` sa listom predloga, a uklanja se provera koja blokira kreiranje kada verzija nije na listi. Prazna vrednost i dalje nije dozvoljena; razmaci na početku i kraju se uklanjaju.
- EN/SR tekstovi za napomenu o v1 dodaju se u `evaluation.json` / `admin.json`.
- Postojeći testovi za fallback ostaju; dodaje se test da nepoznata oznaka učitava v1 scenarije.
- Ažurira se memorija „Evaluation scenario versions" (slobodan unos uz fallback).

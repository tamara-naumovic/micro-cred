# Pretraga staff-a i nosilaca (issuer admin)

Dodajemo polje za pretragu iznad tabela na stranicama Staff i Nosioci (issuer admin). Filtriranje je klijentsko — odmah dok korisnik kuca, bez dugmeta.

## Nosioci (`/issuer/earners`)
- Iznad tabele dodati `Input` sa ikonom pretrage i placeholder-om "Pretraga po imenu...".
- Filtrira `rows` po `u.name` (case-insensitive, `includes`).
- Reset paginacije na stranu 1 kada se promeni upit.
- Prazno stanje: ako pretraga ne vrati rezultate, prikazati posebnu poruku ("Nema rezultata za pretragu").

## Staff (`/issuer/staff`)
- Iznad tabele dodati `Input` sa istom UX-om i placeholder-om "Pretraga po imenu, e-adresi ili ulozi...".
- Filtrira po:
  - `r.displayName`
  - `r.email`
  - uloga: izvedeno iz `r.isAdmin` — meč ako upit odgovara lokalizovanim labelama "admin"/"Institution admin" ili "staff"/"Staff" (oba jezika; case-insensitive substring).
- Reset paginacije na stranu 1; isto prazno stanje za "nema rezultata".

## Lokalizacija
Dodati ključeve u oba jezika:
- `issuer/earners.json`: `search.placeholder`, `search.noResults`
- `issuer/staff.json`: `search.placeholder`, `search.noResults`, kao i interno mapiranje pojmova uloga koje koristi filter (jednostavni stringovi unutar komponente, ne moraju u JSON).

## Tehnički detalji
- Bez izmena na backendu, bez novih server funkcija, bez izmena šeme.
- `useState<string>("")` za upit; `useMemo` za filtrirani niz; `useEffect` koji vraća `page` na 1 kada se upit promeni.
- Ikona `Search` iz `lucide-react`.

## Van opsega
- Server-side pretraga, debounce, fuzzy matching.
- Filteri po datumu/statusu.
- Promene tabela koje već postoje (sortiranje, kolone).

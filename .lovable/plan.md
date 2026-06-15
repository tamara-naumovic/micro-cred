## Cilj
Sprečiti issuer admin/staff da preko Direct ili Bulk issuance izda kredencijal earner-u koji već ima isti kredencijal (template) u ne-revoked statusu.

## Stanje
- **Bulk** (`src/routes/issuer.issue.bulk.tsx`) već ima proveru — radi za i admina i staff-a (isti kod). OK, ne menja se.
- **Direct** (`src/routes/issuer.issue.index.tsx`) nema nikakvu proveru — dozvoljava ponovno izdavanje.

## Izmene — samo `src/routes/issuer.issue.index.tsx`

1. Dohvatiti `credentials` iz `useStore()`.
2. Izračunati `earnersWithActive: Set<string>` — earner ID-evi koji već imaju kredencijal za izabrani `templateId` sa statusom različitim od `revoked` (isti kriterijum kao u Bulk-u).
3. U `StaffPicker` listi recipient-a vizualno označiti takve earner-e (npr. badge "Already issued") i onemogućiti njihovu selekciju (disable u picker-u, ili filtrirati prikaz uz upozorenje). Postojeće selekcije koje postanu nevažeće (npr. nakon promene template-a) automatski očistiti.
4. U `submit()`:
   - Pre poziva server fn-a, filtrirati `recipients` izbacujući one koji su u `earnersWithActive`.
   - Ako su svi izabrani već imaju kredencijal → `toast.error("Svi izabrani earner-i već imaju ovaj kredencijal.")` i stop.
   - Ako su neki preskočeni → `toast.warning("X earner(s) skipped — already have this credential.")` i nastaviti sa ostalima.
5. Mali info-blok ispod recipient liste (analogan onom u Bulk-u) sa brojem skip-ovanih.

## Provera za admin u Bulk-u
Pregledom Bulk fajla potvrđeno: `earnersWithActive` provera radi nezavisno od role (admin ili staff). Nije potrebna nikakva izmena.

## Backend
Bez izmena. (Server fn `issueCredentialsBatch` se ne menja — ovo je UI guard. Po želji se može dodati i server-side guard u sledećoj iteraciji.)

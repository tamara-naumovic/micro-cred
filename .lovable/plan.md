## Problem

Trenutni fajl `src/routes/issuers.$id.microcredential-templates.$templateId.tsx` TanStack Router registruje kao **dete route-a `/issuers/$id`**. Pošto `issuers.$id.tsx` nema `<Outlet />`, dete-route se matchuje ali ništa ne prikazuje — otud "prazna stranica" kada se klikne kartica template-a.

Isti problem uzrokuje i flicker na `/issuers/$id`: parent sa decom se ponaša kao layout pa router pravi privremeni mismatch koji završi u 404.

## Fix

Iskoristiti TanStack-ovu konvenciju **trailing underscore on parent segment** da bi se child route "izvukao" iz parent layout-a — URL ostaje isti, ali ruta postaje samostalna (sibling, ne child).

1. **Preimenovati fajl** (`mv`):
   - iz: `src/routes/issuers.$id.microcredential-templates.$templateId.tsx`
   - u:  `src/routes/issuers.$id_.microcredential-templates.$templateId.tsx`

2. **Ažurirati `createFileRoute(...)`** u tom fajlu:
   - iz: `createFileRoute("/issuers/$id/microcredential-templates/$templateId")`
   - u:  `createFileRoute("/issuers/$id_/microcredential-templates/$templateId")`

   URL koji korisnik vidi i dalje je `/issuers/<id>/microcredential-templates/<templateId>` — underscore se ne pojavljuje u URL-u, samo razdvaja route nesting.

3. **`src/routes/issuers.$id.tsx`** — `<Link to=...>` u `TemplateSection` ažurirati na novi route path:
   - `to="/issuers/$id_/microcredential-templates/$templateId"` (params ostaju `{ id, templateId }`).

4. **`src/routeTree.gen.ts`** će biti automatski regenerisan; ne edituje se ručno.

## Out of scope

- Nema promena u logici prikaza template detalja, ni u `issuers.$id.tsx` izgledu.
- Ne diramo earner/issuer route-ove.

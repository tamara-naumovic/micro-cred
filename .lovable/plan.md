# Issuer admin: prikaz svih članova i izmena role

Cilj: na stranici Staff (`/issuer/staff`) institucionalni admin vidi sve članove organizacije nezavisno od kombinacije rola (samo admin, samo staff, ili admin+staff) i može da menja role direktno iz tabele.

## Backend (`src/lib/issuer-staff.functions.ts`)

1. **`listIssuerStaff`** — vratiti sve članove organizacije sa bilo kojom issuer rolom:
   - Učitati sve redove iz `user_roles` gde je `organization_id = orgId` i `role IN ('issuer_admin', 'issuer_staff')`.
   - Po `userId` agregirati `isAdmin` i nov `isStaff` flag; `createdAt` = najraniji `created_at` u toj organizaciji.
   - Tip `StaffMember` proširiti sa `isStaff: boolean`.

2. **Nova `setIssuerStaffRole({ userId, organizationId, makeStaff })`**:
   - `assertOrgAdmin` + admin uvek može da menja staff rolu drugima i sebi.
   - `makeStaff = true`: insert `issuer_staff` (ignorisati duplicate).
   - `makeStaff = false`: delete `issuer_staff` za (user, org); ako korisnik nakon brisanja više nema nijednu issuer rolu u toj organizaciji, obrisati i `template_assignees` za tog korisnika (poštujući postojeće ponašanje `removeIssuerStaff`).
   - Sprečiti uklanjanje poslednje preostale role: ako bi user ostao bez ijedne issuer role u toj organizaciji, baciti grešku "Korisnik mora imati bar jednu rolu. Uklonite ga umesto toga."

3. **`setIssuerAdminRole`** ostaje kao što je (sa zaštitom poslednjeg admina i zabranom samoukidanja admin role), ali dodati istu provjeru "korisnik mora imati bar jednu issuer rolu u organizaciji" kada se admin uklanja a user nema `issuer_staff`.

## Frontend (`src/routes/issuer.staff.tsx`)

1. **Tip `Row`** proširiti sa `isStaff: boolean`. Iz `listIssuerStaff` sada stižu i admin-only korisnici.

2. **Kolone tabele** — zameniti trenutni "Also admin" badge sa kolonom "Role" koja prikazuje badge(ove):
   - `Admin` (kad `isAdmin`)
   - `Staff` (kad `isStaff`)
   - oba ako oba.

3. **Akcije po redu** (zameniti postojeće dugme za admin toggle):
   - Toggle Staff (`ShieldUser`/checkbox ikona) — poziva `setIssuerStaffRole`.
   - Toggle Admin (`ShieldCheck`/`ShieldOff`) — postojeće, poziva `setIssuerAdminRole`.
   - Remove (`Trash2`) — kompletno uklanjanje iz organizacije: poziva i `setIssuerAdminRole({ makeAdmin: false })` (ako admin) i `removeIssuerStaff` (ako staff), redom; zadržava postojeće zaštite poslednjeg admina/samoukidanja na backendu. Alternativno: jedan novi server fn `removeIssuerMember` koji briše obe role u jednoj transakciji — preferirati ovo radi atomarnosti.

4. **Filter pretrage uloge** (`search.roleAdmin`/`roleStaff`) — radi i dalje preko trenutnih lokalizovanih termina; nije potrebna promena.

5. **Toasts** — dodati ključeve `staff.toasts.staffGranted`, `staff.toasts.staffRevoked`, `staff.toasts.failedStaffChange` u en/sr lokalizaciju; reupotrebiti postojeće `promoted`/`demoted` za admin akciju.

6. **i18n** — `staff.table.role` (kolona), `staff.table.badgeAdmin`, `staff.table.badgeStaff`, `staff.table.grantStaff`, `staff.table.revokeStaff` u en/sr.

## Bulk add — bez promene
`bulkAddIssuerStaff` i dalje dodaje samo `issuer_staff` (po imenu sekcije). Promovisanje u admina ide ručno po redu, što je već prirodan tok.

## Van opsega
- Promene RLS i šeme.
- Promena UI-ja za platform admin (`/admin/users`).
- Promene na earner stranici.

## Tehnički detalji
- Novi server fn `removeIssuerMember({ userId, organizationId })`: assert org admin, zabrana samoukidanja, zabrana uklanjanja poslednjeg admina; obriše sve `user_roles` redove gde su role u (`issuer_admin`,`issuer_staff`) za tu organizaciju i taj user; po brisanju očisti i `template_assignees`.
- `listIssuerStaff` SQL: `.from('user_roles').select('user_id, role, created_at').eq('organization_id', orgId).in('role', ['issuer_admin','issuer_staff'])` pa agregacija u JS-u.

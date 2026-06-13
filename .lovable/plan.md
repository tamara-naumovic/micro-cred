
## Cilj

Restruktuirati Issuer ulogu na dva nivoa unutar jedne institucije:

- **Issuer Admin** — upravlja institucijom, kreira/edituje Mikrokredencijale (MK), dodaje zaposlene, dodeljuje MK zaposlenima na upravljanje.
- **Issuer Staff (zaposleni)** — vidi samo MK koji su mu dodeljeni, izdaje ih earnerima (i pojedinačno i bulk), obrađuje prijave za te MK. Ne može da kreira nove MK niti da vidi tuđe.

Uz to: u celom Issuer UI-u zameniti termin "Template" sa "Micro-credential" (MK).

## Promene u bazi

1. Nova vrednost u `app_role` enum-u: `issuer_staff`.
2. Nova tabela `template_assignees` (junction):
   - `template_id` → templates, `user_id` → auth.users, `assigned_by`, `created_at`
   - UNIQUE (template_id, user_id)
   - GRANT za authenticated/service_role
   - RLS: SELECT za issuer_admin te institucije, dodeljenog korisnika i platform_admin; INSERT/DELETE samo issuer_admin te institucije ili platform_admin.
3. Security-definer helper `is_template_assignee(_user_id, _template_id)` da izbegne rekurziju u RLS.
4. Update RLS polisa (sve preko helper funkcija):
   - `applications` SELECT: dodati granu da issuer_staff vidi prijavu samo ako je `is_template_assignee(auth.uid(), template_id)`. UPDATE isto.
   - `credentials` SELECT: issuer_staff vidi svoje izdate + one za dodeljene MK. INSERT: dozvoljen issuer_admin-u institucije ILI issuer_staff-u koji je `is_template_assignee` za taj template.
5. `handle_new_user` ostaje (default earner). Promocija u issuer_staff ide kroz server fn (admin-only).

## Promene u kodu (tipovi i auth)

- `Role` ostaje `"earner" | "issuer" | "admin"`. Dodajemo `subRole?: "admin" | "staff"` na `MockUser`.
- `mapRole` u `src/lib/auth.tsx`: `issuer_admin → issuer (subRole admin)`, `issuer_staff → issuer (subRole staff)`.
- `bridgeToActiveUser` čita sve role i bira prioritet: platform_admin > issuer_admin > issuer_staff > earner.

## Server funkcije (`src/lib/issuer-staff.functions.ts`)

Sve sa `requireSupabaseAuth` + provera da je caller issuer_admin te institucije (preko `has_role_in_org`).

- `addIssuerStaff({ email, organizationId })` — nalazi korisnika po emailu u `profiles`, dodaje `issuer_staff` ulogu za instituciju (preko `supabaseAdmin` unutar handlera). Ako korisnik ne postoji, jasna greška.
- `removeIssuerStaff({ userId, organizationId })`
- `listIssuerStaff({ organizationId })`
- `assignTemplateUsers({ templateId, userIds })` — sinhronizuje `template_assignees`.
- `listTemplateAssignees({ templateId })`

## UI promene

### Sidebar (`AppSidebarLayout.tsx`)
Issuer navigacija postaje uslovna na `subRole`:

- **Admin**: Overview · Micro-credentials · Create Micro-credential · Staff (NOVO) · Issuance Requests · Direct Issuance · Bulk Issuance · Issued Credentials · Revocations · Public Profile · EBSI.
- **Staff**: Overview · My Micro-credentials · Issuance Requests · Direct Issuance · Bulk Issuance · Issued Credentials.

Group label "Templates" → "Micro-credentials".

### Rute

- `/issuer/templates` — naslov i tekstovi → "Micro-credentials". Lista:
  - admin: svi MK institucije.
  - staff: samo MK iz `template_assignees` za tog korisnika.
- `/issuer/templates/new` — pristup samo admin (RoleGuard + subRole check → redirect ako nije).
- `/issuer/templates/$id` — dodati sekciju **Assigned staff** (multiselect zaposlenih, samo admin može da menja; staff vidi read-only).
- Nova **`/issuer/staff`** (admin only) — tabela zaposlenih + "Add by email" forma + remove dugme.
- `/issuer/issue` i `/issuer/issue/bulk` — dropdown MK filtriran po assignment-u za staff; bulk ostaje dostupan i staff-u.
- `/issuer/requests` — admin: sve prijave institucije; staff: samo za dodeljene MK.
- `/issuer/credentials` — isti filter.
- `/issuer/` Overview — metrike po istoj logici.

### Termin "Template" → "Micro-credential"
Pretraga i zamena samo u UI stringovima:
- `src/routes/issuer.*.tsx` (naslovi, opisi, dugmad, toast poruke)
- sidebar labele
- `MetricCard` labele

Tipovi u `src/lib/types.ts` (`MicroCredentialTemplate`, `TemplateStatus`) i nazivi tabela ostaju — samo UI tekst se menja.

## Redosled implementacije

1. Migracija: enum vrednost `issuer_staff`, tabela `template_assignees` (GRANT + RLS + helper fn), update RLS na `applications`/`credentials`.
2. Update `src/lib/auth.tsx` (subRole + prioritet rola).
3. Nove server fn-e (staff CRUD + assignment).
4. Sidebar uslovno renderovanje + nova `/issuer/staff` ruta.
5. Update `/issuer/templates*` (filter po assignment-u, admin-only create, assignee sekcija).
6. Update `/issuer/requests`, `/issuer/credentials`, `/issuer/issue*` i Overview.
7. Globalna UI zamena "Template" → "Micro-credential" u issuer prikazima.

## Otvoreno

- Add staff radi samo za korisnike koji već imaju nalog (po email-u). Pravi tok pozivnica emailom ide kao zasebna iteracija ako bude trebao.

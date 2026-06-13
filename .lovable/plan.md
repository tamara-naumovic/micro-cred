## Cilj

Ukloniti samostalnu registraciju (Sign Up + Google) i prebaciti kreiranje korisnika na administratore. Studenti se vezuju za 0+ institucija preko nove tabele.

## Promene

### 1. Baza
- **Nova tabela `earner_institutions`** (m2m): `earner_id`, `organization_id`, `assigned_by`, `created_at`, UNIQUE(earner_id, organization_id).
  - GRANT za authenticated/service_role.
  - RLS: earner vidi svoje veze; issuer_admin vidi veze za svoju instituciju; issuer_staff vidi veze za svoju instituciju (read-only); platform_admin sve.
  - Pisanje: platform_admin (bilo koja), issuer_admin (samo za svoju instituciju).
- **`handle_new_user`** ostaje (Google ionako ide, OAuth invite-only kreira nalog kroz Supabase admin API i trigger pravi profile + earner role po defaultu — to ćemo override-ovati prema izabranoj ulozi pri kreiranju).
- Helper `is_earner_of_org(_user_id, _org_id)` (security definer) za RLS na drugim tabelama ako bude potrebno.

### 2. Server funkcije (`src/lib/admin-users.functions.ts`, novo)
Sve sa `requireSupabaseAuth` + provera uloge pozivaoca.

- `createUserWithPassword({ email, password, displayName, role, organizationId? })` — platform_admin može sve role; issuer_admin može samo `issuer_staff` u svojoj instituciji (već postoji `addIssuerStaff` — proširićemo da podržava i kreiranje novog naloga, ne samo postojećeg).
- `inviteUserByEmail({ email, displayName, role, organizationId? })` — koristi `supabaseAdmin.auth.admin.inviteUserByEmail` (Supabase šalje magic invite link).
- `createInstitution({ name, slug, domain, adminEmail, adminDisplayName, mode: "password"|"invite", adminPassword? })` — platform_admin only. Pravi `organizations` red + pravi/poziva korisnika sa rolom `issuer_admin` vezanom za novu org.
- `assignEarnerToInstitution({ earnerId, organizationId })` / `removeEarnerFromInstitution(...)` — platform_admin ili issuer_admin svoje institucije.
- `listEarners()` / `listEarnersForOrg(orgId)` za UI liste.

Posle kreiranja naloga, server fn upisuje pravu rolu u `user_roles` (i briše default `earner` ako je kreiran kao staff/admin), a za studente upisuje veze u `earner_institutions`.

### 3. UI

- **`/login`**: ukloniti Tabs (Sign in / Sign up), ukloniti "Continue with Google", ukloniti SignUpForm i napomenu "New accounts start as Earner". Ostaviti samo email/password sign-in + link "Forgot password?" (bez promena toka resetovanja).
- **Header/PublicLayout**: bez promena (već nema CTA-ova za registraciju).

#### Platform admin
- **`/admin/users`**: dugme "Add user" → dialog sa poljima: email, display name, role (earner / issuer_admin / issuer_staff / platform_admin), organization (ako role traži), mode: "Set password" (sa input poljem) ili "Send invite email". Lista filtere po roli.
- **`/admin/organizations`**: dugme "Add institution" → dialog: institution name, slug, domain, + sekcija "Institution admin" (email, ime, mode password/invite). Submit poziva `createInstitution`.
- **`/admin/users` (earner detail)** ili nova kolona: prikaz povezanih institucija + dugme "Manage institutions" → multi-select organizations, čuva u `earner_institutions`.

#### Issuer admin
- **`/issuer/staff`**: postojeći "Add staff by email" proširiti — dva moda: "Existing user (by email)" i "Create new account" (email + name + password ili invite). Backend bira granu.
- **Nova `/issuer/earners`** (admin only): lista studenata povezanih sa institucijom + "Add earner" (postojeći earner po emailu, ili kreiraj novi nalog/invite, automatski upisuje u `earner_institutions` sa org = sopstvena institucija).

### 4. Auth/Store
- `auth.tsx`: ukloniti `signUp` i `signInWithGoogle` iz konteksta (ili ostaviti `signUp` neeksportovan; čistije je obrisati).
- Store: dodati `earnerInstitutions` u state + realtime subscription, koristi se za "moji studenti" liste i prikaz veza.

### 5. Supabase config
- Pozvati `configure_auth` sa `disable_signup: true` (i `external_anonymous_users_enabled: false`), da i direktni API signup bude blokiran. `auto_confirm_email` ostaje isključen (invite tok već šalje confirm link); za "Set password" mod admin API kreira već potvrđenog korisnika.

## Tehnički detalji

- `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name } })` za "password" mod.
- `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { display_name }, redirectTo: <app origin>/reset-password })` za "invite" mod.
- Posle kreiranja, trigger `handle_new_user` upisuje profile + default `earner` role. Server fn potom: za ne-earner role izbriše tu default rolu i upiše pravu rolu (sa `organization_id` gde treba); za earner, ako je izabrana institucija, upiše red u `earner_institutions`.
- Autorizacija u server fn: `has_role(userId, 'platform_admin')` ili za issuer admin akcije `has_role_in_org(userId, 'issuer_admin', orgId)`.

## Otvorena pitanja koja preuzimam kao default
- Brisanje korisnika nije u opsegu ove iteracije (samo dodavanje + dodela institucija).
- Studentu prikazujemo listu institucija sa kojima je povezan u njegovom profilu (read-only); ne ulazi u ovaj milestone osim ako brzo dodam panel.
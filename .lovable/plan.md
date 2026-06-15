## 1. Remove "Verify" action from Issued credentials (issuer admin/staff)

In `src/routes/issuer.credentials.tsx` (lines ~161–165), drop the `<Link to="/verify/$id">Verify</Link>` branch from the actions cell. Replace with `null` (or nothing) so non-pending credentials show no actions in that column. The public `/verify/$id` route stays — only the in-table shortcut is removed.

## 2. Fix issuer public profile website link

In `src/routes/issuer.profile.tsx` (line 49), the `<a href={org.website}>` uses the raw value (e.g. `www.fon.bg.ac.rs`), which the browser resolves relative to `/issuer/...`. Mirror the logic already used in `src/routes/issuers.$id.tsx`:

```tsx
href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
target="_blank" rel="noreferrer"
```

Apply the same normalization anywhere else the website is rendered as a link.

## 3. Expand public issuer profile with full institution info + split credentials list

Page: `src/routes/issuers.$id.tsx` (the public profile at `/issuers/:id`).

Show every institution field collected at registration/creation, excluding issuer-admin (contact person) fields. From the `organizations` table that means: `name`, `country`, `about`, `website`, `accreditations[]`, `accreditation_document_url`, `registered_at`. Lay them out under the existing header card:

- Already shown: name, country, website, about, accreditations.
- Add: "Registered since {year}" line and an "Accreditation document" download link when `accreditation_document_url` is present (signed URL via existing storage helper if the bucket is private; otherwise a direct link).

Then split the existing "Micro-credentials this issuer can award" grid into two sections based on `template.source`:

- **Formal credentials** — templates where `source === "formal"`.
- **Non-formal credentials** — templates where `source === "non_formal"`.

Render each as its own `<h2>` + grid, hide a section when empty, keep the existing card markup per template.

The issuer-admin/staff-only `src/routes/issuer.profile.tsx` is not touched beyond the website fix in step 2.

## 4. Block issuance to issuer_staff / issuer_admin users

`src/routes/issuer.issue.index.tsx` already filters `users.filter(u => u.role === "earner")`, but a user with both `earner` and `issuer_staff`/`issuer_admin` roles in `user_roles` can still appear because the store collapses to a single role per user. Harden the picker so any user who also has an `issuer_admin` or `issuer_staff` role anywhere is excluded:

- Expose the full role set per user from the store (add a `userRoles: Record<userId, AppRole[]>` map sourced from `user_roles` rows).
- In `issuer.issue.index.tsx` and `issuer.issue.bulk.tsx`, filter `allEarners` to those whose role set does NOT include `issuer_admin` or `issuer_staff`.
- Apply the same filter when resolving emails in the bulk CSV path (`bulkIssue` in store / functions) — reject rows whose email belongs to a staff/admin user, surfacing it in the existing per-row error list.

## 5. Earner "About" in settings, shown on public profile

`profiles.about` already exists in the DB and is already rendered on the public earner profile (`src/routes/profile.$token.tsx` line 77). What's missing is an editor in `src/routes/earner.settings.tsx`.

- Add an "About" card above `ChangePasswordForm` with a `<Textarea>` (max ~1000 chars, optional) pre-filled from the current profile's `about`.
- Save via a new `updateMyProfile` server fn in `src/lib/admin-users.functions.ts` (or a new `src/lib/profile.functions.ts`) using `requireSupabaseAuth`, doing `supabase.from("profiles").update({ about }).eq("id", userId)`. RLS already permits self-updates.
- After save: toast + refresh the store.

## 6. Explanation of "Learner overview" (no code change)

The widget on `/issuer` (issuer admin + staff dashboard) summarizes the learners this issuer has credentialed. The metrics, from `src/routes/issuer.index.tsx` lines 1182–1216:

- **Unique learners** — distinct earners holding at least one active credential from this issuer (lifecycle `issued` or status `active`).
- **New this month** — distinct earners who received at least one credential since the 1st of the current month.
- **Avg / learner** — average number of active credentials per unique learner (rounded to 1 decimal).
- **Multi-credential** — learners holding more than one active credential from this issuer.
- **Awaiting acceptance** — credentials currently in `pending_earner_acceptance`.
- **Bar chart** — distribution of learners by credentials held: bucket "1", "2–3", "4+".

If the wording is unclear in the UI, the plan can optionally rename labels and add a tooltip per metric — confirm if you want that polish included.

## Technical notes

- All changes are frontend + one small server fn for profile About; no schema migrations needed (every field already exists).
- Store changes (step 4) require a new derived `userRoles` map fetched from `user_roles`; data is already loaded, only the shape changes.
- No edits to auto-generated files (`src/integrations/supabase/types.ts`, `client.ts`, etc.).

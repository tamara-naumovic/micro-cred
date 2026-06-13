## 1. Staff assignment when creating / editing a micro-credential

Today the assignment UI lives only on the template detail page (`issuer.templates.$id.tsx` → `AssigneesCard`). The create form (`issuer.templates.new.tsx`) has no staff picker, and there is no edit form at all — admins land on the read-only detail page after creating.

Changes:
- **Create form (`issuer.templates.new.tsx`)**: add an "Assign staff" checkbox list (same shape as `AssigneesCard`), filtered to `users` where `role === "issuer" && subRole === "staff" && organizationId === activeUser.organizationId`. On submit, after `upsertTemplate`, call `assignTemplateUsers(tpl.id, selectedIds)` before navigating.
- **Edit form**: create `src/routes/issuer.templates.$id.edit.tsx` (admin-only, mirrors the create form fields prefilled from the existing template) including the same staff picker prefilled from current assignees. "Save" calls `upsertTemplate` + `assignTemplateUsers`.
- **Detail page**: add an "Edit" button (admin-only) linking to the new edit route. Keep the existing `AssigneesCard` so quick reassignments still work from detail.

## 2. Earner can only see / apply to MCs from their linked institutions

`earner_institutions` already links earners ↔ orgs. Today `earner.apply.tsx` shows every `active` template.

Changes:
- In `earner.apply.tsx`, compute `myOrgIds = earnerInstitutions.filter(ei => ei.earnerId === activeUser.id).map(ei => ei.organizationId)` and filter `active` to `t => myOrgIds.includes(t.issuerId)`.
- Empty-state copy: "You are not linked to any institution yet. Contact the platform admin."
- Apply the same filter to the earner's templates listing wherever active templates are surfaced to earners (verify `earner.index.tsx` does not bypass it; adjust if it does).

## 3. Required expiration choice on a micro-credential

Current `MicroCredentialTemplate.expiryRule` is an optional free-text string. Replace with a required structured choice.

Changes:
- **Types (`src/lib/types.ts`)**: replace `expiryRule?: string` with
  ```ts
  expiryMode: "never" | "fixed_date";
  expiryDate?: string; // ISO, required when expiryMode === "fixed_date"
  ```
- **DB migration**: add `expiry_mode text not null default 'never'` and `expiry_date timestamptz` to `templates`. Backfill existing rows: rows with non-null `expiry_rule` that parses as a date → `fixed_date` + date; everything else → `never`. Keep `expiry_rule` column for now (unused) to avoid breaking older clients.
- **Store mapping (`store.tsx`)**: map new columns on read; write them on upsert.
- **Create + Edit forms**: required radio group "Does not expire" / "Expires on" + date picker (shadcn DatePicker). Validate: if `fixed_date`, date must be set and in the future on create.
- **Credential issuance**: when issuing from a template with `fixed_date`, default the credential's `expiresAt` to the template's date (issuer can still override per-recipient where the existing bulk/direct flows already allow it).

## Technical details

- Files edited: `src/lib/types.ts`, `src/lib/store.tsx`, `src/routes/issuer.templates.new.tsx`, `src/routes/issuer.templates.$id.tsx`, `src/routes/earner.apply.tsx`, possibly `src/routes/earner.index.tsx`.
- Files created: `src/routes/issuer.templates.$id.edit.tsx`.
- One migration: add `expiry_mode`, `expiry_date` columns + backfill.
- No new RLS needed — existing `templates_update_issuer` and `ta_insert_admin` policies already cover admin edits and assignment writes.

## Open question

For #2: should an earner be allowed to **see** (browse) MCs from non-linked institutions but only apply to linked ones, or hide them entirely from the apply page? Plan above hides them entirely. Tell me if you want browse-but-not-apply instead.

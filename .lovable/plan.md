## Restructured Micro-credential Template

### New mandatory fields (in addition to existing Title, Description, Source, Level, Participation, Skills, Outcomes, Assessment, Expiration)

**Type of Quality Assurance** (required, dropdown):
- Internal
- External
- Internal and external
- Other
- Not specified

When any option is selected, the issuer **must upload a QA confirmation document** (PDF/image). Stored in a new private storage bucket `qa-documents`, with file path saved on the template row.

All previously existing fields become required (Title, Description, Source, Level, Participation, ECTS, Skills, Outcomes, Assessment, Expiration). The form will block submit until all are filled.

### New optional structured fields

**Prerequisites** — choice between:
- Checkbox: "No prerequisites"
- Text area for free-form description (shown when checkbox unchecked)

**Supervision and identity verification** — single-select dropdown (optional):
- Unsupervised with no identity verification
- Supervised with no identity verification
- Supervised online with identity verification
- Supervised onsite with identity verification

**Integration / Stackability** — single-select (optional):
- Stand-alone, independent micro-credential
- Integrated, stackable towards another credential

### Database changes (migration)

`public.templates`:
- Add `qa_type text` (enum-checked: internal | external | internal_and_external | other | not_specified) — NOT NULL with default `'not_specified'` for backfill, then enforce.
- Add `qa_document_path text` (nullable; required at app-level when qa_type set).
- Add `prerequisites_none boolean NOT NULL default true`.
- Keep existing `prerequisites text` for the free-text variant.
- Replace free-text `supervision` usage by adding `supervision_type text` (nullable) constrained to the 4 options above. Keep `supervision` column for backward compat.
- Add `stackability_type text` (nullable) constrained to `stand_alone | stackable`.

New storage bucket `qa-documents` (private). RLS on `storage.objects`:
- Issuer admins of the org can insert/select/delete files under path `{issuer_org_id}/...`.
- Platform admins full access.

### Frontend changes

`src/lib/types.ts` — extend `MicroCredentialTemplate` with new fields and union types.

`src/routes/issuer.microcredential-templates.new.tsx`:
- Add QA Type select + file upload (uploaded to `qa-documents` bucket before insert; path saved).
- Add Prerequisites group (checkbox + conditional textarea).
- Add Supervision dropdown.
- Add Stackability radio/select.
- Mark all previously-optional fields required; client-side validation via zod with toast errors.

`src/routes/issuer.microcredential-templates.$id.tsx`:
- Render new fields with labels; provide signed-URL download link for the QA document.

`src/lib/store.tsx` — extend `upsertTemplate` mapping (insert/select) for new columns.

`src/integrations/supabase/types.ts` — regenerated after migration.

### Technical details

- File upload uses `supabase.storage.from('qa-documents').upload(\`${orgId}/${templateId}/${file.name}\`, file)`.
- Download in detail view uses `createSignedUrl(path, 3600)`.
- Max size 10 MB, accept `application/pdf,image/*`.
- Migration uses CHECK constraints (not enums) for the new text fields so future options are easy to add.

### Out of scope

- Editing existing templates (edit route was removed earlier).
- Backfilling QA documents for templates that already exist — they'll show `not_specified` until recreated.
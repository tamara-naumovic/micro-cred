# Plan: Public template detail nested under issuer

## Why a new route
`/earner/microcredential-templates/$id` is gated by `RoleGuard role="earner"` and requires linkage to the issuer org. The `/issuers/$id` directory is fully public, so its template cards need a public detail view.

## Route shape
URL: `/issuers/$id/microcredential-templates/$templateId`
File: `src/routes/issuers.$id.microcredential-templates.$templateId.tsx`
(Two distinct param names required since TanStack params must be unique within a path.)

## Changes

### 1. New public route file
- No `RoleGuard`. Uses `useStore()` like other pages.
- Validates: template exists, `template.issuerId === params.id`, `template.status !== "archived"`. Otherwise show "Not found" with back link to `/issuers/$id`.
- Layout mirrors `issuers.$id.tsx`: `<main className="mx-auto max-w-5xl px-4 py-10 md:px-8">`.
- Back button → `/issuers/$id` with `params={{ id }}`.
- Header: title, description, badges (status, version, source, level, ects, participation).
- **Specification card**: Learning outcomes, Skills, Assessment, Quality assurance (label + QA document list), Prerequisites, Supervision, Stackability, Expiry — same labels/maps as the earner detail page.
- `TemplateBlockchainProofCard` with `canManage={false}` (blockchain tables are now publicly readable).
- **No** staff/assignees card.
- QA documents: render a button per document that opens a signed URL via `supabase.storage.from("qa-documents").createSignedUrl(...)`. If the call errors (anonymous visitor without storage access), fall back to a toast and keep the filename visible as plain text.

### 2. `src/routes/issuers.$id.tsx`
Wrap each `Card` in `TemplateSection` with `<Link to="/issuers/$id/microcredential-templates/$templateId" params={{ id, templateId: t.id }}>` and add hover affordance: `block hover:border-primary/40 hover:shadow-sm transition`. The whole card is the clickable target — no separate "See more" button.

Pass the issuer `id` into `TemplateSection` as a new prop.

## Out of scope
- No changes to the earner-only template detail page.
- No shared component extraction across the earner + public detail pages.

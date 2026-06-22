# Plan: "See more" on template cards in /earner/apply

## Goal
On `/earner/apply`, add a **See more** button inside each template card (next to **Continue**) that opens a full detail view of the micro-credential — showing the same information as the issuer detail page, **except the Assigned staff card**.

## Why a new route instead of `/issuer/microcredential-templates/$id`
That route is wrapped in `RoleGuard role="issuer"` and includes staff assignment management — an earner cannot access it. We'll add an earner-scoped detail route that mirrors the issuer layout minus staff.

## Changes

### 1. New route: `src/routes/earner.microcredential-templates.$id.tsx`
URL: `/earner/microcredential-templates/$id`, wrapped in `RoleGuard role="earner"`.

Renders, for the template with the given id:
- `PageShell` with title = template title, description = template description, and an action button "Back" → `/earner/apply`.
- Status / version / source / level / ECTS / participation badges (same row as issuer page).
- **Specification card** (full width — no staff column): Learning outcomes, Skills, Assessment, Quality assurance (label + read-only list of QA documents opened via signed URLs from the `qa-documents` bucket, no upload/remove UI), Prerequisites, Supervision and identity verification, Stackability, Expiry.
- `TemplateBlockchainProofCard` with `canManage={false}` below the specification.
- **No `AssigneesCard`**.
- Guard: only render templates with `status === "active"` and whose `issuerId` is in the earner's `earnerInstitutions`; otherwise show a not-found-style fallback with a back link.

Shared label maps (`QA_LABEL`, `SUPERVISION_LABEL`, `STACKABILITY_LABEL`), the `Field` helper, and the `openQaDocument` helper are duplicated locally (small, route-scoped) to avoid refactoring the issuer page in this pass.

### 2. `src/routes/earner.apply.tsx`
Inside each template card's footer, add a **See more** button to the left of **Continue**:

```
<Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
  <Link to="/earner/microcredential-templates/$id" params={{ id: t.id }}>See more</Link>
</Button>
<Button size="sm" disabled={!!blocked} onClick={...}>Continue</Button>
```

Wrap the two buttons in a `flex gap-2 justify-end pt-2` container. **See more** is always enabled (even when `blocked`), so earners can review details for templates they already applied for / earned.

No other logic changes on the apply page.

## Out of scope
- No changes to the issuer detail route.
- No extraction of shared template-detail components (can be done later if a third surface needs it).

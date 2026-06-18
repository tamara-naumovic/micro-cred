## Goal
Add filters to Issuance Requests (`/issuer/requests`): by earner name, by micro‑credential template, and by current status.

## UI changes (`src/routes/issuer.requests.tsx`)
Add a filter bar above the queue list, in a Card:

1. **Earner name** — `Input` with search icon, free-text, case-insensitive substring match on `a.earnerName`.
2. **Template** — `Select` listing all distinct templates present in the current issuer's queue (value = templateId, plus "All templates").
3. **Status** — `Select` over lifecycle stages currently used in the queue (excluding `issued`/`rejected` which are already filtered out), plus "All statuses". Labels via existing status formatting (replace `_` with space, matching `StatusBadge`).

State held locally with `useState` (3 vars). A "Clear filters" ghost button appears when any filter is active.

Empty-state copy adapts: if filters are active and no results → "No requests match the current filters." Otherwise existing "No active applications."

A small count line under the title: "Showing X of Y requests" when filters active.

## Out of scope
- URL search params persistence (keeping it simple with local state, consistent with current page).
- Changes to data model or store.
- Filtering on closed (issued/rejected) applications — page intentionally shows only the active queue.

## Files touched
- `src/routes/issuer.requests.tsx` (only)

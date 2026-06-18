## Goal
On `/issuer/revocations`:
1. Swap order: **Revocation history** first, then **Revoke a credential**.
2. Both tables: search by earner name and by micro‑credential template (title).
3. Both tables: pagination — default 10 rows/page, with page-size selector (10/20/50/100) and prev/next + page indicator.
4. Add a **Title** column to the Revocation history table so the MK template is visible (currently only ID/Earner/Reason/Status).

## Implementation (`src/routes/issuer.revocations.tsx`)

- Reorder JSX: revoked card first (with heading "Revocation history"), then active card with heading "Revoke a credential".
- Per table, independent local state: `query`, `page`, `pageSize` (3 vars × 2 tables).
- Shared `TableToolbar` inline subcomponent with: search `Input` (placeholder "Search earner or micro-credential…"), nothing else.
- Shared `TablePager` inline subcomponent: "Rows per page" `Select` (10/20/50/100) + "Page X of Y · N results" + Prev/Next buttons. Hidden when there are 0 results; pager always shows page size + total when ≥1.
- Filter: case-insensitive substring match against `earnerName` OR `title`. Resets `page` to 1 whenever query or pageSize changes (via `useEffect` or by deriving and clamping the page).
- Add "Title" column to history table; keep existing columns.

## Out of scope
- URL-persisted filters.
- Server-side pagination (store-based, all in memory like today).
- Sorting.
- Changes to revoke flow itself.

## Files touched
- `src/routes/issuer.revocations.tsx`

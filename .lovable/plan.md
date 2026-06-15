## Goal
Add two filter controls next to the existing search box on `/issuer/credentials` (used by both Issuer Admin and Staff): a **Template** filter and a **Lifecycle status** filter.

## Changes — `src/routes/issuer.credentials.tsx`

1. Pull `templates` from `useStore()` in addition to current state.
2. Add two `useState` values:
   - `templateFilter: string` (default `"all"`)
   - `lifecycleFilter: string` (default `"all"`)
3. Build the dropdown option sets:
   - **Templates**: organisation's templates, filtered to assigned ones for staff (reuse `assignedIds`). Show template name; value = template id.
   - **Lifecycle**: fixed list matching values used in the table — `issued`, `pending_earner_acceptance`, `accepted`, `rejected`, `revoked`, `expired` (derive from the lifecycle values actually present in `IssuedCredential` to avoid stale options).
4. Extend the `mine` filter chain to apply both filters when not `"all"`.
5. Render two `Select` components (shadcn) alongside the existing search `Input` in `PageShell` `actions`. Group them in a `flex gap-2` wrapper so they wrap nicely.
6. Empty-state message stays the same.

## Out of scope
- No backend, schema, or permission changes — Staff already only sees assigned-template credentials via the existing `assignedIds` filter.
- No changes to issue/revoke flows.

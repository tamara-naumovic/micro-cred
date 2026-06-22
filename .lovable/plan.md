# Plan: Search + issuer filter on /earner/credentials

## Changes (single file: `src/routes/earner.credentials.index.tsx`)

1. **State**: add `searchQ: string` and `issuerFilter: string` (`"all"` default) alongside existing `src`.

2. **Filter bar** above the Tabs:
   - `Input` (icon: `Search`) — placeholder `"Search by credential name or skill"`. Width ~ `max-w-sm`.
   - `Select` for issuer — options: `All issuers` + distinct `issuerName` values from `mine`, derived via `useMemo`. Width ~ `w-56`.
   - Keep the existing Source pill row as-is.

3. **Filtering**: extend the per-tab `items` computation so it also passes when:
   - `issuerFilter === "all" || c.issuerName === issuerFilter`
   - `searchQ` empty OR `c.title` (case-insensitive contains) OR any `c.skills[i]` (case-insensitive contains).

4. **Empty state** copy already reads "No credentials in this view." — keep it; it covers the filtered case.

No other logic, routing, or data changes.

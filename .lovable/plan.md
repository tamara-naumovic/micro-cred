# Plan: Filter bar on /earner/apply

Add three filters above the template grid on step 1 of `src/routes/earner.apply.tsx`. All applied together (AND).

## Changes (single file)

1. **State**: `issuerFilter` (`"all"` default), `sourceFilter` (`"all" | "formal" | "non_formal"`), `levelFilter` (`"all"` default).

2. **Derived options** via `useMemo` from `active`:
   - `issuerOptions` = distinct `t.issuerName`, sorted.
   - `levelOptions` = distinct `t.level` excluding `"N/A"`, sorted.

3. **Filter bar** (rendered only on step 1, above the grid): three `Select`s (`Issuer`, `Type` formal/non-formal, `Level`) with an `All …` option each. Compact `flex flex-wrap gap-2`.

4. **Filtering**: replace the rendered list with `active.filter(t => …)` applying all three filters. Empty-state message extended: when filters are active and result is empty → "No micro-credentials match the current filters."

No other logic, routing, or UI changes (Continue / See more buttons untouched).

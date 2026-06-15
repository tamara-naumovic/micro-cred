# Institution Admin Dashboard Redesign — Plan

Scope: rewrite `src/routes/issuer.index.tsx` only. Visual language, routing and RLS stay as-is. All data is already loaded into the existing `useStore()` client store (already RLS-scoped to the user's institution), so no new queries, no new RLS, no migrations are required. We will *filter by `activeUser.organizationId`* in every selector. Staff vs admin scoping (assigned templates only for staff) is preserved.

## Components to add or replace

Single-file rewrite of `src/routes/issuer.index.tsx`, broken into local subcomponents:

1. `KpiRow` — 6 `MetricCard`s (reuse existing component):
   - Published MC templates (count of `templates.status === 'active'`, current org)
   - Total issued credentials (with "X this month" subline)
   - Active learners (distinct `earnerId` with at least one non-revoked/non-expired credential)
   - Active issuers (users from store with `role === 'issuer'` in this org)
   - Pending actions (sum: awaiting signature + open requests + queued + failed anchors) — clickable, scrolls to Actions panel
   - Blockchain confirmed (`confirmed / total` + `%`, excluding `disabled`)
2. `IssuedOverTimeChart` — recharts `LineChart` via existing `ui/chart.tsx`, two series (issued / blockchain-confirmed). Period filter: 30d / 6m / academic year / custom.
3. `LifecycleChart` — horizontal `BarChart`, statuses Active / Pending acceptance / Expired / Revoked / Superseded; each bar links to `/issuer/credentials?status=…`.
4. `TemplateStatusPanel` — compact two-column count grid: lifecycle (Draft/Published/Archived) + blockchain (Queued/Confirmed/Failed) shown side by side, never merged.
5. `ActionsRequiringAttention` — replaces the current "Awaiting your signature" panel. Compact rows with icon + label + count + action button. Hidden rows for zero-count items; full empty-state when nothing pending.
6. `BloxbergStatusCard` — uses anchor-job aggregates already in the store (queued/failed counts, last confirmed timestamp). RPC/contract/wallet fields rendered as "Not configured" placeholders when absent (no secrets surfaced; address masked `0x1D1B…fc7E`). "Open blockchain queue" button → `/issuer/anchoring-queue`.
7. `TopMicroCredentialsTable` — top templates owned by org with columns: MC, version, issued, active learners, blockchain confirmed (`n/m`), last issued. Sortable headers; row click → template details.
8. `IssuerActivityTable` — rows per issuer user in the org with templates managed, credentials issued, pending actions, last activity. No ranking labels.
9. `LearnerOverviewPanel` — aggregates only (unique learners, new this month, avg creds/learner, multi-credential learners, awaiting acceptance) + small `BarChart` distribution (1 / 2–3 / 4+).
10. `RecentActivityList` — derived from store `events` + `audit` filtered to this org's templates/credentials; latest 5–10 with icon, title, name, actor (when permitted), timestamp, status badge; "View all activity" link to `/issuer/credentials` or audit page if available.
11. `DashboardFilters` — global period selector (30d / 6m / academic year / custom) + template selector. State held in route via `useState` (kept minimal; URL search-params left as a follow-up to avoid scope creep).

All cards/charts/tables get loading skeletons (`Skeleton` from `ui/skeleton`, gated on `loading` from store), empty states, and safe fallback messages.

## Data — reuse only

All from `useStore()`:
- `templates`, `credentials`, `applications`, `users`, `templateAssignees`, `organizations`, `events`, `audit`.
- Blockchain status read from `credential.blockchain.chainStatus` and analogous template fields already mapped in the store.
- Anchor-queue counts derived from `credentials`/`templates` by `chainStatus` (`pending`+`submitted` → queued, `failed` → failed). If a dedicated anchor-jobs slice is later added we can swap; for now this matches what `issuer.anchoring-queue.tsx` does.

Scoping helper (already present pattern): `c.issuerId === orgId && (!isStaff || assignedIds.has(c.templateId))`.

## Charts

Use the existing shadcn `ChartContainer` + recharts wrapper (`src/components/ui/chart.tsx`) — same primitives, no new dep.

## Missing data / not implemented in this pass

These are surfaced with neutral placeholders (no fake values):
- Live RPC connectivity, chain ID, contract addresses, wallet balance — rendered as "Not configured" / "—" unless already exposed via store; wiring the read-only chain config is out of scope for a dashboard task.
- "Awaiting institutional signature" specifically — mapped to applications in `verified_by_provider` (the existing meaning of "awaiting signature" on this app).
- "Academic year" period assumes Oct 1 – Sep 30 by current date; configurable later if needed.

## Security / scoping checks

- Every selector filters by `activeUser.organizationId` and (for staff) `templateAssignees`. No cross-org rows are read or aggregated.
- No private keys, learner secrets, or full VC payloads are rendered. Wallet address masked.
- RLS unchanged; no SQL in this change.
- No admin client, no server functions added.

## Out of scope

- Backend changes (no migrations, no new RPCs).
- Blockchain write logic.
- URL-state for filters (can be added later via `validateSearch`).
- A dedicated "all activity" page (link points to existing surfaces).

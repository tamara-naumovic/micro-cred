## Problem

Today when an earner clicks **Accept**:
1. `acceptCredential` updates the credential to `issued/active` in the DB, then tries to anchor on Bloxberg.
2. If the chain call throws (network/RPC issue), the whole server function throws → the UI shows an error toast even though the credential is actually accepted in the DB.
3. The `/earner/credentials` list relies on Supabase realtime to repaint, but there is no explicit refresh after the click, so the user keeps seeing the pending card until a realtime tick (or a manual reload) lands.
4. There is no visual cue that anchoring is still in progress / failed — the user can't tell whether the credential is fully verified on-chain yet.

## Goal

- Accepting a credential always succeeds for the earner as long as the DB update succeeds. Blockchain submission becomes best-effort + background.
- The list refreshes immediately after a successful accept (no waiting for realtime).
- Accepted credentials display as **Active** with a small *Blockchain confirmation pending* indicator while `chain_status ∈ {queued, pending, submitted, failed}`, and switch to the normal Active look once `chain_status = confirmed`.

## Changes

### 1. `src/lib/chain/anchor.functions.ts` — `acceptCredential`
- Wrap `await enqueueAcceptedAnchor(...)` in `try/catch`.
  - On failure: log to console, ensure a `credential_anchor_jobs` row exists in `queued` (so the cron worker retries), set `credentials.chain_status = 'queued'` and `chain_error = <message>` via `supabaseAdmin`, and **return** `{ ok: true, chainPending: true }` instead of throwing.
- Accept itself (DB lifecycle flip + issuer notification) stays as-is and is what determines success.

### 2. `src/routes/earner.credentials.index.tsx`
- After a successful `accept(...)` call, trigger an immediate refresh of the list (via a new `refresh()` exposed from the store; see #4). Keep the existing success toast; if `result.chainPending` is true, show an info toast: *"Accepted — blockchain confirmation pending."*
- Same treatment for the detail page's `AcceptanceBanner` (`earner.credentials.$id.tsx`): on success, invalidate the `["credential", id]` query (already wired) and also call store `refresh()` so other tabs/lists update.

### 3. `src/components/CredentialCard.tsx` + `src/components/StatusBadge.tsx`
- In `CredentialCard`, when `credential.status === "active"` and `credential.blockchain?.chainStatus` is one of `queued | pending | submitted | failed`, render a small secondary chip next to the status badge: a clock icon + label `"Blockchain pending"` (or `"Blockchain retrying"` for `failed`). No change for `confirmed` or `disabled` — those keep the standard Active look.
- Use existing semantic tokens (`bg-warning/15 text-warning-foreground border-warning/30`). No new colors.
- Also surface the same chip on the detail page header (next to the existing `StatusBadge`) for consistency.
- `IssuedCredential.blockchain.chainStatus` already includes `"queued"` in the store mapping but not in `src/lib/types.ts` — extend the union to include `"queued"` so TypeScript is happy.

### 4. `src/lib/store.tsx`
- Expose the existing internal `refetchAll` on the store context as `refresh: () => Promise<void>` so route components can force an immediate reload after a mutation (no schema change, no behavior change for existing callers).

## Out of scope

- No database migrations. All required columns (`chain_status`, `chain_error`, `credential_anchor_jobs`) already exist and the cron worker already retries failed jobs.
- No change to the issuer-side anchoring queue UI (already has the Repair button).
- No change to the verify page — it already reads chain state from the DB.

## Files touched

- `src/lib/chain/anchor.functions.ts`
- `src/lib/store.tsx`
- `src/lib/types.ts`
- `src/components/CredentialCard.tsx`
- `src/routes/earner.credentials.index.tsx`
- `src/routes/earner.credentials.$id.tsx`

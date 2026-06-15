# Earner acceptance step for issued credentials

Add an explicit earner confirmation step between issuance and blockchain anchoring. No credential reaches Bloxberg until the earner accepts.

## New lifecycle flow

```
issuer issues (direct / bulk / from request)
        ↓
credential_lifecycle = 'pending_earner_acceptance'   ← NOT anchored yet
        ↓
   ┌────┴─────┐
 accept      reject (with reason)
   ↓           ↓
'issued'   'rejected'  → issuer: edit & resend  OR  accept rejection (delete)
   ↓
queue blockchain anchor
```

## Database changes (one migration)

- Add to `credentials`:
  - `rejection_reason text` (nullable)
  - `rejected_at timestamptz` (nullable)
  - `accepted_at timestamptz` (nullable)
- Keep `credential_lifecycle text`; new allowed values: `pending_earner_acceptance`, `rejected` (in addition to existing).
- Update `sync_credential_status_from_lifecycle()` trigger: map `pending_earner_acceptance` → status `active` (already present, keep), `rejected` → status `revoked` (visually hidden from earner valid list).
- Update `notify_on_credential_insert()`: title becomes "Credential awaiting your acceptance" with link `/earner/credentials` when lifecycle is `pending_earner_acceptance`.
- Add RLS policies on credentials so the earner can UPDATE only `credential_lifecycle`, `rejection_reason`, `rejected_at`, `accepted_at` on their own rows (or expose accept/reject through server fns — preferred, see below).

## Server-side changes (`src/lib/chain/anchor.functions.ts`)

In the issuance handlers (direct, bulk, from application advance):
- Insert credentials with `credential_lifecycle: 'pending_earner_acceptance'`, `chain_status: 'not_requested'`.
- Do **not** insert `credential_anchor_jobs`, do **not** update `chain_status` to `queued`, do **not** call `processCredentialAnchor`. Return `credentialStatus: "pending_earner_acceptance"`, `blockchainStatus: "not_requested"`.
- For request-driven issuance (`advanceApplicationStatus` final step), do the same — application moves to a new `pending_earner_acceptance` state (or keep as `issued` but credential lifecycle gates anchoring).

Add new server fns (auth-protected, owner-check):
- `acceptCredential({ credentialId })` — verify caller is the earner; set `credential_lifecycle='issued'`, `accepted_at=now()`; then enqueue `credential_anchor_jobs` and follow current anchor-now/anchor-later logic based on template's anchor mode.
- `rejectCredential({ credentialId, reason })` — verify caller is the earner; set `credential_lifecycle='rejected'`, `rejection_reason`, `rejected_at`.
- `resendCredential({ credentialId, grade?, expiryDate? })` — issuer only; updates fields, recomputes `vc_json` + `credential_hash` + `learner_commitment`, clears rejection fields, sets lifecycle back to `pending_earner_acceptance`.
- `discardRejectedCredential({ credentialId })` — issuer only; deletes the credential row (and its blockchain record stub + any jobs). Only allowed when `chain_status != 'confirmed'` and lifecycle is `rejected`.

## UI changes

### Earner — `src/routes/earner.credentials.index.tsx`
- Add a new tab "Pending acceptance" (lifecycle = `pending_earner_acceptance`). Show as the first/highlighted tab when items exist.
- Each card gets two buttons: **Accept** and **Reject**. Reject opens a dialog with a required reason textarea.

### Earner — `src/routes/earner.credentials.$id.tsx`
- When lifecycle is `pending_earner_acceptance`, show a clear notice "Please review and accept this credential" + Accept / Reject buttons. Hide share/verify actions until accepted.

### Issuer — `src/routes/issuer.credentials.tsx`
- Add filter/badge for `pending_earner_acceptance` and `rejected` lifecycle states.
- For `rejected` rows, show the rejection reason and two action buttons:
  - **Edit & resend** — dialog with grade + expiry inputs → `resendCredential`.
  - **Accept rejection (delete)** — confirm dialog → `discardRejectedCredential`.

### Issuance result dialog (`src/components/IssuanceResultDialog.tsx`) & bulk results
- Change wording: "Issued" → "Sent to earner for acceptance". Remove "anchored" claims for newly-issued items.

### Status labels (`src/lib/status-labels.ts`)
- Add labels/colors for `pending_earner_acceptance` ("Awaiting acceptance", amber) and `rejected` ("Rejected by earner", red).

## Duplicate-prevention adjustments (bulk + direct issue)

The existing "earner already has this credential (not revoked)" check must also treat `pending_earner_acceptance` as blocking, but `rejected` as NOT blocking (issuer can resend or delete). Update the `earnersWithActive` filter in `issuer.issue.bulk.tsx` and the equivalent in `issuer.issue.index.tsx` accordingly.

## Notifications

- On issue: notify earner "Credential awaiting your acceptance" (link to credential detail).
- On earner accept: notify issuer "Earner accepted <title>".
- On earner reject: notify issuer "Earner rejected <title>" with link to credential detail.
- On issuer resend: notify earner again.

## Out of scope

- Existing already-issued credentials in the DB stay as-is (no backfill). New issuances follow the new flow.
- No changes to template anchoring flow.

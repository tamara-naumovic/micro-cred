## Problem

When an issuer publishes a template with anchoring set to "later", the toast still shows:

> Published, but anchoring failed: new row violates row-level security policy for table "template_versions"

Root cause: the `publishAndAnchorTemplate` server function (and related anchor server fns) write to `template_versions`, `template_blockchain_records`, and `chain_anchor_jobs` through the **user-scoped** Supabase client (`requireSupabaseAuth` context). Those tables only have `SELECT` policies + `SELECT` grants for `authenticated` — there is no `INSERT/UPDATE` policy, so RLS rejects the write even though the user is a legitimate issuer admin. The publish actually succeeds for the `templates` row (which has the right policies), but the version snapshot + anchor record + job insert fail, surfacing as "anchoring failed".

## Fix

Authorize in the server function (issuer admin / staff assignee / platform admin — same checks already used), then perform the version-snapshot, blockchain-record, and queue-job inserts/updates with the **admin client** (`supabaseAdmin`, loaded inside the handler via `await import(...)`). RLS on those tables stays read-only as designed, and only the trusted server path can write.

### Changes

1. `src/lib/chain/anchor.functions.ts`
   - In `publishAndAnchorTemplate` and `anchorTemplateNow`: after the existing role check, switch writes to `template_versions`, `template_blockchain_records`, and `chain_anchor_jobs` to `supabaseAdmin`. Reads used for authorization stay on the user client.
   - In `anchorCredentialNow` / `revokeCredentialOnChain` (and any sibling that inserts into `chain_anchor_jobs` or `credential_blockchain_records`): same pattern — authorize via user client, write via `supabaseAdmin`.
2. `src/lib/chain/worker.server.ts`: already uses `supabaseAdmin`; no change expected, just verify.

No schema migration needed — keeping these tables write-locked from the Data API is the safer posture.

### Verification

- Publish a new template with "anchor later" → toast shows success, a row appears in `template_versions`, `template_blockchain_records` (status `not_requested`/`queued`), and `chain_anchor_jobs`.
- Publish with "anchor now" while chain is available → same plus a transaction is submitted.
- Issuer staff (assignee) can still publish; non-assignee staff and other orgs still get a clear authorization error (not an RLS leak).
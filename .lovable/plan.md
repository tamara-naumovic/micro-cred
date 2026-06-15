## Findings

The DB already has everything needed — no schema changes:

- `credentials`: `canonical_payload` (jsonb snapshot), `credential_hash`, `learner_commitment`, `learner_secret`, `template_ref`, `vc_json`, `vc_id`, `template_version`, `issuer_name_snapshot`, `chain_*` fields, `share_token`, `superseded_by_id`, `pdf_storage_path` (unused, will keep on-demand).
- `credential_blockchain_records`: full chain metadata mirror.
- Verification route: `/verify/$id` (param is `share_token`).

Missing pieces: no PDF/ZIP libs; no audit row type for downloads (we'll reuse `audit_log`).

## Approach

Generate everything **on demand** server-side from the frozen snapshot — no new storage bucket. A single server function dispatches by `fileType`. Files stream back as base64 + content-type; the browser triggers a download.

### New deps (Worker-safe, pure JS)

- `pdf-lib` — PDFs
- `fflate` — ZIP
- `qrcode` — PNG QR (server-side)

### New files

```
src/lib/evidence/
  package.functions.ts      # single createServerFn dispatcher: { credentialId, fileType }
  package.server.ts         # loadCredentialForEvidence(), authorize(), integrity check
  builders.server.ts        # buildCredentialPdf / Json / Receipt / InstructionsPdf / Readme / Zip / PrivateProof
  labels.ts                 # chain-status label maps (shared, client-safe)
src/components/evidence/
  EvidenceSection.tsx       # "Credential files and evidence" card with 4 public buttons
  PrivateProofDialog.tsx    # confirm modal + download
```

### Edits

- `src/routes/earner.credentials.$id.tsx` — render `<EvidenceSection credentialId=…/>` under the existing detail card. Also render for authorized institutional viewers (issuer admin / staff of `issuer_id`, platform admin) — same component, same server fn handles authorization.
- `package.json` — add the three deps.

### Server function: `generateCredentialEvidence`

`createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{credentialId:string; fileType:'pdf'|'json'|'receipt'|'instructions'|'package'|'private_proof'})=>d).handler(...)`

Flow:
1. Auth → load credential with all snapshot/chain fields.
2. **Authorization**: `userId === earner_id` OR `is_platform_admin` OR `has_role_in_org(issuer_admin, issuer_id)` OR `has_role_in_org(issuer_staff, issuer_id)`. Otherwise 403.
3. **Integrity check** (for PDF/JSON/package): if `canonical_payload` exists and `credential_hash` is set, recompute hash from canonical_payload using the same `hashCanonicalCredential` already in `src/lib/chain/hash.ts`. If mismatch → throw safe error: *"We could not generate the package because the stored credential snapshot failed an integrity check."*
4. Build the requested artifact.
5. Insert `audit_log` row: actor_id, action (`download_credential_pdf` | `_json` | `_receipt` | `_package` | `_private_proof`), target = credential id. Never log secret value.
6. Return `{ filename, contentType, base64 }`.

### Authorization layering for `private_proof`

- Same authorization rule restricted to **owner only** (`userId === earner_id`). Institutional users can NOT download private proof.
- Server fn requires fresh auth: re-call `supabase.auth.getUser()` via the middleware's authed client (token freshness is implicit — `requireSupabaseAuth` already validates the JWT). Additionally enforce: `auth_time` claim within last 30 min, else throw *"Please sign in again to download private ownership proof."* (`context.claims.iat` available).
- If `learner_secret` is null → return `{ available: false }`; UI hides/disables the button with the prescribed message.

### Builders (all pure / Worker-safe)

- `buildCredentialJson(c)` — derived from `canonical_payload` when present, else from snapshot columns. Maps `chain_status` → uppercase enum: `CONFIRMED|QUEUED|PENDING|SUBMITTED|FAILED|DISABLED|NOT_REQUESTED`. Includes `blockchainProof` only when a contract address exists. Includes existing `vc_json` proof if present; otherwise omit proof. Subject `id` = `urn:microcred:learner:<sha256(earner_id)>` (privacy-safe — no raw UUID).
- `buildVerificationReceipt(c)` — fields per spec; user-facing message string only on FAILED (no RPC details).
- `buildCredentialPdf(c, qrPng)` — `pdf-lib` single-page A4: header (title, issuer), 2-column metadata grid, outcomes/skills bullets, status badge text, QR (right column), small "Technical verification" footnote section, footer paragraph.
- `buildInstructionsPdf()` — static one-pager from spec text.
- `buildReadme(c)` — plain text per spec.
- `buildQrPng(verifyUrl)` — `qrcode.toBuffer(url,{type:'png',margin:1,width:512})`.
- `buildZip(parts)` — `fflate.zipSync({...})`. ZIP name: `micro-credential-${share_token}.zip`. Contains: `credential.pdf`, `credential.json`, `verification-receipt.json`, `verification-instructions.pdf`, `qr-code.png`, `README.txt`. **Excludes** private proof.
- `buildPrivateProof(c)` — exact JSON shape from spec, uses `learner_secret`, computed `keccak256(learner_id || credential_id)` hashes via existing `js-sha3`. Adds the prescribed warning string.

### Status label map (single source of truth)

```ts
// src/lib/evidence/labels.ts
export const CHAIN_STATUS_LABEL = {
  confirmed: "Confirmed",
  queued: "Pending",
  pending: "Pending",
  submitted: "Pending",
  failed: "Temporarily unavailable",
  disabled: "Cancelled",
  not_requested: "Not requested",
} as const;
```

Used by PDF, instructions PDF, and the receipt's user-facing fields.

### UI — `EvidenceSection`

Layout per spec: heading + lede paragraph + four primary buttons (PDF / JSON / Receipt / Package), then a visually separated "Private files" subsection with the private proof button. Each button: `disabled` while its mutation is pending, shows toast on success/error. The Package button shows "Preparing your credential package…" while loading. Uses existing `Card`, `Button`, `Separator`, `AlertDialog` primitives — no new design tokens.

Download helper (client-only): decode base64 → Blob → `URL.createObjectURL` → anchor click → revoke. Single shared `useDownload` hook in `src/lib/evidence/use-download.ts`.

### Private proof button visibility

- Owner: visible; opens `AlertDialog` per spec; on confirm calls server fn.
- Institutional viewers: hidden entirely (component receives `viewerRole` prop computed from store / a small server fn).
- If owner but `learner_secret` is null: button rendered disabled with caption *"Private ownership proof is not available for this credential."*

### Out of scope (explicitly deferred)

- No new storage bucket; no signed URLs; no pre-generated artifacts. (Spec allows on-demand.)
- No new edge functions (TanStack server fns instead, per platform guidance).
- No change to issuance, anchoring, or verification flow.
- No new audit table — reuse existing `audit_log`.

## Files touched

**New**
- `src/lib/evidence/package.functions.ts`
- `src/lib/evidence/package.server.ts`
- `src/lib/evidence/builders.server.ts`
- `src/lib/evidence/labels.ts`
- `src/lib/evidence/use-download.ts`
- `src/components/evidence/EvidenceSection.tsx`
- `src/components/evidence/PrivateProofDialog.tsx`

**Edited**
- `src/routes/earner.credentials.$id.tsx` (mount EvidenceSection)
- `package.json` (add `pdf-lib`, `fflate`, `qrcode`, `@types/qrcode`)

## Risks / things to verify after build

- `pdf-lib` + `qrcode` bundle size in the Worker — both are pure JS and known to work; will verify with `invoke-server-function` after publish.
- `hashCanonicalCredential` integrity recheck must use the exact same canonicalization as issuance — we'll import the existing helper rather than reimplement.
- Old credentials without `canonical_payload` (pre-snapshot rows): PDF/JSON still generated from current columns, but the integrity precheck is skipped and the receipt's `documentHash` simply mirrors what's stored. Documented in README copy as "best-effort for legacy credentials".
# Live blockchain verification on the public credential page

Add a manual, read-only on-chain check to `/verify/$id`. The page keeps loading credential data from the database as it does today; the visitor must click a button to trigger the live blockchain check.

## What the visitor sees

New section on the public verification page:

- Title: "Blockchain verification" / "Provera na blockchain mreži"
- Before the click: a note that live verification has not been performed yet, plus the stored transaction hash / block number already shown today, and a primary button "Verify on blockchain" / "Proveri na blockchain mreži".
- While running: "Checking the blockchain..." / "Provera blockchain zapisa..."
- After success: overall verdict (Valid / Invalid / Not found / Expired / Revoked / Superseded), network bloxberg, chain ID 8995, check timestamp, on-chain status, hash match, expiry, template result, issuer wallet address and issuer name snapshot, stored transaction hash and block number, and any consistency warnings.
- On RPC/config failure: the credential stays fully visible with the message "The credential information is available, but live blockchain verification could not be completed." / "Podaci o kredencijalu su dostupni, ali neposredna provera na blockchain mreži trenutno nije mogla biti izvršena."
- After any completed check the button becomes "Verify again" / "Proveri ponovo".

No polling, no auto-refresh, no retry loop, no persistence — the result lives only in page state.

## Technical approach

### 1. Server function (new): `src/lib/chain/verify-public.functions.ts`

`verifyPublicCredentialOnChain` — public (unauthenticated) `createServerFn({ method: "POST" })`, input `{ shareToken: string }`. Thin wrapper file: all logic lives in a new `src/lib/chain/verify-public.server.ts`, imported dynamically inside the handler (server-fn splitting rule).

Handler flow:
1. Load the credential with the admin client by `share_token`; reject unless `share_is_public` is true (same gate as `getPublicQaDocumentUrl`).
2. Read server-side only: `id`, `credential_hash`, `template_id`, `template_ref`, `template_version`, `credential_lifecycle`, `chain_status`, `chain_tx_hash`, `chain_block_number`, and the template's `document_hash` / `version`.
3. Run read-only contract calls, build the structured result, return it.

Nothing else is returned: no `vc_json`, no canonical payload, no learner secret, no earner UUID, no emails.

### 2. Read-only chain reads: `src/lib/chain/verify-read.server.ts`

New server-only module using `ethers.JsonRpcProvider` with `BLOXBERG_RPC_URL` (fallback `https://core.bloxberg.org`) and the existing `CREDENTIAL_REGISTRY_ADDRESS` / `TEMPLATE_REGISTRY_ADDRESS`. No wallet, no `BLOXBERG_PRIVATE_KEY`, no write calls. RPC calls get a timeout guard like the existing availability check.

Reused helpers (no duplicated logic):
- `to0x`, `keccak256Hex` from `src/lib/chain/hash.ts`
- `toBytes32Hex` from `src/lib/chain/bloxberg.server.ts` — currently module-private; it will be exported so both the anchoring flow and the verifier use the identical transformation.
- Credential ID normalization exactly as the active anchoring flow does it in `anchor.functions.ts`: `credentialIdHex = credential.id.replace(/-/g, "")`, then `to0x(toBytes32Hex(...))`. The old URN/demo-script logic is not used.
- `documentHash` = stored `credentials.credential_hash` (never recomputed from the public response, since `share_show_*` can hide fields).
- `templateRef` = stored `credentials.template_ref`; template document hash = `templates.document_hash`.

Calls: `verifyCredential(id, docHash)`, `getCredential(id)`, and when template data exists `verifyTemplate(templateRef, tplDocHash)` + `getTemplate(templateRef)`.

Status mapping is explicit: credential `0 None / 1 Active / 2 Revoked / 3 Superseded` (None ⇒ not found on chain); template `0 None / 1 Active / 2 Archived`. Missing template data ⇒ `template.verificationAvailable: false`, credential verification still proceeds.

### 3. Response shape

Exactly the structure from the brief: `verificationAvailable`, `network`, `chainId`, `checkedAt`, `credential { existsOnChain, valid, hashMatches, expired, statusCode, status, documentHash, learnerCommitment, templateRef, issuerAddress, issuerNameSnapshot, issuedAt, expiresAt }`, `template { ... }`, `database { lifecycle, chainStatus, transactionHash, blockNumber }`, `consistency { databaseAndBlockchainMatch, warnings[] }`.

Warnings are emitted (never suppressed) for: DB says confirmed but not on chain; stored hash ≠ on-chain hash; `verifyCredential` false; revoked off-chain but Active on-chain; Active off-chain but Revoked/Superseded on-chain; DB `template_ref` ≠ on-chain `templateRef`; template missing on chain; template archived; RPC unavailable; contract config missing; stored credential document hash missing. Off-chain and on-chain status are always displayed separately, since on-chain revocation is not wired into the active queue processor.

### 4. UI: `src/routes/verify.$id.tsx` + new `src/components/PublicChainVerificationPanel.tsx`

The panel is rendered under the existing `CredentialBlockchainVerificationCard`. It uses `useMutation` + `useServerFn` so the RPC happens only in the click handler — no loader, no `useQuery`, so nothing fires on page load. Errors thrown by the server function are caught and rendered as the error state; the credential card is never hidden and the route never 404s.

Strings go into the existing i18n shards (`src/i18n/locales/{en,sr}/common.json`), following the current key/namespace conventions.

### 5. Tests

Add `src/lib/chain/__tests__/verify-public.server.test.ts` (vitest) exercising the pure result-builder with mocked contract reads and a mocked credential row: confirmed & valid; not found on-chain; hash mismatch; expired; on-chain Revoked; on-chain Superseded; revoked off-chain but Active on-chain; template archived; template data unavailable; RPC unavailable; missing contract configuration; missing stored document hash; credential hidden by `share_is_public`.

## Files touched

- new `src/lib/chain/verify-public.functions.ts`
- new `src/lib/chain/verify-public.server.ts`
- new `src/lib/chain/verify-read.server.ts`
- new `src/components/PublicChainVerificationPanel.tsx`
- new `src/lib/chain/__tests__/verify-public.server.test.ts`
- edit `src/lib/chain/bloxberg.server.ts` (export `toBytes32Hex`)
- edit `src/routes/verify.$id.tsx`
- edit `src/i18n/locales/en/common.json`, `src/i18n/locales/sr/common.json`

## Reporting after implementation

Changed-file list, the exact normalization/hashing helpers reused, the route → server function → RPC → contract → UI trace, confirmation that the RPC fires only on click and that no private key is used, and test output covering a successful verification, an RPC failure, and a DB/chain mismatch.

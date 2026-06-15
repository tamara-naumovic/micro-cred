# Plan: Granular visibility controls for public verification

## Goal

On `/earner/credentials/[id]`, the earner can toggle visibility of every optional MC field. The `/verify/<share_token>` page shows only fields the earner has allowed. Currently only `isPublic`, `showGrade`, `showSource`, `showExpiry`, `showSkills` are wired; `level`, `prerequisites`, `supervision`, `integration (stackability)` always render. This adds the missing four toggles end-to-end, and fixes the "private credential" UX.

## What changes

### 1) Database (migration already applied)
- `credentials`: added `share_show_level`, `share_show_prerequisites`, `share_show_supervision`, `share_show_integration` (boolean, default `true`).
- `get_public_credential` updated to mask `level`, `prerequisites`/`prerequisites_none`, `supervision_type`, `stackability_type` based on those flags (existing masks for expiry/source/skills/grade preserved).
- Added `get_credential_visibility(_share_token)` returning `{ exists_flag, is_public }` so the verify page can distinguish "doesn't exist" from "exists but private".

### 2) Types and data layer
- `SharingSettings` (`src/lib/types.ts`): add `showLevel`, `showPrerequisites`, `showSupervision`, `showIntegration`.
- `DbCredential` (`src/lib/credentials.ts`): add the four new columns + new `fetchCredentialVisibility(shareToken)` helper.
- `SHARE_KEYS`: add corresponding column names.
- `src/lib/store.tsx`: extend sharing mapping (read) and `updateSharing` patch (write) with the four new keys.

### 3) Earner detail page (`src/routes/earner.credentials.$id.tsx`)
- Visibility card: add 4 switches (Show level, Show prerequisites, Show supervision & ID verification, Show integration / stackability).
- Pass new flags through `DetailLayout`.

### 4) Verify page (`src/routes/verify.$id.tsx`)
- Before falling back to the mock store / "not found", call `fetchCredentialVisibility(shareToken)`:
  - `exists && !is_public` → render the existing `PrivateNotice` ("Credential is private"). **No 404 if the credential really exists.**
  - `!exists` → render "Credential not found" (or fall through to the mock-store lookup for demo IDs).
- `RealVerify`: rely on the RPC masking — `Level` already wrapped in `cred.level && cred.level !== "N/A"`, and `TemplateInfo` checks for each field's presence, so masked `null` values are naturally hidden.

### 5) No changes to
- Anchoring / blockchain pipeline, issuer/admin views, `share_is_public` semantics.

## Notes
- Defaults are `true` so existing credentials remain fully visible until the earner narrows them.
- Private credentials show the friendly notice instead of 404, as requested.

Awaiting build-mode approval to apply the code edits (migration is already in).

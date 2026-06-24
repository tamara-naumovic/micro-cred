## Goal
Allow a single user in an institution to hold **both** `issuer_admin` and `issuer_staff` roles simultaneously. Both platform admins and institution admins can grant/revoke the secondary role.

## Background
The DB already supports it — `user_roles` has unique key `(user_id, role, organization_id)`, so two rows per user per org are legal. The blockers are in app code:
- `auth.tsx` and `store.tsx` pick a single "primary" role by priority and discard the rest.
- `admin.users.tsx` edit/create dialogs use a single-select Role dropdown and `adminUpdateUser` **deletes all** existing role rows before inserting one new one.
- `/issuer/staff` is gated by `subRole === "admin"` and its add/remove flows assume staff is the only role on that user.

## Changes

### 1. Auth + store: keep all org roles, derive a combined sub-role
File: `src/lib/auth.tsx`, `src/lib/store.tsx`
- When a user has both `issuer_admin` and `issuer_staff` rows for the same org, set `role: "issuer"`, `subRole: "admin"` (admin wins for routing/permissions), and add a new optional field `subRoles: ("admin" | "staff")[]` on `MockUser` listing all sub-roles held in that org.
- Keep existing priority logic for everything else (platform admin > issuer admin > issuer staff > earner).

File: `src/lib/types.ts`
- Add `subRoles?: ("admin" | "staff")[]` to `MockUser`.

### 2. Admin users page: multi-role editing
File: `src/routes/admin.users.tsx`
- Replace the single Role `<Select>` in **Add user** and **Edit user** dialogs with:
  - Top-level Role choice: Earner / Issuer / Platform admin (same as today)
  - When "Issuer" chosen: two checkboxes — **Institution admin** and **Staff** (either or both required) + the Institution picker. Existing selection seeded from `user.subRoles`.
- Show combined roles in the table badge (e.g. `issuer · admin + staff`).

File: `src/lib/admin-users.functions.ts`
- Change `adminUpdateUser` input: `role?: AppRole` → `roles?: AppRole[]` (array, single non-issuer role or one/two issuer rows for the same org). Replace the "delete all roles, insert one" block with "delete all roles, insert each role in the array" using the same org id for issuer rows.
- Change `adminCreateUser` input similarly: `role: AppRole` → `roles: AppRole[]`. Provision the user once, then insert each requested role row.

### 3. Institution admin staff page: don't block users who are also admin
File: `src/lib/issuer-staff.functions.ts`
- `addIssuerStaff` already tolerates duplicates — no change needed for the "promote admin to also be staff" case (institution admin enters the admin's email under "Existing account").
- `removeIssuerStaff`: stop unconditionally deleting `template_assignees` for the user. Only delete template assignees when the user has no remaining `issuer_admin` row for the same org (query after the role delete).
- Add a new server fn `setIssuerAdminRole({ userId, organizationId, makeAdmin: boolean })` that institution admins call to grant/revoke the `issuer_admin` role on an existing org member. Authorized via `assertOrgAdmin`. Refuse to revoke the caller's own admin role and refuse to revoke the last admin in the org (count check).

File: `src/routes/issuer.staff.tsx`
- In the staff table, add an "Also admin" badge for rows whose `userId` matches a user that has `issuer_admin` for this org. Requires `listIssuerStaff` to return an `isAdmin` flag — add to the function: after fetching staff rows, query `user_roles` for `issuer_admin` rows in the same org and merge.
- Add a per-row action menu: **Promote to admin** / **Revoke admin** (calls `setIssuerAdminRole`). Hide the option for the current user's own row.
- Keep page-level guard `subRole === "admin"` unchanged.

### 4. Verification
- Use `psql` to insert both roles for a test user and confirm: login routes them through admin guard, `/issuer/staff` shows the dual badge, removing staff keeps admin role intact (and vice versa).

## Out of scope
- No DB migration (schema already supports dual roles).
- No changes to `bulkAddIssuerStaff`, RLS policies, or the earner/platform_admin flows.
- Dual roles across **different** orgs are not introduced here — issuer roles are still scoped to a single org per user in the admin UI.

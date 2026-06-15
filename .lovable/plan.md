# Notifications implementation plan

Use existing `public.notifications` table (`for_user_id` personal, `for_role` + `for_org_id` role-scoped). Realtime + bell + store mapping already wired in `src/lib/store.tsx`. Only the `/earner/notifications` page is a placeholder.

## 1. Earner notifications

1. **Application status change** — extend existing `notify_on_application_status` trigger to cover all status transitions (`under_review`, `approved`, `issued`, `rejected`, etc.), one notification per change.
2. **Credential awaiting acceptance** — already handled in `notify_on_credential_insert` for `pending_earner_acceptance`. Keep.
3. **Rejection accepted by issuer** — add notification inserts inside:
   - `discardRejectedCredential` server fn → "Your rejection was accepted; the credential was discarded."
   - `resendCredential` server fn → "Issuer updated and resent the credential for your acceptance" (link to credential detail).
4. **Credential revoked** — new trigger on `credentials` UPDATE when `credential_lifecycle` transitions to `revoked` from `issued` (skip the `rejected → revoked` sync path). Notify `earner_id`.
5. **Template archived** — new trigger on `templates` UPDATE when archived flag flips. Fan out one notification per distinct `earner_id` that either (a) holds a non-revoked credential for that template, or (b) has a pending/under-review application for it.
6. **Linked to an institution** — new trigger on `earner_institutions` INSERT → notify the earner.
7. **Expiry reminders (30 / 7 / 1 day)** — daily pg_cron job hitting a new `/api/public/hooks/expiry-reminders` server route. The route selects credentials with `lifecycle = issued` and `expires_at` in the windows `[now+29d, now+30d]`, `[now+6d, now+7d]`, `[now, now+1d]`, then inserts one notification per (earner, credential, window). De-dupe by checking for an existing notification with the same `link` + title prefix in the last 24h.

## 2. Issuer staff notifications

1. **New MC issue request** — modify `notify_on_application_insert` to insert two rows: one for `issuer_admin`, one for `issuer_staff`, both org-scoped.
2. **MC issuance rejected by earner** — add notification insert inside `rejectCredential` server fn, scoped to the org for both `issuer_admin` and `issuer_staff`, with rejection reason snippet and link to `/issuer/credentials`.
3. **Assigned to issue an MC template** — new trigger on `template_assignees` INSERT → notify the assigned `user_id` directly (`for_user_id`).

## 3. Issuer admin notifications

Issuer admin receives the same set as issuer staff (admin is a superset). All staff-targeted inserts also fan out to `issuer_admin` for the same org.

## 4. UI work

- Replace `src/routes/earner.notifications.tsx` placeholder with a real list: title, body, time-ago, link, read/unread state, "Mark all as read". Reuse `useStore().notifications`.
- Add `src/routes/issuer.notifications.tsx` with the same list, filtered to issuer-scoped entries.
- Clicking a notification marks it read and navigates to `link`.

## Technical details

- **Migrations**:
  - alter `notify_on_application_insert` (fan-out to admin + staff)
  - alter `notify_on_application_status` (cover all transitions)
  - new `notify_on_credential_revoked` trigger
  - new `notify_on_template_archived` trigger
  - new `notify_on_earner_institution_link` trigger
  - new `notify_on_template_assignee` trigger
  - schedule pg_cron daily job → POST to expiry-reminders hook
- **Server fn changes** (`src/lib/chain/anchor.functions.ts`): add notification inserts in `rejectCredential`, `discardRejectedCredential`, `resendCredential` using `supabaseAdmin`.
- **New server route**: `src/routes/api/public/hooks/expiry-reminders.ts` — anon-key auth, runs the 30/7/1-day window query and inserts notifications.
- **Frontend**: two route files; no store changes needed.

Ready to implement on approval.

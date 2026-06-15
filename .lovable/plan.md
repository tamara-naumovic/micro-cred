## Plan: Lock down `registration_requests` inserts

External self-registration is disabled — only platform admins and issuer admins create users. The anon INSERT policy `regreq_insert_anyone` is unused and should be removed.

### Migration

1. `DROP POLICY "regreq_insert_anyone" ON public.registration_requests;`
2. Add a replacement INSERT policy restricted to platform admins (the only role that manages this pipeline today):
   ```sql
   CREATE POLICY regreq_insert_platform_admin
     ON public.registration_requests FOR INSERT
     TO authenticated
     WITH CHECK (public.is_platform_admin(auth.uid()));
   ```
3. Revoke `INSERT` on the table from `anon` (cleanup; matches the new policy).

### After

- Mark `registration_requests_anon_insert` as fixed.
- No app code changes — `store.tsx` only reads/updates registration requests as admin.
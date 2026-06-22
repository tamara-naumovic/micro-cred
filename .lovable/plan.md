# Plan: Make blockchain proof publicly readable

## Change
Replace the SELECT policy on `public.template_blockchain_records` with a permissive policy that allows **any** caller (anon and authenticated) to read all rows. INSERT/UPDATE policies stay unchanged (admins/staff only).

Also do the same for `public.credential_blockchain_records` so credential-level proofs are consistently public.

### Migration
```sql
-- Templates
DROP POLICY IF EXISTS tbr_select ON public.template_blockchain_records;
CREATE POLICY tbr_select ON public.template_blockchain_records
  FOR SELECT TO anon, authenticated
  USING (true);
GRANT SELECT ON public.template_blockchain_records TO anon;

-- Credentials
DROP POLICY IF EXISTS cbr_select ON public.credential_blockchain_records;
CREATE POLICY cbr_select ON public.credential_blockchain_records
  FOR SELECT TO anon, authenticated
  USING (true);
GRANT SELECT ON public.credential_blockchain_records TO anon;
```

(The `authenticated` grants already exist; only `anon` needs the SELECT grant added.)

## Out of scope
No client changes. INSERT/UPDATE remain restricted to admins/template staff.

DROP POLICY IF EXISTS tbr_select ON public.template_blockchain_records;
CREATE POLICY tbr_select ON public.template_blockchain_records
  FOR SELECT TO anon, authenticated
  USING (true);
GRANT SELECT ON public.template_blockchain_records TO anon;

DROP POLICY IF EXISTS cbr_select ON public.credential_blockchain_records;
CREATE POLICY cbr_select ON public.credential_blockchain_records
  FOR SELECT TO anon, authenticated
  USING (true);
GRANT SELECT ON public.credential_blockchain_records TO anon;

-- template_versions: allow inserts by authorized issuer staff
CREATE POLICY "template_versions_insert" ON public.template_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_versions.template_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
          OR public.is_template_assignee(auth.uid(), t.id)
        )
    )
  );

-- template_blockchain_records: insert + update by authorized issuer staff
CREATE POLICY "tbr_insert" ON public.template_blockchain_records
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_blockchain_records.template_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
          OR public.is_template_assignee(auth.uid(), t.id)
        )
    )
  );

CREATE POLICY "tbr_update" ON public.template_blockchain_records
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_blockchain_records.template_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
          OR public.is_template_assignee(auth.uid(), t.id)
        )
    )
  );

-- credential_blockchain_records: insert + update by authorized issuer staff
CREATE POLICY "cbr_insert" ON public.credential_blockchain_records
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credentials c
      WHERE c.id = credential_blockchain_records.credential_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, c.issuer_id)
          OR public.is_template_assignee(auth.uid(), c.template_id)
        )
    )
  );

CREATE POLICY "cbr_update" ON public.credential_blockchain_records
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credentials c
      WHERE c.id = credential_blockchain_records.credential_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, c.issuer_id)
          OR public.is_template_assignee(auth.uid(), c.template_id)
        )
    )
  );

-- chain_anchor_jobs: enable RLS + read/insert/update by authorized issuer staff
ALTER TABLE public.chain_anchor_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.chain_anchor_jobs TO authenticated;
GRANT ALL ON public.chain_anchor_jobs TO service_role;

CREATE POLICY "caj_select" ON public.chain_anchor_jobs
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      entity_type = 'template'
      AND EXISTS (
        SELECT 1 FROM public.templates t
        WHERE t.id = chain_anchor_jobs.entity_id
          AND (
            public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
            OR public.is_template_assignee(auth.uid(), t.id)
          )
      )
    )
    OR (
      entity_type = 'credential'
      AND EXISTS (
        SELECT 1 FROM public.credentials c
        WHERE c.id = chain_anchor_jobs.entity_id
          AND (
            public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, c.issuer_id)
            OR public.is_template_assignee(auth.uid(), c.template_id)
          )
      )
    )
  );

CREATE POLICY "caj_insert" ON public.chain_anchor_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      entity_type = 'template'
      AND EXISTS (
        SELECT 1 FROM public.templates t
        WHERE t.id = chain_anchor_jobs.entity_id
          AND (
            public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
            OR public.is_template_assignee(auth.uid(), t.id)
          )
      )
    )
    OR (
      entity_type = 'credential'
      AND EXISTS (
        SELECT 1 FROM public.credentials c
        WHERE c.id = chain_anchor_jobs.entity_id
          AND (
            public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, c.issuer_id)
            OR public.is_template_assignee(auth.uid(), c.template_id)
          )
      )
    )
  );

CREATE POLICY "caj_update" ON public.chain_anchor_jobs
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      entity_type = 'template'
      AND EXISTS (
        SELECT 1 FROM public.templates t
        WHERE t.id = chain_anchor_jobs.entity_id
          AND (
            public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
            OR public.is_template_assignee(auth.uid(), t.id)
          )
      )
    )
    OR (
      entity_type = 'credential'
      AND EXISTS (
        SELECT 1 FROM public.credentials c
        WHERE c.id = chain_anchor_jobs.entity_id
          AND (
            public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, c.issuer_id)
            OR public.is_template_assignee(auth.uid(), c.template_id)
          )
      )
    )
  );

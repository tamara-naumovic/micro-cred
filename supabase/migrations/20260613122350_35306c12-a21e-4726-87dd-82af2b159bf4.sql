
CREATE TABLE public.earner_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  earner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (earner_id, organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.earner_institutions TO authenticated;
GRANT ALL ON public.earner_institutions TO service_role;

ALTER TABLE public.earner_institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ei_select_own_or_org_or_admin" ON public.earner_institutions
  FOR SELECT TO authenticated
  USING (
    earner_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin', organization_id)
    OR public.has_role_in_org(auth.uid(), 'issuer_staff', organization_id)
  );

CREATE POLICY "ei_insert_admin_or_orgadmin" ON public.earner_institutions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin', organization_id)
  );

CREATE POLICY "ei_delete_admin_or_orgadmin" ON public.earner_institutions
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin', organization_id)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.earner_institutions;

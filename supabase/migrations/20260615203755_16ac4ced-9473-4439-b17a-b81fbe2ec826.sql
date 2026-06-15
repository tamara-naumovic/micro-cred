DROP POLICY IF EXISTS orgs_update_admin_or_member ON public.organizations;
CREATE POLICY orgs_update_admin_or_member ON public.organizations
  FOR UPDATE
  USING (public.is_platform_admin(auth.uid()) OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, id))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, id));
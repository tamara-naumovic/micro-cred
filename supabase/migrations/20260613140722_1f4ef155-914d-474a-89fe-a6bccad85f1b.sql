CREATE POLICY "user_roles_select_org_admin" ON public.user_roles
FOR SELECT TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, organization_id)
);
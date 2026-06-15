GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role_in_org(uuid, app_role, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_template_assignee(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.template_issuer_org(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_application(uuid) TO authenticated, anon;
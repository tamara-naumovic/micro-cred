CREATE OR REPLACE FUNCTION public.can_access_application(_app_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.applications a
    where a.id = _app_id and (
      a.earner_id = auth.uid()
      or public.has_role_in_org(auth.uid(), 'issuer_admin', a.issuer_id)
      or public.is_template_assignee(auth.uid(), a.template_id)
      or public.is_platform_admin(auth.uid())
    )
  )
$function$;
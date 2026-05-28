DROP FUNCTION IF EXISTS public.get_public_credential(text);

CREATE FUNCTION public.get_public_credential(_share_token text)
 RETURNS TABLE(id uuid, title text, earner_name text, issuer_name text, issued_at timestamp with time zone, expires_at timestamp with time zone, status credential_status, source learning_source, level cred_level, ects numeric, skills text[], grade text, ebsi_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.id, c.title, c.earner_name, c.issuer_name,
    c.issued_at,
    case when c.share_show_expiry then c.expires_at else null end,
    c.status,
    case when c.share_show_source then c.source else null end,
    c.level, c.ects,
    case when c.share_show_skills then c.skills else '{}'::text[] end,
    case when c.share_show_grade then c.grade else null end,
    c.ebsi_status
  from public.credentials c
  where c.share_token = _share_token and c.share_is_public = true
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_credential(text) TO anon, authenticated;
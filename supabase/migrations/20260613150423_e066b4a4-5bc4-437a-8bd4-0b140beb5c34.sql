
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_stackability_type_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_stackability_type_check
  CHECK (stackability_type IS NULL OR stackability_type = ANY (ARRAY['stand_alone','independent_integrated','stackable']));

DROP FUNCTION IF EXISTS public.get_public_credential(text);

CREATE FUNCTION public.get_public_credential(_share_token text)
 RETURNS TABLE(
   id uuid, title text, earner_name text, issuer_name text,
   issued_at timestamp with time zone, expires_at timestamp with time zone,
   status credential_status, source learning_source, level cred_level,
   ects numeric, skills text[], grade text, ebsi_status text,
   qa_type text, qa_document_path text,
   prerequisites text, prerequisites_none boolean,
   supervision_type text, stackability_type text
 )
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
    c.ebsi_status,
    t.qa_type, t.qa_document_path,
    t.prerequisites, t.prerequisites_none,
    t.supervision_type, t.stackability_type
  from public.credentials c
  left join public.templates t on t.id = c.template_id
  where c.share_token = _share_token and c.share_is_public = true
$function$;

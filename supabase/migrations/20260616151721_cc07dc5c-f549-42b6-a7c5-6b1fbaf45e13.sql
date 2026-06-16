DROP FUNCTION IF EXISTS public.get_public_credential(text);
CREATE OR REPLACE FUNCTION public.get_public_credential(_share_token text)
 RETURNS TABLE(id uuid, title text, earner_name text, issuer_name text, issued_at timestamp with time zone, expires_at timestamp with time zone, status credential_status, credential_lifecycle text, source learning_source, level cred_level, ects numeric, skills text[], outcomes text[], grade text, ebsi_status text, qa_type text, qa_document_path text, qa_document_paths text[], prerequisites text, prerequisites_none boolean, supervision_type text, stackability_type text, vc_id text, template_version text, credential_hash text, learner_commitment text, template_ref text, chain_status text, chain_tx_hash text, chain_block_number bigint, chain_issuer_address text, chain_contract_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.title, c.earner_name, c.issuer_name,
    c.issued_at,
    CASE WHEN c.share_show_expiry THEN c.expires_at ELSE NULL END,
    c.status, c.credential_lifecycle,
    CASE WHEN c.share_show_source THEN c.source ELSE NULL END,
    CASE WHEN c.share_show_level THEN c.level ELSE NULL END,
    c.ects,
    c.skills,
    COALESCE(t.outcomes, '{}'::text[]),
    CASE WHEN c.share_show_grade THEN c.grade ELSE NULL END,
    c.ebsi_status,
    t.qa_type, t.qa_document_path, t.qa_document_paths,
    CASE WHEN c.share_show_prerequisites THEN t.prerequisites ELSE NULL END,
    CASE WHEN c.share_show_prerequisites THEN t.prerequisites_none ELSE NULL END,
    CASE WHEN c.share_show_supervision THEN t.supervision_type ELSE NULL END,
    CASE WHEN c.share_show_integration THEN t.stackability_type ELSE NULL END,
    c.vc_id, c.template_version,
    c.credential_hash, c.learner_commitment, c.template_ref,
    c.chain_status, c.chain_tx_hash, c.chain_block_number,
    c.chain_issuer_address, c.chain_contract_address
  FROM public.credentials c
  LEFT JOIN public.templates t ON t.id = c.template_id
  WHERE c.share_token = _share_token AND c.share_is_public = true
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_credential(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profile(_share_token text)
 RETURNS TABLE(display_name text, about text, country text, avatar_url text, credentials json)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.display_name, p.about, p.country, p.avatar_url,
    (
      select json_agg(json_build_object(
        'id', c.id, 'title', c.title, 'issuer_name', c.issuer_name,
        'issued_at', c.issued_at, 'level', c.level, 'ects', c.ects,
        'share_token', c.share_token, 'status', c.status,
        'skills', c.skills,
        'outcomes', COALESCE(t.outcomes, '{}'::text[])
      ))
      from public.credentials c
      left join public.templates t on t.id = c.template_id
      where c.earner_id = p.id and c.share_is_public = true and c.status = 'active'
    )
  from public.profiles p
  where p.share_token = _share_token
$function$;
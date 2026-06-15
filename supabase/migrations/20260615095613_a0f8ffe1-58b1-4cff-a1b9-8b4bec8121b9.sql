
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS share_show_level boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_show_prerequisites boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_show_supervision boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_show_integration boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_credential_visibility(_share_token text)
RETURNS TABLE(exists_flag boolean, is_public boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT true, c.share_is_public
  FROM public.credentials c
  WHERE c.share_token = _share_token
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_public_credential(_share_token text)
 RETURNS TABLE(id uuid, title text, earner_name text, issuer_name text, issued_at timestamp with time zone, expires_at timestamp with time zone, status credential_status, credential_lifecycle text, source learning_source, level cred_level, ects numeric, skills text[], grade text, ebsi_status text, qa_type text, qa_document_path text, prerequisites text, prerequisites_none boolean, supervision_type text, stackability_type text, vc_id text, template_version text, credential_hash text, learner_commitment text, template_ref text, chain_status text, chain_tx_hash text, chain_block_number bigint, chain_issuer_address text, chain_contract_address text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id, c.title, c.earner_name, c.issuer_name,
    c.issued_at,
    CASE WHEN c.share_show_expiry THEN c.expires_at ELSE NULL END,
    c.status, c.credential_lifecycle,
    CASE WHEN c.share_show_source THEN c.source ELSE NULL END,
    CASE WHEN c.share_show_level THEN c.level ELSE NULL END,
    c.ects,
    CASE WHEN c.share_show_skills THEN c.skills ELSE '{}'::text[] END,
    CASE WHEN c.share_show_grade THEN c.grade ELSE NULL END,
    c.ebsi_status,
    t.qa_type, t.qa_document_path,
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
$$;

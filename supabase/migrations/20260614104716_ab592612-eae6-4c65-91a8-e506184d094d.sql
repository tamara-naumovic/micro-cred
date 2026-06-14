
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS credential_hash text,
  ADD COLUMN IF NOT EXISTS learner_commitment text,
  ADD COLUMN IF NOT EXISTS learner_secret text,
  ADD COLUMN IF NOT EXISTS template_ref text,
  ADD COLUMN IF NOT EXISTS vc_json jsonb,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS chain_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS chain_tx_hash text,
  ADD COLUMN IF NOT EXISTS chain_block_number bigint,
  ADD COLUMN IF NOT EXISTS chain_issuer_address text,
  ADD COLUMN IF NOT EXISTS chain_contract_address text,
  ADD COLUMN IF NOT EXISTS chain_error text,
  ADD COLUMN IF NOT EXISTS chain_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS chain_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.chain_anchor_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.credentials(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.chain_anchor_jobs TO service_role;

ALTER TABLE public.chain_anchor_jobs ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS chain_anchor_jobs_active_unique
  ON public.chain_anchor_jobs(credential_id)
  WHERE status <> 'done';

CREATE INDEX IF NOT EXISTS chain_anchor_jobs_status_idx
  ON public.chain_anchor_jobs(status, created_at);

DROP TRIGGER IF EXISTS chain_anchor_jobs_set_updated_at ON public.chain_anchor_jobs;
CREATE TRIGGER chain_anchor_jobs_set_updated_at
  BEFORE UPDATE ON public.chain_anchor_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP FUNCTION IF EXISTS public.get_public_credential(text);

CREATE FUNCTION public.get_public_credential(_share_token text)
RETURNS TABLE(
  id uuid, title text, earner_name text, issuer_name text,
  issued_at timestamp with time zone, expires_at timestamp with time zone,
  status credential_status, source learning_source, level cred_level,
  ects numeric, skills text[], grade text, ebsi_status text,
  qa_type text, qa_document_path text, prerequisites text, prerequisites_none boolean,
  supervision_type text, stackability_type text,
  credential_hash text, learner_commitment text, template_ref text,
  chain_status text, chain_tx_hash text, chain_block_number bigint,
  chain_issuer_address text, chain_contract_address text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    t.supervision_type, t.stackability_type,
    c.credential_hash, c.learner_commitment, c.template_ref,
    c.chain_status, c.chain_tx_hash, c.chain_block_number,
    c.chain_issuer_address, c.chain_contract_address
  from public.credentials c
  left join public.templates t on t.id = c.template_id
  where c.share_token = _share_token and c.share_is_public = true
$$;

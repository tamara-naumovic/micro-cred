
-- ============================================================================
-- TEMPLATES: blockchain status & snapshot fields
-- ============================================================================
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS blockchain_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS document_hash text,
  ADD COLUMN IF NOT EXISTS template_ref text,
  ADD COLUMN IF NOT EXISTS canonical_payload jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS issuer_name_snapshot text,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id);

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_blockchain_status_check;
ALTER TABLE public.templates
  ADD CONSTRAINT templates_blockchain_status_check
  CHECK (blockchain_status IN ('not_requested','queued','submitting','submitted','confirmed','failed','cancelled'));

-- ============================================================================
-- CREDENTIALS: lifecycle + snapshot fields + chain_status remap
-- ============================================================================
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS credential_lifecycle text NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS vc_id text,
  ADD COLUMN IF NOT EXISTS template_version text,
  ADD COLUMN IF NOT EXISTS canonical_payload jsonb,
  ADD COLUMN IF NOT EXISTS issuer_name_snapshot text,
  ADD COLUMN IF NOT EXISTS superseded_by_id uuid REFERENCES public.credentials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chain_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chain_last_attempt_at timestamptz;

-- Sync credential_lifecycle from existing status enum for existing rows
UPDATE public.credentials
   SET credential_lifecycle = CASE status::text
       WHEN 'active' THEN 'issued'
       WHEN 'revoked' THEN 'revoked'
       WHEN 'expired' THEN 'expired'
       ELSE 'issued'
   END
 WHERE credential_lifecycle = 'issued' AND status::text <> 'active';

ALTER TABLE public.credentials
  DROP CONSTRAINT IF EXISTS credentials_credential_lifecycle_check;
ALTER TABLE public.credentials
  ADD CONSTRAINT credentials_credential_lifecycle_check
  CHECK (credential_lifecycle IN ('draft','pending_earner_acceptance','issued','revoked','expired','superseded'));

-- Remap chain_status: pending -> not_requested (for rows that have no anchoring activity)
UPDATE public.credentials
   SET chain_status = 'queued'
 WHERE chain_status = 'pending' AND (credential_hash IS NOT NULL OR learner_commitment IS NOT NULL);

UPDATE public.credentials
   SET chain_status = 'not_requested'
 WHERE chain_status = 'pending';

ALTER TABLE public.credentials ALTER COLUMN chain_status SET DEFAULT 'not_requested';

ALTER TABLE public.credentials
  DROP CONSTRAINT IF EXISTS credentials_chain_status_check;
ALTER TABLE public.credentials
  ADD CONSTRAINT credentials_chain_status_check
  CHECK (chain_status IN ('not_requested','queued','submitting','submitted','confirmed','failed','cancelled'));

-- Keep `status` enum in sync with credential_lifecycle via a trigger (UI source of truth: lifecycle)
CREATE OR REPLACE FUNCTION public.sync_credential_status_from_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.status := CASE NEW.credential_lifecycle
    WHEN 'issued' THEN 'active'::credential_status
    WHEN 'revoked' THEN 'revoked'::credential_status
    WHEN 'expired' THEN 'expired'::credential_status
    WHEN 'superseded' THEN 'revoked'::credential_status
    WHEN 'pending_earner_acceptance' THEN 'active'::credential_status
    WHEN 'draft' THEN 'active'::credential_status
    ELSE NEW.status
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_credential_status ON public.credentials;
CREATE TRIGGER trg_sync_credential_status
  BEFORE INSERT OR UPDATE OF credential_lifecycle ON public.credentials
  FOR EACH ROW EXECUTE FUNCTION public.sync_credential_status_from_lifecycle();

-- ============================================================================
-- template_versions: immutable snapshot per publish
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  version text NOT NULL,
  canonical_payload jsonb NOT NULL,
  document_hash text NOT NULL,
  template_ref text NOT NULL,
  issuer_name_snapshot text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
CREATE INDEX IF NOT EXISTS template_versions_template_idx ON public.template_versions(template_id);

GRANT SELECT ON public.template_versions TO authenticated;
GRANT ALL ON public.template_versions TO service_role;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_versions_select ON public.template_versions;
CREATE POLICY template_versions_select ON public.template_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_versions.template_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
          OR public.is_template_assignee(auth.uid(), t.id)
        )
    )
  );

-- ============================================================================
-- template_blockchain_records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.template_blockchain_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  template_version text NOT NULL,
  network text NOT NULL DEFAULT 'bloxberg',
  chain_id bigint NOT NULL DEFAULT 8995,
  contract_address text NOT NULL DEFAULT '',
  document_hash text NOT NULL,
  template_ref text NOT NULL,
  blockchain_status text NOT NULL DEFAULT 'not_requested',
  transaction_hash text,
  block_number bigint,
  anchored_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, template_version, network, contract_address),
  CHECK (blockchain_status IN ('not_requested','queued','submitting','submitted','confirmed','failed','cancelled'))
);
CREATE INDEX IF NOT EXISTS tbr_template_idx ON public.template_blockchain_records(template_id);

GRANT SELECT ON public.template_blockchain_records TO authenticated;
GRANT ALL ON public.template_blockchain_records TO service_role;
ALTER TABLE public.template_blockchain_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tbr_select ON public.template_blockchain_records;
CREATE POLICY tbr_select ON public.template_blockchain_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_blockchain_records.template_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, t.issuer_id)
          OR public.is_template_assignee(auth.uid(), t.id)
        )
    )
  );

DROP TRIGGER IF EXISTS tbr_set_updated_at ON public.template_blockchain_records;
CREATE TRIGGER tbr_set_updated_at BEFORE UPDATE ON public.template_blockchain_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- credential_blockchain_records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credential_blockchain_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.credentials(id) ON DELETE CASCADE,
  network text NOT NULL DEFAULT 'bloxberg',
  chain_id bigint NOT NULL DEFAULT 8995,
  contract_address text NOT NULL DEFAULT '',
  contract_credential_id text,
  document_hash text NOT NULL,
  blockchain_status text NOT NULL DEFAULT 'not_requested',
  transaction_hash text,
  block_number bigint,
  anchored_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credential_id, network, contract_address),
  CHECK (blockchain_status IN ('not_requested','queued','submitting','submitted','confirmed','failed','cancelled'))
);
CREATE INDEX IF NOT EXISTS cbr_credential_idx ON public.credential_blockchain_records(credential_id);

GRANT SELECT ON public.credential_blockchain_records TO authenticated;
GRANT ALL ON public.credential_blockchain_records TO service_role;
ALTER TABLE public.credential_blockchain_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cbr_select ON public.credential_blockchain_records;
CREATE POLICY cbr_select ON public.credential_blockchain_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credentials c
      WHERE c.id = credential_blockchain_records.credential_id
        AND (
          c.earner_id = auth.uid()
          OR public.is_platform_admin(auth.uid())
          OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, c.issuer_id)
          OR public.is_template_assignee(auth.uid(), c.template_id)
        )
    )
  );

DROP TRIGGER IF EXISTS cbr_set_updated_at ON public.credential_blockchain_records;
CREATE TRIGGER cbr_set_updated_at BEFORE UPDATE ON public.credential_blockchain_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- chain_anchor_jobs: extend for both entity types and operations
-- ============================================================================
ALTER TABLE public.chain_anchor_jobs
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'credential',
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS operation text NOT NULL DEFAULT 'anchor_credential',
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS transaction_hash text;

-- Backfill entity_id from credential_id
UPDATE public.chain_anchor_jobs SET entity_id = credential_id WHERE entity_id IS NULL AND credential_id IS NOT NULL;

-- credential_id becomes nullable for template jobs
ALTER TABLE public.chain_anchor_jobs ALTER COLUMN credential_id DROP NOT NULL;

ALTER TABLE public.chain_anchor_jobs
  DROP CONSTRAINT IF EXISTS chain_anchor_jobs_entity_type_check;
ALTER TABLE public.chain_anchor_jobs
  ADD CONSTRAINT chain_anchor_jobs_entity_type_check
  CHECK (entity_type IN ('template','credential'));

ALTER TABLE public.chain_anchor_jobs
  DROP CONSTRAINT IF EXISTS chain_anchor_jobs_operation_check;
ALTER TABLE public.chain_anchor_jobs
  ADD CONSTRAINT chain_anchor_jobs_operation_check
  CHECK (operation IN ('anchor_template','anchor_credential','revoke_credential','supersede_credential'));

ALTER TABLE public.chain_anchor_jobs
  DROP CONSTRAINT IF EXISTS chain_anchor_jobs_status_check;
ALTER TABLE public.chain_anchor_jobs
  ADD CONSTRAINT chain_anchor_jobs_status_check
  CHECK (status IN ('queued','running','done','failed','cancelled'));

-- Replace unique partial index
DROP INDEX IF EXISTS chain_anchor_jobs_active_unique;
CREATE UNIQUE INDEX IF NOT EXISTS chain_anchor_jobs_active_unique
  ON public.chain_anchor_jobs (entity_type, entity_id, operation)
  WHERE status NOT IN ('done','cancelled');

CREATE INDEX IF NOT EXISTS chain_anchor_jobs_entity_idx ON public.chain_anchor_jobs(entity_type, entity_id);

-- ============================================================================
-- RPC: get_public_credential — return new lifecycle + vc_id + template_version
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_public_credential(text);
CREATE OR REPLACE FUNCTION public.get_public_credential(_share_token text)
RETURNS TABLE(
  id uuid, title text, earner_name text, issuer_name text,
  issued_at timestamptz, expires_at timestamptz,
  status credential_status, credential_lifecycle text,
  source learning_source, level cred_level, ects numeric,
  skills text[], grade text, ebsi_status text,
  qa_type text, qa_document_path text,
  prerequisites text, prerequisites_none boolean,
  supervision_type text, stackability_type text,
  vc_id text, template_version text,
  credential_hash text, learner_commitment text, template_ref text,
  chain_status text, chain_tx_hash text, chain_block_number bigint,
  chain_issuer_address text, chain_contract_address text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id, c.title, c.earner_name, c.issuer_name,
    c.issued_at,
    CASE WHEN c.share_show_expiry THEN c.expires_at ELSE NULL END,
    c.status, c.credential_lifecycle,
    CASE WHEN c.share_show_source THEN c.source ELSE NULL END,
    c.level, c.ects,
    CASE WHEN c.share_show_skills THEN c.skills ELSE '{}'::text[] END,
    CASE WHEN c.share_show_grade THEN c.grade ELSE NULL END,
    c.ebsi_status,
    t.qa_type, t.qa_document_path,
    t.prerequisites, t.prerequisites_none,
    t.supervision_type, t.stackability_type,
    c.vc_id, c.template_version,
    c.credential_hash, c.learner_commitment, c.template_ref,
    c.chain_status, c.chain_tx_hash, c.chain_block_number,
    c.chain_issuer_address, c.chain_contract_address
  FROM public.credentials c
  LEFT JOIN public.templates t ON t.id = c.template_id
  WHERE c.share_token = _share_token AND c.share_is_public = true
$$;


-- Create separate anchor job tables for templates and credentials.
-- Old chain_anchor_jobs remains read-only (deprecated) until cleanup.

CREATE TABLE public.template_anchor_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  template_version text NOT NULL,
  operation text NOT NULL DEFAULT 'anchor_template',
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  transaction_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.template_anchor_jobs TO authenticated;
GRANT ALL ON public.template_anchor_jobs TO service_role;

ALTER TABLE public.template_anchor_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl_jobs_select"
ON public.template_anchor_jobs FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_anchor_jobs.template_id
      AND (public.has_role_in_org(auth.uid(), 'issuer_admin', t.issuer_id)
        OR public.is_template_assignee(auth.uid(), t.id))
  )
);

CREATE POLICY "tpl_jobs_insert"
ON public.template_anchor_jobs FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_anchor_jobs.template_id
      AND (public.has_role_in_org(auth.uid(), 'issuer_admin', t.issuer_id)
        OR public.is_template_assignee(auth.uid(), t.id))
  )
);

CREATE POLICY "tpl_jobs_update"
ON public.template_anchor_jobs FOR UPDATE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_anchor_jobs.template_id
      AND public.has_role_in_org(auth.uid(), 'issuer_admin', t.issuer_id)
  )
);

CREATE UNIQUE INDEX template_anchor_jobs_one_active
ON public.template_anchor_jobs (template_id, template_version)
WHERE status IN ('queued', 'running', 'failed');

CREATE INDEX template_anchor_jobs_status_idx
ON public.template_anchor_jobs (status, next_attempt_at);

CREATE TRIGGER template_anchor_jobs_updated_at
BEFORE UPDATE ON public.template_anchor_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.credential_anchor_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.credentials(id) ON DELETE CASCADE,
  operation text NOT NULL DEFAULT 'anchor_credential',
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  transaction_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.credential_anchor_jobs TO authenticated;
GRANT ALL ON public.credential_anchor_jobs TO service_role;

ALTER TABLE public.credential_anchor_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cred_jobs_select"
ON public.credential_anchor_jobs FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.credentials c
    WHERE c.id = credential_anchor_jobs.credential_id
      AND (public.has_role_in_org(auth.uid(), 'issuer_admin', c.issuer_id)
        OR (c.template_id IS NOT NULL AND public.is_template_assignee(auth.uid(), c.template_id)))
  )
);

CREATE POLICY "cred_jobs_insert"
ON public.credential_anchor_jobs FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.credentials c
    WHERE c.id = credential_anchor_jobs.credential_id
      AND (public.has_role_in_org(auth.uid(), 'issuer_admin', c.issuer_id)
        OR (c.template_id IS NOT NULL AND public.is_template_assignee(auth.uid(), c.template_id)))
  )
);

CREATE POLICY "cred_jobs_update"
ON public.credential_anchor_jobs FOR UPDATE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.credentials c
    WHERE c.id = credential_anchor_jobs.credential_id
      AND public.has_role_in_org(auth.uid(), 'issuer_admin', c.issuer_id)
  )
);

CREATE UNIQUE INDEX credential_anchor_jobs_one_active
ON public.credential_anchor_jobs (credential_id, operation)
WHERE status IN ('queued', 'running', 'failed');

CREATE INDEX credential_anchor_jobs_status_idx
ON public.credential_anchor_jobs (status, next_attempt_at);

CREATE TRIGGER credential_anchor_jobs_updated_at
BEFORE UPDATE ON public.credential_anchor_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Migrate existing rows from chain_anchor_jobs
INSERT INTO public.template_anchor_jobs
  (id, template_id, template_version, operation, status, attempts, last_error,
   last_attempt_at, next_attempt_at, transaction_hash, created_at, updated_at)
SELECT
  j.id, j.entity_id,
  COALESCE((SELECT tbr.template_version FROM public.template_blockchain_records tbr
            WHERE tbr.template_id = j.entity_id
            ORDER BY tbr.created_at DESC LIMIT 1), '1.0'),
  COALESCE(j.operation, 'anchor_template'),
  j.status, COALESCE(j.attempts, 0), j.last_error,
  NULL, j.next_attempt_at, j.transaction_hash, j.created_at, j.updated_at
FROM public.chain_anchor_jobs j
WHERE j.entity_type = 'template' AND j.entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.credential_anchor_jobs
  (id, credential_id, operation, status, attempts, last_error,
   last_attempt_at, next_attempt_at, transaction_hash, created_at, updated_at)
SELECT
  j.id, COALESCE(j.entity_id, j.credential_id),
  COALESCE(j.operation, 'anchor_credential'),
  j.status, COALESCE(j.attempts, 0), j.last_error,
  NULL, j.next_attempt_at, j.transaction_hash, j.created_at, j.updated_at
FROM public.chain_anchor_jobs j
WHERE (j.entity_type IS NULL OR j.entity_type = 'credential')
  AND COALESCE(j.entity_id, j.credential_id) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 1. Create the new secrets table
CREATE TABLE public.credential_secrets (
  credential_id uuid PRIMARY KEY REFERENCES public.credentials(id) ON DELETE CASCADE,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants: only the earner reads via RLS; admin client (service_role) manages writes
GRANT SELECT ON public.credential_secrets TO authenticated;
GRANT ALL ON public.credential_secrets TO service_role;

-- 3. RLS: earner-only read
ALTER TABLE public.credential_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY credential_secrets_select_earner
ON public.credential_secrets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.credentials c
    WHERE c.id = credential_secrets.credential_id
      AND c.earner_id = auth.uid()
  )
);

-- 4. Backfill existing secrets, then drop the leaky column
INSERT INTO public.credential_secrets (credential_id, secret)
SELECT id, learner_secret
FROM public.credentials
WHERE learner_secret IS NOT NULL
ON CONFLICT (credential_id) DO NOTHING;

ALTER TABLE public.credentials DROP COLUMN learner_secret;
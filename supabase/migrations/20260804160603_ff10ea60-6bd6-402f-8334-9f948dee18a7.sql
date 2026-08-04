CREATE TABLE public.credential_renewals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_credential_id uuid NOT NULL REFERENCES public.credentials(id) ON DELETE CASCADE,
  replacement_credential_id uuid REFERENCES public.credentials(id) ON DELETE SET NULL,
  issuer_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  replacement_anchored_at timestamp with time zone,
  completed_at timestamp with time zone,
  state text NOT NULL DEFAULT 'replacement_pending',
  new_expires_at timestamp with time zone,
  supersede_tx_hash text,
  supersede_block_number bigint,
  supersede_chain_status text NOT NULL DEFAULT 'not_requested',
  supersede_confirmed_at timestamp with time zone,
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credential_renewals TO authenticated;
GRANT ALL ON public.credential_renewals TO service_role;

ALTER TABLE public.credential_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credential_renewals_select_org"
ON public.credential_renewals
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR public.is_org_member(auth.uid(), issuer_id)
);

CREATE UNIQUE INDEX credential_renewals_one_active
  ON public.credential_renewals (original_credential_id)
  WHERE state NOT IN ('completed', 'cancelled');

CREATE INDEX credential_renewals_replacement_idx
  ON public.credential_renewals (replacement_credential_id);

CREATE TRIGGER credential_renewals_updated_at
BEFORE UPDATE ON public.credential_renewals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
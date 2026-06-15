ALTER TABLE public.credentials DROP CONSTRAINT IF EXISTS credentials_credential_lifecycle_check;
ALTER TABLE public.credentials
  ADD CONSTRAINT credentials_credential_lifecycle_check
  CHECK (credential_lifecycle IN ('draft','issued','revoked','expired','superseded','pending_earner_acceptance','rejected'));
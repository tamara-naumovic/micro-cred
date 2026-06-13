ALTER TABLE public.templates 
  ADD COLUMN IF NOT EXISTS expiry_mode text NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz;

ALTER TABLE public.templates 
  ADD CONSTRAINT templates_expiry_mode_check CHECK (expiry_mode IN ('never','fixed_date'));

-- Backfill: if expiry_rule looks like an ISO date, use it
UPDATE public.templates
SET expiry_mode = 'fixed_date',
    expiry_date = (expiry_rule)::timestamptz
WHERE expiry_rule IS NOT NULL
  AND expiry_rule ~ '^\d{4}-\d{2}-\d{2}';
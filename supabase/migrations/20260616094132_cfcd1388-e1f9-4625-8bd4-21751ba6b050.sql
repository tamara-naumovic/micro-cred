UPDATE public.credential_anchor_jobs j
SET status = 'done',
    last_error = COALESCE(j.last_error, c.chain_error),
    transaction_hash = COALESCE(j.transaction_hash, c.chain_tx_hash),
    last_attempt_at = COALESCE(j.last_attempt_at, c.chain_confirmed_at, now()),
    next_attempt_at = NULL
FROM public.credentials c
WHERE j.credential_id = c.id
  AND c.chain_status = 'confirmed'
  AND j.status NOT IN ('done', 'cancelled');

UPDATE public.template_anchor_jobs j
SET status = 'done',
    last_attempt_at = COALESCE(j.last_attempt_at, now()),
    next_attempt_at = NULL
FROM public.templates t
WHERE j.template_id = t.id
  AND t.blockchain_status = 'confirmed'
  AND j.status NOT IN ('done', 'cancelled');
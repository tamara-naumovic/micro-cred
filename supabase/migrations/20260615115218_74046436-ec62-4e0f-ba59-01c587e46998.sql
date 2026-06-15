-- Add earner acceptance fields to credentials
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Update lifecycle->status sync trigger to map rejected -> revoked,
-- pending_earner_acceptance -> active (kept hidden from valid list by lifecycle)
CREATE OR REPLACE FUNCTION public.sync_credential_status_from_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.status := CASE NEW.credential_lifecycle
    WHEN 'issued' THEN 'active'::credential_status
    WHEN 'revoked' THEN 'revoked'::credential_status
    WHEN 'expired' THEN 'expired'::credential_status
    WHEN 'superseded' THEN 'revoked'::credential_status
    WHEN 'pending_earner_acceptance' THEN 'active'::credential_status
    WHEN 'rejected' THEN 'revoked'::credential_status
    WHEN 'draft' THEN 'active'::credential_status
    ELSE NEW.status
  END;
  RETURN NEW;
END;
$function$;

-- Adjust insert notification to phrase awaiting-acceptance issues correctly
CREATE OR REPLACE FUNCTION public.notify_on_credential_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.credential_lifecycle = 'pending_earner_acceptance' then
    insert into public.notifications (for_user_id, title, body, link)
    values (new.earner_id, 'Credential awaiting your acceptance',
            new.title || ' was issued to you. Review and accept or reject it.',
            '/earner/credentials/' || new.id::text);
  else
    insert into public.notifications (for_user_id, title, body, link)
    values (new.earner_id, 'Credential issued',
            new.title || ' is now in your wallet.', '/earner/credentials');
  end if;
  insert into public.platform_events (type, description)
  values ('issuance', 'Credential ' || new.title || ' issued to ' || new.earner_name);
  insert into public.audit_log (actor_id, actor_name, action, target)
  values (auth.uid(), coalesce((select display_name from public.profiles where id = auth.uid()), 'system'),
          'issued credential', new.id::text);
  return new;
end; $function$;
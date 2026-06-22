ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title_key text,
  ADD COLUMN IF NOT EXISTS body_key text,
  ADD COLUMN IF NOT EXISTS params jsonb;

-- 1) Application insert (notify issuer admin and staff)
CREATE OR REPLACE FUNCTION public.notify_on_application_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE tpl_title text;
BEGIN
  SELECT title INTO tpl_title FROM public.templates WHERE id = NEW.template_id;
  INSERT INTO public.notifications (for_role, for_org_id, title, body, link, title_key, body_key, params)
  VALUES
    ('issuer_admin', NEW.issuer_id, 'New application submitted',
      'New application for ' || coalesce(tpl_title,''), '/issuer/requests',
      'events.applicationSubmitted.title', 'events.applicationSubmitted.body',
      jsonb_build_object('template', coalesce(tpl_title,''))),
    ('issuer_staff', NEW.issuer_id, 'New application submitted',
      'New application for ' || coalesce(tpl_title,''), '/issuer/requests',
      'events.applicationSubmitted.title', 'events.applicationSubmitted.body',
      jsonb_build_object('template', coalesce(tpl_title,'')));
  INSERT INTO public.platform_events (type, description)
  VALUES ('application', 'Application submitted for ' || coalesce(tpl_title,''));
  RETURN NEW;
END $$;

-- 2) Application status changes -> earner notifications
CREATE OR REPLACE FUNCTION public.notify_on_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE tpl_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO tpl_title FROM public.templates WHERE id = NEW.template_id;
  IF NEW.status = 'issued' THEN
    INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
    VALUES (NEW.earner_id, 'Credential issued', coalesce(tpl_title,'') || ' is now in your wallet.',
            '/earner/credentials',
            'events.credentialIssued.title', 'events.credentialIssued.body',
            jsonb_build_object('title', coalesce(tpl_title,'')));
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
    VALUES (NEW.earner_id, 'Application rejected', coalesce(tpl_title,''),
            '/earner/applications',
            'events.applicationRejected.title', 'events.applicationRejected.body',
            jsonb_build_object('template', coalesce(tpl_title,'')));
  ELSE
    INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
    VALUES (NEW.earner_id, 'Application status updated',
            coalesce(tpl_title,'') || ': ' || NEW.status::text,
            '/earner/applications',
            'events.applicationStatus.title', 'events.applicationStatus.body',
            jsonb_build_object('template', coalesce(tpl_title,''), 'status', NEW.status::text));
  END IF;
  RETURN NEW;
END $$;

-- 3) Credential insert (awaiting acceptance / issued)
CREATE OR REPLACE FUNCTION public.notify_on_credential_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.credential_lifecycle = 'pending_earner_acceptance' THEN
    INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
    VALUES (NEW.earner_id, 'Credential awaiting your acceptance',
            NEW.title || ' was issued to you. Review and accept or reject it.',
            '/earner/credentials/' || NEW.id::text,
            'events.credentialAwaitingAcceptance.title', 'events.credentialAwaitingAcceptance.body',
            jsonb_build_object('title', NEW.title));
  ELSE
    INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
    VALUES (NEW.earner_id, 'Credential issued',
            NEW.title || ' is now in your wallet.', '/earner/credentials',
            'events.credentialIssued.title', 'events.credentialIssued.body',
            jsonb_build_object('title', NEW.title));
  END IF;
  INSERT INTO public.platform_events (type, description)
  VALUES ('issuance', 'Credential ' || NEW.title || ' issued to ' || NEW.earner_name);
  INSERT INTO public.audit_log (actor_id, actor_name, action, target)
  VALUES (auth.uid(), coalesce((SELECT display_name FROM public.profiles WHERE id = auth.uid()), 'system'),
          'issued credential', NEW.id::text);
  RETURN NEW;
END $$;

-- 4) Credential revoked
CREATE OR REPLACE FUNCTION public.notify_on_credential_revoked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.credential_lifecycle = 'revoked'
     AND coalesce(OLD.credential_lifecycle,'') = 'issued' THEN
    INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
    VALUES (NEW.earner_id, 'Credential revoked',
      coalesce(NEW.title,'A credential') || ' has been revoked'
        || CASE WHEN NEW.revocation_reason IS NOT NULL
                THEN '. Reason: ' || NEW.revocation_reason ELSE '' END,
      '/earner/credentials/' || NEW.id::text,
      'events.credentialRevoked.title',
      CASE WHEN NEW.revocation_reason IS NOT NULL
           THEN 'events.credentialRevoked.bodyWithReason'
           ELSE 'events.credentialRevoked.body' END,
      jsonb_build_object('title', coalesce(NEW.title,''), 'reason', coalesce(NEW.revocation_reason,'')));
  END IF;
  RETURN NEW;
END $$;

-- 5) Template archived
CREATE OR REPLACE FUNCTION public.notify_on_template_archived()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'archived' AND coalesce(OLD.status::text,'') <> 'archived' THEN
    INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
    SELECT DISTINCT earner_id,
      'Credential template archived',
      'The micro-credential "' || NEW.title || '" has been archived by the issuer.',
      '/earner/credentials',
      'events.templateArchived.title',
      'events.templateArchived.body',
      jsonb_build_object('title', NEW.title)
    FROM (
      SELECT earner_id FROM public.credentials
       WHERE template_id = NEW.id AND credential_lifecycle <> 'revoked'
      UNION
      SELECT earner_id FROM public.applications
       WHERE template_id = NEW.id AND status NOT IN ('issued','rejected')
    ) t
    WHERE earner_id IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;

-- 6) Earner linked to institution
CREATE OR REPLACE FUNCTION public.notify_on_earner_institution_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE org_name text;
BEGIN
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
  INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
  VALUES (NEW.earner_id, 'Linked to a new institution',
    'You have been linked to ' || coalesce(org_name,'an institution') || '.',
    '/earner',
    'events.linkedToInstitution.title', 'events.linkedToInstitution.body',
    jsonb_build_object('org', coalesce(org_name,'')));
  RETURN NEW;
END $$;

-- 7) Template assignee
CREATE OR REPLACE FUNCTION public.notify_on_template_assignee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE tpl_title text;
BEGIN
  SELECT title INTO tpl_title FROM public.templates WHERE id = NEW.template_id;
  INSERT INTO public.notifications (for_user_id, title, body, link, title_key, body_key, params)
  VALUES (NEW.user_id, 'Assigned to a micro-credential',
    'You have been assigned to issue "' || coalesce(tpl_title,'a template') || '".',
    '/issuer/microcredential-templates/' || NEW.template_id::text,
    'events.assignedToTemplate.title', 'events.assignedToTemplate.body',
    jsonb_build_object('template', coalesce(tpl_title,'')));
  RETURN NEW;
END $$;

-- 1) Fan-out application insert notifications to both admin and staff
CREATE OR REPLACE FUNCTION public.notify_on_application_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE tpl_title text;
BEGIN
  SELECT title INTO tpl_title FROM public.templates WHERE id = NEW.template_id;
  INSERT INTO public.notifications (for_role, for_org_id, title, body, link)
  VALUES
    ('issuer_admin', NEW.issuer_id, 'New application submitted',
      'New application for ' || coalesce(tpl_title,''), '/issuer/requests'),
    ('issuer_staff', NEW.issuer_id, 'New application submitted',
      'New application for ' || coalesce(tpl_title,''), '/issuer/requests');
  INSERT INTO public.platform_events (type, description)
  VALUES ('application', 'Application submitted for ' || coalesce(tpl_title,''));
  RETURN NEW;
END $$;

-- 2) Credential revoked notification (only when transitioning from issued)
CREATE OR REPLACE FUNCTION public.notify_on_credential_revoked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.credential_lifecycle = 'revoked'
     AND coalesce(OLD.credential_lifecycle,'') = 'issued' THEN
    INSERT INTO public.notifications (for_user_id, title, body, link)
    VALUES (NEW.earner_id, 'Credential revoked',
      coalesce(NEW.title,'A credential') || ' has been revoked'
        || CASE WHEN NEW.revocation_reason IS NOT NULL
                THEN '. Reason: ' || NEW.revocation_reason ELSE '' END,
      '/earner/credentials/' || NEW.id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_credential_revoked ON public.credentials;
CREATE TRIGGER trg_notify_credential_revoked
AFTER UPDATE OF credential_lifecycle ON public.credentials
FOR EACH ROW EXECUTE FUNCTION public.notify_on_credential_revoked();

-- 3) Template archived notification (fan out to all affected earners)
CREATE OR REPLACE FUNCTION public.notify_on_template_archived()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'archived' AND coalesce(OLD.status::text,'') <> 'archived' THEN
    INSERT INTO public.notifications (for_user_id, title, body, link)
    SELECT DISTINCT earner_id,
      'Credential template archived',
      'The micro-credential "' || NEW.title || '" has been archived by the issuer.',
      '/earner/credentials'
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

DROP TRIGGER IF EXISTS trg_notify_template_archived ON public.templates;
CREATE TRIGGER trg_notify_template_archived
AFTER UPDATE OF status ON public.templates
FOR EACH ROW EXECUTE FUNCTION public.notify_on_template_archived();

-- 4) Earner linked to institution notification
CREATE OR REPLACE FUNCTION public.notify_on_earner_institution_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE org_name text;
BEGIN
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
  INSERT INTO public.notifications (for_user_id, title, body, link)
  VALUES (NEW.earner_id, 'Linked to a new institution',
    'You have been linked to ' || coalesce(org_name,'an institution') || '.',
    '/earner');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_earner_institution_link ON public.earner_institutions;
CREATE TRIGGER trg_notify_earner_institution_link
AFTER INSERT ON public.earner_institutions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_earner_institution_link();

-- 5) Staff assigned to a template
CREATE OR REPLACE FUNCTION public.notify_on_template_assignee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE tpl_title text;
BEGIN
  SELECT title INTO tpl_title FROM public.templates WHERE id = NEW.template_id;
  INSERT INTO public.notifications (for_user_id, title, body, link)
  VALUES (NEW.user_id, 'Assigned to a micro-credential',
    'You have been assigned to issue "' || coalesce(tpl_title,'a template') || '".',
    '/issuer/microcredential-templates/' || NEW.template_id::text);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_template_assignee ON public.template_assignees;
CREATE TRIGGER trg_notify_template_assignee
AFTER INSERT ON public.template_assignees
FOR EACH ROW EXECUTE FUNCTION public.notify_on_template_assignee();

-- 6) Enable extensions for the daily expiry reminder cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

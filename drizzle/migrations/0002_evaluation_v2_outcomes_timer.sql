ALTER TABLE public.evaluation_attempts
  ADD COLUMN IF NOT EXISTS timer_quality text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS timer_definition_version text NOT NULL DEFAULT 't2',
  ADD COLUMN IF NOT EXISTS help_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_rule text,
  ADD COLUMN IF NOT EXISTS not_assessed_reason text;

-- Earlier attempts were measured with the v1 timer (idle auto-pause, no heartbeat).
UPDATE public.evaluation_attempts SET timer_definition_version = 't1' WHERE started_at < now();

-- Participants can never write server-owned outcome fields.
CREATE OR REPLACE FUNCTION public.eval_guard_attempt_outcome()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.outcome := 'not_assessed'; NEW.outcome_source := NULL; NEW.verification_rule := NULL;
      RETURN NEW;
    END IF;
    NEW.verification_rule := OLD.verification_rule;
    IF OLD.outcome_source = 'server' OR NEW.outcome NOT IN ('self_reported_success','not_assessed') THEN
      NEW.outcome := OLD.outcome; NEW.outcome_source := OLD.outcome_source;
    ELSIF NEW.outcome = 'self_reported_success' THEN
      NEW.outcome_source := 'self_report';
    ELSE
      NEW.outcome_source := CASE WHEN OLD.outcome = 'not_assessed' THEN OLD.outcome_source ELSE NULL END;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eval_guard_attempt_outcome ON public.evaluation_attempts;
CREATE TRIGGER eval_guard_attempt_outcome BEFORE INSERT OR UPDATE ON public.evaluation_attempts
  FOR EACH ROW EXECUTE FUNCTION public.eval_guard_attempt_outcome();

-- Server-side records now also carry the rule; verified is never downgraded.
CREATE OR REPLACE FUNCTION public.eval_record_verified(_user_id uuid, _code text, _event text, _success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT at.id AS attempt_id, at.session_id, at.assignment_id
    FROM public.evaluation_attempts at
    JOIN public.evaluation_assignments a ON a.id = at.assignment_id
    JOIN public.evaluation_campaigns c ON c.id = a.campaign_id
    JOIN public.evaluation_scenarios s ON s.id = at.scenario_id
    WHERE a.user_id = _user_id AND a.enabled AND a.consent_status='accepted' AND c.status='active'
      AND s.code = _code AND at.status IN ('in_progress','paused')
  LOOP
    INSERT INTO public.evaluation_events(assignment_id, session_id, attempt_id, event_type, source, metadata)
    VALUES (r.assignment_id, r.session_id, r.attempt_id, _event, 'server', jsonb_build_object('scenario_code', _code));
    IF _success THEN
      UPDATE public.evaluation_attempts SET outcome='verified_success', outcome_source='server',
        verification_rule = coalesce(verification_rule, _code || ':' || _event), not_assessed_reason=NULL, updated_at=now()
      WHERE id = r.attempt_id AND outcome <> 'verified_success';
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'eval_record_verified failed: %', SQLERRM;
END $$;

-- Public share link visits (E8 credential, E9 profile). Records nothing about the visitor.
CREATE OR REPLACE FUNCTION public.eval_record_share_visit(_kind text, _token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  IF _kind = 'credential' THEN
    SELECT earner_id INTO owner FROM public.credentials WHERE share_token = _token AND share_is_public;
    IF owner IS NOT NULL THEN PERFORM public.eval_record_verified(owner, 'E8', 'share_link_visited', true); END IF;
  ELSIF _kind = 'profile' THEN
    SELECT id INTO owner FROM public.profiles WHERE share_token = _token;
    IF owner IS NOT NULL THEN PERFORM public.eval_record_verified(owner, 'E9', 'share_link_visited', true); END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.eval_record_share_visit(text, text) TO anon, authenticated;

-- E11: recorded on the server before the session is destroyed.
CREATE OR REPLACE FUNCTION public.eval_record_logout()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.eval_record_verified(auth.uid(), 'E11', 'logout_completed', true);
END $$;
GRANT EXECUTE ON FUNCTION public.eval_record_logout() TO authenticated;

-- E10 actions: notification marked read / profile setting changed.
CREATE OR REPLACE FUNCTION public.eval_on_notification_read()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NOT OLD.read AND NEW.read AND NEW.for_user_id IS NOT NULL THEN
      PERFORM public.eval_record_verified(NEW.for_user_id, 'E10', 'notification_marked_read', false);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eval_notification_read ON public.notifications;
CREATE TRIGGER eval_notification_read AFTER UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.eval_on_notification_read();

CREATE OR REPLACE FUNCTION public.eval_on_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF OLD.language IS DISTINCT FROM NEW.language OR OLD.display_name IS DISTINCT FROM NEW.display_name
       OR OLD.about IS DISTINCT FROM NEW.about OR OLD.country IS DISTINCT FROM NEW.country THEN
      PERFORM public.eval_record_verified(NEW.id, 'E10', 'setting_changed', false);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eval_profile_update ON public.profiles;
CREATE TRIGGER eval_profile_update AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.eval_on_profile_update();

-- Server-side rule evaluation when an attempt ends. Upgrades only; never downgrades verified.
CREATE OR REPLACE FUNCTION public.eval_finalize_attempt(_attempt_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE at public.evaluation_attempts; code text; uid uuid; t0 timestamptz; t1 timestamptz;
  res text := NULL; rule text := NULL; reason text := NULL; n int; m int;
  ev text[];
BEGIN
  SELECT * INTO at FROM public.evaluation_attempts WHERE id = _attempt_id;
  IF NOT FOUND OR NOT public.eval_owns_assignment(at.assignment_id) THEN RAISE EXCEPTION 'Not found'; END IF;
  SELECT s.code INTO code FROM public.evaluation_scenarios s WHERE s.id = at.scenario_id;
  SELECT a.user_id INTO uid FROM public.evaluation_assignments a WHERE a.id = at.assignment_id;
  t0 := at.started_at; t1 := coalesce(at.ended_at, now());
  SELECT coalesce(array_agg(DISTINCT event_type), '{}') INTO ev FROM public.evaluation_events WHERE attempt_id = _attempt_id;
  IF at.outcome = 'verified_success' THEN RETURN at.outcome; END IF;

  IF code = 'E1' THEN
    n := (CASE WHEN ev && ARRAY['credentials_viewed','credential_details_viewed'] THEN 1 ELSE 0 END)
       + (CASE WHEN 'applications_viewed' = ANY(ev) THEN 1 ELSE 0 END)
       + (CASE WHEN 'public_profile_viewed' = ANY(ev) THEN 1 ELSE 0 END)
       + (CASE WHEN 'notification_opened' = ANY(ev) THEN 1 ELSE 0 END)
       + (CASE WHEN 'settings_viewed' = ANY(ev) THEN 1 ELSE 0 END);
    IF n >= 3 THEN res := 'verified_success'; rule := 'E1:sections>=3';
    ELSIF n >= 1 THEN res := 'partial'; rule := 'E1:sections=' || n;
    ELSE reason := 'no_section_visited'; END IF;
  ELSIF code = 'E2' THEN
    IF 'template_details_viewed' = ANY(ev) THEN res := 'partial'; rule := 'E2:template_opened_no_knowledge_check';
    ELSE reason := 'no_template_opened'; END IF;
  ELSIF code = 'E3' THEN
    IF EXISTS (SELECT 1 FROM public.applications WHERE earner_id = uid AND created_at BETWEEN t0 AND t1) THEN
      res := 'verified_success'; rule := 'E3:application_created_in_attempt';
    ELSE reason := 'no_application_in_attempt'; END IF;
  ELSIF code = 'E4' THEN
    IF NOT EXISTS (SELECT 1 FROM public.applications WHERE earner_id = uid) THEN reason := 'prerequisite_missing:no_application';
    ELSIF 'applications_viewed' = ANY(ev) THEN res := 'partial'; rule := 'E4:application_opened_no_knowledge_check';
    ELSE reason := 'applications_not_opened'; END IF;
  ELSIF code = 'E5' THEN
    IF NOT EXISTS (SELECT 1 FROM public.credentials WHERE earner_id = uid) THEN reason := 'prerequisite_missing:no_credential';
    ELSIF 'credential_details_viewed' = ANY(ev) THEN res := 'partial'; rule := 'E5:credential_opened_no_knowledge_check';
    ELSE reason := 'credential_not_opened'; END IF;
  ELSIF code = 'E6A' THEN
    IF EXISTS (SELECT 1 FROM public.credentials WHERE earner_id = uid AND accepted_at BETWEEN t0 AND t1) THEN
      res := 'verified_success'; rule := 'E6A:offer_accepted_in_attempt';
    ELSE reason := 'no_offer_accepted_in_attempt'; END IF;
  ELSIF code = 'E6B' THEN
    IF EXISTS (SELECT 1 FROM public.credentials WHERE earner_id = uid AND rejected_at BETWEEN t0 AND t1 AND coalesce(btrim(rejection_reason),'') <> '') THEN
      res := 'verified_success'; rule := 'E6B:offer_rejected_with_reason';
    ELSIF EXISTS (SELECT 1 FROM public.credentials WHERE earner_id = uid AND rejected_at BETWEEN t0 AND t1) THEN
      res := 'partial'; rule := 'E6B:offer_rejected_without_reason';
    ELSE reason := 'no_offer_rejected_in_attempt'; END IF;
  ELSIF code = 'E7A' THEN
    SELECT count(*) INTO n FROM public.evaluation_events WHERE attempt_id = _attempt_id AND event_type = 'visibility_updated';
    IF n >= 2 THEN res := 'verified_success'; rule := 'E7A:attribute_hidden_and_restored';
    ELSIF n = 1 THEN res := 'partial'; rule := 'E7A:attribute_changed_once';
    ELSE reason := 'no_attribute_change'; END IF;
  ELSIF code = 'E7B' THEN
    IF 'public_visibility_disabled' = ANY(ev) THEN res := 'partial'; rule := 'E7B:disabled_not_restored';
    ELSE reason := 'visibility_not_changed'; END IF;
  ELSIF code = 'E8' THEN
    IF 'share_link_copied' = ANY(ev) THEN res := 'partial'; rule := 'E8:link_copied_not_visited';
    ELSE reason := 'share_link_not_visited'; END IF;
  ELSIF code = 'E9' THEN
    IF 'share_link_copied' = ANY(ev) OR 'public_profile_viewed' = ANY(ev) THEN res := 'partial'; rule := 'E9:profile_viewed_link_not_visited';
    ELSE reason := 'share_link_not_visited'; END IF;
  ELSIF code = 'E10' THEN
    n := (CASE WHEN 'notification_opened' = ANY(ev) THEN 1 ELSE 0 END) + (CASE WHEN 'settings_viewed' = ANY(ev) THEN 1 ELSE 0 END);
    m := (CASE WHEN ev && ARRAY['notification_marked_read','setting_changed'] THEN 1 ELSE 0 END);
    IF n = 2 AND m = 1 THEN res := 'verified_success'; rule := 'E10:both_sections_and_action';
    ELSIF n >= 1 THEN res := 'partial'; rule := 'E10:sections=' || n || ',action=' || m;
    ELSE reason := 'sections_not_opened'; END IF;
  ELSIF code = 'E11' THEN
    reason := 'logout_not_recorded';
  END IF;

  IF res IS NOT NULL THEN
    UPDATE public.evaluation_attempts SET outcome = res, outcome_source = 'server', verification_rule = rule,
      not_assessed_reason = NULL, updated_at = now() WHERE id = _attempt_id;
    RETURN res;
  END IF;
  UPDATE public.evaluation_attempts SET not_assessed_reason = CASE WHEN outcome = 'not_assessed' THEN reason ELSE NULL END,
    verification_rule = coalesce(verification_rule, code || ':no_server_evidence') WHERE id = _attempt_id;
  RETURN (SELECT outcome FROM public.evaluation_attempts WHERE id = _attempt_id);
END $$;
GRANT EXECUTE ON FUNCTION public.eval_finalize_attempt(uuid) TO authenticated;
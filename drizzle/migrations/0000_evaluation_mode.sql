CREATE TABLE public.evaluation_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  role_scope text NOT NULL DEFAULT 'earner',
  version text NOT NULL DEFAULT 'v1',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  use_questionnaire_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.evaluation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.evaluation_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  consent_status text NOT NULL DEFAULT 'invited',
  anonymous_export_id text NOT NULL DEFAULT ('P-' || upper(substr(md5(gen_random_uuid()::text),1,8))),
  invited_at timestamptz NOT NULL DEFAULT now(),
  consented_at timestamptz,
  declined_at timestamptz,
  postponed_at timestamptz,
  finished_at timestamptz,
  disabled_at timestamptz,
  last_activity_at timestamptz,
  UNIQUE (campaign_id, user_id)
);
CREATE TABLE public.evaluation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.evaluation_assignments(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  platform_version text,
  device_category text
);
CREATE TABLE public.evaluation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'earner',
  code text NOT NULL,
  title_en text NOT NULL,
  title_sr text NOT NULL,
  situation_en text NOT NULL,
  situation_sr text NOT NULL,
  steps_en text[] NOT NULL DEFAULT '{}',
  steps_sr text[] NOT NULL DEFAULT '{}',
  success_en text NOT NULL,
  success_sr text NOT NULL,
  success_rule_key text NOT NULL DEFAULT 'self_report',
  start_path text,
  branch_group text,
  version text NOT NULL DEFAULT 'v1',
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (role, code, version)
);
CREATE TABLE public.evaluation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.evaluation_sessions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.evaluation_assignments(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.evaluation_scenarios(id),
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress',
  outcome text NOT NULL DEFAULT 'not_assessed',
  outcome_source text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_resumed_at timestamptz DEFAULT now(),
  active_duration_ms bigint NOT NULL DEFAULT 0,
  help_duration_ms bigint NOT NULL DEFAULT 0,
  help_count integer NOT NULL DEFAULT 0,
  instructor_help_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  feedback_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, scenario_id, attempt_number)
);
CREATE TABLE public.evaluation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_event_id text UNIQUE,
  assignment_id uuid NOT NULL REFERENCES public.evaluation_assignments(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.evaluation_sessions(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.evaluation_attempts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'client',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.evaluation_consent_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.evaluation_assignments(id) ON DELETE CASCADE,
  action text NOT NULL,
  policy_version text NOT NULL DEFAULT 'v1',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.evaluation_assignments(user_id);
CREATE INDEX ON public.evaluation_attempts(assignment_id);
CREATE INDEX ON public.evaluation_events(assignment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evaluation_sessions TO authenticated;
GRANT SELECT ON public.evaluation_scenarios TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evaluation_attempts TO authenticated;
GRANT SELECT, INSERT ON public.evaluation_events TO authenticated;
GRANT SELECT ON public.evaluation_consent_audit TO authenticated;
GRANT ALL ON public.evaluation_campaigns, public.evaluation_assignments, public.evaluation_sessions, public.evaluation_scenarios, public.evaluation_attempts, public.evaluation_events, public.evaluation_consent_audit TO service_role;

ALTER TABLE public.evaluation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_consent_audit ENABLE ROW LEVEL SECURITY;

-- helper: active, consented assignment owned by caller
CREATE OR REPLACE FUNCTION public.eval_owns_active_assignment(_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.evaluation_assignments a
    WHERE a.id = _assignment_id AND a.user_id = auth.uid() AND a.enabled AND a.consent_status = 'accepted');
$$;
CREATE OR REPLACE FUNCTION public.eval_owns_assignment(_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.evaluation_assignments a WHERE a.id = _assignment_id AND a.user_id = auth.uid());
$$;

CREATE POLICY ec_admin_all ON public.evaluation_campaigns FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY ec_participant_read ON public.evaluation_campaigns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluation_assignments a WHERE a.campaign_id = id AND a.user_id = auth.uid()));

CREATE POLICY ea_admin_all ON public.evaluation_assignments FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY ea_own_read ON public.evaluation_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY es_admin_read ON public.evaluation_sessions FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY es_own_read ON public.evaluation_sessions FOR SELECT TO authenticated USING (public.eval_owns_assignment(assignment_id));
CREATE POLICY es_own_insert ON public.evaluation_sessions FOR INSERT TO authenticated WITH CHECK (public.eval_owns_active_assignment(assignment_id));
CREATE POLICY es_own_update ON public.evaluation_sessions FOR UPDATE TO authenticated USING (public.eval_owns_assignment(assignment_id)) WITH CHECK (public.eval_owns_assignment(assignment_id));

CREATE POLICY esc_read ON public.evaluation_scenarios FOR SELECT TO authenticated USING (true);

CREATE POLICY eat_admin_read ON public.evaluation_attempts FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY eat_own_read ON public.evaluation_attempts FOR SELECT TO authenticated USING (public.eval_owns_assignment(assignment_id));
CREATE POLICY eat_own_insert ON public.evaluation_attempts FOR INSERT TO authenticated WITH CHECK (public.eval_owns_active_assignment(assignment_id));
CREATE POLICY eat_own_update ON public.evaluation_attempts FOR UPDATE TO authenticated USING (public.eval_owns_active_assignment(assignment_id)) WITH CHECK (public.eval_owns_active_assignment(assignment_id));

CREATE POLICY eev_admin_read ON public.evaluation_events FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY eev_own_read ON public.evaluation_events FOR SELECT TO authenticated USING (public.eval_owns_assignment(assignment_id));
CREATE POLICY eev_own_insert ON public.evaluation_events FOR INSERT TO authenticated WITH CHECK (public.eval_owns_active_assignment(assignment_id) AND source = 'client');

CREATE POLICY eca_admin_read ON public.evaluation_consent_audit FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY eca_own_read ON public.evaluation_consent_audit FOR SELECT TO authenticated USING (public.eval_owns_assignment(assignment_id));

-- Consent RPC (participant controls own consent; cannot bypass decline via admin enable)
CREATE OR REPLACE FUNCTION public.eval_set_consent(_assignment_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.evaluation_assignments;
BEGIN
  SELECT * INTO a FROM public.evaluation_assignments WHERE id = _assignment_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _action = 'accept' THEN
    IF NOT a.enabled THEN RAISE EXCEPTION 'Evaluation disabled'; END IF;
    UPDATE public.evaluation_assignments SET consent_status='accepted', consented_at=now(), last_activity_at=now() WHERE id=_assignment_id;
  ELSIF _action = 'postpone' THEN
    UPDATE public.evaluation_assignments SET postponed_at=now() WHERE id=_assignment_id AND consent_status='invited';
  ELSIF _action = 'decline' THEN
    UPDATE public.evaluation_assignments SET consent_status='declined', declined_at=now() WHERE id=_assignment_id;
  ELSIF _action = 'finish' THEN
    UPDATE public.evaluation_assignments SET consent_status='finished', finished_at=now() WHERE id=_assignment_id AND consent_status='accepted';
    UPDATE public.evaluation_sessions SET status='finished', finished_at=now() WHERE assignment_id=_assignment_id AND status='active';
  ELSIF _action = 'withdraw' THEN
    UPDATE public.evaluation_assignments SET consent_status='withdrawn', finished_at=now() WHERE id=_assignment_id;
    UPDATE public.evaluation_sessions SET status='withdrawn', finished_at=now() WHERE assignment_id=_assignment_id AND status='active';
  ELSE RAISE EXCEPTION 'Invalid action';
  END IF;
  INSERT INTO public.evaluation_consent_audit(assignment_id, action) VALUES (_assignment_id, _action);
END $$;
GRANT EXECUTE ON FUNCTION public.eval_set_consent(uuid, text) TO authenticated;

-- Server-verified outcomes. Never blocks the core operation.
CREATE OR REPLACE FUNCTION public.eval_record_verified(_user_id uuid, _code text, _event text, _success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT at.id AS attempt_id, at.session_id, at.assignment_id
    FROM public.evaluation_attempts at
    JOIN public.evaluation_assignments a ON a.id = at.assignment_id
    JOIN public.evaluation_scenarios s ON s.id = at.scenario_id
    WHERE a.user_id = _user_id AND a.enabled AND a.consent_status='accepted'
      AND s.code = _code AND at.status IN ('in_progress','paused')
  LOOP
    INSERT INTO public.evaluation_events(assignment_id, session_id, attempt_id, event_type, source, metadata)
    VALUES (r.assignment_id, r.session_id, r.attempt_id, _event, 'server', jsonb_build_object('scenario_code', _code));
    IF _success THEN
      UPDATE public.evaluation_attempts SET outcome='verified_success', outcome_source='server', updated_at=now() WHERE id = r.attempt_id;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'eval_record_verified failed: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.eval_record_verified(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.eval_on_application_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN PERFORM public.eval_record_verified(NEW.earner_id, 'E3', 'application_submitted', true);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
CREATE TRIGGER eval_application_insert AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.eval_on_application_insert();

CREATE OR REPLACE FUNCTION public.eval_on_credential_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE had_disable boolean;
BEGIN
  BEGIN
    IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
      PERFORM public.eval_record_verified(NEW.earner_id, 'E6A', 'credential_offer_accepted', true);
    END IF;
    IF OLD.rejected_at IS NULL AND NEW.rejected_at IS NOT NULL THEN
      PERFORM public.eval_record_verified(NEW.earner_id, 'E6B', 'credential_offer_rejected', true);
    END IF;
    IF OLD.share_is_public AND NOT NEW.share_is_public THEN
      PERFORM public.eval_record_verified(NEW.earner_id, 'E7B', 'public_visibility_disabled', false);
    ELSIF NOT OLD.share_is_public AND NEW.share_is_public THEN
      SELECT EXISTS (
        SELECT 1 FROM public.evaluation_events e
        JOIN public.evaluation_attempts at ON at.id = e.attempt_id
        JOIN public.evaluation_assignments a ON a.id = at.assignment_id
        JOIN public.evaluation_scenarios s ON s.id = at.scenario_id
        WHERE a.user_id = NEW.earner_id AND s.code='E7B' AND at.status IN ('in_progress','paused')
          AND e.event_type='public_visibility_disabled') INTO had_disable;
      PERFORM public.eval_record_verified(NEW.earner_id, 'E7B', 'public_visibility_enabled', coalesce(had_disable,false));
    END IF;
    IF OLD.share_show_grade IS DISTINCT FROM NEW.share_show_grade
       OR OLD.share_show_skills IS DISTINCT FROM NEW.share_show_skills
       OR OLD.share_show_source IS DISTINCT FROM NEW.share_show_source
       OR OLD.share_show_expiry IS DISTINCT FROM NEW.share_show_expiry
       OR OLD.share_show_level IS DISTINCT FROM NEW.share_show_level THEN
      PERFORM public.eval_record_verified(NEW.earner_id, 'E7A', 'visibility_updated', false);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
CREATE TRIGGER eval_credential_update AFTER UPDATE ON public.credentials
  FOR EACH ROW EXECUTE FUNCTION public.eval_on_credential_update();

INSERT INTO public.evaluation_scenarios (code, sort_order, success_rule_key, start_path, branch_group, title_en, title_sr, situation_en, situation_sr, steps_en, steps_sr, success_en, success_sr) VALUES
('E1',1,'self_report','/earner',NULL,'Explore the home page','Pregled početne strane','You have just signed in and want to get oriented on the platform.','Upravo ste se prijavili i želite da se snađete na platformi.',ARRAY['Look at the dashboard summary','Find the main sections in the left menu'],ARRAY['Pogledajte pregled na početnoj strani','Pronađite glavne sekcije u levom meniju'],'You found the main sections (credentials, applications, profile, notifications, settings).','Pronašli ste glavne sekcije (kredencijali, prijave, profil, obaveštenja, podešavanja).'),
('E2',2,'self_report','/earner/microcredential-templates',NULL,'Browse available micro-credentials','Pregled dostupnih mikrokredencijala','You want to see which micro-credentials you can earn.','Želite da vidite koje mikrokredencijale možete da steknete.',ARRAY['Open the catalog','Open the details of one micro-credential','Read its description and requirements'],ARRAY['Otvorite katalog','Otvorite detalje jednog mikrokredencijala','Pročitajte opis i uslove'],'You can describe the title, issuer and requirements.','Možete da navedete naziv, izdavaoca i uslove.'),
('E3',3,'server_application','/earner/microcredential-templates',NULL,'Submit an application','Podnošenje prijave','You want to apply for the test micro-credential.','Želite da se prijavite za testni mikrokredencijal.',ARRAY['Open the test micro-credential','Start the application','Submit it'],ARRAY['Otvorite testni mikrokredencijal','Pokrenite prijavu','Pošaljite prijavu'],'The application is saved (verified automatically).','Prijava je sačuvana (automatski provereno).'),
('E4',4,'self_report','/earner/applications',NULL,'Track application status','Praćenje statusa prijave','You want to know where your application stands.','Želite da znate u kom je stanju vaša prijava.',ARRAY['Open Applications','Find your application and its status'],ARRAY['Otvorite Prijave','Pronađite svoju prijavu i njen status'],'You can state the current status of the application.','Možete da navedete trenutni status prijave.'),
('E5',5,'self_report','/earner/credentials',NULL,'View an issued micro-credential','Pregled izdatog mikrokredencijala','You want to see the details of a credential you received.','Želite da vidite detalje kredencijala koji ste dobili.',ARRAY['Open My credentials','Open a credential','Find the issuer and status'],ARRAY['Otvorite Moje kredencijale','Otvorite kredencijal','Pronađite izdavaoca i status'],'You can state the issuer and status of the credential.','Možete da navedete izdavaoca i status kredencijala.'),
('E6A',6,'server_accept','/earner/credentials','E6','Accept an offered credential','Prihvatanje ponuđenog kredencijala','An issuer offered you a test credential and you want to accept it.','Izdavalac vam je ponudio testni kredencijal i želite da ga prihvatite.',ARRAY['Open the offered credential','Accept it'],ARRAY['Otvorite ponuđeni kredencijal','Prihvatite ga'],'The credential is accepted (verified automatically).','Kredencijal je prihvaćen (automatski provereno).'),
('E6B',7,'server_reject','/earner/credentials','E6','Reject an offered credential','Odbijanje ponuđenog kredencijala','You received a second test offer that you want to reject.','Dobili ste drugu testnu ponudu koju želite da odbijete.',ARRAY['Open the second offered credential','Reject it and state a reason'],ARRAY['Otvorite drugi ponuđeni kredencijal','Odbijte ga i navedite razlog'],'The credential is rejected (verified automatically). Use a different credential than in E6A.','Kredencijal je odbijen (automatski provereno). Koristite drugi kredencijal nego u E6A.'),
('E7A',8,'self_report','/earner/credentials',NULL,'Hide individual attributes','Vidljivost pojedinačnih atributa','You want to hide some details (e.g. grade) from the public view.','Želite da sakrijete neke detalje (npr. ocenu) iz javnog prikaza.',ARRAY['Open a credential','Change visibility of an attribute','Check the public view','Restore the option'],ARRAY['Otvorite kredencijal','Promenite vidljivost atributa','Proverite javni prikaz','Vratite opciju'],'The hidden attribute is not visible publicly and reappears after restoring.','Sakriveni atribut nije javno vidljiv i ponovo se pojavljuje nakon vraćanja.'),
('E7B',9,'server_visibility','/earner/credentials',NULL,'Hide a whole micro-credential','Sakrivanje celog mikrokredencijala','You want to temporarily hide a credential from the public.','Želite privremeno da sakrijete kredencijal od javnosti.',ARRAY['Turn off public visibility','Check the public page','Turn visibility back on'],ARRAY['Isključite javnu vidljivost','Proverite javnu stranicu','Ponovo uključite vidljivost'],'Visibility was disabled and re-enabled (verified automatically).','Vidljivost je isključena pa ponovo uključena (automatski provereno).'),
('E8',10,'self_report','/earner/credentials',NULL,'Share and verify publicly','Deljenje i javna verifikacija','You want to send a credential to an employer.','Želite da pošaljete kredencijal poslodavcu.',ARRAY['Copy the share link','Open it in a new window','Run the verification'],ARRAY['Kopirajte link za deljenje','Otvorite ga u novom prozoru','Pokrenite verifikaciju'],'The public page shows the verification result.','Javna stranica prikazuje rezultat verifikacije.'),
('E9',11,'self_report','/earner/profile',NULL,'View your public profile','Pregled javnog profila','You want to see how others see your profile.','Želite da vidite kako drugi vide vaš profil.',ARRAY['Open Public profile','Open the public link'],ARRAY['Otvorite Javni profil','Otvorite javni link'],'You can say what is visible publicly.','Možete da kažete šta je javno vidljivo.'),
('E10',12,'self_report','/earner/notifications',NULL,'Notifications and settings','Obaveštenja i podešavanja','You want to check notifications and adjust settings.','Želite da proverite obaveštenja i podesite nalog.',ARRAY['Open Notifications','Open Settings'],ARRAY['Otvorite Obaveštenja','Otvorite Podešavanja'],'You understand what both sections are for.','Razumete čemu služe obe sekcije.'),
('E11',13,'logout','/earner',NULL,'Sign out','Odjava sa platforme','You finished working and want to sign out safely.','Završili ste rad i želite bezbedno da se odjavite.',ARRAY['Sign out via the menu in the top right'],ARRAY['Odjavite se preko menija u gornjem desnom uglu'],'You are signed out and protected pages are no longer accessible.','Odjavljeni ste i zaštićene stranice više nisu dostupne.');

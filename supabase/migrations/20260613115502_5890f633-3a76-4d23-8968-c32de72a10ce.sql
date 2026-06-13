
-- 2. template_assignees junction table
CREATE TABLE public.template_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, user_id)
);
CREATE INDEX template_assignees_user_idx ON public.template_assignees(user_id);
CREATE INDEX template_assignees_template_idx ON public.template_assignees(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_assignees TO authenticated;
GRANT ALL ON public.template_assignees TO service_role;

ALTER TABLE public.template_assignees ENABLE ROW LEVEL SECURITY;

-- helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_template_assignee(_user_id uuid, _template_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.template_assignees
    WHERE user_id = _user_id AND template_id = _template_id
  )
$$;

-- helper: issuer org for a template
CREATE OR REPLACE FUNCTION public.template_issuer_org(_template_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT issuer_id FROM public.templates WHERE id = _template_id $$;

CREATE POLICY "ta_select" ON public.template_assignees
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin', public.template_issuer_org(template_id))
  );

CREATE POLICY "ta_insert_admin" ON public.template_assignees
  FOR INSERT WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin', public.template_issuer_org(template_id))
  );

CREATE POLICY "ta_delete_admin" ON public.template_assignees
  FOR DELETE USING (
    public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin', public.template_issuer_org(template_id))
  );

-- 3. Update applications policies to include issuer_staff via assignment
DROP POLICY IF EXISTS apps_select ON public.applications;
CREATE POLICY apps_select ON public.applications FOR SELECT USING (
  earner_id = auth.uid()
  OR has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  OR is_platform_admin(auth.uid())
  OR public.is_template_assignee(auth.uid(), template_id)
);

DROP POLICY IF EXISTS apps_update ON public.applications;
CREATE POLICY apps_update ON public.applications FOR UPDATE USING (
  earner_id = auth.uid()
  OR has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  OR is_platform_admin(auth.uid())
  OR public.is_template_assignee(auth.uid(), template_id)
);

-- 4. Update credentials policies
DROP POLICY IF EXISTS creds_select ON public.credentials;
CREATE POLICY creds_select ON public.credentials FOR SELECT USING (
  earner_id = auth.uid()
  OR has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  OR is_platform_admin(auth.uid())
  OR public.is_template_assignee(auth.uid(), template_id)
);

DROP POLICY IF EXISTS creds_insert_issuer ON public.credentials;
CREATE POLICY creds_insert_issuer ON public.credentials FOR INSERT WITH CHECK (
  has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  OR is_platform_admin(auth.uid())
  OR public.is_template_assignee(auth.uid(), template_id)
);

DROP POLICY IF EXISTS creds_update_issuer_or_earner ON public.credentials;
CREATE POLICY creds_update_issuer_or_earner ON public.credentials FOR UPDATE USING (
  earner_id = auth.uid()
  OR has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  OR is_platform_admin(auth.uid())
  OR public.is_template_assignee(auth.uid(), template_id)
);

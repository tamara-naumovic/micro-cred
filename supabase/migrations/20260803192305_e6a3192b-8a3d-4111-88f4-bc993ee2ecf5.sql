CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _profile_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('issuer_admin','issuer_staff')
        AND me.organization_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM public.earner_institutions ei
            WHERE ei.earner_id = _profile_id
              AND ei.organization_id = me.organization_id
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles other
            WHERE other.user_id = _profile_id
              AND other.organization_id = me.organization_id
          )
          OR EXISTS (
            SELECT 1 FROM public.applications a
            WHERE a.earner_id = _profile_id
              AND a.issuer_id = me.organization_id
          )
          OR EXISTS (
            SELECT 1 FROM public.credentials c
            WHERE c.earner_id = _profile_id
              AND c.issuer_id = me.organization_id
          )
        )
    )
$$;

DROP POLICY IF EXISTS profiles_select_staff ON public.profiles;

CREATE POLICY profiles_select_staff ON public.profiles
FOR SELECT TO authenticated
USING (public.can_view_profile(id));
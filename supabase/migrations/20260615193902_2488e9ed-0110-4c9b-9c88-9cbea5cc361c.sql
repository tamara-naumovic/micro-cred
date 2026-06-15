DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;

CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_select_staff
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR public.has_role(auth.uid(), 'issuer_admin')
  OR public.has_role(auth.uid(), 'issuer_staff')
);
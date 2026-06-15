DROP POLICY IF EXISTS "regreq_insert_anyone" ON public.registration_requests;

CREATE POLICY regreq_insert_platform_admin
  ON public.registration_requests FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

REVOKE INSERT ON public.registration_requests FROM anon;
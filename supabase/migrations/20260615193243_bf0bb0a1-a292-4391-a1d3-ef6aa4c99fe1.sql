DROP POLICY IF EXISTS accreditation_docs_insert_auth ON storage.objects;
DROP POLICY IF EXISTS accreditation_docs_update_auth ON storage.objects;
DROP POLICY IF EXISTS accreditation_docs_delete_auth ON storage.objects;

CREATE POLICY accreditation_docs_insert_admins ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'accreditation-docs'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_role_in_org(auth.uid(), 'issuer_admin'::public.app_role, ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY accreditation_docs_update_admins ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'accreditation-docs'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_role_in_org(auth.uid(), 'issuer_admin'::public.app_role, ((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'accreditation-docs'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_role_in_org(auth.uid(), 'issuer_admin'::public.app_role, ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY accreditation_docs_delete_admins ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'accreditation-docs'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_role_in_org(auth.uid(), 'issuer_admin'::public.app_role, ((storage.foldername(name))[1])::uuid)
    )
  );
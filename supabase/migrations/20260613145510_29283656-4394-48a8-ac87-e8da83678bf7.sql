
CREATE POLICY "qa_docs_issuer_admin_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'qa-documents' AND (
    public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "qa_docs_issuer_admin_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'qa-documents' AND (
    public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "qa_docs_issuer_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'qa-documents' AND (
    public.is_platform_admin(auth.uid())
    OR public.has_role_in_org(auth.uid(), 'issuer_admin'::app_role, ((storage.foldername(name))[1])::uuid)
  )
);

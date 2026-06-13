
CREATE POLICY "accreditation_docs_read_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'accreditation-docs');
CREATE POLICY "accreditation_docs_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'accreditation-docs');
CREATE POLICY "accreditation_docs_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'accreditation-docs');
CREATE POLICY "accreditation_docs_delete_auth" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'accreditation-docs');

DROP POLICY IF EXISTS qa_docs_issuer_admin_select ON storage.objects;

CREATE POLICY "qa_docs_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'qa-documents');
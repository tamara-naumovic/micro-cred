## Problem
Storage bucket `qa-documents` (where micro-credential QA / accreditation documents are stored) has a SELECT policy that only allows platform admins and issuer admins of the owning org. Other logged-in users (earners, issuer staff from other orgs) get denied when trying to download.

## Change
One database migration that replaces the SELECT policy on `qa-documents` so any authenticated user can read objects from that bucket. INSERT / UPDATE / DELETE policies stay restricted to issuer admins / platform admins (only they can manage documents).

```sql
DROP POLICY IF EXISTS qa_docs_issuer_admin_select ON storage.objects;

CREATE POLICY "qa_docs_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'qa-documents');
```

## Out of scope
- `accreditation-docs` bucket — its SELECT policy is already public.
- No frontend changes; download flow already uses signed URLs which will start working for all signed-in users.

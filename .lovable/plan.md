## Plan: Ignore accreditation_docs_public_read finding

1. Mark `accreditation_docs_public_read` (scanner: `supabase_lov`) as **ignored** with explanation: bucket is intentionally public via signed URLs to support public organization verification on `/issuers/$id`.
2. Update security memory (`security--update_memory`) to document:
   - `accreditation-docs` bucket is intentionally public-readable (verification flow)
   - Accreditation certificates are public documents by nature
   - Future scans should not re-flag this pattern

No code or migration changes.
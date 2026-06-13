
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS qa_type text NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS qa_document_path text,
  ADD COLUMN IF NOT EXISTS prerequisites_none boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supervision_type text,
  ADD COLUMN IF NOT EXISTS stackability_type text;

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_qa_type_check,
  ADD CONSTRAINT templates_qa_type_check
    CHECK (qa_type IN ('internal','external','internal_and_external','other','not_specified'));

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_supervision_type_check,
  ADD CONSTRAINT templates_supervision_type_check
    CHECK (supervision_type IS NULL OR supervision_type IN (
      'unsupervised_no_id',
      'supervised_no_id',
      'supervised_online_with_id',
      'supervised_onsite_with_id'
    ));

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_stackability_type_check,
  ADD CONSTRAINT templates_stackability_type_check
    CHECK (stackability_type IS NULL OR stackability_type IN ('stand_alone','stackable'));

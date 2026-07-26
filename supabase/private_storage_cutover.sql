-- QuickAdmissionGH private storage cutover
-- Run only after the deployed frontend/Edge Functions include storage path support.
-- This makes student uploaded enrolment forms/passport photos non-public.

update storage.buckets
set public = false
where id = 'enrolment-forms';

-- Keep school documents public only if they are intended for students to download directly.
-- If school documents include private files, make this bucket private too and serve documents
-- through signed URLs.
-- update storage.buckets
-- set public = false
-- where id = 'school-docs';

-- Verify bucket status after cutover.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('enrolment-forms', 'school-docs')
order by id;

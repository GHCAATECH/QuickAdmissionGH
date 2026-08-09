-- Student uploads now pass through the student-upload Edge Function.
-- Authenticated school administrators keep their existing storage policies.
revoke insert, update, delete on table storage.objects from anon;

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png']::text[]
where id = 'enrolment-forms';

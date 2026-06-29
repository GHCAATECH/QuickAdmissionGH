-- Creates the required Supabase Storage buckets for the Multi-School
-- Management System. Safe to run more than once.
--
-- If your Supabase project blocks direct SQL writes to storage.buckets,
-- create these manually from Storage > New bucket instead.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('school-logos', 'school-logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('student-photos', 'student-photos', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('staff-photos', 'staff-photos', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('documents', 'documents', true, 52428800, array['application/pdf','image/png','image/jpeg','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv']),
  ('clearance-certificates', 'clearance-certificates', true, 52428800, array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

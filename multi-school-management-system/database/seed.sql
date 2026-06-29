-- Run this only after:
-- 1. database/schema.sql has completed successfully.
-- 2. database/rls-policies.sql has completed successfully.
-- 3. You have created the first Super Admin user in Supabase Auth.
--
-- Replace the email below with that Auth user's email.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles does not exist. Run database/schema.sql before running seed.sql.';
  end if;
end $$;

update public.profiles
set role = 'Super Admin', status = 'Active'
where email = 'replace-with-super-admin-email@example.com';

insert into public.permissions (module, action, status)
values
  ('schools', 'manage', 'Active'),
  ('students', 'manage', 'Active'),
  ('staff', 'manage', 'Active'),
  ('results', 'publish', 'Active'),
  ('documents', 'manage', 'Active'),
  ('announcements', 'manage', 'Active'),
  ('clearance', 'approve', 'Active'),
  ('sms', 'send', 'Active')
on conflict do nothing;

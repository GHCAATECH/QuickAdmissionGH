-- Manual fallback when you cannot deploy the create-user Edge Function.
--
-- 1. Create the user in Supabase Dashboard > Authentication > Users.
-- 2. Create/select the school in the Super Admin dashboard or schools table.
-- 3. Replace the values below, then run this SQL.

with selected_school as (
  select id
  from public.schools
  where school_code = 'REPLACE_WITH_SCHOOL_CODE'
  limit 1
),
selected_user as (
  select id, email, raw_user_meta_data
  from auth.users
  where email = 'schooladmin@example.com'
  limit 1
)
insert into public.profiles (id, school_id, role, full_name, email, phone, status)
select
  selected_user.id,
  selected_school.id,
  'School Administrator',
  coalesce(selected_user.raw_user_meta_data->>'full_name', selected_user.email),
  selected_user.email,
  null,
  'Active'
from selected_user, selected_school
on conflict (id) do update
set
  school_id = excluded.school_id,
  role = 'School Administrator',
  full_name = excluded.full_name,
  email = excluded.email,
  status = 'Active',
  updated_at = now();

select
  p.id,
  p.email,
  p.role,
  p.status,
  s.school_name,
  s.school_code
from public.profiles p
left join public.schools s on s.id = p.school_id
where p.email = 'schooladmin@example.com';

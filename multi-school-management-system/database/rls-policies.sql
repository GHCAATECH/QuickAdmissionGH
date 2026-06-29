create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.get_current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'Super Admin'
$$;

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'School Administrator'
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() in ('School Administrator','Management Staff','House Staff','Teaching Staff','Non-Teaching Staff')
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'Student'
$$;

grant usage on schema public to anon, authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'schools','profiles','roles','permissions','role_permissions','classes','programmes','houses','departments','subjects',
    'students','staff','grading_systems','assessments','results','transcripts','documents','announcements','sms_settings','sms_logs',
    'clearance_workflows','clearance_categories','clearance_officers','clearance_requests','clearance_approvals','clearance_logs',
    'assignments','attendance','scheme_of_work','lesson_notes','school_settings','system_settings','audit_logs','login_history','school_statistics'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

drop policy if exists "super admin manages schools" on public.schools;
drop policy if exists "school users view their school" on public.schools;

create policy "super admin manages schools"
on public.schools
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "school users view their school"
on public.schools
for select
to authenticated
using (id = public.get_current_school_id() or public.is_super_admin());

drop policy if exists "users view profiles" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "authorized create profiles" on public.profiles;

create policy "users view profiles"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
  or (school_id = public.get_current_school_id() and public.is_staff())
);

create policy "users update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_super_admin() or public.is_school_admin())
with check (id = auth.uid() or public.is_super_admin() or school_id = public.get_current_school_id());

create policy "authorized create profiles"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_super_admin() or school_id = public.get_current_school_id());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roles','permissions','role_permissions','classes','programmes','houses','departments','subjects',
    'staff','grading_systems','assessments','sms_settings','sms_logs','clearance_workflows','clearance_categories',
    'clearance_officers','clearance_approvals','clearance_logs','assignments','attendance','scheme_of_work',
    'lesson_notes','school_settings','audit_logs','login_history','school_statistics'
  ]
  loop
    execute format('drop policy if exists "super admin full access %1$I" on public.%1$I', table_name);
    execute format('drop policy if exists "school staff full access %1$I" on public.%1$I', table_name);
    execute format('drop policy if exists "school users read %1$I" on public.%1$I', table_name);
    execute format('create policy "super admin full access %1$I" on public.%1$I for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', table_name);
    execute format('create policy "school staff full access %1$I" on public.%1$I for all to authenticated using (school_id = public.get_current_school_id() and public.is_staff()) with check (school_id = public.get_current_school_id() and public.is_staff())', table_name);
    execute format('create policy "school users read %1$I" on public.%1$I for select to authenticated using (school_id = public.get_current_school_id())', table_name);
  end loop;
end $$;

drop policy if exists "super admin system settings" on public.system_settings;
create policy "super admin system settings"
on public.system_settings
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "student records school access" on public.students;
drop policy if exists "students view self" on public.students;

create policy "student records school access"
on public.students
for all
to authenticated
using (public.is_super_admin() or (school_id = public.get_current_school_id() and public.is_staff()))
with check (public.is_super_admin() or (school_id = public.get_current_school_id() and public.is_staff()));

create policy "students view self"
on public.students
for select
to authenticated
using (profile_id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array['results','transcripts','documents','announcements','clearance_requests']
  loop
    execute format('drop policy if exists "super and school access %1$I" on public.%1$I', table_name);
    execute format('drop policy if exists "students own access %1$I" on public.%1$I', table_name);
    execute format('create policy "super and school access %1$I" on public.%1$I for all to authenticated using (public.is_super_admin() or school_id = public.get_current_school_id()) with check (public.is_super_admin() or school_id = public.get_current_school_id())', table_name);
  end loop;
end $$;

create policy "students own access results"
on public.results
for select
to authenticated
using (exists (select 1 from public.students s where s.id = results.student_id and s.profile_id = auth.uid()));

create policy "students own access transcripts"
on public.transcripts
for select
to authenticated
using (exists (select 1 from public.students s where s.id = transcripts.student_id and s.profile_id = auth.uid()));

create policy "students own access clearance_requests"
on public.clearance_requests
for select
to authenticated
using (exists (select 1 from public.students s where s.id = clearance_requests.student_id and s.profile_id = auth.uid()));

create policy "students create own clearance_requests"
on public.clearance_requests
for insert
to authenticated
with check (exists (select 1 from public.students s where s.id = clearance_requests.student_id and s.profile_id = auth.uid() and s.school_id = clearance_requests.school_id));

drop policy if exists "storage authenticated read" on storage.objects;
drop policy if exists "storage authenticated upload" on storage.objects;
drop policy if exists "storage authenticated update" on storage.objects;
drop policy if exists "storage authenticated delete" on storage.objects;

create policy "storage authenticated read"
on storage.objects
for select
to authenticated
using (bucket_id in ('school-logos','student-photos','staff-photos','documents','clearance-certificates'));

create policy "storage authenticated upload"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('school-logos','student-photos','staff-photos','documents','clearance-certificates'));

create policy "storage authenticated update"
on storage.objects
for update
to authenticated
using (bucket_id in ('school-logos','student-photos','staff-photos','documents','clearance-certificates'))
with check (bucket_id in ('school-logos','student-photos','staff-photos','documents','clearance-certificates'));

create policy "storage authenticated delete"
on storage.objects
for delete
to authenticated
using (public.is_super_admin() or public.is_staff());

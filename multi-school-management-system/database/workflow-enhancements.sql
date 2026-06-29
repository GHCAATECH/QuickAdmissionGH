-- Optional workflow enhancement fields for the full-feature UI.
-- Safe to run more than once after schema.sql.

alter table public.students add column if not exists promotion_notes text;
alter table public.students add column if not exists transfer_notes text;
alter table public.students add column if not exists graduation_date date;

alter table public.staff add column if not exists privilege_notes text;
alter table public.staff add column if not exists subject_notes text;

alter table public.documents add column if not exists target_notes text;
alter table public.announcements add column if not exists sms_status text;
alter table public.clearance_requests add column if not exists override_reason text;

create table if not exists public.user_workflow_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  requested_role text,
  requested_email text,
  requested_name text,
  action text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Pending'
);

alter table public.user_workflow_requests enable row level security;
grant select, insert, update, delete on public.user_workflow_requests to authenticated;

drop policy if exists "super admin workflow requests" on public.user_workflow_requests;
drop policy if exists "school staff workflow requests" on public.user_workflow_requests;

create policy "super admin workflow requests"
on public.user_workflow_requests
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "school staff workflow requests"
on public.user_workflow_requests
for all
to authenticated
using (school_id = public.get_current_school_id() and public.is_staff())
with check (school_id = public.get_current_school_id() and public.is_staff());

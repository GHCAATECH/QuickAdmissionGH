create extension if not exists pgcrypto with schema extensions;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  school_name text not null,
  school_code text not null unique,
  logo_url text,
  address text,
  gps_address text,
  phone text,
  email text,
  website text,
  sms_sender_id text,
  academic_year text,
  subscription_plan text default 'Trial',
  subscription_expires_at date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  role text not null check (role in ('Super Admin','School Administrator','Management Staff','House Staff','Teaching Staff','Non-Teaching Staff','Student')),
  full_name text,
  email text,
  phone text,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active',
  unique (school_id, name)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  module text not null,
  action text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active',
  unique (school_id, module, action)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  permission_id uuid references public.permissions(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active',
  unique (role_id, permission_id)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  level text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  code text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  house_master text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  head_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  code text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  programme_id uuid references public.programmes(id) on delete set null,
  house_id uuid references public.houses(id) on delete set null,
  full_name text not null,
  student_id text not null,
  gender text,
  residential_status text check (residential_status in ('Day','Boarding')),
  academic_year text,
  phone text,
  email text,
  photo_url text,
  admission_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active',
  unique (school_id, student_id)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  full_name text not null,
  staff_id text not null,
  role text not null,
  position text,
  rank text,
  gender text,
  phone text,
  email text,
  photo_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active',
  unique (school_id, staff_id)
);

create table if not exists public.grading_systems (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  grade text not null,
  min_score numeric not null,
  max_score numeric not null,
  remark text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  term text,
  academic_year text,
  score numeric,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Draft'
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  term text,
  academic_year text,
  score numeric,
  grade text,
  remarks text,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Draft'
);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade,
  transcript_url text,
  generated_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Generated'
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  title text not null,
  category text,
  assigned_to text,
  assigned_id uuid,
  file_url text,
  storage_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  title text not null,
  message text not null,
  audience text not null,
  scheduled_at timestamptz,
  send_sms boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Published'
);

create table if not exists public.sms_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null unique,
  sender_id text,
  api_key text,
  api_secret text,
  balance numeric default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  recipient text,
  message text,
  sms_type text,
  provider_response jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Queued'
);

create table if not exists public.clearance_workflows (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.clearance_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  workflow_id uuid references public.clearance_workflows(id) on delete set null,
  name text not null,
  workflow_order int default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.clearance_officers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  category_id uuid references public.clearance_categories(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.clearance_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade,
  academic_year text,
  final_status text default 'Pending',
  verification_number text unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  qr_code_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Pending'
);

create table if not exists public.clearance_approvals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  request_id uuid references public.clearance_requests(id) on delete cascade,
  category_id uuid references public.clearance_categories(id) on delete cascade,
  officer_id uuid references public.staff(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  remarks text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Pending'
);

create table if not exists public.clearance_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  request_id uuid references public.clearance_requests(id) on delete cascade,
  action text not null,
  remarks text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  file_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Published'
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  attendance_date date not null default current_date,
  attendance_status text not null default 'Present',
  remarks text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.scheme_of_work (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  term text,
  week text,
  topic text not null,
  content text,
  file_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  topic text not null,
  lesson_date date,
  notes text,
  file_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Draft'
);

create table if not exists public.school_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null unique,
  helpdesk_phone text,
  helpdesk_email text,
  grading_notes text,
  academic_year text,
  dark_mode_default boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  setting_key text not null unique,
  setting_value text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_name text,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  role text,
  login_at timestamptz default now(),
  user_agent text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Success'
);

create table if not exists public.school_statistics (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  metric text,
  value numeric,
  group_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz,
  status text default 'Active'
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', table_name || '_touch_updated_at', table_name);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, school_id, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'Student'),
    nullif(new.raw_user_meta_data->>'school_id', '')::uuid,
    'Active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

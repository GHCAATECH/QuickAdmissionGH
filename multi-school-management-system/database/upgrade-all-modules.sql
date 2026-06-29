-- Adds the remaining operational modules after the base schema is installed.
-- Safe to run more than once.

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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'school_settings','grading_systems','assignments','attendance','scheme_of_work','lesson_notes','login_history'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', table_name || '_touch_updated_at', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'school_settings','grading_systems','assignments','attendance','scheme_of_work','lesson_notes','login_history'
  ]
  loop
    execute format('drop policy if exists "super admin full access %1$I" on public.%1$I', table_name);
    execute format('drop policy if exists "school staff access %1$I" on public.%1$I', table_name);
    execute format('drop policy if exists "school users read %1$I" on public.%1$I', table_name);
    execute format('create policy "super admin full access %1$I" on public.%1$I for all using (public.is_super_admin()) with check (public.is_super_admin())', table_name);
    execute format('create policy "school staff access %1$I" on public.%1$I for all using (school_id = public.get_current_school_id() and public.is_staff()) with check (school_id = public.get_current_school_id() and public.is_staff())', table_name);
    execute format('create policy "school users read %1$I" on public.%1$I for select using (school_id = public.get_current_school_id())', table_name);
  end loop;
end $$;


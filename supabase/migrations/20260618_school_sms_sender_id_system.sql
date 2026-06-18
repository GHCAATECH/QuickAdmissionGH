-- QuickAdmissionGH - School SMS Sender ID / Arkesel support
-- Target: Supabase Postgres
-- Notes:
-- - This project already uses public.schools, public.students and direct Supabase auth.
-- - We keep the legacy public.code field intact, but add public.school_code as the
--   dedicated per-school SMS sender ID and keep the frontend writing both values.

create extension if not exists pgcrypto;

create or replace function public.normalize_school_code(p_value text)
returns varchar(11)
language sql
immutable
as $$
  select left(trim(regexp_replace(regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9 ]', '', 'g'), '\s+', ' ', 'g')), 11)::varchar(11);
$$;

alter table public.schools
  add column if not exists school_code varchar(11);

do $$
declare
  rec record;
  base_code text;
  candidate text;
  suffix_no integer;
begin
  for rec in
    select id, code, name, school_code
    from public.schools
    order by created_at nulls first, name, id
  loop
    candidate := public.normalize_school_code(
      coalesce(
        nullif(rec.school_code, ''),
        nullif(rec.code, ''),
        nullif(regexp_replace(upper(coalesce(rec.name, '')), '[^A-Z0-9]', '', 'g'), ''),
        'SCH'
      )
    );

    if candidate = '' then
      candidate := 'SCH';
    end if;

    base_code := candidate;
    suffix_no := 1;

    while exists (
      select 1
      from public.schools s
      where s.id <> rec.id
        and upper(coalesce(s.school_code, '')) = candidate
    ) loop
      candidate := left(base_code, greatest(1, 11 - length(suffix_no::text))) || suffix_no::text;
      suffix_no := suffix_no + 1;
    end loop;

    update public.schools
    set school_code = candidate
    where id = rec.id
      and coalesce(school_code, '') <> candidate;
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schools_school_code_format_chk'
  ) then
    alter table public.schools
      add constraint schools_school_code_format_chk
      check (school_code ~ '^[A-Z0-9]+( [A-Z0-9]+)*$');
  end if;
end
$$;

alter table public.schools
  alter column school_code set not null;

create unique index if not exists schools_school_code_key
  on public.schools (school_code);

create table if not exists public.school_sms_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  submission_message text not null default 'Congratulations {student_name}. Your admission application has been successfully submitted to {school_name}.',
  sms_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists school_sms_templates_set_updated_at on public.school_sms_templates;
create trigger school_sms_templates_set_updated_at
before update on public.school_sms_templates
for each row
execute function public.set_updated_at();

insert into public.school_sms_templates (school_id)
select s.id
from public.schools s
where not exists (
  select 1
  from public.school_sms_templates t
  where t.school_id = s.id
);

alter table public.students
  add column if not exists submission_sms_sent boolean not null default false;

alter table public.students
  add column if not exists submission_sms_status text;

alter table public.students
  add column if not exists submission_sms_sent_at timestamptz;

alter table public.students
  add column if not exists submission_sms_last_error text;

create table if not exists public.sms_logs (
  id bigserial primary key,
  school_id uuid references public.schools(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  recipient_group text,
  recipients integer not null default 1,
  phone varchar(20),
  sender_id varchar(11),
  message text not null,
  status varchar(50) not null default 'pending',
  sent_by text,
  template_name text,
  api_response jsonb,
  external_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sms_logs_school_id_idx on public.sms_logs (school_id);
create index if not exists sms_logs_student_id_idx on public.sms_logs (student_id);
create index if not exists sms_logs_sent_at_idx on public.sms_logs (sent_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'sms_log'
  )
  and exists (select 1 from public.sms_log limit 1)
  and not exists (select 1 from public.sms_logs limit 1) then
    insert into public.sms_logs (
      school_id,
      recipient_group,
      recipients,
      message,
      status,
      sent_by,
      sent_at,
      created_at
    )
    select
      school_id,
      recipient_group,
      coalesce(recipients, 1),
      coalesce(message, ''),
      coalesce(status, 'pending'),
      sent_by,
      coalesce(sent_at, now()),
      coalesce(sent_at, now())
    from public.sms_log;
  end if;
end
$$;

alter table public.school_sms_templates enable row level security;
alter table public.sms_logs enable row level security;

drop policy if exists school_sms_templates_select_policy on public.school_sms_templates;
create policy school_sms_templates_select_policy
on public.school_sms_templates
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'school_admin' and p.school_id = school_sms_templates.school_id)
      )
  )
);

drop policy if exists school_sms_templates_insert_policy on public.school_sms_templates;
create policy school_sms_templates_insert_policy
on public.school_sms_templates
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'school_admin' and p.school_id = school_sms_templates.school_id)
      )
  )
);

drop policy if exists school_sms_templates_update_policy on public.school_sms_templates;
create policy school_sms_templates_update_policy
on public.school_sms_templates
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'school_admin' and p.school_id = school_sms_templates.school_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'school_admin' and p.school_id = school_sms_templates.school_id)
      )
  )
);

drop policy if exists sms_logs_select_policy on public.sms_logs;
create policy sms_logs_select_policy
on public.sms_logs
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'school_admin' and p.school_id = sms_logs.school_id)
      )
  )
);

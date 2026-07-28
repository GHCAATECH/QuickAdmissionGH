create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  school_id uuid references public.schools(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.background_jobs enable row level security;
revoke all on table public.background_jobs from public, anon, authenticated;
create index if not exists background_jobs_ready_idx
  on public.background_jobs (job_type, status, available_at, created_at);
create index if not exists background_jobs_school_idx
  on public.background_jobs (school_id, created_at desc);

create or replace function public.claim_background_jobs(
  p_job_type text,
  p_limit integer default 10
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.background_jobs;
begin
  for v_job in
    select * from public.background_jobs
    where job_type = p_job_type
      and status = 'pending'
      and available_at <= now()
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  loop
    update public.background_jobs
    set status = 'running', attempts = attempts + 1, locked_at = now(), updated_at = now()
    where id = v_job.id
    returning * into v_job;
    return next v_job;
  end loop;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;

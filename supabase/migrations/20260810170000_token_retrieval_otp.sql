-- One-time verification challenges for admission-token retrieval.
-- Only Edge Functions using the service role may read or write these records.
create table if not exists public.token_retrieval_otps (
  id uuid primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  index_number text not null,
  code_hash text not null,
  phone_last_two varchar(2) not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists token_retrieval_otps_student_idx
  on public.token_retrieval_otps (school_id, index_number, created_at desc);

create unique index if not exists token_retrieval_otps_one_active_idx
  on public.token_retrieval_otps (school_id, index_number)
  where consumed_at is null;

create index if not exists token_retrieval_otps_expiry_idx
  on public.token_retrieval_otps (expires_at)
  where consumed_at is null;

alter table public.token_retrieval_otps enable row level security;

revoke all on table public.token_retrieval_otps from public;
revoke all on table public.token_retrieval_otps from anon;
revoke all on table public.token_retrieval_otps from authenticated;
grant all on table public.token_retrieval_otps to service_role;

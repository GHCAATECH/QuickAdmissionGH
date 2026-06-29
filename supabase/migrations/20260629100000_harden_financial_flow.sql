-- Keep one canonical row for any historical duplicate Paystack reference.
with ranked_payments as (
  select
    id,
    row_number() over (
      partition by reference
      order by coalesce(paid_at, created_at) asc, id asc
    ) as duplicate_number
  from public.payments
  where nullif(trim(reference), '') is not null
)
delete from public.payments p
using ranked_payments r
where p.id = r.id
  and r.duplicate_number > 1;

create unique index if not exists payments_reference_unique_idx
  on public.payments (reference)
  where nullif(trim(reference), '') is not null;

create table if not exists public.finance_claims (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  claim_number integer not null check (claim_number > 0),
  students_claimed integer not null check (students_claimed > 0),
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, claim_number)
);

alter table public.finance_claims enable row level security;
revoke insert, update, delete on public.finance_claims from anon, authenticated;
grant select on public.finance_claims to authenticated;

drop policy if exists finance_claims_read_authorized on public.finance_claims;
create policy finance_claims_read_authorized
  on public.finance_claims
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'super_admin'
          or (p.role = 'school_admin' and p.school_id = finance_claims.school_id)
        )
    )
  );

create or replace function public.apply_finance_claim(
  p_school_id uuid,
  p_claim_students integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_settled integer := 0;
  v_claim_count integer := 0;
  v_completed integer := 0;
  v_due integer := 0;
  v_next_claim integer := 0;
  v_now timestamptz := now();
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if coalesce(v_role, '') <> 'super_admin' then
    raise exception 'Only a super admin can record a financial claim.'
      using errcode = '42501';
  end if;

  if p_school_id is null or coalesce(p_claim_students, 0) <= 0 then
    raise exception 'A school and a positive student count are required.'
      using errcode = '22023';
  end if;

  select
    greatest(coalesce(finance_settled_students, 0), 0),
    greatest(coalesce(finance_claim_count, 0), 0)
  into v_settled, v_claim_count
  from public.school_config
  where school_id = p_school_id
  for update;

  if not found then
    raise exception 'Financial configuration was not found for this school.'
      using errcode = 'P0002';
  end if;

  select count(*) into v_completed
  from (
    select distinct coalesce(
      student_id::text,
      nullif(trim(reference), ''),
      id::text
    ) as payment_owner
    from public.payments
    where school_id = p_school_id
      and lower(coalesce(status, '')) in ('completed', 'success', 'paid')
  ) completed_payments;

  v_settled := least(v_settled, v_completed);
  v_due := greatest(v_completed - v_settled, 0);

  if p_claim_students > v_due then
    raise exception 'The claim exceeds the % unclaimed student payment(s).', v_due
      using errcode = '23514';
  end if;

  v_next_claim := v_claim_count + 1;

  update public.school_config
  set finance_settled_students = v_settled + p_claim_students,
      finance_settled_at = v_now,
      finance_claim_count = v_next_claim
  where school_id = p_school_id;

  insert into public.finance_claims (
    school_id,
    claim_number,
    students_claimed,
    gross_amount,
    created_by,
    created_at
  ) values (
    p_school_id,
    v_next_claim,
    p_claim_students,
    round((p_claim_students * 12.50)::numeric, 2),
    auth.uid(),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'school_id', p_school_id,
    'claim_number', v_next_claim,
    'students_claimed', p_claim_students,
    'settled_students', v_settled + p_claim_students,
    'remaining_students', v_due - p_claim_students,
    'gross_amount', round((p_claim_students * 12.50)::numeric, 2),
    'settled_at', v_now
  );
end;
$$;

revoke all on function public.apply_finance_claim(uuid, integer) from public;
revoke all on function public.apply_finance_claim(uuid, integer) from anon;
grant execute on function public.apply_finance_claim(uuid, integer) to authenticated;

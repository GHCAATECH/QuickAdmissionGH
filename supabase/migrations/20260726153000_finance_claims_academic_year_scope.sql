-- Scope finance payouts/claims to the school academic year.
-- Without this, an old paid claim can be counted against new students after
-- the next admission cycle starts, making fresh submissions look already paid.

alter table public.finance_claims
  add column if not exists academic_year text;

create index if not exists finance_claims_school_academic_year_idx
  on public.finance_claims (school_id, academic_year, claim_number);

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
  v_academic_year text;
  v_settled integer := 0;
  v_claim_count integer := 0;
  v_successful integer := 0;
  v_due integer := 0;
  v_next_claim integer := 0;
  v_now timestamptz := now();
  v_settled_at timestamptz;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if coalesce(v_role, '') <> 'super_admin' then
    raise exception 'Only a super admin can mark a financial claim as paid.'
      using errcode = '42501';
  end if;

  if p_school_id is null or coalesce(p_claim_students, 0) <= 0 then
    raise exception 'A school and a positive successful-payment count are required.'
      using errcode = '22023';
  end if;

  select nullif(btrim(coalesce(academic_year::text, '')), '')
    into v_academic_year
  from public.school_config
  where school_id = p_school_id
  for update;

  if not found then
    raise exception 'Financial configuration was not found for this school.'
      using errcode = 'P0002';
  end if;

  v_academic_year := coalesce(v_academic_year, to_char(v_now, 'YYYY'));

  select
    coalesce(sum(students_claimed), 0)::integer,
    coalesce(max(claim_number), 0)::integer,
    max(created_at)
  into v_settled, v_claim_count, v_settled_at
  from public.finance_claims
  where school_id = p_school_id
    and academic_year = v_academic_year;

  select count(*) into v_successful
  from (
    select distinct coalesce(
      p.student_id::text,
      nullif(trim(p.reference), ''),
      p.id::text
    ) as payment_owner
    from public.payments p
    join public.students st
      on st.id = p.student_id
     and st.school_id = p_school_id
     and st.submitted_at is not null
    where p.school_id = p_school_id
      and lower(coalesce(p.status, '')) in ('completed', 'success', 'paid')
  ) successful_payments;

  v_settled := least(v_settled, v_successful);
  v_due := greatest(v_successful - v_settled, 0);

  if p_claim_students > v_due then
    raise exception 'The payout exceeds the % unpaid successful student payment(s).', v_due
      using errcode = '23514';
  end if;

  v_next_claim := v_claim_count + 1;

  insert into public.finance_claims (
    school_id,
    academic_year,
    claim_number,
    students_claimed,
    gross_amount,
    created_by,
    created_at
  ) values (
    p_school_id,
    v_academic_year,
    v_next_claim,
    p_claim_students,
    round((p_claim_students * 12.50)::numeric, 2),
    auth.uid(),
    v_now
  );

  update public.school_config
  set finance_settled_students = v_settled + p_claim_students,
      finance_settled_at = v_now,
      finance_claim_count = v_next_claim
  where school_id = p_school_id;

  return jsonb_build_object(
    'ok', true,
    'school_id', p_school_id,
    'academic_year', v_academic_year,
    'claim_number', v_next_claim,
    'successful_payments', v_successful,
    'payments_marked_paid', p_claim_students,
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

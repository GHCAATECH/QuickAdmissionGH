-- Claims are calculated from unique successful student payments.
-- Super Admin payout actions move those payments from unpaid to paid history.
-- Rebuild counters from the auditable claim ledger so a school cannot appear
-- paid before a Super Admin payout has actually been recorded.
-- Keep this migration safe when it is run directly in the SQL Editor instead
-- of through the full migration history.
alter table public.school_config
  add column if not exists finance_settled_students integer not null default 0,
  add column if not exists finance_claim_count integer not null default 0,
  add column if not exists finance_settled_at timestamptz;

with claim_totals as (
  select
    sc.school_id,
    coalesce(sum(fc.students_claimed), 0)::integer as settled_students,
    coalesce(max(fc.claim_number), 0)::integer as claim_count,
    max(fc.created_at) as settled_at
  from public.school_config sc
  left join public.finance_claims fc on fc.school_id = sc.school_id
  group by sc.school_id
)
update public.school_config sc
set finance_settled_students = ct.settled_students,
    finance_claim_count = ct.claim_count,
    finance_settled_at = ct.settled_at
from claim_totals ct
where sc.school_id = ct.school_id;

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
  v_successful integer := 0;
  v_due integer := 0;
  v_next_claim integer := 0;
  v_now timestamptz := now();
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

  select count(*) into v_successful
  from (
    select distinct coalesce(
      student_id::text,
      nullif(trim(reference), ''),
      id::text
    ) as payment_owner
    from public.payments
    where school_id = p_school_id
      and lower(coalesce(status, '')) in ('completed', 'success', 'paid')
  ) successful_payments;

  v_settled := least(v_settled, v_successful);
  v_due := greatest(v_successful - v_settled, 0);

  if p_claim_students > v_due then
    raise exception 'The payout exceeds the % unpaid successful student payment(s).', v_due
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

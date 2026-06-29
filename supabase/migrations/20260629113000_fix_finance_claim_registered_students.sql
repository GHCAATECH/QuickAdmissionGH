-- Financial claims are earned when a student submits the admission form.
-- Payment rows remain the transaction history, but they are not the claim basis.
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
  v_registered integer := 0;
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

  select count(*) into v_registered
  from public.students
  where school_id = p_school_id
    and submitted_at is not null;

  v_settled := least(v_settled, v_registered);
  v_due := greatest(v_registered - v_settled, 0);

  if p_claim_students > v_due then
    raise exception 'The claim exceeds the % unclaimed submitted student(s).', v_due
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
    'registered_students', v_registered,
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

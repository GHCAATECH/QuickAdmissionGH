-- Close the legacy student-login RPC and require an MFA-verified session for
-- browser access to protected application data and privileged RPCs.

do $migration$
begin
  if to_regprocedure('public.student_login(text,text,uuid)') is not null then
    revoke all on function public.student_login(text, text, uuid)
      from public, anon, authenticated;
    grant execute on function public.student_login(text, text, uuid)
      to service_role;
  end if;
end;
$migration$;

-- Authenticated users in this project are administrative users. Apply one
-- restrictive MFA policy alongside every existing public-table RLS policy.
do $migration$
declare
  table_row record;
begin
  for table_row in
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and c.relrowsecurity
       and c.relname <> 'profiles'
  loop
    execute format(
      'drop policy if exists require_admin_mfa_20260814 on public.%I',
      table_row.table_name
    );
    execute format(
      'create policy require_admin_mfa_20260814 on public.%I as restrictive for all to authenticated using (coalesce(auth.jwt() ->> ''aal'', ''aal1'') = ''aal2'') with check (coalesce(auth.jwt() ->> ''aal'', ''aal1'') = ''aal2'')',
      table_row.table_name
    );
  end loop;
end;
$migration$;

create or replace function public.update_student_feature_settings(
  p_school uuid,
  p_allow_passport_photo boolean,
  p_allow_house_selection boolean,
  p_allow_class_selection boolean,
  p_force_enrolment_upload boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile public.profiles%rowtype;
  caller_role text;
  is_co_admin boolean := false;
  updated_config public.school_config%rowtype;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    return jsonb_build_object('ok', false, 'error', 'mfa_required');
  end if;

  select *
    into caller_profile
    from public.profiles
   where id = auth.uid();

  if caller_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  caller_role := lower(replace(coalesce(caller_profile.role::text, ''), ' ', '_'));
  if caller_role not in ('school_admin', 'super_admin') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if caller_role = 'school_admin' then
    if caller_profile.school_id is distinct from p_school then
      return jsonb_build_object('ok', false, 'error', 'wrong_school');
    end if;

    is_co_admin := lower(coalesce(caller_profile.permissions ->> 'co_admin', '')) in ('true', '1');
    if caller_profile.permissions is not null and not is_co_admin then
      return jsonb_build_object('ok', false, 'error', 'owner_or_co_admin_required');
    end if;
  end if;

  update public.school_config
     set allow_passport_photo = coalesce(p_allow_passport_photo, false),
         allow_house_selection = coalesce(p_allow_house_selection, false),
         allow_class_selection = coalesce(p_allow_class_selection, true),
         force_enrolment_upload = coalesce(p_force_enrolment_upload, true)
   where school_id = p_school
   returning * into updated_config;

  if updated_config.school_id is null then
    return jsonb_build_object('ok', false, 'error', 'config_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'config', jsonb_build_object(
      'allow_passport_photo', updated_config.allow_passport_photo,
      'allow_house_selection', updated_config.allow_house_selection,
      'allow_class_selection', updated_config.allow_class_selection,
      'force_enrolment_upload', updated_config.force_enrolment_upload
    )
  );
end;
$$;

revoke all on function public.update_student_feature_settings(uuid, boolean, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.update_student_feature_settings(uuid, boolean, boolean, boolean, boolean)
  to authenticated;

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
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Multi-factor authentication is required.'
      using errcode = '42501';
  end if;

  select role::text into v_role
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
    coalesce(max(claim_number), 0)::integer
  into v_settled, v_claim_count
  from public.finance_claims
  where school_id = p_school_id
    and academic_year = v_academic_year;

  select count(*) into v_successful
  from (
    select distinct coalesce(
      p.student_id::text,
      nullif(btrim(p.reference), ''),
      p.id::text
    ) as payment_owner
    from public.payments p
    where p.school_id = p_school_id
      and lower(btrim(coalesce(p.status, ''))) in ('completed', 'success', 'successful', 'paid')
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

revoke all on function public.apply_finance_claim(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.apply_finance_claim(uuid, integer)
  to authenticated;

create or replace function public.switch_academic_year(
  p_school uuid,
  p_new_year text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile public.profiles%rowtype;
  caller_role text;
  is_co_admin boolean := false;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    return jsonb_build_object('ok', false, 'error', 'mfa_required');
  end if;

  select *
    into caller_profile
    from public.profiles
   where id = auth.uid();

  if caller_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  caller_role := lower(replace(coalesce(caller_profile.role::text, ''), ' ', '_'));
  if caller_role = 'super_admin' then
    return public.switch_academic_year_authorized_core_20260809(p_school, p_new_year);
  end if;

  if caller_role <> 'school_admin' or caller_profile.school_id is distinct from p_school then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  is_co_admin := lower(coalesce(caller_profile.permissions ->> 'co_admin', '')) in ('true', '1');
  if caller_profile.permissions is not null and not is_co_admin then
    return jsonb_build_object('ok', false, 'error', 'owner_or_co_admin_required');
  end if;

  return public.switch_academic_year_authorized_core_20260809(p_school, p_new_year);
end;
$$;

revoke all on function public.switch_academic_year(uuid, text)
  from public, anon, authenticated;
grant execute on function public.switch_academic_year(uuid, text)
  to authenticated;

-- Keep admission_year synchronized with the first year in academic_year and
-- recover a parked year if school_config already points at it while live data is empty.

create or replace function public.sync_school_config_admission_year()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  start_year text;
begin
  start_year := substring(coalesce(new.academic_year, '') from '([0-9]{4})');
  if start_year is not null then
    new.admission_year := start_year::integer;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_school_config_admission_year_trigger on public.school_config;
create trigger sync_school_config_admission_year_trigger
before insert or update of academic_year, admission_year on public.school_config
for each row
execute function public.sync_school_config_admission_year();

update public.school_config
set admission_year = substring(academic_year from '([0-9]{4})')::integer
where substring(coalesce(academic_year, '') from '([0-9]{4})') is not null
  and admission_year is distinct from substring(academic_year from '([0-9]{4})')::integer;

revoke all on function public.sync_school_config_admission_year()
  from public, anon, authenticated;

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
  cur_year text;
  normalized_year text := btrim(coalesce(p_new_year, ''));
  start_year integer;
  n_stu integer := 0;
  n_plc integer := 0;
  n_pay integer := 0;
  n_tok integer := 0;
  has_live boolean := false;
  target_exists boolean := false;
  same_year_recovery boolean := false;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (school_id = p_school or role = 'super_admin')
  ) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if normalized_year = '' or substring(normalized_year from '([0-9]{4})') is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_year');
  end if;
  start_year := substring(normalized_year from '([0-9]{4})')::integer;

  perform pg_advisory_xact_lock(hashtextextended(p_school::text, 0));

  select academic_year into cur_year
  from public.school_config
  where school_id = p_school
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'configuration_not_found');
  end if;

  select
    exists(select 1 from public.students where school_id = p_school)
    or exists(select 1 from public.placement_list where school_id = p_school)
    or exists(select 1 from public.payments where school_id = p_school)
    or exists(select 1 from public.tokens where school_id = p_school)
  into has_live;

  select exists(
    select 1 from public.year_archive
    where school_id = p_school
      and academic_year = normalized_year
  ) into target_exists;

  same_year_recovery := coalesce(cur_year, '') = normalized_year
    and not has_live
    and target_exists;

  if coalesce(cur_year, '') = normalized_year and not same_year_recovery then
    update public.school_config
       set admission_year = start_year, updated_at = now()
     where school_id = p_school;
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'year', normalized_year,
      'admission_year', start_year
    );
  end if;

  if has_live and coalesce(cur_year, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'current_year_not_configured');
  end if;

  if has_live and coalesce(cur_year, '') <> normalized_year then
    delete from public.year_archive
    where school_id = p_school and academic_year = cur_year;

    insert into public.year_archive(school_id, academic_year, kind, payload)
      select p_school, cur_year, 'students', to_jsonb(s)
      from public.students s where s.school_id = p_school;
    insert into public.year_archive(school_id, academic_year, kind, payload)
      select p_school, cur_year, 'placement_list', to_jsonb(p)
      from public.placement_list p where p.school_id = p_school;
    insert into public.year_archive(school_id, academic_year, kind, payload)
      select p_school, cur_year, 'payments', to_jsonb(pay)
      from public.payments pay where pay.school_id = p_school;
    insert into public.year_archive(school_id, academic_year, kind, payload)
      select p_school, cur_year, 'tokens', to_jsonb(t)
      from public.tokens t where t.school_id = p_school;
  end if;

  delete from public.tokens where school_id = p_school;
  delete from public.payments where school_id = p_school;
  delete from public.students where school_id = p_school;
  delete from public.placement_list where school_id = p_school;

  if target_exists then
    perform set_config('qag.academic_year_restore', 'on', true);

    insert into public.placement_list
      select (jsonb_populate_record(null::public.placement_list, payload)).*
      from public.year_archive
      where school_id = p_school and academic_year = normalized_year and kind = 'placement_list';
    insert into public.students
      select (jsonb_populate_record(null::public.students, payload)).*
      from public.year_archive
      where school_id = p_school and academic_year = normalized_year and kind = 'students';
    insert into public.payments
      select (jsonb_populate_record(null::public.payments, payload)).*
      from public.year_archive
      where school_id = p_school and academic_year = normalized_year and kind = 'payments';
    insert into public.tokens
      select (jsonb_populate_record(null::public.tokens, payload)).*
      from public.year_archive
      where school_id = p_school and academic_year = normalized_year and kind = 'tokens';

    perform set_config('qag.academic_year_restore', 'off', true);

    delete from public.year_archive
    where school_id = p_school and academic_year = normalized_year;
  end if;

  select count(*) into n_stu from public.students where school_id = p_school;
  select count(*) into n_plc from public.placement_list where school_id = p_school;
  select count(*) into n_pay from public.payments where school_id = p_school;
  select count(*) into n_tok from public.tokens where school_id = p_school;

  update public.school_config
     set academic_year = normalized_year,
         admission_year = start_year,
         updated_at = now()
   where school_id = p_school;

  insert into public.activity_log(school_id, actor, action)
  values (
    p_school,
    'System',
    case when same_year_recovery then
      'Recovered saved academic year ' || normalized_year || ' with ' || n_stu || ' students'
    else
      'Switched academic year from ' || coalesce(cur_year, '—') || ' to ' || normalized_year ||
      case when target_exists then ' (loaded ' || n_stu || ' saved students)' else ' (new empty year)' end
    end
  );

  return jsonb_build_object(
    'ok', true,
    'old_year', cur_year,
    'new_year', normalized_year,
    'admission_year', start_year,
    'students', n_stu,
    'placements', n_plc,
    'payments', n_pay,
    'tokens', n_tok,
    'restored', target_exists,
    'recovered_same_year', same_year_recovery
  );
end;
$$;

revoke all on function public.switch_academic_year(uuid, text)
  from public, anon;
grant execute on function public.switch_academic_year(uuid, text)
  to authenticated;

-- Saved academic years contain historical assignments that may predate the
-- current programme/class/house validation rules. Restore those exact rows
-- without treating them as new assignments; normal portal/admin writes remain
-- fully validated.

drop trigger if exists enforce_student_house_rules_trigger on public.students;
drop trigger if exists enforce_student_house_residential_rules_trigger on public.students;
drop trigger if exists enforce_student_programme_class_rules_trigger on public.students;

create trigger enforce_student_house_rules_trigger
before insert or update of house_id, gender on public.students
for each row
when (coalesce(current_setting('qag.academic_year_restore', true), '') <> 'on')
execute function public.enforce_student_house_rules();

create trigger enforce_student_house_residential_rules_trigger
before update of records on public.students
for each row
when (
  coalesce(current_setting('qag.academic_year_restore', true), '') <> 'on'
  and coalesce(old.records ->> 'residential_status', old.records ->> 'residential', '')
      is distinct from
      coalesce(new.records ->> 'residential_status', new.records ->> 'residential', '')
)
execute function public.enforce_student_house_rules();

create trigger enforce_student_programme_class_rules_trigger
before insert or update of programme_id, class_id on public.students
for each row
when (coalesce(current_setting('qag.academic_year_restore', true), '') <> 'on')
execute function public.enforce_student_programme_class_rules();

do $$
begin
  if to_regprocedure('public.switch_academic_year_core_20260801(uuid,text)') is null then
    alter function public.switch_academic_year(uuid, text)
      rename to switch_academic_year_core_20260801;
  end if;
end;
$$;

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
  result jsonb;
begin
  perform set_config('qag.academic_year_restore', 'on', true);
  result := public.switch_academic_year_core_20260801(p_school, p_new_year);
  perform set_config('qag.academic_year_restore', 'off', true);
  return result;
exception
  when others then
    perform set_config('qag.academic_year_restore', 'off', true);
    raise;
end;
$$;

revoke all on function public.switch_academic_year_core_20260801(uuid, text)
  from public, anon, authenticated;
revoke all on function public.switch_academic_year(uuid, text)
  from public, anon;
grant execute on function public.switch_academic_year(uuid, text)
  to authenticated;

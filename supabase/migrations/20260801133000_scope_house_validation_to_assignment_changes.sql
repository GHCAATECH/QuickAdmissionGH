-- Academic-year switching updates students.records for archival metadata. House
-- validation must not run for unrelated JSON changes, because it can block the
-- switch on historical assignments that predate the current house rules.
drop trigger if exists enforce_student_house_rules_trigger on public.students;
drop trigger if exists enforce_student_house_residential_rules_trigger on public.students;

create trigger enforce_student_house_rules_trigger
before insert or update of house_id, gender on public.students
for each row
execute function public.enforce_student_house_rules();

create trigger enforce_student_house_residential_rules_trigger
before update of records on public.students
for each row
when (
  coalesce(old.records ->> 'residential_status', old.records ->> 'residential', '')
  is distinct from
  coalesce(new.records ->> 'residential_status', new.records ->> 'residential', '')
)
execute function public.enforce_student_house_rules();

-- A reversed verification returns the student to the unassigned programme,
-- classroom and house pools. The CSSPS placement record remains unchanged.

do $migration$
declare
  definition text;
  old_assignment_block constant text := $old$
      house_id = null,
      records = coalesce(records, '{}'::jsonb)
        - 'admission_no'
        - 'admission_number'
        - 'permanent_admission_number'
        - 'school_no'
        - 'house'
        - 'house_id'
        - 'house_name',$old$;
  new_assignment_block constant text := $new$
      programme_id = null,
      class_id = null,
      house_id = null,
      records = coalesce(records, '{}'::jsonb)
        - 'admission_no'
        - 'admission_number'
        - 'permanent_admission_number'
        - 'school_no'
        - 'programme'
        - 'programme_id'
        - 'class'
        - 'class_id'
        - 'class_name'
        - 'house'
        - 'house_id'
        - 'house_name',$new$;
  old_activity_block constant text := $old_activity$
      || coalesce(' - Released house ' || previous_house_name, '')
      || coalesce(' - Note: ' || reason_text, '')$old_activity$;
  new_activity_block constant text := $new_activity$
      || coalesce(' - Released house ' || previous_house_name, '')
      || ' - Released programme and classroom assignments'
      || coalesce(' - Note: ' || reason_text, '')$new_activity$;
begin
  select pg_get_functiondef(
    'public.reverse_student_verification_backend(uuid,uuid,text,text,text,text)'::regprocedure
  ) into definition;

  if position('programme_id = null' in definition) = 0 then
    if position(old_assignment_block in definition) = 0 then
      raise exception 'Expected assignment-release block was not found in reverse_student_verification_backend';
    end if;

    definition := replace(definition, old_assignment_block, new_assignment_block);

    if position(old_activity_block in definition) > 0 then
      definition := replace(definition, old_activity_block, new_activity_block);
    end if;

    execute definition;
  end if;
end;
$migration$;

comment on function public.reverse_student_verification_backend(uuid, uuid, text, text, text, text)
is 'Reverses verification with an optional note and releases the admission number, programme, classroom and house assignments.';

-- Reverse verification releases verification-owned values but preserves the
-- classroom selected for the student. Keeping the class avoids unnecessary
-- reallocation when the student is verified again.

do $migration$
declare
  definition text;
  old_assignment_block constant text := $old$
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
        - 'house_name',$old$;
  new_assignment_block constant text := $new$
      programme_id = null,
      house_id = null,
      records = coalesce(records, '{}'::jsonb)
        - 'admission_no'
        - 'admission_number'
        - 'permanent_admission_number'
        - 'school_no'
        - 'programme'
        - 'programme_id'
        - 'house'
        - 'house_id'
        - 'house_name',$new$;
  old_activity_block constant text := $old_activity$
      || ' - Released programme and classroom assignments'
      || coalesce(' - Note: ' || reason_text, '')$old_activity$;
  new_activity_block constant text := $new_activity$
      || ' - Released programme assignment; class retained'
      || coalesce(' - Note: ' || reason_text, '')$new_activity$;
begin
  select pg_get_functiondef(
    'public.reverse_student_verification_backend(uuid,uuid,text,text,text,text)'::regprocedure
  ) into definition;

  if position('class_id = null' in definition) > 0 then
    if position(old_assignment_block in definition) = 0 then
      raise exception 'Expected class-release block was not found in reverse_student_verification_backend';
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
is 'Reverses verification with an optional note, preserves the class assignment, and releases the admission number, programme, and house assignments.';

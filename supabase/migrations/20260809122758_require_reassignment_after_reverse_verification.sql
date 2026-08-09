-- A reversed student must receive a valid programme and linked classroom before
-- verification can issue a new permanent number and house allocation.

do $migration$
declare
  definition text;
  anchor constant text := $anchor$
  if lower(coalesce(stu.status, '')) = 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'Rejected students cannot be verified.');
  end if;$anchor$;
  replacement constant text := $replacement$
  if lower(coalesce(stu.status, '')) = 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'Rejected students cannot be verified.');
  end if;

  if stu.verification_reversed_at is not null then
    if stu.programme_id is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'programme_required_after_reversal',
        'message', 'Assign the student to a programme before verifying again.'
      );
    end if;

    if stu.class_id is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'class_required_after_reversal',
        'message', 'Assign the student to a classroom before verifying again.'
      );
    end if;

    if not exists (
      select 1
      from public.classrooms classroom
      where classroom.id = stu.class_id
        and classroom.school_id = stu.school_id
        and classroom.programme_id = stu.programme_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'class_programme_mismatch',
        'message', 'The selected classroom is not linked to the student programme.'
      );
    end if;
  end if;$replacement$;
begin
  select pg_get_functiondef(
    'public.verify_campus_student_backend(uuid,uuid,text,text,text)'::regprocedure
  ) into definition;

  if position('programme_required_after_reversal' in definition) = 0 then
    if position(anchor in definition) = 0 then
      raise exception 'Expected verification status block was not found in verify_campus_student_backend';
    end if;

    execute replace(definition, anchor, replacement);
  end if;
end;
$migration$;

comment on function public.verify_campus_student_backend(uuid, uuid, text, text, text)
is 'Verifies submitted students, requires reassignment after reversal, reuses the lowest number gap, and allocates houses by occupancy and priority.';

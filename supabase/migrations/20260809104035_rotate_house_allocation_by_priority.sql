-- Rotate verified students across matching houses instead of filling the
-- first-priority house to capacity before considering the next one. The
-- verification function already holds an advisory lock for each
-- school/gender/residential group, so the occupancy comparison is atomic.
do $migration$
declare
  definition text;
  old_order constant text := 'order by h.priority asc, h.name asc, h.id asc';
  new_order constant text := $order$order by (
        select count(*)
        from public.students occupied
        where occupied.house_id = h.id
          and occupied.id <> stu.id
      ) asc,
      h.priority asc,
      h.name asc,
      h.id asc$order$;
begin
  select pg_get_functiondef(
    'public.verify_campus_student_backend(uuid,uuid,text,text,text)'::regprocedure
  ) into definition;

  if position(new_order in definition) > 0 then
    return;
  end if;

  if position(old_order in definition) = 0 then
    raise exception 'Expected house allocation ordering was not found in verify_campus_student_backend';
  end if;

  execute replace(definition, old_order, new_order);
end;
$migration$;

comment on function public.verify_campus_student_backend(uuid, uuid, text, text, text)
is 'Verifies a submitted student, generates the permanent admission number, and rotates house allocation by occupancy then configured priority.';

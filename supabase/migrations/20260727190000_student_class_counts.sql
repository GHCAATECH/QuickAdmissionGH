create or replace function public.student_class_counts(p_school uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(class_id::text, total), '{}'::jsonb)
  from (
    select class_id, count(*)::int as total
    from public.students
    where school_id = p_school and class_id is not null
    group by class_id
  ) grouped;
$$;

revoke all on function public.student_class_counts(uuid) from public, anon, authenticated;
grant execute on function public.student_class_counts(uuid) to service_role;

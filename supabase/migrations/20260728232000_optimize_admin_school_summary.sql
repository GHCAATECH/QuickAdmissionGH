create or replace function public.admin_school_summary(p_school uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
with base_students as (
  select id, programme_id, class_id, house_id, gender, status, submitted_at, created_at, records
  from public.students
  where school_id = p_school
), submitted as (
  select *
  from base_students
  where submitted_at is not null
    and coalesce(status, '') <> 'rejected'
), programme_counts as (
  select programme_id::text as key, count(*)::int as value
  from submitted
  where programme_id is not null
  group by programme_id
), class_counts as (
  select class_id::text as key, count(*)::int as value
  from submitted
  where class_id is not null
  group by class_id
), house_counts as (
  select house_id::text as key, count(*)::int as value
  from submitted
  where house_id is not null
  group by house_id
), recent_rows as (
  select jsonb_agg(jsonb_build_object(
    'id', recent.id,
    'full_name', recent.full_name,
    'bece_index', recent.bece_index,
    'admission_no', recent.admission_no,
    'programme_id', recent.programme_id,
    'submitted_at', recent.submitted_at,
    'created_at', recent.created_at
  ) order by coalesce(recent.submitted_at, recent.created_at) desc) as rows
  from (
    select st.id, st.full_name, st.bece_index, st.admission_no, st.programme_id,
           st.submitted_at, st.created_at
    from public.students st
    where st.school_id = p_school
      and st.submitted_at is not null
      and coalesce(st.status, '') <> 'rejected'
    order by coalesce(st.submitted_at, st.created_at) desc
    limit 8
  ) recent
)
select jsonb_build_object(
  'total', (select count(*)::int from base_students),
  'submitted', (select count(*)::int from submitted),
  'pending', (select count(*)::int from base_students where coalesce(status, 'pending') = 'pending'),
  'paid', (select count(distinct p.student_id)::int from public.payments p join submitted s on s.id = p.student_id where lower(coalesce(p.status, '')) in ('completed', 'success', 'paid')),
  'male', (select count(*)::int from submitted where upper(coalesce(gender, '')) in ('M', 'MALE')),
  'female', (select count(*)::int from submitted where upper(coalesce(gender, '')) in ('F', 'FEMALE')),
  'day', (select count(*)::int from submitted where lower(coalesce(records->>'residential_status', records->>'residential', '')) = 'day'),
  'boarding', (select count(*)::int from submitted where lower(coalesce(records->>'residential_status', records->>'residential', '')) like 'board%'),
  'programmes', coalesce((select jsonb_object_agg(key, value) from programme_counts), '{}'::jsonb),
  'classes', coalesce((select jsonb_object_agg(key, value) from class_counts), '{}'::jsonb),
  'houses', coalesce((select jsonb_object_agg(key, value) from house_counts), '{}'::jsonb),
  'recent', coalesce((select rows from recent_rows), '[]'::jsonb)
);
$$;

revoke all on function public.admin_school_summary(uuid) from public, anon, authenticated;
grant execute on function public.admin_school_summary(uuid) to service_role;

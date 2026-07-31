create or replace function public.admin_school_summary(p_school uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
with base_students as (
  select id, bece_index, programme_id, class_id, house_id, gender, status,
         submitted_at, created_at, records
  from public.students
  where school_id = p_school
), submitted as (
  select * from base_students
  where submitted_at is not null
    and lower(coalesce(status, '')) <> 'rejected'
), placements as (
  select index_number, gender, residential_status
  from public.placement_list
  where school_id = p_school
), submitted_enriched as (
  select s.*,
         upper(coalesce(nullif(trim(s.gender), ''), nullif(trim(p.gender), ''))) as resolved_gender,
         lower(coalesce(nullif(trim(s.records->>'residential_status'), ''),
                        nullif(trim(s.records->>'residential'), ''),
                        nullif(trim(p.residential_status), ''))) as resolved_residence
  from submitted s
  left join placements p on p.index_number = s.bece_index
), programme_counts as (
  select programme_id::text as key, count(*)::int as value
  from submitted where programme_id is not null group by programme_id
), class_counts as (
  select class_id::text as key, count(*)::int as value
  from submitted where class_id is not null group by class_id
), house_counts as (
  select house_id::text as key, count(*)::int as value
  from submitted where house_id is not null group by house_id
), recent_rows as (
  select jsonb_agg(jsonb_build_object(
    'id', recent.id, 'full_name', recent.full_name,
    'bece_index', recent.bece_index, 'admission_no', recent.admission_no,
    'programme_id', recent.programme_id, 'submitted_at', recent.submitted_at,
    'created_at', recent.created_at
  ) order by coalesce(recent.submitted_at, recent.created_at) desc) as rows
  from (
    select st.id, st.full_name, st.bece_index, st.admission_no, st.programme_id,
           st.submitted_at, st.created_at
    from public.students st
    where st.school_id = p_school
      and st.submitted_at is not null
      and lower(coalesce(st.status, '')) <> 'rejected'
    order by coalesce(st.submitted_at, st.created_at) desc
    limit 8
  ) recent
)
select jsonb_build_object(
  'total', (select count(*)::int from base_students),
  'placed', (select count(*)::int from placements),
  'submitted', (select count(*)::int from submitted),
  'pending', (select count(*)::int from base_students where lower(coalesce(status, 'pending')) = 'pending'),
  'paid', (select count(distinct p.student_id)::int from public.payments p join submitted s on s.id = p.student_id where lower(coalesce(p.status, '')) in ('completed', 'success', 'paid')),
  'placement_male', (select count(*)::int from placements where upper(coalesce(gender, '')) in ('M', 'MALE')),
  'placement_female', (select count(*)::int from placements where upper(coalesce(gender, '')) in ('F', 'FEMALE')),
  'placement_day', (select count(*)::int from placements where lower(coalesce(residential_status, '')) = 'day'),
  'placement_boarding', (select count(*)::int from placements where lower(coalesce(residential_status, '')) like 'board%'),
  'placement_male_day', (select count(*)::int from placements where upper(coalesce(gender, '')) in ('M', 'MALE') and lower(coalesce(residential_status, '')) = 'day'),
  'placement_female_day', (select count(*)::int from placements where upper(coalesce(gender, '')) in ('F', 'FEMALE') and lower(coalesce(residential_status, '')) = 'day'),
  'placement_male_boarding', (select count(*)::int from placements where upper(coalesce(gender, '')) in ('M', 'MALE') and lower(coalesce(residential_status, '')) like 'board%'),
  'placement_female_boarding', (select count(*)::int from placements where upper(coalesce(gender, '')) in ('F', 'FEMALE') and lower(coalesce(residential_status, '')) like 'board%'),
  'male', (select count(*)::int from submitted_enriched where resolved_gender in ('M', 'MALE')),
  'female', (select count(*)::int from submitted_enriched where resolved_gender in ('F', 'FEMALE')),
  'day', (select count(*)::int from submitted_enriched where resolved_residence = 'day'),
  'boarding', (select count(*)::int from submitted_enriched where resolved_residence like 'board%'),
  'male_day', (select count(*)::int from submitted_enriched where resolved_gender in ('M', 'MALE') and resolved_residence = 'day'),
  'female_day', (select count(*)::int from submitted_enriched where resolved_gender in ('F', 'FEMALE') and resolved_residence = 'day'),
  'male_boarding', (select count(*)::int from submitted_enriched where resolved_gender in ('M', 'MALE') and resolved_residence like 'board%'),
  'female_boarding', (select count(*)::int from submitted_enriched where resolved_gender in ('F', 'FEMALE') and resolved_residence like 'board%'),
  'programmes', coalesce((select jsonb_object_agg(key, value) from programme_counts), '{}'::jsonb),
  'classes', coalesce((select jsonb_object_agg(key, value) from class_counts), '{}'::jsonb),
  'houses', coalesce((select jsonb_object_agg(key, value) from house_counts), '{}'::jsonb),
  'recent', coalesce((select rows from recent_rows), '[]'::jsonb)
);
$$;

revoke all on function public.admin_school_summary(uuid) from public, anon, authenticated;
grant execute on function public.admin_school_summary(uuid) to service_role;

create or replace function public.super_admin_dashboard_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
with school_student_counts as (
  select school_id::text as key, count(*)::int as value
  from public.students
  group by school_id
)
select jsonb_build_object(
  'active_schools', (select count(*)::int from public.schools where lower(coalesce(status, 'active')) <> 'suspended'),
  'total_schools', (select count(*)::int from public.schools),
  'total_students', (select count(*)::int from public.students),
  'today_registrations', (select count(*)::int from public.students where coalesce(submitted_at, created_at)::date = current_date),
  'total_revenue_pesewas', (select coalesce(sum(amount_pesewas), 0)::bigint from public.payments where lower(coalesce(status, '')) in ('completed', 'success', 'paid')),
  'open_admissions', (select count(*)::int from public.school_config where upper(trim(coalesce(admission_status, ''))) in ('OPEN', 'OPENED', 'ACTIVE', 'TRUE', 'YES', '1')),
  'sms_balance', (select coalesce(sum(sms_balance), 0)::bigint from public.school_config),
  'school_students', coalesce((select jsonb_object_agg(key, value) from school_student_counts), '{}'::jsonb)
);
$$;

revoke all on function public.super_admin_dashboard_summary() from public, anon, authenticated;
grant execute on function public.super_admin_dashboard_summary() to service_role;

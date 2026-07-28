create or replace function public.house_occupancy_counts(p_school_id uuid)
returns table(house_id uuid, occupied bigint)
language sql
security definer
set search_path = public
stable
as $$
  select s.house_id, count(*)::bigint as occupied
  from public.students s
  where s.school_id = p_school_id
    and s.house_id is not null
  group by s.house_id;
$$;

revoke all on function public.house_occupancy_counts(uuid) from public, anon, authenticated;
grant execute on function public.house_occupancy_counts(uuid) to service_role;

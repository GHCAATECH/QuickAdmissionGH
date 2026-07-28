create or replace function public.finance_student_is_settled(
  p_school_id uuid,
  p_student_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with ranked_payments as (
    select p.student_id,
           row_number() over (
             order by p.paid_at nulls last, p.created_at, p.id
           ) as payment_rank
    from public.payments p
    where p.school_id = p_school_id
      and lower(coalesce(p.status, '')) in ('completed', 'success', 'paid')
  ), settings as (
    select greatest(coalesce(sc.finance_settled_students, 0), 0) as settled_count
    from public.school_config sc
    where sc.school_id = p_school_id
  )
  select exists (
    select 1
    from ranked_payments rp
    cross join settings s
    where rp.student_id = p_student_id
      and rp.payment_rank <= s.settled_count
  );
$$;

revoke all on function public.finance_student_is_settled(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finance_student_is_settled(uuid, uuid) to service_role;

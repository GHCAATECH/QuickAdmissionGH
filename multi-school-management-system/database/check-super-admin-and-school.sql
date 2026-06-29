-- Use this to diagnose create-user Edge Function failures.

select
  p.id,
  p.email,
  p.role,
  p.status
from public.profiles p
where p.email = 'livingclement13@gmail.com';

select
  id,
  school_name,
  school_code,
  status
from public.schools
order by created_at desc;

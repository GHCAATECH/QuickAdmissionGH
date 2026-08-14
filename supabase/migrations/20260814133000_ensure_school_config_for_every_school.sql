-- Every school tenant must have the configuration rows required by the
-- school-admin and student portals, regardless of which creation path is used.

create or replace function public.ensure_new_school_configuration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.school_config (
    school_id,
    service_charge,
    admission_status,
    accept_online_payment
  ) values (
    new.id,
    0,
    'CLOSED',
    true
  )
  on conflict (school_id) do nothing;

  insert into public.school_sms_templates (school_id)
  values (new.id)
  on conflict (school_id) do nothing;

  return new;
end;
$$;

revoke all on function public.ensure_new_school_configuration() from public;

drop trigger if exists ensure_new_school_configuration_trigger on public.schools;
create trigger ensure_new_school_configuration_trigger
after insert on public.schools
for each row
execute function public.ensure_new_school_configuration();

-- Repair existing tenants, including schools created before the current
-- school-management backend began creating these rows transactionally.
insert into public.school_config (
  school_id,
  service_charge,
  admission_status,
  accept_online_payment
)
select
  school.id,
  0,
  'CLOSED',
  true
from public.schools as school
where not exists (
  select 1
  from public.school_config as config
  where config.school_id = school.id
)
on conflict (school_id) do nothing;

insert into public.school_sms_templates (school_id)
select school.id
from public.schools as school
where not exists (
  select 1
  from public.school_sms_templates as template
  where template.school_id = school.id
)
on conflict (school_id) do nothing;

-- Restrict destructive tenant actions and SMS configuration to school managers.

do $migration$
begin
  if to_regprocedure('public.switch_academic_year_authorized_core_20260809(uuid,text)') is null then
    if to_regprocedure('public.switch_academic_year(uuid,text)') is null then
      raise exception 'public.switch_academic_year(uuid,text) is missing';
    end if;

    alter function public.switch_academic_year(uuid, text)
      rename to switch_academic_year_authorized_core_20260809;
  end if;
end;
$migration$;

revoke all on function public.switch_academic_year_authorized_core_20260809(uuid, text)
  from public, anon, authenticated;

create or replace function public.switch_academic_year(
  p_school uuid,
  p_new_year text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile public.profiles%rowtype;
  caller_role text;
  is_co_admin boolean := false;
begin
  select *
    into caller_profile
    from public.profiles
   where id = auth.uid();

  if caller_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  caller_role := lower(replace(coalesce(caller_profile.role::text, ''), ' ', '_'));
  if caller_role = 'super_admin' then
    return public.switch_academic_year_authorized_core_20260809(p_school, p_new_year);
  end if;

  if caller_role <> 'school_admin' or caller_profile.school_id is distinct from p_school then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  is_co_admin := lower(coalesce(caller_profile.permissions ->> 'co_admin', '')) in ('true', '1');
  if caller_profile.permissions is not null and not is_co_admin then
    return jsonb_build_object('ok', false, 'error', 'owner_or_co_admin_required');
  end if;

  return public.switch_academic_year_authorized_core_20260809(p_school, p_new_year);
end;
$$;

revoke all on function public.switch_academic_year(uuid, text)
  from public, anon, authenticated;
grant execute on function public.switch_academic_year(uuid, text)
  to authenticated;

-- Edge Functions use the service role for writes. Browser roles remain read-only.
revoke insert, update, delete on table public.school_sms_templates
  from anon, authenticated;
revoke insert, update, delete on table public.sms_logs
  from anon, authenticated;

drop policy if exists school_sms_templates_select_policy on public.school_sms_templates;
create policy school_sms_templates_select_policy
on public.school_sms_templates
for select
using (
  exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (
         lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'super_admin'
         or (
           lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'school_admin'
           and p.school_id = school_sms_templates.school_id
           and (
             p.permissions is null
             or lower(coalesce(p.permissions ->> 'co_admin', '')) in ('true', '1')
             or lower(coalesce(p.permissions ->> 'sms', '')) in ('true', '1')
           )
         )
       )
  )
);

drop policy if exists school_sms_templates_insert_policy on public.school_sms_templates;
create policy school_sms_templates_insert_policy
on public.school_sms_templates
for insert
with check (
  exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (
         lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'super_admin'
         or (
           lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'school_admin'
           and p.school_id = school_sms_templates.school_id
           and (
             p.permissions is null
             or lower(coalesce(p.permissions ->> 'co_admin', '')) in ('true', '1')
           )
         )
       )
  )
);

drop policy if exists school_sms_templates_update_policy on public.school_sms_templates;
create policy school_sms_templates_update_policy
on public.school_sms_templates
for update
using (
  exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (
         lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'super_admin'
         or (
           lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'school_admin'
           and p.school_id = school_sms_templates.school_id
           and (
             p.permissions is null
             or lower(coalesce(p.permissions ->> 'co_admin', '')) in ('true', '1')
           )
         )
       )
  )
)
with check (
  exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (
         lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'super_admin'
         or (
           lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'school_admin'
           and p.school_id = school_sms_templates.school_id
           and (
             p.permissions is null
             or lower(coalesce(p.permissions ->> 'co_admin', '')) in ('true', '1')
           )
         )
       )
  )
);

drop policy if exists sms_logs_select_policy on public.sms_logs;
create policy sms_logs_select_policy
on public.sms_logs
for select
using (
  exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (
         lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'super_admin'
         or (
           lower(replace(coalesce(p.role::text, ''), ' ', '_')) = 'school_admin'
           and p.school_id = sms_logs.school_id
           and (
             p.permissions is null
             or lower(coalesce(p.permissions ->> 'co_admin', '')) in ('true', '1')
             or lower(coalesce(p.permissions ->> 'sms', '')) in ('true', '1')
           )
         )
       )
  )
);

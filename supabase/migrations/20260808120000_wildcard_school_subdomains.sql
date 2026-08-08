-- School-specific portal hostnames, for example asec.quickadmissiongh.com.
alter table public.schools
  add column if not exists subdomain text;

update public.schools
set subdomain = lower(btrim(subdomain))
where subdomain is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.schools'::regclass
      and conname = 'schools_subdomain_format_chk'
  ) then
    alter table public.schools
      add constraint schools_subdomain_format_chk check (
        subdomain is null or (
          subdomain = lower(btrim(subdomain))
          and subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
          and subdomain <> all (array[
            'www','admin','api','mail','ftp','support','staging','app','dashboard',
            'cdn','static','assets','auth','login','portal','superadmin','super-admin','school-admin'
          ])
        )
      );
  end if;
end;
$$;

create unique index if not exists uq_schools_subdomain
  on public.schools (lower(subdomain))
  where subdomain is not null and btrim(subdomain) <> '';

create or replace function public.resolve_school_by_subdomain(p_subdomain text)
returns table (
  id uuid,
  code text,
  school_code text,
  name text,
  address text,
  phone text,
  email text,
  helpdesk text,
  crest_url text,
  theme_color text,
  subdomain text,
  status text
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.code,
    s.school_code,
    s.name,
    s.address,
    s.phone,
    s.email,
    s.helpdesk,
    s.crest_url,
    s.theme_color,
    s.subdomain,
    s.status::text
  from public.schools s
  where lower(s.subdomain) = lower(btrim(p_subdomain))
    and coalesce(lower(s.status::text), 'active') <> 'suspended'
  limit 1;
$$;

grant execute on function public.resolve_school_by_subdomain(text) to anon, authenticated;

create or replace function public.manage_school_record_backend(
  p_action text,
  p_school_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text := lower(btrim(coalesce(p_action, '')));
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  sid uuid := p_school_id;
  school_row public.schools%rowtype;
  config_row public.school_config%rowtype;
  school_code_value text := upper(regexp_replace(btrim(coalesce(payload ->> 'school_code', '')), '[^A-Z0-9]', '', 'g'));
  school_name_value text := btrim(coalesce(payload ->> 'name', ''));
  subdomain_value text := lower(btrim(coalesce(payload ->> 'subdomain', '')));
  admission_status_value text := upper(btrim(coalesce(payload ->> 'admission_status', 'CLOSED')));
  status_value text := lower(btrim(coalesce(payload ->> 'status', 'active')));
  profile_ids jsonb := '[]'::jsonb;
begin
  if action_name not in ('create', 'update', 'status', 'delete') then
    raise exception using errcode = '22023', message = 'Invalid school management action.';
  end if;

  if action_name in ('status', 'delete') and sid is null then
    raise exception using errcode = '23502', message = 'school_id is required.';
  end if;

  if action_name = 'status' then
    if status_value not in ('active', 'suspended') then
      raise exception using errcode = '23514', message = 'School status must be active or suspended.';
    end if;
    update public.schools set status = status_value where id = sid returning * into school_row;
    if not found then
      raise exception using errcode = 'P0002', message = 'School record was not found.';
    end if;
    insert into public.activity_log (school_id, actor, action)
    values (
      sid,
      coalesce(nullif(btrim(payload ->> 'actor'), ''), 'Super Admin'),
      case when status_value = 'suspended' then 'School suspended' else 'School reactivated' end
    );
    return jsonb_build_object('ok', true, 'school', to_jsonb(school_row));
  end if;

  if action_name = 'delete' then
    select coalesce(jsonb_agg(p.id), '[]'::jsonb) into profile_ids
    from public.profiles p where p.school_id = sid;
    delete from public.schools where id = sid returning * into school_row;
    if not found then
      raise exception using errcode = 'P0002', message = 'School record was not found.';
    end if;
    return jsonb_build_object('ok', true, 'school', to_jsonb(school_row), 'profile_ids', profile_ids);
  end if;

  if school_name_value = '' then
    raise exception using errcode = '23514', message = 'School name is required.';
  end if;
  if school_code_value = '' or length(school_code_value) > 11 then
    raise exception using errcode = '23514', message = 'School code must contain 1 to 11 letters or numbers.';
  end if;
  if subdomain_value = ''
     or subdomain_value !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
     or subdomain_value = any (array[
       'www','admin','api','mail','ftp','support','staging','app','dashboard',
       'cdn','static','assets','auth','login','portal','superadmin','super-admin','school-admin'
     ]) then
    raise exception using errcode = '23514', message = 'Enter a valid, available school portal subdomain.';
  end if;
  if admission_status_value not in ('OPENED', 'CLOSED') then
    raise exception using errcode = '23514', message = 'Admission status must be OPENED or CLOSED.';
  end if;

  if action_name = 'create' then
    insert into public.schools (
      code, school_code, name, subdomain, phone, email,
      subscription_plan, subscription_expiry, status
    ) values (
      school_code_value,
      school_code_value,
      school_name_value,
      subdomain_value,
      nullif(btrim(payload ->> 'phone'), ''),
      nullif(lower(btrim(payload ->> 'email')), ''),
      lower(coalesce(nullif(btrim(payload ->> 'subscription_plan'), ''), 'standard')),
      nullif(payload ->> 'subscription_expiry', '')::date,
      'active'
    ) returning * into school_row;
    sid := school_row.id;
  else
    if sid is null then
      raise exception using errcode = '23502', message = 'school_id is required.';
    end if;
    update public.schools
    set code = school_code_value,
        school_code = school_code_value,
        name = school_name_value,
        subdomain = subdomain_value,
        phone = nullif(btrim(payload ->> 'phone'), ''),
        email = nullif(lower(btrim(payload ->> 'email')), ''),
        subscription_plan = lower(coalesce(nullif(btrim(payload ->> 'subscription_plan'), ''), 'standard')),
        subscription_expiry = nullif(payload ->> 'subscription_expiry', '')::date,
        status = case when lower(payload ->> 'status') = 'suspended' then 'suspended' else 'active' end
    where id = sid
    returning * into school_row;
    if not found then
      raise exception using errcode = 'P0002', message = 'School record was not found.';
    end if;
  end if;

  insert into public.school_config (
    school_id, service_charge, admission_status, accept_online_payment
  ) values (
    sid,
    greatest(coalesce(nullif(payload ->> 'service_charge', '')::numeric, 0), 0),
    admission_status_value,
    coalesce((payload ->> 'accept_online_payment')::boolean, true)
  )
  on conflict (school_id) do update
    set service_charge = excluded.service_charge,
        admission_status = excluded.admission_status,
        accept_online_payment = excluded.accept_online_payment
  returning * into config_row;

  insert into public.school_sms_templates (school_id) values (sid)
  on conflict (school_id) do nothing;

  insert into public.activity_log (school_id, actor, action)
  values (
    sid,
    coalesce(nullif(btrim(payload ->> 'actor'), ''), 'Super Admin'),
    case when action_name = 'create' then 'New school created' else 'School information updated' end
  );

  return jsonb_build_object('ok', true, 'school', to_jsonb(school_row), 'config', to_jsonb(config_row));
end;
$$;

revoke all on function public.manage_school_record_backend(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.manage_school_record_backend(text, uuid, jsonb) to service_role;

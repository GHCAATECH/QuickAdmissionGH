-- Keep restricted school users read-only even when they call the RPC directly.
create or replace function public.update_student_feature_settings(
  p_school uuid,
  p_allow_passport_photo boolean,
  p_allow_house_selection boolean,
  p_allow_class_selection boolean,
  p_force_enrolment_upload boolean
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
  updated_config public.school_config%rowtype;
begin
  select *
    into caller_profile
    from public.profiles
   where id = auth.uid();

  if caller_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  caller_role := lower(replace(coalesce(caller_profile.role, ''), ' ', '_'));
  if caller_role not in ('school_admin', 'super_admin') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if caller_role = 'school_admin' then
    if caller_profile.school_id is distinct from p_school then
      return jsonb_build_object('ok', false, 'error', 'wrong_school');
    end if;

    is_co_admin := lower(coalesce(caller_profile.permissions ->> 'co_admin', '')) in ('true', '1');
    if caller_profile.permissions is not null and not is_co_admin then
      return jsonb_build_object('ok', false, 'error', 'owner_or_co_admin_required');
    end if;
  end if;

  update public.school_config
     set allow_passport_photo = coalesce(p_allow_passport_photo, false),
         allow_house_selection = coalesce(p_allow_house_selection, false),
         allow_class_selection = coalesce(p_allow_class_selection, true),
         force_enrolment_upload = coalesce(p_force_enrolment_upload, true)
   where school_id = p_school
   returning * into updated_config;

  if updated_config.school_id is null then
    return jsonb_build_object('ok', false, 'error', 'config_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'config', jsonb_build_object(
      'allow_passport_photo', updated_config.allow_passport_photo,
      'allow_house_selection', updated_config.allow_house_selection,
      'allow_class_selection', updated_config.allow_class_selection,
      'force_enrolment_upload', updated_config.force_enrolment_upload
    )
  );
end;
$$;

revoke all on function public.update_student_feature_settings(uuid, boolean, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.update_student_feature_settings(uuid, boolean, boolean, boolean, boolean)
  to authenticated;

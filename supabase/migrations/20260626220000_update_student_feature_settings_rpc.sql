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
  updated_config public.school_config%rowtype;
begin
  select *
    into caller_profile
    from public.profiles
   where id = auth.uid();

  if caller_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if lower(replace(coalesce(caller_profile.role, ''), ' ', '_')) not in ('school_admin', 'super_admin') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if lower(replace(coalesce(caller_profile.role, ''), ' ', '_')) = 'school_admin'
     and caller_profile.school_id is distinct from p_school then
    return jsonb_build_object('ok', false, 'error', 'wrong_school');
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

revoke all on function public.update_student_feature_settings(uuid, boolean, boolean, boolean, boolean) from public;
grant execute on function public.update_student_feature_settings(uuid, boolean, boolean, boolean, boolean) to authenticated;

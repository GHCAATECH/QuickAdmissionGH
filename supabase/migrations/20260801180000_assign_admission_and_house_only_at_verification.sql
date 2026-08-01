-- Personal-record submission stores the form only. Admission numbers and houses
-- are assigned together, and only by the authorized campus-verification RPC.

create or replace function public.submit_application(
  p_index text,
  p_token text,
  payload jsonb,
  p_school uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  stu public.students%rowtype;
  cfg public.school_config%rowtype;
  sid uuid;
  ncount integer;
  cleaned_payload jsonb;
  merged_records jsonb;
  effective_submitted_at timestamptz;
  selected_class_id uuid;
  enrolment_form_url_value text;
  documents_done_value boolean;
begin
  payload := coalesce(payload, '{}'::jsonb);

  -- These values are owned by campus verification, never by the student form.
  cleaned_payload := payload
    - 'admission_no'
    - 'admission_number'
    - 'permanent_admission_number'
    - 'school_no'
    - 'house'
    - 'house_id'
    - 'house_name';

  select count(*)
    into ncount
  from public.students
  where bece_index = p_index
    and (p_school is null or school_id = p_school);

  if ncount = 0 then
    return jsonb_build_object('ok', false, 'error', 'index');
  end if;

  if ncount > 1 then
    return jsonb_build_object('ok', false, 'error', 'ambiguous');
  end if;

  select *
    into stu
  from public.students
  where bece_index = p_index
    and (p_school is null or school_id = p_school)
  for update;

  if upper(coalesce(stu.admission_token, '')) <> upper(coalesce(p_token, '')) then
    return jsonb_build_object('ok', false, 'error', 'token');
  end if;

  sid := stu.school_id;

  select *
    into cfg
  from public.school_config
  where school_id = sid;

  if upper(coalesce(cfg.admission_status, 'OPENED')) = 'CLOSED' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  if nullif(btrim(coalesce(cleaned_payload ->> 'class_id', '')), '') is not null then
    select id
      into selected_class_id
    from public.classrooms
    where school_id = sid
      and id::text = btrim(cleaned_payload ->> 'class_id')
      and (stu.programme_id is null or programme_id is null or programme_id = stu.programme_id)
    limit 1;
  end if;

  merged_records := coalesce(stu.records, '{}'::jsonb)
    - 'admission_no'
    - 'admission_number'
    - 'permanent_admission_number'
    - 'school_no'
    - 'house'
    - 'house_id'
    - 'house_name';
  merged_records := merged_records || cleaned_payload;
  effective_submitted_at := coalesce(stu.submitted_at, now());

  documents_done_value := case
    when lower(coalesce(cleaned_payload ->> 'enrolment_uploaded', '')) in ('true', 't', '1', 'yes', 'y') then true
    when lower(coalesce(cleaned_payload ->> 'enrolment_uploaded', '')) in ('false', 'f', '0', 'no', 'n') then false
    else coalesce(stu.documents_done, false)
  end;

  enrolment_form_url_value := case
    when cleaned_payload ? 'enrolment_form_url' then nullif(btrim(cleaned_payload ->> 'enrolment_form_url'), '')
    else stu.enrolment_form_url
  end;

  update public.students
  set records = merged_records,
      parent_phone = coalesce(nullif(btrim(cleaned_payload ->> 'sms_contact'), ''), parent_phone),
      class_id = coalesce(selected_class_id, class_id),
      enrolment_form_url = enrolment_form_url_value,
      personal_done = true,
      programme_done = true,
      undertaking_done = true,
      documents_done = documents_done_value,
      submitted_at = effective_submitted_at,
      status = case
        when lower(coalesce(nullif(btrim(status), ''), '')) in ('approved', 'enrolled', 'rejected') then status
        else 'pending'
      end
  where id = stu.id;

  return jsonb_build_object('ok', true, 'submitted', true, 'admission_no', null);
end
$function$;

revoke all on function public.submit_application(text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.submit_application(text, text, jsonb, uuid) to service_role;

create or replace function public.verify_campus_student_backend(
  p_student_id uuid,
  p_actor_id uuid,
  p_notes text default null,
  p_user_agent text default null,
  p_ip_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor public.profiles%rowtype;
  stu public.students%rowtype;
  sch public.schools%rowtype;
  seq public.student_verification_sequences%rowtype;
  placement_gender text;
  placement_residential text;
  student_gender text;
  student_residential text;
  existing_number text;
  final_number text;
  final_house_id uuid;
  final_house_name text;
  admission_year_text text;
  school_code_text text;
  next_number integer;
  actor_label text;
  note_text text;
  was_already_verified boolean;
begin
  select * into actor from public.profiles where id = p_actor_id;
  if actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Verification requires a valid signed-in user.');
  end if;

  select * into stu
  from public.students
  where id = p_student_id
  for update;

  if stu.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Student not found.');
  end if;

  if actor.role <> 'super_admin' and actor.school_id is distinct from stu.school_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You cannot verify students from another school.');
  end if;

  if not public.can_verify_students_backend(actor) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You do not have permission to verify students.');
  end if;

  if stu.submitted_at is null then
    return jsonb_build_object('ok', false, 'error', 'not_admitted', 'message', 'Only submitted admitted students can be verified.');
  end if;

  if lower(coalesce(stu.status, '')) = 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'Rejected students cannot be verified.');
  end if;

  -- Preserve both legacy application numbers and permanent numbers. A legacy
  -- number is promoted as the final verified number instead of being replaced.
  existing_number := coalesce(
    nullif(btrim(stu.permanent_admission_number), ''),
    nullif(btrim(stu.admission_no), '')
  );
  final_number := existing_number;
  final_house_id := stu.house_id;
  was_already_verified :=
    lower(coalesce(stu.verification_status, 'pending')) = 'verified'
    and existing_number is not null
    and final_house_id is not null;

  if final_house_id is not null then
    select name into final_house_name
    from public.houses
    where id = final_house_id and school_id = stu.school_id;
  else
    select pl.gender, pl.residential_status
      into placement_gender, placement_residential
    from public.placement_list pl
    where pl.school_id = stu.school_id
      and pl.index_number = stu.bece_index
    limit 1;

    student_gender := upper(regexp_replace(coalesce(nullif(stu.gender, ''), placement_gender, ''), '[^A-Z]', '', 'g'));
    if student_gender in ('M', 'MALE', 'BOY') then
      student_gender := 'MALE';
    elsif student_gender in ('F', 'FEMALE', 'GIRL') then
      student_gender := 'FEMALE';
    else
      return jsonb_build_object('ok', false, 'error', 'gender_required', 'message', 'Set the student gender before verification.');
    end if;

    student_residential := upper(regexp_replace(coalesce(
      nullif(placement_residential, ''),
      nullif(stu.records ->> 'residential_status', ''),
      nullif(stu.records ->> 'residential', ''),
      ''
    ), '[^A-Z]', '', 'g'));
    if student_residential in ('B', 'BOARDER', 'BOARDING', 'RESIDENT') then
      student_residential := 'BOARDING';
    elsif student_residential in ('D', 'DAY', 'DAYSTUDENT') then
      student_residential := 'DAY';
    else
      return jsonb_build_object('ok', false, 'error', 'residential_required', 'message', 'Set the student residential status to Boarding or Day before verification.');
    end if;

    -- Serialize allocation for each school/gender/residential group so capacity
    -- cannot be overbooked by concurrent verification requests.
    perform pg_advisory_xact_lock(hashtextextended(
      stu.school_id::text || '|verification-house|' || student_gender || '|' || student_residential,
      0
    ));

    select h.id, h.name
      into final_house_id, final_house_name
    from public.houses h
    where h.school_id = stu.school_id
      and h.priority is not null
      and h.priority >= 1
      and h.capacity is not null
      and h.capacity >= 1
      and case
        when upper(regexp_replace(coalesce(h.gender, ''), '[^A-Z]', '', 'g')) in ('M', 'MALE', 'BOY') then 'MALE'
        when upper(regexp_replace(coalesce(h.gender, ''), '[^A-Z]', '', 'g')) in ('F', 'FEMALE', 'GIRL') then 'FEMALE'
        else ''
      end = student_gender
      and case
        when upper(regexp_replace(coalesce(h.residential_type, ''), '[^A-Z]', '', 'g')) in ('B', 'BOARDER', 'BOARDING', 'RESIDENT') then 'BOARDING'
        when upper(regexp_replace(coalesce(h.residential_type, ''), '[^A-Z]', '', 'g')) in ('D', 'DAY', 'DAYSTUDENT') then 'DAY'
        else ''
      end = student_residential
      and (
        select count(*)
        from public.students occupied
        where occupied.house_id = h.id
          and occupied.id <> stu.id
      ) < h.capacity
    order by h.priority asc, h.name asc, h.id asc
    limit 1;

    if final_house_id is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'no_available_house',
        'message', 'No matching house with available capacity is configured for this student.'
      );
    end if;
  end if;

  if final_number is null then
    select * into sch from public.schools where id = stu.school_id;
    school_code_text := upper(regexp_replace(coalesce(nullif(btrim(sch.school_code), ''), nullif(btrim(sch.code), ''), ''), '[^A-Z0-9]+', '', 'g'));
    if school_code_text = '' then
      return jsonb_build_object('ok', false, 'error', 'missing_school_code', 'message', 'This school is missing a school code.');
    end if;

    admission_year_text := public.verification_year_text(stu.school_id);
    if admission_year_text is null or admission_year_text = '' then
      return jsonb_build_object('ok', false, 'error', 'missing_academic_year', 'message', 'This school is missing an admission year.');
    end if;

    insert into public.student_verification_sequences (school_id, academic_year, last_number)
    values (stu.school_id, admission_year_text, 0)
    on conflict (school_id, academic_year) do nothing;

    select * into seq
    from public.student_verification_sequences
    where school_id = stu.school_id
      and academic_year = admission_year_text
    for update;

    next_number := coalesce(seq.last_number, 0) + 1;
    final_number := school_code_text || '/' || admission_year_text || '/' || lpad(next_number::text, 4, '0');

    update public.student_verification_sequences
    set last_number = next_number
    where id = seq.id;
  end if;

  note_text := nullif(btrim(coalesce(p_notes, '')), '');

  update public.students
  set verification_status = 'verified',
      verified_at = coalesce(verified_at, now()),
      verified_by = coalesce(verified_by, p_actor_id),
      verification_notes = coalesce(note_text, verification_notes),
      permanent_admission_number = coalesce(nullif(btrim(permanent_admission_number), ''), final_number),
      house_id = coalesce(house_id, final_house_id),
      verification_reversed_at = null,
      verification_reversed_by = null,
      verification_reversal_reason = null,
      status = case when lower(coalesce(status, '')) in ('', 'pending', 'approved') then 'enrolled' else status end
  where id = stu.id;

  actor_label := coalesce(nullif(btrim(actor.full_name), ''), nullif(btrim(actor.email), ''), 'System');

  if not was_already_verified then
    insert into public.student_verification_audit (
      school_id, student_id, actor_id, action, previous_status, new_status,
      previous_permanent_admission_number, permanent_admission_number, notes, ip_address, user_agent
    ) values (
      stu.school_id, stu.id, p_actor_id, 'verified', stu.verification_status, 'verified',
      nullif(btrim(stu.permanent_admission_number), ''), final_number, note_text,
      nullif(btrim(coalesce(p_ip_address, '')), ''), nullif(btrim(coalesce(p_user_agent, '')), '')
    );

    insert into public.activity_log (school_id, actor, action)
    values (
      stu.school_id,
      actor_label,
      'Verified student ' || coalesce(nullif(btrim(stu.full_name), ''), stu.bece_index)
        || ' - Permanent Admission Number ' || final_number
        || ' - House ' || coalesce(final_house_name, final_house_id::text)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'student_id', stu.id,
    'verification_status', 'verified',
    'permanent_admission_number', final_number,
    'house_id', final_house_id,
    'house_name', final_house_name,
    'verified_at', coalesce(stu.verified_at, now()),
    'verified_by', coalesce(stu.verified_by, p_actor_id),
    'already_verified', was_already_verified
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'duplicate_admission_number', 'message', 'A duplicate permanent admission number was prevented. Please try again.');
end;
$$;

revoke all on function public.verify_campus_student_backend(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.verify_campus_student_backend(uuid, uuid, text, text, text) to service_role;

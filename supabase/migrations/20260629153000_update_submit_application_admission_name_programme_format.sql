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
  ncount int;
  merged_records jsonb;
  effective_submitted_at timestamptz;
  admission_year_text text;
  programme_name text;
  programme_code_raw text;
  programme_code text;
  placement_programme text;
  fallback_name text;
  existing_admission_no text;
  final_admission_no text;
  selected_class_id uuid;
  selected_house_id uuid;
  enrolment_form_url_value text;
  documents_done_value boolean;
  prior_count int := 0;
  full_name_source text;
  name_initials text;
begin
  payload := coalesce(payload, '{}'::jsonb);
  merged_records := payload;

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

  if stu.programme_id is not null then
    select code, name
      into programme_code_raw, programme_name
    from public.programmes
    where id = stu.programme_id;
  end if;

  select programme
    into placement_programme
  from public.placement_list
  where school_id = sid
    and index_number = p_index
  limit 1;

  if nullif(btrim(coalesce(payload ->> 'class_id', '')), '') is not null then
    select id
      into selected_class_id
    from public.classrooms
    where school_id = sid
      and id::text = btrim(payload ->> 'class_id')
      and (stu.programme_id is null or programme_id is null or programme_id = stu.programme_id)
    limit 1;
  end if;

  if nullif(btrim(coalesce(payload ->> 'house_id', '')), '') is not null then
    select id
      into selected_house_id
    from public.houses
    where school_id = sid
      and id::text = btrim(payload ->> 'house_id')
    limit 1;
  end if;

  merged_records := coalesce(stu.records, '{}'::jsonb) || merged_records;

  effective_submitted_at := coalesce(stu.submitted_at, now());

  admission_year_text := nullif(regexp_replace(coalesce(cfg.admission_year::text, ''), '[^0-9]', '', 'g'), '');
  if admission_year_text is null or length(admission_year_text) < 4 then
    admission_year_text := substring(coalesce(cfg.academic_year, '') from '([0-9]{4})');
  end if;
  if admission_year_text is null or length(admission_year_text) < 4 then
    admission_year_text := to_char(effective_submitted_at, 'YYYY');
  end if;
  admission_year_text := left(admission_year_text, 4);

  full_name_source := coalesce(
    nullif(btrim(stu.full_name), ''),
    nullif(btrim(merged_records ->> 'full_name'), ''),
    nullif(btrim(merged_records ->> 'student_name'), ''),
    nullif(btrim(merged_records ->> 'surname'), ''),
    'Student'
  );

  select coalesce(string_agg(left(part, 1), '' order by ord), '')
    into name_initials
  from regexp_split_to_table(upper(full_name_source), '[^A-Z0-9]+') with ordinality as parts(part, ord)
  where btrim(part) <> '';

  name_initials := upper(regexp_replace(coalesce(name_initials, ''), '[^A-Z0-9]+', '', 'g'));
  if name_initials = '' then
    name_initials := upper(left(regexp_replace(full_name_source, '[^A-Za-z0-9]+', '', 'g'), 4));
  end if;
  name_initials := left(coalesce(nullif(name_initials, ''), 'STU'), 6);

  programme_code := upper(regexp_replace(coalesce(programme_code_raw, ''), '[^A-Z0-9]+', '', 'g'));
  if programme_code = '' then
    fallback_name := coalesce(nullif(btrim(programme_name), ''), nullif(btrim(placement_programme), ''), 'GENERAL');
    select coalesce(string_agg(left(part, 1), ''), '')
      into programme_code
    from regexp_split_to_table(upper(fallback_name), '\s+') as part
    where btrim(part) <> '';

    programme_code := upper(regexp_replace(coalesce(programme_code, ''), '[^A-Z0-9]+', '', 'g'));
    if programme_code = '' then
      programme_code := upper(left(regexp_replace(fallback_name, '[^A-Za-z0-9]+', '', 'g'), 6));
    end if;
  end if;
  programme_code := left(coalesce(nullif(programme_code, ''), 'GEN'), 11);

  existing_admission_no := nullif(btrim(stu.admission_no), '');
  final_admission_no := existing_admission_no;

  if final_admission_no is null then
    perform pg_advisory_xact_lock(
      hashtext(
        sid::text || '|' || admission_year_text
      )
    );

    select count(*)
      into prior_count
    from public.students st
    where st.school_id = sid
      and st.id <> stu.id
      and st.submitted_at is not null
      and extract(year from coalesce(st.submitted_at, st.created_at, effective_submitted_at))::int = admission_year_text::int
      and (
        st.submitted_at < effective_submitted_at
        or (st.submitted_at = effective_submitted_at and st.id::text < stu.id::text)
      );

    final_admission_no := name_initials || '/' || programme_code || '/' || admission_year_text || '/' || lpad((prior_count + 1)::text, 4, '0');
  end if;

  documents_done_value :=
    case
      when lower(coalesce(payload ->> 'enrolment_uploaded', '')) in ('true', 't', '1', 'yes', 'y') then true
      when lower(coalesce(payload ->> 'enrolment_uploaded', '')) in ('false', 'f', '0', 'no', 'n') then false
      else coalesce(stu.documents_done, false)
    end;

  enrolment_form_url_value :=
    case
      when payload ? 'enrolment_form_url' then nullif(btrim(payload ->> 'enrolment_form_url'), '')
      else stu.enrolment_form_url
    end;

  update public.students
  set records = merged_records,
      parent_phone = coalesce(nullif(btrim(payload ->> 'sms_contact'), ''), parent_phone),
      class_id = coalesce(selected_class_id, class_id),
      house_id = coalesce(selected_house_id, house_id),
      enrolment_form_url = enrolment_form_url_value,
      personal_done = true,
      programme_done = true,
      undertaking_done = true,
      documents_done = documents_done_value,
      submitted_at = effective_submitted_at,
      admission_no = final_admission_no,
      status = case
        when lower(coalesce(nullif(btrim(status), ''), '')) in ('approved', 'enrolled', 'rejected') then status
        else 'pending'
      end
  where id = stu.id;

  return jsonb_build_object(
    'ok', true,
    'admission_no', final_admission_no
  );
end
$function$;

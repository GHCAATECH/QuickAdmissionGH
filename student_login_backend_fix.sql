CREATE OR REPLACE FUNCTION public.student_login(p_index text, p_token text, p_school uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s_id uuid;
  stu record;
  sch record;
  cfg record;
  prog text;
  cls text;
  hse text;
  res text;
  sms text;
  onames text;
  agg int;
  progs jsonb;
  classes jsonb;
  ncount int;
  pl_prog text;
  pl_gender text;
  final_prog text;
  final_gender text;
  was_logged_in boolean := false;
begin
  select count(*) into ncount
  from public.students
  where bece_index = p_index
    and (p_school is null or school_id = p_school);

  if ncount = 0 then
    return jsonb_build_object('ok', false, 'error', 'index');
  end if;

  if ncount > 1 then
    return jsonb_build_object('ok', false, 'error', 'ambiguous');
  end if;

  select * into stu
  from public.students
  where bece_index = p_index
    and (p_school is null or school_id = p_school);

  if upper(stu.admission_token) <> upper(p_token) then
    return jsonb_build_object('ok', false, 'error', 'token');
  end if;

  s_id := stu.school_id;

  select * into sch from public.schools where id = s_id;
  select * into cfg from public.school_config where school_id = s_id;

  select
    coalesce(logged_in, false),
    residential_status,
    sms_contact,
    other_names,
    aggregate,
    programme,
    gender
  into was_logged_in, res, sms, onames, agg, pl_prog, pl_gender
  from public.placement_list
  where school_id = s_id
    and index_number = p_index;

  was_logged_in := coalesce(was_logged_in, false);

  update public.placement_list
  set logged_in = true
  where school_id = s_id
    and index_number = p_index;

  select name into prog from public.programmes where id = stu.programme_id;
  select name into cls  from public.classrooms where id = stu.class_id;
  select name into hse  from public.houses where id = stu.house_id;

  final_prog := coalesce(prog, nullif(trim(pl_prog), ''));

  final_gender := case
    when stu.gender = 'M' then 'MALE'
    when stu.gender = 'F' then 'FEMALE'
    when coalesce(trim(stu.gender), '') <> '' then upper(stu.gender)
    when upper(coalesce(trim(pl_gender), '')) in ('M', 'MALE') then 'MALE'
    when upper(coalesce(trim(pl_gender), '')) in ('F', 'FEMALE') then 'FEMALE'
    when coalesce(trim(pl_gender), '') <> '' then upper(pl_gender)
    else ''
  end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', id, 'code', code, 'name', name, 'subjects', subjects)
      order by code
    ),
    '[]'
  )
  into progs
  from public.programmes
  where school_id = s_id
    and is_active;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cr.id,
        'name', cr.name,
        'programme_id', cr.programme_id,
        'subjects', cr.subjects,
        'seats', greatest(
          cr.capacity - (
            select count(*)
            from public.students st
            where st.class_id = cr.id
          ),
          0
        )
      )
      order by cr.name
    ),
    '[]'
  )
  into classes
  from public.classrooms cr
  where cr.school_id = s_id;

  return jsonb_build_object(
    'ok', true,
    'show_disclaimer', not was_logged_in,
    'student', jsonb_build_object(
      'index', stu.bece_index,
      'full_name', stu.full_name,
      'surname', stu.full_name,
      'other_names', onames,
      'school_no', stu.admission_no,
      'aggregate', agg,
      'programme', final_prog,
      'programme_id', stu.programme_id,
      'class', cls,
      'class_id', stu.class_id,
      'house', hse,
      'gender', final_gender,
      'residential', res,
      'contact', coalesce(
        nullif(btrim(stu.records ->> 'sms_contact'), ''),
        nullif(btrim(sms), ''),
        nullif(btrim(stu.parent_phone), '')
      ),
      'personal_done', stu.personal_done,
      'programme_done', stu.programme_done,
      'undertaking_done', stu.undertaking_done,
      'documents_done', stu.documents_done,
      'submitted', stu.submitted_at is not null,
      'records', stu.records
    ),
    'school', jsonb_build_object(
      'code', sch.code,
      'name', sch.name,
      'address', sch.address,
      'phone', sch.phone,
      'helpdesk', sch.helpdesk,
      'crest_url', sch.crest_url,
      'theme_color', sch.theme_color,
      'headmaster_name', sch.headmaster_name
    ),
    'config', jsonb_build_object(
      'academic_year', cfg.academic_year,
      'service_charge', cfg.service_charge,
      'reopening_date', cfg.reopening_date,
      'reopening_time', cfg.reopening_time,
      'letter_template', cfg.letter_template,
      'records_template', cfg.records_template,
      'prospectus_url', cfg.prospectus_url,
      'undertaking_url', cfg.undertaking_url,
      'subjects_url', cfg.subjects_url,
      'req_docs', jsonb_build_array(
        cfg.req_doc_line1,
        cfg.req_doc_line2,
        cfg.req_doc_line3,
        cfg.req_doc_line4,
        cfg.req_doc_line5
      )
    ),
    'programmes', progs,
    'classes', classes
  );
end
$function$;

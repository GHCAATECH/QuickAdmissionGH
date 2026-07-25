create index if not exists schools_code_idx
  on public.schools (upper(coalesce(school_code, code)));

create index if not exists school_config_school_id_idx
  on public.school_config (school_id);

create index if not exists programmes_school_code_idx
  on public.programmes (school_id, code);

create index if not exists programmes_school_name_idx
  on public.programmes (school_id, name);

create index if not exists houses_school_name_idx
  on public.houses (school_id, name);

create index if not exists houses_school_priority_idx
  on public.houses (school_id, priority, name);

create index if not exists classrooms_school_name_idx
  on public.classrooms (school_id, name);

create index if not exists classrooms_school_programme_idx
  on public.classrooms (school_id, programme_id, name);

create index if not exists students_school_bece_idx
  on public.students (school_id, bece_index);

create index if not exists students_school_created_idx
  on public.students (school_id, created_at desc);

create index if not exists students_school_submitted_idx
  on public.students (school_id, submitted_at desc)
  where submitted_at is not null;

create index if not exists students_school_status_idx
  on public.students (school_id, status);

create index if not exists students_school_payment_status_idx
  on public.students (school_id, payment_status);

create index if not exists students_school_programme_created_idx
  on public.students (school_id, programme_id, created_at desc);

create index if not exists students_school_class_created_idx
  on public.students (school_id, class_id, created_at desc);

create index if not exists students_school_house_created_idx
  on public.students (school_id, house_id, created_at desc);

create index if not exists placement_list_school_index_idx
  on public.placement_list (school_id, index_number);

create index if not exists placement_list_school_logged_in_idx
  on public.placement_list (school_id, logged_in);

create index if not exists placement_list_school_programme_idx
  on public.placement_list (school_id, programme);

create index if not exists payments_school_created_idx
  on public.payments (school_id, created_at desc);

create index if not exists payments_school_status_created_idx
  on public.payments (school_id, status, created_at desc);

create index if not exists payments_school_student_idx
  on public.payments (school_id, student_id);

create unique index if not exists payments_reference_unique_idx
  on public.payments (reference)
  where reference is not null and btrim(reference) <> '';

create index if not exists activity_log_school_created_idx
  on public.activity_log (school_id, created_at desc);

do $$
begin
  if to_regclass('public.sms_logs') is not null then
    create index if not exists sms_logs_school_sent_idx
      on public.sms_logs (school_id, sent_at desc);
    create index if not exists sms_logs_school_external_idx
      on public.sms_logs (school_id, external_id);
  end if;

  if to_regclass('public.sms_log') is not null then
    create index if not exists sms_log_school_sent_idx
      on public.sms_log (school_id, sent_at desc);
  end if;
end $$;

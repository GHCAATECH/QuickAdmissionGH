create index if not exists profiles_school_id_idx
  on public.profiles (school_id);

create index if not exists school_sms_templates_school_id_idx
  on public.school_sms_templates (school_id);

create index if not exists tokens_school_student_idx
  on public.tokens (school_id, student_id);

alter table public.students
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid,
  add column if not exists verification_notes text,
  add column if not exists permanent_admission_number text,
  add column if not exists verification_reversed_at timestamptz,
  add column if not exists verification_reversed_by uuid,
  add column if not exists verification_reversal_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'students_verification_status_chk'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_verification_status_chk
      check (verification_status in ('pending','verified','documents_incomplete','rejected'));
  end if;
end $$;

update public.students
set verification_status = case
  when lower(coalesce(status,'')) = 'rejected' then 'rejected'
  when coalesce(nullif(btrim(permanent_admission_number),''), null) is not null then 'verified'
  else coalesce(nullif(btrim(verification_status),''),'pending')
end
where verification_status is null
   or verification_status not in ('pending','verified','documents_incomplete','rejected');

create unique index if not exists students_permanent_admission_number_key
  on public.students (upper(permanent_admission_number))
  where permanent_admission_number is not null and btrim(permanent_admission_number) <> '';

create index if not exists students_school_verification_status_idx
  on public.students (school_id, verification_status);
create index if not exists students_school_verified_at_idx
  on public.students (school_id, verified_at desc);
create index if not exists students_school_gender_idx
  on public.students (school_id, gender);
create index if not exists students_school_programme_idx
  on public.students (school_id, programme_id);
create index if not exists students_school_class_idx
  on public.students (school_id, class_id);
create index if not exists students_school_house_idx
  on public.students (school_id, house_id);
create index if not exists students_school_permanent_no_idx
  on public.students (school_id, upper(permanent_admission_number));

create table if not exists public.student_verification_sequences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year text not null,
  last_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_verification_sequences_last_number_chk check (last_number >= 0),
  constraint student_verification_sequences_school_year_key unique (school_id, academic_year)
);

create table if not exists public.student_verification_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_status text,
  new_status text,
  previous_permanent_admission_number text,
  permanent_admission_number text,
  notes text,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists student_verification_audit_school_created_idx
  on public.student_verification_audit (school_id, created_at desc);
create index if not exists student_verification_audit_student_created_idx
  on public.student_verification_audit (student_id, created_at desc);

create or replace function public.touch_student_verification_sequence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_student_verification_sequences_updated_at on public.student_verification_sequences;
create trigger trg_student_verification_sequences_updated_at
before update on public.student_verification_sequences
for each row execute function public.touch_student_verification_sequence_updated_at();

create or replace function public.verification_year_text(p_school_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cfg public.school_config%rowtype;
  year_text text;
begin
  select * into cfg
  from public.school_config
  where school_id = p_school_id;

  year_text := nullif(regexp_replace(coalesce(cfg.admission_year::text, ''), '[^0-9]', '', 'g'), '');
  if year_text is null or length(year_text) < 4 then
    year_text := substring(coalesce(cfg.academic_year, '') from '([0-9]{4})');
  end if;
  if year_text is null or length(year_text) < 4 then
    year_text := to_char(now(), 'YYYY');
  end if;

  return left(year_text, 4);
end;
$$;

create or replace function public.can_verify_students_backend(p_profile public.profiles)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_profile.role = 'super_admin' then
    return true;
  end if;
  if p_profile.role <> 'school_admin' then
    return false;
  end if;
  if p_profile.permissions is null then
    return true;
  end if;
  if coalesce((p_profile.permissions ->> 'co_admin')::boolean, false) then
    return true;
  end if;
  return coalesce((p_profile.permissions ->> 'verify_students')::boolean, false);
exception when others then
  return false;
end;
$$;

create or replace function public.can_edit_verification_notes_backend(p_profile public.profiles)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_profile.role = 'super_admin' then
    return true;
  end if;
  if p_profile.role <> 'school_admin' then
    return false;
  end if;
  if p_profile.permissions is null then
    return true;
  end if;
  if coalesce((p_profile.permissions ->> 'co_admin')::boolean, false) then
    return true;
  end if;
  return coalesce((p_profile.permissions ->> 'edit_verification_notes')::boolean, false);
exception when others then
  return false;
end;
$$;

create or replace function public.can_reverse_student_verification_backend(p_profile public.profiles)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_profile.role = 'super_admin' then
    return true;
  end if;
  if p_profile.role <> 'school_admin' then
    return false;
  end if;
  if p_profile.permissions is null then
    return true;
  end if;
  return coalesce((p_profile.permissions ->> 'reverse_student_verification')::boolean, false);
exception when others then
  return false;
end;
$$;

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
  existing_number text;
  admission_year_text text;
  school_code_text text;
  next_number integer;
  final_number text;
  actor_label text;
  note_text text;
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

  if lower(coalesce(stu.status,'')) = 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'Rejected students cannot be verified.');
  end if;

  existing_number := nullif(btrim(stu.permanent_admission_number), '');
  if lower(coalesce(stu.verification_status,'pending')) = 'verified' and existing_number is not null then
    return jsonb_build_object(
      'ok', true,
      'already_verified', true,
      'verification_status', 'verified',
      'permanent_admission_number', existing_number,
      'verified_at', stu.verified_at,
      'student_id', stu.id
    );
  end if;

  select * into sch from public.schools where id = stu.school_id;
  school_code_text := upper(regexp_replace(coalesce(nullif(btrim(sch.school_code),''), nullif(btrim(sch.code),''), ''), '[^A-Z0-9]+', '', 'g'));
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
  note_text := nullif(btrim(coalesce(p_notes,'')), '');

  update public.student_verification_sequences
  set last_number = next_number
  where id = seq.id;

  update public.students
  set verification_status = 'verified',
      verified_at = now(),
      verified_by = p_actor_id,
      verification_notes = coalesce(note_text, verification_notes),
      permanent_admission_number = coalesce(existing_number, final_number),
      verification_reversed_at = null,
      verification_reversed_by = null,
      verification_reversal_reason = null,
      status = case when lower(coalesce(status,'')) in ('', 'pending', 'approved') then 'enrolled' else status end
  where id = stu.id;

  actor_label := coalesce(nullif(btrim(actor.full_name),''), nullif(btrim(actor.email),''), 'System');

  insert into public.student_verification_audit (
    school_id, student_id, actor_id, action, previous_status, new_status,
    previous_permanent_admission_number, permanent_admission_number, notes, ip_address, user_agent
  ) values (
    stu.school_id, stu.id, p_actor_id, 'verified', stu.verification_status, 'verified',
    existing_number, coalesce(existing_number, final_number), note_text, nullif(btrim(coalesce(p_ip_address,'')), ''), nullif(btrim(coalesce(p_user_agent,'')), '')
  );

  insert into public.activity_log (school_id, actor, action)
  values (stu.school_id, actor_label, 'Verified student ' || coalesce(nullif(btrim(stu.full_name),''), stu.bece_index) || ' - Permanent Admission Number ' || coalesce(existing_number, final_number));

  return jsonb_build_object(
    'ok', true,
    'student_id', stu.id,
    'verification_status', 'verified',
    'permanent_admission_number', coalesce(existing_number, final_number),
    'verified_at', now(),
    'verified_by', p_actor_id,
    'already_verified', false
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'duplicate_admission_number', 'message', 'A duplicate permanent admission number was prevented. Please try again.');
end;
$$;

create or replace function public.mark_student_documents_incomplete_backend(
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
  actor_label text;
  note_text text;
begin
  select * into actor from public.profiles where id = p_actor_id;
  if actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Verification requires a valid signed-in user.');
  end if;

  select * into stu from public.students where id = p_student_id for update;
  if stu.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Student not found.');
  end if;

  if actor.role <> 'super_admin' and actor.school_id is distinct from stu.school_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You cannot update students from another school.');
  end if;

  if not public.can_verify_students_backend(actor) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You do not have permission to update verification status.');
  end if;

  if lower(coalesce(stu.verification_status,'pending')) = 'verified' then
    return jsonb_build_object('ok', false, 'error', 'already_verified', 'message', 'Verified students cannot be marked incomplete. Reverse verification first.');
  end if;

  note_text := nullif(btrim(coalesce(p_notes,'')), '');

  update public.students
  set verification_status = 'documents_incomplete',
      verification_notes = coalesce(note_text, verification_notes),
      verified_at = null,
      verified_by = null
  where id = stu.id;

  actor_label := coalesce(nullif(btrim(actor.full_name),''), nullif(btrim(actor.email),''), 'System');
  insert into public.student_verification_audit (
    school_id, student_id, actor_id, action, previous_status, new_status,
    previous_permanent_admission_number, permanent_admission_number, notes, ip_address, user_agent
  ) values (
    stu.school_id, stu.id, p_actor_id, 'documents_incomplete', stu.verification_status, 'documents_incomplete',
    stu.permanent_admission_number, stu.permanent_admission_number, note_text, nullif(btrim(coalesce(p_ip_address,'')), ''), nullif(btrim(coalesce(p_user_agent,'')), '')
  );
  insert into public.activity_log (school_id, actor, action)
  values (stu.school_id, actor_label, 'Marked documents incomplete for ' || coalesce(nullif(btrim(stu.full_name),''), stu.bece_index));

  return jsonb_build_object('ok', true, 'student_id', stu.id, 'verification_status', 'documents_incomplete');
end;
$$;

create or replace function public.update_student_verification_notes_backend(
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
  actor_label text;
  note_text text;
begin
  select * into actor from public.profiles where id = p_actor_id;
  if actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Verification requires a valid signed-in user.');
  end if;

  select * into stu from public.students where id = p_student_id for update;
  if stu.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Student not found.');
  end if;

  if actor.role <> 'super_admin' and actor.school_id is distinct from stu.school_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You cannot update students from another school.');
  end if;

  if not public.can_edit_verification_notes_backend(actor) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You do not have permission to edit verification notes.');
  end if;

  note_text := nullif(btrim(coalesce(p_notes,'')), '');

  update public.students
  set verification_notes = note_text
  where id = stu.id;

  actor_label := coalesce(nullif(btrim(actor.full_name),''), nullif(btrim(actor.email),''), 'System');
  insert into public.student_verification_audit (
    school_id, student_id, actor_id, action, previous_status, new_status,
    previous_permanent_admission_number, permanent_admission_number, notes, reason, ip_address, user_agent
  ) values (
    stu.school_id, stu.id, p_actor_id, 'notes_updated', stu.verification_status, stu.verification_status,
    stu.permanent_admission_number, stu.permanent_admission_number, note_text, stu.verification_notes, nullif(btrim(coalesce(p_ip_address,'')), ''), nullif(btrim(coalesce(p_user_agent,'')), '')
  );
  insert into public.activity_log (school_id, actor, action)
  values (stu.school_id, actor_label, 'Updated verification notes for ' || coalesce(nullif(btrim(stu.full_name),''), stu.bece_index));

  return jsonb_build_object('ok', true, 'student_id', stu.id, 'verification_notes', note_text);
end;
$$;

create or replace function public.reverse_student_verification_backend(
  p_student_id uuid,
  p_actor_id uuid,
  p_reason text,
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
  actor_label text;
  reason_text text;
  note_text text;
  previous_number text;
begin
  reason_text := nullif(btrim(coalesce(p_reason,'')), '');
  if reason_text is null then
    return jsonb_build_object('ok', false, 'error', 'validation', 'message', 'A reversal reason is required.');
  end if;

  select * into actor from public.profiles where id = p_actor_id;
  if actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Verification requires a valid signed-in user.');
  end if;

  select * into stu from public.students where id = p_student_id for update;
  if stu.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Student not found.');
  end if;

  if actor.role <> 'super_admin' and actor.school_id is distinct from stu.school_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You cannot reverse another school''s student.');
  end if;

  if not public.can_reverse_student_verification_backend(actor) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You do not have permission to reverse verification.');
  end if;

  if lower(coalesce(stu.verification_status,'pending')) <> 'verified' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'Only verified students can be reversed.');
  end if;

  previous_number := stu.permanent_admission_number;
  note_text := nullif(btrim(coalesce(p_notes,'')), '');

  update public.students
  set verification_status = 'pending',
      verified_at = null,
      verified_by = null,
      verification_notes = coalesce(note_text, verification_notes),
      verification_reversed_at = now(),
      verification_reversed_by = p_actor_id,
      verification_reversal_reason = reason_text,
      permanent_admission_number = null,
      status = case when lower(coalesce(status,'')) = 'enrolled' then 'pending' else status end
  where id = stu.id;

  actor_label := coalesce(nullif(btrim(actor.full_name),''), nullif(btrim(actor.email),''), 'System');
  insert into public.student_verification_audit (
    school_id, student_id, actor_id, action, previous_status, new_status,
    previous_permanent_admission_number, permanent_admission_number, notes, reason, ip_address, user_agent
  ) values (
    stu.school_id, stu.id, p_actor_id, 'reversed', stu.verification_status, 'pending',
    previous_number, null, note_text, reason_text, nullif(btrim(coalesce(p_ip_address,'')), ''), nullif(btrim(coalesce(p_user_agent,'')), '')
  );
  insert into public.activity_log (school_id, actor, action)
  values (stu.school_id, actor_label, 'Reversed verification for ' || coalesce(nullif(btrim(stu.full_name),''), stu.bece_index) || ' - Reason: ' || reason_text);

  return jsonb_build_object('ok', true, 'student_id', stu.id, 'verification_status', 'pending', 'previous_permanent_admission_number', previous_number);
end;
$$;

revoke all on function public.verify_campus_student_backend(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_student_documents_incomplete_backend(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_student_verification_notes_backend(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.reverse_student_verification_backend(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.verify_campus_student_backend(uuid, uuid, text, text, text) to service_role;
grant execute on function public.mark_student_documents_incomplete_backend(uuid, uuid, text, text, text) to service_role;
grant execute on function public.update_student_verification_notes_backend(uuid, uuid, text, text, text) to service_role;
grant execute on function public.reverse_student_verification_backend(uuid, uuid, text, text, text, text) to service_role;

-- Reverse verification releases both verification-owned identifiers. The next
-- successful verification reuses the lowest admission-number gap and allocates
-- a house afresh using occupancy first and configured priority as a tie-breaker.

do $migration$
declare
  definition text;
  old_sequence_block constant text := $old$
    next_number := coalesce(seq.last_number, 0) + 1;
    final_number := school_code_text || '/' || admission_year_text || '/' || lpad(next_number::text, 4, '0');

    update public.student_verification_sequences
    set last_number = next_number
    where id = seq.id;$old$;
  new_sequence_block constant text := $new$
    -- Reuse the lowest available serial before extending the sequence. The
    -- sequence row lock serializes concurrent verification requests.
    select candidate_number
      into next_number
    from generate_series(
      1,
      greatest(coalesce(seq.last_number, 0) + 1, 1)
    ) as candidates(candidate_number)
    where not exists (
      select 1
      from public.students used
      where used.school_id = stu.school_id
        and upper(coalesce(used.permanent_admission_number, '')) = upper(
          school_code_text || '/' || admission_year_text || '/' || lpad(candidate_number::text, 4, '0')
        )
    )
    order by candidate_number
    limit 1;

    final_number := school_code_text || '/' || admission_year_text || '/' || lpad(next_number::text, 4, '0');

    update public.student_verification_sequences
    set last_number = greatest(coalesce(last_number, 0), next_number)
    where id = seq.id;$new$;
begin
  select pg_get_functiondef(
    'public.verify_campus_student_backend(uuid,uuid,text,text,text)'::regprocedure
  ) into definition;

  if position('select candidate_number' in definition) = 0 then
    if position(old_sequence_block in definition) = 0 then
      raise exception 'Expected admission-number sequence block was not found in verify_campus_student_backend';
    end if;

    execute replace(definition, old_sequence_block, new_sequence_block);
  end if;
end;
$migration$;

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
  previous_house_id uuid;
  previous_house_name text;
begin
  reason_text := nullif(btrim(coalesce(p_reason, '')), '');

  select * into actor
  from public.profiles
  where id = p_actor_id;

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
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You cannot reverse another school''s student.');
  end if;

  if not public.can_reverse_student_verification_backend(actor) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'You do not have permission to reverse verification.');
  end if;

  if lower(coalesce(stu.verification_status, 'pending')) <> 'verified' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'Only verified students can be reversed.');
  end if;

  previous_number := nullif(btrim(stu.permanent_admission_number), '');
  previous_house_id := stu.house_id;
  note_text := nullif(btrim(coalesce(p_notes, '')), '');

  if previous_house_id is not null then
    select name into previous_house_name
    from public.houses
    where id = previous_house_id
      and school_id = stu.school_id;
  end if;

  update public.students
  set verification_status = 'pending',
      verified_at = null,
      verified_by = null,
      verification_notes = coalesce(note_text, verification_notes),
      verification_reversed_at = now(),
      verification_reversed_by = p_actor_id,
      verification_reversal_reason = reason_text,
      permanent_admission_number = null,
      admission_no = case
        when nullif(btrim(admission_no), '') = previous_number then null
        else admission_no
      end,
      house_id = null,
      records = coalesce(records, '{}'::jsonb)
        - 'admission_no'
        - 'admission_number'
        - 'permanent_admission_number'
        - 'school_no'
        - 'house'
        - 'house_id'
        - 'house_name',
      status = case when lower(coalesce(status, '')) = 'enrolled' then 'pending' else status end
  where id = stu.id;

  actor_label := coalesce(nullif(btrim(actor.full_name), ''), nullif(btrim(actor.email), ''), 'System');

  insert into public.student_verification_audit (
    school_id, student_id, actor_id, action, previous_status, new_status,
    previous_permanent_admission_number, permanent_admission_number, notes, reason, ip_address, user_agent
  ) values (
    stu.school_id, stu.id, p_actor_id, 'reversed', stu.verification_status, 'pending',
    previous_number, null, note_text, reason_text,
    nullif(btrim(coalesce(p_ip_address, '')), ''),
    nullif(btrim(coalesce(p_user_agent, '')), '')
  );

  insert into public.activity_log (school_id, actor, action)
  values (
    stu.school_id,
    actor_label,
    'Reversed verification for ' || coalesce(nullif(btrim(stu.full_name), ''), stu.bece_index)
      || coalesce(' - Released admission number ' || previous_number, '')
      || coalesce(' - Released house ' || previous_house_name, '')
      || coalesce(' - Note: ' || reason_text, '')
  );

  return jsonb_build_object(
    'ok', true,
    'student_id', stu.id,
    'verification_status', 'pending',
    'previous_permanent_admission_number', previous_number,
    'previous_house_id', previous_house_id,
    'previous_house_name', previous_house_name,
    'note', reason_text
  );
end;
$$;

revoke all on function public.reverse_student_verification_backend(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.reverse_student_verification_backend(uuid, uuid, text, text, text, text) to service_role;

comment on function public.verify_campus_student_backend(uuid, uuid, text, text, text)
is 'Verifies a submitted student, reuses the lowest permanent-number gap, and allocates the least occupied matching house with priority tie-breaking.';

comment on function public.reverse_student_verification_backend(uuid, uuid, text, text, text, text)
is 'Reverses verification with an optional note and releases the permanent admission number and house allocation.';

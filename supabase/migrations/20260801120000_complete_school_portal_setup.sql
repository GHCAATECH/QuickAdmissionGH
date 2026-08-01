-- Complete the school-admin -> student-portal configuration flow.
alter table public.school_config
  add column if not exists accept_online_payment boolean not null default true,
  add column if not exists announcement text,
  add column if not exists show_personal_records boolean not null default true,
  add column if not exists personal_records_caption text not null default 'PERSONAL RECORDS FORM',
  add column if not exists show_undertaking boolean not null default true,
  add column if not exists undertaking_caption text not null default 'UNDERTAKING / MEDICAL FORM',
  add column if not exists show_programme_selection boolean not null default true,
  add column if not exists programme_selection_caption text not null default 'PROGRAMME / SUBJECT COMBINATION';

-- Client-side validation is useful feedback, but final-submission requirements
-- must also be enforced at the database boundary.
create or replace function public.enforce_student_portal_submission_requirements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.school_config%rowtype;
  effective_programme_id uuid;
  inferred_programme_count bigint := 0;
  placement_gender text;
  placement_residential text;
  normalized_gender text;
  normalized_residential text;
  eligible_count bigint := 0;
begin
  -- Only validate the first completed submission. Existing submitted records
  -- remain editable by authorized school staff.
  if new.submitted_at is null or old.submitted_at is not null then
    return new;
  end if;

  select *
    into cfg
  from public.school_config
  where school_id = new.school_id;

  if not found then
    raise exception using errcode = '23514', message = 'Complete the school admission configuration before accepting applications.';
  end if;

  if upper(btrim(coalesce(cfg.admission_status, 'CLOSED'))) not in ('OPEN', 'OPENED', 'ACTIVE', 'TRUE', 'YES', '1') then
    raise exception using errcode = '23514', message = 'Admission is closed for this school.';
  end if;

  if coalesce(cfg.force_enrolment_upload, true) and (
    not coalesce(new.documents_done, false)
    or nullif(btrim(coalesce(new.enrolment_form_url, '')), '') is null
  ) then
    raise exception using errcode = '23514', message = 'Upload the enrolment form before submitting the personal record.';
  end if;

  effective_programme_id := new.programme_id;
  if effective_programme_id is null then
    select min(p.id::text)::uuid, count(*)
      into effective_programme_id, inferred_programme_count
    from public.placement_list pl
    join public.programmes p
      on p.school_id = new.school_id
     and upper(regexp_replace(btrim(coalesce(pl.programme, '')), '[^A-Z0-9]+', '', 'g')) in (
       upper(regexp_replace(btrim(coalesce(p.name, '')), '[^A-Z0-9]+', '', 'g')),
       upper(regexp_replace(btrim(coalesce(p.code, '')), '[^A-Z0-9]+', '', 'g'))
     )
    where pl.school_id = new.school_id
      and pl.index_number = new.bece_index
      and nullif(btrim(coalesce(pl.programme, '')), '') is not null;

    if inferred_programme_count <> 1 then
      effective_programme_id := null;
    end if;
  end if;

  if coalesce(cfg.allow_class_selection, true) and new.class_id is null and effective_programme_id is not null then
    select count(*)
      into eligible_count
    from public.classrooms c
    where c.school_id = new.school_id
      and c.programme_id = effective_programme_id
      and coalesce(c.capacity, 0) > (
        select count(*) from public.students s where s.class_id = c.id and s.id <> new.id
      );

    if eligible_count > 0 then
      raise exception using errcode = '23514', message = 'Select a class linked to the placed programme before submitting.';
    end if;
  end if;

  if coalesce(cfg.allow_house_selection, false) and new.house_id is null then
    select pl.gender, pl.residential_status
      into placement_gender, placement_residential
    from public.placement_list pl
    where pl.school_id = new.school_id
      and pl.index_number = new.bece_index
    limit 1;

    normalized_gender := upper(btrim(coalesce(nullif(new.gender, ''), placement_gender, '')));
    if normalized_gender in ('M', 'MALE', 'BOY') then
      normalized_gender := 'MALE';
    elsif normalized_gender in ('F', 'FEMALE', 'GIRL') then
      normalized_gender := 'FEMALE';
    else
      normalized_gender := '';
    end if;

    normalized_residential := upper(regexp_replace(coalesce(
      nullif(placement_residential, ''),
      nullif(new.records ->> 'residential_status', ''),
      nullif(new.records ->> 'residential', ''),
      ''
    ), '[^A-Z]', '', 'g'));
    if normalized_residential in ('B', 'BOARDER', 'BOARDING', 'RESIDENT') then
      normalized_residential := 'BOARDING';
    elsif normalized_residential in ('D', 'DAY', 'DAYSTUDENT') then
      normalized_residential := 'DAY';
    else
      normalized_residential := '';
    end if;

    select count(*)
      into eligible_count
    from public.houses h
    where h.school_id = new.school_id
      and coalesce(h.priority, 0) > 0
      and coalesce(h.capacity, 0) > (
        select count(*) from public.students s where s.house_id = h.id and s.id <> new.id
      )
      and case
        when upper(btrim(coalesce(h.gender, ''))) in ('M', 'MALE', 'BOY') then 'MALE'
        when upper(btrim(coalesce(h.gender, ''))) in ('F', 'FEMALE', 'GIRL') then 'FEMALE'
        else ''
      end = normalized_gender
      and case
        when upper(regexp_replace(coalesce(h.residential_type, ''), '[^A-Z]', '', 'g')) in ('B', 'BOARDER', 'BOARDING', 'RESIDENT') then 'BOARDING'
        when upper(regexp_replace(coalesce(h.residential_type, ''), '[^A-Z]', '', 'g')) in ('D', 'DAY', 'DAYSTUDENT') then 'DAY'
        else ''
      end = normalized_residential;

    if eligible_count > 0 then
      raise exception using errcode = '23514', message = 'Select a house matching the student gender and residential status before submitting.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_enforce_student_portal_submission_requirements on public.students;
create trigger zz_enforce_student_portal_submission_requirements
before update of submitted_at, documents_done, enrolment_form_url, class_id, house_id on public.students
for each row
execute function public.enforce_student_portal_submission_requirements();

revoke all on function public.enforce_student_portal_submission_requirements() from public, anon, authenticated;

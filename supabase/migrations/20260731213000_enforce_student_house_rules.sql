create or replace function public.enforce_student_house_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_house public.houses%rowtype;
  placement_gender text;
  placement_residential text;
  student_gender text;
  student_residential text;
  house_gender text;
  house_residential text;
  occupied_count bigint;
  requires_capacity_check boolean := false;
begin
  if new.house_id is null then
    return new;
  end if;

  select *
    into target_house
  from public.houses
  where id = new.house_id
    and school_id = new.school_id;

  if not found then
    raise exception using errcode = '23514', message = 'The selected house does not belong to this school.';
  end if;

  select pl.gender, pl.residential_status
    into placement_gender, placement_residential
  from public.placement_list pl
  where pl.school_id = new.school_id
    and pl.index_number = new.bece_index
  limit 1;

  student_gender := upper(btrim(coalesce(nullif(new.gender, ''), placement_gender, '')));
  if student_gender in ('M', 'MALE', 'BOY') then
    student_gender := 'MALE';
  elsif student_gender in ('F', 'FEMALE', 'GIRL') then
    student_gender := 'FEMALE';
  else
    raise exception using errcode = '23514', message = 'Set the student gender before assigning a house.';
  end if;

  student_residential := upper(regexp_replace(coalesce(
    nullif(placement_residential, ''),
    nullif(new.records ->> 'residential_status', ''),
    nullif(new.records ->> 'residential', ''),
    ''
  ), '[^A-Z]', '', 'g'));
  if student_residential in ('B', 'BOARDER', 'BOARDING', 'RESIDENT') then
    student_residential := 'BOARDING';
  elsif student_residential in ('D', 'DAY', 'DAYSTUDENT') then
    student_residential := 'DAY';
  else
    raise exception using errcode = '23514', message = 'Set the student residential status to Boarding or Day before assigning a house.';
  end if;

  house_gender := upper(btrim(coalesce(target_house.gender, '')));
  if house_gender in ('M', 'MALE', 'BOY') then
    house_gender := 'MALE';
  elsif house_gender in ('F', 'FEMALE', 'GIRL') then
    house_gender := 'FEMALE';
  else
    raise exception using errcode = '23514', message = 'Set the house gender before assigning students.';
  end if;

  house_residential := upper(regexp_replace(coalesce(target_house.residential_type, ''), '[^A-Z]', '', 'g'));
  if house_residential in ('B', 'BOARDER', 'BOARDING', 'RESIDENT') then
    house_residential := 'BOARDING';
  elsif house_residential in ('D', 'DAY', 'DAYSTUDENT') then
    house_residential := 'DAY';
  else
    raise exception using errcode = '23514', message = 'Set the house residential type before assigning students.';
  end if;

  if house_gender <> student_gender then
    raise exception using errcode = '23514', message = 'The selected house does not match the student gender.';
  end if;

  if house_residential <> student_residential then
    raise exception using errcode = '23514', message = 'The selected house does not match the student residential status.';
  end if;

  if target_house.priority is null or target_house.priority < 1 then
    raise exception using errcode = '23514', message = 'Set a valid priority order for the house before assigning students.';
  end if;

  if target_house.capacity is null or target_house.capacity < 1 then
    raise exception using errcode = '23514', message = 'Set a valid capacity for the house before assigning students.';
  end if;

  if tg_op = 'INSERT' then
    requires_capacity_check := true;
  elsif tg_op = 'UPDATE' then
    requires_capacity_check := old.house_id is distinct from new.house_id;
  end if;

  if requires_capacity_check then
    perform pg_advisory_xact_lock(hashtextextended(new.house_id::text, 0));

    select count(*)
      into occupied_count
    from public.students s
    where s.house_id = new.house_id
      and s.id <> new.id;

    if occupied_count >= target_house.capacity then
      raise exception using errcode = '23514', message = 'The selected house has reached its capacity.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_student_house_rules_trigger on public.students;
create trigger enforce_student_house_rules_trigger
before insert or update of house_id, gender, records on public.students
for each row
execute function public.enforce_student_house_rules();

revoke all on function public.enforce_student_house_rules() from public, anon, authenticated;

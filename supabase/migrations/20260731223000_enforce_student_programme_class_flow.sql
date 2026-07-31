-- Link existing students to the programme on their placement record when the
-- school has one unambiguous matching programme name or code.
with programme_matches as (
  select
    s.id as student_id,
    min(p.id::text)::uuid as programme_id
  from public.students s
  join public.placement_list pl
    on pl.school_id = s.school_id
   and pl.index_number = s.bece_index
  join public.programmes p
    on p.school_id = s.school_id
   and upper(regexp_replace(btrim(coalesce(pl.programme, '')), '[^A-Z0-9]+', '', 'g')) in (
     upper(regexp_replace(btrim(coalesce(p.name, '')), '[^A-Z0-9]+', '', 'g')),
     upper(regexp_replace(btrim(coalesce(p.code, '')), '[^A-Z0-9]+', '', 'g'))
   )
  where s.programme_id is null
    and nullif(btrim(coalesce(pl.programme, '')), '') is not null
  group by s.id
  having count(*) = 1
)
update public.students s
set programme_id = matches.programme_id
from programme_matches matches
where s.id = matches.student_id
  and (
    s.class_id is null
    or exists (
      select 1
      from public.classrooms c
      where c.id = s.class_id
        and c.school_id = s.school_id
        and c.programme_id = matches.programme_id
    )
  );

create or replace function public.enforce_student_programme_class_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classrooms%rowtype;
  inferred_programme_id uuid;
  inferred_programme_count bigint := 0;
  effective_programme_id uuid;
  occupied_count bigint;
  requires_capacity_check boolean := false;
begin
  if new.programme_id is not null and not exists (
    select 1
    from public.programmes p
    where p.id = new.programme_id
      and p.school_id = new.school_id
  ) then
    raise exception using errcode = '23514', message = 'The selected programme does not belong to this school.';
  end if;

  if new.class_id is null then
    return new;
  end if;

  select *
    into target_class
  from public.classrooms c
  where c.id = new.class_id
    and c.school_id = new.school_id;

  if not found then
    raise exception using errcode = '23514', message = 'The selected class does not belong to this school.';
  end if;

  if target_class.programme_id is null then
    raise exception using errcode = '23514', message = 'Link the selected class to a programme before assigning students.';
  end if;

  effective_programme_id := new.programme_id;
  if effective_programme_id is null then
    select min(p.id::text)::uuid, count(*)
      into inferred_programme_id, inferred_programme_count
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

    if inferred_programme_count = 1 then
      effective_programme_id := inferred_programme_id;
      new.programme_id := inferred_programme_id;
    end if;
  end if;

  if effective_programme_id is null then
    raise exception using errcode = '23514', message = 'Link the student placement programme before assigning a class.';
  end if;

  if target_class.programme_id <> effective_programme_id then
    raise exception using errcode = '23514', message = 'The selected class is not linked to the student programme.';
  end if;

  if target_class.capacity is null or target_class.capacity < 1 then
    raise exception using errcode = '23514', message = 'Set a valid capacity for the class before assigning students.';
  end if;

  if tg_op = 'INSERT' then
    requires_capacity_check := true;
  elsif tg_op = 'UPDATE' then
    requires_capacity_check := old.class_id is distinct from new.class_id;
  end if;

  if requires_capacity_check then
    perform pg_advisory_xact_lock(hashtextextended(new.class_id::text, 0));

    select count(*)
      into occupied_count
    from public.students s
    where s.class_id = new.class_id
      and (new.id is null or s.id <> new.id);

    if occupied_count >= target_class.capacity then
      raise exception using errcode = '23514', message = 'The selected class has reached its capacity.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_student_programme_class_rules_trigger on public.students;
create trigger enforce_student_programme_class_rules_trigger
before insert or update of programme_id, class_id on public.students
for each row
execute function public.enforce_student_programme_class_rules();

revoke all on function public.enforce_student_programme_class_rules() from public, anon, authenticated;

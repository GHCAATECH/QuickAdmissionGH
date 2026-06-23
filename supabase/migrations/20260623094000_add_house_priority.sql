alter table public.houses
  add column if not exists priority integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by school_id
      order by created_at nulls first, name, id
    ) as seq
  from public.houses
  where priority is null
)
update public.houses h
set priority = ranked.seq
from ranked
where h.id = ranked.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'houses_priority_positive_chk'
  ) then
    alter table public.houses
      add constraint houses_priority_positive_chk
      check (priority is null or priority >= 1);
  end if;
end $$;

create index if not exists houses_school_priority_idx
  on public.houses (school_id, priority, name);

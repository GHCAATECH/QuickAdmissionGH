alter table public.school_config
  add column if not exists finance_settled_students integer not null default 0;

alter table public.school_config
  add column if not exists finance_settled_at timestamptz;

update public.school_config
set finance_settled_students = greatest(coalesce(finance_settled_students, 0), 0)
where finance_settled_students is null
   or finance_settled_students < 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_config_finance_settled_students_chk'
  ) then
    alter table public.school_config
      add constraint school_config_finance_settled_students_chk
      check (finance_settled_students >= 0);
  end if;
end
$$;

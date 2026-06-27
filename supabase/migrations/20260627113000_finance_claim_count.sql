alter table public.school_config
  add column if not exists finance_claim_count integer not null default 0;

update public.school_config
set finance_claim_count = greatest(coalesce(finance_claim_count, 0), 0)
where finance_claim_count is null
   or finance_claim_count < 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_config_finance_claim_count_chk'
  ) then
    alter table public.school_config
      add constraint school_config_finance_claim_count_chk
      check (finance_claim_count >= 0);
  end if;
end
$$;

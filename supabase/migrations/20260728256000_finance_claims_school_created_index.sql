-- Keep school finance-claim history reads ordered efficiently.
create index if not exists finance_claims_school_created_idx
  on public.finance_claims (school_id, created_at desc);

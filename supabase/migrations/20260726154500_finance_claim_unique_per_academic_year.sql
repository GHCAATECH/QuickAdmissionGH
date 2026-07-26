-- Allow each academic year to start claim numbering from 0001.
-- The old constraint made (school_id, claim_number) unique forever, so a new
-- academic year's first claim could collide with a previous year's first claim.

alter table public.finance_claims
  drop constraint if exists finance_claims_school_id_claim_number_key;

drop index if exists finance_claims_school_id_claim_number_key;

create unique index if not exists finance_claims_school_year_claim_number_key
  on public.finance_claims (school_id, (coalesce(academic_year, ''::text)), claim_number);

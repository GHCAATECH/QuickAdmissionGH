-- Keep financial reference and payer searches fast as payment volume grows.
create extension if not exists pg_trgm;

create index if not exists payments_reference_trgm_idx
  on public.payments using gin (reference gin_trgm_ops);

create index if not exists payments_payer_name_trgm_idx
  on public.payments using gin (payer_name gin_trgm_ops);

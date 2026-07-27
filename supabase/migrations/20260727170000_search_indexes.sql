-- Keep paginated admin search fast as schools grow.
create extension if not exists pg_trgm;

create index if not exists students_full_name_trgm_idx
  on public.students using gin (full_name gin_trgm_ops);

create index if not exists students_bece_index_trgm_idx
  on public.students using gin (bece_index gin_trgm_ops);

create index if not exists students_admission_no_trgm_idx
  on public.students using gin (admission_no gin_trgm_ops);

create index if not exists students_permanent_admission_no_trgm_idx
  on public.students using gin (permanent_admission_number gin_trgm_ops);

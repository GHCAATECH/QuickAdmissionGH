-- Keep placement name/index searches efficient at larger schools.
create extension if not exists pg_trgm;

create index if not exists placement_list_student_name_trgm_idx
  on public.placement_list using gin (student_name gin_trgm_ops);

create index if not exists placement_list_index_number_trgm_idx
  on public.placement_list using gin (index_number gin_trgm_ops);

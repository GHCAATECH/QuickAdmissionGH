-- Keep the public school directory's alphabetical ordering efficient.
create index if not exists schools_name_idx
  on public.schools (name);

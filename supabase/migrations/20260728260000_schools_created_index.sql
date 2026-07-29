-- Keep Super Admin school management ordered by creation time efficiently.
create index if not exists schools_created_idx
  on public.schools (created_at desc);

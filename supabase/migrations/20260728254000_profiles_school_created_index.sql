-- Keep school user-management lists ordered without an extra sort.
create index if not exists profiles_school_created_idx
  on public.profiles (school_id, created_at desc);

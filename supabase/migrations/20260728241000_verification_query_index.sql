create index if not exists students_school_verified_at_idx
  on public.students (school_id, verified_at desc)
  where verification_status = 'verified';

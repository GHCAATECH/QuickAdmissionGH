-- Keep the verified-student portal list focused on verified records.
create index if not exists students_verified_school_time_idx
  on public.students (school_id, verified_at desc)
  where verification_status = 'verified';

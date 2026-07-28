-- Keep submitted-admission pagination and exports focused on active records.
create index if not exists students_submitted_school_created_idx
  on public.students (school_id, created_at desc)
  where submitted_at is not null;

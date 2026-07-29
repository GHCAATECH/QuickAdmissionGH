-- Keep active submitted-admission summaries focused on non-rejected records.
create index if not exists students_active_submitted_school_time_idx
  on public.students (school_id, submitted_at desc)
  where submitted_at is not null and coalesce(status, '') <> 'rejected';

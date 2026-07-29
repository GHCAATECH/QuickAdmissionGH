-- Keep pending-admission dashboard counts focused on unsubmitted records.
create index if not exists students_pending_school_created_idx
  on public.students (school_id, created_at desc)
  where submitted_at is null and coalesce(status, 'pending') = 'pending';

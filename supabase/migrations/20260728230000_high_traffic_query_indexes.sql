create index if not exists payments_school_settlement_order_idx
  on public.payments (school_id, paid_at, created_at, id)
  where lower(coalesce(status, '')) in ('completed', 'success', 'paid');

do $$
begin
  if to_regclass('public.sms_logs') is not null then
    create index if not exists sms_logs_school_bulk_status_external_idx
      on public.sms_logs (school_id, recipient_group, status, external_id);
    create index if not exists sms_logs_school_bulk_status_student_idx
      on public.sms_logs (school_id, recipient_group, status, student_id);
  end if;
end $$;

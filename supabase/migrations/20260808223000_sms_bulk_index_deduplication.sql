-- Reserve bulk SMS recipients by school and student index before provider delivery.
-- Failed rows are intentionally excluded from the unique index so they can be retried.
with ranked_deliveries as (
  select
    id,
    row_number() over (
      partition by school_id, upper(btrim(external_id))
      order by
        case when status = 'sent' then 0 else 1 end,
        sent_at,
        id
    ) as delivery_rank
  from public.sms_logs
  where recipient_group = 'bulk-recipient'
    and status in ('pending', 'sent')
    and nullif(btrim(external_id), '') is not null
)
update public.sms_logs as logs
set
  status = 'duplicate',
  api_response = coalesce(logs.api_response, '{}'::jsonb)
    || jsonb_build_object('deduplicated_by_index_migration', true)
from ranked_deliveries as ranked
where logs.id = ranked.id
  and ranked.delivery_rank > 1;

create unique index if not exists sms_logs_bulk_student_once_uidx
  on public.sms_logs (school_id, (upper(btrim(external_id))))
  where recipient_group = 'bulk-recipient'
    and status in ('pending', 'sent')
    and nullif(btrim(external_id), '') is not null;

create or replace function public.reserve_bulk_sms_recipients(
  p_school_id uuid,
  p_sender_id text,
  p_sent_by text,
  p_template_name text,
  p_candidates jsonb
)
returns table (log_id bigint, external_id text)
language sql
security definer
set search_path = public
as $function$
  insert into public.sms_logs (
    school_id,
    student_id,
    recipient_group,
    recipients,
    phone,
    sender_id,
    message,
    status,
    sent_by,
    template_name,
    api_response,
    external_id
  )
  select
    p_school_id,
    nullif(candidate.student_id, '')::uuid,
    'bulk-recipient',
    1,
    nullif(candidate.phone, ''),
    nullif(p_sender_id, ''),
    candidate.message,
    'pending',
    nullif(p_sent_by, ''),
    nullif(p_template_name, ''),
    jsonb_build_object('reserved', true),
    upper(btrim(candidate.external_id))
  from jsonb_to_recordset(coalesce(p_candidates, '[]'::jsonb)) as candidate(
    student_id text,
    external_id text,
    phone text,
    message text
  )
  where nullif(btrim(candidate.external_id), '') is not null
    and nullif(btrim(candidate.phone), '') is not null
    and nullif(btrim(candidate.message), '') is not null
  on conflict (school_id, (upper(btrim(external_id))))
    where recipient_group = 'bulk-recipient'
      and status in ('pending', 'sent')
      and nullif(btrim(external_id), '') is not null
  do nothing
  returning id, sms_logs.external_id;
$function$;

revoke all on function public.reserve_bulk_sms_recipients(uuid, text, text, text, jsonb) from public;
revoke all on function public.reserve_bulk_sms_recipients(uuid, text, text, text, jsonb) from anon;
revoke all on function public.reserve_bulk_sms_recipients(uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.reserve_bulk_sms_recipients(uuid, text, text, text, jsonb) to service_role;

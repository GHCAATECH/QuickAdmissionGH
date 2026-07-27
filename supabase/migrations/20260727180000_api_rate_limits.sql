create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_started timestamptz;
  v_count integer;
  v_allowed boolean;
begin
  if p_bucket_key is null or btrim(p_bucket_key) = '' or p_limit < 1 or p_window_seconds < 1 then
    return jsonb_build_object('allowed', false, 'retry_after', p_window_seconds);
  end if;
  insert into public.api_rate_limits(bucket_key, window_started, request_count, updated_at)
  values (left(p_bucket_key, 250), v_now, 1, v_now)
  on conflict (bucket_key) do nothing;
  select window_started, request_count into v_started, v_count
  from public.api_rate_limits where bucket_key = left(p_bucket_key, 250) for update;
  if v_now >= v_started + make_interval(secs => p_window_seconds) then
    update public.api_rate_limits set window_started=v_now, request_count=1, updated_at=v_now where bucket_key=left(p_bucket_key,250);
    v_count := 1;
  elsif v_count < p_limit then
    update public.api_rate_limits set request_count=request_count+1, updated_at=v_now where bucket_key=left(p_bucket_key,250);
    v_count := v_count + 1;
  end if;
  v_allowed := v_count <= p_limit;
  return jsonb_build_object('allowed', v_allowed, 'count', v_count, 'limit', p_limit, 'retry_after', greatest(1, ceil(extract(epoch from (v_started + make_interval(secs => p_window_seconds) - v_now)))::integer));
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

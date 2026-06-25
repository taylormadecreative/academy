-- 0004_rate_limit.sql
-- Durable, DB-backed fixed-window rate limiter for the two unauthenticated edge
-- functions (ea-create-checkout, ea-issue-media). Replaces the "punt throttling
-- to a Cloudflare/WAF that isn't there" gap. Called only by the service role
-- from inside the functions; fail-open by design (a limiter outage never blocks
-- a paying user).

create table if not exists ea_rate_limit (
  bucket       text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

alter table ea_rate_limit enable row level security;
-- No policies on purpose: only SECURITY DEFINER ea_rate_check (owned by the
-- table owner) and the service role touch this table. anon/authenticated get nothing.

create or replace function ea_rate_check(p_key text, p_max int, p_window_secs int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into ea_rate_limit (bucket, count, window_start)
    values (p_key, 1, now())
  on conflict (bucket) do update set
    count = case
      when ea_rate_limit.window_start < now() - make_interval(secs => p_window_secs)
      then 1 else ea_rate_limit.count + 1 end,
    window_start = case
      when ea_rate_limit.window_start < now() - make_interval(secs => p_window_secs)
      then now() else ea_rate_limit.window_start end
  returning count into v_count;
  return v_count <= p_max;   -- true = allowed, false = over the limit
end;
$$;

-- Only the service role (used inside the edge functions) may call it.
revoke all on function ea_rate_check(text, int, int) from public;
grant execute on function ea_rate_check(text, int, int) to service_role;

comment on function ea_rate_check is
  'Fixed-window per-key rate limit. Returns true if the request is within p_max per p_window_secs.';

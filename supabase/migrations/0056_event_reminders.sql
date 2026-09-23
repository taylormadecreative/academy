-- 0056 — reminder emails for ticketed dates (ea_events): the free AI 101 class and the paid workshop.
--   ea_event_reminders   what has already been sent, one row per (event_id, kind) — the guard against
--                        emailing a date twice. Written only by the edge function ea-event-remind
--                        (service role); Nelson can read it.
--   pg_cron 'ea-event-remind'   every 5 minutes: net.http_post → ea-event-remind with the SAME shared
--                        secret the OPIL reminders use (Vault opil_remind_secret = function secret
--                        REMIND_SECRET, set by scripts/apply-0050.sh). Nothing new to configure.
-- Additive and safe to re-run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.ea_event_reminders (
  event_id uuid not null references public.ea_events(id) on delete cascade,
  kind text not null check (kind in ('day-before','hour-before')),
  sent_at timestamptz not null default now(),
  primary key (event_id, kind)
);
comment on table public.ea_event_reminders is 'reminder emails already sent for a ticketed date: (event_id, day-before | hour-before)';
alter table public.ea_event_reminders enable row level security;
drop policy if exists event_reminders_admin_read on public.ea_event_reminders;
create policy event_reminders_admin_read on public.ea_event_reminders for select to authenticated
  using (public.ea_is_admin());
revoke all on table public.ea_event_reminders from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.ea_event_reminders from authenticated;
grant select on table public.ea_event_reminders to authenticated;

do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron is not installed — turn on Cron (and pg_net) under Integrations, then re-run 0056';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'ea-event-remind') then
    perform cron.unschedule('ea-event-remind');
  end if;
  perform cron.schedule(
    'ea-event-remind',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := 'https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-event-remind',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-remind-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'opil_remind_secret' limit 1), '')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      )
    $job$
  );
end $$;

select 'event reminders ready' as status;

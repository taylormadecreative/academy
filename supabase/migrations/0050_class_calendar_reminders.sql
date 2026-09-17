-- 0050 — calendar + reminders (spec 2026-09-16-class-features-design.md, feature 9).
--   ea_class_reminders   what has already been sent, one row per (room_key, kind) — the guard against
--                        emailing a class twice. Written by the edge function ea-opil-remind (service role);
--                        readable by the people who run a class and by the program team.
--   pg_cron 'ea-opil-remind'   every 5 minutes: net.http_post → https://…/ea-opil-remind with the shared
--                        secret in x-remind-secret. The secret lives in Supabase Vault under the name
--                        opil_remind_secret — never a literal here, never a database setting (those sit in
--                        pg_db_role_setting, readable by every role). Nelson sets it once
--                        (scripts/apply-0050.sh does it: vault.create_secret / vault.update_secret, the same
--                        value as the function secret REMIND_SECRET). The cron job reads it from
--                        vault.decrypted_secrets, which only the owner roles can see. Until it is set the
--                        header is empty and the function answers 401 — nothing is sent, nothing breaks.
-- Additive and safe to re-run: if not exists / drop policy if exists / unschedule before schedule.
-- The calendar feed (ea-opil-calendar) needs no table: it reads ea_opil_sessions with the service role.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table if not exists public.ea_class_reminders (
  room_key text not null,
  kind text not null check (char_length(kind) between 1 and 40),
  sent_at timestamptz not null default now(),
  primary key (room_key, kind)
);
comment on table public.ea_class_reminders is 'reminder emails already sent for a class: (room_key, kind) — e.g. (opil:1, start-30)';
alter table public.ea_class_reminders enable row level security;

/* read: whoever runs that class, and the program team. Nobody writes from the browser — the edge
   function does, with the service role, which bypasses RLS. */
drop policy if exists class_reminders_read on public.ea_class_reminders;
create policy class_reminders_read on public.ea_class_reminders for select to authenticated
  using (public.ea_class_is_host(room_key) or public.ea_opil_is_program_team(auth.uid()));
revoke all on table public.ea_class_reminders from anon;
grant select on table public.ea_class_reminders to authenticated;

/* the cron job: drop any earlier copy, then schedule. Runs as the scheduling user in database postgres. */
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron is not installed — turn on Cron (and pg_net) under Integrations in the Supabase dashboard, then re-run 0050';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'ea-opil-remind') then
    perform cron.unschedule('ea-opil-remind');
  end if;
  perform cron.schedule(
    'ea-opil-remind',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := 'https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-opil-remind',
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

/* one sentence about the reminder job, for the apply script and the coordinator page (program team only).
   The secret check reads vault.secrets (names only, never the value) — true the moment the apply script
   finishes, whatever connection the page happens to be on. */
create or replace function public.ea_opil_remind_status() returns text
language plpgsql stable security definer set search_path = public as $$
declare n int; secret_set boolean;
begin
  if not public.ea_opil_is_program_team(auth.uid()) and auth.uid() is not null then return null; end if;
  if to_regclass('cron.job') is null then return 'Reminders are not scheduled: pg_cron is off.'; end if;
  execute 'select count(*) from cron.job where jobname = $1' into n using 'ea-opil-remind';
  secret_set := false;
  if to_regclass('vault.secrets') is not null then
    execute 'select exists (select 1 from vault.secrets where name = $1)' into secret_set using 'opil_remind_secret';
  end if;
  if n = 0 then return 'Reminders are not scheduled yet.'; end if;
  if not secret_set then return 'Reminders are scheduled but the secret is not set yet — nothing goes out until it is.'; end if;
  return 'Reminders go out half an hour before every class.';
end $$;
revoke all on function public.ea_opil_remind_status() from public, anon;
grant execute on function public.ea_opil_remind_status() to authenticated;

select 'calendar reminders ready' as status;

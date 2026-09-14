-- 0033: automatic replays. Start class records the RealtimeKit meeting; the webhook copies the
-- upload into Cloudflare Stream and parks it here as a DRAFT the program team can review.
-- Publishing copies the watch URL into ea_opil_sessions.recording_url — the one column students
-- already see — so nothing reaches a student until a coordinator or that session's facilitator
-- flips it (Jamal, 9/14: "I'd rather us be able to go in, view it a little bit, trim it if need be
-- before they can access it"). Only the service role writes these tables. Safe to re-run.
create table if not exists public.ea_opil_replays (
  id uuid primary key default gen_random_uuid(),
  session_no int references public.ea_opil_sessions(no) on delete set null,
  meeting_id text not null,
  recording_id text not null unique,
  status text not null default 'invoked' check (status in ('invoked','recording','uploading','uploaded','ready','error')),
  download_url text,
  download_expires_at timestamptz,
  stream_uid text,
  watch_url text,
  duration_s int,
  file_size bigint,
  error text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ea_opil_replays_session_idx on public.ea_opil_replays (session_no, created_at desc);
create index if not exists ea_opil_replays_meeting_idx on public.ea_opil_replays (meeting_id, created_at desc);
alter table public.ea_opil_replays enable row level security;
drop policy if exists replays_program_read on public.ea_opil_replays;
create policy replays_program_read on public.ea_opil_replays for select to authenticated
  using (public.ea_opil_is_program_team(auth.uid()));
-- no insert/update/delete policies: browsers never write here

create table if not exists public.ea_rtk_events (
  id text primary key,
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.ea_rtk_events enable row level security;
-- no policies at all: service role only

create or replace function public.ea_opil_publish_replay(p_session int, p_publish boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.ea_opil_replays%rowtype; allowed boolean;
begin
  allowed := public.ea_opil_is_admin(auth.uid()) or p_session = any(public.ea_opil_fac_sessions(auth.uid()));
  if not allowed then raise exception 'not your session' using errcode = '42501'; end if;
  select * into r from public.ea_opil_replays
    where session_no = p_session and status = 'ready' and watch_url is not null
    order by created_at desc limit 1;
  if not found then raise exception 'no replay is ready for this session' using errcode = 'P0002'; end if;
  if p_publish then
    update public.ea_opil_replays set published = true, updated_at = now() where id = r.id;
    update public.ea_opil_replays set published = false, updated_at = now() where session_no = p_session and id <> r.id and published;
    update public.ea_opil_sessions set recording_url = r.watch_url where no = p_session;
    return jsonb_build_object('ok', true, 'published', true, 'recording_url', r.watch_url);
  else
    update public.ea_opil_replays set published = false, updated_at = now() where session_no = p_session and published;
    update public.ea_opil_sessions set recording_url = null where no = p_session and recording_url = r.watch_url;
    return jsonb_build_object('ok', true, 'published', false, 'recording_url', null);
  end if;
end $$;
revoke all on function public.ea_opil_publish_replay(int, boolean) from public, anon;
grant execute on function public.ea_opil_publish_replay(int, boolean) to authenticated;
select 'opil replays ready' as status;

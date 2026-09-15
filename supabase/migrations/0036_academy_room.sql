-- 0036: the Academy room — the OPIL class room on /room/, one room, one link.
-- Spec: docs/superpowers/specs/2026-09-14-academy-room-design.md §4. Safe to re-run.
-- Four tables (ea_rooms, ea_room_members, ea_room_hands, ea_room_replays), one read RPC for
-- everyone (ea_room_state), one definer helper for the hands policies (ea_room_in_session),
-- two admin RPCs (ea_room_rotate_link, ea_room_publish_replay), and one rider that closes the
-- same column hole on ea_opil_hands. Every revoke runs AFTER its create: Supabase's default
-- privileges hand anon/authenticated ALL on a new table the moment it exists (the 0023 lesson).
-- Only Nelson (ea_is_admin) is ever the host; the service role writes meeting_id and the
-- membership rows from the edge functions; no page inserts into ea_rooms.

-- gen_random_bytes lives in pgcrypto, which Supabase installs in the extensions schema.
create extension if not exists pgcrypto with schema extensions;

-- ---------- 4.1 the link key ----------
-- 16 random bytes → base64 → strip '=' padding → url-safe alphabet: 22 chars of [A-Za-z0-9_-].
create or replace function public.ea_room_new_key() returns text
language sql volatile security definer set search_path = public as
$$ select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_') $$;
revoke all on function public.ea_room_new_key() from public, anon, authenticated;

-- ---------- 4.1 ea_rooms — exactly one row ----------
create table if not exists public.ea_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Taylormade Academy Live' check (char_length(title) <= 120),
  link_key text not null unique default public.ea_room_new_key(),
  is_live boolean not null default false,
  meeting_id text,                       -- the CURRENT session's RealtimeKit meeting; server-only (grants below);
                                         -- a NEW meeting at every Start class; kept after Leave so a late webhook still files
  max_participants int not null default 50 check (max_participants between 2 and 500),
  recording_url text,                    -- the published replay (Stream /watch page)
  live_since timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ea_rooms_single on public.ea_rooms ((true));   -- exactly one room
-- the seed runs as the migration owner; 'on conflict do nothing' needs the unique index above
insert into public.ea_rooms default values on conflict do nothing;
alter table public.ea_rooms enable row level security;
drop policy if exists rooms_admin_read on public.ea_rooms;
create policy rooms_admin_read on public.ea_rooms for select to authenticated
  using (public.ea_is_admin());
drop policy if exists rooms_admin_update on public.ea_rooms;
create policy rooms_admin_update on public.ea_rooms for update to authenticated
  using (public.ea_is_admin()) with check (public.ea_is_admin());
-- no insert / delete policy: the seed ran as the owner, the service role never inserts either
revoke insert, delete, truncate, references, trigger on public.ea_rooms from anon, authenticated, public;
-- meeting_id and link_key are never writable from a page: the join function writes meeting_id
-- with the service role; ea_room_rotate_link() writes link_key
revoke update on public.ea_rooms from anon, authenticated, public;
grant update (title, is_live, max_participants, live_since, ended_at, updated_at) on public.ea_rooms to authenticated;

-- ---------- 4.3 ea_room_members — who joined ----------
-- Written only by the join function (service role upsert). A row here admits nothing by itself;
-- only a join in the CURRENT session does (ea_room_in_session below).
create table if not exists public.ea_room_members (
  room_id uuid references public.ea_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  first_joined_at timestamptz not null default now(),
  last_joined_at timestamptz not null default now(),
  joins int not null default 1,
  primary key (room_id, user_id)
);
alter table public.ea_room_members enable row level security;
drop policy if exists room_members_admin_read on public.ea_room_members;
create policy room_members_admin_read on public.ea_room_members for select to authenticated
  using (public.ea_is_admin());
-- no write policies: browsers never write here
revoke insert, update, delete, truncate, references, trigger on public.ea_room_members from anon, authenticated, public;

-- ---------- 4.4 in-session check for the hands policies ----------
-- Policies on ea_room_hands cannot read ea_rooms / ea_room_members through those tables' own
-- RLS (the 2026-08-31 recursion lesson; OPIL uses ea_opil_in_cohort() for the same reason).
create or replace function public.ea_room_in_session(p_room uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.ea_room_members m join public.ea_rooms r on r.id = m.room_id
                  where m.room_id = p_room and m.user_id = auth.uid() and r.is_live and m.last_joined_at >= r.live_since) $$;
revoke all on function public.ea_room_in_session(uuid) from public, anon;
grant execute on function public.ea_room_in_session(uuid) to authenticated;

-- ---------- 4.4 ea_room_hands — the question queue (shape of ea_opil_hands) ----------
create table if not exists public.ea_room_hands (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ea_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'question' check (kind in ('question','comment')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  staged_at timestamptz,
  done_at timestamptz
);
create index if not exists ea_room_hands_open_idx on public.ea_room_hands (room_id, created_at) where done_at is null;
create unique index if not exists ea_room_hands_one_open on public.ea_room_hands (room_id, user_id) where done_at is null;
alter table public.ea_room_hands enable row level security;
drop policy if exists room_hands_read on public.ea_room_hands;
create policy room_hands_read on public.ea_room_hands for select to authenticated
  using (public.ea_is_admin() or public.ea_room_in_session(room_id));
drop policy if exists room_hands_insert on public.ea_room_hands;
create policy room_hands_insert on public.ea_room_hands for insert to authenticated
  with check (user_id = auth.uid() and public.ea_room_in_session(room_id));
drop policy if exists room_hands_update_host on public.ea_room_hands;
create policy room_hands_update_host on public.ea_room_hands for update to authenticated
  using (public.ea_is_admin()) with check (public.ea_is_admin());
drop policy if exists room_hands_delete_own on public.ea_room_hands;
create policy room_hands_delete_own on public.ea_room_hands for delete to authenticated
  using (user_id = auth.uid() or public.ea_is_admin());
-- revoke after create, like the other three tables: anon and public get nothing, authenticated keeps
-- select / update / delete through the policies above (TRUNCATE is not governed by RLS at all)
revoke insert, update, delete, truncate, references, trigger on public.ea_room_hands from anon, public;
revoke truncate, references, trigger on public.ea_room_hands from authenticated;
-- a person can raise a hand with these four columns only — never staged_at / created_at (no queue jumping)
revoke insert on public.ea_room_hands from authenticated;
grant insert (room_id, user_id, kind, note) on public.ea_room_hands to authenticated;
do $$ begin
  begin
    alter publication supabase_realtime add table public.ea_room_hands;
  exception when duplicate_object then null; end;
end $$;

-- ---------- 4.5 ea_room_replays — drafts (shape of ea_opil_replays + 0034 privacy) ----------
create table if not exists public.ea_room_replays (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.ea_rooms(id) on delete set null,
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
create index if not exists ea_room_replays_room_idx on public.ea_room_replays (room_id, created_at desc);
create index if not exists ea_room_replays_meeting_idx on public.ea_room_replays (meeting_id, created_at desc);
alter table public.ea_room_replays enable row level security;
drop policy if exists room_replays_admin_read on public.ea_room_replays;
create policy room_replays_admin_read on public.ea_room_replays for select to authenticated
  using (public.ea_is_admin());
-- no insert/update/delete policies: only the service role writes here
revoke insert, update, delete, truncate, references, trigger on public.ea_room_replays from anon, authenticated, public;
-- the raw download_url / download_expires_at never reach a browser: pages select explicit columns
revoke select on public.ea_room_replays from anon, authenticated, public;
grant select (id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at)
  on public.ea_room_replays to authenticated;

-- ---------- 4.2 ea_room_state — the only read path for non-admins ----------
-- Never returns link_key or meeting_id. A bad key (non-privileged caller) gets exactly {"bad_link": true}.
create or replace function public.ea_room_state(p_key text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.ea_rooms%rowtype;
  privileged boolean;
  v_admin boolean;
  v_member boolean;
begin
  select * into r from public.ea_rooms order by created_at limit 1;
  if not found then return null; end if;
  v_admin := public.ea_is_admin();
  v_member := public.ea_is_member();
  privileged := v_admin or v_member;
  if (not privileged) and p_key is not null and p_key <> r.link_key then
    return jsonb_build_object('bad_link', true);
  end if;
  return jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'is_live', r.is_live,
    'host_name', 'Nelson Taylor',
    'signed_in', auth.uid() is not null,
    'is_host', v_admin,
    'can_join', privileged or (p_key is not null and p_key = r.link_key),
    'bad_link', false,
    'recording_url', case when v_member then r.recording_url else null end,
    'people', case when v_admin then (select count(*) from public.ea_room_members m
                                       where m.room_id = r.id and m.last_joined_at >= coalesce(r.live_since, 'epoch'::timestamptz))
                   else null end
  );
end $$;
revoke all on function public.ea_room_state(text) from public;
grant execute on function public.ea_room_state(text) to anon, authenticated;

-- ---------- 4.6 admin RPCs ----------
create or replace function public.ea_room_rotate_link() returns text
language plpgsql volatile security definer set search_path = public as $$
declare k text;
begin
  if not public.ea_is_admin() then raise exception 'only Nelson can do that' using errcode = '42501'; end if;
  update public.ea_rooms set link_key = public.ea_room_new_key(), updated_at = now()
    where id = (select id from public.ea_rooms order by created_at limit 1)
    returning link_key into k;
  return k;
end $$;
revoke all on function public.ea_room_rotate_link() from public, anon;
grant execute on function public.ea_room_rotate_link() to authenticated;

-- publish copies watch_url → ea_rooms.recording_url (what members see on /live/); unpublish clears both.
create or replace function public.ea_room_publish_replay(p_replay uuid, p_publish boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r public.ea_room_replays%rowtype; v_room uuid;
begin
  if not public.ea_is_admin() then raise exception 'only Nelson can do that' using errcode = '42501'; end if;
  select * into r from public.ea_room_replays where id = p_replay and status = 'ready' and watch_url is not null;
  if not found then raise exception 'this replay is not ready' using errcode = 'P0002'; end if;
  v_room := coalesce(r.room_id, (select id from public.ea_rooms order by created_at limit 1));
  if p_publish then
    update public.ea_room_replays set published = true, updated_at = now() where id = r.id;
    update public.ea_room_replays set published = false, updated_at = now() where id <> r.id and published;
    update public.ea_rooms set recording_url = r.watch_url, updated_at = now() where id = v_room;
    return jsonb_build_object('ok', true, 'published', true, 'recording_url', r.watch_url);
  else
    update public.ea_room_replays set published = false, updated_at = now() where id = r.id and published;
    update public.ea_rooms set recording_url = null, updated_at = now() where id = v_room and recording_url = r.watch_url;
    return jsonb_build_object('ok', true, 'published', false, 'recording_url', null);
  end if;
end $$;
revoke all on function public.ea_room_publish_replay(uuid, boolean) from public, anon;
grant execute on function public.ea_room_publish_replay(uuid, boolean) to authenticated;

-- ---------- rider: the same column hole on ea_opil_hands ----------
-- 0035 left the default full INSERT grant, so an OPIL student could insert staged_at and jump
-- the queue. The OPIL page inserts exactly {session_no, user_id, kind} (js/rtk-room-v2.js askQuestion).
revoke insert on public.ea_opil_hands from authenticated;
grant insert (session_no, user_id, kind, note) on public.ea_opil_hands to authenticated;

select 'academy room ready' as status;

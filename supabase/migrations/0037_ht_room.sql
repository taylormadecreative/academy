-- 0037: the HT class room — ea_rooms becomes MANY rooms (slug), hosts by email, presets per row.
-- Spec: docs/superpowers/specs/2026-09-15-ht-class-room-design.md §4. Runs AFTER 0036. Safe to
-- re-run: every column is add-if-missing, every policy/function is drop-then-create, the HT row is
-- insert-on-conflict-do-nothing. The Academy row keeps every behaviour 0036 gave it (host = Nelson,
-- Academy members join without a key and see its replay); the HT row admits only hosts and the key.
-- Every revoke runs AFTER its create (the 0023 lesson).

-- ---------- 4.1 columns ----------
alter table public.ea_rooms
  add column if not exists slug         text,
  add column if not exists host_name    text not null default 'Nelson Taylor',
  add column if not exists host_emails  text[] not null default '{}',
  add column if not exists host_preset  text not null default 'tma-class-host',
  add column if not exists guest_preset text not null default 'tma-class-guest';
update public.ea_rooms set slug = 'academy' where slug is null;
alter table public.ea_rooms alter column slug set not null;
alter table public.ea_rooms drop constraint if exists ea_rooms_slug_shape;
alter table public.ea_rooms add constraint ea_rooms_slug_shape check (slug ~ '^[a-z][a-z0-9-]{1,31}$');
alter table public.ea_rooms drop constraint if exists ea_rooms_host_name_len;
alter table public.ea_rooms add constraint ea_rooms_host_name_len check (char_length(host_name) between 1 and 80);
-- uniqueness on slug replaces "exactly one row"; the single-row index must go BEFORE the second row
drop index if exists public.ea_rooms_single;
create unique index if not exists ea_rooms_slug on public.ea_rooms (slug);
insert into public.ea_rooms (slug, title, host_preset, guest_preset)
  values ('ht', 'HT Live', 'ht-class-host', 'ht-class-guest')
  on conflict (slug) do nothing;
-- hosts may rename what guests read; host_emails / slug / presets / meeting_id / link_key keep NO update grant
grant update (host_name) on public.ea_rooms to authenticated;

-- ---------- 4.2 who is a host ----------
-- the email in the caller's JWT, lowercased; both claim spellings so verify's impersonation works
create or replace function public.ea_jwt_email() returns text
language sql stable set search_path = public as
$$ select lower(coalesce(nullif(current_setting('request.jwt.claim.email', true), ''),
                         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')) $$;
revoke all on function public.ea_jwt_email() from public;
grant execute on function public.ea_jwt_email() to anon, authenticated;

-- Nelson (ea_is_admin) hosts every room; a listed email hosts THAT room. Definer so the policies
-- below can ask it without reading ea_rooms through their own RLS (the recursion lesson).
create or replace function public.ea_room_is_host(p_room uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.ea_is_admin()
       or exists (select 1 from public.ea_rooms r
                  where r.id = p_room and public.ea_jwt_email() is not null
                    and public.ea_jwt_email() = any(r.host_emails)) $$;
revoke all on function public.ea_room_is_host(uuid) from public, anon;
grant execute on function public.ea_room_is_host(uuid) to authenticated;

-- ---------- policies: admin-only → host-of-this-room ----------
drop policy if exists rooms_admin_read on public.ea_rooms;
create policy rooms_admin_read on public.ea_rooms for select to authenticated
  using (public.ea_room_is_host(id));
drop policy if exists rooms_admin_update on public.ea_rooms;
create policy rooms_admin_update on public.ea_rooms for update to authenticated
  using (public.ea_room_is_host(id)) with check (public.ea_room_is_host(id));

drop policy if exists room_members_admin_read on public.ea_room_members;
create policy room_members_admin_read on public.ea_room_members for select to authenticated
  using (public.ea_room_is_host(room_id));

drop policy if exists room_replays_admin_read on public.ea_room_replays;
create policy room_replays_admin_read on public.ea_room_replays for select to authenticated
  using (public.ea_room_is_host(room_id));   -- room_id null (room deleted) → ea_is_admin() only

drop policy if exists room_hands_read on public.ea_room_hands;
create policy room_hands_read on public.ea_room_hands for select to authenticated
  using (public.ea_room_is_host(room_id) or public.ea_room_in_session(room_id));
drop policy if exists room_hands_update_host on public.ea_room_hands;
create policy room_hands_update_host on public.ea_room_hands for update to authenticated
  using (public.ea_room_is_host(room_id)) with check (public.ea_room_is_host(room_id));
drop policy if exists room_hands_delete_own on public.ea_room_hands;
create policy room_hands_delete_own on public.ea_room_hands for delete to authenticated
  using (user_id = auth.uid() or public.ea_room_is_host(room_id));

-- ---------- 4.3 ea_room_state(p_key, p_slug) ----------
-- The one-argument version goes: with a defaulted second argument the two would be ambiguous.
-- Pages call rpc('ea_room_state', {p_key}) or {p_key, p_slug} — both resolve here.
drop function if exists public.ea_room_state(text);
create or replace function public.ea_room_state(p_key text default null, p_slug text default 'academy') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.ea_rooms%rowtype;
  v_host boolean; v_member boolean; v_joined boolean; v_can boolean;
begin
  select * into r from public.ea_rooms where slug = p_slug;
  if not found then return null; end if;
  v_host := public.ea_room_is_host(r.id);
  v_member := (r.slug = 'academy') and public.ea_is_member();      -- Academy membership opens the Academy room only
  v_joined := auth.uid() is not null and exists (select 1 from public.ea_room_members m where m.room_id = r.id and m.user_id = auth.uid());
  -- joining alone unlocks another room's replay (e.g. ht) once you've been in a live session; the
  -- Academy replay stays gated to v_host / v_member only — same rule 0036 gave it, a plain join
  -- (even via a valid key) must not open it
  v_can := v_host or v_member or (p_key is not null and p_key = r.link_key);
  if (not v_can) and p_key is not null and p_key <> r.link_key then
    return jsonb_build_object('bad_link', true);
  end if;
  return jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'is_live', r.is_live, 'host_name', r.host_name,
    'signed_in', auth.uid() is not null,
    'is_host', v_host,
    'can_join', v_can,
    'bad_link', false,
    'recording_url', case when v_host or v_member or (r.slug <> 'academy' and v_joined) then r.recording_url else null end,
    'people', case when v_host then (select count(*) from public.ea_room_members m
                                      where m.room_id = r.id and m.last_joined_at >= coalesce(r.live_since, 'epoch'::timestamptz))
                   else null end
  );
end $$;
revoke all on function public.ea_room_state(text, text) from public;
grant execute on function public.ea_room_state(text, text) to anon, authenticated;

-- ---------- 4.4 RPCs ----------
create or replace function public.ea_room_rotate_link(p_room uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare k text;
begin
  if not public.ea_room_is_host(p_room) then raise exception 'only a host can do that' using errcode = '42501'; end if;
  update public.ea_rooms set link_key = public.ea_room_new_key(), updated_at = now() where id = p_room returning link_key into k;
  if k is null then raise exception 'no such room' using errcode = 'P0002'; end if;
  return k;
end $$;
revoke all on function public.ea_room_rotate_link(uuid) from public, anon;
grant execute on function public.ea_room_rotate_link(uuid) to authenticated;
-- the Academy page's zero-argument call keeps working: it rotates the Academy room
create or replace function public.ea_room_rotate_link() returns text
language sql volatile security definer set search_path = public as
$$ select public.ea_room_rotate_link((select id from public.ea_rooms where slug = 'academy')) $$;
revoke all on function public.ea_room_rotate_link() from public, anon;
grant execute on function public.ea_room_rotate_link() to authenticated;

-- publish copies watch_url → THAT room's recording_url and unpublishes only THAT room's other
-- replays (0036 unpublished every other row — with two rooms that would clear the Academy's).
create or replace function public.ea_room_publish_replay(p_replay uuid, p_publish boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r public.ea_room_replays%rowtype;
begin
  -- host-ness is checked BEFORE readiness: a non-host must get the same 42501 whether the id is
  -- someone else's ready replay, not-ready replay, or bogus — never a P0002 that would let a
  -- non-host probe which replay ids exist or are ready
  select * into r from public.ea_room_replays where id = p_replay;
  if not found or r.room_id is null or not public.ea_room_is_host(r.room_id) then
    raise exception 'only a host can do that' using errcode = '42501';
  end if;
  if r.status <> 'ready' or r.watch_url is null then raise exception 'this replay is not ready' using errcode = 'P0002'; end if;
  if p_publish then
    update public.ea_room_replays set published = true, updated_at = now() where id = r.id;
    update public.ea_room_replays set published = false, updated_at = now() where id <> r.id and published and room_id = r.room_id;
    update public.ea_rooms set recording_url = r.watch_url, updated_at = now() where id = r.room_id;
    return jsonb_build_object('ok', true, 'published', true, 'recording_url', r.watch_url);
  else
    update public.ea_room_replays set published = false, updated_at = now() where id = r.id and published;
    update public.ea_rooms set recording_url = null, updated_at = now() where id = r.room_id and recording_url = r.watch_url;
    return jsonb_build_object('ok', true, 'published', false, 'recording_url', null);
  end if;
end $$;
revoke all on function public.ea_room_publish_replay(uuid, boolean) from public, anon;
grant execute on function public.ea_room_publish_replay(uuid, boolean) to authenticated;

-- only Nelson sets who hosts a room: lowercased, trimmed, deduplicated, valid-looking, at most 50
create or replace function public.ea_room_set_hosts(p_room uuid, p_emails text[]) returns text[]
language plpgsql volatile security definer set search_path = public as $$
declare v text[];
begin
  if not public.ea_is_admin() then raise exception 'only Nelson can do that' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct e order by e), '{}'::text[]) into v
    from (select lower(trim(x)) as e from unnest(coalesce(p_emails, '{}'::text[])) as x) s
    where e ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  if coalesce(array_length(v, 1), 0) > 50 then raise exception 'at most 50 hosts' using errcode = '22023'; end if;
  update public.ea_rooms set host_emails = v, updated_at = now() where id = p_room;
  if not found then raise exception 'no such room' using errcode = 'P0002'; end if;
  return v;
end $$;
revoke all on function public.ea_room_set_hosts(uuid, text[]) from public, anon;
grant execute on function public.ea_room_set_hosts(uuid, text[]) to authenticated;

select 'ht room ready' as status;

-- 0038: an open door on a room — anyone SIGNED IN may enter while the class is running, no link key
-- needed. Nelson, 2026-09-15, with a university guest stuck at "you need your host's link": "anyone
-- should be able to enter the room once signed in." Per room: on for ht, OFF for the Academy room
-- (Nelson's own room stays link-only, exactly as 0036/0037 left it). The link still exists — it is
-- how a stranger finds the page and how the host card is shared — it just stops being the gate.
-- Safe to re-run. Runs after 0037.
alter table public.ea_rooms add column if not exists open_door boolean not null default false;
update public.ea_rooms set open_door = true where slug = 'ht';
-- no update grant for authenticated: only a migration flips it (same class as slug / presets)

create or replace function public.ea_room_state(p_key text default null, p_slug text default 'academy') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.ea_rooms%rowtype;
  v_host boolean; v_member boolean; v_joined boolean; v_can boolean; v_signed boolean;
begin
  select * into r from public.ea_rooms where slug = p_slug;
  if not found then return null; end if;
  v_signed := auth.uid() is not null;
  v_host := public.ea_room_is_host(r.id);
  v_member := (r.slug = 'academy') and public.ea_is_member();      -- Academy membership opens the Academy room only
  v_joined := v_signed and exists (select 1 from public.ea_room_members m where m.room_id = r.id and m.user_id = auth.uid());
  -- the open door: any signed-in account may enter this room (the join function still requires the
  -- class to be running); the key keeps working for everyone else and for a signed-out visitor's
  -- Sign-in link. A wrong key on an open-door room is NOT a dead link — the person can still walk in.
  v_can := v_host or v_member or (r.open_door and v_signed) or (p_key is not null and p_key = r.link_key);
  if (not v_can) and p_key is not null and p_key <> r.link_key then
    return jsonb_build_object('bad_link', true);
  end if;
  return jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'is_live', r.is_live, 'host_name', r.host_name,
    'signed_in', v_signed,
    'is_host', v_host,
    'can_join', v_can,
    'open_door', r.open_door,
    'bad_link', false,
    'recording_url', case when v_host or v_member or (r.slug <> 'academy' and v_joined) then r.recording_url else null end,
    'people', case when v_host then (select count(*) from public.ea_room_members m
                                      where m.room_id = r.id and m.last_joined_at >= coalesce(r.live_since, 'epoch'::timestamptz))
                   else null end
  );
end $$;
revoke all on function public.ea_room_state(text, text) from public;
grant execute on function public.ea_room_state(text, text) to anon, authenticated;

select 'ht open door ready' as status;

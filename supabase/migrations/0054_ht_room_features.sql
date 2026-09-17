-- 0054 — the HT room gets the class features that fit a standing room (spec 2026-09-17-ht-hub-demo-ready-design.md §2).
-- 1 Files in a room: materials rows filed under room_key 'room:<uuid>' — read by anyone in the room
--   (ea_class_can, 0042: signed in = in), written by a host of that room (ea_class_is_host: Nelson + the row's
--   host_emails). The bytes get their own prefix, materials/<uid>/room/<room uuid>/…, with storage policies
--   on it — the scoping 0045 named as "a later change" — so a room's files never depend on the cohort's
--   materials/ read (0016), which an HT guest does not have.
-- 2 A warm-up question per room and a Next session (title + time) on the row; ea_room_state returns them so
--   a guest's waiting screen and the Live space can read them without a select on ea_rooms (hosts only).
-- Additive and idempotent. Undo notes at the end.

/* 1 — materials for room keys */
drop policy if exists mat_read on public.ea_opil_materials;
create policy mat_read on public.ea_opil_materials for select to authenticated
  using ((room_key is null or (room_key not like 'team:%' and room_key not like 'room:%'))
         and (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())));
drop policy if exists mat_room_read on public.ea_opil_materials;
create policy mat_room_read on public.ea_opil_materials for select to authenticated
  using (room_key like 'room:%' and public.ea_class_can(room_key));
drop policy if exists mat_cohort_insert on public.ea_opil_materials;
create policy mat_cohort_insert on public.ea_opil_materials for insert to authenticated
  with check (uploaded_by = auth.uid() and kind = 'resource' and link_url is null
              and file_path like 'materials/' || auth.uid()::text || '/%'
              and (room_key is null or (room_key not like 'team:%' and room_key not like 'room:%'))
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid())));
drop policy if exists mat_room_insert on public.ea_opil_materials;
create policy mat_room_insert on public.ea_opil_materials for insert to authenticated
  with check (uploaded_by = auth.uid() and kind = 'resource' and link_url is null
              and file_path like 'materials/' || auth.uid()::text || '/room/' || public.ea_class_key_id(room_key) || '/%'
              and room_key like 'room:%' and public.ea_class_is_host(room_key));
/* delete: mat_own_delete (0041) — the uploader removes their own row; a host removes their own file. */

/* 2 — the bytes: a room prefix inside the uploader's folder */
drop policy if exists "opil files room read" on storage.objects;
create policy "opil files room read" on storage.objects for select to authenticated
  using (bucket_id = 'opil-files'
         and (storage.foldername(name))[1] = 'materials'
         and (storage.foldername(name))[3] = 'room'
         and public.ea_class_can('room:' || (storage.foldername(name))[4]));
drop policy if exists "opil files room write" on storage.objects;
create policy "opil files room write" on storage.objects for insert to authenticated
  with check (bucket_id = 'opil-files'
              and (storage.foldername(name))[1] = 'materials'
              and (storage.foldername(name))[2] = auth.uid()::text
              and (storage.foldername(name))[3] = 'room'
              and public.ea_class_is_host('room:' || (storage.foldername(name))[4]));

/* 3 — the room row: a warm-up question, a next session */
alter table public.ea_rooms add column if not exists warmup_q text check (warmup_q is null or char_length(warmup_q) <= 160);
alter table public.ea_rooms add column if not exists next_title text check (next_title is null or char_length(next_title) <= 120);
alter table public.ea_rooms add column if not exists next_at timestamptz;

/* 4 — ea_room_state carries them (the 0038 body plus three fields) */
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
  -- the open door (0038): any signed-in account may enter this room while the class runs; a wrong key on an
  -- open-door room is not a dead link
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
    'warmup_q', r.warmup_q,
    'next_title', r.next_title,
    'next_at', r.next_at,
    'recording_url', case when v_host or v_member or (r.slug <> 'academy' and v_joined) then r.recording_url else null end,
    'people', case when v_host then (select count(*) from public.ea_room_members m
                                      where m.room_id = r.id and m.last_joined_at >= coalesce(r.live_since, 'epoch'::timestamptz))
                   else null end
  );
end $$;
revoke all on function public.ea_room_state(text, text) from public;
grant execute on function public.ea_room_state(text, text) to anon, authenticated;

/* undo: drop policy mat_room_read / mat_room_insert on public.ea_opil_materials and "opil files room read" /
   "opil files room write" on storage.objects; re-create mat_read and mat_cohort_insert from 0045;
   alter table public.ea_rooms drop column warmup_q, drop column next_title, drop column next_at;
   re-run 0038's ea_room_state. */
select 'ht room features ready' as status;

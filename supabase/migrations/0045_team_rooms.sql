-- 0045 — team rooms that persist (spec 2026-09-16-class-features-design.md §3).
-- A team's standing room: ea-rtk-join { team: <uuid> } mints one RealtimeKit meeting per team the
-- first time a member walks in and keeps it (meeting_id); every entrant gets opil-student. Files
-- shown in that room are ordinary materials rows filed under room_key 'team:<id>' — LISTED only for
-- the team and the program team, never on the hub home (session_no stays null there).
-- Honest limit: the listing is team-scoped, the bytes are not. A file still lives in opil-files under
-- materials/<uid>/… where "opil files materials read" (0016) lets any cohort member who knows (or lists)
-- the path mint a signed URL. Scoping the object itself needs a team prefix in the upload path
-- (materials/<uid>/team/<team id>/…) written by the Files plugin plus a storage policy on that prefix
-- — a later change on js/rtk-resources.js, not this migration. The room page says so in plain words.
-- Additive and idempotent. RLS through ea_class_can (0042): a team member, or the program team.

/* 1 — the team's room */
alter table public.ea_opil_teams add column if not exists meeting_id text check (meeting_id is null or char_length(meeting_id) <= 120);
alter table public.ea_opil_teams add column if not exists room_open_since timestamptz;

/* 2 — materials can belong to a class key instead of (or as well as) a session */
alter table public.ea_opil_materials add column if not exists room_key text check (room_key is null or char_length(room_key) <= 80);
create index if not exists ea_opil_materials_room_idx on public.ea_opil_materials (room_key, created_at);

/* 3 — who reads what.
   A team's files are the team's: the cohort-wide read (mat_read, 0016) now stops at team keys, and a
   team-keyed row is read by ea_class_can('team:<id>') — that team's members and the program team.
   Session rows (room_key null or 'opil:N') read exactly as before; mat_fac (0018) and mat_team_read
   (0041, program team) are untouched. */
drop policy if exists mat_read on public.ea_opil_materials;
create policy mat_read on public.ea_opil_materials for select to authenticated
  using ((room_key is null or room_key not like 'team:%')
         and (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())));
drop policy if exists mat_team_room_read on public.ea_opil_materials;
create policy mat_team_room_read on public.ea_opil_materials for select to authenticated
  using (room_key like 'team:%' and public.ea_class_can(room_key));

/* 4 — who adds what.
   The cohort insert (0041) keeps its shape for session files but no longer accepts a team key — a
   cohort member must not file a row into another team's room. A team-keyed row is inserted by a
   member of THAT team (or the program team), own row, own storage folder, same file rules. */
drop policy if exists mat_cohort_insert on public.ea_opil_materials;
create policy mat_cohort_insert on public.ea_opil_materials for insert to authenticated
  with check (uploaded_by = auth.uid() and kind = 'resource' and link_url is null
              and file_path like 'materials/' || auth.uid()::text || '/%'
              and (room_key is null or room_key not like 'team:%')
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid())));
drop policy if exists mat_team_room_insert on public.ea_opil_materials;
create policy mat_team_room_insert on public.ea_opil_materials for insert to authenticated
  with check (uploaded_by = auth.uid() and kind = 'resource' and link_url is null
              and file_path like 'materials/' || auth.uid()::text || '/%'
              and room_key like 'team:%' and public.ea_class_can(room_key));
/* delete: mat_own_delete (0041, uploaded_by = auth.uid()) already covers a teammate removing their own file;
   the program team removes any through mat_admin / mat_team_read is read-only — a coordinator who must clear
   a team's file does it as admin (mat_admin, 0016). */

/* 5 — the team page and the room read the team's room state (meeting_id is never shown; it is read by
   the join function with the service role). t_read (0029) already lets the cohort and the program team
   read ea_opil_teams; nothing to add. The presence rows the block counts are readable through
   class_presence_read (0043) because ea_class_can('team:<id>') is true for a member. */

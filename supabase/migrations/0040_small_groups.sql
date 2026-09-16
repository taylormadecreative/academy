-- 0040 — Small Groups board (spec 2026-09-16-opil-small-groups-board-design.md)
-- 1. a third kind of hand: 'help' — a student in a small group asking the facilitator to pop in
--    (note = the room's meeting id). A person may hold one open hand PER KIND (a question in the
--    main room and a help request in their small group are different things).
-- 2. ea_opil_roster_teams(): who is on which team, for the program team only, so "Split by team"
--    can name the rooms after the real teams (facilitators are not cohort members and cannot read
--    ea_opil_team_members directly). Staff teams are left out.

alter table public.ea_opil_hands drop constraint if exists ea_opil_hands_kind_check;
alter table public.ea_opil_hands add constraint ea_opil_hands_kind_check check (kind in ('question','comment','help'));
drop index if exists public.ea_opil_hands_one_open;
create unique index ea_opil_hands_one_open on public.ea_opil_hands (session_no, user_id, kind) where done_at is null;

alter table public.ea_room_hands drop constraint if exists ea_room_hands_kind_check;
alter table public.ea_room_hands add constraint ea_room_hands_kind_check check (kind in ('question','comment','help'));
drop index if exists public.ea_room_hands_one_open;
create unique index ea_room_hands_one_open on public.ea_room_hands (room_id, user_id, kind) where done_at is null;

create or replace function public.ea_opil_roster_teams()
returns table (user_id uuid, team_name text)
language sql stable security definer set search_path = public as $$
  select tm.user_id, t.name
  from public.ea_opil_team_members tm
  join public.ea_opil_teams t on t.id = tm.team_id
  where not coalesce(t.is_staff, false)
    and (public.ea_opil_is_admin(auth.uid()) or public.ea_opil_is_program_team(auth.uid()))
$$;
revoke all on function public.ea_opil_roster_teams() from public, anon;
grant execute on function public.ea_opil_roster_teams() to authenticated;

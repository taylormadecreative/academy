-- 0042 — class core (spec 2026-09-16-class-features-design.md). The shared ground every class plugin
-- stands on, so the same feature runs in an OPIL session today and an Academy / HT room tomorrow:
--   room_key  'opil:<session no>' | 'room:<ea_rooms.id>' | 'team:<ea_opil_teams.id>'
--   ea_class_can(key)      may this person take part (read + act)?
--   ea_class_is_host(key)  does this person run the class?
--   ea_class_events        the class's timeline (chapters, activity), realtime
--   ea_class_room_of(key)  the room's own facts for a plugin that needs them

/* who leads a session, in this order: the "Led by" name the coordinator typed on the session (kickoff: Jamal),
   the facilitator filed for it, the coordinator's own name — never whoever happened to take the host seat first
   (9/16: the kickoff read "Nelson Taylor is teaching" while Jamal led it) */
alter table public.ea_opil_sessions add column if not exists led_by text check (led_by is null or char_length(led_by) <= 80);
create or replace function public.ea_opil_session_facilitator(p_session int) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(s.led_by), '') from public.ea_opil_sessions s where s.no = p_session),
    (select coalesce(nullif(split_part(trim(f.label), ' · ', 1), ''), split_part(f.email, '@', 1)) from public.ea_opil_facilitators f where p_session = any(f.session_nos) order by f.created_at limit 1),
    (select coalesce(nullif(pr.display_name, ''), split_part(u.email, '@', 1)) from public.ea_opil_admins a join auth.users u on u.id = a.user_id left join public.ea_profiles pr on pr.user_id = a.user_id where lower(u.email) <> 'taylormademd@gmail.com' order by a.created_at limit 1)
  )
$$;
update public.ea_opil_sessions set led_by = 'Jamal Ware' where no = 1 and led_by is null;

create or replace function public.ea_class_key_kind(p_key text) returns text
language sql immutable as $$ select split_part(coalesce(p_key, ''), ':', 1) $$;
create or replace function public.ea_class_key_id(p_key text) returns text
language sql immutable as $$ select substr(coalesce(p_key, ''), position(':' in coalesce(p_key, '')) + 1) $$;

create or replace function public.ea_class_can(p_key text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare k text := public.ea_class_key_kind(p_key); v text := public.ea_class_key_id(p_key);
begin
  if auth.uid() is null then return false; end if;
  if k = 'opil' then
    return public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid());
  elsif k = 'room' then
    return true;   /* the rooms' rule (9/15): signed in = in */
  elsif k = 'team' then
    return exists (select 1 from public.ea_opil_team_members tm where tm.team_id::text = v and tm.user_id = auth.uid())
        or public.ea_opil_is_program_team(auth.uid());
  end if;
  return false;
end $$;

create or replace function public.ea_class_is_host(p_key text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare k text := public.ea_class_key_kind(p_key); v text := public.ea_class_key_id(p_key); em text;
begin
  if auth.uid() is null then return false; end if;
  if k = 'opil' then
    return v ~ '^\d+$' and public.ea_opil_is_session_host(v::int);
  elsif k = 'room' then
    if public.ea_is_admin() then return true; end if;
    select lower(u.email) into em from auth.users u where u.id = auth.uid();
    return exists (select 1 from public.ea_rooms r where r.id::text = v and em = any (array(select lower(x) from unnest(r.host_emails) x)));
  elsif k = 'team' then
    return public.ea_opil_is_program_team(auth.uid());
  end if;
  return false;
end $$;

/* the room's own facts, for a plugin that needs a title or a start time without knowing the program */
create or replace function public.ea_class_room_of(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare k text := public.ea_class_key_kind(p_key); v text := public.ea_class_key_id(p_key); j jsonb;
begin
  if not public.ea_class_can(p_key) then return null; end if;
  if k = 'opil' and v ~ '^\d+$' then
    select jsonb_build_object('kind', 'opil', 'title', s.title, 'date', s.session_date, 'starts', s.start_time, 'ends', s.end_time, 'facilitator', public.ea_opil_session_facilitator(s.no))
      into j from public.ea_opil_sessions s where s.no = v::int;
  elsif k = 'room' then
    select jsonb_build_object('kind', 'room', 'title', r.title, 'host', r.host_name) into j from public.ea_rooms r where r.id::text = v;
  elsif k = 'team' then
    select jsonb_build_object('kind', 'team', 'title', 'Team ' || t.name, 'school', t.school) into j from public.ea_opil_teams t where t.id::text = v;
  end if;
  return j;
end $$;

revoke all on function public.ea_class_can(text), public.ea_class_is_host(text), public.ea_class_room_of(text) from public, anon;
grant execute on function public.ea_class_can(text), public.ea_class_is_host(text), public.ea_class_room_of(text) to authenticated;

create table if not exists public.ea_class_events (
  id uuid primary key default gen_random_uuid(),
  room_key text not null,
  at timestamptz not null default now(),
  kind text not null check (char_length(kind) between 1 and 40),
  label text check (label is null or char_length(label) <= 200),
  data jsonb,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);
create index if not exists ea_class_events_room_idx on public.ea_class_events (room_key, at);
alter table public.ea_class_events enable row level security;
drop policy if exists class_events_read on public.ea_class_events;
create policy class_events_read on public.ea_class_events for select to authenticated using (public.ea_class_can(room_key));
drop policy if exists class_events_insert on public.ea_class_events;
create policy class_events_insert on public.ea_class_events for insert to authenticated
  with check (user_id = auth.uid() and public.ea_class_can(room_key));
grant select, insert on public.ea_class_events to authenticated;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ea_class_events') then
    alter publication supabase_realtime add table public.ea_class_events;
  end if;
end $$;

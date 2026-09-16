-- 0043 — attendance that takes itself (spec 2026-09-16-class-features-design.md §1; Nelson 9/16:
-- "attendance takes itself is the most important thing for today").
-- The room beats every 30 s; one row per person per class holds first seen / last seen / seconds in
-- the room / seconds waited. At ten minutes in an OPIL session the old check-in table gets its row
-- too, so every existing report keeps working. The program team reads the whole class; a person
-- reads their own row.
create table if not exists public.ea_class_presence (
  room_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'in' check (state in ('waiting', 'in', 'out')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  seconds int not null default 0,
  waited_s int not null default 0,
  device text check (device is null or char_length(device) <= 40),
  primary key (room_key, user_id)
);
create index if not exists ea_class_presence_room_idx on public.ea_class_presence (room_key, last_seen);
alter table public.ea_class_presence enable row level security;
drop policy if exists class_presence_read on public.ea_class_presence;
create policy class_presence_read on public.ea_class_presence for select to authenticated
  using (public.ea_class_can(room_key));   /* who is here is not a secret inside the class (the waiting screen lists it) */
grant select on public.ea_class_presence to authenticated;
/* writes go through the beat RPC only — no insert/update policy for the client */

create or replace function public.ea_class_presence_beat(p_key text, p_state text default 'in', p_device text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); st text := coalesce(p_state, 'in'); prev record; delta int := 0; k text; sess int; total int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'why', 'sign_in'); end if;
  if not public.ea_class_can(p_key) then return jsonb_build_object('ok', false, 'why', 'not_allowed'); end if;
  if st not in ('waiting', 'in', 'out') then st := 'in'; end if;
  select * into prev from public.ea_class_presence where room_key = p_key and user_id = uid for update;
  if not found then
    insert into public.ea_class_presence (room_key, user_id, state, device) values (p_key, uid, st, left(p_device, 40));
    total := 0;
  else
    /* credit the time since the last beat, never more than 90 s (a beat every 30 s; a sleeping tab earns nothing) */
    delta := least(90, greatest(0, extract(epoch from (now() - prev.last_seen))::int));
    update public.ea_class_presence set
      state = st, last_seen = now(),
      seconds = seconds + case when prev.state = 'in' then delta else 0 end,
      waited_s = waited_s + case when prev.state = 'waiting' then delta else 0 end,
      device = coalesce(left(p_device, 40), device)
      where room_key = p_key and user_id = uid;
    total := prev.seconds + case when prev.state = 'in' then delta else 0 end;
  end if;
  /* an OPIL session: ten minutes in the room marks attendance in the check-in table the reports read */
  k := public.ea_class_key_kind(p_key);
  if k = 'opil' and total >= 600 then
    sess := public.ea_class_key_id(p_key)::int;
    insert into public.ea_opil_attendance (session_no, user_id, marked_by) values (sess, uid, uid) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true, 'seconds', total, 'state', st);
end $$;
revoke all on function public.ea_class_presence_beat(text, text, text) from public, anon;
grant execute on function public.ea_class_presence_beat(text, text, text) to authenticated;

/* the coordinator's table: who was there, for how long, with the name, school and team — program team only */
create or replace function public.ea_class_attendance_rows(p_key text)
returns table (user_id uuid, name text, school text, team text, state text, first_seen timestamptz, last_seen timestamptz, seconds int, waited_s int)
language sql stable security definer set search_path = public as $$
  select p.user_id,
         coalesce(nullif(pr.display_name, ''), r.full_name, split_part(u.email, '@', 1)) as name,
         coalesce(r.school, '') as school,
         coalesce(t.name, '') as team,
         p.state, p.first_seen, p.last_seen, p.seconds, p.waited_s
  from public.ea_class_presence p
  join auth.users u on u.id = p.user_id
  left join public.ea_profiles pr on pr.user_id = p.user_id
  left join public.ea_opil_registrations r on lower(r.email) = lower(u.email)
  left join public.ea_opil_team_members tm on tm.user_id = p.user_id
  left join public.ea_opil_teams t on t.id = tm.team_id and not coalesce(t.is_staff, false)
  where p.room_key = p_key
    and (public.ea_opil_is_program_team(auth.uid()) or public.ea_class_is_host(p_key))
  order by p.first_seen
$$;
revoke all on function public.ea_class_attendance_rows(text) from public, anon;
grant execute on function public.ea_class_attendance_rows(text) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ea_class_presence') then
    alter publication supabase_realtime add table public.ea_class_presence;
  end if;
end $$;

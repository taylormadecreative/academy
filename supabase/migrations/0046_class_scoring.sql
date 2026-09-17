-- 0046 — judge scoring + leaderboard (spec 2026-09-16-class-features-design.md §4).
-- A session carries its rubric and the team on stage. A judge scores the presenting team from the
-- room (one row per judge per team per class, upserted); judges and coordinators watch the
-- leaderboard fill in live; students never see a score. Keyed by room_key so the same plugin
-- scores an Academy / HT room later. Additive and idempotent.

/* ---- the session: its rubric and who is presenting ---- */
alter table public.ea_opil_sessions add column if not exists rubric jsonb
  check (rubric is null or (jsonb_typeof(rubric) = 'array' and pg_column_size(rubric) <= 4000));
alter table public.ea_opil_sessions add column if not exists presenting_team uuid
  references public.ea_opil_teams(id) on delete set null;
/* the default rubric (Problem, Solution, Open-payments use, Business model, Delivery — each 1–5) lives in
   js/rtk-scoring.js DEFAULT_RUBRIC; a null rubric on the session row means "the standard five". */

/* ---- who may score: judges and coordinators (OPIL); the host of an Academy / HT room ---- */
create or replace function public.ea_class_can_judge(p_key text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare k text := public.ea_class_key_kind(p_key);
begin
  if auth.uid() is null then return false; end if;
  if k in ('opil', 'team') then
    return public.ea_opil_is_judge(auth.uid()) or public.ea_opil_is_admin(auth.uid());
  elsif k = 'room' then
    return public.ea_class_is_host(p_key);
  end if;
  return false;
end $$;
revoke all on function public.ea_class_can_judge(text) from public, anon;
grant execute on function public.ea_class_can_judge(text) to authenticated;

/* ---- who may read EVERY judge's row (each score and the note for the coordinator): the coordinator
   (OPIL admin) and the host of an Academy / HT room. A judge reads only their own rows; the
   leaderboard they see is the aggregate (ea_class_leaderboard) — never another judge's picks. ---- */
create or replace function public.ea_class_scores_can_see_all(p_key text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare k text := public.ea_class_key_kind(p_key);
begin
  if auth.uid() is null then return false; end if;
  if k in ('opil', 'team') then return public.ea_opil_is_admin(auth.uid()); end if;
  if k = 'room' then return public.ea_class_is_host(p_key); end if;
  return false;
end $$;
revoke all on function public.ea_class_scores_can_see_all(text) from public, anon;
grant execute on function public.ea_class_scores_can_see_all(text) to authenticated;

/* ---- the teams a host can put on stage (and a judge can score): every non-staff team, with school ---- */
create or replace function public.ea_class_teams(p_key text)
returns table (id uuid, name text, school text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, coalesce(t.school, '') as school
  from public.ea_opil_teams t
  where not coalesce(t.is_staff, false)
    and public.ea_class_key_kind(p_key) in ('opil', 'team')
    and (public.ea_class_can(p_key) or public.ea_class_can_judge(p_key))
  order by lower(t.name)
$$;
revoke all on function public.ea_class_teams(text) from public, anon;
grant execute on function public.ea_class_teams(text) to authenticated;

/* ---- the scores ---- */
create table if not exists public.ea_class_scores (
  id uuid primary key default gen_random_uuid(),
  room_key text not null,
  team_id uuid not null references public.ea_opil_teams(id) on delete cascade,
  judge_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object' and pg_column_size(scores) <= 2000),
  comment text check (comment is null or char_length(comment) <= 2000),
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_key, team_id, judge_id)
);
create index if not exists ea_class_scores_room_idx on public.ea_class_scores (room_key, team_id);
alter table public.ea_class_scores enable row level security;
/* read: a judge sees their own rows; the coordinator (or an Academy / HT host) sees every row.
   Never a student — a student's own team's score is not theirs to see. */
drop policy if exists class_scores_read on public.ea_class_scores;
create policy class_scores_read on public.ea_class_scores for select to authenticated
  using (judge_id = auth.uid() or public.ea_class_scores_can_see_all(room_key));
/* write: a judge writes their own row only */
drop policy if exists class_scores_insert on public.ea_class_scores;
create policy class_scores_insert on public.ea_class_scores for insert to authenticated
  with check (judge_id = auth.uid() and public.ea_class_can_judge(room_key));
drop policy if exists class_scores_update on public.ea_class_scores;
create policy class_scores_update on public.ea_class_scores for update to authenticated
  using (judge_id = auth.uid() and public.ea_class_can_judge(room_key))
  with check (judge_id = auth.uid() and public.ea_class_can_judge(room_key));
drop policy if exists class_scores_delete on public.ea_class_scores;
create policy class_scores_delete on public.ea_class_scores for delete to authenticated
  using (judge_id = auth.uid() or public.ea_opil_is_admin(auth.uid()));
grant select, insert, update, delete on public.ea_class_scores to authenticated;

/* updated_at keeps itself */
create or replace function public.ea_class_scores_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists ea_class_scores_touch on public.ea_class_scores;
create trigger ea_class_scores_touch before update on public.ea_class_scores
  for each row execute function public.ea_class_scores_touch();

/* ---- the leaderboard: average total per team, how many judges — judges + coordinators only ---- */
create or replace function public.ea_class_leaderboard(p_key text)
returns table (team_id uuid, name text, school text, judges int, avg_total numeric, best_total numeric, last_scored timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id as team_id, t.name, coalesce(t.school, '') as school,
         count(s.id)::int as judges,
         round(coalesce(avg(s.total), 0), 2) as avg_total,
         coalesce(max(s.total), 0) as best_total,
         max(s.updated_at) as last_scored
  from public.ea_opil_teams t
  join public.ea_class_scores s on s.team_id = t.id and s.room_key = p_key
  where public.ea_class_can_judge(p_key)
  group by t.id, t.name, t.school
  order by avg_total desc, judges desc, lower(t.name)
$$;
revoke all on function public.ea_class_leaderboard(text) from public, anon;
grant execute on function public.ea_class_leaderboard(text) to authenticated;

/* ---- every score row with names, for the coordinator's table and the CSV — the coordinator only
   (an Academy / HT host for a room key). A judge calling this gets no rows, not another judge's notes. ---- */
create or replace function public.ea_class_scores_rows(p_key text)
returns table (id uuid, team_id uuid, team text, school text, judge_id uuid, judge text, scores jsonb, comment text, total numeric, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.team_id, t.name as team, coalesce(t.school, '') as school,
         s.judge_id, coalesce(nullif(pr.display_name, ''), split_part(u.email, '@', 1)) as judge,
         s.scores, s.comment, s.total, s.updated_at
  from public.ea_class_scores s
  join public.ea_opil_teams t on t.id = s.team_id
  join auth.users u on u.id = s.judge_id
  left join public.ea_profiles pr on pr.user_id = s.judge_id
  where s.room_key = p_key and public.ea_class_scores_can_see_all(p_key)
  order by lower(t.name), s.updated_at
$$;
revoke all on function public.ea_class_scores_rows(text) from public, anon;
grant execute on function public.ea_class_scores_rows(text) to authenticated;

/* score rows are published: realtime hands a listener only the rows its RLS lets it read, so a judge's
   room hears its own saves and re-reads the aggregate on a timer; the coordinator page hears every row */
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ea_class_scores') then
    alter publication supabase_realtime add table public.ea_class_scores;
  end if;
end $$;

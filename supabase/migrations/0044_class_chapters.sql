-- 0044 — a replay that's a lesson (spec 2026-09-16-class-features-design.md §2).
-- The host's page files the class's timeline in ea_class_events (0042) and the words said in
-- ea_class_transcripts (this file, through one host-only RPC, 20 s batches, deduped by the line id).
-- ea-class-summary (service role) reads both and writes ea_class_summaries: five lines, what was
-- assigned, and the chapters as it saw them. The replay page at /opil/hub/replay/?s=N reads all three
-- with the class's own rule (ea_class_can) and the published replay row — except the transcript, which an
-- OPIL student reads only once that session's replay is PUBLISHED (0033's review gate: the coordinator
-- watches and trims before students see it; the words said are the same content as the recording).
-- The host and the program team read it at once. Academy/HT rooms and team rooms keep ea_class_can.
-- Additive, safe to re-run.

/* ---- the words said: one row per final transcript line ---- */
create table if not exists public.ea_class_transcripts (
  room_key text not null,
  id text not null,                                   /* the kit's line id — the same line can arrive twice; it lands once */
  at timestamptz not null default now(),
  speaker_id text,                                    /* the kit's customParticipantId (the user id) when it has one */
  speaker_name text check (speaker_name is null or char_length(speaker_name) <= 120),
  text text not null check (char_length(text) between 1 and 4000),
  primary key (room_key, id)
);
create index if not exists ea_class_transcripts_room_idx on public.ea_class_transcripts (room_key, at);
alter table public.ea_class_transcripts enable row level security;

/* may this person read the words said in this class? the class's own rule, plus — for an OPIL session —
   the host, the program team, or a published replay for that session (students wait for Publish) */
create or replace function public.ea_class_transcript_can(p_key text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare k text := public.ea_class_key_kind(p_key); v text := public.ea_class_key_id(p_key);
begin
  if not public.ea_class_can(p_key) then return false; end if;
  if k <> 'opil' then return true; end if;
  if public.ea_opil_is_program_team(auth.uid()) or public.ea_class_is_host(p_key) then return true; end if;
  if v !~ '^\d+$' then return false; end if;
  return exists (select 1 from public.ea_opil_replays r where r.session_no = v::int and r.published);
end $$;
revoke all on function public.ea_class_transcript_can(text) from public, anon;
grant execute on function public.ea_class_transcript_can(text) to authenticated;

drop policy if exists class_transcripts_read on public.ea_class_transcripts;
create policy class_transcripts_read on public.ea_class_transcripts for select to authenticated
  using (public.ea_class_transcript_can(room_key));
grant select on public.ea_class_transcripts to authenticated;
/* writes go through the RPC below only — no insert/update/delete policy for the client */

/* the host's page saves a batch of lines: [{id, at, speaker_id, speaker_name, text}, …] — at most 500 per call,
   text clipped to 4000 characters, a repeated id is skipped (on conflict do nothing) */
create or replace function public.ea_class_transcript_add(p_key text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l jsonb; n int := 0; total int := 0; lid text; ltext text; lat timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'why', 'sign_in'); end if;
  if not public.ea_class_is_host(p_key) then return jsonb_build_object('ok', false, 'why', 'not_host'); end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then return jsonb_build_object('ok', false, 'why', 'bad_lines'); end if;
  for l in select value from jsonb_array_elements(p_lines) limit 500 loop
    total := total + 1;
    lid := nullif(trim(coalesce(l->>'id', '')), '');
    ltext := nullif(trim(coalesce(l->>'text', '')), '');
    if lid is null or ltext is null then continue; end if;
    begin lat := coalesce((l->>'at')::timestamptz, now()); exception when others then lat := now(); end;
    insert into public.ea_class_transcripts (room_key, id, at, speaker_id, speaker_name, text)
      values (p_key, left(lid, 200), lat, left(l->>'speaker_id', 120), left(l->>'speaker_name', 120), left(ltext, 4000))
      on conflict (room_key, id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', n, 'seen', total);
end $$;
revoke all on function public.ea_class_transcript_add(text, jsonb) from public, anon;
grant execute on function public.ea_class_transcript_add(text, jsonb) to authenticated;

/* ---- the timeline logs a poll or a small-groups change once, even when two host pages (the coordinator
   and the facilitator, the normal room) both hear the meeting say it: the second insert in the same minute
   is refused (23505) and the room's event log only warns. The page-side check in rtk-chapters.js (only the
   poll's maker logs it) is the first line; this is the belt. `at time zone 'UTC'` keeps the expression
   immutable, which an index needs. ---- */
create unique index if not exists ea_class_events_once_a_minute on public.ea_class_events
  (room_key, kind, coalesce(label, ''), date_trunc('minute', (at at time zone 'UTC')))
  where kind in ('poll', 'groups_start', 'groups_end');

/* ---- the lesson: five lines, what was assigned, the chapters — written by ea-class-summary (service role) ---- */
create table if not exists public.ea_class_summaries (
  room_key text primary key,
  summary text not null default '',
  assignments jsonb not null default '[]'::jsonb,
  chapters jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ea_class_summaries enable row level security;
drop policy if exists class_summaries_read on public.ea_class_summaries;
create policy class_summaries_read on public.ea_class_summaries for select to authenticated
  using (public.ea_class_can(room_key));
grant select on public.ea_class_summaries to authenticated;
/* no insert/update/delete policy: only the summary function (service role) writes here */

/* ---- the replay row itself: a published replay is readable by the class (students saw only the
   watch link on the session until now; the replay page needs the row's stream id and start time).
   Drafts stay with the coordinator and that session's facilitator (0034); the raw download link
   stays server-only (0034's column grant already leaves it out). ---- */
drop policy if exists replays_published_read on public.ea_opil_replays;
create policy replays_published_read on public.ea_opil_replays for select to authenticated
  using (published and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid())));

select 'class chapters ready' as status;

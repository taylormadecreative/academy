-- 0047 — need help outside class (spec 2026-09-16-class-features-design.md §5).
-- A student on the hub (home or team page) taps "Need help with something?", picks a track, writes a
-- paragraph, sends. The row lands here; the page then calls ea-class-help-ping, which emails the
-- facilitators for that track. The program team claims / answers / closes from the coordinator page;
-- an answer is emailed to the student and shows on their hub home ("Casey answered your question").
--   room_key  'opil:hub' by default. Only OPIL keys may file help today (a facilitator queue is an OPIL
--             thing; a room: key would let any self-signed-up account make the Academy email people —
--             ea_class_can says signed in = in for rooms). A later Academy / HT queue adds its own rule.
--             On the hub itself anyone with an OPIL registration may ask — even before they are seated
--             on a team, since "the hub itself" (signing in, your team page) is exactly their problem.
--   track     business | payments | hpc | hub  (the words students see live in js/rtk-help.js)
--   status    open → claimed → answered → closed   (a claim without an answer is fine; close ends it)
-- Reads: own rows; the program team (and a room's host) every row. Writes: insert own; program team
-- updates. Names for the queue come from ea_class_help_queue() so a facilitator never needs to read
-- the roster tables directly. Realtime on the table so both pages update without a reload.

create table if not exists public.ea_class_help (
  id uuid primary key default gen_random_uuid(),
  room_key text not null default 'opil:hub',
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track text not null check (track in ('business', 'payments', 'hpc', 'hub')),
  text text not null check (char_length(text) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'claimed', 'answered', 'closed')),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_name text check (claimed_name is null or char_length(claimed_name) <= 120),
  answer text check (answer is null or char_length(answer) <= 4000),
  pinged_at timestamptz,          /* the facilitators were emailed (ea-class-help-ping, once) */
  answered_at timestamptz,
  answer_sent_at timestamptz,     /* the student was emailed the answer (once per answer) */
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ea_class_help_user_idx on public.ea_class_help (user_id, created_at desc);
create index if not exists ea_class_help_status_idx on public.ea_class_help (status, created_at desc);

/* one person's name, the way the hub says it: profile name, the facilitator label ("Casey Diké · Track 2"),
   the registration's full name, then the email's first half */
create or replace function public.ea_class_person_name(p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(pr.display_name), '') from public.ea_profiles pr where pr.user_id = p_uid),
    (select nullif(split_part(trim(f.label), ' · ', 1), '') from public.ea_opil_facilitators f join auth.users u on lower(u.email) = lower(f.email) where u.id = p_uid limit 1),
    (select nullif(trim(r.full_name), '') from public.ea_opil_registrations r join auth.users u on lower(u.email) = lower(r.email) where u.id = p_uid limit 1),
    (select split_part(u.email, '@', 1) from auth.users u where u.id = p_uid)
  )
$$;
/* not callable by a signed-in browser: it names ANY uuid (registration names, email prefixes). The trigger and
   the queue below are security definer, so they call it as the owner; the edge function calls it as service_role. */
revoke all on function public.ea_class_person_name(uuid) from public, anon, authenticated;
grant execute on function public.ea_class_person_name(uuid) to service_role;

/* may this person file a help request on the hub? Seated on a team, the program team, or an OPIL registration
   (pending or approved) under their email. A stranger who only signed in has none of these. */
create or replace function public.ea_class_help_may_ask(p_key text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if public.ea_class_key_kind(p_key) <> 'opil' then return false; end if;
  if p_key = 'opil:hub' then
    return public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()) or public.ea_opil_my_registration_status() <> 'none';
  end if;
  return public.ea_class_can(p_key);
end $$;
revoke all on function public.ea_class_help_may_ask(text) from public, anon;
grant execute on function public.ea_class_help_may_ask(text) to authenticated;

/* the row keeps its own clock and names its claimer, so a page never has to */
create or replace function public.ea_class_help_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status in ('claimed', 'answered') and new.claimed_by is null then new.claimed_by := auth.uid(); end if;
  if new.claimed_by is not null and (tg_op = 'INSERT' or new.claimed_by is distinct from old.claimed_by or new.claimed_name is null) then
    new.claimed_name := left(public.ea_class_person_name(new.claimed_by), 120);
  end if;
  if new.status = 'answered' and (tg_op = 'INSERT' or old.status is distinct from 'answered') then new.answered_at := now(); end if;
  if tg_op = 'UPDATE' and new.answer is distinct from old.answer then new.answer_sent_at := null; end if;   /* a changed answer is emailed again */
  return new;
end $$;
drop trigger if exists ea_class_help_touch on public.ea_class_help;
create trigger ea_class_help_touch before insert or update on public.ea_class_help
  for each row execute function public.ea_class_help_touch();

alter table public.ea_class_help enable row level security;
drop policy if exists class_help_read on public.ea_class_help;
create policy class_help_read on public.ea_class_help for select to authenticated
  using (user_id = auth.uid() or public.ea_opil_is_program_team(auth.uid()) or public.ea_class_is_host(room_key));
drop policy if exists class_help_insert on public.ea_class_help;
create policy class_help_insert on public.ea_class_help for insert to authenticated
  with check (user_id = auth.uid() and status = 'open' and claimed_by is null and answer is null and public.ea_class_help_may_ask(room_key));
drop policy if exists class_help_update on public.ea_class_help;
create policy class_help_update on public.ea_class_help for update to authenticated
  using (public.ea_opil_is_program_team(auth.uid()) or public.ea_class_is_host(room_key))
  with check (public.ea_opil_is_program_team(auth.uid()) or public.ea_class_is_host(room_key));
grant select, insert, update on public.ea_class_help to authenticated;
/* no delete for anyone but the service role: a closed request is the record */

/* the coordinator's queue: every request with the student's name, school and team — program team only
   (a facilitator cannot read the roster tables themselves). Empty for anyone else, never an error. */
create or replace function public.ea_class_help_queue()
returns table (id uuid, room_key text, user_id uuid, track text, text text, status text, claimed_by uuid, claimed_name text,
               answer text, pinged_at timestamptz, answered_at timestamptz, answer_sent_at timestamptz, created_at timestamptz, updated_at timestamptz,
               name text, email text, school text, team_id uuid, team_name text)
language sql stable security definer set search_path = public as $$
  select h.id, h.room_key, h.user_id, h.track, h.text, h.status, h.claimed_by, h.claimed_name,
         h.answer, h.pinged_at, h.answered_at, h.answer_sent_at, h.created_at, h.updated_at,
         public.ea_class_person_name(h.user_id) as name,
         u.email,
         coalesce(r.school, '') as school,
         t.id as team_id,
         t.name as team_name
  from public.ea_class_help h
  join auth.users u on u.id = h.user_id
  left join public.ea_opil_registrations r on lower(r.email) = lower(u.email)
  left join lateral (
    select tt.id, tt.name from public.ea_opil_team_members tm join public.ea_opil_teams tt on tt.id = tm.team_id
    where tm.user_id = h.user_id and not coalesce(tt.is_staff, false) order by tt.created_at limit 1
  ) t on true
  where public.ea_opil_is_program_team(auth.uid())
  order by h.created_at desc
$$;
revoke all on function public.ea_class_help_queue() from public, anon;
grant execute on function public.ea_class_help_queue() to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ea_class_help') then
    alter publication supabase_realtime add table public.ea_class_help;
  end if;
end $$;

-- 0052 — profile cards in People (spec 2026-09-16-class-features-design.md §11).
-- The People pane lists everyone in the room now; a tap opens a card: name, school, team and what
-- they are building (the first line of the registration project, at most 140 characters). One RPC
-- returns the whole cohort's cards to anyone in the cohort or on the program team, so the room only
-- has to match the meeting's people to rows by user id. A student who would rather not be looked up
-- flips "Hide my card" on the hub (ea_profiles.hide_card) and the RPC leaves them out — the room
-- then says "keeps their card private" instead of showing anything.
-- Additive and idempotent. The Academy / HT rooms read name + bio from ea_profiles directly (the
-- existing signed-in read policy) and honour hide_card in the page.

alter table public.ea_profiles add column if not exists hide_card boolean not null default false;

/* everyone in the cohort plus the program team, one row each: who they are, where they are from,
   which team, and what they are building — hidden cards are not returned at all */
create or replace function public.ea_opil_roster_cards()
returns table (user_id uuid, name text, school text, team text, blurb text, role text)
language sql stable security definer set search_path = public as $$
  with people as (
    select tm.user_id from public.ea_opil_team_members tm
    union
    select a.user_id from public.ea_opil_admins a
    union
    select u.id from auth.users u join public.ea_opil_facilitators f on lower(f.email) = lower(u.email)
    union
    select u.id from auth.users u join public.ea_opil_judge_emails j on lower(j.email) = lower(u.email)
  )
  select p.user_id,
         coalesce(nullif(trim(pr.display_name), ''), nullif(trim(r.full_name), ''), split_part(u.email, '@', 1)) as name,
         coalesce(nullif(trim(r.school), ''), '') as school,
         coalesce(t.name, '') as team,
         /* the first line of the project, tidied, at most 140 characters (an ellipsis when it was cut — js/rtk-roster.js blurb() does the same) */
         case when length(b.line) > 140 then left(b.line, 139) || '…' else b.line end as blurb,
         case
           when public.ea_opil_is_admin(p.user_id) then 'coordinator'
           when exists (select 1 from public.ea_opil_facilitators f where lower(f.email) = lower(u.email)) then 'facilitator'
           when public.ea_opil_is_judge(p.user_id) then 'judge'
           else 'student'
         end as role
  from people p
  join auth.users u on u.id = p.user_id
  left join public.ea_profiles pr on pr.user_id = p.user_id
  /* only an APPROVED registration may put a name, school or project on a card: registering is
     self-serve (an unused invite link, any email), so an unapproved row under a facilitator's email
     must not be what the whole cohort sees. Unapproved falls through to the profile name / the
     email's local part and an empty school and blurb — a program-team card's normal look. */
  left join public.ea_opil_registrations r on lower(r.email) = lower(u.email) and r.approved
  cross join lateral (select trim(regexp_replace(split_part(trim(coalesce(r.project, '')), E'\n', 1), '\s+', ' ', 'g')) as line) b
  left join lateral (
    select t.name from public.ea_opil_team_members tm join public.ea_opil_teams t on t.id = tm.team_id
    where tm.user_id = p.user_id and not coalesce(t.is_staff, false)
    order by tm.created_at limit 1
  ) t on true
  where (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()))
    and not coalesce(pr.hide_card, false)
  order by 2
$$;
revoke all on function public.ea_opil_roster_cards() from public, anon;
grant execute on function public.ea_opil_roster_cards() to authenticated;

select 'roster cards ready' as status;

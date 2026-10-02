-- 0058 — the view-only program team. Jamal Ware, 10/1: "We did run into a few issues with some team members
-- logging in because they were not assigned to a specific session … create a more general team profile that
-- would allow them to join sessions and review the Hub without having edit capabilities? Some of these
-- individuals may also be redesignated as facilitators for certain sessions on an as-needed basis."
--
-- Before this, a row in ea_opil_facilitators with no sessions ticked gave its owner nothing: the program team
-- (0029) counted a facilitator only with a session, so they saw a "you're not registered" hub and no room would
-- take them. A facilitator of S3 who opened S5's room was turned away too (not S5's host, not a judge, not
-- cohort → 403); that half is fixed in ea-rtk-join (program team → a participant seat, opil-judge preset).
--
-- Now the same list is the whole program team (the coordinator view's "Program team" card, same table):
--   · no sessions ticked → VIEW ONLY: the hub, every session with its materials and replays, the lockers, and any
--     running class as a participant (the room's tools, like everyone in it). Nothing on the hub they can change.
--   · sessions ticked    → facilitator of those, exactly as before, and a participant in everyone else's.
-- Ticking or unticking later moves the same row between the two.
--
-- ea_opil_is_program_team widens to the whole list, so every READ it gates (and every in-class tool a student
-- also has: a raised hand, a file in the class's Files, the room chat, a help request of their own) now reaches
-- view-only. Everything that would let them CHANGE something someone else made is carved out here with
-- ea_opil_is_view_only: answering or closing a student's help request (and the queue of them), a team's showcase
-- page, its pictures and its cover, a team's room, announcements and messages (those stay with
-- ea_opil_is_facilitator, which still needs a session). And only the cohort is marked present by the room, so
-- staff dropping into a class never count toward the attendance the reports read.
--
-- One transaction: if a function patch in step 1b finds drift it raises, and nothing in this file applies.
begin;

-- 1. who is who -----------------------------------------------------------------------------------------------
create or replace function public.ea_opil_is_program_team(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.ea_opil_is_admin(uid)
       or public.ea_opil_is_judge(uid)
       or exists (select 1 from ea_opil_facilitators f join auth.users u on lower(u.email) = lower(f.email) where u.id = uid) $$;

/* on the program team list but not a coordinator, a judge or a facilitator — the same session list the hub and the
   rooms read (ea_opil_fac_sessions), so the two can never disagree about one person */
create or replace function public.ea_opil_is_view_only(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from ea_opil_facilitators f join auth.users u on lower(u.email) = lower(f.email) where u.id = uid)
      and not public.ea_opil_is_admin(uid)
      and not public.ea_opil_is_judge(uid)
      and not public.ea_opil_is_facilitator(uid) $$;

/* the hub pages and the room functions read this; `team` and `view_only` are new, the rest is 0018's */
create or replace function public.ea_opil_my_role() returns jsonb
language sql stable security definer set search_path = public as
$$ select jsonb_build_object(
     'admin', public.ea_opil_is_admin(auth.uid()),
     'judge', public.ea_opil_is_judge(auth.uid()),
     'facilitator_sessions', to_jsonb(public.ea_opil_fac_sessions(auth.uid())),
     'team', public.ea_opil_is_program_team(auth.uid()),
     'view_only', public.ea_opil_is_view_only(auth.uid())) $$;

/* signed-in only (every policy that calls these is `to authenticated`); a visitor could otherwise ask, uid by uid,
   who is on the program team. Execute reached anon through PUBLIC, so revoke from both. */
revoke all on function public.ea_opil_is_program_team(uuid) from public, anon;
grant execute on function public.ea_opil_is_program_team(uuid) to authenticated;
revoke all on function public.ea_opil_is_view_only(uuid) from public, anon;
grant execute on function public.ea_opil_is_view_only(uuid) to authenticated;
revoke all on function public.ea_opil_my_role() from public, anon;
grant execute on function public.ea_opil_my_role() to authenticated;

-- 1b. one-line patches inside existing functions (each refuses on drift) -----------------------------------------
/* ea_class_can / ea_class_is_host / ea_class_help_queue are HT's wrappers since 20260921193229 — the OPIL logic
   lives on as ht_private.legacy_*; where HT never ran it is still public.*. For each function below, only the
   one quoted line changes, in whichever copy holds it, with the rest (SECURITY DEFINER, search_path, owner,
   grants) kept by CREATE OR REPLACE from its own definition. If the line is neither the original nor already
   this file's, it raises and the whole transaction rolls back. A second paste finds its own text and skips.
   After step 1: ea_class_help_queue is LANGUAGE sql, checked when it is created, so ea_opil_is_view_only must exist. */
do $patch$
declare p record; fn regprocedure; def text;
begin
  for p in select * from (values
    /* a team's room: its members and the working program team, not the view-only */
    ('ht_private.legacy_ea_class_can(text)', 'public.ea_class_can(text)',
     $o$tm.user_id = auth.uid())
        or public.ea_opil_is_program_team(auth.uid());$o$,
     $n$tm.user_id = auth.uid())
        or (public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid()));$n$),
    ('ht_private.legacy_ea_class_is_host(text)', 'public.ea_class_is_host(text)',
     $o$elsif k = 'team' then
    return public.ea_opil_is_program_team(auth.uid());$o$,
     $n$elsif k = 'team' then
    return public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid());$n$),
    /* the coordinator's help queue (students' names, emails, questions) is the working team's */
    ('ht_private.legacy_ea_class_help_queue()', 'public.ea_class_help_queue()',
     $o$where public.ea_opil_is_program_team(auth.uid())
  order by h.created_at desc$o$,
     $n$where public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid())
  order by h.created_at desc$n$),
    /* a team page's cover picture: the working program team's */
    (null, 'public.ea_opil_team_update(uuid,jsonb)',
     $o$if (p_patch ? 'cover_path') and not public.ea_opil_is_program_team(auth.uid()) then$o$,
     $n$if (p_patch ? 'cover_path') and not (public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid())) then$n$),
    /* ten minutes in an OPIL class marks attendance for the cohort only — never staff passing through */
    (null, 'public.ea_class_presence_beat(text,text,text)',
     $o$if k = 'opil' and total >= 600 then$o$,
     $n$if k = 'opil' and total >= 600 and public.ea_opil_in_cohort() then$n$)
  ) as t(legacy, pub, old, new)
  loop
    fn := coalesce(to_regprocedure(p.legacy), to_regprocedure(p.pub));
    if fn is null then raise exception '0058: % is missing — nothing applied', p.pub; end if;
    def := pg_get_functiondef(fn);
    if position(p.new in def) = 0 then
      if position(p.old in def) = 0 then raise exception '0058: % is not as expected — nothing applied', fn; end if;
      execute replace(def, p.old, p.new);
    end if;
  end loop;
end $patch$;

-- 2. what the program team reads (each was cohort + admin + judge/facilitator-with-a-session) -------------------
drop policy if exists sess_read on public.ea_opil_sessions;
create policy sess_read on public.ea_opil_sessions for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()));

drop policy if exists ann_read on public.ea_opil_announcements;
create policy ann_read on public.ea_opil_announcements for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()));

/* the room chat beside the video: anyone in the class reads it and talks in it (every tool for everyone, 9/15) */
drop policy if exists lc_read on public.ea_opil_live_chat;
create policy lc_read on public.ea_opil_live_chat for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()));
drop policy if exists lc_write on public.ea_opil_live_chat;
create policy lc_write on public.ea_opil_live_chat for insert to authenticated
  with check (user_id = auth.uid()
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()))
              and session_no is not null
              and exists (select 1 from public.ea_opil_sessions s
                           where s.no = ea_opil_live_chat.session_no and s.is_live));

-- 3. what view-only does not get (the function patches are step 1b) ---------------------------------------------
/* students' help requests: a view-only member sees their own, never the queue, and answers or closes none */
drop policy if exists class_help_read on public.ea_class_help;
create policy class_help_read on public.ea_class_help for select to authenticated
  using (user_id = auth.uid()
         or (public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid()))
         or public.ea_class_is_host(room_key));
drop policy if exists class_help_update on public.ea_class_help;
create policy class_help_update on public.ea_class_help for update to authenticated
  using ((public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid())) or public.ea_class_is_host(room_key))
  with check ((public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid())) or public.ea_class_is_host(room_key));

/* a team's showcase page: its members and the working program team (0051), not the view-only */
create or replace function public.ea_opil_team_can_edit(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.ea_opil_team_members m where m.team_id = p_team and m.user_id = auth.uid())
    or (public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid())))
$$;

drop policy if exists "content showcase team write" on storage.objects;
create policy "content showcase team write" on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = 'opil' and (storage.foldername(name))[2] = 'teams'
              and public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid()));
drop policy if exists "content showcase team update" on storage.objects;
create policy "content showcase team update" on storage.objects for update to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'opil' and (storage.foldername(name))[2] = 'teams'
         and public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid()));
drop policy if exists "content showcase team delete" on storage.objects;
create policy "content showcase team delete" on storage.objects for delete to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'opil' and (storage.foldername(name))[2] = 'teams'
         and public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid()));

-- 4. the card people see in class (0052): a view-only member is "Program team", not "Facilitator" --------------
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
           when public.ea_opil_is_facilitator(p.user_id) then 'facilitator'
           when public.ea_opil_is_judge(p.user_id) then 'judge'
           when public.ea_opil_is_view_only(p.user_id) then 'team'
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

commit;

select 'opil view-only program team applied' as status;

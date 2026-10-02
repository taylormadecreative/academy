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
-- What view-only does NOT get (ea_opil_is_view_only carves it out): announcements and DMs (they stay with
-- ea_opil_is_facilitator, which still needs a session), hosting a team's room, and editing a team's showcase
-- page or its pictures. Everything they gain is a read, or a seat in a running class.

-- 0. a team's room (runs first: the one change that refuses on drift) -------------------------------------
/* A team's room (key team:<id>): its members and the working program team, as before; view-only stays out.
   ea_class_can / ea_class_is_host are HT's wrappers since 20260921193229 — the OPIL logic lives on as
   ht_private.legacy_ea_class_*; where HT never ran, it is still public.ea_class_*. Only the team branch's one
   line changes, in whichever holds it. This runs FIRST: if that line is neither 0042's nor already this file's,
   it raises before anything else in the file has run. (ea_opil_is_view_only, created below, is only called
   when the plpgsql body runs, so it need not exist yet.) A second paste finds its own text and skips. */
do $team$
declare fn regprocedure; def text;
  can_old text := $o$tm.user_id = auth.uid())
        or public.ea_opil_is_program_team(auth.uid());$o$;
  can_new text := $n$tm.user_id = auth.uid())
        or (public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid()));$n$;
  host_old text := $o$elsif k = 'team' then
    return public.ea_opil_is_program_team(auth.uid());$o$;
  host_new text := $n$elsif k = 'team' then
    return public.ea_opil_is_program_team(auth.uid()) and not public.ea_opil_is_view_only(auth.uid());$n$;
begin
  fn := coalesce(to_regprocedure('ht_private.legacy_ea_class_can(text)'), to_regprocedure('public.ea_class_can(text)'));
  def := pg_get_functiondef(fn);
  if position(can_new in def) = 0 then
    if position(can_old in def) = 0 then raise exception '0058: the team branch of % is not 0042''s — nothing applied', fn; end if;
    execute replace(def, can_old, can_new);
  end if;

  fn := coalesce(to_regprocedure('ht_private.legacy_ea_class_is_host(text)'), to_regprocedure('public.ea_class_is_host(text)'));
  def := pg_get_functiondef(fn);
  if position(host_new in def) = 0 then
    if position(host_old in def) = 0 then raise exception '0058: the team branch of % is not 0042''s — nothing applied', fn; end if;
    execute replace(def, host_old, host_new);
  end if;
end $team$;

-- 1. who is who -----------------------------------------------------------------------------------------------
create or replace function public.ea_opil_is_program_team(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.ea_opil_is_admin(uid)
       or public.ea_opil_is_judge(uid)
       or exists (select 1 from ea_opil_facilitators f join auth.users u on lower(u.email) = lower(f.email) where u.id = uid) $$;

/* on the program team list with no sessions, and not a coordinator or a judge (they keep what those give) */
create or replace function public.ea_opil_is_view_only(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from ea_opil_facilitators f join auth.users u on lower(u.email) = lower(f.email)
                  where u.id = uid and coalesce(array_length(f.session_nos, 1), 0) = 0)
      and not public.ea_opil_is_admin(uid)
      and not public.ea_opil_is_judge(uid) $$;
revoke all on function public.ea_opil_is_view_only(uuid) from public, anon;
grant execute on function public.ea_opil_is_view_only(uuid) to authenticated;

/* the hub pages and the room functions read this; `team` and `view_only` are new, the rest is 0018's */
create or replace function public.ea_opil_my_role() returns jsonb
language sql stable security definer set search_path = public as
$$ select jsonb_build_object(
     'admin', public.ea_opil_is_admin(auth.uid()),
     'judge', public.ea_opil_is_judge(auth.uid()),
     'facilitator_sessions', to_jsonb(public.ea_opil_fac_sessions(auth.uid())),
     'team', public.ea_opil_is_program_team(auth.uid()),
     'view_only', public.ea_opil_is_view_only(auth.uid())) $$;
revoke all on function public.ea_opil_my_role() from anon;

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

-- 3. what view-only does not get (team rooms: step 0) -------------------------------------------------------------------------------
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


select 'opil view-only program team applied' as status;

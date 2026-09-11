-- 0028_opil_review_fixes.sql
-- Fixes from the 2026-09-10 review of the OPIL Lab Hub. (A) ea_live_upcoming lost 0023's
-- "starts_at is not null" guard when 0027 rebuilt it, so an undated DRAFT broadcast was
-- public again; re-hardened with the same grant ordering 0023 documents. (B) admins may
-- submit rubric scores, not only allowlisted judges. (C) a definer RPC that tells the
-- signed-in person whether their registration is approved / pending / none, so the hub can
-- tell a registrant where they stand before they are seated on a team. (D) the
-- registration deadline is enforced in the insert policy, not just by hiding the form.
-- (E) live chat rows must name a session that is actually live.
-- Safe to run as one paste in the SQL editor and safe to re-run.

-- ---------------------------------------------------------------- (A) teaser re-hardening
-- 0027 recreated this view with "or starts_at is null", byte-for-byte reverting the guard
-- 0023 added so a draft with no date never leaks to anon. The view is definer, so ea_live's
-- RLS does not help. Keep 0027's column list (event_id lets the room find its broadcast
-- while off air). drop + create, not create-or-replace: dropping clears stray grants.
drop view if exists public.ea_live_upcoming;
create view public.ea_live_upcoming as
  select id, title, blurb, is_live, starts_at, event_id
    from public.ea_live
   where is_live = true
      or (starts_at is not null and starts_at > (now() - interval '3 hours'))
  offset 0;

--    CRITICAL ORDERING (see 0023): the revoke must come AFTER the create. Supabase's
--    default privileges hand a brand-new view write grants the moment it exists, so a
--    revoke placed before the create is a no-op that looks like a fix.
revoke insert, update, delete, truncate, references, trigger
  on public.ea_live_upcoming from anon, authenticated, public;
grant select on public.ea_live_upcoming to anon, authenticated;

-- ---------------------------------------------------------------- (B) admins may score
-- The judge-only check locked admins out of entering a score; sc_judge_update and sc_read
-- already admit them, so this brings insert in line.
drop policy if exists sc_judge_write on public.ea_opil_scores;
create policy sc_judge_write on public.ea_opil_scores for insert to authenticated
  with check (judge_id = auth.uid()
              and (public.ea_opil_is_judge(auth.uid()) or public.ea_opil_is_admin(auth.uid())));

-- ---------------------------------------------------------------- (C) registration status
-- Same three matches ea_opil_claim_team uses (lead email, personal email, or a teammate's
-- entry in members[]), but read-only and before approval. Definer because a registrant is
-- not yet in the cohort and cannot read ea_opil_registrations. Email comes from auth.users,
-- like 0026, not from the JWT.
create or replace function public.ea_opil_my_registration_status() returns text
language sql stable security definer set search_path = public as $$
  with me as (
    select lower(u.email) as email from auth.users u where u.id = auth.uid()
  ), mine as (
    select r.approved
      from ea_opil_registrations r, me
     where me.email is not null
       and (lower(r.email) = me.email
            or lower(coalesce(r.personal_email, '')) = me.email
            or exists (select 1 from jsonb_array_elements(coalesce(r.members, '[]'::jsonb)) e
                        where lower(e ->> 'email') = me.email))
  )
  select case
           when auth.uid() is null then 'none'
           when exists (select 1 from mine where approved) then 'approved'
           when exists (select 1 from mine) then 'pending'
           else 'none'
         end;
$$;
revoke all on function public.ea_opil_my_registration_status() from public, anon;
grant execute on function public.ea_opil_my_registration_status() to authenticated;

-- ---------------------------------------------------------------- (D) server-side deadline
-- Applications closed end of day Wed Sep 9 2026 (Central) = 2026-09-10 05:00 UTC, the same
-- instant the register page's client gate uses (Date.UTC(2026, 8, 10, 5, 0, 0)). Hiding the
-- form was the only gate; anyone with the anon key could still insert. A late team is
-- seated by the program team by hand. Extending the deadline means editing this one
-- function, nothing else.
create or replace function public.ea_opil_registration_open() returns boolean
language sql stable as
$$ select now() < '2026-09-10 05:00:00+00'::timestamptz $$;
-- the policy evaluates it as the caller, so anon needs execute
grant execute on function public.ea_opil_registration_open() to anon, authenticated;

-- The opil_register_insert policy is OWNED BY 0031 (it adds the invite-link branch). It was
-- created here until 2026-09-11; re-pasting this file must not recreate it without that branch.

-- ---------------------------------------------------------------- (E) chat needs a live session
-- Every 0019 condition kept; adds: the row must name a session and that session must be
-- on air. The ea_opil_sessions subquery runs under sess_read, which every writer here
-- (cohort, admin, facilitator) already passes, so no definer helper is needed. lc_read is
-- untouched.
drop policy if exists lc_write on public.ea_opil_live_chat;
create policy lc_write on public.ea_opil_live_chat for insert to authenticated
  with check (user_id = auth.uid()
              and (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())
                   or array_length(public.ea_opil_fac_sessions(auth.uid()),1) > 0)
              and session_no is not null
              and exists (select 1 from public.ea_opil_sessions s
                           where s.no = ea_opil_live_chat.session_no and s.is_live));

select 'opil review fixes applied' as status;

-- 0057 — facilitators post cohort announcements and message students and teams (Jarrell Green, 9/26:
-- "can I send messages directly to individual students or teams / post announcements to the cohort").
-- Before this: announcements were admin-only to write and cohort/admin-only to read; a DM had to come from
-- the cohort or an admin AND go to someone on a team, so a facilitator could not send, and a student could
-- not answer a facilitator (who sits on no team). Team chat is NOT touched: it stays private to the team and
-- the admins. "Message the whole team" is one private DM per member, sent from the Messages page.
create or replace function public.ea_opil_is_facilitator(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(array_length(public.ea_opil_fac_sessions(uid), 1), 0) > 0 $$;
revoke all on function public.ea_opil_is_facilitator(uuid) from public, anon;
grant execute on function public.ea_opil_is_facilitator(uuid) to authenticated;

-- announcements: admins and facilitators post (as themselves); the cohort, admins and facilitators read
drop policy if exists ann_write on public.ea_opil_announcements;
create policy ann_write on public.ea_opil_announcements for insert to authenticated
  with check (author = auth.uid()
              and (public.ea_opil_is_admin(auth.uid()) or public.ea_opil_is_facilitator(auth.uid())));
drop policy if exists ann_read on public.ea_opil_announcements;
create policy ann_read on public.ea_opil_announcements for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid()) or public.ea_opil_is_facilitator(auth.uid()));

-- DMs stay inside the Lab: the sender is in the cohort, an admin or a facilitator; the recipient is on a
-- team, or is an admin or a facilitator (so a student can answer the program team). Nobody else, either way.
drop policy if exists dm_write on public.ea_opil_dms;
create policy dm_write on public.ea_opil_dms for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid()) or public.ea_opil_is_facilitator(auth.uid()))
    and (exists (select 1 from public.ea_opil_team_members where user_id = recipient_id)
         or public.ea_opil_is_admin(recipient_id) or public.ea_opil_is_facilitator(recipient_id))
  );

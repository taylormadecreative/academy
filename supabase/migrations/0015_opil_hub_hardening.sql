-- ==== SECURITY HARDENING (panel review) ====

-- approval gate: registrations are self-serve but a coordinator vets them
alter table public.ea_opil_registrations
  add column if not exists approved boolean not null default false;
-- seed demo/existing: leave false; coordinator approves in the admin view

-- non-recursive cohort predicate (security definer breaks the RLS self-reference)
create or replace function public.ea_opil_in_cohort() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from ea_opil_team_members where user_id = auth.uid()) $$;
revoke all on function public.ea_opil_in_cohort() from anon;

-- deterministic single team
create or replace function public.ea_opil_my_team() returns uuid
language sql stable security definer set search_path = public as
$$ select team_id from ea_opil_team_members where user_id = auth.uid()
   order by created_at asc limit 1 $$;

-- claim only APPROVED registrations; lead by email, teammates via members jsonb
create or replace function public.ea_opil_claim_team() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_email text; v_team text; v_school text; v_tid uuid; v_is_lead boolean;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return public.ea_opil_my_team(); end if;
  -- lead match
  select team_name, school, true into v_team, v_school, v_is_lead
    from ea_opil_registrations
    where approved = true
      and (lower(email) = lower(v_email) or lower(coalesce(personal_email,'')) = lower(v_email))
    limit 1;
  -- teammate match (email inside members array)
  if v_team is null then
    select r.team_name, r.school, false into v_team, v_school, v_is_lead
      from ea_opil_registrations r
      where r.approved = true
        and exists (select 1 from jsonb_array_elements(coalesce(r.members,'[]'::jsonb)) e
                    where lower(e->>'email') = lower(v_email))
      limit 1;
  end if;
  if v_team is null then return public.ea_opil_my_team(); end if;
  select id into v_tid from ea_opil_teams where lower(name) = lower(v_team);
  if v_tid is null then
    insert into ea_opil_teams(name, school) values (v_team, v_school) returning id into v_tid;
  end if;
  insert into ea_opil_team_members(team_id, user_id, role)
    values (v_tid, auth.uid(), case when v_is_lead then 'lead' else 'member' end)
    on conflict do nothing;
  return v_tid;
end $$;
revoke all on function public.ea_opil_claim_team() from anon;

-- ---- fix recursive / over-open policies ----
drop policy if exists tm_read on public.ea_opil_team_members;
create policy tm_read on public.ea_opil_team_members for select to authenticated
  using (ea_opil_is_admin(auth.uid()) or ea_opil_in_cohort());

drop policy if exists t_read on public.ea_opil_teams;
create policy t_read on public.ea_opil_teams for select to authenticated
  using (ea_opil_is_admin(auth.uid()) or ea_opil_in_cohort());

-- DMs only between cohort members (kills cross-project spam)
drop policy if exists dm_write on public.ea_opil_dms;
create policy dm_write on public.ea_opil_dms for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (ea_opil_in_cohort() or ea_opil_is_admin(auth.uid()))
    and exists (select 1 from ea_opil_team_members where user_id = recipient_id)
  );

-- announcements + sessions: cohort only, never the whole Academy
drop policy if exists ann_read on public.ea_opil_announcements;
create policy ann_read on public.ea_opil_announcements for select to authenticated
  using (ea_opil_in_cohort() or ea_opil_is_admin(auth.uid()));
drop policy if exists sess_read on public.ea_opil_sessions;
create policy sess_read on public.ea_opil_sessions for select to authenticated
  using (ea_opil_in_cohort() or ea_opil_is_admin(auth.uid()));

-- deliverables: publishable by admin; no anon row read (showcase view only)
drop policy if exists del_pub_read on public.ea_opil_deliverables;
drop policy if exists del_write on public.ea_opil_deliverables;
create policy del_write on public.ea_opil_deliverables for insert to authenticated
  with check (uploaded_by = auth.uid() and team_id = ea_opil_my_team() and published = false);
drop policy if exists del_admin_update on public.ea_opil_deliverables;
create policy del_admin_update on public.ea_opil_deliverables for update to authenticated
  using (ea_opil_is_admin(auth.uid())) with check (ea_opil_is_admin(auth.uid()));

-- admins approve registrations
drop policy if exists reg_admin_update on public.ea_opil_registrations;
create policy reg_admin_update on public.ea_opil_registrations for update to authenticated
  using (ea_opil_is_admin(auth.uid())) with check (ea_opil_is_admin(auth.uid()));

select 'hardened' as status;

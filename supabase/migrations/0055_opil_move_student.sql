-- 0055 — the coordinator moves a student to another team from /opil/hub/admin/ (Registrations → Move).
-- Proven need 9/22: Bengisu Kazazlar typed "FAMU Impact" instead of "Rattler Impact" at registration and
-- Jamal had to email us to fix it by hand. One call does what that hand fix did:
--   1. the registration row takes the target team's name (and its school, when the team already exists)
--   2. every non-staff team seat held by that student is dropped — the registration email AND the personal
--      email sign-in, so a duplicate seat like Javonte's 9/23 gmail one goes too — and one seat is made on
--      the target team (lead only when that team has no lead yet)
--   3. a new team name makes the team (the slug trigger from 0051 names its page)
--   4. the old team is deleted ONLY when nothing is left on it: no seats, no registration, no chat, no locker
--      work, no scores (ea_opil_teams cascades into all of those, so anything else keeps it)
-- A student who never signed in has no seat; the registration change alone places them on first sign-in
-- (ea_opil_claim_team matches the registration by team key). Program team only.
create or replace function public.ea_opil_move_student(p_reg uuid, p_team text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reg ea_opil_registrations%rowtype;
  v_name text := btrim(coalesce(p_team, ''));
  v_to ea_opil_teams%rowtype;
  v_from ea_opil_teams%rowtype;
  v_uids uuid[];
  v_seated boolean := false;
  v_removed boolean := false;
  v_kept text := null;
begin
  if not ea_opil_is_admin(auth.uid()) then raise exception 'only the program team can move students' using errcode = '42501'; end if;
  if v_name = '' or char_length(v_name) > 80 then raise exception 'give the team a name (80 characters at most)' using errcode = '22023'; end if;
  select * into v_reg from ea_opil_registrations where id = p_reg for update;
  if not found then raise exception 'that registration no longer exists' using errcode = 'P0002'; end if;

  select * into v_from from ea_opil_teams
   where not is_staff and ea_opil_team_key(name) = ea_opil_team_key(v_reg.team_name) limit 1;
  select * into v_to from ea_opil_teams
   where not is_staff and ea_opil_team_key(name) = ea_opil_team_key(v_name) limit 1;
  if v_to.id is not null and v_from.id is not null and v_to.id = v_from.id then
    return jsonb_build_object('from', v_from.name, 'to', v_to.name, 'unchanged', true);
  end if;
  if exists (select 1 from ea_opil_teams where is_staff and ea_opil_team_key(name) = ea_opil_team_key(v_name)) then
    raise exception 'that name belongs to the program team space' using errcode = '22023';
  end if;

  update ea_opil_registrations
     set team_name = coalesce(v_to.name, v_name), school = coalesce(v_to.school, school)
   where id = p_reg;

  select coalesce(array_agg(id), '{}') into v_uids from auth.users
   where lower(email) in (lower(v_reg.email), lower(coalesce(v_reg.personal_email, '')));

  if array_length(v_uids, 1) > 0 then
    delete from ea_opil_team_members m using ea_opil_teams t
     where t.id = m.team_id and not t.is_staff and m.user_id = any(v_uids);
    if v_to.id is null then
      insert into ea_opil_teams(name, school) values (v_name, v_reg.school) returning * into v_to;
    end if;
    -- one seat: the account on the registration email, else the personal-email one
    insert into ea_opil_team_members(team_id, user_id, role)
    select v_to.id, u.id,
           case when exists (select 1 from ea_opil_team_members where team_id = v_to.id and role = 'lead') then 'member' else 'lead' end
      from auth.users u where u.id = any(v_uids)
     order by (lower(u.email) = lower(v_reg.email)) desc limit 1
    on conflict do nothing;
    v_seated := true;
  end if;

  if v_from.id is not null then
    if exists (select 1 from ea_opil_team_members where team_id = v_from.id) then
      v_kept := null;  -- teammates still there: nothing to report
    elsif exists (select 1 from ea_opil_registrations where ea_opil_team_key(team_name) = ea_opil_team_key(v_from.name)) then
      v_kept := 'someone who has not signed in yet is still registered on it';
    elsif exists (select 1 from ea_opil_team_messages where team_id = v_from.id)
       or exists (select 1 from ea_opil_deliverables where team_id = v_from.id)
       or exists (select 1 from ea_class_scores where team_id = v_from.id) then
      v_kept := 'it has chat, locker work or scores on it';
    else
      delete from ea_opil_teams where id = v_from.id;
      v_removed := true;
    end if;
  end if;

  return jsonb_build_object('from', coalesce(v_from.name, v_reg.team_name), 'to', coalesce(v_to.name, v_name),
    'seated', v_seated, 'old_removed', v_removed, 'old_kept', v_kept);
end $$;
revoke all on function public.ea_opil_move_student(uuid, text) from public, anon;
grant execute on function public.ea_opil_move_student(uuid, text) to authenticated;

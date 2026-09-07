-- OPIL: stop free-text team names from splitting one team into several,
-- and seat exactly one lead per team.
-- Proven failure: Alabama State registered as "Team KIMT", "Kimt", and "KIMT"
-- across three students; lower(name) matching made three one-person teams.
-- Also: every self-registrant was seated as 'lead' (Rattler Impact = 3 leads).

-- Normalized join key: case-, punctuation- and space-insensitive, and a
-- leading "Team " is ignored ("Team KIMT" == "KIMT" == "Kimt").
create or replace function public.ea_opil_team_key(t text) returns text
language sql immutable parallel safe as
$$ select regexp_replace(
     regexp_replace(lower(coalesce(t, '')), '^\s*team\s+', ''),
     '[^a-z0-9]', '', 'g') $$;

create or replace function public.ea_opil_claim_team() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_email text; v_team text; v_school text; v_tid uuid; v_is_lead boolean := false; v_reg_at timestamptz;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return public.ea_opil_my_team(); end if;
  -- self match: the student registered under their own email
  select team_name, school, created_at into v_team, v_school, v_reg_at
    from ea_opil_registrations
    where approved = true
      and (lower(email) = lower(v_email) or lower(coalesce(personal_email,'')) = lower(v_email))
    order by created_at limit 1;
  if v_team is not null then
    -- lead = the earliest approved registrant of this team, nobody else
    select not exists (
      select 1 from ea_opil_registrations r
       where r.approved = true
         and ea_opil_team_key(r.team_name) = ea_opil_team_key(v_team)
         and r.created_at < v_reg_at) into v_is_lead;
  else
    -- teammate match: their email appears in someone else's members array
    select r.team_name, r.school into v_team, v_school
      from ea_opil_registrations r
      where r.approved = true
        and exists (select 1 from jsonb_array_elements(coalesce(r.members,'[]'::jsonb)) e
                    where lower(e->>'email') = lower(v_email))
      order by r.created_at limit 1;
  end if;
  if v_team is null then return public.ea_opil_my_team(); end if;
  select id into v_tid from ea_opil_teams
    where ea_opil_team_key(name) = ea_opil_team_key(v_team) limit 1;
  if v_tid is null then
    -- earliest registration of this team wins the display name and school
    select r.team_name, r.school into v_team, v_school from ea_opil_registrations r
      where r.approved = true and ea_opil_team_key(r.team_name) = ea_opil_team_key(v_team)
      order by r.created_at limit 1;
    insert into ea_opil_teams(name, school) values (v_team, v_school) returning id into v_tid;
  end if;
  insert into ea_opil_team_members(team_id, user_id, role)
    values (v_tid, auth.uid(), case when v_is_lead then 'lead' else 'member' end)
    on conflict do nothing;
  return v_tid;
end $$;
revoke all on function public.ea_opil_claim_team() from anon;

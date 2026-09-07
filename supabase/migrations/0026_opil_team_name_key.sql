-- OPIL: stop free-text team names from splitting one team into several.
-- Proven failure: Alabama State registered as "Team KIMT", "Kimt", and "KIMT"
-- across three students, which ea_opil_claim_team's lower(name) match would have
-- turned into three separate one-person teams.

-- Normalized join key: case-insensitive, punctuation- and space-insensitive,
-- and a leading "Team " is ignored ("Team KIMT" == "KIMT" == "Kimt").
create or replace function public.ea_opil_team_key(t text) returns text
language sql immutable parallel safe as
$$ select regexp_replace(
     regexp_replace(lower(coalesce(t, '')), '^\s*team\s+', ''),
     '[^a-z0-9]', '', 'g') $$;

-- Match teams on the key instead of lower(name).
create or replace function public.ea_opil_claim_team() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_email text; v_team text; v_school text; v_tid uuid; v_is_lead boolean;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return public.ea_opil_my_team(); end if;
  -- lead match: the student registered under their own email
  select team_name, school, true into v_team, v_school, v_is_lead
    from ea_opil_registrations
    where approved = true
      and (lower(email) = lower(v_email) or lower(coalesce(personal_email,'')) = lower(v_email))
    order by created_at limit 1;
  -- teammate match: their email appears in someone else's members array
  if v_team is null then
    select r.team_name, r.school, false into v_team, v_school, v_is_lead
      from ea_opil_registrations r
      where r.approved = true
        and exists (select 1 from jsonb_array_elements(coalesce(r.members,'[]'::jsonb)) e
                    where lower(e->>'email') = lower(v_email))
      order by r.created_at limit 1;
  end if;
  if v_team is null then return public.ea_opil_my_team(); end if;
  -- earliest registration of this team wins the display name and school
  select id into v_tid from ea_opil_teams
    where ea_opil_team_key(name) = ea_opil_team_key(v_team) limit 1;
  if v_tid is null then
    insert into ea_opil_teams(name, school) values (v_team, v_school) returning id into v_tid;
  end if;
  insert into ea_opil_team_members(team_id, user_id, role)
    values (v_tid, auth.uid(), case when v_is_lead then 'lead' else 'member' end)
    on conflict do nothing;
  return v_tid;
end $$;
revoke all on function public.ea_opil_claim_team() from anon;

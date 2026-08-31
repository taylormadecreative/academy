-- cohort directory: any cohort member can see all memberships (needed for DMs)
drop policy if exists tm_read on public.ea_opil_team_members;
create policy tm_read on public.ea_opil_team_members for select to authenticated
  using (
    ea_opil_is_admin(auth.uid())
    or exists (select 1 from public.ea_opil_team_members me where me.user_id = auth.uid())
  );
-- public showcase view (owner rights: exposes ONLY published deliverables)
create or replace view public.ea_opil_showcase as
  select t.name as team, t.school, d.title, d.link_url, d.created_at
  from public.ea_opil_deliverables d
  join public.ea_opil_teams t on t.id = d.team_id
  where d.published = true;
grant select on public.ea_opil_showcase to anon, authenticated;

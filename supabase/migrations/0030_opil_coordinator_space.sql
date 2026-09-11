-- 0030: the coordinator space.
-- A coordinator is never on a student team, so /opil/hub/team/ bounced them to hub home and
-- there was no way to show the student side (chat, the locker, an upload) from the program
-- team's own accounts. One staff team, flagged is_staff, is where every admin lands when
-- they hold no real membership. It is excluded from program stats, exports and judging.

alter table public.ea_opil_teams add column if not exists is_staff boolean not null default false;

insert into public.ea_opil_teams (name, school, is_staff)
select 'Program Team · coordinators', 'AUC Data Science Initiative × Taylormade Academy', true
where not exists (select 1 from public.ea_opil_teams where is_staff);

-- membership first (a real team always wins); the staff team only for admins with none
create or replace function public.ea_opil_my_team() returns uuid
language sql stable security definer set search_path = public as
$$ select coalesce(
     (select team_id from ea_opil_team_members where user_id = auth.uid() order by created_at asc limit 1),
     (select id from ea_opil_teams where is_staff and public.ea_opil_is_admin(auth.uid()) limit 1)) $$;

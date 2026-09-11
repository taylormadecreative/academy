-- 0029: the whole program team sees every team's locker.
-- Before this, deliverables were readable by the team, admins and judges only, and the
-- files behind them by the team and admins only — a facilitator-only login saw nothing,
-- and a judge could see a file's title but never open it.

create or replace function public.ea_opil_is_program_team(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.ea_opil_is_admin(uid)
       or public.ea_opil_is_judge(uid)
       or coalesce(array_length(public.ea_opil_fac_sessions(uid), 1), 0) > 0 $$;

-- deliverable rows
drop policy if exists del_judge_read on public.ea_opil_deliverables;
drop policy if exists del_program_read on public.ea_opil_deliverables;
create policy del_program_read on public.ea_opil_deliverables for select to authenticated
  using (public.ea_opil_is_program_team(auth.uid()));

-- team names next to the rows (judges already had this; facilitators did not)
drop policy if exists t_read on public.ea_opil_teams;
create policy t_read on public.ea_opil_teams for select to authenticated
  using (public.ea_opil_is_admin(auth.uid()) or public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()));

-- the files themselves (private bucket, signed URLs minted client-side)
drop policy if exists "opil files team read" on storage.objects;
create policy "opil files team read" on storage.objects for select to authenticated
  using (bucket_id = 'opil-files'
         and ((storage.foldername(name))[1] = public.ea_opil_my_team()::text
              or public.ea_opil_is_program_team(auth.uid())));

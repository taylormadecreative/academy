-- 0041 — Files for the class (Nelson 9/16: "when someone student or anybody can upload resources like a
-- pdf or powerpoint and showcase them to the class and make it to where its an easy download they can
-- share to everyone"). Reuses the materials the hub already lists per session (ea_opil_materials +
-- the private opil-files bucket, folder materials/ which the cohort may read since 0016):
--   1. anyone in the cohort or on the program team may add a 'resource' row for a session (own row);
--      the uploader may delete their own row (facilitators/admins already may, mat_fac / mat_admin)
--   2. storage: the same people may upload into materials/<their uid>/…; owners may delete their objects
--   3. the bucket takes up to 50 MB (decks); the table joins realtime so the Files tab updates live
drop policy if exists mat_cohort_insert on public.ea_opil_materials;
create policy mat_cohort_insert on public.ea_opil_materials for insert to authenticated
  with check (uploaded_by = auth.uid() and kind = 'resource'
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid())));
drop policy if exists mat_own_delete on public.ea_opil_materials;
create policy mat_own_delete on public.ea_opil_materials for delete to authenticated
  using (uploaded_by = auth.uid());
/* program team reads every material (facilitators could only read their own sessions' rows; judges none) */
drop policy if exists mat_team_read on public.ea_opil_materials;
create policy mat_team_read on public.ea_opil_materials for select to authenticated
  using (public.ea_opil_is_program_team(auth.uid()));

drop policy if exists "opil files cohort write" on storage.objects;
create policy "opil files cohort write" on storage.objects for insert to authenticated
  with check (bucket_id = 'opil-files'
              and (storage.foldername(name))[1] = 'materials'
              and (storage.foldername(name))[2] = auth.uid()::text
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid())));
drop policy if exists "opil files own delete" on storage.objects;
create policy "opil files own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'opil-files' and owner_id = auth.uid()::text);

update storage.buckets set file_size_limit = 52428800 where id = 'opil-files';

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ea_opil_materials') then
    alter publication supabase_realtime add table public.ea_opil_materials;
  end if;
end $$;

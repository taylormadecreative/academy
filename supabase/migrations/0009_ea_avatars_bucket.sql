-- 0009 ea-avatars: public bucket for profile photos. Per-user write under
-- {auth.uid()}/..., public read. Idempotent.
insert into storage.buckets (id, name, public)
values ('ea-avatars','ea-avatars', true)
on conflict (id) do update set public = true;

-- public read
drop policy if exists "ea_avatars_public_read" on storage.objects;
create policy "ea_avatars_public_read" on storage.objects
  for select using (bucket_id = 'ea-avatars');

-- owner write/update/delete: first path segment must equal the caller's uid
drop policy if exists "ea_avatars_owner_insert" on storage.objects;
create policy "ea_avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ea-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ea_avatars_owner_update" on storage.objects;
create policy "ea_avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'ea-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ea_avatars_owner_delete" on storage.objects;
create policy "ea_avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ea-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

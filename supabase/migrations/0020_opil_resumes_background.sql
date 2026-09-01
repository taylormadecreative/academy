-- Q11-22 of AUC's SurveyMonkey form: member resumes (PDF), team-lead academic
-- background, and the participation commitment. Registration page collects all
-- three; resumes land in a private bucket only program admins can read.

alter table public.ea_opil_registrations
  add column if not exists resumes jsonb
    check (resumes is null or (jsonb_typeof(resumes) = 'array'
           and jsonb_array_length(resumes) <= 4
           and pg_column_size(resumes) <= 4000)),
  add column if not exists background jsonb
    check (background is null or (jsonb_typeof(background) = 'object'
           and pg_column_size(background) <= 8000)),
  add column if not exists agreed_expectations boolean;

-- private resume bucket: PDFs only, 10MB cap. Anon may upload (registration is
-- anon), nobody but admins may read; no update/delete policy at all, so an
-- uploaded file can never be overwritten or pulled back out by the public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ea-opil-resumes','ea-opil-resumes', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf'];

drop policy if exists "opil_resumes_insert" on storage.objects;
create policy "opil_resumes_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'ea-opil-resumes');

drop policy if exists "opil_resumes_admin_read" on storage.objects;
create policy "opil_resumes_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'ea-opil-resumes' and ea_opil_is_admin(auth.uid()));

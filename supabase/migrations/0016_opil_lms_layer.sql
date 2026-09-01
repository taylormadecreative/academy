-- LMS layer: admin email allowlist + session materials
create table if not exists public.ea_opil_admin_emails (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
insert into public.ea_opil_admin_emails(email) values
  ('taylormademd@gmail.com'), ('jware@aucenter.edu'), ('edotson@aucenter.edu')
  on conflict do nothing;
alter table public.ea_opil_admin_emails enable row level security;
drop policy if exists adm_emails_read on public.ea_opil_admin_emails;
create policy adm_emails_read on public.ea_opil_admin_emails for select to authenticated
  using (public.ea_opil_is_admin(auth.uid()));

-- is_admin: explicit row OR allowlisted email (Jamal/Dotson are admins on first sign-in)
create or replace function public.ea_opil_is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from ea_opil_admins where user_id = uid)
   or exists(select 1 from ea_opil_admin_emails e
             join auth.users u on lower(u.email) = lower(e.email)
             where u.id = uid) $$;

-- session materials (assignments, slides, resources) managed by admins
create table if not exists public.ea_opil_materials (
  id uuid primary key default gen_random_uuid(),
  session_no int references public.ea_opil_sessions(no),
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'resource' check (kind in ('assignment','resource','recording','playbook')),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  file_path text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists ea_opil_materials_sess_idx on public.ea_opil_materials(session_no, created_at);
alter table public.ea_opil_materials enable row level security;
drop policy if exists mat_read on public.ea_opil_materials;
create policy mat_read on public.ea_opil_materials for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid()));
drop policy if exists mat_admin on public.ea_opil_materials;
create policy mat_admin on public.ea_opil_materials for all to authenticated
  using (public.ea_opil_is_admin(auth.uid())) with check (public.ea_opil_is_admin(auth.uid()));

-- storage: admins write anywhere in opil-files; cohort reads materials/ prefix
drop policy if exists "opil files admin write" on storage.objects;
create policy "opil files admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'opil-files' and public.ea_opil_is_admin(auth.uid()));
drop policy if exists "opil files admin read" on storage.objects;
create policy "opil files admin read" on storage.objects for select to authenticated
  using (bucket_id = 'opil-files' and public.ea_opil_is_admin(auth.uid()));
drop policy if exists "opil files materials read" on storage.objects;
create policy "opil files materials read" on storage.objects for select to authenticated
  using (bucket_id = 'opil-files' and (storage.foldername(name))[1] = 'materials' and public.ea_opil_in_cohort());
select 'lms layer ready' as status;

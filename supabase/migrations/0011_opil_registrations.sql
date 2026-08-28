create table if not exists public.ea_opil_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  school text not null check (char_length(school) between 2 and 120),
  team_name text not null check (char_length(team_name) between 1 and 160),
  project text check (project is null or char_length(project) <= 500),
  source text not null default 'opil-register'
);
alter table public.ea_opil_registrations enable row level security;
drop policy if exists "opil_register_insert" on public.ea_opil_registrations;
create policy "opil_register_insert" on public.ea_opil_registrations
  for insert to anon, authenticated with check (true);

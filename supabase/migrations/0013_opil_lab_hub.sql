-- OPIL Lab Hub: teams, chat, DMs, deliverables, sessions, attendance, announcements
create table if not exists public.ea_opil_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 160),
  school text,
  created_at timestamptz not null default now()
);
create table if not exists public.ea_opil_team_members (
  team_id uuid not null references public.ea_opil_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('lead','member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create table if not exists public.ea_opil_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.ea_opil_is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from ea_opil_admins where user_id = uid) $$;
create or replace function public.ea_opil_my_team() returns uuid
language sql stable security definer set search_path = public as
$$ select team_id from ea_opil_team_members where user_id = auth.uid() limit 1 $$;

create table if not exists public.ea_opil_team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.ea_opil_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists ea_opil_team_messages_team_idx on public.ea_opil_team_messages(team_id, created_at);

create table if not exists public.ea_opil_dms (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists ea_opil_dms_pair_idx on public.ea_opil_dms(sender_id, recipient_id, created_at);
create index if not exists ea_opil_dms_recipient_idx on public.ea_opil_dms(recipient_id, created_at);

create table if not exists public.ea_opil_sessions (
  no int primary key,
  kind text not null check (kind in ('thread','curriculum','hpc','milestone')),
  title text not null,
  session_date date,
  recording_url text,
  playbook_url text,
  outcome text
);
create table if not exists public.ea_opil_deliverables (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.ea_opil_teams(id) on delete cascade,
  session_no int references public.ea_opil_sessions(no),
  title text not null check (char_length(title) between 1 and 200),
  file_path text,
  link_url text check (link_url is null or link_url ~* '^https?://'),
  uploaded_by uuid not null references auth.users(id),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ea_opil_deliverables_team_idx on public.ea_opil_deliverables(team_id, created_at);

create table if not exists public.ea_opil_attendance (
  session_no int not null references public.ea_opil_sessions(no),
  user_id uuid not null references auth.users(id) on delete cascade,
  marked_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (session_no, user_id)
);
create table if not exists public.ea_opil_announcements (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- team auto-claim: registered email -> team by team_name (security definer)
create or replace function public.ea_opil_claim_team() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_email text; v_team text; v_school text; v_tid uuid;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return null; end if;
  select team_name, school into v_team, v_school from ea_opil_registrations
    where lower(email) = lower(v_email) or lower(personal_email) = lower(v_email) limit 1;
  if v_team is null then return public.ea_opil_my_team(); end if;
  select id into v_tid from ea_opil_teams where lower(name) = lower(v_team);
  if v_tid is null then
    insert into ea_opil_teams(name, school) values (v_team, v_school) returning id into v_tid;
  end if;
  insert into ea_opil_team_members(team_id, user_id) values (v_tid, auth.uid())
    on conflict do nothing;
  return v_tid;
end $$;
revoke all on function public.ea_opil_claim_team() from anon;

-- RLS
alter table public.ea_opil_teams enable row level security;
alter table public.ea_opil_team_members enable row level security;
alter table public.ea_opil_admins enable row level security;
alter table public.ea_opil_team_messages enable row level security;
alter table public.ea_opil_dms enable row level security;
alter table public.ea_opil_sessions enable row level security;
alter table public.ea_opil_deliverables enable row level security;
alter table public.ea_opil_attendance enable row level security;
alter table public.ea_opil_announcements enable row level security;

drop policy if exists t_read on public.ea_opil_teams;
create policy t_read on public.ea_opil_teams for select to authenticated
  using (ea_opil_is_admin(auth.uid()) or exists(select 1 from ea_opil_team_members m where m.team_id = id and m.user_id = auth.uid()));
drop policy if exists tm_read on public.ea_opil_team_members;
create policy tm_read on public.ea_opil_team_members for select to authenticated
  using (ea_opil_is_admin(auth.uid()) or team_id = ea_opil_my_team());
drop policy if exists adm_read on public.ea_opil_admins;
create policy adm_read on public.ea_opil_admins for select to authenticated using (user_id = auth.uid());

drop policy if exists msg_read on public.ea_opil_team_messages;
create policy msg_read on public.ea_opil_team_messages for select to authenticated
  using (team_id = ea_opil_my_team() or ea_opil_is_admin(auth.uid()));
drop policy if exists msg_write on public.ea_opil_team_messages;
create policy msg_write on public.ea_opil_team_messages for insert to authenticated
  with check (user_id = auth.uid() and team_id = ea_opil_my_team());

drop policy if exists dm_read on public.ea_opil_dms;
create policy dm_read on public.ea_opil_dms for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists dm_write on public.ea_opil_dms;
create policy dm_write on public.ea_opil_dms for insert to authenticated
  with check (sender_id = auth.uid());
drop policy if exists dm_mark_read on public.ea_opil_dms;
create policy dm_mark_read on public.ea_opil_dms for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists sess_read on public.ea_opil_sessions;
create policy sess_read on public.ea_opil_sessions for select to authenticated using (true);
drop policy if exists sess_admin on public.ea_opil_sessions;
create policy sess_admin on public.ea_opil_sessions for all to authenticated
  using (ea_opil_is_admin(auth.uid())) with check (ea_opil_is_admin(auth.uid()));

drop policy if exists del_read on public.ea_opil_deliverables;
create policy del_read on public.ea_opil_deliverables for select to authenticated
  using (team_id = ea_opil_my_team() or ea_opil_is_admin(auth.uid()));
drop policy if exists del_pub_read on public.ea_opil_deliverables;
create policy del_pub_read on public.ea_opil_deliverables for select to anon using (published = true);
drop policy if exists del_write on public.ea_opil_deliverables;
create policy del_write on public.ea_opil_deliverables for insert to authenticated
  with check (uploaded_by = auth.uid() and team_id = ea_opil_my_team());

drop policy if exists att_read on public.ea_opil_attendance;
create policy att_read on public.ea_opil_attendance for select to authenticated
  using (user_id = auth.uid() or ea_opil_is_admin(auth.uid()));
drop policy if exists att_write on public.ea_opil_attendance;
create policy att_write on public.ea_opil_attendance for all to authenticated
  using (ea_opil_is_admin(auth.uid())) with check (ea_opil_is_admin(auth.uid()));

drop policy if exists ann_read on public.ea_opil_announcements;
create policy ann_read on public.ea_opil_announcements for select to authenticated using (true);
drop policy if exists ann_write on public.ea_opil_announcements;
create policy ann_write on public.ea_opil_announcements for insert to authenticated
  with check (ea_opil_is_admin(auth.uid()) and author = auth.uid());

-- admins can read the registration roster (dashboard)
drop policy if exists reg_admin_read on public.ea_opil_registrations;
create policy reg_admin_read on public.ea_opil_registrations for select to authenticated
  using (ea_opil_is_admin(auth.uid()));

-- realtime for chat + dms
do $$ begin
  begin
    alter publication supabase_realtime add table public.ea_opil_team_messages;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.ea_opil_dms;
  exception when duplicate_object then null; end;
end $$;

-- storage bucket for deliverable files
insert into storage.buckets (id, name, public, file_size_limit)
  values ('opil-files','opil-files', false, 26214400)
  on conflict (id) do nothing;
drop policy if exists "opil files team write" on storage.objects;
create policy "opil files team write" on storage.objects for insert to authenticated
  with check (bucket_id = 'opil-files' and (storage.foldername(name))[1] = public.ea_opil_my_team()::text);
drop policy if exists "opil files team read" on storage.objects;
create policy "opil files team read" on storage.objects for select to authenticated
  using (bucket_id = 'opil-files' and ((storage.foldername(name))[1] = public.ea_opil_my_team()::text or public.ea_opil_is_admin(auth.uid())));

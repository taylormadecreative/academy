-- ==== PREMIUM LAYER: judges, credentials, facilitators, check-in ====

-- judge + facilitator allowlists (email-based, like admins)
create table if not exists public.ea_opil_judge_emails (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  label text, created_at timestamptz not null default now()
);
create table if not exists public.ea_opil_facilitators (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  label text, session_nos int[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.ea_opil_judge_emails enable row level security;
alter table public.ea_opil_facilitators enable row level security;
drop policy if exists je_admin on public.ea_opil_judge_emails;
create policy je_admin on public.ea_opil_judge_emails for all to authenticated
  using (public.ea_opil_is_admin(auth.uid())) with check (public.ea_opil_is_admin(auth.uid()));
drop policy if exists fac_admin on public.ea_opil_facilitators;
create policy fac_admin on public.ea_opil_facilitators for all to authenticated
  using (public.ea_opil_is_admin(auth.uid())) with check (public.ea_opil_is_admin(auth.uid()));

create or replace function public.ea_opil_is_judge(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from ea_opil_judge_emails e join auth.users u on lower(u.email)=lower(e.email) where u.id = uid) $$;
create or replace function public.ea_opil_fac_sessions(uid uuid) returns int[]
language sql stable security definer set search_path = public as
$$ select coalesce((select f.session_nos from ea_opil_facilitators f join auth.users u on lower(u.email)=lower(f.email) where u.id = uid limit 1), '{}') $$;
create or replace function public.ea_opil_my_role() returns jsonb
language sql stable security definer set search_path = public as
$$ select jsonb_build_object(
     'admin', public.ea_opil_is_admin(auth.uid()),
     'judge', public.ea_opil_is_judge(auth.uid()),
     'facilitator_sessions', to_jsonb(public.ea_opil_fac_sessions(auth.uid()))) $$;
revoke all on function public.ea_opil_my_role() from anon;

-- rubric scores
create table if not exists public.ea_opil_scores (
  judge_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.ea_opil_teams(id) on delete cascade,
  event text not null check (event in ('pitch','showcase')),
  rubric jsonb not null check (jsonb_typeof(rubric) = 'object' and pg_column_size(rubric) <= 4000),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  primary key (judge_id, team_id, event)
);
alter table public.ea_opil_scores enable row level security;
drop policy if exists sc_judge_write on public.ea_opil_scores;
create policy sc_judge_write on public.ea_opil_scores for insert to authenticated
  with check (judge_id = auth.uid() and public.ea_opil_is_judge(auth.uid()));
drop policy if exists sc_judge_update on public.ea_opil_scores;
create policy sc_judge_update on public.ea_opil_scores for update to authenticated
  using (judge_id = auth.uid()) with check (judge_id = auth.uid());
drop policy if exists sc_read on public.ea_opil_scores;
create policy sc_read on public.ea_opil_scores for select to authenticated
  using (judge_id = auth.uid() or public.ea_opil_is_admin(auth.uid()));

-- judges can see teams + deliverables to score them
drop policy if exists t_read on public.ea_opil_teams;
create policy t_read on public.ea_opil_teams for select to authenticated
  using (public.ea_opil_is_admin(auth.uid()) or public.ea_opil_in_cohort() or public.ea_opil_is_judge(auth.uid()));
drop policy if exists del_judge_read on public.ea_opil_deliverables;
create policy del_judge_read on public.ea_opil_deliverables for select to authenticated
  using (public.ea_opil_is_judge(auth.uid()));

-- credentials with public verification via RPC (codes not enumerable)
create table if not exists public.ea_opil_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  code text not null unique,
  title text not null default 'Open Payments Innovation Lab · 2026-27 Cohort',
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now()
);
alter table public.ea_opil_credentials enable row level security;
drop policy if exists cred_read_own on public.ea_opil_credentials;
create policy cred_read_own on public.ea_opil_credentials for select to authenticated
  using (user_id = auth.uid() or public.ea_opil_is_admin(auth.uid()));
drop policy if exists cred_admin on public.ea_opil_credentials;
create policy cred_admin on public.ea_opil_credentials for insert to authenticated
  with check (public.ea_opil_is_admin(auth.uid()));
create or replace function public.ea_opil_verify_credential(p_code text) returns jsonb
language sql stable security definer set search_path = public as
$$ select case when c.id is null then null else jsonb_build_object(
     'holder', coalesce(p.display_name,'Cohort member'),
     'title', c.title, 'issued', to_char(c.issued_at,'Month DD, YYYY'),
     'team', t.name)
   end
   from (select 1) x
   left join ea_opil_credentials c on c.code = p_code
   left join ea_profiles p on p.user_id = c.user_id
   left join ea_opil_team_members m on m.user_id = c.user_id
   left join ea_opil_teams t on t.id = m.team_id $$;
grant execute on function public.ea_opil_verify_credential(text) to anon;

-- session check-in codes + self check-in RPC
alter table public.ea_opil_sessions add column if not exists checkin_code text;
create or replace function public.ea_opil_checkin(p_no int, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.ea_opil_in_cohort() then return false; end if;
  select checkin_code into v_code from ea_opil_sessions where no = p_no;
  if v_code is null or lower(trim(p_code)) <> lower(v_code) then return false; end if;
  insert into ea_opil_attendance(session_no, user_id, marked_by)
    values (p_no, auth.uid(), auth.uid()) on conflict do nothing;
  return true;
end $$;
revoke all on function public.ea_opil_checkin(int, text) from anon;

-- facilitators manage their sessions + materials
drop policy if exists sess_fac_update on public.ea_opil_sessions;
create policy sess_fac_update on public.ea_opil_sessions for update to authenticated
  using (no = any(public.ea_opil_fac_sessions(auth.uid())))
  with check (no = any(public.ea_opil_fac_sessions(auth.uid())));
drop policy if exists mat_fac on public.ea_opil_materials;
create policy mat_fac on public.ea_opil_materials for all to authenticated
  using (session_no = any(public.ea_opil_fac_sessions(auth.uid())))
  with check (session_no = any(public.ea_opil_fac_sessions(auth.uid())) and uploaded_by = auth.uid());
drop policy if exists "opil files fac write" on storage.objects;
create policy "opil files fac write" on storage.objects for insert to authenticated
  with check (bucket_id = 'opil-files' and (storage.foldername(name))[1] = 'materials'
    and array_length(public.ea_opil_fac_sessions(auth.uid()),1) > 0);
-- facilitators + judges read sessions
drop policy if exists sess_read on public.ea_opil_sessions;
create policy sess_read on public.ea_opil_sessions for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())
         or public.ea_opil_is_judge(auth.uid()) or array_length(public.ea_opil_fac_sessions(auth.uid()),1) > 0);
select 'premium layer ready' as status;

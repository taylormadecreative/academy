-- 0035: the question queue behind "Ask a question" / "Ready to speak", and the facilitator's
-- name for the join screen. Room v2 (spec 2026-09-14-opil-room-v2-design.md).
-- A student raises one open hand per live session; hosts stage it (Bring on stage) or clear it.
-- Realtime on the table drives both the student's "You're #3 in line" and the host's queue.
create table if not exists public.ea_opil_hands (
  id uuid primary key default gen_random_uuid(),
  session_no int not null references public.ea_opil_sessions(no) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'question' check (kind in ('question','comment')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  staged_at timestamptz,
  done_at timestamptz
);
create index if not exists ea_opil_hands_open_idx on public.ea_opil_hands (session_no, created_at) where done_at is null;
create unique index if not exists ea_opil_hands_one_open on public.ea_opil_hands (session_no, user_id) where done_at is null;
alter table public.ea_opil_hands enable row level security;

-- hosts of a session = coordinators + that session's facilitators
create or replace function public.ea_opil_is_session_host(p_session int) returns boolean
language sql stable security definer set search_path = public as
$$ select public.ea_opil_is_admin(auth.uid()) or p_session = any(public.ea_opil_fac_sessions(auth.uid())) $$;
revoke all on function public.ea_opil_is_session_host(int) from public, anon;
grant execute on function public.ea_opil_is_session_host(int) to authenticated;

drop policy if exists hands_read on public.ea_opil_hands;
create policy hands_read on public.ea_opil_hands for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()));
drop policy if exists hands_insert on public.ea_opil_hands;
create policy hands_insert on public.ea_opil_hands for insert to authenticated
  with check (user_id = auth.uid()
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()))
              and exists (select 1 from public.ea_opil_sessions s where s.no = ea_opil_hands.session_no and s.is_live));
drop policy if exists hands_update_host on public.ea_opil_hands;
create policy hands_update_host on public.ea_opil_hands for update to authenticated
  using (public.ea_opil_is_session_host(session_no)) with check (public.ea_opil_is_session_host(session_no));
drop policy if exists hands_delete_own on public.ea_opil_hands;
create policy hands_delete_own on public.ea_opil_hands for delete to authenticated
  using (user_id = auth.uid() or public.ea_opil_is_session_host(session_no));
do $$ begin
  begin
    alter publication supabase_realtime add table public.ea_opil_hands;
  exception when duplicate_object then null; end;
end $$;

-- "with Casey Dike" on the join screen: the label of the first facilitator on that session.
-- ea_opil_facilitators itself is admin-only; this hands out one name, nothing else.
create or replace function public.ea_opil_session_facilitator(p_session int) returns text
language sql stable security definer set search_path = public as
$$ select coalesce(nullif(trim(f.label), ''), split_part(f.email, '@', 1))
   from public.ea_opil_facilitators f where p_session = any(f.session_nos) order by f.created_at limit 1 $$;
revoke all on function public.ea_opil_session_facilitator(int) from public, anon;
grant execute on function public.ea_opil_session_facilitator(int) to authenticated;
select 'opil hands ready' as status;

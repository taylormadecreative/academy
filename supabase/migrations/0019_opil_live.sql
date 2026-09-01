-- live streaming layer
alter table public.ea_opil_sessions
  add column if not exists stream_url text,
  add column if not exists is_live boolean not null default false;

create table if not exists public.ea_opil_live_chat (
  id uuid primary key default gen_random_uuid(),
  session_no int references public.ea_opil_sessions(no),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists ea_opil_live_chat_idx on public.ea_opil_live_chat(session_no, created_at);
alter table public.ea_opil_live_chat enable row level security;
drop policy if exists lc_read on public.ea_opil_live_chat;
create policy lc_read on public.ea_opil_live_chat for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())
         or array_length(public.ea_opil_fac_sessions(auth.uid()),1) > 0);
drop policy if exists lc_write on public.ea_opil_live_chat;
create policy lc_write on public.ea_opil_live_chat for insert to authenticated
  with check (user_id = auth.uid() and (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())
         or array_length(public.ea_opil_fac_sessions(auth.uid()),1) > 0));
do $$ begin
  begin
    alter publication supabase_realtime add table public.ea_opil_live_chat;
  exception when duplicate_object then null; end;
end $$;
select 'live layer ready' as status;

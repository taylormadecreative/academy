-- 0021_academy_live.sql
-- Taylormade Academy live streaming. Live is a MEMBER benefit: anyone can see that a
-- session is happening, only members get the playback URL and the room chat.

create table if not exists public.ea_live (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  blurb text,
  stream_url text,                              -- HLS .m3u8 (or any embeddable player URL)
  replay_url text,                              -- set after the broadcast
  is_live boolean not null default false,
  starts_at timestamptz,
  access text not null default 'members',       -- members | public
  created_at timestamptz not null default now()
);
alter table public.ea_live enable row level security;

-- Members (and admins) read the full row, stream_url included.
drop policy if exists ea_live_member_read on public.ea_live;
create policy ea_live_member_read on public.ea_live
  for select using (access = 'public' or public.ea_is_member());

drop policy if exists ea_live_admin_write on public.ea_live;
create policy ea_live_admin_write on public.ea_live
  for all using (public.ea_is_admin()) with check (public.ea_is_admin());

-- Public teaser. Everyone sees WHAT is on and WHEN. Nobody outside the membership
-- ever sees stream_url, because it is not in this view.
create or replace view public.ea_live_upcoming as
  select id, title, blurb, is_live, starts_at, access
  from public.ea_live
  where is_live = true or starts_at is null or starts_at > (now() - interval '3 hours');
grant select on public.ea_live_upcoming to anon, authenticated;

-- Room chat, members only.
create table if not exists public.ea_live_chat (
  id uuid primary key default gen_random_uuid(),
  live_id uuid references public.ea_live(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.ea_live_chat enable row level security;
create index if not exists ea_live_chat_live_idx on public.ea_live_chat (live_id, created_at desc);

drop policy if exists ea_live_chat_read on public.ea_live_chat;
create policy ea_live_chat_read on public.ea_live_chat
  for select using (public.ea_is_member());

drop policy if exists ea_live_chat_write on public.ea_live_chat;
create policy ea_live_chat_write on public.ea_live_chat
  for insert with check (user_id = auth.uid() and public.ea_is_member());

drop policy if exists ea_live_chat_admin_del on public.ea_live_chat;
create policy ea_live_chat_admin_del on public.ea_live_chat
  for delete using (public.ea_is_admin());

do $$ begin
  begin
    alter publication supabase_realtime add table public.ea_live_chat;
  exception when duplicate_object then null; end;
end $$;

select 'academy live ready' as status;

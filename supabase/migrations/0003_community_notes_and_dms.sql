-- ============================================================
-- BUILD MODE community / DMs / notes surface. PURELY ADDITIVE: only ea_* objects.
-- Shares the existing project (pgqdmnmessbbzyszjfvr) with the bk_/studio and the
-- 0001/0002 ea_* tables. Apply after 0002. Safe to run more than once.
--
-- Captures the member-area social layer that the live app calls but that was
-- never committed as a migration:
--   TABLES:  ea_profiles    public member profile card (name/bio/avatar/links/open_to)
--            ea_post_likes  likes on community posts (from 0001 ea_posts)
--            ea_notes       a buyer's private notes against a product (per slug)
--            ea_messages    1:1 direct messages between members
--            ea_blocks      member-to-member blocks (gates DMs + feed visibility)
--   FUNCS:   ea_blocked_between(u1,u2)  helper used by the DM send policy + feed
--            ea_community_feed(...)      paginated post feed w/ counts + liked_by_me
--            ea_dm_threads()             the caller's DM inbox (one row per peer)
--            ea_dm_mark_read(p_other)    marks a peer's messages to me as read
--            ea_leaderboard(p_limit)     engagement leaderboard
--
-- Depends on public.ea_posts / public.ea_comments / public.ea_profiles being
-- present (ea_posts + ea_comments come from 0001; ea_profiles is created here).
-- Entitlements/admin checks reuse 0001's ea_is_admin()/ea_is_member() where the
-- live policies rely on them. All RPCs are security definer + read-only/owner-scoped.
-- ============================================================

-- ---------- profiles (public member card; readable by any signed-in member) ----------
create table if not exists public.ea_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio text,
  avatar_url text,
  link_url text,
  open_to text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ea_profiles enable row level security;

drop policy if exists ea_profiles_read on public.ea_profiles;
create policy ea_profiles_read on public.ea_profiles
  for select using (auth.uid() is not null);
drop policy if exists ea_profiles_insert on public.ea_profiles;
create policy ea_profiles_insert on public.ea_profiles
  for insert with check (user_id = auth.uid());
drop policy if exists ea_profiles_update on public.ea_profiles;
create policy ea_profiles_update on public.ea_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- post likes (one row per (post,user); read by any signed-in member) ----------
create table if not exists public.ea_post_likes (
  post_id uuid not null references public.ea_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.ea_post_likes enable row level security;

drop policy if exists ea_post_likes_read on public.ea_post_likes;
create policy ea_post_likes_read on public.ea_post_likes
  for select using (auth.uid() is not null);
drop policy if exists ea_post_likes_insert on public.ea_post_likes;
create policy ea_post_likes_insert on public.ea_post_likes
  for insert with check (user_id = auth.uid());
drop policy if exists ea_post_likes_delete on public.ea_post_likes;
create policy ea_post_likes_delete on public.ea_post_likes
  for delete using (user_id = auth.uid());

-- ---------- notes (a buyer's private notes, scoped to a product slug) ----------
create table if not exists public.ea_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_slug text not null,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 5000),
  created_at timestamptz not null default now()
);
create index if not exists ea_notes_user_slug_idx
  on public.ea_notes using btree (user_id, product_slug, created_at desc);
alter table public.ea_notes enable row level security;

-- Notes are strictly private to their owner: select/insert/delete all gated to auth.uid().
drop policy if exists ea_notes_own_select on public.ea_notes;
create policy ea_notes_own_select on public.ea_notes
  for select using (user_id = auth.uid());
drop policy if exists ea_notes_own_insert on public.ea_notes;
create policy ea_notes_own_insert on public.ea_notes
  for insert with check (user_id = auth.uid());
drop policy if exists ea_notes_own_delete on public.ea_notes;
create policy ea_notes_own_delete on public.ea_notes
  for delete using (user_id = auth.uid());

-- ---------- blocks (member-to-member; gates DMs + feed visibility) ----------
create table if not exists public.ea_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.ea_blocks enable row level security;

-- A member can only see/manage rows where THEY are the blocker; the people who
-- blocked them stay invisible. ALL = select+insert+update+delete under one qual.
drop policy if exists ea_blocks_own on public.ea_blocks;
create policy ea_blocks_own on public.ea_blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ---------- direct messages (1:1; sender/recipient only) ----------
create table if not exists public.ea_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists ea_messages_pair_idx
  on public.ea_messages using btree (sender_id, recipient_id, created_at);
create index if not exists ea_messages_recip_idx
  on public.ea_messages using btree (recipient_id, created_at);
alter table public.ea_messages enable row level security;

-- Read: only the two parties to the message. (No update/delete policy: messages
-- are immutable to clients; read_at is flipped only via the ea_dm_mark_read RPC.)
drop policy if exists ea_messages_read on public.ea_messages;
create policy ea_messages_read on public.ea_messages
  for select using ((auth.uid() = sender_id) or (auth.uid() = recipient_id));
-- Send: you may only insert as yourself, never to yourself, and not across a block.
drop policy if exists ea_messages_send on public.ea_messages;
create policy ea_messages_send on public.ea_messages
  for insert with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and not public.ea_blocked_between(auth.uid(), recipient_id)
  );

-- ---------- block helper (used by the DM send policy + the feed RPC) ----------
-- True if either user has blocked the other. Security definer so the send-policy
-- check can read ea_blocks rows the caller can't normally see (blocks against them).
create or replace function public.ea_blocked_between(u1 uuid, u2 uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.ea_blocks b
    where (b.blocker_id = u1 and b.blocked_id = u2)
       or (b.blocker_id = u2 and b.blocked_id = u1)
  );
$$;
grant execute on function public.ea_blocked_between(uuid, uuid) to authenticated;

-- ---------- community feed (paginated posts + counts + liked_by_me) ----------
-- Security definer so it can read author display names off ea_profiles and skip
-- posts from / to blocked members regardless of the caller's own row visibility.
create or replace function public.ea_community_feed(
  p_channel text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  id uuid, author_id uuid, channel text, body text, pinned boolean,
  created_at timestamptz, author_name text,
  like_count bigint, comment_count bigint, liked_by_me boolean
) language sql stable security definer set search_path = public as $$
  select p.id, p.author_id, p.channel, p.body, p.pinned, p.created_at,
         coalesce(nullif(trim(pr.display_name), ''), 'Member') as author_name,
         (select count(*) from public.ea_post_likes l where l.post_id = p.id) as like_count,
         (select count(*) from public.ea_comments  c where c.post_id = p.id) as comment_count,
         exists(select 1 from public.ea_post_likes l2 where l2.post_id = p.id and l2.user_id = auth.uid()) as liked_by_me
  from public.ea_posts p
  left join public.ea_profiles pr on pr.user_id = p.author_id
  where (not p.hidden)
    and auth.uid() is not null
    and (p_channel is null or p.channel = p_channel)
    and not public.ea_blocked_between(auth.uid(), p.author_id)
  order by p.pinned desc, p.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;
grant execute on function public.ea_community_feed(text, integer, integer) to authenticated;

-- ---------- DM inbox: one row per conversation peer ----------
create or replace function public.ea_dm_threads()
returns table (
  other_id uuid, other_name text, last_body text, last_at timestamptz, unread bigint
) language sql stable security definer set search_path = public as $$
  with convo as (
    select case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as other_id,
           m.body, m.created_at, m.recipient_id, m.read_at
    from public.ea_messages m
    where m.sender_id = auth.uid() or m.recipient_id = auth.uid()
  ),
  agg as (
    select other_id, max(created_at) as last_at,
           sum(case when recipient_id = auth.uid() and read_at is null then 1 else 0 end) as unread
    from convo group by other_id
  )
  select a.other_id,
         coalesce(nullif(trim(p.display_name), ''), 'Member') as other_name,
         (select c.body from convo c where c.other_id = a.other_id order by c.created_at desc limit 1) as last_body,
         a.last_at, a.unread
  from agg a
  left join public.ea_profiles p on p.user_id = a.other_id
  order by a.last_at desc;
$$;
grant execute on function public.ea_dm_threads() to authenticated;

-- ---------- mark a peer's messages to me as read ----------
create or replace function public.ea_dm_mark_read(p_other uuid)
returns void
language sql security definer set search_path = public as $$
  update public.ea_messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
$$;
grant execute on function public.ea_dm_mark_read(uuid) to authenticated;

-- ---------- engagement leaderboard ----------
create or replace function public.ea_leaderboard(p_limit integer default 8)
returns table (user_id uuid, name text, posts bigint, likes bigint, score bigint)
language sql stable security definer set search_path = public as $$
  with p as (select author_id, count(*) c from public.ea_posts where not hidden group by author_id),
       l as (select pt.author_id, count(*) c from public.ea_post_likes lk
             join public.ea_posts pt on pt.id = lk.post_id group by pt.author_id),
       cm as (select author_id, count(*) c from public.ea_comments group by author_id)
  select pr.user_id,
         coalesce(nullif(trim(pr.display_name), ''), 'Member') as name,
         coalesce(p.c, 0) as posts,
         coalesce(l.c, 0) as likes,
         (coalesce(p.c,0)*2 + coalesce(l.c,0) + coalesce(cm.c,0)) as score
  from public.ea_profiles pr
  left join p  on p.author_id  = pr.user_id
  left join l  on l.author_id  = pr.user_id
  left join cm on cm.author_id = pr.user_id
  where auth.uid() is not null
    and (coalesce(p.c,0) + coalesce(l.c,0) + coalesce(cm.c,0)) > 0
  order by score desc, posts desc
  limit greatest(p_limit, 1);
$$;
grant execute on function public.ea_leaderboard(integer) to authenticated;

-- 0008 add avatar_url to feed + leaderboard RPCs.
-- Bodies copied verbatim from live definitions; only avatar_url column added.
-- security definer + set search_path + grants preserved.
-- DROP required before CREATE because the returns-table signature changes.

drop function if exists public.ea_community_feed(text, integer, integer);
drop function if exists public.ea_leaderboard(integer);

-- ── ea_community_feed ────────────────────────────────────────────────────────
-- Adds author_avatar_url text (sourced from the existing left join to ea_profiles pr).

create or replace function public.ea_community_feed(
  p_channel text default null::text,
  p_limit   integer default 50,
  p_offset  integer default 0
)
returns table(
  id               uuid,
  author_id        uuid,
  channel          text,
  body             text,
  pinned           boolean,
  created_at       timestamp with time zone,
  author_name      text,
  author_avatar_url text,
  like_count       bigint,
  comment_count    bigint,
  liked_by_me      boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.author_id, p.channel, p.body, p.pinned, p.created_at,
         coalesce(nullif(trim(pr.display_name), ''), 'Member') as author_name,
         coalesce(pr.avatar_url, '') as author_avatar_url,
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

revoke all on function public.ea_community_feed(text, integer, integer) from public, anon;
grant execute on function public.ea_community_feed(text, integer, integer) to authenticated;

-- ── ea_leaderboard ───────────────────────────────────────────────────────────
-- Adds avatar_url text (sourced from ea_profiles pr, already the driving table).

create or replace function public.ea_leaderboard(p_limit integer default 8)
returns table(
  user_id    uuid,
  name       text,
  avatar_url text,
  posts      bigint,
  likes      bigint,
  score      bigint
)
language sql stable security definer set search_path = public as $$
  with p as (select author_id, count(*) c from public.ea_posts where not hidden group by author_id),
       l as (select pt.author_id, count(*) c from public.ea_post_likes lk
             join public.ea_posts pt on pt.id = lk.post_id group by pt.author_id),
       cm as (select author_id, count(*) c from public.ea_comments group by author_id)
  select pr.user_id,
         coalesce(nullif(trim(pr.display_name), ''), 'Member') as name,
         coalesce(pr.avatar_url, '') as avatar_url,
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

revoke all on function public.ea_leaderboard(integer) from public, anon;
grant execute on function public.ea_leaderboard(integer) to authenticated;

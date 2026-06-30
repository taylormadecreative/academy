-- 0008 community media: let community posts carry a video or image (in-app),
-- e.g. the daily "Prompt of the Day" Cowork video. Applied live 2026-06-30.

alter table public.ea_posts add column if not exists media_url  text;
alter table public.ea_posts add column if not exists media_type text;  -- 'video' | 'image'

-- public bucket for community media (read = public URL; writes go through the
-- service-role bot / pipeline, so no extra RLS write policy needed).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', true, 78643200,
        array['video/mp4','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- feed RPC now returns the media fields.
drop function if exists public.ea_community_feed(text, integer, integer);
create function public.ea_community_feed(p_channel text default null, p_limit integer default 50, p_offset integer default 0)
 returns table(id uuid, author_id uuid, channel text, body text, pinned boolean, created_at timestamptz,
               author_name text, author_avatar_url text, like_count bigint, comment_count bigint,
               liked_by_me boolean, media_url text, media_type text)
 language sql stable security definer set search_path to 'public'
as $function$
  select p.id, p.author_id, p.channel, p.body, p.pinned, p.created_at,
         coalesce(nullif(trim(pr.display_name), ''), 'Member') as author_name,
         coalesce(pr.avatar_url, '') as author_avatar_url,
         (select count(*) from public.ea_post_likes l where l.post_id = p.id) as like_count,
         (select count(*) from public.ea_comments  c where c.post_id = p.id) as comment_count,
         exists(select 1 from public.ea_post_likes l2 where l2.post_id = p.id and l2.user_id = auth.uid()) as liked_by_me,
         p.media_url, p.media_type
  from public.ea_posts p
  left join public.ea_profiles pr on pr.user_id = p.author_id
  where (not p.hidden) and auth.uid() is not null
    and (p_channel is null or p.channel = p_channel)
    and not public.ea_blocked_between(auth.uid(), p.author_id)
  order by p.pinned desc, p.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$function$;
revoke all on function public.ea_community_feed(text,integer,integer) from public, anon;
grant execute on function public.ea_community_feed(text,integer,integer) to authenticated;

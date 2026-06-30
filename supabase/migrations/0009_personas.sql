-- 0009 AI regulars: an internal is_bot flag on profiles for the Academy's standing
-- AI community members. NOT surfaced in the UI (no badge) — its only job is to keep
-- them out of the leaderboard so they never rank or win. Applied live 2026-06-30.
-- The personas themselves are provisioned + driven by the ea-personas edge function.

alter table public.ea_profiles add column if not exists is_bot boolean not null default false;

-- leaderboard excludes bots.
CREATE OR REPLACE FUNCTION public.ea_leaderboard(p_limit integer DEFAULT 8)
 RETURNS TABLE(user_id uuid, name text, avatar_url text, posts bigint, likes bigint, score bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    and not coalesce(pr.is_bot, false)
    and (coalesce(p.c,0) + coalesce(l.c,0) + coalesce(cm.c,0)) > 0
  order by score desc, posts desc
  limit greatest(p_limit, 1);
$function$;

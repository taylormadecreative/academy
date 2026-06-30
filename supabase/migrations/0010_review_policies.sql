-- 0010 review policies: let an author read + delete their OWN posts (including hidden)
-- so the /review/ page can approve (un-hide) or reject (delete) staged Prompt-of-the-Day
-- videos from their own session. Applied live 2026-06-30.

drop policy if exists ea_posts_owner_read_all on public.ea_posts;
create policy ea_posts_owner_read_all on public.ea_posts
  for select using (author_id = auth.uid() or public.ea_is_admin());

drop policy if exists ea_posts_owner_delete on public.ea_posts;
create policy ea_posts_owner_delete on public.ea_posts
  for delete using (author_id = auth.uid() or public.ea_is_admin());

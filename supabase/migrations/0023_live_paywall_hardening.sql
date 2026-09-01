-- 0023_live_paywall_hardening.sql
-- Closes an anon-exploitable paywall bypass introduced by 0021.
--
-- ea_live_upcoming is a definer view (correctly, so anon can see WHAT is on without
-- seeing the playback URL). But Supabase's default privileges granted anon and
-- authenticated INSERT/UPDATE/DELETE/TRUNCATE on it, and a single-table view is
-- auto-updatable. Because the view runs with owner rights, those writes bypassed
-- ea_live's RLS entirely. An anonymous visitor could PATCH access='public' through
-- the view, then read stream_url straight off the base table, whose SELECT policy
-- trusts that same column. They could also flip broadcasts live, insert rows, or
-- TRUNCATE the table and cascade away every chat message.
--
-- Verified before the fix: anon held DELETE, INSERT, TRUNCATE, UPDATE and
-- information_schema reported is_updatable=YES, is_insertable_into=YES.

-- 1. Take the write privileges away.
revoke insert, update, delete, truncate, references, trigger
  on public.ea_live_upcoming from anon, authenticated, public;

-- ea_opil_showcase carries the same stray grants. It is a join, so Postgres already
-- refuses to auto-update it, but there is no reason for it to hold them.
revoke insert, update, delete, truncate, references, trigger
  on public.ea_opil_showcase from anon, authenticated, public;

-- 2. Rebuild the teaser so it cannot be auto-updatable even if grants come back:
--    OFFSET 0 disqualifies a view from auto-update. Also drop the access column
--    (the page never read it, and it advertised which sessions are gated) and stop
--    leaking rows that have no date yet, which is how a draft becomes public.
--    (drop + create, not create-or-replace: Postgres cannot drop a view column in
--    place, and dropping also clears the stray grants before we re-issue select.)
drop view if exists public.ea_live_upcoming;
create view public.ea_live_upcoming as
  select id, title, blurb, is_live, starts_at
  from public.ea_live
  where is_live = true
     or (starts_at is not null and starts_at > (now() - interval '3 hours'))
  offset 0;
grant select on public.ea_live_upcoming to anon, authenticated;

--    CRITICAL ORDERING: this revoke must come AFTER the create. Supabase sets
--    ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated, so a
--    newly created view is handed write privileges again the moment it exists.
--    Revoking before the create is a no-op that looks like a fix.
revoke insert, update, delete, truncate, references, trigger
  on public.ea_live_upcoming from anon, authenticated, public;

-- 3. access gates the read policy, so it must not be free text.
alter table public.ea_live drop constraint if exists ea_live_access_chk;
alter table public.ea_live add constraint ea_live_access_chk check (access in ('members','public'));

-- 4. Only one broadcast can be live at a time. The client tried to enforce this and
--    could not be trusted to: two admins racing, or an OPIL facilitator whose
--    "clear the others" update is silently filtered down to zero rows by RLS.
create unique index if not exists ea_live_one_live
  on public.ea_live ((is_live)) where is_live;
create unique index if not exists ea_opil_sessions_one_live
  on public.ea_opil_sessions ((is_live)) where is_live;

-- 5. Scope the policies to authenticated. ea_is_member() already returns false for
--    anon, so this changes no outcome, it just stops evaluating member policies on
--    anonymous traffic and matches the OPIL tables.
drop policy if exists ea_live_member_read on public.ea_live;
create policy ea_live_member_read on public.ea_live
  for select to authenticated using (access = 'public' or public.ea_is_member());

drop policy if exists ea_live_admin_write on public.ea_live;
create policy ea_live_admin_write on public.ea_live
  for all to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());

drop policy if exists ea_live_chat_read on public.ea_live_chat;
create policy ea_live_chat_read on public.ea_live_chat
  for select to authenticated using (public.ea_is_member());

drop policy if exists ea_live_chat_write on public.ea_live_chat;
create policy ea_live_chat_write on public.ea_live_chat
  for insert to authenticated with check (user_id = auth.uid() and public.ea_is_member());

drop policy if exists ea_live_chat_admin_del on public.ea_live_chat;
create policy ea_live_chat_admin_del on public.ea_live_chat
  for delete to authenticated using (public.ea_is_admin());

select 'live paywall hardened' as status;

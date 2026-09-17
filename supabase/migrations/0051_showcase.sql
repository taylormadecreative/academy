-- 0051 — showcase page per team (spec 2026-09-16-class-features-design.md §10).
-- Every team gets a public page at /opil/showcase/team/?t=<slug> once the team (or the coordinator)
-- flips "Publish our page". The team edits its own words through one definer RPC that only touches the
-- showcase columns (no broad update policy on ea_opil_teams); the page reads one anon-readable view.
--   1. columns on ea_opil_teams: slug (unique, made from the name), tagline, project, prototype_url,
--      video_url, cover_path (a picture in the public "content" bucket, opil/teams/<slug>/…), published
--   2. ea_opil_slugify(text) + a trigger that fills a missing slug; existing teams are backfilled
--   3. ea_opil_team_update(p_team, p_patch) — members and the program team; only those columns
--      ea_opil_team_publish(p_team, p_on)  — members and the program team; never the coordinator space
--   4. view ea_opil_showcase_team — anon-readable, WHERE published, members by display name (a member who
--      flipped "Hide my card" is left out), files = the team's PUBLISHED locker items that have a link
--      (grant SELECT only, revoked AFTER create: definer views inherit the default write grants)
--      Honest limit: a file dropped in the team ROOM (materials, room_key team:<id>) is private to the team
--      (0045) and lives in the private opil-files bucket with no link, so it is never on the public page —
--      the team puts a link in its locker and the coordinator publishes it. A per-file "share" switch is a
--      later feature.
--   5. the "content" bucket (public): a cover is fetched by its public URL (no policy needed); only the
--      program team may list, upload, replace or delete under opil/teams/
-- Additive and idempotent. Applies cleanly before or after 0045 and 0052 (each column below is declared
-- exactly as it is there).

-- 1. columns ---------------------------------------------------------------------------------------
alter table public.ea_opil_teams add column if not exists slug text;
alter table public.ea_opil_teams add column if not exists tagline text;
alter table public.ea_opil_teams add column if not exists project text;
alter table public.ea_opil_teams add column if not exists prototype_url text;
alter table public.ea_opil_teams add column if not exists video_url text;
alter table public.ea_opil_teams add column if not exists cover_path text;
alter table public.ea_opil_teams add column if not exists published boolean not null default false;
alter table public.ea_opil_teams add column if not exists published_at timestamptz;
/* 0045 adds materials.room_key and 0052 adds profiles.hide_card — declared here exactly as there, so the
   one that runs first wins and the other is a no-op (same check, same index, same default) */
alter table public.ea_opil_materials add column if not exists room_key text check (room_key is null or char_length(room_key) <= 80);
create index if not exists ea_opil_materials_room_idx on public.ea_opil_materials (room_key, created_at);
alter table public.ea_profiles add column if not exists hide_card boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ea_opil_teams_showcase_chk') then
    alter table public.ea_opil_teams add constraint ea_opil_teams_showcase_chk check (
      (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      and (tagline is null or char_length(tagline) <= 140)
      and (project is null or char_length(project) <= 4000)
      and (prototype_url is null or (prototype_url ~* '^https?://' and char_length(prototype_url) <= 2048))
      and (video_url is null or (video_url ~* '^https?://' and char_length(video_url) <= 2048))
      and (cover_path is null or cover_path ~ '^opil/teams/[a-z0-9-]+/[a-z0-9._-]+$')
    );
  end if;
end $$;
create unique index if not exists ea_opil_teams_slug_key on public.ea_opil_teams (slug);

-- 2. slugs -----------------------------------------------------------------------------------------
/* "Team KIMT & Co." → 'team-kimt-and-co'. Mirrors slugify() in js/rtk-showcase.js exactly (tests cover the JS):
   lower · '&' → ' and ' · apostrophes dropped · every other run of non [a-z0-9] → '-' · trimmed · ≤ 60 chars · never empty */
create or replace function public.ea_opil_slugify(p text) returns text
language sql immutable as $$
  select coalesce(nullif(trim(both '-' from left(trim(both '-' from
           regexp_replace(replace(replace(replace(lower(coalesce(p, '')), '&', ' and '), '''', ''), '’', ''), '[^a-z0-9]+', '-', 'g')
         ), 60)), ''), 'team')
$$;
/* the first free slug for a name: 'rattlers', then 'rattlers-2', 'rattlers-3' … (a team keeps its slug when renamed) */
create or replace function public.ea_opil_team_slug_for(p_name text, p_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare base text := public.ea_opil_slugify(p_name); s text := base; n int := 2;
begin
  while exists (select 1 from public.ea_opil_teams t where t.slug = s and t.id is distinct from p_id) loop
    s := base || '-' || n; n := n + 1;
  end loop;
  return s;
end $$;
create or replace function public.ea_opil_team_slug_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.slug is null or new.slug = '' then new.slug := public.ea_opil_team_slug_for(new.name, new.id); end if;
  return new;
end $$;
drop trigger if exists ea_opil_team_slug_fill on public.ea_opil_teams;
create trigger ea_opil_team_slug_fill before insert or update of name, slug on public.ea_opil_teams
  for each row execute function public.ea_opil_team_slug_fill();
/* backfill one row at a time so each new slug is visible to the next collision check */
do $$ declare r record; begin
  for r in select id, name from public.ea_opil_teams where slug is null or slug = '' order by created_at, id loop
    update public.ea_opil_teams set slug = public.ea_opil_team_slug_for(r.name, r.id) where id = r.id;
  end loop;
end $$;

-- 3. who may edit a team's page, and the two RPCs ---------------------------------------------------
create or replace function public.ea_opil_team_can_edit(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.ea_opil_team_members m where m.team_id = p_team and m.user_id = auth.uid())
    or public.ea_opil_is_program_team(auth.uid()))
$$;

/* patch = {tagline?, project?, prototype_url?, video_url?, cover_path?}; anything else is refused.
   cover_path is the program team's (coordinator, facilitators, judges) — they upload the picture into the
   content bucket. A link over 2048 characters is refused (too_long), never cut: a cut link is a broken link.
   cover_path is a file name of [a-z0-9._-] only — coverPath() in js/rtk-showcase.js emits cover-<stamp>.<ext>. */
create or replace function public.ea_opil_team_update(p_team uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.ea_opil_teams; bad text; v text;
begin
  if not public.ea_opil_team_can_edit(p_team) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'bad_patch' using errcode = '22023'; end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_patch) k
    where k not in ('tagline', 'project', 'prototype_url', 'video_url', 'cover_path');
  if bad is not null then raise exception 'unknown_field: %', bad using errcode = '22023'; end if;
  if (p_patch ? 'cover_path') and not public.ea_opil_is_program_team(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  v := nullif(trim(coalesce(p_patch->>'prototype_url', '')), '');
  if (p_patch ? 'prototype_url') and v is not null and v !~* '^https?://' then raise exception 'bad_url: prototype_url' using errcode = '22023'; end if;
  if (p_patch ? 'prototype_url') and v is not null and char_length(v) > 2048 then raise exception 'too_long: prototype_url' using errcode = '22023'; end if;
  v := nullif(trim(coalesce(p_patch->>'video_url', '')), '');
  if (p_patch ? 'video_url') and v is not null and v !~* '^https?://' then raise exception 'bad_url: video_url' using errcode = '22023'; end if;
  if (p_patch ? 'video_url') and v is not null and char_length(v) > 2048 then raise exception 'too_long: video_url' using errcode = '22023'; end if;
  v := nullif(trim(coalesce(p_patch->>'cover_path', '')), '');
  if (p_patch ? 'cover_path') and v is not null and v !~ '^opil/teams/[a-z0-9-]+/[a-z0-9._-]+$' then raise exception 'bad_path: cover_path' using errcode = '22023'; end if;
  update public.ea_opil_teams x set
    tagline       = case when p_patch ? 'tagline'       then nullif(left(trim(p_patch->>'tagline'), 140), '')   else x.tagline end,
    project       = case when p_patch ? 'project'       then nullif(left(trim(p_patch->>'project'), 4000), '')  else x.project end,
    prototype_url = case when p_patch ? 'prototype_url' then nullif(trim(p_patch->>'prototype_url'), '')        else x.prototype_url end,
    video_url     = case when p_patch ? 'video_url'     then nullif(trim(p_patch->>'video_url'), '')            else x.video_url end,
    cover_path    = case when p_patch ? 'cover_path'    then nullif(trim(p_patch->>'cover_path'), '')           else x.cover_path end
  where x.id = p_team
  returning * into t;
  if t.id is null then raise exception 'no_team' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', t.id, 'name', t.name, 'school', t.school, 'slug', t.slug, 'tagline', t.tagline, 'project', t.project,
    'prototype_url', t.prototype_url, 'video_url', t.video_url, 'cover_path', t.cover_path, 'published', t.published, 'published_at', t.published_at);
end $$;

create or replace function public.ea_opil_team_publish(p_team uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.ea_opil_teams;
begin
  if not public.ea_opil_team_can_edit(p_team) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into t from public.ea_opil_teams where id = p_team;
  if t.id is null then raise exception 'no_team' using errcode = 'P0002'; end if;
  if coalesce(t.is_staff, false) then raise exception 'staff_team' using errcode = '22023'; end if;   /* the coordinator space never goes public */
  if t.slug is null then update public.ea_opil_teams set slug = public.ea_opil_team_slug_for(name, id) where id = p_team; end if;
  update public.ea_opil_teams set published = coalesce(p_on, false),
    published_at = case when coalesce(p_on, false) then coalesce(published_at, now()) else null end
    where id = p_team returning * into t;
  return jsonb_build_object('id', t.id, 'slug', t.slug, 'published', t.published, 'published_at', t.published_at);
end $$;

revoke all on function public.ea_opil_slugify(text), public.ea_opil_team_slug_for(text, uuid), public.ea_opil_team_can_edit(uuid),
  public.ea_opil_team_update(uuid, jsonb), public.ea_opil_team_publish(uuid, boolean) from public, anon;
grant execute on function public.ea_opil_team_can_edit(uuid), public.ea_opil_team_update(uuid, jsonb), public.ea_opil_team_publish(uuid, boolean) to authenticated;

-- 4. the public view --------------------------------------------------------------------------------
/* drop + create (not replace): a replaced view cannot change its column list, and dropping also clears any
   stray grants before the ones below are re-issued. Nothing else depends on this view. */
drop view if exists public.ea_opil_showcase_team;
create view public.ea_opil_showcase_team as
  select t.slug, t.name, t.school, t.tagline, t.project, t.prototype_url, t.video_url, t.cover_path, t.published_at,
    /* members: the display name they chose; failing that the name on their APPROVED application
       (the same fallback the roster cards use, 0052); never an email. A member who flipped "Hide my card"
       is left off the page — the public page is never wider than the in-lab roster. */
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', coalesce(nullif(trim(pr.display_name), ''), nullif(trim(r.full_name), ''), 'Team member'),
               'role', m.role) order by (m.role = 'lead') desc, m.created_at)
      from public.ea_opil_team_members m
      left join public.ea_profiles pr on pr.user_id = m.user_id
      left join auth.users u on u.id = m.user_id
      left join public.ea_opil_registrations r on lower(r.email) = lower(u.email) and r.approved
      where m.team_id = t.id and not coalesce(pr.hide_card, false)), '[]'::jsonb) as members,
    /* files: only what the program team PUBLISHED from the locker, and only rows anyone can open (a link).
       A locker file with no link, and every team-room material, stays private (see the note at the top). */
    coalesce((
      select jsonb_agg(jsonb_build_object('title', d.title, 'url', d.link_url, 'kind', 'locker') order by d.created_at desc)
      from public.ea_opil_deliverables d
      where d.team_id = t.id and d.published = true and d.link_url is not null), '[]'::jsonb) as files
  from public.ea_opil_teams t
  where t.published = true and not coalesce(t.is_staff, false) and t.slug is not null
  offset 0;   /* OFFSET 0 keeps the view from ever being auto-updatable */
grant select on public.ea_opil_showcase_team to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ea_opil_showcase_team from anon, authenticated, public;

-- 5. the cover picture: bucket "content", folder opil/teams/<slug>/ ---------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('content', 'content', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;   /* an existing bucket keeps its own settings — see the deploy note */
/* a PUBLIC bucket serves GET /storage/v1/object/public/… with no select policy at all; a select policy only
   lets a client LIST the folder. Nobody outside the program team needs to list opil/teams/ (it would show
   every team's folder, published or not), so the old anon read policy is dropped and the list is theirs. */
drop policy if exists "content showcase public read" on storage.objects;
drop policy if exists "content showcase team list" on storage.objects;
create policy "content showcase team list" on storage.objects for select to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'opil' and (storage.foldername(name))[2] = 'teams'
         and public.ea_opil_is_program_team(auth.uid()));
drop policy if exists "content showcase team write" on storage.objects;
create policy "content showcase team write" on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = 'opil' and (storage.foldername(name))[2] = 'teams'
              and public.ea_opil_is_program_team(auth.uid()));
drop policy if exists "content showcase team update" on storage.objects;
create policy "content showcase team update" on storage.objects for update to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'opil' and (storage.foldername(name))[2] = 'teams'
         and public.ea_opil_is_program_team(auth.uid()));
drop policy if exists "content showcase team delete" on storage.objects;
create policy "content showcase team delete" on storage.objects for delete to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'opil' and (storage.foldername(name))[2] = 'teams'
         and public.ea_opil_is_program_team(auth.uid()));

select 'showcase ready' as status;

-- 0059 AI 101 class kit (Fri Oct 9 2026): the 1-5 confidence check (ea_class_pulse), workshop reviews
-- (ea_reviews, one system for every workshop, keyed by workshop_slug), and the class page's room link.
-- Writes go ONLY through the security-definer functions below; signed-in users can read just their own rows.
-- The public reads approved reviews through ea_reviews_public, which returns display fields and nothing else.
-- Supabase grants every new public function to anon and authenticated by default, so each one below is revoked
-- from public AND anon (helpers from authenticated too) before it is granted to exactly who needs it.
-- Nelson applies it: ! bash scripts/apply-0059.sh   (safe to re-run)
begin;

create table if not exists public.ea_class_pulse (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workshop_slug text not null check (workshop_slug ~ '^[a-z0-9-]{2,40}$'),
  kind text not null,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workshop_slug, kind)
);
-- the 1-5 before and after; two practice taps; the 3 quick questions (score = the option picked). Re-runnable.
alter table public.ea_class_pulse drop constraint if exists ea_class_pulse_kind_check;
alter table public.ea_class_pulse add constraint ea_class_pulse_kind_check
  check (kind in ('before', 'after', 'useful', 'steered', 'chk_safe', 'chk_verify', 'chk_prompt'));
alter table public.ea_class_pulse enable row level security;
revoke all on public.ea_class_pulse from anon, authenticated;
grant select on public.ea_class_pulse to authenticated;
drop policy if exists pulse_read on public.ea_class_pulse;
create policy pulse_read on public.ea_class_pulse for select to authenticated using (user_id = auth.uid() or public.ea_is_admin());

create table if not exists public.ea_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workshop_slug text not null check (workshop_slug ~ '^[a-z0-9-]{2,40}$'),
  stars smallint not null check (stars between 1 and 5),
  body text not null check (char_length(btrim(body)) between 10 and 1200),
  display_name text not null check (char_length(display_name) between 1 and 60),
  who_line text check (who_line is null or char_length(who_line) <= 80),
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (user_id, workshop_slug)
);
create index if not exists ea_reviews_public_idx on public.ea_reviews (workshop_slug, status, approved_at desc);
alter table public.ea_reviews enable row level security;
revoke all on public.ea_reviews from anon, authenticated;
grant select on public.ea_reviews to authenticated;
grant update (status, approved_at) on public.ea_reviews to authenticated;
drop policy if exists reviews_read on public.ea_reviews;
create policy reviews_read on public.ea_reviews for select to authenticated using (user_id = auth.uid() or public.ea_is_admin());
drop policy if exists reviews_founder_update on public.ea_reviews;
create policy reviews_founder_update on public.ea_reviews for update to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());

-- A seat = a paid (or free, which fulfils as paid) order on a date of this workshop, under this account or its
-- CONFIRMED email. Private: only the functions below call it.
create or replace function public.ea_holds_seat(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.ea_orders o join public.ea_events e on e.id = o.event_id
    where e.workshop_slug = p_slug and o.status = 'paid'
      and (o.user_id = auth.uid() or lower(o.email) = (select lower(u.email) from auth.users u
                                                        where u.id = auth.uid() and u.email_confirmed_at is not null)));
$$;
revoke all on function public.ea_holds_seat(text) from public, anon, authenticated;

-- A workshop people can answer for: one with at least one published (not draft) date.
create or replace function public.ea_workshop_open(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ea_events e where e.workshop_slug = p_slug and e.status <> 'draft');
$$;
revoke all on function public.ea_workshop_open(text) from public, anon, authenticated;

-- 0004's limiter now keeps per-person buckets ('review:<uid>'), so nobody but the service role (edge functions) and
-- these definer functions may call it: Supabase's default grants would otherwise let anyone fill a person's bucket.
revoke all on function public.ea_rate_check(text, int, int) from public, anon, authenticated;
grant execute on function public.ea_rate_check(text, int, int) to service_role;

-- 30 taps an hour per person is far more than the class asks for (11); a question keeps its FIRST answer.
create or replace function public.ea_pulse_save(p_slug text, p_kind text, p_score int) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not public.ea_workshop_open(p_slug) then raise exception 'unknown workshop' using errcode = '22023'; end if;
  if not public.ea_rate_check('pulse:' || auth.uid(), 30, 3600) then raise exception 'slow down: try again later' using errcode = 'P0001'; end if;
  if p_kind like 'chk\_%' then
    insert into public.ea_class_pulse (user_id, workshop_slug, kind, score) values (auth.uid(), p_slug, p_kind, p_score)
    on conflict (user_id, workshop_slug, kind) do nothing;
  else
    insert into public.ea_class_pulse (user_id, workshop_slug, kind, score) values (auth.uid(), p_slug, p_kind, p_score)
    on conflict (user_id, workshop_slug, kind) do update set score = excluded.score, updated_at = now();
  end if;
end $$;
revoke all on function public.ea_pulse_save(text, text, int) from public, anon;
grant execute on function public.ea_pulse_save(text, text, int) to authenticated;

-- "nelson elliott taylor" -> "Nelson T." (first name kept as typed after its first letter, capped at 40). Spaces of
-- every kind, invisible joiners and control characters count as one space, so a name made of them is no name.
-- Must match displayName() in js/ai101-kit.js, which shows the reviewer the same name before they post.
create or replace function public.ea_review_display_name(p_name text) returns text
language sql immutable security definer set search_path = '' as $$
  with s as (select btrim(regexp_replace(coalesce(p_name, ''),
               '[[:space:][:cntrl:]\u0080-\u009f\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]+', ' ', 'g')) n),
       w as (select n, regexp_split_to_array(n, ' ') a from s)
  select case when n = '' then 'Academy member'
              when array_length(a, 1) = 1 then left(upper(left(a[1], 1)) || substr(a[1], 2), 40)
              else left(upper(left(a[1], 1)) || substr(a[1], 2), 40) || ' ' || upper(left(a[array_length(a, 1)], 1)) || '.' end
  from w;
$$;
revoke all on function public.ea_review_display_name(text) from public, anon, authenticated;

-- Verified = held a seat AND a date of this workshop has started (a review written before the class is not an
-- attendee's). An edit goes back to Nelson as pending; a review he hid stays hidden. 10 saves an hour per person.
create or replace function public.ea_review_save(p_slug text, p_stars int, p_body text, p_who text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_verified boolean; v_status text;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not public.ea_workshop_open(p_slug) then raise exception 'unknown workshop' using errcode = '22023'; end if;
  if not public.ea_rate_check('review:' || auth.uid(), 10, 3600) then raise exception 'slow down: try again later' using errcode = 'P0001'; end if;
  v_verified := public.ea_holds_seat(p_slug) and exists (
    select 1 from public.ea_events e where e.workshop_slug = p_slug and e.status <> 'canceled' and e.starts_at <= now());
  insert into public.ea_reviews (user_id, workshop_slug, stars, body, display_name, who_line, verified)
  values (auth.uid(), p_slug, p_stars, btrim(p_body), public.ea_review_display_name(p_name), nullif(btrim(coalesce(p_who, '')), ''), v_verified)
  on conflict (user_id, workshop_slug) do update set stars = excluded.stars, body = excluded.body, display_name = excluded.display_name,
    who_line = excluded.who_line, verified = excluded.verified, approved_at = null, updated_at = now(),
    status = case when public.ea_reviews.status = 'hidden' then 'hidden' else 'pending' end
  returning status into v_status;
  return jsonb_build_object('verified', v_verified, 'status', v_status);
end $$;
revoke all on function public.ea_review_save(text, int, text, text, text) from public, anon;
grant execute on function public.ea_review_save(text, int, text, text, text) to authenticated;

create or replace function public.ea_reviews_public(p_slug text, p_limit int default 12) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ok as (select * from public.ea_reviews where status = 'approved' and workshop_slug = p_slug),
       top as (select * from ok order by verified desc, approved_at desc nulls last limit least(greatest(coalesce(p_limit, 12), 1), 50))
  select jsonb_build_object(
    'count', (select count(*) from ok),
    'avg', (select case when count(*) >= 3 then round(avg(stars)::numeric, 1) end from ok),
    'items', coalesce((select jsonb_agg(jsonb_build_object('display_name', display_name, 'who_line', who_line, 'stars', stars,
                         'body', body, 'verified', verified, 'created_at', created_at) order by verified desc, approved_at desc nulls last) from top), '[]'::jsonb));
$$;
revoke all on function public.ea_reviews_public(text, int) from public, anon;
grant execute on function public.ea_reviews_public(text, int) to anon, authenticated;

-- The Academy room link for a seat holder, only from 3 hours before a date of AI 101 to 30 minutes after it ends
-- (or after its hour, with no end time), never for a canceled date. The founder gets it any time, to rehearse.
-- The key itself is permanent: rotate the Academy room key after the class (run of show, after class).
create or replace function public.ea_ai101_room_link() returns text
language sql stable security definer set search_path = '' as $$
  select case when public.ea_is_admin() or (public.ea_holds_seat('ai101') and exists (
      select 1 from public.ea_events e where e.workshop_slug = 'ai101' and e.status <> 'canceled'
        and now() between e.starts_at - interval '3 hours' and coalesce(e.ends_at, e.starts_at + interval '1 hour') + interval '30 minutes'))
    then (select '/room/?k=' || r.link_key from public.ea_rooms r where r.slug = 'academy' and r.link_key is not null limit 1) end;
$$;
revoke all on function public.ea_ai101_room_link() from public, anon;
grant execute on function public.ea_ai101_room_link() to authenticated;

commit;
select 'ai101 class kit ready' as status;

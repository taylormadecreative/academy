-- 0024_agent_waitlist_ticketing.sql
-- "Build Your First AI Agent" goes public: a real waitlist with contact details, and
-- Taylormade Academy as its own ticket vendor (events, tiers, orders, seats).
--
-- Trust model, same as the rest of ea_*:
--   * anon never writes a table directly. The waitlist insert and the checkout both go
--     through edge functions running the service role, which validate and rate limit.
--   * anon reads only through definer views that expose the public columns (never the
--     private venue address, never a buyer's email). Views are built with OFFSET 0 and
--     have their write grants revoked AFTER creation (see 0023 for why the order matters).
--   * Nelson (profiles.role = 'admin') reads and writes everything through RLS.

-- ---------------------------------------------------------------- waitlist
create table if not exists public.ea_wl_signups (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  workshop_slug text not null default 'build-your-first-ai-agent',
  full_name     text not null check (char_length(full_name) between 2 and 120),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text check (phone is null or char_length(phone) <= 40),
  city          text check (city is null or char_length(city) <= 120),
  experience    text not null default 'new' check (experience in ('new','some','building')),
  goal          text check (goal is null or char_length(goal) <= 500),
  source        text not null default 'agent-page',
  referrer      text,
  early_token   uuid not null unique default gen_random_uuid(),
  status        text not null default 'waiting' check (status in ('waiting','invited','purchased','unsubscribed')),
  invited_at    timestamptz,
  notes         text,
  user_id       uuid references auth.users(id) on delete set null,
  unique (workshop_slug, email)
);
alter table public.ea_wl_signups enable row level security;
create index if not exists ea_wl_signups_created_idx on public.ea_wl_signups (workshop_slug, created_at desc);

drop policy if exists ea_wl_admin_all on public.ea_wl_signups;
create policy ea_wl_admin_all on public.ea_wl_signups
  for all to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());

-- ---------------------------------------------------------------- events
create table if not exists public.ea_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  workshop_slug text not null default 'build-your-first-ai-agent',
  title         text not null check (char_length(title) between 2 and 160),
  blurb         text check (blurb is null or char_length(blurb) <= 1000),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  tz            text not null default 'America/Chicago',
  format        text not null default 'in_person' check (format in ('in_person','virtual')),
  venue_label   text check (venue_label is null or char_length(venue_label) <= 160),   -- public ("Private studio, Dallas")
  venue_address text check (venue_address is null or char_length(venue_address) <= 400), -- private, ticket email only
  join_url      text check (join_url is null or char_length(join_url) <= 400),          -- private, virtual rooms
  capacity      int not null default 15 check (capacity between 1 and 5000),
  status        text not null default 'draft' check (status in ('draft','announced','on_sale','sold_out','past','canceled'))
);
alter table public.ea_events enable row level security;
create index if not exists ea_events_slug_idx on public.ea_events (workshop_slug, starts_at);

drop policy if exists ea_events_admin_all on public.ea_events;
create policy ea_events_admin_all on public.ea_events
  for all to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());

-- ---------------------------------------------------------------- ticket tiers
create table if not exists public.ea_ticket_tiers (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  event_id      uuid not null references public.ea_events(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  description   text check (description is null or char_length(description) <= 400),
  price_cents   int not null check (price_cents >= 0 and price_cents <= 1000000),
  qty           int not null check (qty between 1 and 5000),
  sales_start   timestamptz,
  sales_end     timestamptz,
  access        text not null default 'public' check (access in ('public','waitlist')),
  sort          int not null default 0,
  status        text not null default 'active' check (status in ('active','hidden'))
);
alter table public.ea_ticket_tiers enable row level security;
create index if not exists ea_ticket_tiers_event_idx on public.ea_ticket_tiers (event_id, sort);

drop policy if exists ea_tiers_admin_all on public.ea_ticket_tiers;
create policy ea_tiers_admin_all on public.ea_ticket_tiers
  for all to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());

-- ---------------------------------------------------------------- orders
create table if not exists public.ea_orders (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  event_id              uuid not null references public.ea_events(id) on delete restrict,
  tier_id               uuid not null references public.ea_ticket_tiers(id) on delete restrict,
  email                 text not null,
  full_name             text,
  qty                   int not null default 1 check (qty between 1 and 10),
  amount_cents          int not null check (amount_cents >= 0),
  stripe_session_id     text unique,
  stripe_payment_intent text,
  status                text not null default 'pending' check (status in ('pending','paid','refunded','canceled')),
  paid_at               timestamptz,
  signup_id             uuid references public.ea_wl_signups(id) on delete set null,
  user_id               uuid references auth.users(id) on delete set null
);
alter table public.ea_orders enable row level security;
create index if not exists ea_orders_tier_idx on public.ea_orders (tier_id, status, created_at);
create index if not exists ea_orders_event_idx on public.ea_orders (event_id, created_at desc);

drop policy if exists ea_orders_admin_all on public.ea_orders;
create policy ea_orders_admin_all on public.ea_orders
  for all to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());

-- ---------------------------------------------------------------- tickets (one row per seat)
-- Seat codes: TMA- plus six characters from an alphabet with no 0/O/1/I confusion.
create or replace function public.ea_ticket_code() returns text
language sql volatile as $$
  select 'TMA-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*32)::int, 1), '')
  from generate_series(1, 6);
$$;

create table if not exists public.ea_tickets (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  order_id      uuid not null references public.ea_orders(id) on delete cascade,
  event_id      uuid not null references public.ea_events(id) on delete cascade,
  tier_id       uuid not null references public.ea_ticket_tiers(id) on delete restrict,
  code          text not null unique default public.ea_ticket_code(),
  holder_name   text,
  holder_email  text not null,
  status        text not null default 'valid' check (status in ('valid','void')),
  checked_in_at timestamptz
);
alter table public.ea_tickets enable row level security;
create index if not exists ea_tickets_event_idx on public.ea_tickets (event_id, created_at);
create index if not exists ea_tickets_order_idx on public.ea_tickets (order_id);

drop policy if exists ea_tickets_admin_all on public.ea_tickets;
create policy ea_tickets_admin_all on public.ea_tickets
  for all to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());

-- ---------------------------------------------------------------- public reads
-- What everyone may see about a date. No address, no join link, no drafts.
drop view if exists public.ea_events_public;
create view public.ea_events_public as
  select id, workshop_slug, title, blurb, starts_at, ends_at, tz, format, venue_label, capacity, status
  from public.ea_events
  where status in ('announced','on_sale','sold_out')
  offset 0;
grant select on public.ea_events_public to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.ea_events_public from anon, authenticated, public;

-- Tiers of events that are on sale, with live availability. A seat counts as taken when
-- its order is paid, or is pending and younger than 30 minutes (a Checkout session in
-- progress). Older pending orders are abandoned carts and free their seats again, so no
-- expired-session webhook is needed.
drop view if exists public.ea_tiers_public;
create view public.ea_tiers_public as
  select t.id, t.event_id, t.name, t.description, t.price_cents, t.qty, t.sales_start, t.sales_end,
         t.access, t.sort,
         coalesce((select sum(o.qty) from public.ea_orders o
                   where o.tier_id = t.id
                     and (o.status = 'paid' or (o.status = 'pending' and o.created_at > now() - interval '30 minutes'))), 0)::int as sold
  from public.ea_ticket_tiers t
  join public.ea_events e on e.id = t.event_id
  where t.status = 'active' and e.status in ('on_sale','sold_out')
  offset 0;
grant select on public.ea_tiers_public to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.ea_tiers_public from anon, authenticated, public;

-- ---------------------------------------------------------------- founder overview
create or replace function public.ea_founder_stats() returns json
language plpgsql security definer stable set search_path = public as $$
declare
  v json;
begin
  if not public.ea_is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select json_build_object(
    'waitlist_total',    (select count(*) from ea_wl_signups where status <> 'unsubscribed'),
    'waitlist_7d',       (select count(*) from ea_wl_signups where created_at > now() - interval '7 days'),
    'waitlist_invited',  (select count(*) from ea_wl_signups where status = 'invited'),
    'waitlist_purchased',(select count(*) from ea_wl_signups where status = 'purchased'),
    'tickets_sold',      (select count(*) from ea_tickets where status = 'valid'),
    'ticket_revenue',    (select coalesce(sum(amount_cents),0) from ea_orders where status = 'paid'),
    'members_total',     (select count(*) from profiles),
    'members_7d',        (select count(*) from profiles where created_at > now() - interval '7 days'),
    'memberships_active',(select count(*) from ea_memberships where status = 'active'),
    'subscribers',       (select count(*) from ea_subscribers where status is distinct from 'unsubscribed'),
    'store_orders',      (select count(*) from ea_entitlements where source = 'purchase' and revoked_at is null)
  ) into v;
  return v;
end $$;
revoke all on function public.ea_founder_stats() from public;
grant execute on function public.ea_founder_stats() to authenticated;

-- ---------------------------------------------------------------- belt and braces
-- RLS already denies anon on every base table (there is no anon policy), but the
-- platform's default privileges still hand anon table grants. Anonymous traffic never
-- needs the base tables (edge functions use the service role, the page uses the views),
-- so take the grants away outright.
revoke all on public.ea_wl_signups, public.ea_events, public.ea_ticket_tiers, public.ea_orders, public.ea_tickets from anon;

select 'agent waitlist + ticketing ready' as status;

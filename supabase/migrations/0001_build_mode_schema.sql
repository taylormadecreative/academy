-- ============================================================
-- BUILD MODE academy schema. PURELY ADDITIVE: only ea_* objects.
-- Shares the existing project (pgqdmnmessbbzyszjfvr) with the bk_/studio
-- tables. Does NOT recreate public.profiles, does NOT add an auth trigger,
-- does NOT modify any shared table. Entitlements + memberships key directly
-- on auth.uid(); ea_is_admin reads the existing profiles.role.
-- ============================================================

-- ---------- admin check (reads the existing profiles.role) ----------
create or replace function public.ea_is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- products ----------
create table if not exists public.ea_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null default 'ebook',              -- ebook | course | membership | bundle
  title text not null,
  blurb text,
  price_cents int,
  stripe_price_id text,
  billing text not null default 'one_time',         -- one_time | recurring
  storage_path text,
  media_provider text,
  media_ref text,
  cover_url text,
  bundle_of text[],
  status text not null default 'draft',             -- draft | published | coming_soon | archived
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ea_products enable row level security;
drop policy if exists ea_products_admin_all on public.ea_products;
create policy ea_products_admin_all on public.ea_products
  for all using (public.ea_is_admin()) with check (public.ea_is_admin());

create or replace function public.ea_list_products() returns table (
  slug text, type text, title text, blurb text, price_cents int,
  billing text, cover_url text, status text, sort int
) language sql security definer stable set search_path = public as $$
  select slug, type, title, blurb, price_cents, billing, cover_url, status, sort
  from public.ea_products where status in ('published','coming_soon') order by sort, title;
$$;

-- ---------- memberships (recurring) ----------
create table if not exists public.ea_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive',          -- active | past_due | canceled | inactive
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ea_memberships enable row level security;
drop policy if exists ea_mem_owner_read on public.ea_memberships;
create policy ea_mem_owner_read on public.ea_memberships
  for select using (user_id = auth.uid() or public.ea_is_admin());

create or replace function public.ea_is_member() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.ea_memberships m where m.user_id = auth.uid() and m.status = 'active')
      or public.ea_is_admin();
$$;

-- ---------- entitlements (single source of truth for access) ----------
create table if not exists public.ea_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.ea_products(id) on delete cascade,
  source text not null default 'purchase',
  stripe_session_id text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, product_id)
);
alter table public.ea_entitlements enable row level security;
drop policy if exists ea_ent_owner_read on public.ea_entitlements;
create policy ea_ent_owner_read on public.ea_entitlements
  for select using (user_id = auth.uid() or public.ea_is_admin());
-- writes only via the webhook (service role bypasses RLS); no client insert policy.

-- ---------- community ----------
create table if not exists public.ea_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'wins',
  body text not null,
  pinned boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ea_posts enable row level security;
drop policy if exists ea_posts_read on public.ea_posts;
create policy ea_posts_read on public.ea_posts
  for select using (not hidden and auth.uid() is not null);
drop policy if exists ea_posts_write on public.ea_posts;
create policy ea_posts_write on public.ea_posts
  for insert with check (author_id = auth.uid() and (public.ea_is_member() or public.ea_is_admin()));
drop policy if exists ea_posts_owner_update on public.ea_posts;
create policy ea_posts_owner_update on public.ea_posts
  for update using (author_id = auth.uid() or public.ea_is_admin());

create table if not exists public.ea_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.ea_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.ea_comments enable row level security;
drop policy if exists ea_comments_read on public.ea_comments;
create policy ea_comments_read on public.ea_comments
  for select using (auth.uid() is not null);
drop policy if exists ea_comments_write on public.ea_comments;
create policy ea_comments_write on public.ea_comments
  for insert with check (author_id = auth.uid() and (public.ea_is_member() or public.ea_is_admin()));

-- ---------- waitlist (anon insert via RPC only) ----------
create table if not exists public.ea_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product_slug text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.ea_waitlist enable row level security;

create or replace function public.ea_join_waitlist(p_email text, p_slug text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ea_waitlist (email, product_slug, note)
  values (lower(trim(p_email)), p_slug, p_note);
end $$;
grant execute on function public.ea_join_waitlist(text, text, text) to anon, authenticated;
grant execute on function public.ea_list_products() to anon, authenticated;

-- ---------- private bucket for the deliverable files ----------
insert into storage.buckets (id, name, public)
values ('ea-files','ea-files', false)
on conflict (id) do nothing;

-- ---------- seed the catalog (prices left null until Nelson sets them) ----------
insert into public.ea_products (slug, type, title, blurb, billing, cover_url, status, sort, bundle_of)
values
 ('ai-agent-ebook','ebook','Build Your First AI Agent',
  'A no-code, plain-English guide to building your first working AI agent.',
  'one_time','/assets/cover-ai-agent.png','published',1,null),
 ('boring-money','ebook','Boring Money',
  'Build a recurring-income AI service business by solving boring problems for small businesses.',
  'one_time','/assets/cover-boring-money.png','published',2,null),
 ('bundle','bundle','The Bundle (both ebooks)',
  'Build Your First AI Agent and Boring Money together, at a saving.',
  'one_time',null,'published',0, array['ai-agent-ebook','boring-money']),
 ('video-course','course','The Video Courses',
  'Step-by-step tutorial videos that walk you through the workshops on screen.',
  'one_time',null,'coming_soon',3,null)
on conflict (slug) do nothing;

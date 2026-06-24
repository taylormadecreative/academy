-- ============================================================
-- BUILD MODE academy schema. All tables prefixed ea_ so they can
-- live in the same Supabase project as the booking (bk_) tables and
-- share one public.profiles. Apply with the Supabase SQL editor or CLI.
-- ============================================================

-- ---------- shared profiles (create only if it does not exist) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'client',           -- client | admin | employee
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- auto-create a profile row on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, lower(new.email), 'client')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- helper functions (security definer) ----------
create or replace function public.ea_is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.ea_is_member() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.ea_memberships m
    where m.user_id = auth.uid() and m.status = 'active'
  ) or public.ea_is_admin();
$$;

-- ---------- products ----------
create table if not exists public.ea_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null default 'ebook',             -- ebook | course | membership | bundle
  title text not null,
  blurb text,
  price_cents int,                                 -- null until Nelson sets it
  stripe_price_id text,
  billing text not null default 'one_time',        -- one_time | recurring
  storage_path text,                               -- private bucket path to the deliverable file
  media_provider text,                             -- supabase | bunny | youtube (for courses)
  media_ref text,
  cover_url text,
  bundle_of text[],                                -- slugs included, for type=bundle
  status text not null default 'draft',            -- draft | published | coming_soon | archived
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ea_products enable row level security;
-- no direct anon select; the front-end reads via ea_list_products() which filters fields
create policy ea_products_admin_all on public.ea_products
  for all using (public.ea_is_admin()) with check (public.ea_is_admin());

-- public, field-filtered product list for the storefront
create or replace function public.ea_list_products() returns table (
  slug text, type text, title text, blurb text, price_cents int,
  billing text, cover_url text, status text, sort int
) language sql security definer stable set search_path = public as $$
  select slug, type, title, blurb, price_cents, billing, cover_url, status, sort
  from public.ea_products
  where status in ('published','coming_soon')
  order by sort, title;
$$;

-- ---------- entitlements (the single source of truth for access) ----------
create table if not exists public.ea_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.ea_products(id) on delete cascade,
  source text not null default 'purchase',         -- purchase | bundle | gift | admin
  stripe_session_id text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, product_id)
);
alter table public.ea_entitlements enable row level security;
create policy ea_ent_owner_read on public.ea_entitlements
  for select using (user_id = auth.uid() or public.ea_is_admin());
-- writes happen only from the webhook (service role bypasses RLS); no client insert policy.

-- ---------- memberships (recurring community / courses) ----------
create table if not exists public.ea_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive',          -- active | past_due | canceled | inactive
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ea_memberships enable row level security;
create policy ea_mem_owner_read on public.ea_memberships
  for select using (user_id = auth.uid() or public.ea_is_admin());

-- ---------- community ----------
create table if not exists public.ea_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'wins',             -- wins | help | intros
  body text not null,
  pinned boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ea_posts enable row level security;
create policy ea_posts_read on public.ea_posts
  for select using (not hidden and auth.uid() is not null);
create policy ea_posts_write on public.ea_posts
  for insert with check (author_id = auth.uid() and (public.ea_is_member() or public.ea_is_admin()));
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
create policy ea_comments_read on public.ea_comments
  for select using (auth.uid() is not null);
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
-- no direct policies; inserts go through ea_join_waitlist() (security definer)

create or replace function public.ea_join_waitlist(p_email text, p_slug text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ea_waitlist (email, product_slug, note)
  values (lower(trim(p_email)), p_slug, p_note);
end $$;

-- ---------- seed the two ebooks (prices left null until Nelson sets them) ----------
insert into public.ea_products (slug, type, title, blurb, billing, cover_url, status, sort)
values
 ('ai-agent-ebook','ebook','Build Your First AI Agent',
  'A no-code, plain-English guide to building your first working AI agent.',
  'one_time','/assets/cover-ai-agent.png','published',1),
 ('boring-money','ebook','Boring Money',
  'Build a recurring-income AI service business by solving boring problems for small businesses.',
  'one_time','/assets/cover-boring-money.png','published',2),
 ('video-course','course','The Video Courses',
  'Step-by-step tutorial videos that walk you through the workshops on screen.',
  'one_time',null,'coming_soon',3)
on conflict (slug) do nothing;

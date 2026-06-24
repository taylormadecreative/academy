-- ============================================================
-- BUILD MODE member area RPCs. Read-only, security definer, so the
-- member dashboard can list a buyer's library without opening up direct
-- select on ea_products (that table stays admin-only at the RLS level).
-- Apply after 0001. Safe to run more than once.
-- ============================================================

-- The caller's owned products, joined to product metadata, for the dashboard
-- library list. Returns the product slug (for /library/?p=<slug> deep links),
-- title, cover, and type. Filters out anything that was revoked (refund/dispute).
create or replace function public.ea_my_library() returns table (
  slug text, title text, type text, cover_url text, granted_at timestamptz
) language sql security definer stable set search_path = public as $$
  select p.slug, p.title, p.type, p.cover_url, e.granted_at
  from public.ea_entitlements e
  join public.ea_products p on p.id = e.product_id
  where e.user_id = auth.uid()
    and e.revoked_at is null
  order by e.granted_at desc;
$$;

revoke all on function public.ea_my_library() from public, anon;
grant execute on function public.ea_my_library() to authenticated;

-- The caller's membership row, if any, for the dashboard status block.
-- Mirrors the owner-read RLS on ea_memberships; exposed as an RPC so the
-- front-end has one stable shape to read.
create or replace function public.ea_my_membership() returns table (
  status text, current_period_end timestamptz
) language sql security definer stable set search_path = public as $$
  select m.status, m.current_period_end
  from public.ea_memberships m
  where m.user_id = auth.uid();
$$;

revoke all on function public.ea_my_membership() from public, anon;
grant execute on function public.ea_my_membership() to authenticated;

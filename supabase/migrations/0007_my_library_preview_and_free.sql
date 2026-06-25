-- 0007 ea_my_library: free ebooks for everyone + admin "preview as free".
-- Replaces the prior 0-arg version (a default arg keeps existing callers working).
drop function if exists public.ea_my_library();

create or replace function public.ea_my_library(p_as_free boolean default false)
returns table (slug text, title text, type text, cover_url text, granted_at timestamptz)
language sql security definer stable set search_path = public as $$
  -- (a) genuinely owned, à-la-carte purchases
  select p.slug, p.title, p.type, p.cover_url, e.granted_at
  from public.ea_entitlements e
  join public.ea_products p on p.id = e.product_id
  where e.user_id = auth.uid() and e.revoked_at is null
  union
  -- (b) free ebooks: every authenticated member gets these
  select p.slug, p.title, p.type, p.cover_url, null::timestamptz
  from public.ea_products p
  where p.is_free = true and p.status = 'published' and p.type = 'ebook'
    and not exists (select 1 from public.ea_entitlements e2
                    where e2.user_id = auth.uid() and e2.product_id = p.id and e2.revoked_at is null)
  union
  -- (c) membership unlock: all published ebooks/courses, UNLESS an admin is
  --     previewing the free view (p_as_free + admin suppresses the unlock).
  select p.slug, p.title, p.type, p.cover_url, null::timestamptz
  from public.ea_products p
  where public.ea_is_member()
    and not (p_as_free and public.ea_is_admin())
    and p.status = 'published' and p.type in ('ebook','course')
    and not exists (select 1 from public.ea_entitlements e3
                    where e3.user_id = auth.uid() and e3.product_id = p.id and e3.revoked_at is null)
  order by granted_at desc nulls last;
$$;

revoke all on function public.ea_my_library(boolean) from public, anon;
grant execute on function public.ea_my_library(boolean) to authenticated;

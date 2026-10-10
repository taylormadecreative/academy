-- 0060 A tier only the people on its list can buy (Fri Oct 9 2026). Nelson, after AI 101: the $65 class price is
-- "only for those who attended the workshop today", for 72 hours. A tier with access 'attendees' sells only to an
-- email on ea_tier_allowlist, one seat per checkout. ea_hold_seats enforces it (the checkout function already calls
-- it under the tier lock), so the rule holds no matter what a page sends. The list itself is data, filled from the
-- room's attendance by scripts/attendee-price.sql; no email ever goes in this file or the repo.
-- A refusal comes back as 'not_on_sale', the one hold error ea-ticket-checkout passes through as-is (400); the
-- page reads it, on an 'attendees' tier, as "use the email you signed in with". Safe to re-run.
begin;

alter table public.ea_ticket_tiers drop constraint if exists ea_ticket_tiers_access_check;
alter table public.ea_ticket_tiers add constraint ea_ticket_tiers_access_check
  check (access in ('public', 'waitlist', 'attendees'));

create table if not exists public.ea_tier_allowlist (
  tier_id uuid not null references public.ea_ticket_tiers(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 200),
  note text check (note is null or char_length(note) <= 200),
  added_at timestamptz not null default now(),
  primary key (tier_id, email)
);
alter table public.ea_tier_allowlist enable row level security;
drop policy if exists tier_allowlist_admin on public.ea_tier_allowlist;
create policy tier_allowlist_admin on public.ea_tier_allowlist
  for all to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());
revoke all on public.ea_tier_allowlist from anon, public;

create or replace function public.ea_hold_seats(p_tier_id uuid, p_email text, p_full_name text, p_qty integer, p_signup_id uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tier  record;
  v_event record;
  v_taken int;
  v_order record;
begin
  if p_qty is null or p_qty < 1 or p_qty > 10 then
    return json_build_object('error', 'bad_qty');
  end if;

  -- Serialize every hold against this tier. Anyone racing us waits here.
  perform pg_advisory_xact_lock(hashtext('ea_tier:' || p_tier_id::text));

  select * into v_tier from ea_ticket_tiers where id = p_tier_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  if v_tier.status <> 'active' then return json_build_object('error', 'not_on_sale'); end if;

  select * into v_event from ea_events where id = v_tier.event_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  if v_event.status <> 'on_sale' then return json_build_object('error', 'not_on_sale'); end if;

  -- 0060: an 'attendees' tier sells one seat at a time, and only to an email on its list.
  if v_tier.access = 'attendees' then
    if p_qty <> 1 then return json_build_object('error', 'bad_qty'); end if;
    if not exists (select 1 from ea_tier_allowlist a
                    where a.tier_id = p_tier_id and a.email = lower(btrim(coalesce(p_email, '')))) then
      return json_build_object('error', 'not_on_sale');
    end if;
  end if;

  -- Same definition of "taken" as ea_tiers_public: paid, plus holds still inside the
  -- 30-minute Checkout window. Counted here under the lock, so it cannot go stale.
  select coalesce(sum(qty), 0) into v_taken from ea_orders
   where tier_id = p_tier_id
     and (status = 'paid' or (status = 'pending' and created_at > now() - interval '30 minutes'));

  if v_tier.qty - v_taken < p_qty then
    return json_build_object('error', 'sold_out', 'available', greatest(0, v_tier.qty - v_taken));
  end if;

  insert into ea_orders (event_id, tier_id, email, full_name, qty, amount_cents, signup_id)
  values (v_tier.event_id, p_tier_id, lower(trim(p_email)), p_full_name, p_qty,
          v_tier.price_cents * p_qty, p_signup_id)
  returning * into v_order;

  return json_build_object('order', row_to_json(v_order), 'tier', row_to_json(v_tier), 'event', row_to_json(v_event));
end $$;

commit;

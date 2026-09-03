-- 0025_ticket_concurrency.sql
-- Closes three races in the seat-selling path that 0024 left to application code.
--
-- The traffic pattern this exists for: ea-waitlist-announce emails the whole waitlist at
-- once ("the first seats go to the first replies") against a room of ~15 seats. Everyone
-- clicks within the same few seconds. Check-then-insert in the edge function is exactly
-- the wrong shape for that, and Stripe delivers checkout.session.completed AT LEAST once,
-- so the fulfilment path gets concurrent duplicate invocations as a matter of routine.
--
-- Both functions take a transaction-scoped advisory lock, so the read and the write that
-- depends on it cannot interleave. The lock is released when the function's transaction
-- ends; nothing to clean up.

-- ---------------------------------------------------------------- hold seats atomically
-- Replaces: read ea_tiers_public.sold -> compare -> insert ea_orders (3 round trips).
-- The caller still does the access/sales-window checks, which are not racy.
create or replace function public.ea_hold_seats(
  p_tier_id   uuid,
  p_email     text,
  p_full_name text,
  p_qty       int,
  p_signup_id uuid default null
) returns json
language plpgsql security definer set search_path = public as $$
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
revoke all on function public.ea_hold_seats(uuid, text, text, int, uuid) from public, anon, authenticated;
grant execute on function public.ea_hold_seats(uuid, text, text, int, uuid) to service_role;

-- ---------------------------------------------------------------- fulfil atomically
-- Marks the order paid and issues exactly qty seats, however many times it is called.
-- Returns first_time=false when another concurrent (or earlier) call already did the
-- work, which is how the edge function knows NOT to send a second set of emails.
create or replace function public.ea_fulfill_order(
  p_order_id uuid,
  p_session  text default null,
  p_pi       text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order    record;
  v_have     int;
  v_first    boolean := false;
  v_tickets  json;
begin
  perform pg_advisory_xact_lock(hashtext('ea_order:' || p_order_id::text));

  select * into v_order from ea_orders where id = p_order_id;
  if not found then return json_build_object('error', 'not_found'); end if;

  -- A refunded or canceled order never gets seats back through this path.
  if v_order.status in ('refunded', 'canceled') then
    return json_build_object('error', 'not_fulfillable', 'status', v_order.status);
  end if;

  select count(*) into v_have from ea_tickets where order_id = p_order_id;

  -- "First time" means this call is the one that actually completes the order.
  if v_order.status <> 'paid' or v_have < v_order.qty then
    v_first := true;
  end if;

  if v_order.status <> 'paid' then
    update ea_orders set status = 'paid', paid_at = now(),
           stripe_session_id = coalesce(p_session, stripe_session_id),
           stripe_payment_intent = coalesce(p_pi, stripe_payment_intent)
     where id = p_order_id;
  end if;

  -- Issue only the shortfall. Under the lock this can never double-issue.
  while v_have < v_order.qty loop
    insert into ea_tickets (order_id, event_id, tier_id, holder_name, holder_email)
    values (p_order_id, v_order.event_id, v_order.tier_id, v_order.full_name, lower(v_order.email));
    v_have := v_have + 1;
  end loop;

  -- Link the waitlist row, by id when checkout carried an early token, else by email.
  if v_order.signup_id is not null then
    update ea_wl_signups set status = 'purchased' where id = v_order.signup_id and status <> 'purchased';
  else
    update ea_wl_signups w set status = 'purchased'
      from ea_events e
     where e.id = v_order.event_id
       and w.workshop_slug = e.workshop_slug
       and w.email = lower(v_order.email)
       and w.status <> 'purchased';
  end if;

  select json_agg(json_build_object('id', id, 'code', code, 'status', status) order by created_at)
    into v_tickets from ea_tickets where order_id = p_order_id;

  return json_build_object(
    'first_time', v_first,
    'order',   (select row_to_json(o) from ea_orders o where o.id = p_order_id),
    'event',   (select row_to_json(e) from ea_events e where e.id = v_order.event_id),
    'tier',    (select row_to_json(t) from ea_ticket_tiers t where t.id = v_order.tier_id),
    'tickets', coalesce(v_tickets, '[]'::json)
  );
end $$;
revoke all on function public.ea_fulfill_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ea_fulfill_order(uuid, text, text) to service_role;

-- ---------------------------------------------------------------- housekeeping
-- A hold that never reached Stripe (or that the buyer abandoned) stops counting toward
-- capacity after 30 minutes, but leaving it 'pending' forever clutters the founder's
-- Orders tab. Nothing schedules this; the dashboard calls it on load.
create or replace function public.ea_expire_stale_holds() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update ea_orders set status = 'canceled'
   where status = 'pending' and created_at < now() - interval '2 hours';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.ea_expire_stale_holds() from public, anon;
grant execute on function public.ea_expire_stale_holds() to authenticated, service_role;

select 'ticket concurrency hardened' as status;

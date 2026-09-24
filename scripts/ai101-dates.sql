-- AI 101 (free, Fri Oct 9 2026, 7 PM CT) + Build Your First AI Agent moved to Fri Oct 23 2026, 7–9 PM CT.
-- (Nelson 9/24: dates moved again from Oct 3 / Oct 17. The lookups accept every earlier date so a re-run finds the row.)
-- Data, not schema: run by scripts/apply-ai101.sh AFTER 0056. Safe to re-run until the first agent
-- seat sells; after that it stops and says so (change tiers in /founder/ instead, so no buyer's tier vanishes).
-- The AI 101 block below always runs. Emails re-read the live room key (_shared/tickets.ts freshJoinUrl).
--
-- Agent ladder (Nelson, 9/23: the Academy prices, not Eventbrite's):
--   AI 101 class price  $65   list-only (the personal early link), Fri Oct 9 9 PM → Sun Oct 11 9 PM CT
--   Early Bird          $75   public, from now → Fri Oct 16, 11:59 PM CT
--   General             $90   public, Sat Oct 17 → Fri Oct 23, 6 PM CT
--   Build With Me (In Person)  $200 x15, public, from now → Fri Oct 23, noon CT
-- "List-only" = access 'waitlist': it opens only through /agent/?early=<token>. Every AI 101 sign-up is
-- put on the agent list (source 'ai101') by _shared/tickets.ts, so the founder Announce email after the
-- class carries each person's own link. The 9 people already on the list get it too.

do $$
declare
  v_agent uuid;
  v_orders int;
begin
  /* ---------------- the agent date ---------------- */
  select id into v_agent from public.ea_events
   where workshop_slug = 'build-your-first-ai-agent'
     and (starts_at at time zone 'America/Chicago')::date in ('2026-10-03', '2026-10-17', '2026-10-23')
   order by starts_at limit 1;
  if v_agent is null then
    raise notice 'No Build Your First AI Agent date on Oct 3, Oct 17 or Oct 23 was found. The agent date was NOT changed.';
    return;  -- a notice, not an error: the AI 101 block below must still run in this same transaction
  end if;

  select count(*) into v_orders from public.ea_orders
   where event_id = v_agent and (status = 'paid' or (status = 'pending' and created_at > now() - interval '30 minutes'));
  if v_orders > 0 then
    raise notice 'The agent date already has % order(s). Tiers were NOT replaced; edit them in /founder/.', v_orders;
    return;
  end if;

  update public.ea_events
     set starts_at = timestamptz '2026-10-23 19:00 America/Chicago',
         ends_at   = timestamptz '2026-10-23 21:00 America/Chicago',
         status    = 'on_sale'
   where id = v_agent;

  -- tiers with any order history (canceled holds) are hidden, never deleted (orders reference them)
  update public.ea_ticket_tiers t set status = 'hidden'
   where t.event_id = v_agent and exists (select 1 from public.ea_orders o where o.tier_id = t.id);
  delete from public.ea_ticket_tiers t
   where t.event_id = v_agent and not exists (select 1 from public.ea_orders o where o.tier_id = t.id);

  insert into public.ea_ticket_tiers (event_id, name, description, price_cents, qty, sales_start, sales_end, access, sort) values
    (v_agent, 'AI 101 class price', 'For AI 101 sign-ups and the waitlist, through your personal link. 48 hours only.',
       6500, 500, timestamptz '2026-10-09 21:00 America/Chicago', timestamptz '2026-10-11 21:00 America/Chicago', 'waitlist', 1),
    (v_agent, 'Early Bird', 'Online, live on the night. You build along with me and leave with a working agent and the playbook.',
       7500, 500, now(), timestamptz '2026-10-16 23:59 America/Chicago', 'public', 2),
    (v_agent, 'General', 'Online, live on the night. You build along with me and leave with a working agent and the playbook.',
       9000, 500, timestamptz '2026-10-17 00:00 America/Chicago', timestamptz '2026-10-23 18:00 America/Chicago', 'public', 3),
    (v_agent, 'Build With Me (In Person)', 'A seat in the studio, building next to me. Bring a laptop that runs Claude or ChatGPT. The address comes in your ticket email.',
       20000, 15, now(), timestamptz '2026-10-23 12:00 America/Chicago', 'public', 4);

end $$;

-- AI 101 is its own block: once an agent seat sells, the block above stops, and this one still runs
do $$
declare
  v_room text;
  v_ai uuid;
begin
  select 'https://taylormadeacademy.com/room/?k=' || link_key into v_room from public.ea_rooms where slug = 'academy';
  if v_room is null then
    raise exception 'The Academy room (ea_rooms) does not exist yet. Nothing changed.';
  end if;

  select id into v_ai from public.ea_events
   where workshop_slug = 'ai101'
     and (starts_at at time zone 'America/Chicago')::date in ('2026-10-03', '2026-10-09')
   order by starts_at limit 1;
  if v_ai is null then
    insert into public.ea_events (workshop_slug, title, blurb, starts_at, ends_at, tz, format, venue_label, join_url, capacity, status)
    values ('ai101', 'AI 101: Learn to Talk to AI',
            'Free, about 45 minutes. How to write a prompt, and what the AI words mean.',
            timestamptz '2026-10-09 19:00 America/Chicago', timestamptz '2026-10-09 19:45 America/Chicago',
            'America/Chicago', 'virtual', null, v_room, 500, 'on_sale')
    returning id into v_ai;
  else
    -- a re-run picks up a new room link (Nelson rotated it) and puts the date back on sale
    update public.ea_events set join_url = v_room, status = 'on_sale',
           starts_at = timestamptz '2026-10-09 19:00 America/Chicago',
           ends_at   = timestamptz '2026-10-09 19:45 America/Chicago'
     where id = v_ai;
    update public.ea_ticket_tiers set sales_end = timestamptz '2026-10-09 19:30 America/Chicago'
     where event_id = v_ai and price_cents = 0 and status = 'active';
  end if;

  if not exists (select 1 from public.ea_ticket_tiers where event_id = v_ai and price_cents = 0 and status = 'active') then
    insert into public.ea_ticket_tiers (event_id, name, description, price_cents, qty, sales_start, sales_end, access, sort)
    values (v_ai, 'Free seat', 'Live online, about 45 minutes.', 0, 500, now(),
            timestamptz '2026-10-09 19:30 America/Chicago', 'public', 1);
  end if;
end $$;

select e.workshop_slug, e.title, e.status,
       to_char(e.starts_at at time zone 'America/Chicago', 'Dy Mon DD, HH12:MI AM') || ' CT' as starts,
       (select string_agg(t.name || ' $' || (t.price_cents / 100) || ' x' || t.qty
                          || ' [' || to_char(t.sales_start at time zone 'America/Chicago', 'Mon DD HH12:MI AM')
                          || ' → ' || to_char(t.sales_end at time zone 'America/Chicago', 'Mon DD HH12:MI AM') || ' CT'
                          || case when t.access = 'waitlist' then ', list only' else '' end || ']', ' · ' order by t.sort)
          from public.ea_ticket_tiers t where t.event_id = e.id and t.status = 'active') as tiers,
       e.join_url is not null as has_room_link
  from public.ea_events e
 where e.workshop_slug in ('ai101', 'build-your-first-ai-agent') and e.starts_at > now() - interval '1 day'
 order by e.starts_at;

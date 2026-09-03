# Build Your First AI Agent — public waitlist, self-hosted ticketing, founder dashboard

Date: 2026-09-03. Status: approved by /goal directive (autonomous build).

## Goal

Open "Build Your First AI Agent" (first taught for AUC DSI x Johns Hopkins, Jun 2026) to the
public for the first time. Capture a waitlist with real contact details, tell the list about
future dates first, give them a real early-bird advantage, and sell seats through
Taylormade Academy itself (no Eventbrite). Give Nelson a founder dashboard that shows the
waitlist and the rest of the Academy at a glance.

## Non-goals

- No prices or dates are invented. Both come from rows Nelson creates in the dashboard.
- No QR scanning. A short seat code plus a check-in search is enough for a 15 to 50 seat room.
- No new auth. `/founder/` reuses `/login/` (Google + email + code) and the existing
  `profiles.role = 'admin'` gate.

## URLs

| Path | What |
| --- | --- |
| `/agent/` | Public page: waitlist, and ticket sales once an event is on sale |
| `/agent/thanks/` | Post-checkout page (reads `?session_id=`), shows the seat code |
| `/founder/` | Founder dashboard, admin only, `noindex` |

`/agent/` is added to the global NAV as "Workshop" and to the sitemap.

## Data (migration `0024_agent_waitlist_ticketing.sql`)

- `ea_wl_signups` — waitlist. `workshop_slug` (default `build-your-first-ai-agent`),
  `full_name`, `email` (unique per workshop), `phone`, `city`, `experience`
  (`new | some | building`), `goal` (<= 500), `source`, `early_token` (uuid, unique),
  `status` (`waiting | invited | purchased | unsubscribed`), `invited_at`, `notes`.
  RLS: admin `for all`; no anon policy. Inserts happen only through `ea-waitlist-join`.
- `ea_events` — one row per date. `workshop_slug`, `title`, `starts_at`, `ends_at`,
  `tz`, `format` (`in_person | virtual`), `venue_label` (public), `venue_address`
  (private, only in the ticket email), `capacity`, `status`
  (`draft | announced | on_sale | sold_out | past | canceled`), `blurb`.
- `ea_ticket_tiers` — `event_id`, `name`, `description`, `price_cents`, `qty`,
  `sales_start`, `sales_end`, `access` (`public | waitlist`), `sort`, `status`
  (`active | hidden`).
- `ea_orders` — `event_id`, `tier_id`, `email`, `full_name`, `qty`, `amount_cents`,
  `stripe_session_id` (unique), `stripe_payment_intent`, `status`
  (`pending | paid | refunded | canceled`), `signup_id`, `user_id`, `paid_at`.
- `ea_tickets` — one per seat. `order_id`, `event_id`, `tier_id`, `code` (unique, like
  `TMA-7F3K2Q`), `holder_name`, `holder_email`, `status` (`valid | void`), `checked_in_at`.
- Public reads: `ea_events_public` and `ea_tiers_public` (definer views, `offset 0`,
  writes revoked after create). Tiers expose `sold` and `available` computed from paid
  orders plus pending orders younger than 30 minutes.
- `ea_founder_stats()` — admin-only RPC returning counts for the overview.
- All five tables: `for all to authenticated using (ea_is_admin())`.

## Edge functions

- `ea-waitlist-join` (public, CORS locked, rate limited 6/min/IP, honeypot) — validates,
  upserts the signup, returns `{ ok, position }`, sends the confirmation email via Resend,
  sends Nelson a one-line notice.
- `ea-ticket-checkout` (public) — `{ tier_id, email, name, qty, early }`. Loads tier +
  event server-side, checks window, access (a `waitlist` tier needs a valid `early`
  token for that workshop), availability; inserts a `pending` order; creates a Stripe
  Checkout session (30 min expiry, metadata `kind=ticket, order_id, event_id, tier_id,
  qty`); returns `{ url }`.
- `ea-stripe-webhook` (extended from the LIVE source, which reads the signing secret from
  `ea_config`) — `checkout.session.completed` with `kind=ticket` marks the order paid,
  issues tickets idempotently, links the waitlist signup (`purchased`), emails the ticket.
  Full `charge.refunded` also marks the order refunded and voids its tickets.
- `ea-waitlist-announce` (admin JWT required) — `{ event_id, subject, body_html, test_to? }`.
  With `test_to`, sends one preview. Otherwise sends to every `waiting` or `invited`
  signup in batches of 100 with a personal `/agent/?early=<token>` button, stamps
  `invited_at` + `status='invited'`.

Sender: `Nelson Taylor · Taylormade Academy <hello@taylormadecreative.net>`, reply-to
`taylormademd@gmail.com` (the Resend domain that is verified today).

## Public page behaviour

- Default state: waitlist hero. Form posts to `ea-waitlist-join`; success swaps the form for
  "You're #N on the list" and what happens next.
- If any event is `announced`: an "Upcoming dates" block appears with the date and
  "The waitlist hears first".
- If an event is `on_sale`: the hero CTA becomes "Get your seat" scrolling to tier cards
  rendered from `ea_tiers_public`. A `waitlist` tier shows locked unless `?early=` is valid
  (the token is passed to checkout and verified server-side).
- Copy defines "AI agent" in plain words with a three-step diagram before any demo talk.

## Founder dashboard

Tabs: Overview (stat tiles + recent signups + next event), Waitlist (search, status
filter, notes, CSV export, copy emails), Events (create/edit + tiers editor, on-sale
toggle), Orders (list, revenue, check-in by code or email), Announce (compose, preview,
test send, send to list). All reads/writes go through supabase-js under admin RLS,
except the announce send which calls the edge function with the session JWT.

## Testing

- `deno check` on every function. Unit tests for the pure helpers (validation, availability,
  seat codes).
- Live: join the waitlist with a `+wltest` address, confirm the row and the email; create
  a TEST event + tier, confirm `ea-ticket-checkout` returns a Stripe URL, then delete the
  test rows. No real charge is made.
- Headless Chrome at 390 and 1440 for `/agent/` and `/founder/`; four-agent review.

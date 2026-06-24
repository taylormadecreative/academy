# BUILD MODE — backend wire-up

The front-end is live and complete as a static site with **no keys**. Buy buttons
show a friendly "payments switch on soon" notice and the waitlist posts to FormSubmit
until the steps below are done. Nothing about the front-end changes when you wire this up.

The stack matches the booking + studio sites: **GitHub Pages (static) + Supabase
(Auth, Postgres, Storage, Edge Functions) + Stripe**. Everything is prefixed `ea_`
so it can share the existing Supabase project (`pgqdmnmessbbzyszjfvr`) alongside the
`bk_` booking tables and one shared `public.profiles`.

## What turns on, in order

### 1. Database (5 minutes)
Run `migrations/0001_build_mode_schema.sql` in the Supabase SQL editor. It creates
the `ea_*` tables, the `handle_new_user` trigger, RLS, the helper functions, and
seeds the two ebooks plus the coming-soon video course (prices left null).

### 2. Front-end keys (2 minutes)
In `js/config.js` set:
- `SUPABASE_URL` = `https://pgqdmnmessbbzyszjfvr.supabase.co`
- `SUPABASE_KEY` = the project's **publishable** key (`sb_publishable_...`, safe to commit)
- `FUNCTIONS_BASE` = `https://pgqdmnmessbbzyszjfvr.functions.supabase.co`

This alone switches on signup/login (magic link) and the native waitlist.

### 3. Files (private delivery)
Create a **private** Storage bucket `ea-files`. Upload the two ebook PDFs. Put each
file's path in its product row (`ea_products.storage_path`). Files are never public;
they are served only through a short-lived signed URL from `ea-issue-media` after an
entitlement check.

### 4. Prices + Stripe (15 minutes)
In Stripe, create a Product + Price for each ebook and the bundle. Put each Price id
in `ea_products.stripe_price_id` and the amount in `price_cents`. (Until then the site
shows "Price coming" everywhere, which is honest, not broken.)

### 5. Edge functions (to be added in the next build pass)
Four functions, `verify_jwt = false` (each does its own auth with the service role):
- **`ea-create-checkout`** — looks up the price server-side (never trusts the client),
  creates a Stripe Checkout Session (`mode: payment` for ebooks, `subscription` for
  membership), reuses an open session to prevent double charges, returns `{ url }`.
  Returns `503 payments_not_configured` when `STRIPE_SECRET_KEY` is absent (that is the
  graceful state the front-end already handles).
- **`ea-stripe-webhook`** — verifies the Stripe signature, and on
  `checkout.session.completed` finds-or-creates the user by email and writes an
  `ea_entitlements` row. The only place access is granted. Handles subscription
  lifecycle into `ea_memberships`, and refunds/disputes set `revoked_at`.
- **`ea-issue-media`** — verifies the buyer owns the product, then mints a short-lived
  signed URL for the PDF (Supabase Storage now; swap to a Bunny Stream token for course
  video later). Never leaks the path.
- **`ea-billing-portal`** — returns a Stripe Billing Portal URL for members to self-manage.

Function secrets to set: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`.

## Decisions still needed from Nelson
1. The two ebook prices + the bundle price.
2. Whether to add a paid monthly community/courses membership (the schema supports it)
   and its price, or keep the community free for v1.
3. Community for launch: a login-gated Discord invite seeded with the AUC cohort
   (near-zero build) vs the native on-site feed (`ea_posts`, already in the schema).
4. Final brand sign-off on "BUILD MODE" and the subdomain `academy.taylormadecreative.net`.

## Live now vs needs keys
- **Live now (no keys):** the whole marketing storefront, both ebook sales pages,
  pricing, about, community landing, legal, OG link previews, waitlist (FormSubmit).
- **Needs Supabase keys:** real signup/login, native waitlist, the member dashboard,
  the gated library/reader.
- **Needs Stripe keys:** live checkout, the bundle, membership, the billing portal.

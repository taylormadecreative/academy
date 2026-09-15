# BUILD MODE edge functions — deploy + secrets

The edge functions of one Supabase project (`pgqdmnmessbbzyszjfvr`). Each function does its
own auth with the service role, so JWT verification is turned OFF for all of them.

## verify_jwt = false (set this per function)

If you deploy with the CLI, add this block to `supabase/config.toml` (one entry per
function). If you deploy from the dashboard, toggle "Verify JWT" OFF on each function.

```toml
[functions.ea-create-checkout]
verify_jwt = false

[functions.ea-stripe-webhook]
verify_jwt = false

[functions.ea-issue-media]
verify_jwt = false

[functions.ea-billing-portal]
verify_jwt = false
```

Deploy (CLI):

```bash
supabase functions deploy ea-create-checkout  --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-stripe-webhook   --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-issue-media      --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-billing-portal   --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-delete-account   --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-demo-login       --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-community-bot     --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
```

`ea-community-bot` is called only by the scheduled cloud routines that run the community
(twice-daily engage + daily post, as Nelson). Auth = a baked `x-bot-secret` header
(rotate by editing the constant + redeploying). Actions: `recent` (read unhandled
activity, deduped), `post`, `comment`.

`ea-demo-login` is the App Store reviewer sign-in (one fixed email + code → a session
for a throwaway non-admin demo account). Turn it off after approval with
`supabase secrets set DEMO_LOGIN_DISABLED=1 --project-ref pgqdmnmessbbzyszjfvr`, or
delete the function.

## Secrets (function env)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform on deploy.
Set the rest with `supabase secrets set` (or in the dashboard under Edge Functions).

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  --project-ref pgqdmnmessbbzyszjfvr
```

| Function | verify_jwt | Secrets it reads |
| --- | --- | --- |
| `ea-create-checkout` | false | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` |
| `ea-stripe-webhook` | false | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `ea-issue-media` | false | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `ea-billing-portal` | false | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` |
| `ea-delete-account` | false | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (optional) |
| `ea-demo-login` | false | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_LOGIN_DISABLED` (optional kill switch) |

The service role key never reaches the browser. When `STRIPE_SECRET_KEY` is absent,
the payment functions return `503 {"error":"payments_not_configured"}`, which the
front-end already handles as a graceful "payments switch on soon" state.

## Workshop waitlist + tickets (added 2026-09-03)

| Function | verify_jwt | What it does | Secrets it reads |
| --- | --- | --- | --- |
| `ea-waitlist-join` | false | Public waitlist for /agent/ (POST), one-click leave (GET `?unsub=`). Rate limited, honeypot, sends the confirmation + a founder notice via Resend. | `RESEND_API_KEY` |
| `ea-ticket-checkout` | false | Sells a seat: holds a pending `ea_orders` row, then Stripe Checkout (30-min expiry, `metadata.kind=ticket`). `$0` tiers fulfil immediately. GET `?session_id=` feeds /agent/thanks/. | `STRIPE_SECRET_KEY`, `RESEND_API_KEY` |
| `ea-waitlist-announce` | false (checks the caller's JWT itself, admin only) | Emails the waitlist a date with each person's early-bird link; `test_to` sends one preview. | `SUPABASE_ANON_KEY`, `RESEND_API_KEY` |
| `ea-stripe-webhook` | false | Extended: `kind=ticket` sessions fulfil through `_shared/tickets.ts`; full refunds void seats. | as before |

Shared code lives in `_shared/email.ts` (Resend + branded layout) and `_shared/tickets.ts` (the
single fulfilment path). Run the helper tests with `deno test -A _shared/email_test.ts`.

**The repo copy of `ea-stripe-webhook` now matches the LIVE source** (signing secret comes from
`ea_config` when `STRIPE_WEBHOOK_SECRET` is unset). Deploy it with:

```bash
supabase functions deploy ea-stripe-webhook --project-ref pgqdmnmessbbzyszjfvr --no-verify-jwt
```

## RealtimeKit rooms (OPIL class rooms 2026-09-11 · the Academy room 2026-09-14)

Three functions, all `verify_jwt` OFF with their own auth (Bearer user token → service-role
`auth.getUser` → role RPCs run **as the caller**), CORS locked to `https://taylormadeacademy.com`.
No Cloudflare credential ever reaches a page: pages only ever hold a per-person participant token.

| Function | verify_jwt | What it does | Secrets it reads |
| --- | --- | --- | --- |
| `ea-rtk-join` | false | Mints a RealtimeKit participant token. `{ session_no }` = an OPIL class (host / judge / cohort student presets). `{ room: true, key? }` = the Academy room: Nelson (`ea_is_admin`) gets a **fresh** meeting at every Start and the previous one is set INACTIVE; anyone else needs the current link key or a membership, the room must be live (< 4 h), the cap applies, and joins are rate-limited through `ea_rate_check`. Creates the `tma-class-host` / `tma-class-guest` presets the first time Nelson joins. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCOUNT_ID`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN` |
| `ea-rtk-record` | false | `start` / `stop` the meeting recording (OPIL by `session_no`, Academy with `{ room: true }`), `retry_replay` (OPIL by `session_no`, Academy by `replay_id`), `register_webhook` / `list_webhooks` (OPIL admin). Retry re-runs the stored UPLOADED event through the same Stream copy the webhook uses. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCOUNT_ID`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN`, `CF_API_TOKEN` (Stream:Edit), `CF_STREAM_SUBDOMAIN` |
| `ea-rtk-webhook` | false (checks RealtimeKit's signature against its published public key; no browser calls it) | Recording status events → copy the file to Cloudflare Stream → a draft row in `ea_room_replays` (the meeting is looked up in `ea_rooms` first, then `ea_room_replays`) or `ea_opil_replays` (last). Nelson / the coordinator publish from the page. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN` (Stream:Edit), `CF_STREAM_SUBDOMAIN` |

Tests (stubbed fetch + supabase, Deno std 0.224.0 asserts):

```bash
deno test --allow-read supabase/functions/ea-rtk-join/ supabase/functions/ea-rtk-record/ supabase/functions/ea-rtk-webhook/ supabase/functions/_shared/rtk_auth_test.ts supabase/functions/_shared/rtk_presets_test.ts
```

(`--allow-read` because `rtk_presets_test.ts` reads `scripts/rtk-presets/*.json`; the two `_shared`
suites are part of the room build and do not run from the three directories alone.)

Deploy (CLI):

```bash
supabase functions deploy ea-rtk-join    --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-rtk-record  --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
```

**Retired 2026-09-14: `ea-live-publish`** — the camera broadcast behind `js/broadcast.js`. The class
room is now the only way to go live on the Academy (`/live/` → `/room/`) as it already was on OPIL, so
the function directory, `js/broadcast.js` and `css/broadcast.css` are deleted from the repo. It is
removed from the project in the rollout with
`supabase functions delete ea-live-publish --project-ref pgqdmnmessbbzyszjfvr`. Its secrets
`CF_STREAM_INPUT_ID` and `CF_STREAM_WHIP_KEY` have no remaining reader. `ea_live`, `ea_live_chat` and
the Cloudflare Stream live input stay untouched: `/agent/live/` (the ticket-holder room) still reads them.

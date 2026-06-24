# BUILD MODE edge functions — deploy + secrets

Four functions, one Supabase project (`pgqdmnmessbbzyszjfvr`). Each function does its
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
```

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

The service role key never reaches the browser. When `STRIPE_SECRET_KEY` is absent,
the payment functions return `503 {"error":"payments_not_configured"}`, which the
front-end already handles as a graceful "payments switch on soon" state.

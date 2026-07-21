# PFx Avatar Playbook + Google Sign-In — Design Spec
**Date:** 2026-07-21 · **Deadline:** live before Wed Jul 22, 11:00 AM ET (PFx mini-workshop)
**Approved by Nelson:** 2026-07-21 ("yes lets do it")

## Goal
Students at the PFx virtual session go to ONE URL — `academy.taylormadecreative.net/pfx` —
tap **Join free with Google**, land on the free **AI Avatar Playbook**, follow along,
and end with a **Join the Facebook AI group** CTA (facebook.com/groups/taylormadeacademy).

## Components

### 1. Google sign-in enablement (no front-end code)
- Login page already renders a Google button when the provider is enabled in Supabase
  (`/auth/v1/settings` check in `login/index.html`).
- To do (browser, Nelson's Chrome):
  a. Google Cloud Console: OAuth consent screen (External, **published to production**,
     basic scopes only — no verification review needed) + Web application OAuth client.
     Authorized redirect URI: `https://pgqdmnmessbbzyszjfvr.supabase.co/auth/v1/callback`
     Authorized JS origin: `https://academy.taylormadecreative.net`
  b. Supabase dashboard → Auth → Providers → Google: enable, paste client ID + secret.
  c. Supabase Auth → URL Configuration: ensure redirect allow-list covers
     `https://academy.taylormadecreative.net/**` (needed for the playbook's
     redirect-back-to-self flow).

### 2. Playbook page — `/playbook/ai-avatar/` (hand-maintained app page)
- Pattern: same as `/community/index.html` — vanilla JS + supabase-js (esm.sh),
  `js/config.js`, v4 "Varsity Modern" design system (`css/build-mode.css`), mobile-first.
- **Logged out:** gate card (reuse `.gate` pattern) with **Join free with Google**
  → `supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo: <this page URL>}})`
  so students return straight to the playbook (NO /welcome/ onboarding detour — they can
  onboard later). Google button shown only if provider enabled (same `/auth/v1/settings`
  check as login); always show email fallback link → `/login/?mode=join`.
- **Logged in:** the playbook content:
  - Step 1 — Pick your path:
    Path A: **AI clone** — selfie → HeyGen photo avatar.
    Path B: **Original character** — ChatGPT (or Meta AI) image generation, with the
    fill-in-the-blank starter prompt from the facilitator script.
  - Step 2 — **Bring it to life in HeyGen** (free, no card): upload image → script/voice
    → generate → download. Honest free-plan limits: 3 videos/mo, 1-min cap, 720p, watermark.
  - Step 3 — **Show it off**: post in the FB AI group + Academy community.
  - CTA band: Join the Facebook group → https://www.facebook.com/groups/taylormadeacademy
- Client init must match login/community exactly (so the OAuth return code exchange
  completes on this page).
- Add the page to `APP_PAGES` in `build_site.py` (asset `?v=` stamping + PWA head);
  bump `sw.js` VERSION. Keep the page out of sitemap; `noindex`.

### 3. `/pfx/` redirect
- Tiny static `index.html` meta-refresh + JS redirect → `/playbook/ai-avatar/`.
  Easy to say out loud on the live call.

### 4. Free access
- Page gates only on "signed in" — every free account sees it. No product/store changes.

## Content sources
- `~/TaylormadeCreative-AUC-Workshop/pfx-facilitator-script.md`
- `~/TaylormadeCreative-AUC-Workshop/pfx-student-heygen-quickstart.md`
- Live HeyGen/ChatGPT UI verification pass tonight (open item from prep notes) —
  copy adjusted afterward if labels changed.

## QA
- 4-agent review (design/mobile, code correctness incl. auth, content accuracy,
  a11y/legibility) with adversarial verify before deploy.
- End-to-end: incognito → /pfx → Google join (test account) → playbook renders at 390px
  width → FB link works.

## Notes / accepted behavior
- Every signup emails Nelson a notification + auto-subscribes to the newsletter
  (standing rule) — expect a burst during the session.
- Naming HeyGen/ChatGPT here is intentional (it IS the curriculum); the
  never-reveal-supply-chain rule applies to client deliverables, not this teaching page.

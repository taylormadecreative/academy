# Spec: Member onboarding, profile photos & a real free tier

**Date:** 2026-06-25
**Project:** Taylormade Academy (`~/taylormade-academy`, repo `taylormadecreative/academy`, live at academy.taylormadecreative.net)
**Status:** Approved design, ready for implementation plan

---

## Problem

After signing in, a member lands straight on a dashboard that:

1. Greets them by their **email prefix** ("taylormademd") with no way to set a real name or a profile photo — there is no onboarding and avatars are initials-only everywhere.
2. Shows **both paid ebooks with full Read/Download** even though the account is meant to be on the free tier.
3. Displays **stale ebook cover art** (the renamed "AI Money Machine" still shows the old "Boring Money" cover; the AI-Agent cover is a stale cached image).

Separately, the free ebook ("The Creator's AI Playbook") is currently a **public instant download** from a lead-capture popup — Nelson wants it to instead **require a free-tier signup**, so the ebook becomes the hook that grows the member base.

## Current-state findings (verified against the live DB + code)

- **The "total access" is not a gating bug.** `taylormademd@gmail.com` is `role = 'admin'` in `public.profiles`, and the access predicate `ea_is_member()` returns `(active membership) OR ea_is_admin()`. The live `ea_my_library()` UNIONs in **all** published ebooks/courses when `ea_is_member()` is true. So the admin account correctly sees everything; a real free user (no entitlement, no membership, not admin) gets an **empty library**. The free-tier gating already works — but there is nothing for it to show, and the admin cannot preview the free experience.
- **No free product exists.** Catalog: `ai-agent-ebook` $19, `boring-money` ("The AI Money Machine") $17, `bundle` $29, `all-access` ("Membership") $15/mo, `video-course` (coming soon). Everything is paid or coming-soon.
- **Covers:** the static store pages already reference the new art (`build_site.py` `PRODUCTS["boring-money"].cover = /assets/cover-money-machine.png`). Only two stale spots remain: the DB `ea_products.cover_url` for `boring-money` still points at `/assets/cover-boring-money.png`, and `/assets/cover-ai-agent.png` is being served from browser cache (the file was overwritten in place).
- **No onboarding.** `login/` redirects to `/community/` after auth. `/community/` lazily inserts an `ea_profiles` row with `display_name = email-prefix`. `ea_profiles` already has an **unused `avatar_url` column**.
- **Public ebook leak.** `free/ai-for-beginners/the-creators-ai-playbook.pdf` (committed to git) and `free/ai-for-beginners/ebook.html` (full readable HTML) are publicly served. `js/site.js` `BM.getEbook()` posts the email to `ea-subscribe` then triggers an instant `<a download>` of that public PDF. The `getEbook` popup form is global (every marketing page).

## Goals

- A one-time **onboarding** step after first sign-in: set display name, optional photo, interests.
- **Profile photos** uploadable in onboarding and the profile editor, shown everywhere a name appears (initials fallback).
- A **real free tier**: "The Creator's AI Playbook" ebook, **gated behind a free-tier signup** (no longer a public download), appearing in every signed-in member's library.
- An admin **"preview as free member"** toggle so Nelson can verify the free experience without a second account.
- **Fix the stale covers.**

## Non-goals

- Refreshing images *inside* the ebook PDFs (Nelson confirmed: site covers only).
- Paid-product preview cards on the free dashboard — paid items stay off the dashboard (visible in the store + the existing "Go all-in" upsell). 
- Reworking the newsletter/footer "notify me" captures — only the ebook popup converts to a signup.
- Server-side recurring newsletter automation (out of scope).

---

## Design

### 1. Onboarding — new `/welcome/` page

- **Tracking column:** add `ea_profiles.onboarded_at timestamptz`. A member is "onboarded" once it is set.
- **Routing:** all post-auth redirects (login page, popup magic link, `emailRedirectTo`) point to **`/welcome/`**. `/welcome/` checks the session's `onboarded_at`: if set → `location.replace('/community/')`; if null → render the onboarding form. `dashboard/` and `community/` also bounce to `/welcome/` when `onboarded_at` is null (catches accounts created before onboarding existed).
- **Form fields:**
  - **Display name** — required. Pre-filled from the email prefix but fully editable (fixes the "taylormademd" default). Min 2 chars.
  - **Profile photo** — optional. File picker → upload to `ea-avatars` (see §2) → preview. Skippable.
  - **Interests** — the existing `open_to` tag set (Design / Photography / Video / AI), multi-select chips.
- **Submit:** `upsert` into `ea_profiles` (`display_name`, `avatar_url`, `open_to`, `onboarded_at = now()`), then `location.replace('/community/')`.
- **Page shell:** reuse the existing app-page chrome (same header/footer/CSS as `login/`), single centered card. Hand-maintained page (not generated by `build_site.py`).

### 2. Profile photos — wire up `avatar_url`

- **Storage:** new **public** bucket `ea-avatars`. Object path `{auth.uid()}/avatar.<ext>`. RLS: authenticated users may `insert`/`update`/`delete` only objects under their own `{uid}/` prefix; public `select` (read). Public URL stored in `ea_profiles.avatar_url`.
- **Upload helper** (shared, in `js/site.js` or inline per app page): validate type (jpg/png/webp) and size (≤ ~3 MB), upload with `upsert: true` to a stable path so re-uploads overwrite, then read the public URL and save to the profile.
- **Render everywhere** via a shared `avatarHtml(name, url, size)` helper that returns an `<img>` when `url` is present, else the existing initials chip:
  - `dashboard/`: welcome avatar, leaderboard rows.
  - `community/`: top-bar "me" avatar, feed post authors, comment authors, members directory, DM thread list, leaderboard.
- **RPC additions:** `ea_community_feed` and `ea_leaderboard` add `avatar_url` to their returned columns (avoids per-row client lookups). Where a surface already fetches `ea_profiles` (members directory, the `names` map, my-profile), extend it to also carry `avatar_url` into an `avatars[user_id]` map. DM thread avatars: add `avatar_url` to `ea_dm_threads` if cheap, else initials fallback.

### 3. Real free tier — the gated Creator's AI Playbook

- **Product flag:** add `ea_products.is_free boolean not null default false`.
- **New product row:** `slug = creators-ai-playbook`, `title = "The Creator's AI Playbook"`, `type = 'ebook'`, `is_free = true`, `price_cents = 0`, `status = 'published'`, `storage_path = 'creators-ai-playbook.pdf'`, `cover_url = '/assets/cover-creators-playbook.png'`.
- **PDF storage:** upload the current `The-Creators-AI-Playbook.pdf` to the **private** `ea-files` bucket as `creators-ai-playbook.pdf` (via a temporary secret-gated edge function, then tombstone it — the established pattern). Remove the public copies (see §4).
- **Cover thumbnail:** render page 1 of the PDF to `/assets/cover-creators-playbook.png` (+ `.webp`). If the portrait crop reads poorly in the 16/10 card, make a dedicated landscape cover.
- **Library access for everyone:** `ea_my_library()` UNIONs in published `is_free` ebooks for **any** authenticated caller (granted_at null), de-duplicated against owned entitlements — so the Playbook lands in every signed-in member's library regardless of tier.
- **Download access:** `ea-issue-media` adds an unlock branch — if `ea_products.is_free` is true, any authenticated user is unlocked (in addition to the existing entitlement / course-membership paths). Select `is_free` alongside `id, type, storage_path`.
- **Result:** free member's library = the Playbook only. Paid ebooks/courses stay locked (already true for non-admins); the existing "Go all-in" upsell drives upgrades.

### 4. Popup → free-tier signup (no more public download)

- **Lock the file away:** remove `free/ai-for-beginners/the-creators-ai-playbook.pdf` and `free/ai-for-beginners/ebook.html` (and `book-cover.html`) from the deployed tree. Relocate the ebook build sources (`free/build_ebook.py`, the `ai-for-beginners/` HTML) to a non-published, gitignored `_ebook-src/` so they remain editable but are never served. The only path to the Playbook becomes `ea-issue-media`.
- **Rewrite `BM.getEbook(e)`** (one function in `js/site.js`, used by the global popup on every page) — chosen flow: **prefill the login page**:
  1. Read + validate the email.
  2. `POST` it to `ea-subscribe` (`source: 'ebook-popup'`, `lead_magnet: 'ai-playbook'`) so the lead is captured even if signup isn't completed.
  3. `location.href = '/login/?email=' + encodeURIComponent(email)` — hand off to the existing, tested magic-link + 6-digit-code flow.
  4. Mark the popup seen / close it.
- **Login page** (`login/`): on load, read `?email=` and prefill the field; if present, auto-submit the OTP send (or focus + one tap). After auth it already redirects post-auth → now `/welcome/`.
- **Popup copy:** retitle from "Get my free e-book / instant download" to a free-account framing — e.g. eyebrow "Join free", CTA "Create your free account", subcopy "The Playbook's waiting inside — plus the community. 100% free." Keep the "100% free" reassurance. Update the global popup markup in `build_site.py` (regenerates all marketing pages) and the hand-maintained pages that embed it (`404.html`, `thank-you/`, `terms/`, `privacy/`, etc. are regenerated or hand-edited as needed).

### 5. Admin "preview as free member"

- **RPC param:** replace `ea_my_library()` with `ea_my_library(p_as_free boolean default false)`. When `p_as_free` is true **and** the caller is admin, skip the member-unlock union (return only genuinely-owned entitlements + free ebooks) — i.e. exactly what a free member sees. Default `false` preserves current behavior for all other callers.
- **Dashboard toggle:** an admin-only "👁 Preview as free member" switch (visible only when `ea_is_admin()`), persisted in `localStorage`. When on, the dashboard re-queries `ea_my_library(true)` and hides admin-only chrome, so Nelson sees the real free view.

### 6. Cover fix

- Update DB: `ea_products.cover_url` for `boring-money` → `/assets/cover-money-machine.png`.
- Cache-bust the AI-Agent cover: copy the new art to a **versioned filename** `cover-ai-agent-v2.png` (+ `.webp`), update `build_site.py` `PRODUCTS["ai-agent-ebook"].cover` and `COVER_DIMS`, update DB `cover_url`, and regenerate the static pages.
- Confirm the dashboard library card (driven by `ea_my_library.cover_url`) now shows the correct art for both books and the Playbook.

---

## Data-model changes (migrations)

```sql
-- ea_profiles
alter table public.ea_profiles add column if not exists onboarded_at timestamptz;

-- ea_products
alter table public.ea_products add column if not exists is_free boolean not null default false;

-- new free product
insert into public.ea_products (slug, title, type, is_free, price_cents, status, storage_path, cover_url)
values ('creators-ai-playbook', 'The Creator''s AI Playbook', 'ebook', true, 0, 'published',
        'creators-ai-playbook.pdf', '/assets/cover-creators-playbook.png')
on conflict (slug) do update set is_free = excluded.is_free, status = excluded.status,
  storage_path = excluded.storage_path, cover_url = excluded.cover_url;

-- cover fix
update public.ea_products set cover_url = '/assets/cover-money-machine.png' where slug = 'boring-money';
update public.ea_products set cover_url = '/assets/cover-ai-agent-v2.png' where slug = 'ai-agent-ebook';

-- ea_my_library(p_as_free) — see §3/§5: owned entitlements
--   UNION free published ebooks for all authed callers
--   UNION (member AND NOT preview-as-free) all published ebooks/courses

-- ea_community_feed / ea_leaderboard — add avatar_url to RETURNS TABLE + select
```

- **`ea-avatars` bucket** + RLS policies (per-user write under `{uid}/`, public read).

## Edge-function changes

- **`ea-issue-media`** → new version: select `is_free`; unlock branch `if (product.is_free) unlocked = true` for any authenticated user (keep entitlement + course-membership branches; keep the identical-404 no-leak behavior; CORS, rate-limit, no-storage-path-leak all unchanged).
- **temp upload fn** (e.g. `ea-admin-upload-temp`) → base64-POST the Playbook PDF into `ea-files`, verify, then overwrite with a disabled 410 tombstone.

## Front-end changes (per file)

- **NEW `welcome/index.html`** — onboarding (§1).
- **`login/index.html`** — `?email=` prefill + auto-send; post-auth redirect → `/welcome/`.
- **`dashboard/index.html`** — onboarding bounce; `avatarHtml` for welcome + leaderboard; `ea_my_library(p_as_free)`; admin preview toggle.
- **`community/index.html`** — onboarding bounce; `avatarHtml` across feed/comments/members/DMs/leaderboard/me; avatar upload in the profile editor; `avatars[]` map.
- **`js/site.js`** — rewrite `getEbook` (§4); add `avatarHtml` + the avatar upload helper.
- **`build_site.py`** — popup copy/CTA (§4); cover refs `cover-ai-agent-v2` (§6); regenerate all marketing pages.
- **Remove/relocate** `free/ai-for-beginners/*.pdf` + `*.html` build outputs from the deployed tree (§4).

## Access / security notes

- Free download is gated server-side: the PDF lives only in the private `ea-files` bucket; `ea-issue-media` requires a valid JWT and only mints a signed URL when `is_free` (or owned). No public URL exists after §4.
- `ea-avatars` is public-read by design (profile photos); writes are RLS-scoped to the owner's `{uid}/` prefix, so a member can only change their own photo.
- `p_as_free` only weakens access for admins previewing; it can never grant a non-admin more than they have.

## Testing / verification

1. **Fresh free user** (new email, not admin): popup → `/login/?email=` → magic link → `/welcome/` → set name+photo+interests → `/community/` → `/dashboard/` shows name+photo, library = Playbook only, paid books locked, Playbook downloads via `ea-issue-media`.
2. **Public-leak gone:** `GET /free/ai-for-beginners/the-creators-ai-playbook.pdf` and `…/ebook.html` 404.
3. **Admin:** preview-as-free toggle hides the paid books; toggle off restores full library.
4. **Covers:** dashboard + store show the new Money-Machine and AI-Agent-v2 art (hard refresh confirms cache-bust).
5. **Avatars:** uploaded photo appears in dashboard, feed, comments, members, leaderboard; initials fallback when none.
6. **Returning onboarded user:** login → `/welcome/` self-bounces straight to `/community/`.

## Rollout order

1. Migrations: `onboarded_at`, `is_free`, new product row, cover-url updates, `ea_my_library(p_as_free)`, RPC `avatar_url` columns. 2. `ea-avatars` bucket + RLS. 3. Upload Playbook PDF to `ea-files`; render cover; cache-bust AI-Agent cover. 4. `ea-issue-media` new version. 5. `/welcome/` + login prefill + redirects. 6. Avatar rendering + upload across dashboard/community. 7. `getEbook` rewrite + popup copy + remove public PDF/HTML. 8. `build_site.py` regenerate + commit + push (Actions deploy). 9. Verify per the checklist.

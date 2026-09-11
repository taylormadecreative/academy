# RealtimeKit Live Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/live/` (Academy webinar) and `/opil/hub/live/` (OPIL class) a two-way Cloudflare RealtimeKit room — camera, mic, screen share, chat, polls, raise-hand, breakouts, server-side recording → Stream replay, transcript + AI summary draft — alongside the existing one-way Cloudflare Stream broadcast path, with no bundler and no Cloudflare secret in any page.

**Architecture:** Two room rows (`ea_live.id`, `ea_opil_sessions.no` with `kind='thread'`) each gain four server-written columns (`rtk_meeting_id`, `mode`, `rtk_session_id`, `rtk_started_at`) that the pages read to decide whether to mount today's HLS player (`mode='stream'`) or `<rtk-meeting>` (`mode='meeting'`). Three Deno edge functions own every Cloudflare call — `ea-rtk-join` (role → preset → participant token), `ea-rtk-host` (start / end_session / start_recording / stop_recording / status), `ea-rtk-webhook` (signature-verified events → off-air backstop, Stream copy-by-URL, transcript/summary artifacts) — sharing `_shared/rtk.ts`, the typed Cloudflare REST helper. The client is one lazy ESM module `js/rtk-room.js` that injects the RealtimeKit core IIFE from jsdelivr, mounts the stock `<rtk-meeting>` into `#rtk-root`, and renders a host bar that calls `ea-rtk-host` and updates the DOM in place.

**Tech Stack:** Supabase Postgres + RLS + edge functions (Deno 2.7, `verify_jwt` OFF), Cloudflare RealtimeKit REST API + `@cloudflare/realtimekit@2.0.2` (IIFE core) + `@cloudflare/realtimekit-ui@2.0.2` (ESM UI kit) from jsdelivr, Cloudflare Stream (copy-by-URL replay), static GitHub Pages HTML/CSS/JS stamped by `build_site.py`, `deno test` for unit tests, Playwright (`npx playwright`) for the two-context client test.

**Spec:** /Users/nelsontaylor/taylormade-academy/docs/superpowers/specs/2026-09-10-realtimekit-live-rooms-design.md

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the spec.

- **No bundler.** Everything the browser runs is loaded straight from a CDN or from this origin. RealtimeKit is pinned to **exact version `2.0.2`**, never `@latest`:
  - core (IIFE, `window.RealtimeKitClient`): `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js`
  - UI kit loader (ESM, `defineCustomElements`): `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js`
  - UI kit module (ESM, `provideRtkDesignSystem`, `defaultConfig`): `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js`
  - `@cloudflare/realtimekit@2.0.2/+esm` and `dist/index.es.js` are **dead** — jsdelivr's ESM conversion of `sdp-transform@2.15.0` returns 404 and aborts the graph (spike 1, verified in Playwright). Never import either. `realtimekit-ui@2.0.2/dist/index.es.js` is a 404.
- **GitHub Pages static site.** No server rendering, no Node build step, no Netlify. `python3 build_site.py` stamps `?v=` onto same-origin assets; pages are hand-maintained HTML.
- **Supabase edge functions are Deno with `verify_jwt` OFF and their own auth.** Deploy flag: `--no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`. Auth pattern copied from `ea-live-publish/index.ts:53-79`: `Authorization: Bearer <supabase access token>` → service-role `admin.auth.getUser(token)` → role RPCs run **as the caller** through an anon client carrying the caller's bearer.
- **CORS locked to `https://taylormadeacademy.com`.** `ALLOWED_ORIGIN = "https://taylormadeacademy.com"`; the CORS block, `json()` helper and OPTIONS/405 guards are copied verbatim from `ea-live-publish/index.ts:28-46`. The webhook has no CORS surface (server-to-server, POST only).
- **No Cloudflare secret ever reaches a page.** `CF_RTK_API_TOKEN`, `CF_RTK_APP_ID`, `CF_RTK_WEBHOOK_ID`, `CF_API_TOKEN`, `CF_ACCOUNT_ID` are function secrets only. `js/config.js` keeps only the publishable key. `js/rtk-room.js` holds no app id, no API token, no webhook id. The RealtimeKit token is a **new** token with Realtime + Realtime Admin only — never the Stream:Edit `CF_API_TOKEN`.
- **Every new same-origin asset must be added to `build_site.py`'s `_asset_ver` + `_ASSET_RX` and `sw.js` `VERSION` bumped.** `js/rtk-room.js` and `css/rtk-room.css` go into the `_asset_ver` tuple (`build_site.py:15-18`) and into `_ASSET_RX` (`build_site.py:214`); `sw.js:6` currently reads `const VERSION = 'tma-v9-opil-facilitators';` and becomes `const VERSION = 'tma-v10-rtk-rooms';` (the site is already on v9 — v10 is the next number, not v9 again). Pages reference the **bare** paths `/js/rtk-room.js` and `/css/rtk-room.css` — a hand-written `?v=…` would be stamped to `?v=<hash>…` and 404.
- **Host actions never call `location.reload()`.** Room-mode handlers update the DOM in place. The existing broadcast Go live / End handlers (`opil/hub/live/index.html:324`, `live/index.html:356`) keep their reloads, and their **reload lines** stay byte-for-byte unchanged. Exactly one edit to the broadcast write path is permitted and required (Task 7 Step 9, Task 8 Step 4b): the Go live / End update payload gains `mode: 'stream'`, because a broadcast is never room mode and nothing else can un-stick a row left at `mode='meeting'`.
- **Academy brand:** navy `#04123a` / `#0a1733`, gold `#fdc921`. Design tokens: `theme: 'darkest'`, `fontFamily: 'Inter'`, brand ramp `300:#fee38a 400:#fdd45a 500:#fdc921 600:#d9a90f 700:#b28a0a`, background ramp `600:#22345f 700:#162650 800:#0f1d44 900:#0a1733 1000:#04123a`, `text:#ffffff`, `text-on-brand:#04123a`, `video-bg:#0a1733`, `danger:#ff5c5c`, `success:#3ddc97`, `warning:#fdc921`. Space Grotesk stays on the page chrome **around** `#rtk-root`.
- **Server-only columns.** `rtk_meeting_id`, `rtk_session_id`, `rtk_started_at` are written **only** by the service role, and `mode` is the only one a client may touch — and then only **downwards**: the `0029` guard trigger lets `authenticated` / `anon` set `mode = 'stream'` and refuses `mode = 'meeting'` with `42501`. That one-way door is what lets the broadcast Go live / End path hand a stuck room back to broadcast without an edge-function round trip. `mode` is set to `'meeting'` only by `ea-rtk-host start`, and reset to `'stream'` by `ea-rtk-host` (the one-live clear inside `start`, and `end_session`), by the `meeting.ended` webhook backstop, and by the broadcast Go live / End payload. The pages never write `rtk_meeting_id`, `rtk_session_id` or `rtk_started_at`.
- **Preset allowlist** (validated in `ea-rtk-join` before any Cloudflare call, and a `check` constraint on `ea_rtk_participants.preset_name`): `['tma-webinar-host','tma-webinar-member','opil-host','opil-student','opil-judge']`.
- **`custom_participant_id` = Supabase `auth.users.id` (UUID), never email or phone.** `name` = `ea_profiles.display_name` or `'Member'`; `picture` = `ea_profiles.avatar_url` only when it is an `https:` URL.
- **Never write AI draft text to a member-readable row.** `ea_opil_sessions` and `ea_live` are read whole (`select('*')`) by every member/cohort page. Transcript, summary and playbook text live only in `ea_rtk_artifacts` behind `ea_rtk_session_notes(p_room, p_ref)`.

### Testing reality (§15.1 spike 19 — CLOSED, negative)

**There is no local Supabase stack and no second hosted project.** This Mac has no Docker, no colima and no local Postgres, so `supabase start` / `supabase db reset` cannot run at all; the org is on the free plan with both project slots used, so there is no staging ref. The only Supabase project is production `pgqdmnmessbbzyszjfvr`. Every test step in this plan is therefore one of exactly four kinds, and no task may invent a fifth:

1. **`deno test` with stubbed `globalThis.fetch` and stubbed deps** — all edge-function and helper logic. No network, no database.
2. **The real production project for SQL** — migration `0029` is purely additive (new columns with defaults, new tables, one new function), so it is safe to apply. Every row a test creates is prefixed **`zz-test-`** in its title and every task that creates data ends with a cleanup step that deletes exactly those rows.
3. **The scratch Playwright harness at `/private/tmp/claude-501/-Users-nelsontaylor/5ab9f84d-c3e8-43ac-b532-86351b6e093d/scratchpad/rtk-spike/`** (already contains `index.html` from spike 1) — the client module, against the **real** Cloudflare RealtimeKit app `0f38f396-7ab8-41ed-bc08-8cf48fa695c7` with its five real presets, and a local token-minting stub in place of `ea-rtk-join`. Every test meeting is retired with `PATCH …/meetings/{id} {"status":"INACTIVE"}` afterwards.
4. **Live `curl` against the deployed function** with a real access token pasted from the browser — the auth matrix only. Read-only or `zz-test-` rows only.

Set these once per shell for every step that talks to Supabase or Cloudflare (never committed):

```bash
export SB_REF=pgqdmnmessbbzyszjfvr
export SB_TOKEN="$(security find-generic-password -s 'Supabase CLI' -w | sed 's/^go-keyring-base64://' | base64 -d)"
export SB_ANON=sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz
export SB_REST="https://pgqdmnmessbbzyszjfvr.supabase.co/rest/v1"
export FN="https://pgqdmnmessbbzyszjfvr.functions.supabase.co"
export CF_ACCOUNT_ID=<account id>
export CF_RTK_APP_ID=0f38f396-7ab8-41ed-bc08-8cf48fa695c7
export CF_RTK_API_TOKEN=<Realtime + Realtime Admin token>
export RTK="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/realtime/kit/$CF_RTK_APP_ID"
```

`SB_TOKEN` is the Management API token (the macOS keychain entry is base64-wrapped; `curl` only — python urllib is Cloudflare-blocked). SQL runs through `POST https://api.supabase.com/v1/projects/$SB_REF/database/query` with `{"query": "..."}`.

Two **user** JWTs are needed for the auth matrices. Get each by signing in at `https://taylormadeacademy.com/login/` in Chrome as that account and running this in DevTools, then exporting the string:

```js
JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('-auth-token')))).access_token
```

```bash
export TMA_ADMIN_JWT=<token for Nelson's admin account>
export TMA_MEMBER_JWT=<token for a non-admin member account>
export TMA_NONMEMBER_JWT=<token for a signed-in account with no membership; if none exists, skip the one curl line that uses it and say so>
```

### Open questions (§17) — the documented v1 default each task uses

1. **Ticket holders / public rooms.** v1 default: room mode is members-only; `ea-rtk-join` does **not** call `ea_has_ticket`, and `ea_live.access = 'public'` rows are broadcast-only (button disabled, server backstop 403 `not_allowed`).
2. **Judges hidden?** v1 default: `hidden_participant: false` — exactly as the five committed preset bodies already read.
3. **Student DMs.** v1 default: `opil-student` keeps private text chat (`chat.private.can_send: true`, `files: false`) as committed.
4. **Waiting room.** v1 default: `waiting_room_type: "SKIP"` on all five presets — cohort membership is the gate.
5. **Co-teaching facilitators.** v1 default: a facilitator of another session falls through judge → student → 403 `not_allowed`. No special case.
6. **Workers plan.** v1 default: `transcription_enabled: true` only on the two host presets; no code path depends on the plan tier.
7. **Replay gate.** v1 default: replays are unsigned Stream `/watch` URLs behind the same RLS as today's broadcast recordings.
8. **Room type.** v1 default: `font_family` / `fontFamily` = `"Inter"` inside the room; Space Grotesk stays on the page chrome.
9. **Publish playbook.** v1 default: `ea_rtk_session_notes` is read-only; nothing publishes a draft.
10. **Staging project.** v1 default: none — see "Testing reality" above.

---

## File Structure

### Created

| File | Single responsibility |
|---|---|
| `supabase/migrations/0029_realtimekit_rooms.sql` | The whole data model: four server-written columns + guard trigger on both room tables, the three service-role-only tables, their partial unique indexes, the service-role artifact upsert RPC (partial-index-aware — PostgREST `onConflict` cannot express a predicate), and the admin read RPC. |
| `scripts/rtk-rls-attacks.sh` | The scripted RLS attack list for `0029` — every locked-column write as anon / member / admin must be rejected, every service-role write must succeed. |
| `supabase/functions/_shared/rtk.ts` | Cloudflare RealtimeKit REST helper: base URL, bearer header, one typed `{status, data}` return per call, never throws on an HTTP error; plus `createOrGetMeeting` with the race-safe claim. |
| `supabase/functions/_shared/rtk_test.ts` | `deno test` for `_shared/rtk.ts` against a stubbed `globalThis.fetch`. |
| `supabase/functions/ea-rtk-join/handler.ts` | Pure request handler: auth → role → preset → gate → meeting → participant token. Takes every side effect as an injected dep. |
| `supabase/functions/ea-rtk-join/index.ts` | Wires the real Supabase clients and `rtk` implementation into `handleJoin` and calls `Deno.serve`. |
| `supabase/functions/ea-rtk-join/handler_test.ts` | `deno test` for the join handler with stubbed deps. |
| `supabase/functions/ea-rtk-host/handler.ts` | Pure request handler for `start` / `end_session` / `start_recording` / `stop_recording` / `status`. |
| `supabase/functions/ea-rtk-host/index.ts` | Real deps + `Deno.serve` for the host function. |
| `supabase/functions/ea-rtk-host/handler_test.ts` | `deno test` for the host handler with stubbed deps. |
| `supabase/functions/ea-rtk-webhook/handler.ts` | Pure request handler: RSA-SHA256 verify → dedupe → per-event effect. |
| `supabase/functions/ea-rtk-webhook/index.ts` | Real deps (public-key cache, Supabase, Stream copy) + `Deno.serve`. |
| `supabase/functions/ea-rtk-webhook/handler_test.ts` | `deno test` for the webhook handler: signature, dedupe, every event effect. |
| `supabase/functions/ea-rtk-webhook/fixtures/` | Captured webhook bodies + headers used by the replay test. |
| `js/rtk-room.js` | The only client module: loads the core IIFE + UI kit, calls `ea-rtk-join`, mounts `<rtk-meeting>` into `#rtk-root`, renders and wires the host bar, tears the room down. |
| `css/rtk-room.css` | `#rtk-root` layout, host bar, `body.in-meeting` rules (chat column collapse, OPIL dock hiding). |

### Modified

| File | Change |
|---|---|
| `supabase/functions/README.md` | Add the three new functions to the deploy list and the secrets table. |
| `opil/hub/live/index.html` | `/css/rtk-room.css` link; `<section id="rtk-root" hidden>`; `#bcStartRoom` in the existing Broadcast control card; the `mode` branch; chat handover. |
| `live/index.html` | `/css/rtk-room.css` link; `#rtk-root` inside `shellHTML`; `#aStartRoom` in the admin card; the `mode` branch; the lazy `ea_live` row insert; `mode:'stream'` on the broadcast write; the read-only "Session notes (AI draft)" card under the admin bar. |
| `opil/hub/admin/index.html:306, :323, :340` | The read-only "Session notes (AI draft)" panel inside each session row of the sessions manager, beside the Playbook URL input. |
| `build_site.py:15-18, :214` | `js/rtk-room.js` + `css/rtk-room.css` into `_asset_ver` and `_ASSET_RX`. |
| `sw.js:6` | `VERSION` → `'tma-v10-rtk-rooms'` (from `'tma-v9-opil-facilitators'`). |

### Read but not modified

`supabase/functions/ea-live-publish/index.ts` (the auth/CORS pattern every function copies), `supabase/migrations/0021|0023|0027|0028` (RLS + the two partial one-live indexes), `opil/hub/hub.js:128-136` (the fixed dock `nav()` appends), `js/broadcast.js`, `js/config.js`, `scripts/rtk-presets.sh` + `scripts/rtk-presets/*.json` (the five presets, already created against the live app).

---

## Task 1: Migration `0029` — server-only columns, guard trigger, three service-role tables, admin RPC

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/migrations/0029_realtimekit_rooms.sql`
- Create: `/Users/nelsontaylor/taylormade-academy/scripts/rtk-rls-attacks.sh`

**Interfaces:**
- Consumes: existing `public.ea_live` (`0021`, `0023`, `0027`), `public.ea_opil_sessions` (`0013:47-55`, `0019`), `public.ea_profiles` (`0003:26-34`), `public.ea_is_admin()` (`0001:10`), `public.ea_opil_is_admin(uuid)` (`0016:15`), `public.ea_opil_fac_sessions(uuid)` (`0018:25`), the partial unique indexes `ea_live_one_live` / `ea_opil_sessions_one_live` (`0023:54-57`).
- Produces, for Tasks 2–8:
  - `public.ea_live.rtk_meeting_id text`, `.mode text not null default 'stream' check (mode in ('stream','meeting'))`, `.rtk_session_id text`, `.rtk_started_at timestamptz` — same four on `public.ea_opil_sessions`.
  - `public.ea_rtk_participants(meeting_id text, user_id uuid, participant_id text, preset_name text, created_at timestamptz, last_token_at timestamptz)` primary key `(meeting_id, user_id)`.
  - `public.ea_rtk_events(id text primary key, webhook_id text, event text, meeting_id text, session_id text, payload jsonb, received_at timestamptz, handled_at timestamptz, error text)`.
  - `public.ea_rtk_artifacts(id uuid, meeting_id text, session_id text, room text, ref text, kind text, provider_id text, status text, url text, expires_at timestamptz, text text, data jsonb, meta jsonb, created_at, updated_at)` with unique indexes `ea_rtk_artifacts_recording_idx (provider_id) where kind='recording' and provider_id is not null`, `ea_rtk_artifacts_session_kind_idx (session_id, kind) where session_id is not null and kind <> 'recording'`, `ea_rtk_artifacts_room_ref_kind_idx (room, ref, kind) where session_id is null and kind <> 'recording'`.
  - `public.ea_rtk_upsert_artifact(p jsonb) returns uuid` — `security definer`, execute granted to `service_role` only. The **only** way anything writes `ea_rtk_artifacts`: it repeats each partial unique index's predicate in its own `on conflict … where …`, which PostgREST's `onConflict=` parameter cannot express (`ON CONFLICT (cols)` with no `WHERE` raises `42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification` against all three indexes). Tasks 4 and 5 call it with `admin.rpc('ea_rtk_upsert_artifact', { p: row })` and never `.upsert()`.
  - `public.ea_rtk_session_notes(p_room text, p_ref text) returns jsonb` — execute granted to `authenticated` only.
  - `public.ea_rtk_guard_server_columns()` trigger function + triggers `ea_live_rtk_guard`, `ea_opil_sessions_rtk_guard`. `mode` is a one-way door for clients: `'stream'` is always accepted, `'meeting'` is always `42501`.

- [ ] **Step 1: Write the failing test — the RLS attack script**

Create `/Users/nelsontaylor/taylormade-academy/scripts/rtk-rls-attacks.sh`:

```bash
#!/usr/bin/env bash
# Attack list for migration 0029. Every locked column must reject an admin write with 42501;
# RLS must keep member/anon away from the rows entirely; the three ea_rtk_* tables and the
# artifact upsert RPC must be unreachable from any browser role; mode may only ever be handed
# BACK to 'stream' by a client.
# Spec: docs/superpowers/specs/2026-09-10-realtimekit-live-rooms-design.md §9, §12
#
# Needs in the shell: SB_ANON, SB_REST, SB_REF, SB_TOKEN, TMA_ADMIN_JWT, TMA_MEMBER_JWT
# Idempotent: it purges its own throwaway rows before seeding them, so it can be re-run after
# every block of the migration. Everything it creates is zz-test-* / ea_opil_sessions.no 9098-9099
# and is deleted again by Task 1 Step 11.
set -uo pipefail
: "${SB_ANON:?}" "${SB_REST:?}" "${SB_REF:?}" "${SB_TOKEN:?}" "${TMA_ADMIN_JWT:?}" "${TMA_MEMBER_JWT:?}"

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); printf 'PASS  %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); printf 'FAIL  %s  %s\n' "$1" "$2"; }

# one statement as the service role, through the Management API
sql() {
  curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
    -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
    --data-binary "$(printf '%s' "$1" | jq -Rs '{query: .}')" 2>&1
}

# one PostgREST call as a browser role
call() {
  local jwt="$1"; shift
  curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $jwt" \
       -H "Content-Type: application/json" -H "Prefer: return=representation" "$@" 2>&1
}

# req <label> <expect: 42501|denied|ok> <jwt> <curl args...>
req() {
  local label="$1" expect="$2" jwt="$3"; shift 3
  local out got="ok"
  out="$(call "$jwt" "$@")"
  case "$out" in
    # ORDER MATTERS. A table-grant refusal comes back as
    #   {"code":"42501","message":"permission denied for table ea_rtk_events"}
    # and carries BOTH markers, so "permission denied" has to be matched FIRST or every
    # ea_rtk_* case would be misread as a trigger rejection. The guard trigger's own raise
    # says "<column> is set by the server" and therefore lands on the 42501 arm.
    *'permission denied'*) got="denied" ;;
    *'"code":"42501"'*)    got="42501" ;;
    *'"code":'*)           got="other:$(printf '%s' "$out" | head -c 160)" ;;
  esac
  if [ "$got" = "$expect" ]; then pass "$label"; else fail "$label" "(expected $expect, got $got)"; fi
}

# a write we expect RLS to swallow silently — no assertion, the row check below is the assertion
try() { call "$1" "${@:2}" >/dev/null 2>&1 || true; }

# unchanged <label> <table> <keycol> <keyval-sql>
unchanged() {
  local label="$1" t="$2" k="$3" v="$4" out
  out="$(sql "select rtk_meeting_id, mode, rtk_session_id, rtk_started_at from public.$t where $k = $v;")"
  case "$out" in
    *'"rtk_meeting_id":null'*'"mode":"stream"'*'"rtk_session_id":null'*'"rtk_started_at":null'*) pass "$label" ;;
    *) fail "$label" "row now reads $out" ;;
  esac
}

# ---------------------------------------------------------------- 0. purge (each on its own request,
# so a relation that does not exist yet only fails its own call)
sql "delete from public.ea_opil_sessions where no in (9098, 9099);" >/dev/null
sql "delete from public.ea_live where title like 'zz-test-%';"      >/dev/null
sql "delete from public.ea_rtk_artifacts where ref in ('9098','9099');" >/dev/null 2>&1 || true

# ---------------------------------------------------------------- 1. seeds (2 assertions)
LIVE_ID="$(call "$TMA_ADMIN_JWT" -X POST "$SB_REST/ea_live" \
  -d '{"title":"zz-test-rtk","is_live":false,"access":"members"}' | jq -r '.[0].id // empty')"
case "$LIVE_ID" in
  ????????-????-????-????-????????????) pass "seeded ea_live $LIVE_ID" ;;
  *) fail "seed ea_live" "no id came back — fix the admin JWT before reading anything else"
     echo "----- $PASS passed, $FAIL failed -----"; exit 1 ;;
esac
req "admin INSERT ea_opil_sessions clean (no locked column)" ok "$TMA_ADMIN_JWT" \
  -X POST "$SB_REST/ea_opil_sessions" -d '{"no":9098,"kind":"thread","title":"zz-test-rtk"}'

# ---------------------------------------------------------------- 2. admin UPDATE of a locked column -> 42501 (8)
for col in '{"rtk_meeting_id":"zz-test-m"}' '{"mode":"meeting"}' '{"rtk_session_id":"zz-test-s"}' '{"rtk_started_at":"2026-01-01T00:00:00Z"}'; do
  req "admin PATCH ea_live $col"          42501 "$TMA_ADMIN_JWT" -X PATCH "$SB_REST/ea_live?id=eq.$LIVE_ID" -d "$col"
  req "admin PATCH ea_opil_sessions $col" 42501 "$TMA_ADMIN_JWT" -X PATCH "$SB_REST/ea_opil_sessions?no=eq.9098" -d "$col"
done

# ---------------------------------------------------------------- 3. mode is a ONE-WAY door (2)
# The broadcast Go live / End payload carries mode:'stream' (Task 7 Step 9, Task 8 Step 4b),
# which is the only way a row stuck at 'meeting' gets handed back to broadcast. It must pass.
req "admin PATCH ea_live mode=stream (allowed)"          ok "$TMA_ADMIN_JWT" -X PATCH "$SB_REST/ea_live?id=eq.$LIVE_ID" -d '{"mode":"stream"}'
req "admin PATCH ea_opil_sessions mode=stream (allowed)" ok "$TMA_ADMIN_JWT" -X PATCH "$SB_REST/ea_opil_sessions?no=eq.9098" -d '{"mode":"stream"}'

# ---------------------------------------------------------------- 4. member / anon never reach the trigger (2)
# ea_live_admin_write (0023:66-68), sess_admin (0013:143) and sess_fac_update (0018:112) are the
# only UPDATE policies, all `to authenticated` and admin/facilitator-scoped, so a member or anon
# UPDATE matches ZERO rows and PostgREST answers 200 with []. RLS filters rows BEFORE a
# BEFORE-UPDATE trigger fires, so there is no 42501 to assert here — the assertion is that
# nothing moved.
for col in '{"rtk_meeting_id":"zz-test-m"}' '{"mode":"meeting"}' '{"rtk_session_id":"zz-test-s"}' '{"rtk_started_at":"2026-01-01T00:00:00Z"}'; do
  for jwt in "$TMA_MEMBER_JWT" "$SB_ANON"; do
    try "$jwt" -X PATCH "$SB_REST/ea_live?id=eq.$LIVE_ID"        -d "$col"
    try "$jwt" -X PATCH "$SB_REST/ea_opil_sessions?no=eq.9098"   -d "$col"
  done
done
unchanged "ea_live survived 8 member/anon writes untouched"          ea_live          id "'$LIVE_ID'::uuid"
unchanged "ea_opil_sessions survived 8 member/anon writes untouched" ea_opil_sessions no 9098

# ---------------------------------------------------------------- 5. INSERT carrying a locked column (4)
req "admin INSERT ea_live with rtk_meeting_id" 42501 "$TMA_ADMIN_JWT" \
  -X POST "$SB_REST/ea_live" -d '{"title":"zz-test-rtk-ins","is_live":false,"rtk_meeting_id":"zz-test-m"}'
req "admin INSERT ea_opil_sessions with mode=meeting" 42501 "$TMA_ADMIN_JWT" \
  -X POST "$SB_REST/ea_opil_sessions" -d '{"no":9099,"kind":"thread","title":"zz-test-rtk","mode":"meeting"}'
req "admin INSERT ea_opil_sessions with rtk_meeting_id" 42501 "$TMA_ADMIN_JWT" \
  -X POST "$SB_REST/ea_opil_sessions" -d '{"no":9099,"kind":"thread","title":"zz-test-rtk","rtk_meeting_id":"zz-test-m"}'
req "admin PATCH ea_opil_sessions title (a normal write still works)" ok "$TMA_ADMIN_JWT" \
  -X PATCH "$SB_REST/ea_opil_sessions?no=eq.9098" -d '{"title":"zz-test-rtk-2"}'

# ---------------------------------------------------------------- 6. the three service-role tables (9)
for t in ea_rtk_participants ea_rtk_events ea_rtk_artifacts; do
  req "admin SELECT $t" denied "$TMA_ADMIN_JWT" "$SB_REST/$t?select=*&limit=1"
  req "anon  SELECT $t" denied "$SB_ANON"       "$SB_REST/$t?select=*&limit=1"
  req "admin INSERT $t" denied "$TMA_ADMIN_JWT" -X POST "$SB_REST/$t" -d '{}'
done

# ---------------------------------------------------------------- 7. the artifact upsert RPC (2)
ART='{"p":{"meeting_id":"zz-test","room":"opil","ref":"9098","kind":"summary","status":"ready"}}'
req "admin RPC ea_rtk_upsert_artifact" denied "$TMA_ADMIN_JWT" -X POST "$SB_REST/rpc/ea_rtk_upsert_artifact" -d "$ART"
req "anon  RPC ea_rtk_upsert_artifact" denied "$SB_ANON"       -X POST "$SB_REST/rpc/ea_rtk_upsert_artifact" -d "$ART"

# ---------------------------------------------------------------- 8. the teaser view (1)
V="$(curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" "$SB_REST/ea_live_upcoming?select=*&limit=1")"
case "$V" in
  *rtk_meeting_id*|*'"mode"'*) fail "ea_live_upcoming has no server column" "it leaks one: $V" ;;
  *) pass "ea_live_upcoming has no server column" ;;
esac

# ---------------------------------------------------------------- 9. the notes RPC (2)
N="$(call "$TMA_MEMBER_JWT" -X POST "$SB_REST/rpc/ea_rtk_session_notes" -d '{"p_room":"opil","p_ref":"9098"}')"
case "$N" in
  null) pass "ea_rtk_session_notes -> null for a member" ;;
  *) fail "ea_rtk_session_notes for a member" "returned $N" ;;
esac
A="$(call "$TMA_ADMIN_JWT" -X POST "$SB_REST/rpc/ea_rtk_session_notes" -d '{"p_room":"academy","p_ref":"'"$LIVE_ID"'"}')"
case "$A" in
  *'"recordings"'*) pass "ea_rtk_session_notes -> an object for an Academy admin" ;;
  *) fail "ea_rtk_session_notes for an admin" "returned $A" ;;
esac

echo "LIVE_ID=$LIVE_ID"
echo "----- $PASS passed, $FAIL failed -----"
[ "$FAIL" -eq 0 ]
```

```bash
chmod +x /Users/nelsontaylor/taylormade-academy/scripts/rtk-rls-attacks.sh
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && ./scripts/rtk-rls-attacks.sh; echo "exit=$?"`
Expected: `----- 4 passed, 28 failed -----` and `exit=1`. The four passes are `seeded ea_live <uuid>`, `admin INSERT ea_opil_sessions clean`, `ea_live_upcoming has no server column` and `admin PATCH ea_opil_sessions title` (a normal write on a `0013` column the migration never touches) — none of them touches anything `0029` adds. Every locked-column line reports `other:…could not find the 'rtk_meeting_id' column…`, the `unchanged` lines report a missing-column error, the six `ea_rtk_*` lines report a missing relation, and both RPC groups report `PGRST202`.

- [ ] **Step 3: Write blocks 1 and 2 of the migration — the four columns and the guard trigger**

Create `/Users/nelsontaylor/taylormade-academy/supabase/migrations/0029_realtimekit_rooms.sql`:

```sql
-- 0029_realtimekit_rooms.sql
-- RealtimeKit rooms: meeting id + mode on the two room rows (server-written), three
-- service-role tables, one admin RPC. Additive. Safe to re-run.

-- ---------------------------------------------------------------- 1. rooms learn their meeting
alter table public.ea_live
  add column if not exists rtk_meeting_id text,
  add column if not exists mode text not null default 'stream',
  add column if not exists rtk_session_id text,          -- active session pinned by ea-rtk-host start / meeting.started
  add column if not exists rtk_started_at timestamptz;   -- when start last ran; the meeting.ended fallback reads it
alter table public.ea_live drop constraint if exists ea_live_mode_chk;
alter table public.ea_live add constraint ea_live_mode_chk check (mode in ('stream','meeting'));
create unique index if not exists ea_live_rtk_meeting_idx
  on public.ea_live (rtk_meeting_id) where rtk_meeting_id is not null;

alter table public.ea_opil_sessions
  add column if not exists rtk_meeting_id text,
  add column if not exists mode text not null default 'stream',
  add column if not exists rtk_session_id text,
  add column if not exists rtk_started_at timestamptz;
alter table public.ea_opil_sessions drop constraint if exists ea_opil_sessions_mode_chk;
alter table public.ea_opil_sessions add constraint ea_opil_sessions_mode_chk check (mode in ('stream','meeting'));
create unique index if not exists ea_opil_sessions_rtk_meeting_idx
  on public.ea_opil_sessions (rtk_meeting_id) where rtk_meeting_id is not null;
-- Existing columns reused: ea_live.replay_url, ea_live.stream_url, ea_opil_sessions.recording_url,
-- ea_opil_sessions.stream_url, is_live on both. New columns inherit table RLS: members/cohort can
-- READ rtk_meeting_id (useless without a token), mode (the page needs it), rtk_session_id and
-- rtk_started_at (harmless; the page ignores both).

-- ---------------------------------------------------------------- 2. lock the four server columns from clients
-- Why a trigger and not a column-level REVOKE: Supabase's default privileges grant authenticated
-- table-level UPDATE, and Postgres says "granting the privilege at the table level and then revoking
-- it for one column will not do what one might wish". sess_fac_update (0018) lets a facilitator update
-- any column of their own sessions and ea_live_admin_write is FOR ALL, so without this a client could
-- clobber or NULL the meeting id and the join function's "WHERE rtk_meeting_id IS NULL" claim would no
-- longer be the only writer. INSERT is guarded too: on INSERT there is no OLD row, so the baseline is
-- the column default.
create or replace function public.ea_rtk_guard_server_columns() returns trigger
language plpgsql as $$
declare
  old_id      text;
  old_mode    text;
  old_sid     text;
  old_started timestamptz;
begin
  if current_user in ('authenticated', 'anon') then
    old_id      := case when tg_op = 'INSERT' then null     else old.rtk_meeting_id end;
    old_mode    := case when tg_op = 'INSERT' then 'stream' else old.mode           end;  -- the column default
    old_sid     := case when tg_op = 'INSERT' then null     else old.rtk_session_id end;
    old_started := case when tg_op = 'INSERT' then null     else old.rtk_started_at end;
    if new.rtk_meeting_id is distinct from old_id then
      raise exception 'rtk_meeting_id is set by the server' using errcode = '42501';
    end if;
    -- mode is the ONE column a client may move, and only in one direction: back to
    -- 'stream'. The broadcast Go live / End payload carries mode = 'stream' (opil
    -- flipLive, academy setLive) so a room left at 'meeting' by a missed meeting.ended
    -- can never strand the next broadcast in room mode. 'meeting' stays the server's word.
    if new.mode is distinct from old_mode and new.mode is distinct from 'stream' then
      raise exception 'mode is set by the server' using errcode = '42501';
    end if;
    if new.rtk_session_id is distinct from old_sid then
      raise exception 'rtk_session_id is set by the server' using errcode = '42501';
    end if;
    if new.rtk_started_at is distinct from old_started then
      raise exception 'rtk_started_at is set by the server' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ea_live_rtk_guard on public.ea_live;
create trigger ea_live_rtk_guard before insert or update on public.ea_live
  for each row execute function public.ea_rtk_guard_server_columns();
drop trigger if exists ea_opil_sessions_rtk_guard on public.ea_opil_sessions;
create trigger ea_opil_sessions_rtk_guard before insert or update on public.ea_opil_sessions
  for each row execute function public.ea_rtk_guard_server_columns();
-- PostgREST switches to the JWT's role with SET LOCAL ROLE, so current_user is 'authenticated' /
-- 'anon' for page traffic and 'service_role' for the edge functions. ea-rtk-host start sets
-- mode='meeting'; ea-rtk-host end_session and the meeting.ended webhook reset 'stream'; broadcast
-- Go live / End send mode='stream' with their own payload (permitted above), and a client insert
-- without mode gets the default 'stream', which the INSERT baseline accepts.
```

- [ ] **Step 4: Apply blocks 1–2 to the production project**

```bash
cd /Users/nelsontaylor/taylormade-academy
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(jq -Rs '{query: .}' < supabase/migrations/0029_realtimekit_rooms.sql)"
```
Expected: `[]` (a DDL batch returns no rows). Anything containing `"message"` is an error — read it and fix the SQL before continuing.

- [ ] **Step 5: Re-run the attacks — the column and trigger cases must now pass**

Run: `cd /Users/nelsontaylor/taylormade-academy && ./scripts/rtk-rls-attacks.sh; echo "exit=$?"`
Expected: `----- 19 passed, 13 failed -----` and `exit=1`. Sections 1–5 (the seeds, the eight admin locked-column PATCHes, the two `mode=stream` writes, the two `unchanged` checks, the four INSERT cases) and section 8 all read `PASS`. The 13 remaining `FAIL` lines are the nine `ea_rtk_*` table lines, the two `ea_rtk_upsert_artifact` lines and the two `ea_rtk_session_notes` lines — none of those relations or functions exists yet.

- [ ] **Step 6: Append blocks 3–5b — the three service-role tables and the artifact upsert RPC**

Append to `/Users/nelsontaylor/taylormade-academy/supabase/migrations/0029_realtimekit_rooms.sql`:

```sql

-- ---------------------------------------------------------------- 3. participants we already added
create table if not exists public.ea_rtk_participants (
  meeting_id     text not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  participant_id text not null,
  preset_name    text not null check (preset_name in
                   ('tma-webinar-host','tma-webinar-member','opil-host','opil-student','opil-judge')),
  created_at     timestamptz not null default now(),
  last_token_at  timestamptz,
  primary key (meeting_id, user_id)
);
alter table public.ea_rtk_participants enable row level security;   -- no policies: service role only
revoke all on table public.ea_rtk_participants from anon, authenticated, public;

-- ---------------------------------------------------------------- 4. webhook idempotency + audit
create table if not exists public.ea_rtk_events (
  id          text primary key,                 -- rtk-uuid delivery id
  webhook_id  text,                             -- rtk-webhook-id
  event       text not null,
  meeting_id  text,
  session_id  text,
  payload     jsonb not null,                   -- streamKey redacted before insert
  received_at timestamptz not null default now(),
  handled_at  timestamptz,
  error       text
);
create index if not exists ea_rtk_events_meeting_idx on public.ea_rtk_events (meeting_id, received_at desc);
alter table public.ea_rtk_events enable row level security;
revoke all on table public.ea_rtk_events from anon, authenticated, public;

-- ---------------------------------------------------------------- 5. artifacts (content, never expiring links)
create table if not exists public.ea_rtk_artifacts (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  text not null,
  session_id  text,
  room        text not null check (room in ('academy','opil')),
  ref         text not null,                    -- ea_live.id::text or ea_opil_sessions.no::text
  kind        text not null check (kind in ('recording','transcript','summary','playbook')),
  provider_id text,                             -- recording id for kind='recording'
  status      text,                             -- recording: INVOKED|RECORDING|UPLOADING|UPLOADED|ERRORED; transcript/summary: pending|ready; playbook: pending|draft
  url         text,                             -- Stream /watch URL for recordings
  expires_at  timestamptz,                      -- downloadUrlExpiry / transcript expiry
  text        text,                             -- CSV transcript, summary markdown, playbook markdown
  data        jsonb,                            -- JSON transcript
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists ea_rtk_artifacts_recording_idx
  on public.ea_rtk_artifacts (provider_id) where kind = 'recording' and provider_id is not null;
create unique index if not exists ea_rtk_artifacts_session_kind_idx
  on public.ea_rtk_artifacts (session_id, kind) where session_id is not null and kind <> 'recording';
create index if not exists ea_rtk_artifacts_room_idx on public.ea_rtk_artifacts (room, ref, kind);
-- Playbook/transcript/summary artifacts key on (room, ref) when the webhook envelope carries no
-- session id: one of each per room in that case. Recordings are excluded — a meeting can
-- legitimately produce several and they are keyed by provider_id above.
create unique index if not exists ea_rtk_artifacts_room_ref_kind_idx
  on public.ea_rtk_artifacts (room, ref, kind) where session_id is null and kind <> 'recording';
-- Every webhook write to this table is an UPSERT on one of the three partial keys above, never a
-- bare insert, so a 503 from us + a RealtimeKit retry re-runs the same event onto the same row.
-- Postgres only infers a partial unique index when ON CONFLICT repeats its predicate.
alter table public.ea_rtk_artifacts enable row level security;
revoke all on table public.ea_rtk_artifacts from anon, authenticated, public;

-- --------------------------------------------------------------- 5b. the ONLY writer of block 5
-- PostgREST's `onConflict=` emits `ON CONFLICT (cols)` with NO predicate, so
-- `.upsert(row, { onConflict: 'provider_id' })` fails against every index above with
--   42P10  there is no unique or exclusion constraint matching the ON CONFLICT specification
-- This definer function repeats each predicate verbatim, so ea-rtk-host and ea-rtk-webhook
-- call it instead of .upsert(). Content columns are COALESCEd so the "pending" claim that
-- precedes each real write never blanks an earlier body; status/meta/updated_at are assigned.
create or replace function public.ea_rtk_upsert_artifact(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_kind text := p->>'kind';
  v_sid  text := nullif(p->>'session_id', '');
begin
  if v_kind = 'recording' then
    insert into ea_rtk_artifacts (meeting_id, session_id, room, ref, kind, provider_id, status, url, expires_at, text, data, meta, updated_at)
    values (p->>'meeting_id', v_sid, p->>'room', p->>'ref', v_kind, nullif(p->>'provider_id',''), p->>'status',
            p->>'url', (p->>'expires_at')::timestamptz, p->>'text', p->'data', coalesce(p->'meta', '{}'::jsonb), now())
    on conflict (provider_id) where kind = 'recording' and provider_id is not null
    do update set session_id  = coalesce(excluded.session_id, ea_rtk_artifacts.session_id),
                  status      = excluded.status,
                  url         = coalesce(excluded.url, ea_rtk_artifacts.url),
                  expires_at  = coalesce(excluded.expires_at, ea_rtk_artifacts.expires_at),
                  text        = coalesce(excluded.text, ea_rtk_artifacts.text),
                  data        = coalesce(excluded.data, ea_rtk_artifacts.data),
                  meta        = excluded.meta,
                  updated_at  = now()
    returning id into v_id;
  elsif v_sid is not null then
    insert into ea_rtk_artifacts (meeting_id, session_id, room, ref, kind, provider_id, status, url, expires_at, text, data, meta, updated_at)
    values (p->>'meeting_id', v_sid, p->>'room', p->>'ref', v_kind, nullif(p->>'provider_id',''), p->>'status',
            p->>'url', (p->>'expires_at')::timestamptz, p->>'text', p->'data', coalesce(p->'meta', '{}'::jsonb), now())
    on conflict (session_id, kind) where session_id is not null and kind <> 'recording'
    do update set status     = excluded.status,
                  url        = coalesce(excluded.url, ea_rtk_artifacts.url),
                  expires_at = coalesce(excluded.expires_at, ea_rtk_artifacts.expires_at),
                  text       = coalesce(excluded.text, ea_rtk_artifacts.text),
                  data       = coalesce(excluded.data, ea_rtk_artifacts.data),
                  meta       = excluded.meta,
                  updated_at = now()
    returning id into v_id;
  else
    insert into ea_rtk_artifacts (meeting_id, session_id, room, ref, kind, provider_id, status, url, expires_at, text, data, meta, updated_at)
    values (p->>'meeting_id', null, p->>'room', p->>'ref', v_kind, nullif(p->>'provider_id',''), p->>'status',
            p->>'url', (p->>'expires_at')::timestamptz, p->>'text', p->'data', coalesce(p->'meta', '{}'::jsonb), now())
    on conflict (room, ref, kind) where session_id is null and kind <> 'recording'
    do update set status     = excluded.status,
                  url        = coalesce(excluded.url, ea_rtk_artifacts.url),
                  expires_at = coalesce(excluded.expires_at, ea_rtk_artifacts.expires_at),
                  text       = coalesce(excluded.text, ea_rtk_artifacts.text),
                  data       = coalesce(excluded.data, ea_rtk_artifacts.data),
                  meta       = excluded.meta,
                  updated_at = now()
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.ea_rtk_upsert_artifact(jsonb) from public, anon, authenticated;
grant execute on function public.ea_rtk_upsert_artifact(jsonb) to service_role;
```

- [ ] **Step 7: Apply and re-run the attacks — the table and upsert-RPC cases must now pass**

```bash
cd /Users/nelsontaylor/taylormade-academy
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(jq -Rs '{query: .}' < supabase/migrations/0029_realtimekit_rooms.sql)"
./scripts/rtk-rls-attacks.sh; echo "exit=$?"
```
Expected: the query returns `[]`; the attack script prints `----- 30 passed, 2 failed -----` and `exit=1`. All nine `ea_rtk_*` table lines and both `ea_rtk_upsert_artifact` lines now read `PASS`. The only two remaining `FAIL` lines are the `ea_rtk_session_notes` pair — that function does not exist yet.

- [ ] **Step 8: Append block 6 — the admin read RPC**

Append to `/Users/nelsontaylor/taylormade-academy/supabase/migrations/0029_realtimekit_rooms.sql`:

```sql

-- ---------------------------------------------------------------- 6. host/coordinator read of the drafts
-- Definer: the tables above have no policies. Academy admins (ea_is_admin) read academy rows;
-- OPIL coordinators (ea_opil_is_admin) read every OPIL row; a facilitator reads only their
-- session_nos (ea_opil_fac_sessions, 0018). Judges and students get null.
create or replace function public.ea_rtk_session_notes(p_room text, p_ref text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when (p_room = 'academy' and public.ea_is_admin())
      or (p_room = 'opil' and (public.ea_opil_is_admin(auth.uid())
            or (p_ref ~ '^\d+$' and p_ref::int = any(public.ea_opil_fac_sessions(auth.uid())))))
    then jsonb_build_object(
      'summary',    (select text   from ea_rtk_artifacts where room = p_room and ref = p_ref and kind = 'summary'    order by created_at desc limit 1),
      'playbook',   (select text   from ea_rtk_artifacts where room = p_room and ref = p_ref and kind = 'playbook'   order by created_at desc limit 1),
      'playbook_status', (select status from ea_rtk_artifacts where room = p_room and ref = p_ref and kind = 'playbook' order by created_at desc limit 1),
      'transcript', (select text   from ea_rtk_artifacts where room = p_room and ref = p_ref and kind = 'transcript' order by created_at desc limit 1),
      'recordings', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'url', url, 'expires_at', expires_at,
                                 'expired', coalesce(expires_at < now(), false),   -- computed here; no row ever carries an EXPIRED status
                                 'meta', meta) order by created_at desc)
                               from ea_rtk_artifacts where room = p_room and ref = p_ref and kind = 'recording'), '[]'::jsonb))
    else null end;
$$;
revoke all on function public.ea_rtk_session_notes(text, text) from public, anon;
grant execute on function public.ea_rtk_session_notes(text, text) to authenticated;

select 'realtimekit rooms ready' as status;
```

- [ ] **Step 9: Apply and re-run the attacks — everything must pass**

```bash
cd /Users/nelsontaylor/taylormade-academy
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(jq -Rs '{query: .}' < supabase/migrations/0029_realtimekit_rooms.sql)"
./scripts/rtk-rls-attacks.sh; echo "exit=$?"
```
Expected: the query returns `[{"status":"realtimekit rooms ready"}]`; the attack script ends with `----- 32 passed, 0 failed -----` and `exit=0`. Note the printed `LIVE_ID=<uuid>` — Step 11 deletes it.

- [ ] **Step 10: Verify the service role CAN write the locked columns**

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"update public.ea_opil_sessions set rtk_meeting_id = '\''zz-test-meeting'\'', mode = '\''meeting'\'', rtk_session_id = '\''zz-test-sess'\'', rtk_started_at = now() where no = 9098 returning no, rtk_meeting_id, mode, rtk_session_id;"}'
```
Expected: `[{"no":9098,"rtk_meeting_id":"zz-test-meeting","mode":"meeting","rtk_session_id":"zz-test-sess"}]` — the trigger lets `postgres`/`service_role` through, which is what every edge function relies on.

That call runs as `postgres` through the management API. Every edge function instead writes as `service_role` through PostgREST, and the trigger's `current_user in ('authenticated','anon')` test must let that through too — so prove it the way the functions actually do it:

```bash
# SUPABASE_SERVICE_ROLE_KEY: Supabase dashboard → Project Settings → API → service_role (secret)
curl -sS -X PATCH "https://pgqdmnmessbbzyszjfvr.supabase.co/rest/v1/ea_opil_sessions?no=eq.9098" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"rtk_session_id":"zz-test-sess-postgrest"}'
```

Expected: `200` with the row echoed back and `"rtk_session_id":"zz-test-sess-postgrest"`. A `403` or a trigger exception here means the guard is too broad and every edge function would fail in production — fix the trigger before continuing.

- [ ] **Step 10b: Verify `ea_rtk_upsert_artifact` hits all three partial indexes and is idempotent**

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select public.ea_rtk_upsert_artifact('\''{\"meeting_id\":\"zz-test-m\",\"room\":\"opil\",\"ref\":\"9098\",\"kind\":\"recording\",\"provider_id\":\"zz-test-r1\",\"status\":\"RECORDING\"}'\''::jsonb); select public.ea_rtk_upsert_artifact('\''{\"meeting_id\":\"zz-test-m\",\"room\":\"opil\",\"ref\":\"9098\",\"kind\":\"recording\",\"provider_id\":\"zz-test-r1\",\"status\":\"UPLOADED\",\"url\":\"https://x/watch\"}'\''::jsonb); select public.ea_rtk_upsert_artifact('\''{\"meeting_id\":\"zz-test-m\",\"session_id\":\"zz-test-s1\",\"room\":\"opil\",\"ref\":\"9098\",\"kind\":\"summary\",\"status\":\"pending\"}'\''::jsonb); select public.ea_rtk_upsert_artifact('\''{\"meeting_id\":\"zz-test-m\",\"session_id\":\"zz-test-s1\",\"room\":\"opil\",\"ref\":\"9098\",\"kind\":\"summary\",\"status\":\"ready\",\"text\":\"hello\"}'\''::jsonb); select public.ea_rtk_upsert_artifact('\''{\"meeting_id\":\"zz-test-m\",\"room\":\"opil\",\"ref\":\"9098\",\"kind\":\"playbook\",\"status\":\"draft\",\"text\":\"# draft\"}'\''::jsonb); select kind, status, url, text, session_id from public.ea_rtk_artifacts where ref = '\''9098'\'' order by kind;"}'
```
Expected: the last statement returns exactly three rows —
`{"kind":"playbook","status":"draft","url":null,"text":"# draft","session_id":null}`,
`{"kind":"recording","status":"UPLOADED","url":"https://x/watch","text":null,"session_id":null}`,
`{"kind":"summary","status":"ready","url":null,"text":"hello","session_id":"zz-test-s1"}`.
Five calls, three rows: each partial index absorbed its own second write instead of raising `42P10`, and the `ready` write kept the row the `pending` claim created.

- [ ] **Step 11: Clean up every throwaway row**

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"delete from public.ea_rtk_artifacts where ref in ('\''9098'\'','\''9099'\'') or meeting_id like '\''zz-test%'\''; delete from public.ea_rtk_participants where meeting_id like '\''zz-test%'\''; delete from public.ea_opil_sessions where no in (9098, 9099); delete from public.ea_live where title like '\''zz-test-%'\''; select (select count(*) from public.ea_live where title like '\''zz-test-%'\'') as live_left, (select count(*) from public.ea_rtk_artifacts where ref in ('\''9098'\'','\''9099'\'')) as art_left;"}'
```
Expected: `[{"live_left":0,"art_left":0}]`.

- [ ] **Step 12: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/migrations/0029_realtimekit_rooms.sql scripts/rtk-rls-attacks.sh
git commit -m "feat(live): 0029 — RealtimeKit room columns, guard trigger, service-role tables, notes RPC"
```

---

## Task 2: `_shared/rtk.ts` — the Cloudflare RealtimeKit REST helper

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk.ts`
- Test: `/Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk_test.ts`

**Interfaces:**
- Consumes: Task 1's `rtk_meeting_id` column on both room tables (through the injected `MeetingIo`); function secrets `CF_ACCOUNT_ID`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN`.
- Produces, for Tasks 3–5:
  - `type Room = "academy" | "opil"`
  - `type RtkResult<T> = { status: number; ok: boolean; data: T | null; error: string | null }` — every call returns this and **never throws** on an HTTP error.
  - `type Meeting = { id: string; title?: string; status?: string }`
  - `type Participant = { id: string; token: string; custom_participant_id?: string; preset_name?: string; name?: string }`
  - `type ActiveSession = { id: string; live_participants?: number; minutes_consumed?: number; started_at?: string }`
  - `type Recording = { id: string; status?: string; download_url?: string; download_url_expiry?: string }`
  - `type RoomRow = { ref: string; title: string | null; is_live: boolean; mode: string; rtk_meeting_id: string | null; rtk_session_id: string | null; rtk_started_at: string | null; access: string | null }`
  - `function rtkConfigured(): boolean`
  - `function rtkBase(): string`
  - `function rtkFetch<T>(path: string, init?: RequestInit): Promise<RtkResult<T>>`
  - `function roomTable(room: Room): { table: string; key: string; replay: string }`
  - `const rtk: RtkApi` with `createMeeting(body) | getMeeting(id) | setMeetingStatus(id, status) | retireMeeting(id) | addParticipant(meetingId, body) | editParticipantPreset(meetingId, participantId, presetName) | refreshParticipantToken(meetingId, participantId) | getActiveSession(meetingId) | kickAll(meetingId) | startRecording(body) | getActiveRecording(meetingId) | stopRecording(recordingId) | getSessionTranscript(sessionId)`
  - `type MeetingIo = { rtk: RtkApi; loadRow(room, ref): Promise<RoomRow | null>; claimMeetingId(room, ref, meetingId): Promise<boolean> }`
  - `function meetingTitle(room: Room, ref: string, title: string | null): string` — `"Academy Live — <title>"` / `"OPIL Session <ref> — <title>"`, title clipped to 120 chars, `"Live"` when null. `createOrGetMeeting` calls it; exported so a future task can reuse the same naming.
  - `function createOrGetMeeting(io: MeetingIo, room: Room, ref: string, row: RoomRow): Promise<{ meeting_id: string | null; error: string | null; status: number }>`

- [ ] **Step 1: Write the failing test**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk_test.ts`:

```ts
// deno test -A supabase/functions/_shared/rtk_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createOrGetMeeting, rtk, rtkBase, rtkConfigured, rtkFetch, roomTable } from "./rtk.ts";
import type { MeetingIo, RoomRow } from "./rtk.ts";

Deno.env.set("CF_ACCOUNT_ID", "acct1");
Deno.env.set("CF_RTK_APP_ID", "app1");
Deno.env.set("CF_RTK_API_TOKEN", "tok1");

type Call = { url: string; method: string; body: string | null; auth: string | null };
function stubFetch(replies: Array<{ status: number; json: unknown } | Error>) {
  const calls: Call[] = [];
  let i = 0;
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const req = init || {};
    calls.push({
      url: String(input),
      method: String(req.method || "GET"),
      body: typeof req.body === "string" ? req.body : null,
      auth: new Headers(req.headers).get("authorization"),
    });
    const r = replies[Math.min(i++, replies.length - 1)];
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status }));
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

Deno.test("rtkConfigured and rtkBase read the three secrets", () => {
  assertEquals(rtkConfigured(), true);
  assertEquals(rtkBase(), "https://api.cloudflare.com/client/v4/accounts/acct1/realtime/kit/app1");
});

Deno.test("roomTable maps both rooms", () => {
  assertEquals(roomTable("academy"), { table: "ea_live", key: "id", replay: "replay_url" });
  assertEquals(roomTable("opil"), { table: "ea_opil_sessions", key: "no", replay: "recording_url" });
});

Deno.test("rtkFetch unwraps data, then result, and sends the bearer", async () => {
  const s = stubFetch([{ status: 200, json: { success: true, data: { id: "m1" } } }]);
  const a = await rtkFetch<{ id: string }>("/meetings/m1");
  s.restore();
  assertEquals(a.ok, true);
  assertEquals(a.status, 200);
  assertEquals(a.data, { id: "m1" });
  assertEquals(s.calls[0].auth, "Bearer tok1");
  assertEquals(s.calls[0].url, "https://api.cloudflare.com/client/v4/accounts/acct1/realtime/kit/app1/meetings/m1");

  const s2 = stubFetch([{ status: 200, json: { success: true, result: { uid: "v1" } } }]);
  const b = await rtkFetch<{ uid: string }>("/anything");
  s2.restore();
  assertEquals(b.data, { uid: "v1" });
});

Deno.test("rtkFetch maps a non-2xx to cloudflare_<status> and never throws", async () => {
  const s = stubFetch([{ status: 404, json: { success: false, errors: [{ message: "not found" }] } }]);
  const r = await rtkFetch("/meetings/nope");
  s.restore();
  assertEquals(r.ok, false);
  assertEquals(r.status, 404);
  assertEquals(r.error, "cloudflare_404");
  assertEquals(r.data, null);
});

Deno.test("rtkFetch turns a network failure into cloudflare_network, never a throw", async () => {
  const s = stubFetch([new Error("boom")]);
  const r = await rtkFetch("/meetings/x");
  s.restore();
  assertEquals(r.status, 0);
  assertEquals(r.error, "cloudflare_network");
});

Deno.test("addParticipant posts the documented body", async () => {
  const s = stubFetch([{ status: 200, json: { success: true, data: { id: "p1", token: "t1" } } }]);
  const r = await rtk.addParticipant("m1", {
    custom_participant_id: "u1", preset_name: "opil-student", name: "Ava", picture: "https://x/y.png",
  });
  s.restore();
  assertEquals(r.data, { id: "p1", token: "t1" });
  assertEquals(s.calls[0].method, "POST");
  assertEquals(s.calls[0].url.endsWith("/meetings/m1/participants"), true);
  assertEquals(JSON.parse(s.calls[0].body!).custom_participant_id, "u1");
});

Deno.test("refreshParticipantToken posts with no body", async () => {
  const s = stubFetch([{ status: 200, json: { success: true, data: { token: "t2" } } }]);
  const r = await rtk.refreshParticipantToken("m1", "p1");
  s.restore();
  assertEquals(r.data, { token: "t2" });
  assertEquals(s.calls[0].url.endsWith("/meetings/m1/participants/p1/token"), true);
  assertEquals(s.calls[0].body, null);
});

Deno.test("stopRecording PUTs action stop; kickAll posts to active-session", async () => {
  const s = stubFetch([{ status: 200, json: { success: true, data: { id: "r1", status: "UPLOADING" } } }]);
  await rtk.stopRecording("r1");
  s.restore();
  assertEquals(s.calls[0].method, "PUT");
  assertEquals(JSON.parse(s.calls[0].body!), { action: "stop" });

  const s2 = stubFetch([{ status: 200, json: { success: true, data: { kicked_participants_count: 3 } } }]);
  const k = await rtk.kickAll("m1");
  s2.restore();
  assertEquals(s2.calls[0].url.endsWith("/meetings/m1/active-session/kick-all"), true);
  assertEquals((k.data as { kicked_participants_count: number }).kicked_participants_count, 3);
});

Deno.test("retireMeeting PATCHes status INACTIVE", async () => {
  const s = stubFetch([{ status: 200, json: { success: true, data: { id: "m9", status: "INACTIVE" } } }]);
  await rtk.retireMeeting("m9");
  s.restore();
  assertEquals(s.calls[0].method, "PATCH");
  assertEquals(JSON.parse(s.calls[0].body!), { status: "INACTIVE" });
});

const ROW: RoomRow = {
  ref: "3", title: "Open Payments", is_live: false, mode: "stream",
  rtk_meeting_id: null, rtk_session_id: null, rtk_started_at: null, access: null,
};

Deno.test("createOrGetMeeting returns the pinned id with no Cloudflare call", async () => {
  const s = stubFetch([{ status: 200, json: { success: true, data: { id: "never" } } }]);
  const io: MeetingIo = { rtk, loadRow: () => Promise.resolve(null), claimMeetingId: () => Promise.resolve(true) };
  const r = await createOrGetMeeting(io, "opil", "3", { ...ROW, rtk_meeting_id: "m-existing" });
  s.restore();
  assertEquals(r.meeting_id, "m-existing");
  assertEquals(s.calls.length, 0);
});

Deno.test("createOrGetMeeting creates, claims, and titles the meeting", async () => {
  const s = stubFetch([{ status: 200, json: { success: true, data: { id: "m-new" } } }]);
  const io: MeetingIo = { rtk, loadRow: () => Promise.resolve(null), claimMeetingId: () => Promise.resolve(true) };
  const r = await createOrGetMeeting(io, "opil", "3", ROW);
  s.restore();
  assertEquals(r.meeting_id, "m-new");
  const body = JSON.parse(s.calls[0].body!);
  assertEquals(body.title, "OPIL Session 3 — Open Payments");
  assertEquals(body.persist_chat, true);
  assertEquals(body.session_keep_alive_time_in_secs, 120);
  assertEquals(body.transcribe_on_end, true);
  assertEquals(body.summarize_on_end, true);
  assertEquals(body.ai_config.summarization.summary_type, "lecture");
});

Deno.test("createOrGetMeeting loses the race: retires its meeting and returns the winner", async () => {
  const s = stubFetch([
    { status: 200, json: { success: true, data: { id: "m-mine" } } },   // POST /meetings
    { status: 200, json: { success: true, data: { id: "m-mine", status: "INACTIVE" } } }, // PATCH retire
  ]);
  const io: MeetingIo = {
    rtk,
    loadRow: () => Promise.resolve({ ...ROW, rtk_meeting_id: "m-winner" }),
    claimMeetingId: () => Promise.resolve(false),
  };
  const r = await createOrGetMeeting(io, "opil", "3", ROW);
  s.restore();
  assertEquals(r.meeting_id, "m-winner");
  assertEquals(s.calls[1].method, "PATCH");
  assertEquals(s.calls[1].url.endsWith("/meetings/m-mine"), true);
});

Deno.test("createOrGetMeeting surfaces a Cloudflare failure as an error, not a throw", async () => {
  const s = stubFetch([{ status: 500, json: { success: false, errors: [] } }]);
  const io: MeetingIo = { rtk, loadRow: () => Promise.resolve(null), claimMeetingId: () => Promise.resolve(true) };
  const r = await createOrGetMeeting(io, "academy", "abc", { ...ROW, ref: "abc", title: "Class" });
  s.restore();
  assertEquals(r.meeting_id, null);
  assertEquals(r.error, "cloudflare_500");
  assertEquals(r.status, 502);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/_shared/rtk_test.ts`
Expected: FAIL — `error: Module not found "file:///…/supabase/functions/_shared/rtk.ts"`.

- [ ] **Step 3: Write the minimal implementation**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk.ts`:

```ts
// _shared/rtk.ts — the one place this project talks to Cloudflare RealtimeKit.
//
// Base URL: https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/realtime/kit/{CF_RTK_APP_ID}
// Auth:     Authorization: Bearer {CF_RTK_API_TOKEN}   (Realtime + Realtime Admin ONLY — never the
//           Stream:Edit CF_API_TOKEN, which the webhook uses for the Stream copy.)
//
// Every call returns { status, ok, data, error } and NEVER throws: a non-2xx becomes
// error "cloudflare_<status>", a network failure becomes status 0 / "cloudflare_network".
// Cloudflare's envelope is {success, data | result, errors}; we unwrap data, then result.
// Spec: docs/superpowers/specs/2026-09-10-realtimekit-live-rooms-design.md §5, §5.1

export type Room = "academy" | "opil";

export type RtkResult<T> = { status: number; ok: boolean; data: T | null; error: string | null };

export type Meeting = { id: string; title?: string; status?: string };
export type Participant = { id: string; token: string; custom_participant_id?: string; preset_name?: string; name?: string };
export type ActiveSession = { id: string; live_participants?: number; minutes_consumed?: number; started_at?: string };
export type Recording = { id: string; status?: string; download_url?: string; download_url_expiry?: string };

/** The room row both functions read. `ref` is ea_live.id or ea_opil_sessions.no as text. */
export type RoomRow = {
  ref: string;
  title: string | null;
  is_live: boolean;
  mode: string;
  rtk_meeting_id: string | null;
  rtk_session_id: string | null;
  rtk_started_at: string | null;
  access: string | null;      // ea_live only; null for OPIL
};

const CF_V4 = "https://api.cloudflare.com/client/v4";

export function rtkConfigured(): boolean {
  return !!(Deno.env.get("CF_ACCOUNT_ID") && Deno.env.get("CF_RTK_APP_ID") && Deno.env.get("CF_RTK_API_TOKEN"));
}

export function rtkBase(): string {
  return `${CF_V4}/accounts/${Deno.env.get("CF_ACCOUNT_ID")}/realtime/kit/${Deno.env.get("CF_RTK_APP_ID")}`;
}

export function roomTable(room: Room): { table: string; key: string; replay: string } {
  return room === "academy"
    ? { table: "ea_live", key: "id", replay: "replay_url" }
    : { table: "ea_opil_sessions", key: "no", replay: "recording_url" };
}

export async function rtkFetch<T>(path: string, init: RequestInit = {}): Promise<RtkResult<T>> {
  const url = rtkBase() + path;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${Deno.env.get("CF_RTK_API_TOKEN")}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  } catch (_e) {
    return { status: 0, ok: false, data: null, error: "cloudflare_network" };
  }
  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch (_e) { /* empty or non-JSON body */ }
  if (!res.ok) return { status: res.status, ok: false, data: null, error: `cloudflare_${res.status}` };
  const payload = (body.data ?? body.result ?? null) as T | null;
  return { status: res.status, ok: true, data: payload, error: null };
}

const J = (v: unknown) => JSON.stringify(v);

export type RtkApi = {
  createMeeting(body: Record<string, unknown>): Promise<RtkResult<Meeting>>;
  getMeeting(id: string): Promise<RtkResult<Meeting>>;
  setMeetingStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<RtkResult<Meeting>>;
  retireMeeting(id: string): Promise<RtkResult<Meeting>>;
  addParticipant(meetingId: string, body: Record<string, unknown>): Promise<RtkResult<Participant>>;
  editParticipantPreset(meetingId: string, participantId: string, presetName: string): Promise<RtkResult<Participant>>;
  refreshParticipantToken(meetingId: string, participantId: string): Promise<RtkResult<{ token: string }>>;
  getActiveSession(meetingId: string): Promise<RtkResult<ActiveSession>>;
  kickAll(meetingId: string): Promise<RtkResult<{ kicked_participants_count: number }>>;
  startRecording(body: Record<string, unknown>): Promise<RtkResult<Recording>>;
  getActiveRecording(meetingId: string): Promise<RtkResult<Recording>>;
  stopRecording(recordingId: string): Promise<RtkResult<Recording>>;
  getSessionTranscript(sessionId: string): Promise<RtkResult<unknown>>;
};

export const rtk: RtkApi = {
  createMeeting: (body) => rtkFetch<Meeting>("/meetings", { method: "POST", body: J(body) }),
  getMeeting: (id) => rtkFetch<Meeting>(`/meetings/${id}`),
  setMeetingStatus: (id, status) => rtkFetch<Meeting>(`/meetings/${id}`, { method: "PATCH", body: J({ status }) }),
  retireMeeting: (id) => rtk.setMeetingStatus(id, "INACTIVE"),
  addParticipant: (m, body) => rtkFetch<Participant>(`/meetings/${m}/participants`, { method: "POST", body: J(body) }),
  editParticipantPreset: (m, p, preset_name) =>
    rtkFetch<Participant>(`/meetings/${m}/participants/${p}`, { method: "PATCH", body: J({ preset_name }) }),
  refreshParticipantToken: (m, p) =>
    rtkFetch<{ token: string }>(`/meetings/${m}/participants/${p}/token`, { method: "POST" }),
  getActiveSession: (m) => rtkFetch<ActiveSession>(`/meetings/${m}/active-session`),
  kickAll: (m) => rtkFetch<{ kicked_participants_count: number }>(`/meetings/${m}/active-session/kick-all`, { method: "POST" }),
  startRecording: (body) => rtkFetch<Recording>("/recordings", { method: "POST", body: J(body) }),
  getActiveRecording: (m) => rtkFetch<Recording>(`/recordings/active-recording/${m}`),
  stopRecording: (id) => rtkFetch<Recording>(`/recordings/${id}`, { method: "PUT", body: J({ action: "stop" }) }),
  getSessionTranscript: (sid) => rtkFetch<unknown>(`/sessions/${sid}/transcript?format=JSON`),
};

/** Everything createOrGetMeeting needs from the database, so it can be unit-tested. */
export type MeetingIo = {
  rtk: RtkApi;
  loadRow(room: Room, ref: string): Promise<RoomRow | null>;
  /** UPDATE … SET rtk_meeting_id = $id WHERE <key> = $ref AND rtk_meeting_id IS NULL — true when it won. */
  claimMeetingId(room: Room, ref: string, meetingId: string): Promise<boolean>;
};

export function meetingTitle(room: Room, ref: string, title: string | null): string {
  const t = (title || "Live").slice(0, 120);
  return room === "academy" ? `Academy Live — ${t}` : `OPIL Session ${ref} — ${t}`;
}

/**
 * Hosts only. Returns the row's meeting id, creating one the first time.
 * The claim is race-safe: if another host won, ours is retired (PATCH status INACTIVE —
 * there is no DELETE meeting endpoint) and the winner's id is returned, so the loser's
 * join succeeds instead of erroring.
 */
export async function createOrGetMeeting(
  io: MeetingIo,
  room: Room,
  ref: string,
  row: RoomRow,
): Promise<{ meeting_id: string | null; error: string | null; status: number }> {
  if (row.rtk_meeting_id) return { meeting_id: row.rtk_meeting_id, error: null, status: 200 };

  const created = await io.rtk.createMeeting({
    title: meetingTitle(room, ref, row.title),
    persist_chat: true,
    session_keep_alive_time_in_secs: 120,
    transcribe_on_end: true,
    summarize_on_end: true,
    ai_config: {
      transcription: { language: "en-US", keywords: ["Interledger", "Open Payments", "Taylormade"], profanity_filter: false },
      summarization: { summary_type: "lecture", text_format: "markdown", word_limit: 500 },
    },
  });
  if (!created.ok || !created.data?.id) {
    return { meeting_id: null, error: created.error || "cloudflare_bad_shape", status: 502 };
  }
  const mine = created.data.id;

  if (await io.claimMeetingId(room, ref, mine)) {
    return { meeting_id: mine, error: null, status: 200 };
  }
  // Someone else claimed the row first. Retire ours and continue with theirs.
  const winner = await io.loadRow(room, ref);
  await io.rtk.retireMeeting(mine);
  if (winner?.rtk_meeting_id) return { meeting_id: winner.rtk_meeting_id, error: null, status: 200 };
  return { meeting_id: null, error: "claim_failed", status: 500 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/_shared/rtk_test.ts`
Expected: `ok | 13 passed | 0 failed`.

- [ ] **Step 5: Type-check the module on its own**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno check supabase/functions/_shared/rtk.ts`
Expected: `Check file:///…/rtk.ts` and no diagnostics.

- [ ] **Step 6: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/functions/_shared/rtk.ts supabase/functions/_shared/rtk_test.ts
git commit -m "feat(live): _shared/rtk.ts — typed Cloudflare RealtimeKit REST helper"
```

---

## Task 3: `ea-rtk-join` — role → preset → participant token

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/handler.ts`
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/index.ts`
- Test: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/handler_test.ts`

**Interfaces:**
- Consumes: `_shared/rtk.ts` (`Room`, `RoomRow`, `RtkApi`, `rtk`, `rtkConfigured`, `roomTable`, `createOrGetMeeting`, `MeetingIo`); Task 1's `ea_rtk_participants` table and the four server columns; existing RPCs `ea_is_admin()`, `ea_is_member()`, `ea_opil_my_role()`, `ea_opil_in_cohort()`.
- Produces, for Tasks 4 and 6:
  - `const ALLOWED_ORIGIN = "https://taylormadeacademy.com"`, `const CORS: Record<string,string>`, `function json(body: unknown, status?: number): Response` — the exact shapes copied from `ea-live-publish/index.ts:28-42`, re-exported from this handler so Tasks 4 and 5 can copy them verbatim.
  - `const PRESETS = ["tma-webinar-host","tma-webinar-member","opil-host","opil-student","opil-judge"] as const`
  - `type Preset = typeof PRESETS[number]`
  - `type JoinDeps = { configured(): boolean; getUser(token): Promise<{id:string}|null>; rpcAsUser(token, fn): Promise<unknown>; loadRow(room, ref): Promise<RoomRow|null>; claimMeetingId(room, ref, meetingId): Promise<boolean>; getParticipant(meetingId, userId): Promise<{participant_id:string; preset_name:string}|null>; saveParticipant(row): Promise<void>; profile(userId): Promise<{display_name:string|null; avatar_url:string|null}|null>; rtk: RtkApi }`
  - `async function handleJoin(req: Request, deps: JoinDeps): Promise<Response>` — for a **host** it also reactivates an `INACTIVE` meeting (`getMeeting` → `setMeetingStatus(id,'ACTIVE')`) before `addParticipant`. This is the only place that can: the pages call `mountRoom` (→ `ea-rtk-join`) **first** and only call `ea-rtk-host start` once `rtkStatesUpdate.detail.meeting === 'joined'`, so against a retired meeting the join would fail and `start` would never run.
  - HTTP contract the page depends on: `200 {token, meeting_id, preset, room, ref, host}`; errors `401 {error:"sign_in"}`, `400 {error:"bad_room"|"bad_session"}`, `403 {error:"not_allowed"}`, `404 {error:"not_found"}`, `409 {error:"not_open"}`, `502 {error:"cloudflare_<status>"}`, `503 {error:"rtk_not_configured"}`, `405 {error:"method_not_allowed"}`.

- [ ] **Step 1: Write the failing test**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/handler_test.ts`:

```ts
// deno test -A supabase/functions/ea-rtk-join/handler_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleJoin, PRESETS } from "./handler.ts";
import type { JoinDeps } from "./handler.ts";
import type { RoomRow, RtkApi } from "../_shared/rtk.ts";

const OPEN: RoomRow = {
  ref: "3", title: "Open Payments", is_live: true, mode: "meeting",
  rtk_meeting_id: "m1", rtk_session_id: null, rtk_started_at: null, access: null,
};
const SHUT: RoomRow = { ...OPEN, is_live: false, mode: "stream", rtk_meeting_id: null };

function fakeRtk(over: Partial<RtkApi> = {}): RtkApi {
  const no = () => Promise.resolve({ status: 200, ok: true, data: null, error: null });
  return {
    createMeeting: () => Promise.resolve({ status: 200, ok: true, data: { id: "m-new" }, error: null }),
    getMeeting: no as RtkApi["getMeeting"],
    setMeetingStatus: no as RtkApi["setMeetingStatus"],
    retireMeeting: no as RtkApi["retireMeeting"],
    addParticipant: () => Promise.resolve({ status: 200, ok: true, data: { id: "p1", token: "TOK-new" }, error: null }),
    editParticipantPreset: () => Promise.resolve({ status: 200, ok: true, data: { id: "p1", token: "TOK-edit" }, error: null }),
    refreshParticipantToken: () => Promise.resolve({ status: 200, ok: true, data: { token: "TOK-refresh" }, error: null }),
    getActiveSession: no as RtkApi["getActiveSession"],
    kickAll: no as RtkApi["kickAll"],
    startRecording: no as RtkApi["startRecording"],
    getActiveRecording: no as RtkApi["getActiveRecording"],
    stopRecording: no as RtkApi["stopRecording"],
    getSessionTranscript: no as RtkApi["getSessionTranscript"],
    ...over,
  } as RtkApi;
}

type RpcMap = Record<string, unknown>;
function deps(over: Partial<JoinDeps> & { rpc?: RpcMap; row?: RoomRow | null } = {}): JoinDeps {
  const rpc = over.rpc || {};
  return {
    configured: () => true,
    getUser: (t) => Promise.resolve(t === "good" ? { id: "u1" } : null),
    rpcAsUser: (_t, fn) => Promise.resolve(rpc[fn]),
    loadRow: () => Promise.resolve(over.row === undefined ? OPEN : over.row),
    claimMeetingId: () => Promise.resolve(true),
    getParticipant: () => Promise.resolve(null),
    saveParticipant: () => Promise.resolve(),
    profile: () => Promise.resolve({ display_name: "Ava", avatar_url: "https://x/y.png" }),
    rtk: fakeRtk(),
    ...over,
  };
}
const post = (body: unknown, auth = "Bearer good") =>
  new Request("https://fn/ea-rtk-join", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) });

Deno.test("OPTIONS is a CORS preflight, GET is 405", async () => {
  const pre = await handleJoin(new Request("https://fn", { method: "OPTIONS" }), deps());
  assertEquals(pre.status, 200);
  assertEquals(pre.headers.get("Access-Control-Allow-Origin"), "https://taylormadeacademy.com");
  const get = await handleJoin(new Request("https://fn", { method: "GET" }), deps());
  assertEquals(get.status, 405);
  assertEquals((await get.json()).error, "method_not_allowed");
});

Deno.test("missing secrets -> 503 rtk_not_configured", async () => {
  const r = await handleJoin(post({ room: "opil", session_no: 3 }), deps({ configured: () => false }));
  assertEquals(r.status, 503);
  assertEquals((await r.json()).error, "rtk_not_configured");
});

Deno.test("no token -> 401 sign_in", async () => {
  const r = await handleJoin(post({ room: "opil", session_no: 3 }, ""), deps());
  assertEquals(r.status, 401);
  assertEquals((await r.json()).error, "sign_in");
});

Deno.test("unknown room -> 400 bad_room; academy with no live_id -> 400 bad_room", async () => {
  const a = await handleJoin(post({ room: "nope" }), deps());
  assertEquals(a.status, 400);
  assertEquals((await a.json()).error, "bad_room");
  const b = await handleJoin(post({ room: "academy" }), deps());
  assertEquals((await b.json()).error, "bad_room");
});

Deno.test("opil with a non-integer session_no -> 400 bad_session", async () => {
  const r = await handleJoin(post({ room: "opil", session_no: "three" }), deps());
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, "bad_session");
});

Deno.test("academy: admin -> tma-webinar-host and may join an off-air room", async () => {
  const r = await handleJoin(
    post({ room: "academy", live_id: "L1" }),
    deps({ rpc: { ea_is_admin: true }, row: { ...SHUT, ref: "L1", access: "members" } }),
  );
  const b = await r.json();
  assertEquals(r.status, 200);
  assertEquals(b.preset, "tma-webinar-host");
  assertEquals(b.host, true);
  assertEquals(b.meeting_id, "m-new");
  assertEquals(b.token, "TOK-new");
});

Deno.test("academy: member of an open room -> tma-webinar-member", async () => {
  const r = await handleJoin(
    post({ room: "academy", live_id: "L1" }),
    deps({ rpc: { ea_is_admin: false, ea_is_member: true }, row: { ...OPEN, ref: "L1", access: "members" } }),
  );
  const b = await r.json();
  assertEquals(b.preset, "tma-webinar-member");
  assertEquals(b.host, false);
  assertEquals(b.meeting_id, "m1");
});

Deno.test("academy: signed-in non-member -> 403 not_allowed", async () => {
  const r = await handleJoin(post({ room: "academy", live_id: "L1" }), deps({ rpc: { ea_is_admin: false, ea_is_member: false } }));
  assertEquals(r.status, 403);
  assertEquals((await r.json()).error, "not_allowed");
});

Deno.test("non-host on a room the host has not opened -> 409 not_open, and no meeting is created", async () => {
  let created = 0;
  const r = await handleJoin(
    post({ room: "opil", session_no: 3 }),
    deps({
      rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [] }, ea_opil_in_cohort: true },
      row: SHUT,
      rtk: fakeRtk({ createMeeting: () => { created++; return Promise.resolve({ status: 200, ok: true, data: { id: "x" }, error: null }); } }),
    }),
  );
  assertEquals(r.status, 409);
  assertEquals((await r.json()).error, "not_open");
  assertEquals(created, 0);
});

Deno.test("opil roles resolve host -> judge -> student, first match wins", async () => {
  const admin = await handleJoin(post({ room: "opil", session_no: 3 }),
    deps({ rpc: { ea_opil_my_role: { admin: true, judge: true, facilitator_sessions: [] } } }));
  assertEquals((await admin.json()).preset, "opil-host");

  const fac = await handleJoin(post({ room: "opil", session_no: 3 }),
    deps({ rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [3, 5] } } }));
  assertEquals((await fac.json()).preset, "opil-host");

  const judge = await handleJoin(post({ room: "opil", session_no: 3 }),
    deps({ rpc: { ea_opil_my_role: { admin: false, judge: true, facilitator_sessions: [7] }, ea_opil_in_cohort: true } }));
  assertEquals((await judge.json()).preset, "opil-judge");

  const student = await handleJoin(post({ room: "opil", session_no: 3 }),
    deps({ rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [7] }, ea_opil_in_cohort: true } }));
  assertEquals((await student.json()).preset, "opil-student");

  const nobody = await handleJoin(post({ room: "opil", session_no: 3 }),
    deps({ rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [] }, ea_opil_in_cohort: false } }));
  assertEquals(nobody.status, 403);
});

Deno.test("a host joining a retired meeting reactivates it before adding the participant", async () => {
  const order: string[] = [];
  let status = "";
  const r = await handleJoin(
    post({ room: "opil", session_no: 3 }),
    deps({
      rpc: { ea_opil_my_role: { admin: true, judge: false, facilitator_sessions: [] } },
      rtk: fakeRtk({
        getMeeting: () => { order.push("getMeeting"); return Promise.resolve({ status: 200, ok: true, data: { id: "m1", status: "INACTIVE" }, error: null }); },
        setMeetingStatus: (_id, s) => { order.push("setMeetingStatus"); status = s; return Promise.resolve({ status: 200, ok: true, data: { id: "m1", status: s }, error: null }); },
        addParticipant: () => { order.push("addParticipant"); return Promise.resolve({ status: 200, ok: true, data: { id: "p1", token: "TOK-new" }, error: null }); },
      }),
    }),
  );
  assertEquals(r.status, 200);
  assertEquals(status, "ACTIVE");
  assertEquals(order, ["getMeeting", "setMeetingStatus", "addParticipant"]);
});

Deno.test("a host joining an ACTIVE meeting never PATCHes its status", async () => {
  let patched = 0;
  await handleJoin(
    post({ room: "opil", session_no: 3 }),
    deps({
      rpc: { ea_opil_my_role: { admin: true, judge: false, facilitator_sessions: [] } },
      rtk: fakeRtk({
        getMeeting: () => Promise.resolve({ status: 200, ok: true, data: { id: "m1", status: "ACTIVE" }, error: null }),
        setMeetingStatus: (_id, s) => { patched++; return Promise.resolve({ status: 200, ok: true, data: { id: "m1", status: s }, error: null }); },
      }),
    }),
  );
  assertEquals(patched, 0);
});

Deno.test("every preset the resolver can return is on the allowlist", () => {
  assertEquals([...PRESETS], ["tma-webinar-host", "tma-webinar-member", "opil-host", "opil-student", "opil-judge"]);
});

Deno.test("a missing row -> 404 not_found", async () => {
  const r = await handleJoin(post({ room: "opil", session_no: 3 }),
    deps({ rpc: { ea_opil_my_role: { admin: true, judge: false, facilitator_sessions: [] } }, row: null }));
  assertEquals(r.status, 404);
  assertEquals((await r.json()).error, "not_found");
});

Deno.test("an existing participant on the same preset gets a refreshed token, not a new participant", async () => {
  let added = 0, refreshed = 0;
  const r = await handleJoin(
    post({ room: "opil", session_no: 3 }),
    deps({
      rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [] }, ea_opil_in_cohort: true },
      getParticipant: () => Promise.resolve({ participant_id: "p9", preset_name: "opil-student" }),
      rtk: fakeRtk({
        addParticipant: () => { added++; return Promise.resolve({ status: 200, ok: true, data: { id: "p1", token: "T" }, error: null }); },
        refreshParticipantToken: () => { refreshed++; return Promise.resolve({ status: 200, ok: true, data: { token: "TOK-refresh" }, error: null }); },
      }),
    }),
  );
  assertEquals((await r.json()).token, "TOK-refresh");
  assertEquals(added, 0);
  assertEquals(refreshed, 1);
});

Deno.test("a participant whose role changed is PATCHed to the new preset", async () => {
  const r = await handleJoin(
    post({ room: "opil", session_no: 3 }),
    deps({
      rpc: { ea_opil_my_role: { admin: true, judge: false, facilitator_sessions: [] } },
      getParticipant: () => Promise.resolve({ participant_id: "p9", preset_name: "opil-student" }),
    }),
  );
  const b = await r.json();
  assertEquals(b.preset, "opil-host");
  assertEquals(b.token, "TOK-edit");
});

Deno.test("a Cloudflare failure on the participant call -> 502 cloudflare_500", async () => {
  const r = await handleJoin(
    post({ room: "opil", session_no: 3 }),
    deps({
      rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [] }, ea_opil_in_cohort: true },
      rtk: fakeRtk({ addParticipant: () => Promise.resolve({ status: 500, ok: false, data: null, error: "cloudflare_500" }) }),
    }),
  );
  assertEquals(r.status, 502);
  assertEquals((await r.json()).error, "cloudflare_500");
});

Deno.test("the participant body carries the uuid, never an email, and only an https picture", async () => {
  let body: Record<string, unknown> = {};
  await handleJoin(
    post({ room: "opil", session_no: 3 }),
    deps({
      rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [] }, ea_opil_in_cohort: true },
      profile: () => Promise.resolve({ display_name: null, avatar_url: "http://insecure/x.png" }),
      rtk: fakeRtk({ addParticipant: (_m, b) => { body = b; return Promise.resolve({ status: 200, ok: true, data: { id: "p1", token: "T" }, error: null }); } }),
    }),
  );
  assertEquals(body.custom_participant_id, "u1");
  assertEquals(body.name, "Member");
  assertEquals(body.picture, undefined);
  assertEquals(body.preset_name, "opil-student");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/ea-rtk-join/handler_test.ts`
Expected: FAIL — `Module not found "file:///…/ea-rtk-join/handler.ts"`.

- [ ] **Step 3: Write the handler**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/handler.ts`:

```ts
// ea-rtk-join/handler.ts — the only place a member's browser touches RealtimeKit.
//
// Auth model copied from ea-live-publish: verify_jwt is OFF, the caller sends its own
// access token, we resolve it with the SERVICE ROLE client and then ask the database —
// AS THAT USER — which preset they get. No Cloudflare secret ever leaves this function.
// Spec: §4, §5.2, §10.4

import { createOrGetMeeting, type MeetingIo, type Room, type RoomRow, type RtkApi } from "../_shared/rtk.ts";

export const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/** The fixed allowlist. Dashboard default presets live in the same app; a typo must never
 *  hand a member `webinar_presenter`. Mirrored by the check constraint on ea_rtk_participants. */
export const PRESETS = ["tma-webinar-host", "tma-webinar-member", "opil-host", "opil-student", "opil-judge"] as const;
export type Preset = typeof PRESETS[number];

export type JoinDeps = {
  configured(): boolean;
  getUser(token: string): Promise<{ id: string } | null>;
  rpcAsUser(token: string, fn: string): Promise<unknown>;
  loadRow(room: Room, ref: string): Promise<RoomRow | null>;
  claimMeetingId(room: Room, ref: string, meetingId: string): Promise<boolean>;
  getParticipant(meetingId: string, userId: string): Promise<{ participant_id: string; preset_name: string } | null>;
  saveParticipant(row: { meeting_id: string; user_id: string; participant_id: string; preset_name: Preset }): Promise<void>;
  profile(userId: string): Promise<{ display_name: string | null; avatar_url: string | null } | null>;
  rtk: RtkApi;
};

type OpilRole = { admin?: boolean; judge?: boolean; facilitator_sessions?: number[] };

export async function handleJoin(req: Request, deps: JoinDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!deps.configured()) return json({ error: "rtk_not_configured" }, 503);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "sign_in" }, 401);
  const user = await deps.getUser(token);
  if (!user) return json({ error: "sign_in" }, 401);

  let body: { room?: string; live_id?: string; session_no?: unknown } = {};
  try { body = await req.json(); } catch (_e) { /* an empty body is a bad request below */ }
  const room: Room | null = body.room === "opil" ? "opil" : body.room === "academy" ? "academy" : null;
  if (!room) return json({ error: "bad_room" }, 400);

  // ---- role → preset, decided server-side, as the caller ----
  let preset: Preset;
  let ref: string;
  if (room === "academy") {
    if (typeof body.live_id !== "string" || !body.live_id) return json({ error: "bad_room" }, 400);
    ref = body.live_id;
    if (await deps.rpcAsUser(token, "ea_is_admin") === true) preset = "tma-webinar-host";
    else if (await deps.rpcAsUser(token, "ea_is_member") === true) preset = "tma-webinar-member";
    else return json({ error: "not_allowed" }, 403);
  } else {
    const no = Number(body.session_no);
    if (!Number.isInteger(no)) return json({ error: "bad_session" }, 400);
    ref = String(no);
    const role = (await deps.rpcAsUser(token, "ea_opil_my_role")) as OpilRole | null;
    const fac = Array.isArray(role?.facilitator_sessions) ? role!.facilitator_sessions! : [];
    if (role?.admin === true || fac.includes(no)) preset = "opil-host";
    else if (role?.judge === true) preset = "opil-judge";
    else if (await deps.rpcAsUser(token, "ea_opil_in_cohort") === true) preset = "opil-student";
    else return json({ error: "not_allowed" }, 403);
  }
  if (!PRESETS.includes(preset)) return json({ error: "not_allowed" }, 403);   // belt and braces
  const isHost = preset.endsWith("-host");

  // ---- the row ----
  const row = await deps.loadRow(room, ref);
  if (!row) return json({ error: "not_found" }, 404);

  // ---- the gate: non-hosts never open a room, never create a meeting, never spend minutes ----
  if (!isHost && !(row.is_live && row.mode === "meeting" && row.rtk_meeting_id)) {
    return json({ error: "not_open" }, 409);
  }

  // ---- the meeting ----
  let meetingId = row.rtk_meeting_id;
  if (isHost) {
    const io: MeetingIo = { rtk: deps.rtk, loadRow: deps.loadRow, claimMeetingId: deps.claimMeetingId };
    const got = await createOrGetMeeting(io, room, ref, row);
    if (!got.meeting_id) return json({ error: got.error || "cloudflare_error" }, got.status === 200 ? 502 : got.status);
    meetingId = got.meeting_id;
    // A meeting retired by a previous end_session (or by hand) refuses new participants, and
    // ea-rtk-host `start` cannot heal it: the page joins FIRST and only calls `start` once the
    // element reports `joined`. So the self-heal has to live here, before addParticipant.
    const m = await deps.rtk.getMeeting(meetingId);
    if (m.ok && m.data?.status === "INACTIVE") await deps.rtk.setMeetingStatus(meetingId, "ACTIVE");
  }
  if (!meetingId) return json({ error: "not_open" }, 409);

  // ---- the participant: create, re-preset, or refresh. Always a fresh token. ----
  const existing = await deps.getParticipant(meetingId, user.id);
  let participantId: string;
  let outToken: string;
  if (!existing) {
    const prof = await deps.profile(user.id);
    const pic = prof?.avatar_url && /^https:\/\//i.test(prof.avatar_url) ? prof.avatar_url : undefined;
    const added = await deps.rtk.addParticipant(meetingId, {
      custom_participant_id: user.id,             // auth.users.id — never an email
      preset_name: preset,
      name: (prof?.display_name || "Member").slice(0, 80),
      ...(pic ? { picture: pic } : {}),
    });
    if (!added.ok || !added.data?.id || !added.data?.token) return json({ error: added.error || "cloudflare_error" }, 502);
    participantId = added.data.id;
    outToken = added.data.token;
  } else if (existing.preset_name !== preset) {
    const edited = await deps.rtk.editParticipantPreset(meetingId, existing.participant_id, preset);
    if (!edited.ok || !edited.data?.token) return json({ error: edited.error || "cloudflare_error" }, 502);
    participantId = existing.participant_id;
    outToken = edited.data.token;
  } else {
    const fresh = await deps.rtk.refreshParticipantToken(meetingId, existing.participant_id);
    if (!fresh.ok || !fresh.data?.token) return json({ error: fresh.error || "cloudflare_error" }, 502);
    participantId = existing.participant_id;
    outToken = fresh.data.token;
  }
  await deps.saveParticipant({ meeting_id: meetingId, user_id: user.id, participant_id: participantId, preset_name: preset });

  return json({ token: outToken, meeting_id: meetingId, preset, room, ref, host: isHost });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/ea-rtk-join/handler_test.ts`
Expected: `ok | 18 passed | 0 failed`.

- [ ] **Step 5: Write the deployable entry point**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/index.ts`:

```ts
// ea-rtk-join — hands a member a per-person RealtimeKit participant token, only after the
// same role check ea-live-publish uses. verify_jwt OFF; this function does its own auth.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected), CF_ACCOUNT_ID, CF_RTK_APP_ID,
//          CF_RTK_API_TOKEN. Deployed to pgqdmnmessbbzyszjfvr. Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rtk, rtkConfigured, roomTable, type Room, type RoomRow } from "../_shared/rtk.ts";
import { handleJoin, type JoinDeps } from "./handler.ts";

const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const keyOf = (room: Room, ref: string) => (room === "opil" ? Number(ref) : ref);

export function realDeps(): JoinDeps {
  return {
    configured: rtkConfigured,
    async getUser(token) {
      const { data: { user }, error } = await admin.auth.getUser(token);
      return error || !user ? null : { id: user.id };
    },
    async rpcAsUser(token, fn) {
      const asUser = createClient(URL_, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data } = await asUser.rpc(fn);
      return data;
    },
    async loadRow(room, ref) {
      const t = roomTable(room);
      let q = admin.from(t.table)
        .select("title, is_live, mode, rtk_meeting_id, rtk_session_id, rtk_started_at" + (room === "academy" ? ", access" : ""))
        .eq(t.key, keyOf(room, ref));
      if (room === "opil") q = q.eq("kind", "thread");
      const { data } = await q.maybeSingle();
      if (!data) return null;
      const r = data as Record<string, unknown>;
      return {
        ref,
        title: (r.title as string) ?? null,
        is_live: r.is_live === true,
        mode: (r.mode as string) ?? "stream",
        rtk_meeting_id: (r.rtk_meeting_id as string) ?? null,
        rtk_session_id: (r.rtk_session_id as string) ?? null,
        rtk_started_at: (r.rtk_started_at as string) ?? null,
        access: (r.access as string) ?? null,
      } as RoomRow;
    },
    async claimMeetingId(room, ref, meetingId) {
      const t = roomTable(room);
      const { data } = await admin.from(t.table)
        .update({ rtk_meeting_id: meetingId })
        .eq(t.key, keyOf(room, ref))
        .is("rtk_meeting_id", null)
        .select(t.key);
      return Array.isArray(data) && data.length > 0;
    },
    async getParticipant(meetingId, userId) {
      const { data } = await admin.from("ea_rtk_participants")
        .select("participant_id, preset_name").eq("meeting_id", meetingId).eq("user_id", userId).maybeSingle();
      return data ? { participant_id: data.participant_id, preset_name: data.preset_name } : null;
    },
    async saveParticipant(row) {
      await admin.from("ea_rtk_participants")
        .upsert({ ...row, last_token_at: new Date().toISOString() }, { onConflict: "meeting_id,user_id" });
    },
    async profile(userId) {
      const { data } = await admin.from("ea_profiles").select("display_name, avatar_url").eq("user_id", userId).maybeSingle();
      return data ? { display_name: data.display_name, avatar_url: data.avatar_url } : null;
    },
    rtk,
  };
}

Deno.serve((req: Request) => handleJoin(req, realDeps()));
```

- [ ] **Step 6: Type-check the entry point**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno check supabase/functions/ea-rtk-join/index.ts`
Expected: no diagnostics. (It downloads `esm.sh/@supabase/supabase-js@2` on the first run.)

- [ ] **Step 7: Set the two RealtimeKit secrets and deploy**

The Cloudflare app and the five presets already exist (`CF_RTK_APP_ID=0f38f396-7ab8-41ed-bc08-8cf48fa695c7`, created by `scripts/rtk-presets.sh`).

```bash
cd /Users/nelsontaylor/taylormade-academy
supabase secrets set CF_RTK_APP_ID="$CF_RTK_APP_ID" CF_RTK_API_TOKEN="$CF_RTK_API_TOKEN" --project-ref "$SB_REF"
supabase functions deploy ea-rtk-join --no-verify-jwt --project-ref "$SB_REF"
```
Expected: `Deployed Functions on project pgqdmnmessbbzyszjfvr: ea-rtk-join`.

- [ ] **Step 8: Run the live curl matrix**

```bash
# seed one throwaway members-only Academy row as the admin
LIVE_ID="$(curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $TMA_ADMIN_JWT" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -X POST "$SB_REST/ea_live" -d '{"title":"zz-test-rtk-join","is_live":false,"access":"members"}' | jq -r '.[0].id')"
echo "LIVE_ID=$LIVE_ID"

echo '--- no token -> 401 sign_in'
curl -sS -o /dev/null -w '%{http_code} ' -X POST "$FN/ea-rtk-join" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\"}"; echo

echo '--- non-member -> 403 not_allowed (use a signed-in account with no membership)'
curl -sS -X POST "$FN/ea-rtk-join" -H "Authorization: Bearer $TMA_NONMEMBER_JWT" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\"}"; echo

echo '--- member on an unopened room -> 409 not_open'
curl -sS -X POST "$FN/ea-rtk-join" -H "Authorization: Bearer $TMA_MEMBER_JWT" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\"}"; echo

echo '--- admin -> 200 with a token'
curl -sS -X POST "$FN/ea-rtk-join" -H "Authorization: Bearer $TMA_ADMIN_JWT" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\"}" \
  | jq '{host, preset, meeting_id, token: (.token | if . then "…" + .[-8:] else null end)}'
```
Expected, in order: `401`; `{"error":"not_allowed"}`; `{"error":"not_open"}`; `{"host":true,"preset":"tma-webinar-host","meeting_id":"<uuid>","token":"…XXXXXXXX"}`. (If no non-member account is to hand, skip the second line and note it — the unit test covers that branch.)

- [ ] **Step 9: Clean up the throwaway row and its meeting**

```bash
MID="$(curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select rtk_meeting_id from public.ea_live where title = '\''zz-test-rtk-join'\'';"}' | jq -r '.[0].rtk_meeting_id')"
curl -sS -X PATCH "$RTK/meetings/$MID" -H "Authorization: Bearer $CF_RTK_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"INACTIVE"}' | jq '.success'
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"delete from public.ea_rtk_participants where meeting_id in (select rtk_meeting_id from public.ea_live where title like '\''zz-test-%'\''); delete from public.ea_live where title like '\''zz-test-%'\''; select count(*) as leftover from public.ea_live where title like '\''zz-test-%'\'';"}'
```
Expected: `true`, then `[{"leftover":0}]`.

- [ ] **Step 10: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/functions/ea-rtk-join
git commit -m "feat(live): ea-rtk-join — role-resolved RealtimeKit participant tokens"
```

---

## Task 4: `ea-rtk-host` — start / end_session / start_recording / stop_recording / status

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-host/handler.ts`
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-host/index.ts`
- Test: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-host/handler_test.ts`

**Interfaces:**
- Consumes: `_shared/rtk.ts` (`Room`, `RoomRow`, `RtkApi`, `rtk`, `rtkConfigured`, `roomTable`, `createOrGetMeeting`, `MeetingIo`); Task 1's four server columns, `public.ea_rtk_upsert_artifact(p jsonb)` (the only legal writer of `ea_rtk_artifacts`), and the partial unique indexes `ea_live_one_live` / `ea_opil_sessions_one_live` (`0023:54-57`); Task 3's `CORS` / `json()` shapes (copied verbatim, not imported across functions).
- Produces, for Task 6:
  - `type HostAction = "start" | "end_session" | "start_recording" | "stop_recording" | "status"`
  - `type HostDeps = { configured(): boolean; getUser(token): Promise<{id:string}|null>; rpcAsUser(token, fn): Promise<unknown>; loadRow(room, ref): Promise<RoomRow|null>; claimMeetingId(room, ref, meetingId): Promise<boolean>; clearOtherLive(room, ref): Promise<{code: string|null}>; setRow(room, ref, patch: Record<string, unknown>): Promise<{code: string|null}>; upsertRecording(a: {meeting_id: string; room: Room; ref: string; provider_id: string; status: string}): Promise<void>; rtk: RtkApi }`
  - `async function handleHost(req: Request, deps: HostDeps): Promise<Response>`
  - HTTP contract the host bar depends on:
    - `start` → `200 {meeting_id, is_live: true, mode: "meeting", recording_id: string | null}`
    - `end_session` → `200 {ended: true, kicked_participants_count: number, mode: "stream"}`
    - `start_recording` → `200 {recording_id: string, recording_status: string}` — **not** `status`: `js/rtk-room.js`'s `post()` returns `Object.assign({ status: res.status }, json)`, so a server field named `status` would overwrite the HTTP code with a Cloudflare recording state like `"INVOKED"`.
    - `stop_recording` → `200 {stopped: boolean, recording_id: string | null}`
    - `status` → `200 {active: boolean, live_participants: number | null, recording: null | {id: string, status: string}}`
    - errors `401 sign_in`, `400 bad_room | bad_session | bad_action`, `403 not_allowed`, `404 not_found`, `409 another_live`, `502 cloudflare_<status>`, `503 rtk_not_configured`, `405 method_not_allowed`.

- [ ] **Step 1: Write the failing test**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-host/handler_test.ts`:

```ts
// deno test -A supabase/functions/ea-rtk-host/handler_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleHost } from "./handler.ts";
import type { HostDeps } from "./handler.ts";
import type { RoomRow, RtkApi } from "../_shared/rtk.ts";

const ROW: RoomRow = {
  ref: "3", title: "Open Payments", is_live: false, mode: "stream",
  rtk_meeting_id: "m1", rtk_session_id: null, rtk_started_at: null, access: null,
};
const ok = <T>(data: T) => Promise.resolve({ status: 200, ok: true, data, error: null });
const fail = (status: number) => Promise.resolve({ status, ok: false, data: null, error: `cloudflare_${status}` });

function fakeRtk(over: Partial<RtkApi> = {}): RtkApi {
  return {
    createMeeting: () => ok({ id: "m1" }),
    getMeeting: () => ok({ id: "m1", status: "ACTIVE" }),
    setMeetingStatus: () => ok({ id: "m1", status: "ACTIVE" }),
    retireMeeting: () => ok({ id: "m1", status: "INACTIVE" }),
    addParticipant: () => ok({ id: "p1", token: "t" }),
    editParticipantPreset: () => ok({ id: "p1", token: "t" }),
    refreshParticipantToken: () => ok({ token: "t" }),
    getActiveSession: () => ok({ id: "s1", live_participants: 7 }),
    kickAll: () => ok({ kicked_participants_count: 4 }),
    startRecording: () => ok({ id: "r1", status: "INVOKED" }),
    getActiveRecording: () => fail(404),
    stopRecording: () => ok({ id: "r1", status: "UPLOADING" }),
    getSessionTranscript: () => ok({}),
    ...over,
  } as RtkApi;
}

type Patch = { room: string; ref: string; patch: Record<string, unknown> };
function deps(over: Partial<HostDeps> & { rpc?: Record<string, unknown>; row?: RoomRow | null; patches?: Patch[]; cleared?: string[] } = {}): HostDeps {
  const rpc = over.rpc || { ea_opil_my_role: { admin: true, judge: false, facilitator_sessions: [] } };
  const patches = over.patches || [];
  const cleared = over.cleared || [];
  return {
    configured: () => true,
    getUser: (t) => Promise.resolve(t === "good" ? { id: "u1" } : null),
    rpcAsUser: (_t, fn) => Promise.resolve(rpc[fn]),
    loadRow: () => Promise.resolve(over.row === undefined ? ROW : over.row),
    claimMeetingId: () => Promise.resolve(true),
    clearOtherLive: (room, ref) => { cleared.push(`${room}:${ref}`); return Promise.resolve({ code: null }); },
    setRow: (room, ref, patch) => { patches.push({ room, ref, patch }); return Promise.resolve({ code: null }); },
    upsertRecording: () => Promise.resolve(),
    rtk: fakeRtk(),
    ...over,
  };
}
const post = (body: unknown, auth = "Bearer good") =>
  new Request("https://fn/ea-rtk-host", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) });

Deno.test("only host roles pass: an OPIL student is 403", async () => {
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "status" }),
    deps({ rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [9] } } }));
  assertEquals(r.status, 403);
  assertEquals((await r.json()).error, "not_allowed");
});

Deno.test("a facilitator of THIS session passes", async () => {
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "status" }),
    deps({ rpc: { ea_opil_my_role: { admin: false, judge: false, facilitator_sessions: [3] } } }));
  assertEquals(r.status, 200);
});

Deno.test("an unknown action is 400 bad_action", async () => {
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "explode" }), deps());
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, "bad_action");
});

Deno.test("start: clears the other rows, flips this one, pins the session, records", async () => {
  const patches: Patch[] = [], cleared: string[] = [];
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "start", record: true }), deps({ patches, cleared }));
  const b = await r.json();
  assertEquals(r.status, 200);
  assertEquals(b, { meeting_id: "m1", is_live: true, mode: "meeting", recording_id: "r1" });
  assertEquals(cleared, ["opil:3"]);
  assertEquals(patches[0].patch, { is_live: true, mode: "meeting" });
  assertEquals(patches[1].patch.rtk_session_id, "s1");
  assertEquals(typeof patches[1].patch.rtk_started_at, "string");
});

Deno.test("start: a failed active-session GET writes rtk_session_id null, never a stale id", async () => {
  const patches: Patch[] = [];
  await handleHost(post({ room: "opil", session_no: 3, action: "start" }),
    deps({ patches, rtk: fakeRtk({ getActiveSession: () => fail(404) }) }));
  assertEquals(patches[1].patch.rtk_session_id, null);
  assertEquals(typeof patches[1].patch.rtk_started_at, "string");
});

Deno.test("start: record:false skips the recording", async () => {
  let started = 0;
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "start", record: false }),
    deps({ rtk: fakeRtk({ startRecording: () => { started++; return ok({ id: "r1" }); } }) }));
  assertEquals((await r.json()).recording_id, null);
  assertEquals(started, 0);
});

Deno.test("start: a 23505 on the flip is retried once, then 409 another_live", async () => {
  let tries = 0;
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "start" }),
    deps({ setRow: () => { tries++; return Promise.resolve({ code: "23505" }); } }));
  assertEquals(r.status, 409);
  assertEquals((await r.json()).error, "another_live");
  assertEquals(tries, 2);
});

Deno.test("start: an INACTIVE meeting is reactivated first", async () => {
  let activated = "";
  await handleHost(post({ room: "opil", session_no: 3, action: "start" }),
    deps({ rtk: fakeRtk({
      getMeeting: () => ok({ id: "m1", status: "INACTIVE" }),
      setMeetingStatus: (_id, s) => { activated = s; return ok({ id: "m1", status: s }); },
    }) }));
  assertEquals(activated, "ACTIVE");
});

Deno.test("start: an Academy public row is refused (room mode is members-only in v1)", async () => {
  const r = await handleHost(post({ room: "academy", live_id: "L1", action: "start" }),
    deps({ rpc: { ea_is_admin: true }, row: { ...ROW, ref: "L1", access: "public" } }));
  assertEquals(r.status, 403);
  assertEquals((await r.json()).error, "not_allowed");
});

Deno.test("start_recording is idempotent: an active recording is returned as-is", async () => {
  let posted = 0;
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "start_recording" }),
    deps({ rtk: fakeRtk({
      getActiveRecording: () => ok({ id: "r-live", status: "RECORDING" }),
      startRecording: () => { posted++; return ok({ id: "r-new" }); },
    }) }));
  assertEquals(await r.json(), { recording_id: "r-live", recording_status: "RECORDING" });
  assertEquals(posted, 0);
});

Deno.test("start_recording posts the documented body", async () => {
  let body: Record<string, unknown> = {};
  await handleHost(post({ room: "opil", session_no: 3, action: "start_recording" }),
    deps({ rtk: fakeRtk({ startRecording: (b) => { body = b; return ok({ id: "r1", status: "INVOKED" }); } }) }));
  assertEquals(body.meeting_id, "m1");
  assertEquals(body.file_name_prefix, "opil_s3");
  assertEquals(body.max_seconds, 10800);
  assertEquals(body.realtimekit_bucket_config, { enabled: true });
  assertEquals(body.video_config, { codec: "H264", width: 1280, height: 720, export_file: true });
  assertEquals(body.audio_config, { codec: "AAC", channel: "stereo", export_file: true });
});

Deno.test("start_recording on Academy uses the academy_live_<id> prefix", async () => {
  let body: Record<string, unknown> = {};
  await handleHost(post({ room: "academy", live_id: "L1", action: "start_recording" }),
    deps({ rpc: { ea_is_admin: true }, row: { ...ROW, ref: "L1", access: "members" },
      rtk: fakeRtk({ startRecording: (b) => { body = b; return ok({ id: "r1" }); } }) }));
  assertEquals(body.file_name_prefix, "academy_live_L1");
});

Deno.test("stop_recording with nothing running is {stopped:false}, not an error", async () => {
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "stop_recording" }), deps());
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { stopped: false, recording_id: null });
});

Deno.test("end_session stops the recording, kicks everyone, then resets is_live AND mode", async () => {
  const order: string[] = [], patches: Patch[] = [];
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "end_session" }),
    deps({
      patches,
      setRow: (room, ref, patch) => { order.push("setRow"); patches.push({ room, ref, patch }); return Promise.resolve({ code: null }); },
      rtk: fakeRtk({
        getActiveRecording: () => { order.push("getActiveRecording"); return ok({ id: "r1", status: "RECORDING" }); },
        stopRecording: () => { order.push("stopRecording"); return ok({ id: "r1", status: "UPLOADING" }); },
        kickAll: () => { order.push("kickAll"); return ok({ kicked_participants_count: 4 }); },
      }),
    }));
  assertEquals(await r.json(), { ended: true, kicked_participants_count: 4, mode: "stream" });
  assertEquals(order, ["getActiveRecording", "stopRecording", "kickAll", "setRow"]);
  assertEquals(patches[0].patch, { is_live: false, mode: "stream" });
});

Deno.test("status without a meeting id never calls Cloudflare", async () => {
  let calls = 0;
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "status" }),
    deps({ row: { ...ROW, rtk_meeting_id: null },
      rtk: fakeRtk({ getActiveSession: () => { calls++; return ok({ id: "s" }); } }) }));
  assertEquals(await r.json(), { active: false, live_participants: null, recording: null });
  assertEquals(calls, 0);
});

Deno.test("status reports the headcount and the live recording", async () => {
  const r = await handleHost(post({ room: "opil", session_no: 3, action: "status" }),
    deps({ rtk: fakeRtk({ getActiveRecording: () => ok({ id: "r1", status: "RECORDING" }) }) }));
  assertEquals(await r.json(), { active: true, live_participants: 7, recording: { id: "r1", status: "RECORDING" } });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/ea-rtk-host/handler_test.ts`
Expected: FAIL — `Module not found "file:///…/ea-rtk-host/handler.ts"`.

- [ ] **Step 3: Write the handler**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-host/handler.ts`:

```ts
// ea-rtk-host/handler.ts — host-only room actions. Nothing here returns HTML or asks the
// page to navigate: the page applies the JSON to the DOM, and never reloads.
// `mode` is reset to 'stream' in exactly two places: the one-live clear inside `start`
// (the OTHER rows) and `end_session` (this row). Spec: §5.3, §3.1, §10.6

import { createOrGetMeeting, type MeetingIo, type Room, type RoomRow, type RtkApi } from "../_shared/rtk.ts";

export const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export const HOST_ACTIONS = ["start", "end_session", "start_recording", "stop_recording", "status"] as const;
export type HostAction = typeof HOST_ACTIONS[number];

export type HostDeps = {
  configured(): boolean;
  getUser(token: string): Promise<{ id: string } | null>;
  rpcAsUser(token: string, fn: string): Promise<unknown>;
  loadRow(room: Room, ref: string): Promise<RoomRow | null>;
  claimMeetingId(room: Room, ref: string, meetingId: string): Promise<boolean>;
  /** update … set is_live = false, mode = 'stream' where is_live and <key> <> $ref */
  clearOtherLive(room: Room, ref: string): Promise<{ code: string | null }>;
  /** update … set <patch> where <key> = $ref; returns the Postgres error code, if any */
  setRow(room: Room, ref: string, patch: Record<string, unknown>): Promise<{ code: string | null }>;
  upsertRecording(a: { meeting_id: string; room: Room; ref: string; provider_id: string; status: string }): Promise<void>;
  rtk: RtkApi;
};

type OpilRole = { admin?: boolean; judge?: boolean; facilitator_sessions?: number[] };

async function startRecordingFor(deps: HostDeps, meetingId: string, room: Room, ref: string) {
  const active = await deps.rtk.getActiveRecording(meetingId);
  if (active.ok && active.data?.id) {
    return { recording_id: active.data.id, status: active.data.status || "RECORDING", error: null as string | null };
  }
  const started = await deps.rtk.startRecording({
    meeting_id: meetingId,
    file_name_prefix: room === "academy" ? `academy_live_${ref}` : `opil_s${ref}`,
    max_seconds: 10800,
    video_config: { codec: "H264", width: 1280, height: 720, export_file: true },
    audio_config: { codec: "AAC", channel: "stereo", export_file: true },
    realtimekit_bucket_config: { enabled: true },
  });
  if (!started.ok || !started.data?.id) return { recording_id: null, status: null, error: started.error || "cloudflare_error" };
  await deps.upsertRecording({ meeting_id: meetingId, room, ref, provider_id: started.data.id, status: started.data.status || "INVOKED" });
  return { recording_id: started.data.id, status: started.data.status || "INVOKED", error: null };
}

export async function handleHost(req: Request, deps: HostDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!deps.configured()) return json({ error: "rtk_not_configured" }, 503);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "sign_in" }, 401);
  const user = await deps.getUser(token);
  if (!user) return json({ error: "sign_in" }, 401);

  let body: { room?: string; live_id?: string; session_no?: unknown; action?: string; record?: boolean } = {};
  try { body = await req.json(); } catch (_e) { /* handled below */ }
  const room: Room | null = body.room === "opil" ? "opil" : body.room === "academy" ? "academy" : null;
  if (!room) return json({ error: "bad_room" }, 400);
  const action = body.action as HostAction;
  if (!HOST_ACTIONS.includes(action)) return json({ error: "bad_action" }, 400);

  // ---- host-only, exactly the rule ea-live-publish uses ----
  let ref: string;
  if (room === "academy") {
    if (typeof body.live_id !== "string" || !body.live_id) return json({ error: "bad_room" }, 400);
    ref = body.live_id;
    if (await deps.rpcAsUser(token, "ea_is_admin") !== true) return json({ error: "not_allowed" }, 403);
  } else {
    const no = Number(body.session_no);
    if (!Number.isInteger(no)) return json({ error: "bad_session" }, 400);
    ref = String(no);
    const role = (await deps.rpcAsUser(token, "ea_opil_my_role")) as OpilRole | null;
    const fac = Array.isArray(role?.facilitator_sessions) ? role!.facilitator_sessions! : [];
    if (!(role?.admin === true || fac.includes(no))) return json({ error: "not_allowed" }, 403);
  }

  const row = await deps.loadRow(room, ref);
  if (!row) return json({ error: "not_found" }, 404);

  // ---- status: the only action that works before a meeting exists ----
  if (action === "status") {
    if (!row.rtk_meeting_id) return json({ active: false, live_participants: null, recording: null });
    const sess = await deps.rtk.getActiveSession(row.rtk_meeting_id);
    const rec = await deps.rtk.getActiveRecording(row.rtk_meeting_id);
    return json({
      active: !!(sess.ok && sess.data?.id),
      live_participants: sess.ok && sess.data ? (sess.data.live_participants ?? null) : null,
      recording: rec.ok && rec.data?.id ? { id: rec.data.id, status: rec.data.status || "RECORDING" } : null,
    });
  }

  // ---- everything else needs the meeting ----
  const io: MeetingIo = { rtk: deps.rtk, loadRow: deps.loadRow, claimMeetingId: deps.claimMeetingId };

  if (action === "start") {
    // v1: room mode is members-only. A public Academy row is broadcast-only (the button is
    // disabled on the page; this is the server backstop).
    if (room === "academy" && row.access === "public") return json({ error: "not_allowed" }, 403);

    // 1. the meeting. ea-rtk-join already reactivated an INACTIVE one before it handed this
    //    host a token (the page joins first, `start` runs on `joined`), so this repeat is belt
    //    and braces for a caller that reaches `start` without a join — curl, or a future task.
    const got = await createOrGetMeeting(io, room, ref, row);
    if (!got.meeting_id) return json({ error: got.error || "cloudflare_error" }, got.status === 200 ? 502 : got.status);
    const meetingId = got.meeting_id;
    const m = await deps.rtk.getMeeting(meetingId);
    if (m.ok && m.data?.status === "INACTIVE") await deps.rtk.setMeetingStatus(meetingId, "ACTIVE");

    // 2. the one-live rule. Service role bypasses RLS but not the partial unique index,
    //    so on 23505 (two hosts in the same instant) retry the pair once, then 409.
    let flip = { code: null as string | null };
    for (let attempt = 0; attempt < 2; attempt++) {
      const cleared = await deps.clearOtherLive(room, ref);
      if (cleared.code) return json({ error: "another_live" }, 409);
      flip = await deps.setRow(room, ref, { is_live: true, mode: "meeting" });
      if (!flip.code) break;
      if (flip.code !== "23505") return json({ error: "db_" + flip.code }, 500);
    }
    if (flip.code) return json({ error: "another_live" }, 409);

    // 2b. pin the session so a delayed meeting.ended from the previous session cannot
    //     flip this room off air. Always an explicit write — never leave a stale id.
    const sess = await deps.rtk.getActiveSession(meetingId);
    await deps.setRow(room, ref, {
      rtk_session_id: sess.ok && sess.data?.id ? sess.data.id : null,
      rtk_started_at: new Date().toISOString(),
    });

    // 3. the recording (default on)
    let recordingId: string | null = null;
    if (body.record !== false) {
      const rec = await startRecordingFor(deps, meetingId, room, ref);
      recordingId = rec.recording_id;
    }
    return json({ meeting_id: meetingId, is_live: true, mode: "meeting", recording_id: recordingId });
  }

  if (!row.rtk_meeting_id) return json({ error: "not_found" }, 404);
  const meetingId = row.rtk_meeting_id;

  if (action === "start_recording") {
    const rec = await startRecordingFor(deps, meetingId, room, ref);
    if (!rec.recording_id) return json({ error: rec.error }, 502);
    // recording_status, never status: js/rtk-room.js's post() merges the body over
    // { status: res.status }, so a `status` key here would clobber the HTTP code.
    return json({ recording_id: rec.recording_id, recording_status: rec.status });
  }

  if (action === "stop_recording") {
    const active = await deps.rtk.getActiveRecording(meetingId);
    if (!active.ok || !active.data?.id) return json({ stopped: false, recording_id: null });
    const stopped = await deps.rtk.stopRecording(active.data.id);
    if (!stopped.ok) return json({ error: stopped.error || "cloudflare_error" }, 502);
    return json({ stopped: true, recording_id: active.data.id });
  }

  // end_session: stop the recording FIRST so the file has the last words, then kick-all,
  // then take the row off air and back to broadcast mode.
  const active = await deps.rtk.getActiveRecording(meetingId);
  if (active.ok && active.data?.id) await deps.rtk.stopRecording(active.data.id);
  const kicked = await deps.rtk.kickAll(meetingId);
  await deps.setRow(room, ref, { is_live: false, mode: "stream" });
  return json({
    ended: true,
    kicked_participants_count: kicked.ok && kicked.data ? (kicked.data.kicked_participants_count ?? 0) : 0,
    mode: "stream",
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/ea-rtk-host/handler_test.ts`
Expected: `ok | 16 passed | 0 failed`.

- [ ] **Step 5: Write the deployable entry point**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-host/index.ts`:

```ts
// ea-rtk-host — host-only room actions: start / end_session / start_recording /
// stop_recording / status. verify_jwt OFF; own auth, same rule as ea-live-publish.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected), CF_ACCOUNT_ID,
//          CF_RTK_APP_ID, CF_RTK_API_TOKEN. Project pgqdmnmessbbzyszjfvr. Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rtk, rtkConfigured, roomTable, type Room, type RoomRow } from "../_shared/rtk.ts";
import { handleHost, type HostDeps } from "./handler.ts";

const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const keyOf = (room: Room, ref: string) => (room === "opil" ? Number(ref) : ref);

export function realDeps(): HostDeps {
  return {
    configured: rtkConfigured,
    async getUser(token) {
      const { data: { user }, error } = await admin.auth.getUser(token);
      return error || !user ? null : { id: user.id };
    },
    async rpcAsUser(token, fn) {
      const asUser = createClient(URL_, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data } = await asUser.rpc(fn);
      return data;
    },
    async loadRow(room, ref) {
      const t = roomTable(room);
      let q = admin.from(t.table)
        .select("title, is_live, mode, rtk_meeting_id, rtk_session_id, rtk_started_at" + (room === "academy" ? ", access" : ""))
        .eq(t.key, keyOf(room, ref));
      if (room === "opil") q = q.eq("kind", "thread");
      const { data } = await q.maybeSingle();
      if (!data) return null;
      const r = data as Record<string, unknown>;
      return {
        ref,
        title: (r.title as string) ?? null,
        is_live: r.is_live === true,
        mode: (r.mode as string) ?? "stream",
        rtk_meeting_id: (r.rtk_meeting_id as string) ?? null,
        rtk_session_id: (r.rtk_session_id as string) ?? null,
        rtk_started_at: (r.rtk_started_at as string) ?? null,
        access: (r.access as string) ?? null,
      } as RoomRow;
    },
    async claimMeetingId(room, ref, meetingId) {
      const t = roomTable(room);
      const { data } = await admin.from(t.table)
        .update({ rtk_meeting_id: meetingId }).eq(t.key, keyOf(room, ref)).is("rtk_meeting_id", null).select(t.key);
      return Array.isArray(data) && data.length > 0;
    },
    async clearOtherLive(room, ref) {
      const t = roomTable(room);
      const { error } = await admin.from(t.table)
        .update({ is_live: false, mode: "stream" }).eq("is_live", true).neq(t.key, keyOf(room, ref));
      return { code: error ? (error.code || "unknown") : null };
    },
    async setRow(room, ref, patch) {
      const t = roomTable(room);
      const { error } = await admin.from(t.table).update(patch).eq(t.key, keyOf(room, ref));
      return { code: error ? (error.code || "unknown") : null };
    },
    async upsertRecording(a) {
      // NOT .upsert(): ea_rtk_artifacts_recording_idx is a PARTIAL unique index and PostgREST's
      // onConflict= emits `ON CONFLICT (provider_id)` with no predicate, which Postgres rejects
      // with 42P10. ea_rtk_upsert_artifact (0029 block 5b) repeats the predicate.
      await admin.rpc("ea_rtk_upsert_artifact", {
        p: {
          meeting_id: a.meeting_id, room: a.room, ref: a.ref, kind: "recording",
          provider_id: a.provider_id, status: a.status,
        },
      });
    },
    rtk,
  };
}

Deno.serve((req: Request) => handleHost(req, realDeps()));
```

- [ ] **Step 6: Type-check and deploy**

```bash
cd /Users/nelsontaylor/taylormade-academy
deno check supabase/functions/ea-rtk-host/index.ts
supabase functions deploy ea-rtk-host --no-verify-jwt --project-ref "$SB_REF"
```
Expected: no diagnostics, then `Deployed Functions on project pgqdmnmessbbzyszjfvr: ea-rtk-host`.

- [ ] **Step 7: Live curl — the auth matrix and the safe action**

```bash
LIVE_ID="$(curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $TMA_ADMIN_JWT" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -X POST "$SB_REST/ea_live" -d '{"title":"zz-test-rtk-host","is_live":false,"access":"members"}' | jq -r '.[0].id')"

echo '--- member -> 403 not_allowed'
curl -sS -X POST "$FN/ea-rtk-host" -H "Authorization: Bearer $TMA_MEMBER_JWT" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\",\"action\":\"status\"}"; echo

echo '--- admin, unknown action -> 400 bad_action'
curl -sS -X POST "$FN/ea-rtk-host" -H "Authorization: Bearer $TMA_ADMIN_JWT" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\",\"action\":\"explode\"}"; echo

echo '--- admin, status on a room that was never started -> no Cloudflare call'
curl -sS -X POST "$FN/ea-rtk-host" -H "Authorization: Bearer $TMA_ADMIN_JWT" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\",\"action\":\"status\"}"; echo

echo '--- admin, end_session on a room with no meeting -> 404 not_found'
curl -sS -X POST "$FN/ea-rtk-host" -H "Authorization: Bearer $TMA_ADMIN_JWT" \
  -H "Content-Type: application/json" -d "{\"room\":\"academy\",\"live_id\":\"$LIVE_ID\",\"action\":\"end_session\"}"; echo
```
Expected, in order: `{"error":"not_allowed"}`, `{"error":"bad_action"}`, `{"active":false,"live_participants":null,"recording":null}`, `{"error":"not_found"}`.

`start` is **not** curl-tested here: it bills participant minutes and needs a joined host. It is exercised end-to-end in Task 9's rehearsal.

- [ ] **Step 8: Clean up**

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"delete from public.ea_live where title like '\''zz-test-%'\''; select count(*) as leftover from public.ea_live where title like '\''zz-test-%'\'';"}'
```
Expected: `[{"leftover":0}]`.

- [ ] **Step 9: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/functions/ea-rtk-host
git commit -m "feat(live): ea-rtk-host — start, end, recording toggle and status without a reload"
```

---

## Task 5: `ea-rtk-webhook` — signature, dedupe, event effects, Stream copy, artifacts

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/handler.ts`
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/index.ts`
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/meeting.ended.json`
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/recording.statusUpdate.UPLOADED.json`
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/meeting.transcript.json`
- Create: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/meeting.summary.json`
- Test: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/handler_test.ts`

**Interfaces:**
- Consumes: `_shared/rtk.ts` (`Room`, `RtkApi`, `rtk`, `roomTable`); Task 1's `ea_rtk_events`, `ea_rtk_artifacts` behind `public.ea_rtk_upsert_artifact(p jsonb)` (the only legal writer — the three keys are partial unique indexes and PostgREST cannot express their predicates), `ea_live.replay_url`, `ea_opil_sessions.recording_url`, and the four server columns; secrets `CF_RTK_WEBHOOK_ID`, `CF_ACCOUNT_ID`, `CF_API_TOKEN` (Stream:Edit), `CF_STREAM_SUBDOMAIN`.
- Produces (internal to this task, plus Task 9's rehearsal checks):
  - `async function verifySignature(raw: ArrayBuffer, sigB64: string, pem: string): Promise<boolean>`
  - `function redact(payload: unknown): unknown` — replaces any key matching `/stream_?key/i` with `"[redacted]"`
  - `function pickMeetingId(p: Record<string, unknown>): string | null`, `function pickSessionId(p: Record<string, unknown>): string | null`
  - `type ArtifactUpsert = { meeting_id: string; session_id: string | null; room: Room; ref: string; kind: "recording"|"transcript"|"summary"|"playbook"; provider_id?: string|null; status?: string|null; url?: string|null; expires_at?: string|null; text?: string|null; data?: unknown; meta?: Record<string, unknown> }`
  - `type WebhookDeps = { publicKeyPem(): Promise<string|null>; expectedWebhookId(): string|null; claimEvent(e): Promise<"new"|"duplicate">; finishEvent(id, error): Promise<void>; findRoom(meetingId): Promise<{room: Room; ref: string; title: string|null}|null>; pinSession(meetingId, sessionId): Promise<void>; offAir(meetingId, sessionId): Promise<void>; upsertArtifact(a: ArtifactUpsert): Promise<void>; readArtifacts(room, ref): Promise<Array<{kind: string; status: string|null; text: string|null}>>; setReplay(room, ref, url): Promise<void>; streamCopy(url, name): Promise<{uid: string|null; status: number}>; fetchText(url): Promise<{status: number; text: string}>; hostNames(meetingId): Promise<string[]>; rtk: RtkApi }`
  - `async function handleWebhook(req: Request, deps: WebhookDeps): Promise<Response>` — `200` handled / duplicate / unknown, `401` bad signature or wrong webhook id, `503` transient failure (RealtimeKit retries 5xx, never 4xx).

- [ ] **Step 1: Write the four fixture bodies**

These carry the documented envelope shape; Task 9 Step 8 replaces them with the real captures from `ea_rtk_events` if Cloudflare's shape differs (spike 10(c) is the only unpinned piece, and `pickMeetingId`/`pickSessionId` already probe every plausible path).

`/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/meeting.ended.json`:
```json
{"event":"meeting.ended","meeting":{"id":"m1","title":"OPIL Session 3 — zz-test"},"session":{"id":"s1"}}
```

`/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/recording.statusUpdate.UPLOADED.json`:
```json
{"event":"recording.statusUpdate","meeting":{"id":"m1"},"session":{"id":"s1"},"recording":{"id":"r1","status":"UPLOADED","downloadUrl":"https://rtk-bucket.example/r1.mp4?sig=abc","downloadUrlExpiry":"2026-09-18T00:00:00Z","fileSize":123456,"recordingDuration":3600,"outputFileName":"opil_s3.mp4"},"streamKey":"super-secret-key"}
```

`/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/meeting.transcript.json`:
```json
{"event":"meeting.transcript","meeting":{"id":"m1"},"session":{"id":"s1"},"transcriptDownloadUrl":"https://rtk-bucket.example/s1.csv?sig=abc","transcriptDownloadUrlExpiry":"2026-09-18T00:00:00Z"}
```

`/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/meeting.summary.json`:
```json
{"event":"meeting.summary","meeting":{"id":"m1"},"session":{"id":"s1"},"summaryDownloadUrl":"https://rtk-bucket.example/s1.md?sig=abc","summaryDownloadUrlExpiry":"2026-09-18T00:00:00Z"}
```

- [ ] **Step 2: Write the failing test**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/handler_test.ts`:

```ts
// deno test -A supabase/functions/ea-rtk-webhook/handler_test.ts
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleWebhook, redact, pickMeetingId, pickSessionId } from "./handler.ts";
import type { ArtifactUpsert, WebhookDeps } from "./handler.ts";
import type { RtkApi } from "../_shared/rtk.ts";

// --- a real RSA key pair, so the signature path is exercised for real, offline ---
const pair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"],
) as CryptoKeyPair;
const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
const PEM = "-----BEGIN PUBLIC KEY-----\n" + btoa(String.fromCharCode(...spki)).replace(/(.{64})/g, "$1\n") + "\n-----END PUBLIC KEY-----";
async function sign(raw: Uint8Array): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, raw));
  return btoa(String.fromCharCode(...sig));
}
const fixture = (name: string) => Deno.readTextFileSync(new URL(`./fixtures/${name}.json`, import.meta.url));

async function signedReq(bodyText: string, over: Record<string, string> = {}) {
  const raw = new TextEncoder().encode(bodyText);
  return new Request("https://fn/ea-rtk-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "rtk-signature": await sign(raw),
      "rtk-uuid": "d-1",
      "rtk-webhook-id": "wh-1",
      ...over,
    },
    body: bodyText,
  });
}

const okR = <T>(data: T) => Promise.resolve({ status: 200, ok: true, data, error: null });
const fakeRtk = (over: Partial<RtkApi> = {}): RtkApi => ({
  createMeeting: () => okR({ id: "m1" }), getMeeting: () => okR({ id: "m1" }),
  setMeetingStatus: () => okR({ id: "m1" }), retireMeeting: () => okR({ id: "m1" }),
  addParticipant: () => okR({ id: "p", token: "t" }), editParticipantPreset: () => okR({ id: "p", token: "t" }),
  refreshParticipantToken: () => okR({ token: "t" }), getActiveSession: () => okR({ id: "s1" }),
  kickAll: () => okR({ kicked_participants_count: 0 }), startRecording: () => okR({ id: "r1" }),
  getActiveRecording: () => okR({ id: "r1" }), stopRecording: () => okR({ id: "r1" }),
  getSessionTranscript: () => okR({ lines: [] }), ...over,
} as RtkApi);

type Spy = { events: unknown[]; artifacts: ArtifactUpsert[]; replays: string[]; offAir: Array<[string, string | null]>; pins: Array<[string, string]>; finished: Array<[string, string | null]> };
function deps(over: Partial<WebhookDeps> = {}, spy?: Spy): WebhookDeps {
  const s = spy || { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  return {
    publicKeyPem: () => Promise.resolve(PEM),
    expectedWebhookId: () => "wh-1",
    claimEvent: (e) => { s.events.push(e); return Promise.resolve("new"); },
    finishEvent: (id, err) => { s.finished.push([id, err]); return Promise.resolve(); },
    findRoom: () => Promise.resolve({ room: "opil", ref: "3", title: "Open Payments" }),
    pinSession: (m, sid) => { s.pins.push([m, sid]); return Promise.resolve(); },
    offAir: (m, sid) => { s.offAir.push([m, sid]); return Promise.resolve(); },
    upsertArtifact: (a) => { s.artifacts.push(a); return Promise.resolve(); },
    readArtifacts: () => Promise.resolve([]),
    setReplay: (_r, _f, url) => { s.replays.push(url); return Promise.resolve(); },
    streamCopy: () => Promise.resolve({ uid: "v-uid", status: 200 }),
    fetchText: () => Promise.resolve({ status: 200, text: "speaker,text\nAva,hello" }),
    hostNames: () => Promise.resolve(["Nelson"]),
    rtk: fakeRtk(),
    ...over,
  };
}

Deno.test("redact removes anything that looks like a stream key", () => {
  const r = redact({ streamKey: "s", nested: { stream_key: "s", keep: 1 } }) as Record<string, Record<string, unknown>>;
  assertEquals((r as unknown as Record<string, unknown>).streamKey, "[redacted]");
  assertEquals(r.nested.stream_key, "[redacted]");
  assertEquals(r.nested.keep, 1);
});

Deno.test("pickMeetingId / pickSessionId probe every documented shape", () => {
  assertEquals(pickMeetingId({ meeting: { id: "a" } }), "a");
  assertEquals(pickMeetingId({ meetingId: "b" }), "b");
  assertEquals(pickMeetingId({ data: { meeting: { id: "c" } } }), "c");
  assertEquals(pickMeetingId({ nothing: 1 }), null);
  assertEquals(pickSessionId({ session: { id: "s" } }), "s");
  assertEquals(pickSessionId({ sessionId: "t" }), "t");
  assertEquals(pickSessionId({ data: { sessionId: "u" } }), "u");
  assertEquals(pickSessionId({}), null);
});

Deno.test("a tampered body is 401 and never reaches the database", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const req = await signedReq(fixture("meeting.ended"));
  const tampered = new Request(req, { body: fixture("meeting.ended").replace("m1", "m2") });
  const r = await handleWebhook(tampered, deps({}, spy));
  assertEquals(r.status, 401);
  assertEquals(spy.events.length, 0);
});

Deno.test("a wrong rtk-webhook-id is 401", async () => {
  const r = await handleWebhook(await signedReq(fixture("meeting.ended"), { "rtk-webhook-id": "wh-other" }), deps());
  assertEquals(r.status, 401);
});

Deno.test("a duplicate rtk-uuid is 200 duplicate and does nothing twice", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const r = await handleWebhook(await signedReq(fixture("meeting.ended")),
    deps({ claimEvent: () => Promise.resolve("duplicate") }, spy));
  assertEquals(r.status, 200);
  assertEquals((await r.json()).result, "duplicate");
  assertEquals(spy.offAir.length, 0);
});

Deno.test("meeting.ended takes the room off air with the payload's session id", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const r = await handleWebhook(await signedReq(fixture("meeting.ended")), deps({}, spy));
  assertEquals(r.status, 200);
  assertEquals(spy.offAir, [["m1", "s1"]]);
  assertEquals(spy.finished, [["d-1", null]]);
});

Deno.test("meeting.started pins the session id", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const body = JSON.stringify({ event: "meeting.started", meeting: { id: "m1" }, session: { id: "s9" } });
  await handleWebhook(await signedReq(body), deps({}, spy));
  assertEquals(spy.pins, [["m1", "s9"]]);
});

Deno.env.delete("CF_STREAM_SUBDOMAIN");   // the operator exports CF_* in this shell; the test asserts the built-in fallback subdomain
Deno.test("recording.statusUpdate UPLOADED copies to Stream and writes the watch URL", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const r = await handleWebhook(await signedReq(fixture("recording.statusUpdate.UPLOADED")), deps({}, spy));
  assertEquals(r.status, 200);
  assertEquals(spy.replays, ["https://customer-nimm2h959enrq4x1.cloudflarestream.com/v-uid/watch"]);
  const art = spy.artifacts.find((a) => a.kind === "recording")!;
  assertEquals(art.provider_id, "r1");
  assertEquals(art.status, "UPLOADED");
  assertEquals(art.url, "https://customer-nimm2h959enrq4x1.cloudflarestream.com/v-uid/watch");
  assertEquals(art.expires_at, "2026-09-18T00:00:00Z");
  assertEquals((art.meta as Record<string, unknown>).recordingDuration, 3600);
  // the streamKey must never be persisted
  assertStringIncludes(JSON.stringify(spy.events[0]), "[redacted]");
});

Deno.test("a failing Stream copy is 503 with handled_at left null, and keeps the downloadUrl", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const r = await handleWebhook(await signedReq(fixture("recording.statusUpdate.UPLOADED")),
    deps({ streamCopy: () => Promise.resolve({ uid: null, status: 500 }) }, spy));
  assertEquals(r.status, 503);
  assertEquals(spy.replays.length, 0);
  const art = spy.artifacts.find((a) => a.kind === "recording")!;
  assertEquals((art.meta as Record<string, unknown>).downloadUrl, "https://rtk-bucket.example/r1.mp4?sig=abc");
  assertEquals(spy.finished[0][0], "d-1");
  assertEquals(typeof spy.finished[0][1], "string");   // the error is recorded, handled_at stays null
});

Deno.test("recording.statusUpdate ERRORED writes status only, no replay", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const body = JSON.stringify({ event: "recording.statusUpdate", meeting: { id: "m1" }, session: { id: "s1" }, recording: { id: "r2", status: "ERRORED" } });
  const r = await handleWebhook(await signedReq(body), deps({}, spy));
  assertEquals(r.status, 200);
  assertEquals(spy.replays.length, 0);
  assertEquals(spy.artifacts.find((a) => a.kind === "recording")!.status, "ERRORED");
});

Deno.test("meeting.transcript claims pending, stores the CSV, then composes a playbook whose Summary is pending", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const r = await handleWebhook(await signedReq(fixture("meeting.transcript")), deps({}, spy));
  assertEquals(r.status, 200);
  const t = spy.artifacts.filter((a) => a.kind === "transcript");
  assertEquals(t[0].status, "pending");
  assertEquals(t[1].status, "ready");
  assertStringIncludes(t[1].text!, "Ava,hello");
  const pb = spy.artifacts.filter((a) => a.kind === "playbook");
  assertEquals(pb[0].status, "pending");
  assertEquals(pb[1].status, "draft");
  assertStringIncludes(pb[1].text!, "### Summary\npending");
  assertStringIncludes(pb[1].text!, "Host(s): Nelson");
});

Deno.test("meeting.summary composes the same playbook row with the summary filled in", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  await handleWebhook(await signedReq(fixture("meeting.summary")),
    deps({
      fetchText: () => Promise.resolve({ status: 200, text: "## What we covered\nInterledger." }),
      readArtifacts: () => Promise.resolve([
        { kind: "transcript", status: "ready", text: "a\nb\nc" },
        { kind: "summary", status: "ready", text: "## What we covered\nInterledger." },
      ]),
    }, spy));
  const pb = spy.artifacts.filter((a) => a.kind === "playbook");
  assertStringIncludes(pb[1].text!, "## What we covered");
  assertStringIncludes(pb[1].text!, "stored (3 lines)");
  assertEquals(pb[1].session_id, "s1");
});

Deno.test("an expired download URL (4xx) is permanent: error, 200, no retry", async () => {
  const r = await handleWebhook(await signedReq(fixture("meeting.summary")),
    deps({ fetchText: () => Promise.resolve({ status: 403, text: "" }) }));
  assertEquals(r.status, 200);
  assertEquals((await r.json()).result, "error");
});

Deno.test("a transient download failure (5xx) is 503 so RealtimeKit retries", async () => {
  const r = await handleWebhook(await signedReq(fixture("meeting.summary")),
    deps({ fetchText: () => Promise.resolve({ status: 502, text: "" }) }));
  assertEquals(r.status, 503);
});

Deno.test("livestreaming.statusUpdate and unknown events are audited and 200", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const ls = await handleWebhook(await signedReq(JSON.stringify({ event: "livestreaming.statusUpdate", meeting: { id: "m1" }, streamKey: "s" })), deps({}, spy));
  assertEquals(ls.status, 200);
  assertEquals((await ls.json()).result, "audit");
  const un = await handleWebhook(await signedReq(JSON.stringify({ event: "meeting.chatSynced", meeting: { id: "m1" } })), deps({}, spy));
  assertEquals((await un.json()).result, "audit");
  assertEquals(spy.artifacts.length, 0);
});

Deno.test("an unknown meeting is audit only", async () => {
  const spy: Spy = { events: [], artifacts: [], replays: [], offAir: [], pins: [], finished: [] };
  const r = await handleWebhook(await signedReq(fixture("meeting.ended")), deps({ findRoom: () => Promise.resolve(null) }, spy));
  assertEquals(r.status, 200);
  assertEquals((await r.json()).result, "audit");
  assertEquals(spy.offAir.length, 0);
});

Deno.test("GET is 405", async () => {
  const r = await handleWebhook(new Request("https://fn", { method: "GET" }), deps());
  assertEquals(r.status, 405);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/ea-rtk-webhook/handler_test.ts`
Expected: FAIL — `Module not found "file:///…/ea-rtk-webhook/handler.ts"`.

- [ ] **Step 4: Write the handler**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/handler.ts`:

```ts
// ea-rtk-webhook/handler.ts — RealtimeKit → us. No CORS (server-to-server); the RSA
// signature over the RAW bytes is the auth. Work runs inline: EdgeRuntime.waitUntil is
// unproven on this runtime (spike 17) and a one-hour transcript CSV is well under a MB.
// Store content, never links: every RealtimeKit artifact expires after seven days.
// Spec: §6, §7, §8

import type { Room, RtkApi } from "../_shared/rtk.ts";

const STREAM_SUBDOMAIN_FALLBACK = "customer-nimm2h959enrq4x1";

export type ArtifactUpsert = {
  meeting_id: string;
  session_id: string | null;
  room: Room;
  ref: string;
  kind: "recording" | "transcript" | "summary" | "playbook";
  provider_id?: string | null;
  status?: string | null;
  url?: string | null;
  expires_at?: string | null;
  text?: string | null;
  data?: unknown;
  meta?: Record<string, unknown>;
};

export type WebhookDeps = {
  publicKeyPem(): Promise<string | null>;
  expectedWebhookId(): string | null;
  claimEvent(e: { id: string; webhook_id: string | null; event: string; meeting_id: string | null; session_id: string | null; payload: unknown }): Promise<"new" | "duplicate">;
  finishEvent(id: string, error: string | null): Promise<void>;
  findRoom(meetingId: string): Promise<{ room: Room; ref: string; title: string | null } | null>;
  pinSession(meetingId: string, sessionId: string): Promise<void>;
  offAir(meetingId: string, sessionId: string | null): Promise<void>;
  upsertArtifact(a: ArtifactUpsert): Promise<void>;
  readArtifacts(room: Room, ref: string): Promise<Array<{ kind: string; status: string | null; text: string | null }>>;
  setReplay(room: Room, ref: string, url: string): Promise<void>;
  streamCopy(url: string, name: string): Promise<{ uid: string | null; status: number }>;
  fetchText(url: string): Promise<{ status: number; text: string }>;
  hostNames(meetingId: string): Promise<string[]>;
  rtk: RtkApi;
};

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Any key that looks like a stream key is replaced before the payload is persisted. */
export function redact(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map(redact);
  if (payload && typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = /stream_?key/i.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return payload;
}

const asStr = (v: unknown) => (typeof v === "string" && v ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" ? v as Record<string, unknown> : {});

/** Spike 10(c) never pinned which envelope Cloudflare sends, so probe each documented shape. */
export function pickMeetingId(p: Record<string, unknown>): string | null {
  return asStr(obj(p.meeting).id) || asStr(p.meetingId)
    || asStr(obj(obj(p.data).meeting).id) || asStr(obj(p.data).meetingId);
}
export function pickSessionId(p: Record<string, unknown>): string | null {
  return asStr(obj(p.session).id) || asStr(p.sessionId)
    || asStr(obj(obj(p.data).session).id) || asStr(obj(p.data).sessionId);
}

export async function verifySignature(raw: ArrayBuffer, sigB64: string, pem: string): Promise<boolean> {
  try {
    const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("spki", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, raw);
  } catch (_e) {
    return false;
  }
}

/** The v1 playbook draft: the summary with a header. Nothing is generated by us. */
function composePlaybook(
  room: Room, ref: string, title: string | null, hosts: string[],
  arts: Array<{ kind: string; status: string | null; text: string | null }>,
): string {
  const head = room === "opil"
    ? `Session ${String(ref).padStart(2, "0")} · ${title || "OPIL Lab"}`
    : `Academy Live · ${title || "Taylormade Academy Live"}`;
  const date = new Date().toISOString().slice(0, 10);
  const summary = arts.find((a) => a.kind === "summary" && a.status === "ready")?.text;
  const transcript = arts.find((a) => a.kind === "transcript" && a.status === "ready")?.text;
  const lines = transcript ? `stored (${transcript.split("\n").filter((l) => l.trim()).length} lines)` : "pending";
  return [
    `# ${head} — ${date}`,
    `Host(s): ${hosts.length ? hosts.join(", ") : "Host"}`,
    "",
    "### Summary",
    summary || "pending",
    "",
    "### Transcript",
    lines,
    "",
  ].join("\n");
}

export async function handleWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method !== "POST") return jsonRes({ error: "method_not_allowed" }, 405);

  // 1. the raw bytes, BEFORE anything else: re-serialising the JSON breaks the signature.
  const raw = await req.arrayBuffer();
  const sig = req.headers.get("rtk-signature") || "";
  const uuid = req.headers.get("rtk-uuid") || "";
  const whId = req.headers.get("rtk-webhook-id");
  const expected = deps.expectedWebhookId();
  if (!sig || !uuid) return jsonRes({ error: "unsigned" }, 401);
  if (expected && whId !== expected) return jsonRes({ error: "wrong_webhook" }, 401);
  const pem = await deps.publicKeyPem();
  if (!pem || !(await verifySignature(raw, sig, pem))) return jsonRes({ error: "bad_signature" }, 401);

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch (_e) { return jsonRes({ error: "bad_json" }, 401); }
  const event = asStr(payload.event) || "unknown";
  const meetingId = pickMeetingId(payload);
  const sessionId = pickSessionId(payload);

  // 2. dedupe. "duplicate" only when an earlier attempt actually finished.
  const claim = await deps.claimEvent({
    id: uuid, webhook_id: whId, event, meeting_id: meetingId, session_id: sessionId, payload: redact(payload),
  });
  if (claim === "duplicate") return jsonRes({ result: "duplicate" });

  const audit = async (why: string) => { await deps.finishEvent(uuid, null); return jsonRes({ result: "audit", why }); };
  if (!meetingId) return await audit("no_meeting_id");
  const target = await deps.findRoom(meetingId);
  if (!target) return await audit("unknown_meeting");          // breakout (connected) meetings land here
  const { room, ref, title } = target;

  const upsertPlaybook = async () => {
    await deps.upsertArtifact({ meeting_id: meetingId, session_id: sessionId, room, ref, kind: "playbook", status: "pending" });
    const arts = await deps.readArtifacts(room, ref);
    const hosts = await deps.hostNames(meetingId);
    await deps.upsertArtifact({
      meeting_id: meetingId, session_id: sessionId, room, ref, kind: "playbook",
      status: "draft", text: composePlaybook(room, ref, title, hosts, arts),
    });
  };

  try {
    if (event === "meeting.started") {
      if (sessionId) await deps.pinSession(meetingId, sessionId);
      await deps.finishEvent(uuid, null);
      return jsonRes({ result: "handled", event });
    }

    if (event === "meeting.ended") {
      await deps.offAir(meetingId, sessionId);
      await deps.finishEvent(uuid, null);
      return jsonRes({ result: "handled", event });
    }

    if (event === "recording.statusUpdate") {
      const rec = obj(payload.recording);
      const providerId = asStr(rec.id) || asStr(payload.recordingId);
      const status = asStr(rec.status) || asStr(payload.status) || "UNKNOWN";
      const downloadUrl = asStr(rec.downloadUrl) || asStr(payload.downloadUrl);
      const expiry = asStr(rec.downloadUrlExpiry) || asStr(payload.downloadUrlExpiry);
      const meta: Record<string, unknown> = {
        fileSize: rec.fileSize ?? null,
        recordingDuration: rec.recordingDuration ?? null,
        outputFileName: rec.outputFileName ?? null,
      };
      if (status !== "UPLOADED" || !downloadUrl) {
        await deps.upsertArtifact({ meeting_id: meetingId, session_id: sessionId, room, ref, kind: "recording", provider_id: providerId, status, expires_at: expiry, meta });
        await deps.finishEvent(uuid, null);
        return jsonRes({ result: "handled", event, status });
      }
      const name = room === "opil"
        ? `OPIL Session ${String(ref).padStart(2, "0")} — ${title || "Lab"} — ${new Date().toISOString().slice(0, 10)}`
        : `Academy Live — ${title || "Live"} — ${new Date().toISOString().slice(0, 10)}`;
      const copy = await deps.streamCopy(downloadUrl, name);
      if (!copy.uid) {
        // keep the downloadUrl so a manual recovery has it while the 7 days last
        await deps.upsertArtifact({ meeting_id: meetingId, session_id: sessionId, room, ref, kind: "recording", provider_id: providerId, status, expires_at: expiry, meta: { ...meta, downloadUrl } });
        await deps.finishEvent(uuid, `stream_copy_${copy.status}`);
        return jsonRes({ error: `stream_copy_${copy.status}` }, 503);   // RealtimeKit retries 5xx
      }
      const sub = Deno.env.get("CF_STREAM_SUBDOMAIN") || STREAM_SUBDOMAIN_FALLBACK;
      const watch = `https://${sub}.cloudflarestream.com/${copy.uid}/watch`;
      await deps.upsertArtifact({ meeting_id: meetingId, session_id: sessionId, room, ref, kind: "recording", provider_id: providerId, status, url: watch, expires_at: expiry, meta });
      await deps.setReplay(room, ref, watch);
      await deps.finishEvent(uuid, null);
      return jsonRes({ result: "handled", event, watch });
    }

    if (event === "meeting.transcript" || event === "meeting.summary") {
      const kind = event === "meeting.transcript" ? "transcript" : "summary";
      const url = kind === "transcript"
        ? (asStr(payload.transcriptDownloadUrl) || asStr(obj(payload.transcript).downloadUrl))
        : (asStr(payload.summaryDownloadUrl) || asStr(obj(payload.summary).downloadUrl));
      const expiry = asStr(payload.transcriptDownloadUrlExpiry) || asStr(payload.summaryDownloadUrlExpiry);
      await deps.upsertArtifact({ meeting_id: meetingId, session_id: sessionId, room, ref, kind, status: "pending" });
      if (!url) {
        await deps.finishEvent(uuid, "no_download_url");
        return jsonRes({ result: "error", why: "no_download_url" });    // 200: a retry cannot help
      }
      const got = await deps.fetchText(url);
      if (got.status >= 500 || got.status === 0) {
        await deps.finishEvent(uuid, `download_${got.status}`);
        return jsonRes({ error: `download_${got.status}` }, 503);       // transient → retry
      }
      if (got.status >= 400) {
        await deps.finishEvent(uuid, `download_${got.status}`);
        return jsonRes({ result: "error", why: `download_${got.status}` });  // expired link → permanent
      }
      let data: unknown = null;
      if (kind === "transcript" && sessionId) {
        const j = await deps.rtk.getSessionTranscript(sessionId);
        if (j.ok) data = j.data;
      }
      await deps.upsertArtifact({
        meeting_id: meetingId, session_id: sessionId, room, ref, kind,
        status: "ready", text: got.text, data, expires_at: expiry,
      });
      await upsertPlaybook();
      await deps.finishEvent(uuid, null);
      return jsonRes({ result: "handled", event });
    }

    // livestreaming.statusUpdate (v1: audit only — the webhook vocabulary LIVE|OFFLINE|IDLE
    // differs from the REST enum LIVE|IDLE|ERRORED|INVOKED) and everything else.
    return await audit(event);
  } catch (e) {
    await deps.finishEvent(uuid, String((e as Error).message || e).slice(0, 500));
    return jsonRes({ error: "handler_failed" }, 503);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/nelsontaylor/taylormade-academy && deno test -A supabase/functions/ea-rtk-webhook/handler_test.ts`
Expected: `ok | 17 passed | 0 failed`.

- [ ] **Step 6: Write the deployable entry point**

Create `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/index.ts`:

```ts
// ea-rtk-webhook — RealtimeKit's events. verify_jwt OFF; the RSA signature over the raw
// body is the auth, plus rtk-webhook-id === CF_RTK_WEBHOOK_ID. No CORS surface.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected), CF_RTK_WEBHOOK_ID,
//          CF_ACCOUNT_ID, CF_API_TOKEN (Stream:Edit), CF_STREAM_SUBDOMAIN,
//          CF_RTK_APP_ID + CF_RTK_API_TOKEN (the session transcript fetch).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rtk, roomTable, type Room } from "../_shared/rtk.ts";
import { handleWebhook, type WebhookDeps } from "./handler.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const keyOf = (room: Room, ref: string) => (room === "opil" ? Number(ref) : ref);

let keyCache: { pem: string; at: number } | null = null;
async function publicKeyPem(): Promise<string | null> {
  if (keyCache && Date.now() - keyCache.at < 24 * 3600_000) return keyCache.pem;
  try {
    const r = await fetch("https://api.realtime.cloudflare.com/.well-known/webhooks.json");
    const j = await r.json();
    const pem = j?.data?.publicKey;
    if (typeof pem !== "string") return null;
    keyCache = { pem, at: Date.now() };
    return pem;
  } catch (_e) { return null; }
}

export function realDeps(): WebhookDeps {
  return {
    publicKeyPem,
    expectedWebhookId: () => Deno.env.get("CF_RTK_WEBHOOK_ID") || null,
    async claimEvent(e) {
      const { data } = await admin.from("ea_rtk_events")
        .insert({ id: e.id, webhook_id: e.webhook_id, event: e.event, meeting_id: e.meeting_id, session_id: e.session_id, payload: e.payload })
        .select("id");
      if (Array.isArray(data) && data.length) return "new";
      // the row exists: only a FINISHED attempt makes this a duplicate
      const { data: prev } = await admin.from("ea_rtk_events").select("handled_at").eq("id", e.id).maybeSingle();
      return prev?.handled_at ? "duplicate" : "new";
    },
    async finishEvent(id, error) {
      await admin.from("ea_rtk_events")
        .update(error ? { error } : { handled_at: new Date().toISOString(), error: null }).eq("id", id);
    },
    async findRoom(meetingId) {
      const { data: a } = await admin.from("ea_live").select("id, title").eq("rtk_meeting_id", meetingId).maybeSingle();
      if (a) return { room: "academy", ref: String(a.id), title: a.title ?? null };
      const { data: o } = await admin.from("ea_opil_sessions").select("no, title").eq("rtk_meeting_id", meetingId).maybeSingle();
      if (o) return { room: "opil", ref: String(o.no), title: o.title ?? null };
      return null;
    },
    async pinSession(meetingId, sessionId) {
      await admin.from("ea_live").update({ rtk_session_id: sessionId }).eq("rtk_meeting_id", meetingId).is("rtk_session_id", null);
      await admin.from("ea_opil_sessions").update({ rtk_session_id: sessionId }).eq("rtk_meeting_id", meetingId).is("rtk_session_id", null);
    },
    async offAir(meetingId, sessionId) {
      // Guarded against the restart race: only a row still in room mode, and only when the
      // payload names this row's session (or the row has none). With no session id in the
      // payload, a room (re)started in the last 150 s is never touched.
      const cutoff = new Date(Date.now() - 150_000).toISOString();
      for (const table of ["ea_live", "ea_opil_sessions"]) {
        let q = admin.from(table).update({ is_live: false, mode: "stream" })
          .eq("rtk_meeting_id", meetingId).eq("mode", "meeting");
        q = sessionId ? q.or(`rtk_session_id.is.null,rtk_session_id.eq.${sessionId}`) : q.lt("rtk_started_at", cutoff);
        await q;
      }
    },
    async upsertArtifact(a) {
      // NOT .upsert(): all three artifact keys are PARTIAL unique indexes
      // (ea_rtk_artifacts_recording_idx, _session_kind_idx, _room_ref_kind_idx) and PostgREST's
      // onConflict= emits `ON CONFLICT (cols)` with no WHERE, which Postgres refuses with
      //   42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification
      // ea_rtk_upsert_artifact (0029 block 5b) picks the branch and repeats the predicate.
      await admin.rpc("ea_rtk_upsert_artifact", {
        p: {
          meeting_id: a.meeting_id, session_id: a.session_id ?? null, room: a.room, ref: a.ref, kind: a.kind,
          provider_id: a.provider_id ?? null, status: a.status ?? null, url: a.url ?? null,
          expires_at: a.expires_at ?? null, text: a.text ?? null, data: a.data ?? null, meta: a.meta ?? {},
        },
      });
    },
    async readArtifacts(room, ref) {
      const { data } = await admin.from("ea_rtk_artifacts").select("kind, status, text")
        .eq("room", room).eq("ref", ref).order("created_at", { ascending: false });
      return (data || []) as Array<{ kind: string; status: string | null; text: string | null }>;
    },
    async setReplay(room, ref, url) {
      const t = roomTable(room);
      await admin.from(t.table).update({ [t.replay]: url }).eq(t.key, keyOf(room, ref));
    },
    async streamCopy(url, name) {
      const acct = Deno.env.get("CF_ACCOUNT_ID"), tok = Deno.env.get("CF_API_TOKEN");
      if (!acct || !tok) return { uid: null, status: 503 };
      try {
        const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/stream/copy`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url, meta: { name: name.slice(0, 120) } }),
        });
        const j = await r.json().catch(() => ({}));
        const uid = j?.result?.uid;
        return { uid: typeof uid === "string" ? uid : null, status: r.status };
      } catch (_e) { return { uid: null, status: 0 }; }
    },
    async fetchText(url) {
      try {
        const r = await fetch(url);
        return { status: r.status, text: r.ok ? await r.text() : "" };
      } catch (_e) { return { status: 0, text: "" }; }
    },
    async hostNames(meetingId) {
      const { data: ps } = await admin.from("ea_rtk_participants").select("user_id, preset_name").eq("meeting_id", meetingId);
      const ids = (ps || []).filter((p) => String(p.preset_name).endsWith("-host")).map((p) => p.user_id);
      if (!ids.length) return [];
      const { data: profs } = await admin.from("ea_profiles").select("display_name").in("user_id", ids);
      return (profs || []).map((p) => p.display_name || "Host");
    },
    rtk,
  };
}

Deno.serve((req: Request) => handleWebhook(req, realDeps()));
```

- [ ] **Step 7: Type-check and deploy**

```bash
cd /Users/nelsontaylor/taylormade-academy
deno check supabase/functions/ea-rtk-webhook/index.ts
supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref "$SB_REF"
```
Expected: no diagnostics, then `Deployed Functions on project pgqdmnmessbbzyszjfvr: ea-rtk-webhook`.

- [ ] **Step 8: Register the webhook with Cloudflare and store its id**

```bash
curl -sS -X POST "$RTK/webhooks" -H "Authorization: Bearer $CF_RTK_API_TOKEN" -H "Content-Type: application/json" -d '{
  "name": "supabase-prod",
  "url": "https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-rtk-webhook",
  "events": ["meeting.started", "meeting.ended", "recording.statusUpdate", "meeting.transcript", "meeting.summary", "livestreaming.statusUpdate"],
  "enabled": true
}' | tee /tmp/rtk-webhook.json | jq '.success, (.data // .result).id'

supabase secrets set CF_RTK_WEBHOOK_ID="$(jq -r '(.data // .result).id' /tmp/rtk-webhook.json)" --project-ref "$SB_REF"
supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref "$SB_REF"
```
Expected: `true` and a uuid, then `Deployed Functions…`. Then probe which listing route exists and record it:

```bash
echo "GET /webhooks:"     && curl -sS -o /dev/null -w '%{http_code}\n' "$RTK/webhooks"     -H "Authorization: Bearer $CF_RTK_API_TOKEN"
echo "GET /webhooks/all:" && curl -sS -o /dev/null -w '%{http_code}\n' "$RTK/webhooks/all" -H "Authorization: Bearer $CF_RTK_API_TOKEN"
```
Expected: one `200` and one `404`. Write the winner into `supabase/functions/README.md` in Task 9.

- [ ] **Step 9: Live smoke — an unsigned delivery must be rejected**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$FN/ea-rtk-webhook" \
  -H "Content-Type: application/json" -d '{"event":"meeting.ended","meeting":{"id":"zz-test"}}'
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$FN/ea-rtk-webhook" \
  -H "Content-Type: application/json" -H "rtk-signature: AAAA" -H "rtk-uuid: zz-test-1" -H "rtk-webhook-id: wrong" \
  -d '{"event":"meeting.ended","meeting":{"id":"zz-test"}}'
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select count(*) as rows from public.ea_rtk_events where id like '\''zz-test-%'\'';"}'
```
Expected: `401`, `401`, and `[{"rows":0}]` — a rejected delivery never reaches the events table.

- [ ] **Step 10: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/functions/ea-rtk-webhook
git commit -m "feat(live): ea-rtk-webhook — signed events, Stream copy replay, transcript/summary drafts"
```

---

## Task 6: `js/rtk-room.js` + `css/rtk-room.css` — the room on the page

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/js/rtk-room.js`
- Create: `/Users/nelsontaylor/taylormade-academy/css/rtk-room.css`
- Test (scratch, never committed): `/private/tmp/claude-501/-Users-nelsontaylor/5ab9f84d-c3e8-43ac-b532-86351b6e093d/scratchpad/rtk-spike/mint.ts`, `…/rtk-harness.html`, `…/rtk-room.spec.mjs`

**Interfaces:**
- Consumes: Task 3's `POST {FUNCTIONS_BASE}/ea-rtk-join` → `200 {token, meeting_id, preset, room, ref, host}` and its 401/403/409/503 error bodies; Task 4's `POST {FUNCTIONS_BASE}/ea-rtk-host` → the five action responses; `window.BM_CONFIG.FUNCTIONS_BASE` (`js/config.js:7`); a Supabase client (`sb`) for `sb.auth.getSession()`.
- Produces, for Tasks 7 and 8 (ES module exports from `/js/rtk-room.js`):
  - `async function mountRoom({room, ref, sb, cfg, onState}): Promise<{meeting, el, join} | null>` — `room` is `'academy' | 'opil'`, `ref` is `ea_live.id` or `ea_opil_sessions.no`, `onState(state, detail?)` is called with `'upsell' | 'not_open' | 'sign_in' | 'not_configured' | 'error'` before mounting, then with the `rtkStatesUpdate` `detail.meeting` values (`'idle'`, `'joined'`, `'ended'`, …). Returns `null` when it did not mount.
  - `async function hostStart({room, ref, sb, cfg, record}): Promise<{status, meeting_id?, is_live?, mode?, recording_id?, error?}>`
  - `async function hostAction({room, ref, sb, cfg, action}): Promise<object>` — `action` is `'end_session' | 'start_recording' | 'stop_recording' | 'status'`
  - `function armHostBar({r, start, room, ref, sb, cfg, onEnded}): void` — creates `div#rtk-hostbar` and inserts it as the **next sibling of `#rtk-root`** (`root.insertAdjacentElement('afterend', bar)`), which is what `css/rtk-room.css`'s `#rtk-hostbar{margin-top:12px}` is written for. It is never a child of `#rtk-root`, so `teardownRoom()` removes it explicitly. `start` is the `hostStart` response or `null` for a host who reloaded into a live room; `onEnded()` is called after a successful `end_session`.
  - `function teardownRoom(): void` — unmounts `<rtk-meeting>`, empties and hides `#rtk-root`, **removes the sibling `#rtk-hostbar`**, removes `body.in-meeting`, stops the status poll.
  - `function showEnded(room): void` — replaces `#rtk-root`'s content with the `.rtk-ended` card and **unhides `#rtk-root`**. It is called after `teardownRoom()`, which hid it.
  - Harness adapters honoured by `mountRoom`: `window.__rtkJoin({room, ref})` replaces the `ea-rtk-join` fetch, `window.__rtkHost(body)` replaces the `ea-rtk-host` fetch.
  - DOM contract both pages must provide: an element `#rtk-root` (may start `hidden`). `css/rtk-room.css` defines `#rtk-root`, `#rtk-hostbar`, and the `body.in-meeting` rules.

- [ ] **Step 1: Write the token-mint stub (stands in for `ea-rtk-join` in the harness)**

Create `/private/tmp/claude-501/-Users-nelsontaylor/5ab9f84d-c3e8-43ac-b532-86351b6e093d/scratchpad/rtk-spike/mint.ts`:

```ts
// deno run -A mint.ts — mints REAL participant tokens against the REAL RealtimeKit app so
// the harness can join without Supabase. Never committed; reads the shell's CF_* exports.
const ACCT = Deno.env.get("CF_ACCOUNT_ID")!, APP = Deno.env.get("CF_RTK_APP_ID")!, TOK = Deno.env.get("CF_RTK_API_TOKEN")!;
const RTK = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/realtime/kit/${APP}`;
const H = { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
let meetingId = "";

Deno.serve({ port: 8768 }, async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  if (u.pathname === "/retire") {
    const r = await fetch(`${RTK}/meetings/${meetingId}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "INACTIVE" }) });
    return new Response(JSON.stringify({ retired: meetingId, ok: r.ok }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }
  if (!meetingId) {
    const r = await fetch(`${RTK}/meetings`, { method: "POST", headers: H, body: JSON.stringify({ title: "zz-test-harness", persist_chat: false, session_keep_alive_time_in_secs: 120 }) });
    const j = await r.json();
    meetingId = (j.data || j.result).id;
    console.log("meeting", meetingId);
  }
  const preset = u.searchParams.get("preset") || "opil-student";
  const r = await fetch(`${RTK}/meetings/${meetingId}/participants`, {
    method: "POST", headers: H,
    body: JSON.stringify({ custom_participant_id: crypto.randomUUID(), preset_name: preset, name: u.searchParams.get("name") || "spike" }),
  });
  const j = await r.json();
  const d = j.data || j.result || {};
  return new Response(JSON.stringify({ token: d.token, meeting_id: meetingId, preset, host: preset.endsWith("-host") }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Write the harness page**

Create `/private/tmp/claude-501/-Users-nelsontaylor/5ab9f84d-c3e8-43ac-b532-86351b6e093d/scratchpad/rtk-spike/rtk-harness.html`:

```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>rtk-room harness</title>
<link rel="stylesheet" href="/css/rtk-room.css">
<style>body{margin:0;background:#04123a;color:#fff;font-family:Inter,system-ui,sans-serif}.live-grid{display:grid;grid-template-columns:1fr 340px}#chat{background:#0a1733;padding:12px}</style>
</head><body>
<div class="live-grid"><div><section id="rtk-root" hidden></section></div><div id="chat">page chat</div></div>
<script type="module">
window.__log = [];
const q = new URLSearchParams(location.search);
const PRESET = q.get('preset') || 'opil-student';
/* fake ea-rtk-join: a real token from mint.ts, no Supabase in the loop (spec §14.2) */
window.__rtkJoin = async () => {
  const j = await (await fetch('http://127.0.0.1:8768/join?preset=' + PRESET + '&name=' + PRESET)).json();
  return { ok: true, token: j.token, meeting_id: j.meeting_id, preset: j.preset, room: 'opil', ref: '3', host: j.host };
};
/* fake ea-rtk-host: no Cloudflare call, so the host bar's DOM is testable on its own */
window.__rtkHost = async (body) => {
  window.__log.push('host:' + body.action);
  if (body.action === 'start') return { status: 200, meeting_id: 'm-fake', is_live: true, mode: 'meeting', recording_id: 'r-fake' };
  if (body.action === 'end_session') return { status: 200, ended: true, kicked_participants_count: 2, mode: 'stream' };
  if (body.action === 'stop_recording') return { status: 200, stopped: true, recording_id: 'r-fake' };
  if (body.action === 'start_recording') return { status: 200, recording_id: 'r-fake2', recording_status: 'INVOKED' };
  return { status: 200, active: true, live_participants: 2, recording: { id: 'r-fake', status: 'RECORDING' } };
};
const { mountRoom, hostStart, armHostBar } = await import('/js/rtk-room.js');
const onState = (s) => { window.__log.push('state:' + s); window.__state = s; };
const r = await mountRoom({ room: 'opil', ref: '3', sb: null, cfg: { FUNCTIONS_BASE: 'http://127.0.0.1:8768' }, onState });
window.__mounted = !!r;
if (r && r.join.host) {
  let armed = false;
  r.el.addEventListener('rtkStatesUpdate', async (e) => {
    if (e.detail.meeting !== 'joined' || armed) return;
    armed = true;
    const res = await hostStart({ room: 'opil', ref: '3', sb: null, cfg: { FUNCTIONS_BASE: 'http://127.0.0.1:8768' }, record: true });
    armHostBar({ r, start: res, room: 'opil', ref: '3', sb: null, cfg: { FUNCTIONS_BASE: 'http://127.0.0.1:8768' }, onEnded: () => window.__log.push('ended') });
    window.__armed = true;
  });
}
</script>
</body></html>
```

- [ ] **Step 3: Write the failing Playwright test**

Create `/private/tmp/claude-501/-Users-nelsontaylor/5ab9f84d-c3e8-43ac-b532-86351b6e093d/scratchpad/rtk-spike/rtk-room.spec.mjs`:

```js
// node rtk-room.spec.mjs — two browser contexts against the real RealtimeKit app.
// Uses the globally installed playwright package (npm ls -g shows playwright@1.58.2).
import { createRequire } from 'node:module';
const require = createRequire('/Users/nelsontaylor/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8769/rtk-harness.html';
const FLAGS = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
let failures = 0;
const check = (label, cond) => { if (cond) console.log('PASS ', label); else { failures++; console.log('FAIL ', label); } };

const browser = await chromium.launch({ args: FLAGS });
const host = await (await browser.newContext({ permissions: ['camera', 'microphone'] })).newPage();
const student = await (await browser.newContext({ permissions: ['camera', 'microphone'] })).newPage();
let hostNavs = 0, studentNavs = 0;
host.on('framenavigated', (f) => { if (f === host.mainFrame()) hostNavs++; });
student.on('framenavigated', (f) => { if (f === student.mainFrame()) studentNavs++; });
const errors = [];
for (const p of [host, student]) p.on('pageerror', (e) => errors.push(String(e)));

await host.goto(BASE + '?preset=opil-host');
await host.waitForFunction(() => window.__mounted === true, null, { timeout: 30000 });
check('host: the room mounted', await host.evaluate(() => window.__mounted));
check('host: #rtk-root is visible', await host.evaluate(() => !document.getElementById('rtk-root').hidden));
check('host: body.in-meeting is set', await host.evaluate(() => document.body.classList.contains('in-meeting')));
check('host: the setup screen is showing (we never call meeting.join)', await host.evaluate(() => !!document.querySelector('rtk-meeting')));

// the setup screen's own Join button is inside the element's shadow DOM
await host.waitForTimeout(4000);
await host.evaluate(() => {
  const m = document.querySelector('rtk-meeting');
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.tagName === 'RTK-BUTTON' && /join/i.test(el.textContent || '')) { el.click(); return true; }
      if (el.shadowRoot && walk(el.shadowRoot)) return true;
    }
    return false;
  };
  walk(m.shadowRoot || m);
});
await host.waitForFunction(() => window.__armed === true, null, { timeout: 45000 });
check('host: reached joined and armed the bar', await host.evaluate(() => window.__armed));
check('host: start was called exactly once', await host.evaluate(() => window.__log.filter((l) => l === 'host:start').length) === 1);
check('host: the LIVE chip is up', await host.locator('#rtk-hostbar .rtk-chip.live').isVisible());
check('host: REC reads Recording', /recording/i.test(await host.locator('#rtk-hostbar #rtk-rec').innerText()));

await student.goto(BASE + '?preset=opil-student');
await student.waitForFunction(() => window.__mounted === true, null, { timeout: 30000 });
check('student: the room mounted', await student.evaluate(() => window.__mounted));
check('student: no host bar', await student.locator('#rtk-hostbar').count() === 0);

await host.locator('#rtk-rec').click();
await host.waitForTimeout(500);
check('REC toggles to stopped', /start recording/i.test(await host.locator('#rtk-rec').innerText()));
check('stop_recording was called', await host.evaluate(() => window.__log.includes('host:stop_recording')));

await host.locator('#rtk-end').click();
await host.waitForFunction(() => window.__log.includes('ended'), null, { timeout: 15000 });
check('End called end_session and reported back', await host.evaluate(() => window.__log.includes('host:end_session')));
check('teardown removed body.in-meeting', await host.evaluate(() => !document.body.classList.contains('in-meeting')));
check('teardown removed the sibling host bar', await host.locator('#rtk-hostbar').count() === 0);
check('#rtk-root is visible again after showEnded', await host.evaluate(() => !document.getElementById('rtk-root').hidden));
check('the ended card is on screen', await host.locator('#rtk-root .rtk-ended').isVisible());
check('the ended card reads "Class ended."', /class ended/i.test(await host.locator('#rtk-root .rtk-ended').innerText()));

check('no page navigated (a room-mode handler must never reload)', hostNavs === 1 && studentNavs === 1);
check('no uncaught page errors', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));

await fetch('http://127.0.0.1:8768/retire').then((r) => r.json()).then((j) => console.log('retired', j.retired));
await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 4: Start the three local servers and run the test to verify it fails**

```bash
S=/private/tmp/claude-501/-Users-nelsontaylor/5ab9f84d-c3e8-43ac-b532-86351b6e093d/scratchpad/rtk-spike
cp "$S/rtk-harness.html" /Users/nelsontaylor/taylormade-academy/rtk-harness.html
(cd "$S" && deno run -A mint.ts &) ; (cd /Users/nelsontaylor/taylormade-academy && python3 -m http.server 8769 >/dev/null 2>&1 &)
playwright install chromium
node "$S/rtk-room.spec.mjs"
```
Expected: FAIL — the page errors with `Failed to fetch dynamically imported module: http://127.0.0.1:8769/js/rtk-room.js` and the test exits `1` with `host: the room mounted` failing on a timeout.

- [ ] **Step 5: Write `css/rtk-room.css`**

Create `/Users/nelsontaylor/taylormade-academy/css/rtk-room.css`:

```css
/* css/rtk-room.css — the RealtimeKit room on /live/ and /opil/hub/live/.
   Loaded on both pages with a plain <link>; build_site.py stamps the ?v=.
   Every room-mode rule hangs off body.in-meeting, which js/rtk-room.js sets.
   Academy navy #04123a / #0a1733, gold #fdc921. */

/* Page chrome above #rtk-root — the brand bar plus the hub tabs / live header. Defined
   here because nothing else in the repo defines it; a page with taller chrome overrides
   --room-chrome on :root in its own <style>. */
:root{ --room-chrome:120px; }
@media(max-width:900px){ :root{ --room-chrome:92px; } }

#rtk-root{
  position:relative;
  height:calc(100dvh - var(--room-chrome));
  min-height:520px;
  border-radius:16px;
  overflow:hidden;
  background:#04123a;
  border:1px solid rgba(255,255,255,.08);
  box-shadow:0 20px 60px -30px rgba(4,18,58,.8);
}
#rtk-root rtk-meeting{display:block;width:100%;height:100%}

/* The room takes the whole width: the page's chat column and 16:9 player step aside. */
body.in-meeting .live-grid{grid-template-columns:1fr}
body.in-meeting .player,
body.in-meeting .roomchat,
body.in-meeting .chat,
body.in-meeting #meta{display:none}

/* OPIL phones: hub.js appends a fixed bottom dock on every page and hub.css reserves
   58px + safe-area under it. A 100dvh meeting would sit under it and its own control
   bar would collide, so the dock goes away for the length of the meeting. */
body.in-meeting .ln-dock{display:none}
body.in-meeting.has-dock{padding-bottom:0}

/* ---- host bar ---- */
#rtk-hostbar{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  margin-top:12px;padding:12px 14px;border-radius:14px;
  background:#0a1733;border:1px solid rgba(253,201,33,.25);color:#fff;
  font-family:Inter,system-ui,sans-serif;font-size:13.5px;
}
#rtk-hostbar .rtk-chip{
  display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:980px;
  font-weight:700;font-size:11.5px;letter-spacing:.08em;
  background:rgba(61,220,151,.16);border:1px solid rgba(61,220,151,.5);color:#7ce8c3;
}
#rtk-hostbar .rtk-chip i{width:7px;height:7px;border-radius:50%;background:#3ddc97;animation:rtkpulse 1.6s ease-in-out infinite}
@keyframes rtkpulse{0%,100%{opacity:1}50%{opacity:.35}}
@media(prefers-reduced-motion:reduce){#rtk-hostbar .rtk-chip i{animation:none}}
#rtk-hostbar .rtk-count{margin-left:2px;opacity:.85;font-variant-numeric:tabular-nums}
#rtk-hostbar button{
  font:inherit;font-weight:700;cursor:pointer;border-radius:10px;padding:8px 14px;
  background:transparent;border:1.5px solid rgba(255,255,255,.22);color:#fff;
}
#rtk-hostbar button:hover{border-color:#fdc921;color:#fdc921}
#rtk-hostbar button:disabled{opacity:.55;cursor:not-allowed}
#rtk-hostbar #rtk-end{margin-left:auto;border-color:rgba(255,92,92,.6);color:#ff8f8f}
#rtk-hostbar #rtk-end:hover{background:#ff5c5c;border-color:#ff5c5c;color:#fff}
#rtk-hostbar #rtk-rec[data-on="1"]{border-color:#fdc921;color:#04123a;background:#fdc921}
#rtk-hostbar .rtk-note{flex-basis:100%;margin:0;font-size:12.5px;color:#ffc9c9}
#rtk-hostbar .rtk-note:empty{display:none}

/* hand-raise queue (Academy webinar) */
#rtk-queue{flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
#rtk-queue:empty{display:none}
#rtk-queue li{display:flex;align-items:center;gap:8px;background:#162650;border-radius:980px;padding:5px 6px 5px 13px;font-size:12.5px}
#rtk-queue button{padding:4px 10px;font-size:12px;border-radius:980px}

/* the "class ended" card the room collapses into */
#rtk-root .rtk-ended{
  position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;text-align:center;padding:24px;color:#9fb0d4;background:#04123a;
}
#rtk-root .rtk-ended b{font-family:'Space Grotesk',Inter,system-ui,sans-serif;color:#fff;font-size:clamp(18px,2.2vw,26px)}
```

- [ ] **Step 6: Write `js/rtk-room.js`**

Create `/Users/nelsontaylor/taylormade-academy/js/rtk-room.js`:

```js
/* js/rtk-room.js — the RealtimeKit room, shared by /live/ and /opil/hub/live/.
   Imported lazily (room mode only). No Cloudflare secret lives here: the participant
   token comes from ea-rtk-join, per person, per join.
   Core is the IIFE (spike 1): jsdelivr's +esm conversion of sdp-transform 404s and kills
   the ESM graph. UI kit is ESM. Both pinned to 2.0.2.
   Spec: docs/superpowers/specs/2026-09-10-realtimekit-live-rooms-design.md §10 */
import { defineCustomElements } from 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js';
import { provideRtkDesignSystem, defaultConfig } from 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js';

const CORE_SRC = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js';

function loadCore() {
  if (window.RealtimeKitClient) return Promise.resolve(window.RealtimeKitClient);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CORE_SRC; s.async = true;
    s.onload = () => resolve(window.RealtimeKitClient);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* design-system page: theme light|dark|darkest; colors become --rtk-colors-* RGB triplets.
   Inter inside the room; Space Grotesk stays on the page chrome around #rtk-root. */
const TOKENS = {
  theme: 'darkest',
  fontFamily: 'Inter',
  borderRadius: 'rounded',
  borderWidth: 'thin',
  spacingBase: 4,
  colors: {
    brand: { 300: '#fee38a', 400: '#fdd45a', 500: '#fdc921', 600: '#d9a90f', 700: '#b28a0a' },
    background: { 600: '#22345f', 700: '#162650', 800: '#0f1d44', 900: '#0a1733', 1000: '#04123a' },
    text: '#ffffff', 'text-on-brand': '#04123a', 'video-bg': '#0a1733',
    danger: '#ff5c5c', success: '#3ddc97', warning: '#fdc921',
  },
};

/* Spike 1(g): rtk-recording-toggle sits at exactly one path in defaultConfig —
   root['rtk-more-toggle'].activeMoreMenu. Drop that one entry and the More menu loses it;
   rtk-recording-indicator (the REC pill in the header) stays. A client-started recording
   would carry none of the server body (realtimekit_bucket_config, file_name_prefix), so
   the host bar is the only recording control in v1. */
function strippedConfig() {
  try {
    const cfg = structuredClone(defaultConfig);
    const menu = cfg && cfg.root && cfg.root['rtk-more-toggle'] && cfg.root['rtk-more-toggle'].activeMoreMenu;
    if (Array.isArray(menu)) {
      const i = menu.findIndex((entry) => JSON.stringify(entry).indexOf('rtk-recording-toggle') !== -1);
      if (i !== -1) menu.splice(i, 1);
    }
    return cfg;
  } catch (e) { return null; }
}

const bodyFor = (room, ref) => (room === 'academy' ? { room, live_id: ref } : { room, session_no: Number(ref) });

async function post(path, { sb, cfg, body }) {
  let token = '';
  try { const s = await sb.auth.getSession(); token = (s && s.data && s.data.session && s.data.session.access_token) || ''; } catch (e) {}
  let res;
  try {
    res = await fetch(cfg.FUNCTIONS_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
  } catch (e) { return { status: 0, error: 'network' }; }
  let json = {};
  try { json = await res.json(); } catch (e) {}
  /* `status` is the HTTP code and every caller branches on it, so no edge-function response
     body may carry a key called `status` — ea-rtk-host's start_recording returns
     `recording_status` for exactly this reason. */
  return Object.assign({ status: res.status }, json);
}

export async function fetchJoin({ room, ref, sb, cfg }) {
  if (window.__rtkJoin) return window.__rtkJoin({ room, ref });     // harness adapter (§14.2)
  const r = await post('/ea-rtk-join', { sb, cfg, body: bodyFor(room, ref) });
  if (r.status === 200 && r.token) return { ok: true, token: r.token, meeting_id: r.meeting_id, preset: r.preset, room, ref, host: r.host === true };
  const state = r.status === 403 ? 'upsell'
    : r.status === 409 ? 'not_open'
    : r.status === 401 ? 'sign_in'
    : r.status === 503 ? 'not_configured'
    : 'error';
  return { ok: false, state: state, status: r.status, error: r.error || 'error' };
}

export async function hostStart({ room, ref, sb, cfg, record = true }) {
  const body = Object.assign(bodyFor(room, ref), { action: 'start', record: record });
  if (window.__rtkHost) return window.__rtkHost(body);
  return post('/ea-rtk-host', { sb, cfg, body });
}

export async function hostAction({ room, ref, sb, cfg, action }) {
  const body = Object.assign(bodyFor(room, ref), { action: action });
  if (window.__rtkHost) return window.__rtkHost(body);
  return post('/ea-rtk-host', { sb, cfg, body });
}

let current = null;   /* { meeting, el, poll } — one room per page */

export function teardownRoom() {
  if (current && current.poll) clearInterval(current.poll);
  const root = document.getElementById('rtk-root');
  if (root) { root.replaceChildren(); root.hidden = true; }
  /* the bar is a SIBLING of #rtk-root (armHostBar uses insertAdjacentElement('afterend')),
     so emptying #rtk-root does not take it with us — every teardown path must remove it,
     not just the End button's. */
  const bar = document.getElementById('rtk-hostbar');
  if (bar) bar.remove();
  document.body.classList.remove('in-meeting');
  current = null;
}

export async function mountRoom({ room, ref, sb, cfg, onState }) {
  const root = document.getElementById('rtk-root');
  if (!root) { onState('error'); return null; }

  const join = await fetchJoin({ room, ref, sb, cfg });
  if (!join.ok) { onState(join.state); return null; }

  await defineCustomElements();
  provideRtkDesignSystem(root, TOKENS);

  let RealtimeKitClient;
  try { RealtimeKitClient = await loadCore(); } catch (e) { onState('error'); return null; }

  let meeting;
  try {
    meeting = await RealtimeKitClient.init({
      authToken: join.token,
      defaults: {
        audio: join.host,                                        /* hosts arrive unmuted */
        video: join.host || join.preset === 'opil-student',
        mediaConfiguration: {
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
          screenshare: { frameRate: { ideal: 15, max: 30 }, displaySurface: 'monitor' },
        },
      },
      onError: (e) => { console.warn('[rtk]', e && (e.message || e)); },
    });
  } catch (e) { onState('error'); return null; }

  const el = document.createElement('rtk-meeting');
  /* Spike 1(c) closed with "v1 sets only `meeting` and `showSetupScreen` and leaves the rest
     at their defaults" (mode='fixed', size='lg', gridLayout='row', applyDesignSystem=true,
     loadConfigFromPreset=true, leaveOnUnmount=false). THIS CODE DELIBERATELY OVERRIDES THAT
     v1 shape in two places, and the deviation is intentional:
       - leaveOnUnmount = true, because teardownRoom() empties #rtk-root and the default
         (false) would leave the participant connected and still billing after End;
       - applyDesignSystem = false + an explicit `config`, because we own the Academy tokens
         on #rtk-root (provideRtkDesignSystem above) and 1(g) requires stripping the stock
         rtk-recording-toggle out of the More menu, which is only reachable through `config`.
     Nothing else departs from 1(c). */
  el.showSetupScreen = true;      /* phones grant cam/mic first; the user's Join joins */
  el.leaveOnUnmount = true;
  el.applyDesignSystem = false;   /* we own the tokens on #rtk-root */
  const cfgObj = strippedConfig();
  if (cfgObj) el.config = cfgObj;
  el.meeting = meeting;           /* NEVER meeting.join(): it throws UnsupportedConcurrentMethodExecution */

  root.replaceChildren(el);
  root.hidden = false;
  document.body.classList.add('in-meeting');
  current = { meeting: meeting, el: el, poll: null };

  el.addEventListener('rtkStatesUpdate', (e) => {
    const s = e.detail || {};
    onState(s.meeting, s);
    if (s.meeting === 'ended') {
      /* same two calls the End button makes, in the same order: teardown stops the status
         poll and removes the sibling host bar, showEnded un-hides #rtk-root and paints
         the card into it. */
      teardownRoom();
      showEnded(room);
    }
  });

  return { meeting: meeting, el: el, join: join };
}

export function showEnded(room) {
  const root = document.getElementById('rtk-root');
  if (!root) return;
  const d = document.createElement('div');
  d.className = 'rtk-ended';
  d.innerHTML = '<b>' + (room === 'opil' ? 'Class ended.' : 'Webinar ended.') + '</b>'
    + '<span>The replay lands here once it is processed.</span>';
  root.replaceChildren(d);
  /* teardownRoom() ran first and set root.hidden = true. Without this line the card renders
     inside a hidden <section> and the host sees the old 16:9 idle player instead. */
  root.hidden = false;
  const bar = document.getElementById('rtk-hostbar');
  if (bar) bar.remove();
}

export function armHostBar({ r, start, room, ref, sb, cfg, onEnded }) {
  const root = document.getElementById('rtk-root');
  if (!root || document.getElementById('rtk-hostbar')) return;
  const bar = document.createElement('div');
  bar.id = 'rtk-hostbar';
  bar.innerHTML =
    '<span class="rtk-chip live"><i></i>LIVE</span>'
    + '<span class="rtk-count" id="rtk-count">1 in the room</span>'
    + '<button type="button" id="rtk-mute">Mute all</button>'
    + '<button type="button" id="rtk-rec">Recording</button>'
    + '<button type="button" id="rtk-end">End for everyone</button>'
    + '<ul id="rtk-queue"></ul>'
    + '<p class="rtk-note" id="rtk-note"></p>';
  root.insertAdjacentElement('afterend', bar);

  const note = bar.querySelector('#rtk-note');
  const rec = bar.querySelector('#rtk-rec');
  const count = bar.querySelector('#rtk-count');
  const chip = bar.querySelector('.rtk-chip');

  /* start failed: the host stays in the room, students keep the idle card, Retry repeats
     ONLY the start call. Nothing here ever reloads. */
  /* status is 0 when fetch itself threw — that is a failure, not a success, so do not test truthiness */
  if (start && start.status !== 200) {
    chip.classList.remove('live');
    chip.textContent = 'NOT LIVE';
    note.textContent = start.error === 'another_live'
      ? 'Another room is still live. End that one first, then Retry.'
      : 'Could not start: ' + (start.error || start.status);
    const retry = document.createElement('button');
    retry.type = 'button'; retry.id = 'rtk-retry'; retry.textContent = 'Retry';
    retry.addEventListener('click', async () => {
      retry.disabled = true;
      const again = await hostStart({ room, ref, sb, cfg, record: true });
      retry.disabled = false;
      if (again.status === 200) { retry.remove(); note.textContent = ''; chip.classList.add('live'); chip.innerHTML = '<i></i>LIVE'; setRec(!!again.recording_id); }
      else note.textContent = 'Could not start: ' + (again.error || again.status);
    });
    bar.insertBefore(retry, note);
  }

  function setRec(on) {
    rec.dataset.on = on ? '1' : '0';
    rec.textContent = on ? 'Recording' : 'Start recording';
  }
  setRec(!start || !!start.recording_id);

  rec.addEventListener('click', async () => {
    const on = rec.dataset.on === '1';
    rec.disabled = true;
    const res = await hostAction({ room, ref, sb, cfg, action: on ? 'stop_recording' : 'start_recording' });
    rec.disabled = false;
    if (res.error) { note.textContent = 'Recording: ' + res.error; return; }
    note.textContent = '';
    setRec(on ? false : !!res.recording_id);
  });

  bar.querySelector('#rtk-mute').addEventListener('click', () => {
    try { r.meeting.participants.disableAllAudio(); }
    catch (e) { note.textContent = 'Mute all needs the host preset (' + (e && e.message ? e.message : 'error') + ').'; }
  });

  bar.querySelector('#rtk-end').addEventListener('click', async () => {
    const btn = bar.querySelector('#rtk-end');
    btn.disabled = true; btn.textContent = 'Ending…';
    const res = await hostAction({ room, ref, sb, cfg, action: 'end_session' });
    if (res.error) { btn.disabled = false; btn.textContent = 'End for everyone'; note.textContent = 'Could not end: ' + res.error; return; }
    teardownRoom();
    showEnded(room);
    if (typeof onEnded === 'function') onEnded(res);
  });

  /* headcount: the local Map between polls, ea-rtk-host status every 30 s */
  const localCount = () => {
    try { return (r.meeting.participants.joined.size || 0) + 1; } catch (e) { return 1; }
  };
  const paint = (n) => { count.textContent = n + (n === 1 ? ' in the room' : ' in the room'); };
  paint(localCount());
  const poll = setInterval(async () => {
    const s = await hostAction({ room, ref, sb, cfg, action: 'status' });
    if (typeof s.live_participants === 'number') paint(s.live_participants);
    else paint(localCount());
    if (s.recording) setRec(true);
    else if (s.active) setRec(false);
  }, 30000);
  if (current) current.poll = poll;

  /* hand-raise queue: stage events, never a getter (meeting.stage.getAccessRequests()
     is not documented). The stock rtk-participants-stage-queue may show the same thing;
     this bar is the fallback, and duplicates cost nothing. */
  const queue = bar.querySelector('#rtk-queue');
  const seen = {};
  function addRequest(p) {
    const id = p && (p.userId || p.id);
    if (!id || seen[id]) return;
    seen[id] = true;
    const li = document.createElement('li');
    li.innerHTML = '<span></span><button type="button" class="ok">Allow</button><button type="button" class="no">Deny</button>';
    li.querySelector('span').textContent = (p.name || 'Member') + ' raised a hand';
    li.querySelector('.ok').addEventListener('click', () => { try { r.meeting.stage.grantAccess([id]); } catch (e) {} li.remove(); });
    li.querySelector('.no').addEventListener('click', () => { try { r.meeting.stage.denyAccess([id]); } catch (e) {} li.remove(); });
    queue.appendChild(li);
  }
  try {
    r.meeting.stage.on('newStageRequest', addRequest);
    r.meeting.stage.on('stageAccessRequestUpdate', (list) => { (Array.isArray(list) ? list : [list]).forEach(addRequest); });
  } catch (e) { /* GROUP_CALL presets have stage_enabled false: no queue, no error */ }
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
S=/private/tmp/claude-501/-Users-nelsontaylor/5ab9f84d-c3e8-43ac-b532-86351b6e093d/scratchpad/rtk-spike
cp "$S/rtk-harness.html" /Users/nelsontaylor/taylormade-academy/rtk-harness.html
node "$S/rtk-room.spec.mjs"
```
Expected: every line reads `PASS`, then `retired <meeting id>` and `ALL PASS`, exit 0. In particular `no page navigated (a room-mode handler must never reload)` must pass — that is the reload rule under test.

- [ ] **Step 8: Syntax-check the module the way the pages will parse it**

```bash
cd /Users/nelsontaylor/taylormade-academy && node --check js/rtk-room.js && echo "js ok"
python3 - <<'PY'
import re, pathlib
css = pathlib.Path('css/rtk-room.css').read_text()
assert css.count('{') == css.count('}'), 'unbalanced braces in rtk-room.css'
assert 'body.in-meeting .ln-dock' in css, 'the OPIL dock rule is missing'
print('css ok')
PY
```
Expected: `js ok` then `css ok`. (`node --check` parses an ES module fine because the file has top-level `import`; if Node complains about module syntax, run `node --input-type=module --check < js/rtk-room.js`.)

- [ ] **Step 9: Stop the servers, remove the temporary harness copy**

```bash
rm -f /Users/nelsontaylor/taylormade-academy/rtk-harness.html
pkill -f "http.server 8769"; pkill -f "mint.ts"
git -C /Users/nelsontaylor/taylormade-academy status --porcelain | grep rtk-harness && echo "STILL THERE — delete it" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 10: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add js/rtk-room.js css/rtk-room.css
git commit -m "feat(live): js/rtk-room.js + css/rtk-room.css — the RealtimeKit room and host bar"
```

---

## Task 7: `opil/hub/live/index.html` — room mode beside the existing Broadcast control

**Files:**
- Modify: `/Users/nelsontaylor/taylormade-academy/opil/hub/live/index.html` — `:11` (stylesheet link), `:59-62` (`#rtk-root` above the player), `:84` (the room-mode helpers go after it), `:199-202` (what gets mounted), `:232` (the chat poll gets a handle), `:241-243` (the chat handover), `:288` (the `#bcStartRoom` button), `:292-293` (the element lookups), `:295` (`syncCtl`), `:296` (`onAir`), `:303-304` (`flipLive` gains `mode:'stream'`), `:365` (the click wiring)
- Create: `/Users/nelsontaylor/taylormade-academy/scripts/check-rtk-pages.py`

**Line numbers verified against the file on 2026-09-11.** Every step below also quotes the exact text it replaces — if a number has drifted, anchor the edit on the quoted text, never on the number.

**Interfaces:**
- Consumes: Task 6's `/js/rtk-room.js` exports — this page imports exactly three, `mountRoom`, `hostStart` and `armHostBar` (`hostAction`, `teardownRoom` and `showEnded` are called by `armHostBar` internally and are never imported here) — and `/css/rtk-room.css`'s `#rtk-root`, `#rtk-hostbar`, `body.in-meeting` rules; Task 1's `ea_opil_sessions.mode` / `.rtk_meeting_id` (already inside the page's existing `select('*')`); Task 3's `ea-rtk-join` and Task 4's `ea-rtk-host` through those exports.
- Produces: nothing other tasks import. The page must end up with: an element `#rtk-root`, a host button `#bcStartRoom` inside the Broadcast control card, and **no new `location.reload()`** — Task 9's checker enforces both.

- [ ] **Step 1: Write the failing structural test**

Create `/Users/nelsontaylor/taylormade-academy/scripts/check-rtk-pages.py`:

```python
#!/usr/bin/env python3
"""Structural check for the two live pages after room mode landed.
Run: python3 scripts/check-rtk-pages.py
Spec: docs/superpowers/specs/2026-09-10-realtimekit-live-rooms-design.md §10.1, §10.3, §10.6"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent.parent
FAIL = []

def need(page, text, why):
    if text not in page["html"]:
        FAIL.append(f'{page["name"]}: missing {why} ({text!r})')

def forbid_in(page, region, text, why):
    if region and text in region:
        FAIL.append(f'{page["name"]}: {why}')

pages = [
    {"name": "opil/hub/live", "path": "opil/hub/live/index.html", "button": "bcStartRoom"},
    {"name": "live",          "path": "live/index.html",          "button": "aStartRoom"},
]
for p in pages:
    p["html"] = (ROOT / p["path"]).read_text()
    need(p, '<link rel="stylesheet" href="/css/rtk-room.css', "the rtk-room stylesheet link")
    need(p, 'id="rtk-root"', "the #rtk-root mount point")
    need(p, p["button"], "the Start room button")
    need(p, "/js/rtk-room.js", "the lazy import of /js/rtk-room.js")
    need(p, "mountRoom", "the mountRoom call")
    need(p, "armHostBar", "the host bar arming")
    need(p, "hostStart", "the hostStart call")
    # fetchJoin maps a 401 to state 'sign_in'; a page that does not branch on it shows a
    # blank screen under body.in-meeting when an access token has expired
    need(p, "sign_in", "the sign_in state branch")
    # a broadcast Go live must hand the row back to stream mode, or the next Go live mounts
    # a RealtimeKit room instead of the HLS player
    need(p, 'mode: "stream"' if p["name"] == "live" else "mode: 'stream'", "mode:'stream' on the broadcast write")
    # OPIL only: the Broadcast control's session list is built with .neq('kind','milestone'),
    # so it carries 'thread', 'curriculum' AND 'hpc' rows — but ea-rtk-join and ea-rtk-host
    # both resolve an OPIL room with .eq('kind','thread'). Start class on any other kind
    # answers 404 not_found and the page lands in state 'error'. Both the visibility rule in
    # syncCtl() and the guard in the click handler have to filter on it.
    if p["name"] == "opil/hub/live" and p["html"].count("s.kind !== 'thread'") < 2:
        FAIL.append(f'{p["name"]}: Start class is not restricted to kind=\'thread\' rows '
                    "(needs the filter in syncCtl() and in the click handler)")
    # the bare paths must not be hand-stamped: build_site.py owns the ?v=
    for bare in ("/js/rtk-room.js", "/css/rtk-room.css"):
        for m in re.finditer(re.escape(bare) + r"\?v=[a-z0-9]+\?", p["html"]):
            FAIL.append(f'{p["name"]}: double-stamped {bare}')
    # no reload inside the room-mode code: grab every line that mentions the room
    for line in p["html"].splitlines():
        if ("rtk" in line.lower() or "StartRoom" in line) and "location.reload" in line:
            FAIL.append(f'{p["name"]}: a room-mode line calls location.reload() -> {line.strip()[:90]}')

# the broadcast path must be untouched: both reloads still there
need(pages[0], "location.reload();   /* no camera to lose", "the OPIL broadcast Go live reload (must stay)")
need(pages[1], "location.reload();", "the Academy broadcast Go live reload (must stay)")

if FAIL:
    print("\n".join("FAIL  " + f for f in FAIL)); sys.exit(1)
print(f"PASS  both live pages carry room mode ({len(pages)} pages checked)")
```

```bash
chmod +x /Users/nelsontaylor/taylormade-academy/scripts/check-rtk-pages.py
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && python3 scripts/check-rtk-pages.py; echo "exit=$?"`
Expected: ten `FAIL  opil/hub/live: …` lines and nine `FAIL  live: missing …` lines, `exit=1`. The nine both pages share are stylesheet, `#rtk-root`, the button, the import, `mountRoom`, `armHostBar`, `hostStart`, `sign_in`, `mode:'stream'`; the tenth is OPIL-only — `Start class is not restricted to kind='thread' rows`.

- [ ] **Step 3: Add the stylesheet link and the mount point**

Edit `/Users/nelsontaylor/taylormade-academy/opil/hub/live/index.html`. Line 11 is the `broadcast.css` link; anchor on the prefix `href="/css/broadcast.css?v=` only, because `build_site.py` restamps the hash on every build (it reads `?v=87d8a3fd1e` today). Insert on the line after it:

```html
<link rel="stylesheet" href="/css/rtk-room.css">
```

Then replace lines 59-62, which read:

```html
<div>
<div class="player" id="player">
<div class="idle" id="idle"><b>Nothing is streaming right now.</b><span>When a session goes live, the stream appears here and everyone sees the banner on their hub home.</span></div>
</div>
```

with:

```html
<div>
<section id="rtk-root" hidden></section>
<div class="player" id="player">
<div class="idle" id="idle"><b>Nothing is streaming right now.</b><span>When a session goes live, the stream appears here and everyone sees the banner on their hub home.</span></div>
</div>
```

- [ ] **Step 4: Add the room-mode helpers after the live-session read**

In the same file, after line 84 (`let sessionNo = liveSess ? liveSess.no : null;`) insert:

```js
/* ---------- room mode (RealtimeKit) ----------
   The row's `mode` is the branch key: 'stream' is today's HLS/WebRTC player, 'meeting' is
   the RealtimeKit room. Nothing here ever reloads — the broadcast handlers below keep
   their reloads, byte for byte. */
const ROOM = 'opil';
let rtkMounted = false;

function rtkNote(msg) {
  const player = document.getElementById('player');
  player.innerHTML = '<div class="idle"><b>' + esc(msg) + '</b><span>Ask the program team if this is unexpected.</span></div>';
  document.getElementById('rtk-root').hidden = true;
  document.body.classList.remove('in-meeting');
}
function onRtkState(s) {
  if (s === 'upsell') return rtkNote('You are not seated on a team for this cohort yet.');
  if (s === 'not_open') return rtkNote('The room opens when the class starts.');
  if (s === 'sign_in') return rtkNote('Your sign-in expired. Reload the page to get back in.');
  if (s === 'not_configured') return rtkNote('Rooms are not set up yet.');
  if (s === 'error') return rtkNote('The room could not load. Refresh in a moment.');
  if (s === 'ended') {
    document.getElementById('badge').style.display = 'none';
    document.getElementById('ttl').textContent = 'The live room';
  }
}
/* everyone, when the row already reads {is_live: true, mode: 'meeting'} */
async function enterRoom(no, title) {
  const { mountRoom, armHostBar } = await import('/js/rtk-room.js');
  document.body.classList.add('in-meeting');
  const r = await mountRoom({ room: ROOM, ref: no, sb, cfg: window.BM_CONFIG, onState: onRtkState });
  if (!r) return null;
  rtkMounted = true;
  document.getElementById('badge').style.display = '';
  document.getElementById('ttl').textContent = title || 'The live room';
  if (r.join.host) {
    /* a host who reloaded into a live room: the bar without a start call, armed on the
       first `joined` — never synchronously, the host is still on the setup screen */
    let armed = false;
    r.el.addEventListener('rtkStatesUpdate', (e) => {
      if (e.detail.meeting !== 'joined' || armed) return;
      armed = true;
      armHostBar({ r, start: null, room: ROOM, ref: no, sb, cfg: window.BM_CONFIG, onEnded: () => onRtkState('ended') });
    });
  }
  return r;
}
/* hosts only: the ONE room-mode button. 1. join (no is_live gate, no is_live write),
   2. on the first `joined` -> ea-rtk-host start, 3. host bar.
   Returns true only when the room mounted AND ea-rtk-join called this user a host.
   Returns false on every failure mountRoom can produce (sign_in / upsell / not_open /
   not_configured / error), so the click handler can put its button back — room mode is
   never allowed to reload the page. */
async function startRoom(no, title) {
  if (wakePoll) { clearInterval(wakePoll); wakePoll = null; }   /* armWake would reload the host 30s after start */
  if (chatPoll) { clearInterval(chatPoll); chatPoll = null; }   /* the page chat column is hidden in room mode */
  const { mountRoom, hostStart, armHostBar } = await import('/js/rtk-room.js');
  document.body.classList.add('in-meeting');
  const r = await mountRoom({ room: ROOM, ref: no, sb, cfg: window.BM_CONFIG, onState: onRtkState });
  if (!r || !r.join.host) return false;      /* ea-rtk-join decides host-ness, never the page */
  rtkMounted = true;
  document.getElementById('ttl').textContent = title || 'The live room';
  let started = false;
  r.el.addEventListener('rtkStatesUpdate', async (e) => {   /* never meeting.join(): the setup screen's Join does it */
    if (e.detail.meeting !== 'joined' || started) return;
    started = true;
    const res = await hostStart({ room: ROOM, ref: no, sb, cfg: window.BM_CONFIG, record: true });
    if (res.status === 200) { sessionNo = no; document.getElementById('badge').style.display = ''; }
    armHostBar({ r, start: res, room: ROOM, ref: no, sb, cfg: window.BM_CONFIG, onEnded: () => onRtkState('ended') });
  });
  return true;
}
```

`wakePoll` (line 234) and `chatPoll` (declared in Step 4b immediately above `let wakePoll = null;`) are `let` bindings **below** this insertion point, so at module-evaluation time they are in the temporal dead zone. Reading them here is safe only because `startRoom` is never called during module evaluation — it runs from the `#bcStartRoom` click, long after both lines have executed. Do not move either read into top-level code.

- [ ] **Step 4b: Give the chat poll a handle so room mode can stop it**

`openChat()` starts a 12-second poll with no stored handle, so `startRoom` has no way to stop it and the hidden chat column would keep hitting `ea_opil_live_chat` every 12 s for the whole class. Replace line 232, which reads:

```js
  setInterval(loadChat, 12000);
```

with:

```js
  chatPoll = setInterval(loadChat, 12000);   /* stopped by startRoom: room mode hides this column */
```

and, immediately above `let wakePoll = null;` on line 234, insert the declaration:

```js
let chatPoll = null;   /* the room chat refresh; room mode clears it, the page keeps it otherwise */
```

- [ ] **Step 5: Branch on `mode` where the page decides what to mount**

Replace lines 199-202, which read:

```js
if (liveSess && liveSess.stream_url) {
  mountStream(liveSess.stream_url, liveSess.title).catch(() => {});
  document.getElementById('meta').textContent = metaLine(liveSess);
}
```

with:

```js
if (liveSess && liveSess.mode === 'meeting') {
  await enterRoom(liveSess.no, liveSess.title);
  document.getElementById('meta').textContent = metaLine(liveSess);
} else if (liveSess && liveSess.stream_url) {
  mountStream(liveSess.stream_url, liveSess.title).catch(() => {});
  document.getElementById('meta').textContent = metaLine(liveSess);
}
```

- [ ] **Step 6: Hand the chat over to the meeting**

Replace lines 241-243, which read:

```js
if (liveSess) {
  await openChat();
} else {
```

with:

```js
if (liveSess && rtkMounted) {
  /* chat lives inside the meeting in room mode; the page chat column is hidden by
     body.in-meeting and its 12s poll never starts */
  scroll.innerHTML = '<div class="empty">Chat is inside the room while the class is running.</div>';
  input.disabled = true; document.getElementById('lcSend').disabled = true;
} else if (liveSess) {
  await openChat();
} else {
```

(the `else` block's body and the closing brace stay exactly as they are).

- [ ] **Step 7: Add the Start class button to the Broadcast control card**

In the template literal at line 288, replace:

```html
<button type="button" class="pillbtn" id="bcGo">Go live</button></div>
```

with:

```html
<button type="button" class="pillbtn" id="bcGo">Go live</button><button type="button" class="pillbtn" id="bcStartRoom" title="Two-way room: everyone on camera, breakouts, recording">Start class</button></div>
```

Then, in the `const sel = …` destructuring block at lines 292-293, add the new element:

```js
    const sel = document.getElementById('bcSess'), url = document.getElementById('bcUrl'), demo = document.getElementById('bcDemo'),
          goBtn = document.getElementById('bcGo'), bnote = document.getElementById('bcNote'), cam = document.getElementById('bcCam'),
          startRoomBtn = document.getElementById('bcStartRoom');
```

and in `syncCtl()` at line 295, replace:

```js
    function syncCtl() { const s = cur(); url.value = s.stream_url || ''; goBtn.textContent = s.is_live ? 'End session' : 'Go live'; }
```

with:

```js
    function syncCtl() {
      const s = cur(); url.value = s.stream_url || ''; goBtn.textContent = s.is_live ? 'End session' : 'Go live';
      /* room mode opens a room that is not live yet, and ONLY on a kind='thread' row:
         ea-rtk-join and ea-rtk-host both resolve an OPIL room with .eq('kind','thread'),
         so Start class on a 'curriculum' or 'hpc' row would 404. This list carries all
         three kinds (it is built with .neq('kind','milestone')). */
      startRoomBtn.style.display = (s.is_live || rtkMounted || s.kind !== 'thread') ? 'none' : '';
    }
```

Finally, `onAir(on)` at line 296 disables every broadcast control while a camera broadcast is starting or running; the new button has to go dark with them, or a host can open a room on top of a live camera. Replace:

```js
    const onAir = (on) => [sel, url, demo, goBtn].forEach(el => { el.disabled = on; });
```

with:

```js
    const onAir = (on) => [sel, url, demo, goBtn, startRoomBtn].forEach(el => { el.disabled = on; });
```

- [ ] **Step 8: Wire the button**

`syncCtl(); renderPanel();` appears **twice** in this file: at line 363 it is the tail of the `#bcSess` change handler (`panelNo = Number(sel.value); syncCtl(); renderPanel();`) and at line 365 it is the standalone init call at the end of the `if (staff)` block. The listener must be registered **once**, at init — registering it inside the change handler would re-register it on every session switch and would never run at all, because that handler returns early when the camera is busy.

Anchor on line 365, whose full text is unique in the file (four leading spaces, nothing before `syncCtl` on the line):

```js
    syncCtl(); renderPanel();
```

Immediately **before** that line insert:

```js
    startRoomBtn.addEventListener('click', async () => {
      const s = cur();
      /* kind: the same 'thread'-only rule syncCtl uses, repeated here because a keyboard
         user can still reach a display:none button's click through a stale focus, and
         because the guard is the one that actually prevents the 404. */
      if (!s || s.is_live || s.kind !== 'thread') return;
      startRoomBtn.disabled = true; startRoomBtn.textContent = 'Opening…';
      /* startRoom resolves false on every failure state — sign_in, upsell, not_open,
         not_configured, error — and nothing else restores the button, because room mode
         is forbidden to reload. Put the label and the enabled state back by hand. */
      const opened = await startRoom(s.no, String(s.no).padStart(2, '0') + ' · ' + s.title);
      if (!opened) { startRoomBtn.disabled = false; startRoomBtn.textContent = 'Start class'; }
    });
```

- [ ] **Step 9: Hand the row back to stream mode on every broadcast write**

Without this, `mode` sticks. If a class is ended with the **broadcast** End button, or the `meeting.ended` webhook never lands, the row keeps `mode='meeting'` with `is_live=false`; the next plain broadcast **Go live** sets `is_live=true`, and Step 5's branch then mounts a RealtimeKit room instead of the HLS player. The `0029` guard trigger permits exactly this one client transition (`mode` → `'stream'`, never → `'meeting'`), so `flipLive` can do it in the same write. The `location.reload()` on line 324 is untouched.

Replace lines 303-304 inside `flipLive`, which read:

```js
      if (on) { const c = await sb.from('ea_opil_sessions').update({ is_live: false }).eq('is_live', true); if (c.error) throw new Error(c.error.message); }
      const r = await sb.from('ea_opil_sessions').update(on ? { is_live: true, stream_url: u } : { is_live: false }).eq('no', no);
```

with:

```js
      /* mode: 'stream' on every branch — a broadcast is never room mode, and 0029's guard
         trigger allows a client to move mode back to 'stream' (never to 'meeting'). Without
         it a row left at 'meeting' by a missed meeting.ended would mount a room here. */
      if (on) { const c = await sb.from('ea_opil_sessions').update({ is_live: false, mode: 'stream' }).eq('is_live', true); if (c.error) throw new Error(c.error.message); }
      const r = await sb.from('ea_opil_sessions').update(on ? { is_live: true, stream_url: u, mode: 'stream' } : { is_live: false, mode: 'stream' }).eq('no', no);
```

- [ ] **Step 10: Run the structural check — the OPIL half must pass**

Run: `cd /Users/nelsontaylor/taylormade-academy && python3 scripts/check-rtk-pages.py; echo "exit=$?"`
Expected: only the nine `FAIL  live: missing …` lines remain (Task 8 fixes those); every `opil/hub/live:` line is gone, including the `kind='thread'` one — Step 7's `syncCtl()` and Step 8's click handler each contain `s.kind !== 'thread'`, which is the two occurrences the checker counts. `exit=1`.

- [ ] **Step 11: Load the page in a browser and prove it still boots with zero errors**

```bash
cd /Users/nelsontaylor/taylormade-academy && (python3 -m http.server 8769 >/dev/null 2>&1 &)
node - <<'JS'
import { createRequire } from 'node:module';
const require = createRequire('/Users/nelsontaylor/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
await p.goto('http://127.0.0.1:8769/opil/hub/live/', { waitUntil: 'networkidle' });
const url = p.url();
console.log('landed on', url);
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
process.exit(errs.length ? 1 : 0);
JS
pkill -f "http.server 8769"
```
Expected: `landed on http://127.0.0.1:8769/login/?next=/opil/hub/live/` (signed out, `boot()` redirects as it always has) and `no page errors` — which proves the new top-level module code parses and runs. The signed-in host path is exercised by hand in Task 9's rehearsal.

- [ ] **Step 12: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add opil/hub/live/index.html scripts/check-rtk-pages.py
git commit -m "feat(opil): Start class opens a RealtimeKit room next to the broadcast control"
```

---

## Task 8: `live/index.html` — Start webinar for the Academy room

**Files:**
- Modify: `/Users/nelsontaylor/taylormade-academy/live/index.html:152` (stylesheet link), `:175` (module state), `:331` (the admin card markup), `:336-341` (`setLive` gains `mode:"stream"`), `:343` (`#aStartRoom` wiring), `:371-373` (`shellHTML` gains `#rtk-root`), `:393-401` (the member branch's mode switch), `:474` (the chat poll guard)

**Line numbers verified against the file on 2026-09-11.** Every step quotes the exact text it replaces — anchor on the text, not the number.

**Interfaces:**
- Consumes: Task 6's `/js/rtk-room.js` exports `mountRoom`, `hostStart`, `armHostBar` and `/css/rtk-room.css`; Task 1's `ea_live.mode` / `.rtk_meeting_id` (inside the member branch's existing `select("*")`); Task 3's `ea-rtk-join` and Task 4's `ea-rtk-host`; the existing `ea_live_admin_write` policy (`0021:23-25`, re-scoped by `0023:66-68`) for the lazy row insert.
- Produces: nothing other tasks import. The page must end up with `#rtk-root`, `#aStartRoom`, and no new `location.reload()` — `scripts/check-rtk-pages.py` (Task 7) enforces it.

- [ ] **Step 1: Run the structural check to confirm the Academy half still fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && python3 scripts/check-rtk-pages.py; echo "exit=$?"`
Expected: `FAIL  live: missing the rtk-room stylesheet link`, `…the #rtk-root mount point`, `…the Start room button`, `…the lazy import of /js/rtk-room.js`, `…the mountRoom call`, `…the host bar arming`, `…the hostStart call`; `exit=1`.

- [ ] **Step 2: Add the stylesheet link**

Edit `/Users/nelsontaylor/taylormade-academy/live/index.html`. Line 152 is the `broadcast.css` link; anchor on the prefix `href="/css/broadcast.css?v=` only, because `build_site.py` restamps the hash on every build (it reads `?v=87d8a3fd1e` today). Insert on the line after it:

```html
<link rel="stylesheet" href="/css/rtk-room.css">
```

- [ ] **Step 3: Add the room-mode state and helpers**

After line 175 (`let me = null, isMember = false, isAdmin = false, show = null, bootError = false;`) insert:

```js
/* ---------- room mode (RealtimeKit) ----------
   `mode` on the ea_live row is the branch key: 'stream' is today's player, 'meeting' is
   the RealtimeKit room. Nothing in here reloads; the broadcast handlers keep their reload. */
const ROOM = "academy";
let rtkMounted = false;

function rtkNote(title, body){
  const player = $("player");
  if (player) player.innerHTML = '<div class="idle"><b>' + esc(title) + '</b><p>' + esc(body) + '</p></div>';
  const root = $("rtk-root"); if (root) root.hidden = true;
  document.body.classList.remove("in-meeting");
}
function onRtkState(s){
  if (s === "upsell") return rtkNote("Live classes are part of the membership.", "Join to get the room, the chat, and every replay.");
  if (s === "not_open") return rtkNote("The room opens when the class starts.", "Keep this page open; it opens the moment Nelson starts.");
  if (s === "sign_in") return rtkNote("Your sign-in expired.", "Reload the page to get back into the room.");
  if (s === "not_configured") return rtkNote("Rooms are not set up yet.", "Broadcast mode still works.");
  if (s === "error") return rtkNote("The room could not load.", "That is on us. Refresh in a moment.");
  if (s === "ended") { $("hChip").className = "airchip off"; $("hChip").innerHTML = "Off air"; }
}
async function enterRoom(id, title){
  const { mountRoom, armHostBar } = await import("/js/rtk-room.js");
  document.body.classList.add("in-meeting");
  const r = await mountRoom({ room: ROOM, ref: id, sb, cfg: window.BM_CONFIG, onState: onRtkState });
  if (!r) return null;
  rtkMounted = true;
  $("hTitle").textContent = title || "The live room";
  $("hChip").className = "airchip live"; $("hChip").innerHTML = "<i></i>LIVE NOW";
  if (r.join.host) {
    let armed = false;
    r.el.addEventListener("rtkStatesUpdate", (e) => {
      if (e.detail.meeting !== "joined" || armed) return;
      armed = true;
      armHostBar({ r, start: null, room: ROOM, ref: id, sb, cfg: window.BM_CONFIG, onEnded: () => onRtkState("ended") });
    });
  }
  return r;
}
/* Returns true only when the room mounted AND ea-rtk-join called this user a host.
   Returns false on every failure mountRoom can produce (sign_in / upsell / not_open /
   not_configured / error), so the click handler can put its button back — room mode is
   never allowed to reload the page. */
async function startRoom(id, title){
  const { mountRoom, hostStart, armHostBar } = await import("/js/rtk-room.js");
  if (poll) { clearInterval(poll); poll = null; }      /* the 12s chat poll: the page chat is gone in room mode */
  document.body.classList.add("in-meeting");
  const r = await mountRoom({ room: ROOM, ref: id, sb, cfg: window.BM_CONFIG, onState: onRtkState });
  if (!r || !r.join.host) return false;                /* ea-rtk-join decides host-ness, never the page */
  rtkMounted = true;
  $("hTitle").textContent = title || "The live room";
  let started = false;
  r.el.addEventListener("rtkStatesUpdate", async (e) => {   /* never meeting.join(): the setup screen's Join does it */
    if (e.detail.meeting !== "joined" || started) return;
    started = true;
    const res = await hostStart({ room: ROOM, ref: id, sb, cfg: window.BM_CONFIG, record: true });
    if (res.status === 200) { $("hChip").className = "airchip live"; $("hChip").innerHTML = "<i></i>LIVE NOW"; }
    armHostBar({ r, start: res, room: ROOM, ref: id, sb, cfg: window.BM_CONFIG, onEnded: () => onRtkState("ended") });
  });
  return true;
}
```

`poll` is declared with `let` at line 431 in the same module scope, so clearing it here is safe.

- [ ] **Step 4: Add the Start webinar button to the admin card**

In the `$("admin").innerHTML = …` block, replace line 331:

```js
    '<button class="' + (liveNow ? "end" : "go") + '" id="aGo" type="button">' + (liveNow ? "End broadcast" : "Go live") + '</button></div>' +
```

with:

```js
    '<button class="' + (liveNow ? "end" : "go") + '" id="aGo" type="button">' + (liveNow ? "End broadcast" : "Go live") + '</button>' +
    (liveNow ? "" : '<button class="go" id="aStartRoom" type="button" title="Two-way room: members on camera by request, recording, replay">Start webinar</button>') + '</div>' +
```

- [ ] **Step 4b: Hand the row back to stream mode on every broadcast write**

Without this, `mode` sticks. If a webinar is ended with the **broadcast** End button, or the `meeting.ended` webhook never lands, the row keeps `mode='meeting'` with `is_live=false`; the next plain **Go live** sets `is_live=true`, and Step 7's branch then mounts a RealtimeKit room instead of the HLS player. The `0029` guard trigger permits exactly this one client transition (`mode` → `'stream'`, never → `'meeting'`). The `location.reload()` on line 356 is untouched.

Replace lines 336-341, which read:

```js
  async function setLive(payload) {
    if (payload.is_live) await sb.from("ea_live").update({ is_live:false }).eq("is_live", true);
    const res = show && show.id
      ? await sb.from("ea_live").update(payload).eq("id", show.id)
      : await sb.from("ea_live").insert(payload);
    if (res.error) throw new Error(res.error.message);
```

with:

```js
  async function setLive(payload) {
    /* mode: "stream" on every broadcast write — a broadcast is never room mode, and 0029's
       guard trigger allows a client to move mode back to "stream" (never to "meeting").
       Without it a row left at "meeting" by a missed meeting.ended would mount a room here.
       Object.assign puts it FIRST so an explicit mode in payload would still win. */
    payload = Object.assign({ mode: "stream" }, payload);
    if (payload.is_live) await sb.from("ea_live").update({ is_live:false, mode: "stream" }).eq("is_live", true);
    const res = show && show.id
      ? await sb.from("ea_live").update(payload).eq("id", show.id)
      : await sb.from("ea_live").insert(payload);
    if (res.error) throw new Error(res.error.message);
```

- [ ] **Step 5: Wire the button, with the lazy row insert and the public-row rule**

Immediately after line 343, whose full text is `  $("aDemo").addEventListener("click", () => { $("aUrl").value = DEMO_URL; });`, insert:

```js
  /* The ONE room-mode button. `show` is null when no ea_live row falls in the window, so
     the same admin write setLive uses inserts the row first (no rtk_meeting_id and no mode
     in the payload, so the 0029 guard trigger passes), then the button joins with the new
     id. v1 keeps access='public' rows broadcast-only; the server refuses too. */
  if ($("aStartRoom")) {
    $("aStartRoom").disabled = !!(show && show.access === "public");
    $("aStartRoom").title = $("aStartRoom").disabled
      ? "Public shows are broadcast-only. Room mode is for members."
      : "Two-way room: members on camera by request, recording, replay";
    $("aStartRoom").addEventListener("click", async () => {
      if (liveNow) return;
      const btn = $("aStartRoom"), note = $("aNote");
      btn.disabled = true; btn.textContent = "Opening...";
      if (!show) {
        const { data, error } = await sb.from("ea_live")
          .insert({ title: $("aTitle").value.trim() || "Taylormade Academy Live", is_live: false })
          .select("*").single();
        if (error) { btn.disabled = false; btn.textContent = "Start webinar"; note.textContent = error.message; return; }
        show = data;
      }
      if (show.access === "public") {
        btn.disabled = false; btn.textContent = "Start webinar";
        note.textContent = "Public shows are broadcast-only. Room mode is for members.";
        return;
      }
      /* startRoom resolves false on every failure state — sign_in, upsell, not_open,
         not_configured, error — and nothing else restores the button, because room mode
         is forbidden to reload. Put the label and the enabled state back by hand. */
      const opened = await startRoom(show.id, $("aTitle").value.trim() || show.title);
      if (!opened) { btn.disabled = false; btn.textContent = "Start webinar"; }
    });
  }
```

- [ ] **Step 6: Give `shellHTML` the mount point**

Replace lines 371-373, which read:

```js
function shellHTML(bodyRight){
  return '<div class="live-grid"><div>' +
    '<div class="player" id="player"><div class="idle" id="idle"><b id="idleT">Nothing is streaming right now.</b><p id="idleP">When a class goes live you will see it here, and the room opens with it.</p></div></div>' +
```

with:

```js
function shellHTML(bodyRight){
  return '<div class="live-grid"><div>' +
    '<section id="rtk-root" hidden></section>' +
    '<div class="player" id="player"><div class="idle" id="idle"><b id="idleT">Nothing is streaming right now.</b><p id="idleP">When a class goes live you will see it here, and the room opens with it.</p></div></div>' +
```

(the remaining three lines of the function are unchanged).

- [ ] **Step 7: Branch on `mode` in the member state**

Replace lines 393-401, which read:

```js
} else if (isMember) {
  stage.innerHTML = shellHTML(chatHTML);
  if (liveNow && show.stream_url) {
    mountStream($("player"), show.stream_url, show.title).catch(() => {});
  } else {
    $("idleT").textContent = show && show.starts_at ? "Next class is on the calendar." : "Nothing is streaming right now.";
    $("idleP").textContent = show && show.starts_at ? whenFull(show.starts_at) + ". The room opens when it starts." : "When a class goes live you will see it here, and the room opens with it.";
  }
  wireChat();
} else {
```

with:

```js
} else if (isMember) {
  stage.innerHTML = shellHTML(chatHTML);
  if (liveNow && show.mode === "meeting") {
    await enterRoom(show.id, show.title);
  } else if (liveNow && show.stream_url) {
    mountStream($("player"), show.stream_url, show.title).catch(() => {});
  } else {
    $("idleT").textContent = show && show.starts_at ? "Next class is on the calendar." : "Nothing is streaming right now.";
    $("idleP").textContent = show && show.starts_at ? whenFull(show.starts_at) + ". The room opens when it starts." : "When a class goes live you will see it here, and the room opens with it.";
  }
  wireChat();
} else {
```

- [ ] **Step 8: Keep the chat poll off in room mode**

Replace line 474, which reads:

```js
  if (liveNow) poll = setInterval(load, 12000);     /* no reason to poll an empty room */
```

with:

```js
  if (liveNow && !rtkMounted) poll = setInterval(load, 12000);   /* no reason to poll an empty room, or a hidden one */
```

- [ ] **Step 9: Run the structural check — both pages must pass now**

Run: `cd /Users/nelsontaylor/taylormade-academy && python3 scripts/check-rtk-pages.py; echo "exit=$?"`
Expected: `PASS  both live pages carry room mode (2 pages checked)` and `exit=0`.

- [ ] **Step 10: Load the page signed-out and prove it still boots with zero errors**

```bash
cd /Users/nelsontaylor/taylormade-academy && (python3 -m http.server 8769 >/dev/null 2>&1 &)
node - <<'JS'
import { createRequire } from 'node:module';
const require = createRequire('/Users/nelsontaylor/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:8769/live/', { waitUntil: 'networkidle' });
const gate = await p.locator('.gatecard').count();
const root = await p.locator('#rtk-root').count();
console.log('gatecard:', gate, 'rtk-root:', root);
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
process.exit(errs.length || gate !== 1 ? 1 : 0);
JS
pkill -f "http.server 8769"
```
Expected: `gatecard: 1 rtk-root: 0` (signed out gets the members-only upsell, which has no shell) and `no page errors`. The member and admin paths are exercised by hand in Task 9's rehearsal.

- [ ] **Step 11: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add live/index.html
git commit -m "feat(live): Start webinar opens a RealtimeKit room on the Academy live page"
```

---

## Task 9: Asset registration, service-worker bump, deploy, and the live rehearsal

**Files:**
- Modify: `/Users/nelsontaylor/taylormade-academy/build_site.py:15-18` (the `_asset_ver` tuple), `:214` (`_ASSET_RX`)
- Modify: `/Users/nelsontaylor/taylormade-academy/sw.js:6` (`VERSION`: `'tma-v9-opil-facilitators'` → `'tma-v10-rtk-rooms'`)
- Modify: `/Users/nelsontaylor/taylormade-academy/supabase/functions/README.md` (the three new functions)
- Modify: `/Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/fixtures/*.json` (replaced with the real captures)
- Modify: `/Users/nelsontaylor/taylormade-academy/opil/hub/live/index.html`, `/Users/nelsontaylor/taylormade-academy/live/index.html` (rewritten in place by `build_site.py` — `?v=` stamps only)

**Interfaces:**
- Consumes: Task 6's `js/rtk-room.js` + `css/rtk-room.css`; Tasks 7 and 8's bare `/js/rtk-room.js` and `/css/rtk-room.css` references; Tasks 3–5's deployed functions; Task 1's migration, already applied.
- Produces: the shipped site. `HUB_PAGES` already contains `"opil/hub/live"` and `"live"` (`build_site.py:232-235`), so both pages are stamped by `stamp_hub_pages`; nothing else has to change there.

- [ ] **Step 1: Write the failing assertion**

```bash
cd /Users/nelsontaylor/taylormade-academy
python3 - <<'PY'
import pathlib, re, sys
ROOT = pathlib.Path('.')
bs = (ROOT / 'build_site.py').read_text()
fail = []
if '"js/rtk-room.js"' not in bs or '"css/rtk-room.css"' not in bs:
    fail.append('build_site.py: rtk-room assets are not in _asset_ver')
if 'js/rtk-room\\.js' not in bs or 'css/rtk-room\\.css' not in bs:
    fail.append('build_site.py: rtk-room assets are not in _ASSET_RX')
for p in ('live/index.html', 'opil/hub/live/index.html'):
    html = (ROOT / p).read_text()
    for asset in ('/js/rtk-room.js', '/css/rtk-room.css'):
        if not re.search(re.escape(asset) + r'\?v=[a-z0-9]{10}', html):
            fail.append(f'{p}: {asset} is not stamped with ?v=')
sw = (ROOT / 'sw.js').read_text()
if "VERSION = 'tma-v10-rtk-rooms'" not in sw:
    fail.append('sw.js: VERSION was not bumped to tma-v10-rtk-rooms')
print('\n'.join('FAIL  ' + f for f in fail) if fail else 'PASS  assets registered and sw bumped')
sys.exit(1 if fail else 0)
PY
echo "exit=$?"
```
Expected: seven `FAIL` lines and `exit=1` — one for `_asset_ver`, one for `_ASSET_RX`, one for each of the four (page, asset) pairs (`live/index.html` and `opil/hub/live/index.html` × `/js/rtk-room.js` and `/css/rtk-room.css`), and one for `sw.js`.

- [ ] **Step 2: Register the two assets in `build_site.py`**

Replace lines 15-18, which read:

```python
    for rel in ("css/build-mode.css", "js/site.js", "js/config.js", "js/pwa.js", "js/native.js", "js/meta-pixel.js",
                "css/agent.css", "js/agent.js", "js/founder.js",
                "opil/hub/hub.css", "opil/hub/hub.js", "opil/hub/tour.js",
                "js/broadcast.js", "css/broadcast.css"):
```

with:

```python
    for rel in ("css/build-mode.css", "js/site.js", "js/config.js", "js/pwa.js", "js/native.js", "js/meta-pixel.js",
                "css/agent.css", "js/agent.js", "js/founder.js",
                "opil/hub/hub.css", "opil/hub/hub.js", "opil/hub/tour.js",
                "js/broadcast.js", "css/broadcast.css",
                "js/rtk-room.js", "css/rtk-room.css"):
```

Then replace line 214, which reads:

```python
_ASSET_RX = re.compile(r'(/(?:css/build-mode\.css|css/broadcast\.css|js/site\.js|js/config\.js|js/founder\.js|js/broadcast\.js))(?:\?v=[a-z0-9]+)?')
```

with:

```python
_ASSET_RX = re.compile(r'(/(?:css/build-mode\.css|css/broadcast\.css|css/rtk-room\.css|js/site\.js|js/config\.js|js/founder\.js|js/broadcast\.js|js/rtk-room\.js))(?:\?v=[a-z0-9]+)?')
```

- [ ] **Step 3: Bump the service worker**

Replace line 6 of `/Users/nelsontaylor/taylormade-academy/sw.js`. It reads (verified 2026-09-11 — the site is already on v9, so the next number is v10, not v9 again):

```js
const VERSION = 'tma-v9-opil-facilitators';
```

with:

```js
const VERSION = 'tma-v10-rtk-rooms';
```

- [ ] **Step 4: Build and re-run the assertion**

```bash
cd /Users/nelsontaylor/taylormade-academy && python3 build_site.py && python3 - <<'PY'
import pathlib, re, sys
ROOT = pathlib.Path('.')
bs = (ROOT / 'build_site.py').read_text()
fail = []
if '"js/rtk-room.js"' not in bs or '"css/rtk-room.css"' not in bs: fail.append('build_site.py: _asset_ver')
if 'js/rtk-room\\.js' not in bs or 'css/rtk-room\\.css' not in bs: fail.append('build_site.py: _ASSET_RX')
for p in ('live/index.html', 'opil/hub/live/index.html'):
    html = (ROOT / p).read_text()
    for asset in ('/js/rtk-room.js', '/css/rtk-room.css'):
        if not re.search(re.escape(asset) + r'\?v=[a-z0-9]{10}', html): fail.append(f'{p}: {asset} unstamped')
        if re.search(re.escape(asset) + r'\?v=[a-z0-9]+\?', html): fail.append(f'{p}: {asset} double-stamped')
if "VERSION = 'tma-v10-rtk-rooms'" not in (ROOT / 'sw.js').read_text(): fail.append('sw.js VERSION')
print('\n'.join('FAIL  ' + f for f in fail) if fail else 'PASS  assets registered and sw bumped')
sys.exit(1 if fail else 0)
PY
python3 scripts/check-rtk-pages.py
```
Expected: `build_site.py` prints its usual output, then `PASS  assets registered and sw bumped`, then `PASS  both live pages carry room mode (2 pages checked)`. Both `?v=` values are the same ten-character hash.

- [ ] **Step 5: Document the three functions**

Append to `/Users/nelsontaylor/taylormade-academy/supabase/functions/README.md`:

````markdown
## RealtimeKit live rooms (added 2026-09-11)

| Function | verify_jwt | What it does | Secrets it reads |
| --- | --- | --- | --- |
| `ea-rtk-join` | false | Resolves the caller's role through the existing RPCs, validates the preset against the five-name allowlist, creates-or-gets the row's meeting (race-safe claim), and returns a per-person participant token. Non-hosts are gated behind `is_live && mode='meeting'` (409 `not_open`). | `CF_ACCOUNT_ID`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN` |
| `ea-rtk-host` | false | Host-only: `start` (one-live clear + `mode='meeting'` + session pin + recording), `end_session` (stop recording → kick-all → `{is_live:false, mode:'stream'}`), `start_recording`, `stop_recording`, `status`. Never returns a redirect; the page updates the DOM in place. | `CF_ACCOUNT_ID`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN` |
| `ea-rtk-webhook` | false | RealtimeKit → us. RSA-SHA256 over the raw body against `https://api.realtime.cloudflare.com/.well-known/webhooks.json`, `rtk-webhook-id` must match, `rtk-uuid` dedupe. `recording.statusUpdate` UPLOADED → Stream copy-by-URL → `replay_url`/`recording_url`; transcript + summary → `ea_rtk_artifacts` + a playbook draft; `meeting.ended` → off-air backstop. | `CF_RTK_WEBHOOK_ID`, `CF_ACCOUNT_ID`, `CF_API_TOKEN` (Stream:Edit), `CF_STREAM_SUBDOMAIN`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN` |

```bash
supabase functions deploy ea-rtk-join    --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-rtk-host    --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
```

Unit tests (no network, no database):

```bash
deno test -A supabase/functions/_shared/rtk_test.ts
deno test -A supabase/functions/ea-rtk-join/handler_test.ts
deno test -A supabase/functions/ea-rtk-host/handler_test.ts
deno test -A supabase/functions/ea-rtk-webhook/handler_test.ts
```

The five presets are created and re-asserted by `scripts/rtk-presets.sh` from the committed
bodies in `scripts/rtk-presets/`. Task 5 Step 8 probed both webhook listing routes and exactly
one answered `200`; before committing this README, replace the line below with whichever it was,
so the next person does not have to probe again.

**Webhook listing route on this account:** `GET $RTK/webhooks` (replace with `GET $RTK/webhooks/all`
if that is the route that returned 200 in Task 5 Step 8).
````

- [ ] **Step 6: Run every unit test once more, then commit and push**

```bash
cd /Users/nelsontaylor/taylormade-academy
deno test -A supabase/functions/_shared/rtk_test.ts \
  && deno test -A supabase/functions/ea-rtk-join/handler_test.ts \
  && deno test -A supabase/functions/ea-rtk-host/handler_test.ts \
  && deno test -A supabase/functions/ea-rtk-webhook/handler_test.ts
git add build_site.py sw.js supabase/functions/README.md live/index.html opil/hub/live/index.html
git commit -m "build(live): register rtk-room assets, bump sw to tma-v10-rtk-rooms, document the three functions"
git push
```
Expected: four `ok | … passed | 0 failed` lines, then a successful push. GitHub Pages rebuilds in about a minute.

- [ ] **Step 7: Verify the deploy on the BARE URL**

A `?cb=$RANDOM` is a false green — `sw.js`'s runtime cache serves the real one. Check the bare URLs:

```bash
V="$(python3 -c "import re;print(re.search(r'/js/rtk-room\.js\?v=([a-z0-9]+)', open('/Users/nelsontaylor/taylormade-academy/live/index.html').read()).group(1))")"
echo "expecting ?v=$V"
for u in "https://taylormadeacademy.com/js/rtk-room.js?v=$V" \
         "https://taylormadeacademy.com/css/rtk-room.css?v=$V" \
         "https://taylormadeacademy.com/sw.js"; do
  printf '%s -> %s\n' "$u" "$(curl -sS -o /dev/null -w '%{http_code}' "$u")"
done
curl -sS https://taylormadeacademy.com/sw.js | grep -m1 "const VERSION"
curl -sS https://taylormadeacademy.com/live/ | grep -o "/js/rtk-room.js?v=[a-z0-9]*"
curl -sS https://taylormadeacademy.com/opil/hub/live/ | grep -o "/css/rtk-room.css?v=[a-z0-9]*"
```
Expected: three `200`s, `const VERSION = 'tma-v10-rtk-rooms';`, and both pages echoing `?v=<the same hash>`.

- [ ] **Step 8: The live rehearsal — the checklist Nelson runs**

Two browsers (or a laptop and a phone): **A** signed in as the admin/coordinator, **B** signed in as a member/cohort student. Work down the list and tick each line.

**Before you start — write down what the cleanup has to reach.** The rehearsal creates real production rows, and Step 10 deletes them by name.
- [ ] A: pick the OPIL session you will rehearse on and write its number down here as `REHEARSAL_NO=<no>`. Step 10 clears its `rtk_*` columns and retires its Cloudflare meeting.
- [ ] A: on `/live/`, type **`zz-test-rehearsal`** into the class-title field (`#aTitle`) **before** pressing Start webinar. The button inserts an `ea_live` row titled with whatever is in that field, and Step 10 deletes on `title like 'zz-test-%'` — an untitled rehearsal leaves a stray member-visible live row in production.

**OPIL class (`/opil/hub/live/`)**
- [ ] A: the Broadcast control card shows **Go live** *and* **Start class**; the session picker reads the right session.
- [ ] B: the page shows the idle card. Nothing is live.
- [ ] A: press **Start class** → the RealtimeKit setup screen appears in Academy navy with the gold accent and Inter type, inside a full-height `#rtk-root` (not a 16:9 box).
- [ ] A: press the setup screen's **Join** → the room opens; the host bar appears under it with a green **LIVE** chip, a headcount, **Mute all**, **Recording**, **End for everyone**.
- [ ] A: the More menu does **not** contain a recording toggle; the header REC pill *is* there.
- [ ] A: the page did **not** reload at any point (the camera would have died).
- [ ] B: reload → B lands straight in the room, sees A's video, can chat inside the meeting; the page chat column is gone; on a phone the bottom dock is gone and the room's own control bar is reachable.
- [ ] A: press **Mute all** → B is muted.
- [ ] B (phone): camera flip works; the control bar is not hidden under the brand bar.
- [ ] A: press **Recording** → it reads "Start recording"; press again → "Recording".
- [ ] Talk for two minutes, then A: press **End for everyone**.
- [ ] Both: the room collapses to "Class ended. The replay lands here once it is processed."; neither page reloaded.

**Academy webinar (`/live/`)**
- [ ] A: the admin card shows **Go live** *and* **Start webinar**; on a row with `access='public'` the button is disabled with the note "Public shows are broadcast-only."
- [ ] A: with `zz-test-rehearsal` already typed into the title field, press **Start webinar** with no row in the window → a row titled `zz-test-rehearsal` is created, then the setup screen appears.
- [ ] B (member): reload → in the room. B's mic/camera are off with a "request to speak" affordance (the `CAN_REQUEST` webinar recipe).
- [ ] B: raise a hand → A sees the request in the host bar queue (or in the stock stage queue) and can Allow.
- [ ] A: **End for everyone** → both pages show the ended card.

**Then, in the database and in Cloudflare**
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select event, meeting_id, session_id, handled_at, error from public.ea_rtk_events order by received_at desc limit 20;"}'
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select room, ref, kind, status, url, left(coalesce(text,'\'''\''),80) as head from public.ea_rtk_artifacts order by created_at desc limit 20;"}'
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select no, is_live, mode, rtk_session_id, recording_url from public.ea_opil_sessions where rtk_meeting_id is not null;"}'
```
- [ ] `ea_rtk_events` holds `meeting.started`, `recording.statusUpdate` × N, `meeting.ended`, and (a few minutes later) `meeting.transcript` and `meeting.summary` — every one with `handled_at` set and `error` null.
- [ ] `ea_rtk_artifacts` holds a `recording` row with a `https://customer-nimm2h959enrq4x1.cloudflarestream.com/<uid>/watch` URL, a `transcript` and a `summary` row at `ready`, and one `playbook` row at `draft`.
- [ ] The session row reads `is_live=false, mode='stream'` after End, and `recording_url` is the watch URL.
- [ ] Cloudflare dashboard → Stream → Videos: the copied recording is there; opening the `/watch` URL plays it.
- [ ] As the coordinator: `ea_rtk_session_notes('opil','<no>')` returns the draft; as a student it returns `null`.
```bash
curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $TMA_ADMIN_JWT" -H "Content-Type: application/json" \
  -X POST "$SB_REST/rpc/ea_rtk_session_notes" -d '{"p_room":"opil","p_ref":"<no>"}' | jq '{playbook_status, has_summary: (.summary != null), recordings: (.recordings | length)}'
```

- [ ] **Step 9: Replace the webhook fixtures with the real captures and re-run the tests**

The fixtures written in Task 5 carry the documented envelope; now there are real ones. Spike 10(c) closes here.

```bash
cd /Users/nelsontaylor/taylormade-academy
for E in meeting.ended recording.statusUpdate meeting.transcript meeting.summary; do
  curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
    -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
    -d "{\"query\":\"select payload from public.ea_rtk_events where event = '$E' order by received_at desc limit 1;\"}" \
    | jq -c '.[0].payload' > "/tmp/$E.json"
  echo "$E -> $(head -c 160 /tmp/$E.json)"
done
```
Compare each capture with the matching file in `supabase/functions/ea-rtk-webhook/fixtures/`. If a meeting id or session id sits at a path `pickMeetingId` / `pickSessionId` does not probe, add that path to the function **and a case to the test**, then copy the real bodies over the fixtures (the `recording.statusUpdate` capture goes to `recording.statusUpdate.UPLOADED.json` — pick the one whose `status` is `UPLOADED`) and re-run:

```bash
deno test -A supabase/functions/ea-rtk-webhook/handler_test.ts
```
Expected: `ok | 17 passed | 0 failed` against the real payload shapes.

- [ ] **Step 10: Set the billing alert and clean up everything the rehearsal created**

- [ ] Cloudflare → Billing → Notifications → a $50/month alert, before the first real class.

The rehearsal created four kinds of production state, and each needs its own delete. Note that the `ea_rtk_events` rows carry **Cloudflare's** `rtk-uuid` delivery ids, never a `zz-test-` prefix, so they can only be found through the rehearsal meeting id — a `where id like 'zz-test-%'` delete is a no-op. Set `REHEARSAL_NO` first:

```bash
export REHEARSAL_NO=<the OPIL session number you rehearsed on>
```

1. Capture both rehearsal meeting ids **before** deleting anything:

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\":\"select 'academy' as room, rtk_meeting_id from public.ea_live where title like 'zz-test-%' and rtk_meeting_id is not null union all select 'opil', rtk_meeting_id from public.ea_opil_sessions where no = $REHEARSAL_NO and rtk_meeting_id is not null;\"}" | tee /tmp/rtk-rehearsal-meetings.json
```
Expected: one or two rows. Export them:
```bash
export ACADEMY_MID="$(jq -r '.[] | select(.room=="academy") | .rtk_meeting_id // empty' /tmp/rtk-rehearsal-meetings.json)"
export OPIL_MID="$(jq -r '.[] | select(.room=="opil") | .rtk_meeting_id // empty' /tmp/rtk-rehearsal-meetings.json)"
echo "academy=$ACADEMY_MID opil=$OPIL_MID"
```

2. Delete the child rows first (they key on `meeting_id`, so they must go before the parent rows lose their ids), then the Academy row, then clear the real OPIL session's four server columns — that row is a real curriculum row and must survive:

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/$SB_REF/database/query" \
  -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\":\"delete from public.ea_rtk_artifacts    where meeting_id in ('$ACADEMY_MID','$OPIL_MID'); delete from public.ea_rtk_events       where meeting_id in ('$ACADEMY_MID','$OPIL_MID'); delete from public.ea_rtk_participants where meeting_id in ('$ACADEMY_MID','$OPIL_MID'); delete from public.ea_live where title like 'zz-test-%'; update public.ea_opil_sessions set rtk_meeting_id = null, rtk_session_id = null, rtk_started_at = null, mode = 'stream', is_live = false where no = $REHEARSAL_NO; delete from public.ea_opil_sessions where no in (9098, 9099); select (select count(*) from public.ea_live where title like 'zz-test-%') as live_left, (select count(*) from public.ea_rtk_events where meeting_id in ('$ACADEMY_MID','$OPIL_MID')) as ev_left, (select count(*) from public.ea_rtk_artifacts where meeting_id in ('$ACADEMY_MID','$OPIL_MID')) as art_left, (select count(*) from public.ea_rtk_participants where meeting_id in ('$ACADEMY_MID','$OPIL_MID')) as part_left, (select count(*) from public.ea_opil_sessions where no = $REHEARSAL_NO and rtk_meeting_id is not null) as opil_pins;\"}"
```
Expected: `[{"live_left":0,"ev_left":0,"art_left":0,"part_left":0,"opil_pins":0}]`.

3. Retire both Cloudflare meetings so neither can be rejoined or keep billing:

```bash
for MID in "$ACADEMY_MID" "$OPIL_MID"; do
  [ -z "$MID" ] && continue
  printf '%s -> ' "$MID"
  curl -sS -X PATCH "$RTK/meetings/$MID" -H "Authorization: Bearer $CF_RTK_API_TOKEN" \
    -H "Content-Type: application/json" -d '{"status":"INACTIVE"}' | jq -c '{success, status: (.data // .result).status}'
done
```
Expected, per meeting: `{"success":true,"status":"INACTIVE"}`.

4. The rehearsal also copied its recording into Cloudflare Stream. Leave the Stream video in place only if Nelson wants the sample; otherwise delete it from Cloudflare → Stream → Videos by hand (it is named `OPIL Session …` / `Academy Live — zz-test-rehearsal …`).

5. Local scratch:

```bash
rm -f /Users/nelsontaylor/taylormade-academy/rtk-harness.html
git -C /Users/nelsontaylor/taylormade-academy status --porcelain
```
Expected: a clean-or-expected `git status` (only the fixture updates from Step 9, if any).

- [ ] **Step 11: Commit**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/functions/ea-rtk-webhook/fixtures supabase/functions/ea-rtk-webhook/handler.ts supabase/functions/ea-rtk-webhook/handler_test.ts supabase/functions/README.md
git commit -m "test(live): real webhook payload fixtures from the first rehearsal"
git push
```

---

---

## Task 10: The read-only "Session notes (AI draft)" panel on `/opil/hub/admin/` and `/live/`

Spec §8 "Where it surfaces" and §16's v1 scope both require it: `ea_rtk_session_notes` is built in Task 1 and read by curl in Task 9, but no human-facing surface renders it. This task adds the two panels and nothing else. **Read-only, always** — no step here writes draft text into `ea_opil_sessions.playbook_url` (student-readable through `sess_read`; it holds the *published* playbook link) or into any other member-readable column.

§17 item 9 ("publish playbook") is open; the documented v1 default applies — nothing publishes a draft, the coordinator copies the text out by hand and pastes the published page's link into the existing Playbook URL field.

**Files:**
- Modify: `/Users/nelsontaylor/taylormade-academy/opil/hub/admin/index.html` — `:306` (the `<details>` goes after the Playbook input inside `sessRow` — anchor on `data-f="playbook" data-s="${s.no}"`), `:323` (the notes helpers go above `const mgr = document.getElementById('sessMgr');`), `:340` (`if (!facOnly) renderFacSess();` — add the `wireNotes()` call beside it)
- Modify: `/Users/nelsontaylor/taylormade-academy/live/index.html` — `:333` (the card markup after `panelHTML("bcPanel")`), `:343` (the loader wiring)
- Create: `/Users/nelsontaylor/taylormade-academy/scripts/check-rtk-notes.py`

**Line numbers verified against both files on 2026-09-11.** Each step quotes the exact text it replaces — anchor on the text, not the number.

**Interfaces:**
- Consumes: Task 1's `public.ea_rtk_session_notes(p_room text, p_ref text) returns jsonb`, executable by `authenticated`, returning `null` unless the caller is an Academy admin (`ea_is_admin()`), an OPIL coordinator (`ea_opil_is_admin(auth.uid())`) or a facilitator of that session (`ea_opil_fac_sessions(auth.uid())`); its object is `{summary, playbook, playbook_status, transcript, recordings: [{status, url, expires_at, expired, meta}]}` where `expired` is already computed server-side. The admin page's existing `sb` and `esc` (`opil/hub/admin/index.html:114` and `:117`); the live page's existing `sb`, `esc` (`live/index.html:159`) and `$` (`:158`), and the `.adminbar` / `.ah` styles (`:87-90`).
- Produces: nothing other tasks import. Both pages must end up calling `sb.rpc('ea_rtk_session_notes', …)` and must contain no write to `playbook_url` other than the one that already exists in the sessions-manager save handler (`opil/hub/admin/index.html:427`, `playbook_url: pb` inside the `patch` object) — `scripts/check-rtk-notes.py` enforces both.

- [ ] **Step 1: Write the failing structural test**

Create `/Users/nelsontaylor/taylormade-academy/scripts/check-rtk-notes.py`:

```python
#!/usr/bin/env python3
"""The Session notes (AI draft) panel: present, read-only, never writing draft text to a
member-readable row.
Run: python3 scripts/check-rtk-notes.py
Spec: docs/superpowers/specs/2026-09-10-realtimekit-live-rooms-design.md §8, §16"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent.parent
FAIL = []

PAGES = [
    {"name": "opil/hub/admin", "path": "opil/hub/admin/index.html", "room": "p_room: 'opil'"},
    {"name": "live",           "path": "live/index.html",           "room": 'p_room: "academy"'},
]
for p in PAGES:
    html = (ROOT / p["path"]).read_text()
    if "ea_rtk_session_notes" not in html:
        FAIL.append(f'{p["name"]}: never calls ea_rtk_session_notes')
    if p["room"] not in html:
        FAIL.append(f'{p["name"]}: does not pass {p["room"]}')
    # Needles are anchored to the panel's OWN symbols, never to the bare field name.
    # opil/hub/admin/index.html already contains the word "recordings" in prose (:69) and
    # and "summary" inside the two <summary> tags of sessRow — bare-word checks
    # would pass there before a single line of this task was written. Each tuple is a set of
    # accepted spellings, because the OPIL page is single-quoted and the Academy page is not.
    for field, needles in (
        ("playbook_status", ("n.playbook_status",)),
        ("transcript",      ("notesBlock('Transcript'", 'notesBlock("Transcript"')),
        ("recordings",      ("n.recordings",)),
        ("summary",         ("notesBlock('Summary'", 'notesBlock("Summary"')),
    ):
        if not any(x in html for x in needles):
            FAIL.append(f'{p["name"]}: the panel does not render {field}')
    if "r.expired" not in html:
        FAIL.append(f'{p["name"]}: the panel ignores the computed expired flag')
    if "Session notes (AI draft)" not in html:
        FAIL.append(f'{p["name"]}: no "Session notes (AI draft)" heading')
    # READ-ONLY: the draft must never be written back into a member-readable column.
    # The ONE legal playbook_url write is the sessions-manager save handler's patch object,
    # which reads `playbook_url: pb` where pb is the coordinator's own input value.
    for w in re.findall(r"playbook_url\s*:\s*([^,;\n}]+)", html):
        if w.strip() != "pb":
            FAIL.append(f'{p["name"]}: an unexpected playbook_url write -> {w.strip()[:60]}')

if FAIL:
    print("\n".join("FAIL  " + f for f in FAIL)); sys.exit(1)
print(f"PASS  the session notes panel is present and read-only ({len(PAGES)} pages checked)")
```

```bash
chmod +x /Users/nelsontaylor/taylormade-academy/scripts/check-rtk-notes.py
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && python3 scripts/check-rtk-notes.py; echo "exit=$?"`
Expected: `exit=1` with eight `FAIL  opil/hub/admin: …` lines and eight `FAIL  live: …` lines — neither page calls the RPC, passes `p_room`, renders any of the four fields, honours `expired`, or carries the heading. All eight are reachable on **both** pages because the needles are the panel's own symbols (`n.recordings`, `notesBlock('Summary'`), not the bare words: `opil/hub/admin/index.html` already contains "recordings" in prose at `:69` and two `<summary>` tags, so bare-word checks would have passed vacuously there and only six of the eight could ever have failed. Neither page reports an unexpected `playbook_url` write: `opil/hub/admin`'s only match is `playbook_url: pb` at `:427`, and `live/index.html` has none.

- [ ] **Step 3: Add the panel markup to the OPIL sessions manager**

Edit `/Users/nelsontaylor/taylormade-academy/opil/hub/admin/index.html`. In `sessRow(s)`, the Playbook input is line **306** — anchor on the unique string `data-f="playbook" data-s="${s.no}"`, NOT on a line number, and never on `:305`, which is the **Recording** input. The line begins:

```html
      <input data-f="playbook" data-s="${s.no}" value="${esc(s.playbook_url||'')}" placeholder="Playbook link — the written guide for this session (Google Doc, PDF, Notion, a page on the Academy)" style="font:inherit;font-size:13.5px;padding:9px 13px;border:1.5px solid var(--hair);border-radius:10px">
```

with:

```html
      <input data-f="playbook" data-s="${s.no}" value="${esc(s.playbook_url||'')}" placeholder="Playbook link — the written guide for this session (Google Doc, PDF, Notion, a page on the Academy)" style="font:inherit;font-size:13.5px;padding:9px 13px;border:1.5px solid var(--hair);border-radius:10px">
      <details class="rtkNotes" data-s="${s.no}" style="border:1.5px dashed var(--hair);border-radius:10px;padding:9px 13px">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink-2)"><b style="color:var(--ink)">Session notes (AI draft)</b><span class="mono" style="font-size:10.5px;letter-spacing:.08em;color:var(--muted)">READ ONLY</span></summary>
        <div class="rtkNotesBody" data-s="${s.no}" style="padding-top:10px"><span style="color:var(--muted)">Opening&hellip;</span></div>
      </details>
```

- [ ] **Step 4: Add the notes loader above the sessions manager**

In the same file, line 320 reads `const mgr = document.getElementById('sessMgr');` (the only line in the file that does). Insert **immediately before** it:

```js
/* ---- Session notes (AI draft): read-only ----------------------------------------------
   ea_rtk_session_notes is SECURITY DEFINER and returns null unless the caller is an OPIL
   coordinator or a facilitator of that session, so this panel needs no gate of its own —
   a facilitator who opens someone else's row simply sees "no draft".
   NOTHING here writes: the draft text lives only in ea_rtk_artifacts, and
   ea_opil_sessions.playbook_url is student-readable and holds the PUBLISHED link, never a
   draft. Publishing stays two manual steps (§17 item 9 is still open; the v1 default is
   "nothing publishes a draft"). Spec §8 "Where it surfaces", §16 v1. */
const notesCache = {};
function notesPre(t) {
  return '<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font:inherit;font-size:13px;line-height:1.55;'
    + 'color:var(--ink-2);background:#faf9f6;border:1px solid var(--hair-soft);border-radius:10px;padding:10px 12px;'
    + 'max-height:320px;overflow:auto">' + esc(t) + '</pre>';
}
function notesBlock(label, inner) {
  return '<div style="margin-bottom:12px"><div class="mono" style="font-size:10.5px;letter-spacing:.08em;'
    + 'text-transform:uppercase;color:var(--muted);margin-bottom:4px">' + esc(label) + '</div>' + inner + '</div>';
}
const notesPending = '<span style="color:var(--muted)">pending</span>';
function notesHTML(n) {
  if (!n) return '<span style="color:var(--muted)">No draft yet. It lands a few minutes after the class ends.</span>';
  const recs = Array.isArray(n.recordings) ? n.recordings : [];
  const recHTML = recs.length
    ? recs.map(function (r) {
        /* `expired` is computed inside the RPC (expires_at < now()); never re-derive it here */
        const link = (r.url && r.expired !== true)
          ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener" style="color:var(--blue);font-weight:600">open replay</a>'
          : '<span style="color:var(--muted)">' + (r.expired === true ? 'link expired' : 'no link yet') + '</span>';
        return '<div style="font-size:13px;color:var(--ink-2);padding:3px 0">' + esc(r.status || 'recording') + ' &middot; ' + link + '</div>';
      }).join('')
    : '<span style="color:var(--muted)">No recording yet.</span>';
  return notesBlock('Playbook draft · ' + (n.playbook_status || 'none'), n.playbook ? notesPre(n.playbook) : notesPending)
    + notesBlock('Summary', n.summary ? notesPre(n.summary) : notesPending)
    + notesBlock('Transcript', n.transcript ? notesPre(n.transcript) : notesPending)
    + notesBlock('Recordings', recHTML)
    + '<p style="margin:6px 0 0;font-size:12px;color:var(--muted)">Read-only. To publish: copy the draft to the playbook page, '
    + 'then paste that page&rsquo;s link into the Playbook URL field above and Save session.</p>';
}
async function loadNotes(no, box) {
  if (notesCache[no] !== undefined) { box.innerHTML = notesHTML(notesCache[no]); return; }
  box.innerHTML = '<span style="color:var(--muted)">Loading&hellip;</span>';
  const { data, error } = await sb.rpc('ea_rtk_session_notes', { p_room: 'opil', p_ref: String(no) });
  if (error) { box.innerHTML = '<span style="color:#b4451f">Could not load: ' + esc(error.message) + '</span>'; return; }
  notesCache[no] = data || null;
  box.innerHTML = notesHTML(notesCache[no]);
}
function wireNotes() {
  /* `toggle` does not bubble, so this cannot be delegated off #sessMgr. renderMgr() rebuilds
     every <details>, so it re-runs after each render and each element gets exactly one listener. */
  document.querySelectorAll('#sessMgr details.rtkNotes').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      loadNotes(Number(d.dataset.s), d.querySelector('.rtkNotesBody'));
    });
  });
}
```

- [ ] **Step 5: Call `wireNotes()` at the end of every render**

In the same file, line 337 is the last statement of `renderMgr()`. Replace:

```js
  if (!facOnly) renderFacSess();
}
```

with:

```js
  if (!facOnly) renderFacSess();
  wireNotes();   /* the <details> elements were just recreated; re-attach their toggle listeners */
}
```

- [ ] **Step 6: Node-parse the page's module and run the structural check — the OPIL half must pass**

```bash
cd /Users/nelsontaylor/taylormade-academy
python3 -c "
import pathlib, re
html = pathlib.Path('opil/hub/admin/index.html').read_text()
body = re.findall(r'<script type=\"module\">(.*?)</script>', html, re.S)[-1]
pathlib.Path('/tmp/opil-admin-module.mjs').write_text(body)
print('extracted', len(body), 'chars')
"
node --check /tmp/opil-admin-module.mjs && echo "opil admin module parses"
python3 scripts/check-rtk-notes.py; echo "exit=$?"
```
Expected: `extracted <n> chars`, `opil admin module parses`, then only the eight `FAIL  live: …` lines and `exit=1` — every `opil/hub/admin:` line is gone.

- [ ] **Step 7: Add the Academy card markup**

Edit `/Users/nelsontaylor/taylormade-academy/live/index.html`. Line 333 closes the admin bar. Replace:

```js
    panelHTML("bcPanel") +
    '</div>';
```

with:

```js
    panelHTML("bcPanel") +
    '</div>' +
    (show ? '<div class="adminbar" id="aNotesBar"><div class="ah"><b>Session notes (AI draft)</b><span>READ ONLY</span></div><div id="aNotes"><span style="color:var(--muted)">Loading&hellip;</span></div></div>' : '');
```

- [ ] **Step 8: Add the Academy loader**

In the same file, anchor on the unique line `  $("aDemo").addEventListener("click", () => { $("aUrl").value = DEMO_URL; });` (line 343 before any of this plan's edits) and insert **immediately after whatever block already follows it** — Task 8 Step 5 inserts here first, so when Task 10 runs, append below Task 8's block rather than between it and the anchor. Insert:

```js
  /* ---- Session notes (AI draft): read-only ---------------------------------------------
     ea_rtk_session_notes is SECURITY DEFINER and returns null for anyone who is not an
     Academy admin, so this card needs no gate of its own beyond the isAdmin block it sits
     in. NOTHING here writes: the draft text lives only in ea_rtk_artifacts and is never
     copied into ea_live, which every member reads whole. §17 item 9 is open; the v1 default
     is that nothing publishes a draft. Spec §8 "Where it surfaces", §16 v1. */
  const notesPre = (t) =>
    '<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font:inherit;font-size:13px;line-height:1.55;'
    + 'color:var(--ink-2);background:#fffdf5;border:1px solid #f4e2ac;border-radius:10px;padding:10px 12px;'
    + 'max-height:320px;overflow:auto">' + esc(t) + '</pre>';
  const notesBlock = (label, inner) =>
    '<div style="margin-bottom:12px"><div style="font-size:10.5px;font-weight:700;letter-spacing:.08em;'
    + 'text-transform:uppercase;color:#8a6d00;margin-bottom:4px">' + esc(label) + '</div>' + inner + '</div>';
  const notesPending = '<span style="color:var(--muted)">pending</span>';
  function notesHTML(n) {
    if (!n) return '<span style="color:var(--muted)">No draft yet. It lands a few minutes after the class ends.</span>';
    const recs = Array.isArray(n.recordings) ? n.recordings : [];
    const recHTML = recs.length
      ? recs.map((r) => {
          /* `expired` is computed inside the RPC (expires_at < now()); never re-derive it here */
          const link = (r.url && r.expired !== true)
            ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener" style="font-weight:600">open replay</a>'
            : '<span style="color:var(--muted)">' + (r.expired === true ? "link expired" : "no link yet") + "</span>";
          return '<div style="font-size:13px;padding:3px 0">' + esc(r.status || "recording") + " &middot; " + link + "</div>";
        }).join("")
      : '<span style="color:var(--muted)">No recording yet.</span>';
    return notesBlock("Playbook draft · " + (n.playbook_status || "none"), n.playbook ? notesPre(n.playbook) : notesPending)
      + notesBlock("Summary", n.summary ? notesPre(n.summary) : notesPending)
      + notesBlock("Transcript", n.transcript ? notesPre(n.transcript) : notesPending)
      + notesBlock("Recordings", recHTML)
      + '<p class="adminnote" style="margin:6px 0 0">Read-only. To publish, copy the draft wherever the class notes live; nothing here is written back to the class row.</p>';
  }
  async function loadNotes(id) {
    const box = $("aNotes");
    if (!box) return;
    const { data, error } = await sb.rpc("ea_rtk_session_notes", { p_room: "academy", p_ref: String(id) });
    if (error) { box.innerHTML = '<span style="color:#b4451f">Could not load: ' + esc(error.message) + "</span>"; return; }
    box.innerHTML = notesHTML(data || null);
  }
  if (show && show.id) loadNotes(show.id);
```

- [ ] **Step 9: Run both structural checks — everything must pass**

```bash
cd /Users/nelsontaylor/taylormade-academy
python3 -c "
import pathlib, re
html = pathlib.Path('live/index.html').read_text()
mods = re.findall(r'<script type=\"module\">(.*?)</script>', html, re.S)
pathlib.Path('/tmp/live-module.mjs').write_text(mods[-1])
print('extracted', len(mods[-1]), 'chars from', len(mods), 'module script(s)')
"
node --check /tmp/live-module.mjs && echo "live module parses"
python3 scripts/check-rtk-notes.py; echo "exit=$?"
python3 scripts/check-rtk-pages.py; echo "exit=$?"
```
Expected: `live module parses`, then `PASS  the session notes panel is present and read-only (2 pages checked)` with `exit=0`, then `PASS  both live pages carry room mode (2 pages checked)` with `exit=0` — Task 7's checker must still pass, because this task touched the same file.

- [ ] **Step 10: Prove both pages still boot signed-out with zero errors**

```bash
cd /Users/nelsontaylor/taylormade-academy && (python3 -m http.server 8769 >/dev/null 2>&1 &)
node - <<'JS'
import { createRequire } from 'node:module';
const require = createRequire('/Users/nelsontaylor/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch();
let bad = 0;
for (const path of ['/opil/hub/admin/', '/live/']) {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8769' + path, { waitUntil: 'networkidle' });
  console.log(path, '->', p.url(), errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  if (errs.length) bad++;
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
JS
pkill -f "http.server 8769"
```
Expected: `/opil/hub/admin/ -> http://127.0.0.1:8769/login/?next=/opil/hub/admin/ no page errors` and `/live/ -> http://127.0.0.1:8769/live/ no page errors` — both new blocks parse and run.

- [ ] **Step 11: Live check against the real RPC**

Use the OPIL session you rehearsed on in Task 9 Step 8:

```bash
export REHEARSAL_NO=<the OPIL session number from Task 9 Step 8>
echo '--- coordinator sees the draft'
curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $TMA_ADMIN_JWT" -H "Content-Type: application/json" \
  -X POST "$SB_REST/rpc/ea_rtk_session_notes" -d "{\"p_room\":\"opil\",\"p_ref\":\"$REHEARSAL_NO\"}" \
  | jq '{playbook_status, has_playbook: (.playbook != null), has_summary: (.summary != null), has_transcript: (.transcript != null), recordings: (.recordings | length), expired_flags: [.recordings[]?.expired]}'
echo '--- a student sees nothing'
curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $TMA_MEMBER_JWT" -H "Content-Type: application/json" \
  -X POST "$SB_REST/rpc/ea_rtk_session_notes" -d "{\"p_room\":\"opil\",\"p_ref\":\"$REHEARSAL_NO\"}"
echo
echo '--- and the draft never reached the student-readable column'
curl -sS -H "apikey: $SB_ANON" -H "Authorization: Bearer $TMA_MEMBER_JWT" \
  "$SB_REST/ea_opil_sessions?no=eq.$REHEARSAL_NO&select=no,playbook_url"
```
Expected: an object with `"playbook_status":"draft"`, `has_summary: true` and `expired_flags: [false]` for the coordinator; a bare `null` for the student; and `playbook_url` still exactly whatever it was before the rehearsal (`null` on a session that has never published one) — never the draft markdown.

Then, in the browser as the coordinator: open `/opil/hub/admin/`, expand that session, click **Session notes (AI draft)** → the draft, summary, transcript and the replay link render, and the panel has no editable field and no Save button. Open `/live/` as the admin → the same card sits under the broadcast control.

- [ ] **Step 12: Restamp, verify on the bare URLs, and commit**

Both files are in `HUB_PAGES` (`build_site.py:232-235`), so the build re-stamps their asset pins. No new asset was added, so `_asset_ver` and `sw.js` are untouched by this task (Task 9 already bumped `VERSION` to `tma-v10-rtk-rooms`, and page HTML is network-first in `sw.js` anyway).

```bash
cd /Users/nelsontaylor/taylormade-academy
python3 build_site.py
python3 scripts/check-rtk-notes.py && python3 scripts/check-rtk-pages.py
git add opil/hub/admin/index.html live/index.html scripts/check-rtk-notes.py
git commit -m "feat(live): read-only Session notes (AI draft) panel for coordinators and admins"
git push
curl -sS https://taylormadeacademy.com/opil/hub/admin/ | grep -c "ea_rtk_session_notes"
curl -sS https://taylormadeacademy.com/live/ | grep -c "ea_rtk_session_notes"
```
Expected: both checkers `PASS`, a successful push, then `1` and `1` from the two bare-URL greps (no `?cb=` — `sw.js`'s runtime cache would serve a stale copy of a cache-busted URL).

## Self-review notes

**Spec coverage.** §2–§7, §9, §10, §12 map onto T1–T9; §8's "Where it surfaces" and §16's read-only notes panel are T10. §11 (setup runbook) is split across the tasks that need each piece: the app and the five presets already exist (committed `scripts/rtk-presets.sh` + `scripts/rtk-presets/*.json`, run against the live app 2026-09-11); `CF_RTK_APP_ID` / `CF_RTK_API_TOKEN` are set in T3 Step 7, `CF_RTK_WEBHOOK_ID` and the webhook registration in T5 Step 8, the deploy/build/push in T9, the billing alert in T9 Step 10. §13 (cost) needs no code. §15/§15.1 spikes are closed; §16's v2 list is out of scope by design. §17 defaults are listed in Global Constraints.

**Not covered by any task** (carried into the handoff, not silently dropped):
1. **§14.2: a committed `dev/rtk-harness/index.html`.** The harness lives in the scratchpad instead (T6), because §15.1 closed spike 19 negative and there is no staging stack for it to point at.
2. **§14.3: a committed `tests/rtk-room.spec.ts` against two seeded users on a staging stack.** T6's two-context Playwright run uses the real Cloudflare app with a local token mint; it cannot sign in as `host@test.local` / `student@test.local` because those users and that project do not exist (§17 item 10 is unanswered).
3. **§11.3: `supabase/config.toml`, `supabase/seed.sql`, `supabase/.env.staging`.** Deliberately not created — spike 19 proved the local stack cannot run on this Mac.

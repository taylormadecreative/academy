# RealtimeKit live rooms — design

Date: 2026-09-10. Status: approved decisions (Nelson, 2026-09-10) turned into a build spec.
Sources: `rtk-decisions.md` (approved; wins every conflict), `rtk-brief.json` (research; corrected where the two skeptic reviews refuted it), the two skeptic verdicts (13 codebase-fit issues, 17 doc-fidelity issues; every one is resolved or listed in §15), and the repo files cited inline.

Conventions in this document:
- A doc link after a call, field or path means the brief cited it and the skeptics confirmed it (they fetched all 60 cited pages, HTTP 200, plus live jsdelivr HEADs).
- "(unverified — spike N)" means neither source pins it; §15 has the probe.
- Repo paths are relative to `/Users/nelsontaylor/taylormade-academy/`.

---

## 1. Goal & non-goals

**Goal.** Give both live pages — Academy `/live/` and OPIL `/opil/hub/live/` — a two-way room (camera, mic, screen share, mute-all, breakouts, polls, chat, raise-hand, server-side recording, transcript + AI summary) on the existing GitHub Pages + Supabase stack, with no bundler, no Cloudflare secret in any page, and the premium gate exactly where it is today (RLS on the room rows + a server-side role check).

**Non-goals (v1).**
- Replacing the Cloudflare Stream broadcast path. OBS→RTMPS, the phone WHIP camera button, the paste-URL box and the `/assets/live-demo` loop stay as **broadcast mode** on the same pages.
- Overflow of a RealtimeKit meeting into the existing Stream live input (`rtmp_out_config`) — phase 2, behind a switch, after spike 3.
- Live captions for students/members (cost; §13). Hosts only.
- Anything that auto-publishes AI text to students. The summary becomes a **draft** a coordinator/admin reads through an admin-only RPC; nothing lands on a member-readable row.
- Our own R2 bucket for recordings. RealtimeKit's bucket + a Stream copy-by-URL is the replay path (§7).
- A custom `rtk-ui-provider` layout. v1 uses the stock `<rtk-meeting>`.

---

## 2. Decisions (approved 2026-09-10, restated precisely)

### 2.1 Shape
- Two room kinds, one engine.
  - **OPIL Thread = CLASS.** One RealtimeKit meeting per `ea_opil_sessions` row with `kind = 'thread'`. Everyone on camera, mute-all, breakout rooms, screen share.
  - **Academy `/live/` = WEBINAR.** One meeting per `ea_live` row. Nelson on stage; members watch, chat, vote in polls, raise a hand (stage request) and can be brought up on stage.
  - Judges sit in OPIL meetings on a no-media preset. Mixed presets in one meeting is a documented pattern ([concepts](https://developers.cloudflare.com/realtime/realtimekit/concepts/): "Participants in the same meeting can use different presets to create flexible roles" — the brief's claim that this was undocumented was refuted; the *rendering* of a no-media tile is still spike 4).
- Today's Stream path stays as **broadcast mode** on both pages. **Room mode** is RealtimeKit. The host picks; students never see the difference.

### 2.2 Who gets what (five presets, decided server-side from existing RPCs)
- Academy: `ea_is_admin()` → `tma-webinar-host`; else `ea_is_member()` → `tma-webinar-member` (audio, video, screenshare `can_produce` and `stage_access` all `CAN_REQUEST`, per Cloudflare's webinar recipe — [webinar](https://developers.cloudflare.com/realtime/realtimekit/webinar/)); else **403** → the page's existing upsell state.
- OPIL: `ea_opil_my_role()` returns jsonb `{admin: bool, judge: bool, facilitator_sessions: int[]}` (`supabase/migrations/0018_opil_premium_layer.sql:28-33`). `admin || facilitator_sessions.includes(session_no)` → `opil-host` (with breakout management); `judge` → `opil-judge` (view + chat, no media); `ea_opil_in_cohort()` (membership in `ea_opil_team_members`, `0015_opil_hub_hardening.sql:9-11` — **not** `ea_opil_registrations.approved`) → `opil-student`; else **403**. There is no 'coordinator', 'facilitator' or 'student' string anywhere; the brief's role table was wrong and is replaced by §4.
- No Cloudflare secret in any page. `ea-rtk-join` hands out a per-person participant token. Same auth pattern as `ea-live-publish` (`supabase/functions/ea-live-publish/index.ts:5-11, 55-77`): `verify_jwt` OFF, Bearer user token → service-role `auth.getUser` → role RPCs **as the caller** through an anon client carrying the caller's bearer; CORS locked to `https://taylormadeacademy.com`. The brief's "verify_jwt ON" is dropped: every function in this project runs OFF (`supabase/functions/README.md`: "JWT verification is turned OFF for all of them"; there is no `config.toml`, the flag is set at deploy with `--no-verify-jwt`).

### 2.3 Recording, replay, captions
- Host taps Start → recording started **server-side with the Start Recording API** (`POST /recordings`). Explicit; **not** `record_on_start`, which requires a storage config in the Developer Portal and whose docs contradict themselves. `realtimekit_bucket_config.enabled: true` (RealtimeKit's own bucket, 7-day presigned `downloadUrl`). **No R2.**
- Webhook `recording.statusUpdate` with `status = UPLOADED` → Cloudflare Stream `POST /accounts/{CF_ACCOUNT_ID}/stream/copy {url: downloadUrl, meta: {name}}` with the **existing** Stream:Edit token (`CF_API_TOKEN`, `CF_ACCOUNT_ID`, both already function secrets — `ea-live-publish/index.ts:84`) → Stream video `uid` → watch URL `https://customer-nimm2h959enrq4x1.cloudflarestream.com/<uid>/watch` (built from the existing `CF_STREAM_SUBDOMAIN` secret exactly as `ea-live-publish` does at `:104`) → written to `ea_live.replay_url` / `ea_opil_sessions.recording_url`, the fields today's `saved` callbacks write (`live/index.html`, `opil/hub/live/index.html:352`).
- End for everyone = **explicit `PUT /recordings/{id} {action: "stop"}` AND kick-all**. Kick-all is not documented to stop a recording (skeptic: zero mentions of "recording" on either the REST kick-all page or the SDK `kickAll` page; the only documented auto-stop is 60 s with nobody in the room).
- Transcript + AI summary after each meeting (`transcribe_on_end`, `summarize_on_end`, `summary_type: lecture`; Whisper, pennies). Summary → a DRAFT "playbook" the coordinator/admin sees via a service-role table + admin-only RPC. **Never** on `ea_opil_sessions` / `ea_live` rows: `sess_read` admits every cohort member, judge and facilitator to the whole row (`0018:124-127`), `ea_live_member_read` admits every member (`0023`, `0027`), and both pages `select('*')` (`opil/hub/live/index.html:83, :271`; `live/index.html` member branch).
- Live captions default to hosts only (Nova-3 ≈ $0.0092/min per captioned participant ≈ $0.55/h per person; 27 students would triple the session cost).

### 2.4 Data and plumbing
- Migration `0029`: `rtk_meeting_id text` **and** `mode text not null default 'stream' check (mode in ('stream','meeting'))` on `ea_live` and `ea_opil_sessions` (both approved, rtk-decisions §4; `mode` is the page's branch key because the meeting id persists across days), plus `rtk_session_id text` and `rtk_started_at timestamptz` (the restart-race pins, §5.3 / §6.3) — all four server-written and locked from client updates. `sess_fac_update` lets a facilitator UPDATE **any column** of their own sessions (`0018:111-114`), and the Academy admin write policy is `for all`, so the lock is a **trigger** on `before insert or update` guarding both columns (§9 explains why a column-level REVOKE alone is a no-op here; the INSERT case matters because `ea_live_admin_write` is `for all` and OPIL admins insert sessions client-side). Service role is the only writer.
- Three service-role-only tables: `ea_rtk_participants`, `ea_rtk_events` (id = `rtk-uuid` header, `streamKey` redacted), `ea_rtk_artifacts` (recording | transcript | summary | playbook). Admin/coordinator RPC `ea_rtk_session_notes(room, ref)`.
- Three edge functions, all `verify_jwt` OFF with their own auth: `ea-rtk-join`, `ea-rtk-host`, `ea-rtk-webhook` (§5, §6). `ea-rtk-host` flips `is_live` (and `mode`) and, when going live, first clears `is_live` (and resets `mode`) on OTHER rows so the partial unique indexes `ea_live_one_live` / `ea_opil_sessions_one_live` (`0023:54-57`) never trip; `end_session` and the webhook only ever write `{is_live: false, mode: 'stream'}` — the reset matters because the broadcast handlers never touch `mode` (§3.1). Inline work in the webhook; `EdgeRuntime.waitUntil` only after a staging check (nothing in this repo uses it yet).
- One-time Cloudflare setup in Chrome: app created in the dashboard (so default presets exist), a scoped Realtime Admin API token → secrets `CF_RTK_API_TOKEN` + `CF_RTK_APP_ID`, the five presets, the webhook (probe `GET /webhooks` — [API index](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/webhooks/methods/get_webhooks/) — vs `GET /webhooks/all` — the [webhooks guide's](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#register-a-webhook) curl — the two docs disagree).

### 2.5 The room on the page
- The centre of both pages becomes the RealtimeKit meeting in Academy colours/type (navy `#04123a`/`#0a1733`, gold `#fdc921`, type via design tokens), filling the space in its own `#rtk-root` layout — not the 16:9 `.player` box. On OPIL phones the bottom `.ln-dock` hides while in a meeting (body class), because `nav()` appends a fixed dock (`opil/hub/hub.js:128-136`, `hub.css:51-61`).
  Type: the decision names "Space Grotesk/Inter via design tokens"; the design-token `font_family` (preset schema, §4.1) and `provideRtkDesignSystem`'s `fontFamily` ([design-system page](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/branding/design-system/)) are a **single** family string, not a pair. The spec puts **Inter** in the token (body type; every control and chat line inside the room) and leaves Space Grotesk on the page chrome around `#rtk-root` (the page's own headings and the host bar). §17 item 8 asks Nelson to nod to that split or to put Space Grotesk in the token instead.
- Load from CDN (jsdelivr, the host hls.js already loads from at `live/index.html` and `opil/hub/live/index.html:168`). **Core loads as the IIFE** `<script src="https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js">`, which exposes `window.RealtimeKitClient` (spike 1, 2026-09-10). The `/+esm` route is dead in practice: jsdelivr's ESM conversion of the dependency `sdp-transform@2.15.0` returns 404 and the whole import graph aborts (verified in Playwright, spike 1); the plain `dist/index.es.js` has bare specifiers — `bowser`, `sdp-transform`, `worker-timers`, `uuid`, `@protobuf-ts/runtime` — and dies in a browser. UI kit stays ESM: the loader `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js` → `defineCustomElements()`, and `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js` (`dist/index.es.js` is a 404), which exports `provideRtkDesignSystem`, `BreakoutRoomsManager`, `RtkUiBuilder`, `defaultConfig`, `defaultIconPack`, `extendConfig`, `registerAddons` (spike 1). `RealtimeKitClient.init({authToken, defaults, onError})` ([core](https://developers.cloudflare.com/realtime/realtimekit/core/)) then `<rtk-meeting>` with the `meeting` prop — never `meeting.join()` (§10.3). Pin exact versions. `js/rtk-room.js` is a lazy `import()` (room mode only); `css/rtk-room.css` is a small always-loaded `<link rel="stylesheet" href="/css/rtk-room.css">` in both pages, stamped like `broadcast.css` (§10.1). Add both to `build_site.py` `_asset_ver` + `_ASSET_RX` and bump `sw.js` `VERSION`.
- Chat inside the meeting while a meeting runs; `ea_live_chat` / `ea_opil_live_chat` stay for broadcast mode.
- Host controls in room mode call `ea-rtk-host` and update the DOM in place — **no `location.reload()`** (the existing Go live / End handlers reload: `opil/hub/live/index.html:322`, `live/index.html` `aGo` handler). Hand-raise queue is built from the stage events `stageAccessRequestUpdate` / `newStageRequest`, not a getter (`meeting.stage.getAccessRequests()` is not documented).
- Broadcast control keeps its paste-URL / demo / WHIP camera paths under "Broadcast (one-way)". Room mode is **one** host button next to Go live in each page's host control card — **Start class** (OPIL Broadcast control card) / **Start webinar** (Academy admin card). It calls `ea-rtk-join`, mounts the room, and on the first `rtkStatesUpdate` with `meeting === 'joined'` calls `ea-rtk-host {action:'start', record:true}`, which sets `mode='meeting'`, clears the other live rows, flips `is_live` and starts the recording (§3.1, §10.3). No separate "Open room" step. Broadcast Go live / End stay byte-for-byte as they are.

### 2.6 Cost and spikes
- Verified rates (2026-09-10, [pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/#audio-model-pricing)): A/V participant $0.002/min; audio-only $0.0005/min; export (recording or RTMP/HLS out) $0.010/min; raw RTP to R2 $0.0005/min; Nova-3 captions $0.0092/min per captioned participant; Whisper $0.0005/min (10k Neurons/day included). Worked examples in §13.
- Spikes before build: kit loads from jsdelivr with a real token in a harness against a staging app; token lifetime; `rtmp_out_config` (phase 2); judge no-media rendering; meeting size cap. Full list §15.

---

## 3. Architecture

### 3.1 Rooms and modes
A **room** is a row: `ea_live.id` (Academy) or `ea_opil_sessions.no` with `kind='thread'` (OPIL). Each row has `mode` (`'stream'` | `'meeting'`, default `'stream'`) and `is_live`. The page decides what to mount from the row it already reads:

| `is_live` | `mode` | Members/students see | Hosts see |
|---|---|---|---|
| false | any | idle card (unchanged) | broadcast control (unchanged) + **Start class / Start webinar** (host-only; calls `ea-rtk-join`, mounts `<rtk-meeting>`, and on the first `joined` calls `ea-rtk-host start`). On OPIL the button sits in the Broadcast control card next to Go live and takes its session from the `#bcSess` selection (`cur().no`, `opil/hub/live/index.html:271-296`) — `liveSess` (`:83`, `eq('is_live', true)`) is null exactly when the button must appear. On Academy, when `show` is null (`live/index.html:195-208`) the page first inserts the `ea_live` row `{title, is_live:false}` through the same admin write `setLive` uses (`:338-340`), then the same button continues with the new id (§10.3); on `access = 'public'` rows the button is disabled with a note (§5.2). |
| true | `stream` | today's player (`stream_url`) + today's chat | today's broadcast controls (unchanged, still reload) |
| true | `meeting` | `#rtk-root` with `<rtk-meeting>`; page chat hidden | the same room + a host bar wired to `ea-rtk-host`; no reload |

One host button, in the control card the host already uses (OPIL: the Broadcast control card, acting on `cur()`; Academy: the admin card, acting on `show`), doing three things in order:
1. **Join.** The page calls `ea-rtk-join` and mounts `<rtk-meeting>` with the setup screen (`showSetupScreen = true`) and no `is_live` gate; the host presses Join on that screen (our code never calls `meeting.join()`, §10.3) and the first `rtkStatesUpdate` with `meeting === 'joined'` triggers `start` (step 2; §10.3, §11.7). The host joins the meeting (§5.2 lets hosts join any time) so a session exists for the recording to attach to. `is_live` is untouched; students still see the idle card. The only client write on this path is the Academy row insert when `show` is null (`{title, is_live:false}`, no `rtk_meeting_id`/`mode`, so the §9 trigger passes); OPIL sessions always exist before a class (the coordinator creates them).
2. **Start.** On the first `rtkStatesUpdate` with `meeting === 'joined'` the page calls `ea-rtk-host {action:'start', record:true}`, which sets `mode = 'meeting'`, clears `is_live` on the other rows, flips `is_live = true` and starts the recording (§5.3). From then on every page that reads the row takes the `true | meeting` branch.
3. **Host bar.** The bar renders from the `start` response (LIVE chip, REC toggle, headcount, End; REC is a toggle — `start` records by default, pressing it while recording calls `stop_recording`, while stopped `start_recording`, and `status` refreshes it — §10.6). If `start` fails the host stays in the room and the bar shows the error with a Retry that repeats only the `start` call (§10.6).

**`mode` is reset by the server, never by the pages — in exactly two places in `ea-rtk-host`:** the one-live clear in `start` step 2 (`update … set is_live = false, mode = 'stream' where is_live and <key> <> $1` — the OTHER rows) and `end_session` (`is_live = false, mode = 'stream'` on its own row) (§5.3, §9). The `meeting.ended` webhook is only the backstop for a host who closed the tab instead of pressing End (§6.3; after a clean End the row already reads `mode = 'stream'`, so it matches nothing, and the `rtk_session_id` / `rtk_started_at` rule there keeps a delayed `meeting.ended` from touching a room the host restarted inside the 120 s session keep-alive — §5.3). The broadcast handlers write only `is_live` / `stream_url` / `title` — `flipLive` (`opil/hub/live/index.html:301-302`) and `setLive` (`live/index.html:336-340`, called at `:350`, `:364`, `:365`) never mention `mode` — so without the reset a room that had ended would leave `mode='meeting'` on the row, the next broadcast Go live would set `is_live=true`, and every student page would mount `<rtk-meeting>` instead of the HLS player. Broadcast code stays untouched; the reset lives in the two server paths only.

A RealtimeKit **Meeting** is a persistent room with no start/end time; a **Session** starts when the first participant joins and ends shortly after the last leaves; one active session per meeting; billing is per participant only during an active session ([concepts/meeting](https://developers.cloudflare.com/realtime/realtimekit/concepts/meeting/)). The meeting id lives on the row (`rtk_meeting_id`) and is reused across days; sessions come and go.

### 3.2 Control plane (Supabase Edge Functions, Deno)
- `ea-rtk-join` — the only place a member's browser touches; issues the participant token.
- `ea-rtk-host` — host-only actions: `start` / `end_session` / `start_recording` / `stop_recording` / `status`. `start` is **added** to carry the single Start class / Start webinar button (rtk-decisions, amendments after spike 1); `end_session`, `start_recording`, `stop_recording` and `status` are the decision's, unchanged.
- `ea-rtk-webhook` — RealtimeKit → us. Signature-verified, deduped, inline effects.
- `_shared/rtk.ts` — the Cloudflare REST helper (base URL, auth header, `createOrGetMeeting`, error mapping). All three functions import it: join and host for meetings/participants/recordings, the webhook for `GET /sessions/{sessionId}/transcript` (§6.3) with the same base URL and token.

### 3.3 Media plane
- Room media: RealtimeKit on Cloudflare's global WebRTC infrastructure, no region choice ([realtimekit](https://developers.cloudflare.com/realtime/realtimekit/)). Browser needs `*.realtime.cloudflare.com`, `stun.cloudflare.com` 3478/udp, `turn.cloudflare.com` 3478 udp/tcp + 5349/tcp ([network allowlist](https://developers.cloudflare.com/realtime/realtimekit/network-allowlist/)). Neither page sets a CSP, so nothing to add (confirmed).
- Recording: server-side composite, H.264 1280×720 + 384 kbps AAC MP4 ([configure-codecs](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/configure-codecs/)), stored in RealtimeKit's bucket for seven days ([recording guide](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/)), then copied into Stream by URL (§7).
- Broadcast mode: unchanged — Stream live input over RTMPS/WHIP, HLS or WHEP playback (`js/broadcast.js`).

### 3.4 Diagram

```
 browser (taylormadeacademy.com)                       Supabase (pgqdmnmessbbzyszjfvr)                 Cloudflare
 ─────────────────────────────────                     ────────────────────────────────                 ──────────
 /live/  or  /opil/hub/live/
   │ reads row (RLS as today)  ─────────────────────▶  ea_live / ea_opil_sessions
   │                                            (rtk_meeting_id, mode, rtk_session_id,
   │                                             rtk_started_at, is_live)
   │ POST ea-rtk-join {room, live_id | session_no} ─▶  ea-rtk-join ──getUser──▶ auth
   │                                                    ├─ role RPCs as caller
   │                                                    ├─ create-or-get meeting ───────────────────▶  POST /meetings
   │                                                    ├─ add / refresh participant ───────────────▶  POST /meetings/{m}/participants
   │ ◀── {token, meeting_id, preset} ───────────────    └─ ea_rtk_participants                          POST .../participants/{p}/token
   │
   │ RealtimeKitClient.init({authToken}) ────────── media (SFU/TURN) ──────────────────────────────▶  RealtimeKit
   │ <rtk-meeting .meeting>
   │
   │ (host) POST ea-rtk-host {action} ─────────────▶  ea-rtk-host ─ one-live clear + is_live/mode ─▶  POST /recordings
   │ ◀── JSON, DOM updated in place                                                                   PUT /recordings/{id} stop
   │                                                                                                  POST .../active-session/kick-all
   │
   │                                                  ea-rtk-webhook ◀── rtk-signature / rtk-uuid ──  webhooks: meeting.ended,
   │                                                    ├─ verify (RSA-SHA256, .well-known key)         recording.statusUpdate,
   │                                                    ├─ dedupe (ea_rtk_events)                        meeting.transcript / .summary
   │                                                    ├─ UPLOADED → Stream copy-by-URL ──────────▶  POST /accounts/{a}/stream/copy
   │                                                    │   → replay_url / recording_url               (Stream:Edit token, existing)
   │                                                    └─ transcript/summary → ea_rtk_artifacts
   │                                                        → playbook draft (admin RPC only)
   │ replay: existing iframe branch plays the Stream /watch URL (unchanged)
```

---

## 4. Roles → presets

All four RPCs already exist and run as the caller: `ea_is_admin()` (reads `public.profiles.role`, `0001:10-13`), `ea_is_member()` (`0001:61-64`, true for admins too), `ea_opil_my_role()` (`0018:28-33`), `ea_opil_in_cohort()` (`0015:9-11`). Evaluation order is host → judge → student; the first match wins.

| Site role (source) | Where checked | Preset | In the room |
|---|---|---|---|
| Academy admin — `ea_is_admin()` | `ea-rtk-join`, `ea-rtk-host` | `tma-webinar-host` | On stage; records; mute-all; pins; grants stage requests; ends for all; captions on their own mic |
| Academy member — `ea_is_member()` and not admin | `ea-rtk-join` | `tma-webinar-member` | Off stage; chat, polls, "raise hand" (stage request); publishes cam/mic only after a grant |
| Academy signed-in non-member | `ea-rtk-join` → 403 | — | Existing upsell state (`live/index.html` gatecard); no token, no meeting id |
| Academy signed-out | page | — | Existing signed-out state |
| OPIL coordinator — `role.admin === true` | `ea-rtk-join`, `ea-rtk-host` | `opil-host` | Full host: mute-all, kick, breakout rooms, record, approve screen-share requests, any `kind='thread'` session |
| OPIL facilitator of THIS session — `role.facilitator_sessions.includes(session_no)` (matched by email, `0018:25-27`) | `ea-rtk-join`, `ea-rtk-host` | `opil-host` | Same as coordinator inside their session |
| OPIL facilitator of ANOTHER session | `ea-rtk-join` | falls through: judge → student → 403 | Facilitators are not automatically in `ea_opil_team_members`, so most get 403 (open question §17) |
| OPIL judge — `role.judge === true` (email allowlist) | `ea-rtk-join` | `opil-judge` | Watch + text chat + vote; may hop into a breakout to observe; no media |
| OPIL student — `ea_opil_in_cohort()` | `ea-rtk-join` | `opil-student` | Cam/mic, request screen share, chat, polls, switch breakout rooms |
| OPIL registered-but-unseated / unknown | `ea-rtk-join` → 403 | — | Existing "pending approval" state (`ea_opil_my_registration_status()`, `0028`) |

Identity: `custom_participant_id` = Supabase `auth.users.id` (UUID). The PII prohibition is on [concepts/participant](https://developers.cloudflare.com/realtime/realtimekit/concepts/participant/) and the [FAQ](https://developers.cloudflare.com/realtime/realtimekit/faq/) — **not** the Add Participant API page, which literally offers "UUID, email address" as examples; we still never send an email. `name` = `ea_profiles.display_name` (`0003:26-29`; the brief's `profiles.display_name` does not exist) or `'Member'`; `picture` = `ea_profiles.avatar_url` when it is an https URL. One participant per (meeting, user); several tabs/devices become several peers of one participant, which is allowed ([FAQ](https://developers.cloudflare.com/realtime/realtimekit/faq/)).

`ea-rtk-join` validates the resolved preset against the fixed allowlist `['tma-webinar-host','tma-webinar-member','opil-host','opil-student','opil-judge']` before any Cloudflare call — dashboard-created default presets (`webinar_presenter`, `webinar_viewer`, …) live in the same app and a typo would silently hand a member a presenter preset. The defaults are permissive: `group_call_host` and `group_call_participant` both grant video/audio/screenshare `ALLOWED` plus chat and polls-create (spike 1, 2026-09-10); our five custom presets tighten that — members and students get no polls-create, judges get no media — which is the other reason the allowlist matters.

### 4.1 Preset definitions
Schema: [Create Preset](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/presets/methods/create/) — `config` (`view_type`, `media`, `max_screenshare_count`, `max_video_streams`), `permissions` (media `can_produce` ∈ `ALLOWED | NOT_ALLOWED | CAN_REQUEST`, chat, polls, plugins, connected_meetings, kick/pin/disable participant, `stage_enabled`, `stage_access`, `accept_stage_requests`, `can_accept_production_requests` (required), `waiting_room_type`, `can_record`, `can_livestream`, `transcription_enabled`, `hidden_participant`, `show_participant_list`), `ui.design_tokens` (theme, colors brand 300–700 / background 600–1000, `font_family`, `border_radius`, `border_width`, `spacing_base`, logo). Presets are app-level and applied to participants, not meetings ([concepts/preset](https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/)). Stage moderation needs `permissions.can_accept_production_requests: true` per the [webinar page](https://developers.cloudflare.com/realtime/realtimekit/webinar/); the schema also has `accept_stage_requests` — hosts set **both** true (the brief's citation of `accept_stage_requests` to the stage-management page was wrong; the hedge stands).

The five bodies below are **literal `POST /presets` bodies** — `scripts/rtk-presets.sh` (committed, together with the five `scripts/rtk-presets/<name>.json` files; §11.4) sends each one as written, no merge step. `config` (everything but `view_type`) and `ui` are identical in all five; nested key spelling below `permissions.media.*` is quoted from the webinar page; the other nested names are the brief's reading of the schema page and were not individually re-verified — a `400` from `POST /presets` is the check. `ui.design_tokens.logo` points at `/assets/logo-nav.webp`, the file `live/index.html`'s `brandChrome` already uses (`:215`); `assets/` has no SVG logo (logo-mark/nav/full .png/.webp, logo-email.png, logo-source.png). Whether `design_tokens.logo` renders in `rtk-logo` is spike 1(f); the `logo-url` attribute is the documented fallback ([rtk-logo](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-logo/)).

Simulcast on: the [video-and-simulcast](https://developers.cloudflare.com/realtime/realtimekit/best-practices/video-and-simulcast/) page says "Turn on simulcast for multi-participant sessions" and "Turn off simulcast for 1:1 calls"; none of these rooms is a 1:1 call.

**1. `tma-webinar-host`** (Academy admin) — `can_livestream: false` like every v1 preset; it flips with spike 3 (§16 v2).
```json
{
  "name": "tma-webinar-host",
  "config": {
    "view_type": "WEBINAR",
    "max_video_streams": {
      "desktop": 9,
      "mobile": 4
    },
    "max_screenshare_count": 1,
    "media": {
      "video": {
        "frame_rate": 24,
        "quality": "hd",
        "simulcast": true
      },
      "screenshare": {
        "frame_rate": 5,
        "quality": "hd"
      }
    }
  },
  "permissions": {
    "media": {
      "audio": {
        "can_produce": "ALLOWED"
      },
      "video": {
        "can_produce": "ALLOWED"
      },
      "screenshare": {
        "can_produce": "ALLOWED"
      }
    },
    "stage_enabled": true,
    "stage_access": "ALLOWED",
    "accept_stage_requests": true,
    "can_accept_production_requests": true,
    "accept_waiting_requests": true,
    "kick_participant": true,
    "pin_participant": true,
    "can_spotlight": true,
    "disable_participant_audio": true,
    "disable_participant_video": true,
    "disable_participant_screensharing": true,
    "can_change_participant_permissions": true,
    "can_record": true,
    "can_livestream": false,
    "chat": {
      "public": {
        "can_send": true,
        "text": true,
        "files": true
      },
      "private": {
        "can_send": true,
        "can_receive": true,
        "text": true,
        "files": true
      }
    },
    "polls": {
      "can_create": true,
      "can_view": true,
      "can_vote": true
    },
    "plugins": {
      "can_start": true,
      "can_close": true,
      "can_edit_config": true
    },
    "connected_meetings": {
      "can_alter_connected_meetings": true,
      "can_switch_connected_meetings": true,
      "can_switch_to_parent_meeting": true
    },
    "show_participant_list": true,
    "can_edit_display_name": true,
    "hidden_participant": false,
    "waiting_room_type": "SKIP",
    "recorder_type": "NONE",
    "transcription_enabled": true
  },
  "ui": {
    "design_tokens": {
      "theme": "darkest",
      "font_family": "Inter",
      "border_radius": "rounded",
      "border_width": "thin",
      "colors": {
        "brand": {
          "300": "#fee38a",
          "400": "#fdd45a",
          "500": "#fdc921",
          "600": "#d9a90f",
          "700": "#b28a0a"
        },
        "background": {
          "600": "#22345f",
          "700": "#162650",
          "800": "#0f1d44",
          "900": "#0a1733",
          "1000": "#04123a"
        },
        "text": "#ffffff",
        "text_on_brand": "#04123a",
        "video_bg": "#0a1733",
        "danger": "#ff5c5c",
        "success": "#3ddc97",
        "warning": "#fdc921"
      },
      "logo": "https://taylormadeacademy.com/assets/logo-nav.webp"
    }
  }
}
```

**2. `tma-webinar-member`** — the raise-hand recipe: `stage_access` and all three `can_produce` set to the **same** value, `CAN_REQUEST` ([webinar](https://developers.cloudflare.com/realtime/realtimekit/webinar/)). The brief's `audio ALLOWED / video ALLOWED / screenshare NOT_ALLOWED` is dropped. Public chat with files (`chat.public.files: true`).
```json
{
  "name": "tma-webinar-member",
  "config": {
    "view_type": "WEBINAR",
    "max_video_streams": {
      "desktop": 9,
      "mobile": 4
    },
    "max_screenshare_count": 1,
    "media": {
      "video": {
        "frame_rate": 24,
        "quality": "hd",
        "simulcast": true
      },
      "screenshare": {
        "frame_rate": 5,
        "quality": "hd"
      }
    }
  },
  "permissions": {
    "media": {
      "audio": {
        "can_produce": "CAN_REQUEST"
      },
      "video": {
        "can_produce": "CAN_REQUEST"
      },
      "screenshare": {
        "can_produce": "CAN_REQUEST"
      }
    },
    "stage_enabled": true,
    "stage_access": "CAN_REQUEST",
    "accept_stage_requests": false,
    "can_accept_production_requests": false,
    "accept_waiting_requests": false,
    "kick_participant": false,
    "pin_participant": false,
    "can_spotlight": false,
    "disable_participant_audio": false,
    "disable_participant_video": false,
    "disable_participant_screensharing": false,
    "can_change_participant_permissions": false,
    "can_record": false,
    "can_livestream": false,
    "chat": {
      "public": {
        "can_send": true,
        "text": true,
        "files": true
      },
      "private": {
        "can_send": false,
        "can_receive": false,
        "text": false,
        "files": false
      }
    },
    "polls": {
      "can_create": false,
      "can_view": true,
      "can_vote": true
    },
    "plugins": {
      "can_start": false,
      "can_close": false,
      "can_edit_config": false
    },
    "connected_meetings": {
      "can_alter_connected_meetings": false,
      "can_switch_connected_meetings": false,
      "can_switch_to_parent_meeting": false
    },
    "show_participant_list": true,
    "can_edit_display_name": false,
    "hidden_participant": false,
    "waiting_room_type": "SKIP",
    "recorder_type": "NONE",
    "transcription_enabled": false
  },
  "ui": {
    "design_tokens": {
      "theme": "darkest",
      "font_family": "Inter",
      "border_radius": "rounded",
      "border_width": "thin",
      "colors": {
        "brand": {
          "300": "#fee38a",
          "400": "#fdd45a",
          "500": "#fdc921",
          "600": "#d9a90f",
          "700": "#b28a0a"
        },
        "background": {
          "600": "#22345f",
          "700": "#162650",
          "800": "#0f1d44",
          "900": "#0a1733",
          "1000": "#04123a"
        },
        "text": "#ffffff",
        "text_on_brand": "#04123a",
        "video_bg": "#0a1733",
        "danger": "#ff5c5c",
        "success": "#3ddc97",
        "warning": "#fdc921"
      },
      "logo": "https://taylormadeacademy.com/assets/logo-nav.webp"
    }
  }
}
```

**3. `opil-host`** (coordinator = `role.admin`, and the facilitator of that `session_no`) — `GROUP_CALL`, no stage, breakouts on, no livestream.
```json
{
  "name": "opil-host",
  "config": {
    "view_type": "GROUP_CALL",
    "max_video_streams": {
      "desktop": 9,
      "mobile": 4
    },
    "max_screenshare_count": 1,
    "media": {
      "video": {
        "frame_rate": 24,
        "quality": "hd",
        "simulcast": true
      },
      "screenshare": {
        "frame_rate": 5,
        "quality": "hd"
      }
    }
  },
  "permissions": {
    "media": {
      "audio": {
        "can_produce": "ALLOWED"
      },
      "video": {
        "can_produce": "ALLOWED"
      },
      "screenshare": {
        "can_produce": "ALLOWED"
      }
    },
    "stage_enabled": false,
    "stage_access": "ALLOWED",
    "accept_stage_requests": true,
    "can_accept_production_requests": true,
    "accept_waiting_requests": true,
    "kick_participant": true,
    "pin_participant": true,
    "can_spotlight": true,
    "disable_participant_audio": true,
    "disable_participant_video": true,
    "disable_participant_screensharing": true,
    "can_change_participant_permissions": true,
    "can_record": true,
    "can_livestream": false,
    "chat": {
      "public": {
        "can_send": true,
        "text": true,
        "files": true
      },
      "private": {
        "can_send": true,
        "can_receive": true,
        "text": true,
        "files": true
      }
    },
    "polls": {
      "can_create": true,
      "can_view": true,
      "can_vote": true
    },
    "plugins": {
      "can_start": true,
      "can_close": true,
      "can_edit_config": true
    },
    "connected_meetings": {
      "can_alter_connected_meetings": true,
      "can_switch_connected_meetings": true,
      "can_switch_to_parent_meeting": true
    },
    "show_participant_list": true,
    "can_edit_display_name": true,
    "hidden_participant": false,
    "waiting_room_type": "SKIP",
    "recorder_type": "NONE",
    "transcription_enabled": true
  },
  "ui": {
    "design_tokens": {
      "theme": "darkest",
      "font_family": "Inter",
      "border_radius": "rounded",
      "border_width": "thin",
      "colors": {
        "brand": {
          "300": "#fee38a",
          "400": "#fdd45a",
          "500": "#fdc921",
          "600": "#d9a90f",
          "700": "#b28a0a"
        },
        "background": {
          "600": "#22345f",
          "700": "#162650",
          "800": "#0f1d44",
          "900": "#0a1733",
          "1000": "#04123a"
        },
        "text": "#ffffff",
        "text_on_brand": "#04123a",
        "video_bg": "#0a1733",
        "danger": "#ff5c5c",
        "success": "#3ddc97",
        "warning": "#fdc921"
      },
      "logo": "https://taylormadeacademy.com/assets/logo-nav.webp"
    }
  }
}
```

**4. `opil-student`** — camera and mic allowed, screen share on request (host approves via `can_accept_production_requests`), breakouts switchable, public chat with files (`chat.public.files: true`, like `tma-webinar-member`; judges are text-only).
```json
{
  "name": "opil-student",
  "config": {
    "view_type": "GROUP_CALL",
    "max_video_streams": {
      "desktop": 9,
      "mobile": 4
    },
    "max_screenshare_count": 1,
    "media": {
      "video": {
        "frame_rate": 24,
        "quality": "hd",
        "simulcast": true
      },
      "screenshare": {
        "frame_rate": 5,
        "quality": "hd"
      }
    }
  },
  "permissions": {
    "media": {
      "audio": {
        "can_produce": "ALLOWED"
      },
      "video": {
        "can_produce": "ALLOWED"
      },
      "screenshare": {
        "can_produce": "CAN_REQUEST"
      }
    },
    "stage_enabled": false,
    "stage_access": "ALLOWED",
    "accept_stage_requests": false,
    "can_accept_production_requests": false,
    "accept_waiting_requests": false,
    "kick_participant": false,
    "pin_participant": false,
    "can_spotlight": false,
    "disable_participant_audio": false,
    "disable_participant_video": false,
    "disable_participant_screensharing": false,
    "can_change_participant_permissions": false,
    "can_record": false,
    "can_livestream": false,
    "chat": {
      "public": {
        "can_send": true,
        "text": true,
        "files": true
      },
      "private": {
        "can_send": true,
        "can_receive": true,
        "text": true,
        "files": false
      }
    },
    "polls": {
      "can_create": false,
      "can_view": true,
      "can_vote": true
    },
    "plugins": {
      "can_start": false,
      "can_close": false,
      "can_edit_config": false
    },
    "connected_meetings": {
      "can_alter_connected_meetings": false,
      "can_switch_connected_meetings": true,
      "can_switch_to_parent_meeting": true
    },
    "show_participant_list": true,
    "can_edit_display_name": false,
    "hidden_participant": false,
    "waiting_room_type": "SKIP",
    "recorder_type": "NONE",
    "transcription_enabled": false
  },
  "ui": {
    "design_tokens": {
      "theme": "darkest",
      "font_family": "Inter",
      "border_radius": "rounded",
      "border_width": "thin",
      "colors": {
        "brand": {
          "300": "#fee38a",
          "400": "#fdd45a",
          "500": "#fdc921",
          "600": "#d9a90f",
          "700": "#b28a0a"
        },
        "background": {
          "600": "#22345f",
          "700": "#162650",
          "800": "#0f1d44",
          "900": "#0a1733",
          "1000": "#04123a"
        },
        "text": "#ffffff",
        "text_on_brand": "#04123a",
        "video_bg": "#0a1733",
        "danger": "#ff5c5c",
        "success": "#3ddc97",
        "warning": "#fdc921"
      },
      "logo": "https://taylormadeacademy.com/assets/logo-nav.webp"
    }
  }
}
```

**5. `opil-judge`** — no media, text chat, votes, may drop into a breakout to observe. `GROUP_CALL` is a choice (same view as the room), not a constraint; if spike 4 shows an ugly empty tile, the first fallback is `hidden_participant: true`, the second is a WEBINAR-view judge preset (mixed views are documented).
```json
{
  "name": "opil-judge",
  "config": {
    "view_type": "GROUP_CALL",
    "max_video_streams": {
      "desktop": 9,
      "mobile": 4
    },
    "max_screenshare_count": 1,
    "media": {
      "video": {
        "frame_rate": 24,
        "quality": "hd",
        "simulcast": true
      },
      "screenshare": {
        "frame_rate": 5,
        "quality": "hd"
      }
    }
  },
  "permissions": {
    "media": {
      "audio": {
        "can_produce": "NOT_ALLOWED"
      },
      "video": {
        "can_produce": "NOT_ALLOWED"
      },
      "screenshare": {
        "can_produce": "NOT_ALLOWED"
      }
    },
    "stage_enabled": false,
    "stage_access": "NOT_ALLOWED",
    "accept_stage_requests": false,
    "can_accept_production_requests": false,
    "accept_waiting_requests": false,
    "kick_participant": false,
    "pin_participant": false,
    "can_spotlight": false,
    "disable_participant_audio": false,
    "disable_participant_video": false,
    "disable_participant_screensharing": false,
    "can_change_participant_permissions": false,
    "can_record": false,
    "can_livestream": false,
    "chat": {
      "public": {
        "can_send": true,
        "text": true,
        "files": false
      },
      "private": {
        "can_send": false,
        "can_receive": true,
        "text": true,
        "files": false
      }
    },
    "polls": {
      "can_create": false,
      "can_view": true,
      "can_vote": true
    },
    "plugins": {
      "can_start": false,
      "can_close": false,
      "can_edit_config": false
    },
    "connected_meetings": {
      "can_alter_connected_meetings": false,
      "can_switch_connected_meetings": true,
      "can_switch_to_parent_meeting": true
    },
    "show_participant_list": true,
    "can_edit_display_name": false,
    "hidden_participant": false,
    "waiting_room_type": "SKIP",
    "recorder_type": "NONE",
    "transcription_enabled": false
  },
  "ui": {
    "design_tokens": {
      "theme": "darkest",
      "font_family": "Inter",
      "border_radius": "rounded",
      "border_width": "thin",
      "colors": {
        "brand": {
          "300": "#fee38a",
          "400": "#fdd45a",
          "500": "#fdc921",
          "600": "#d9a90f",
          "700": "#b28a0a"
        },
        "background": {
          "600": "#22345f",
          "700": "#162650",
          "800": "#0f1d44",
          "900": "#0a1733",
          "1000": "#04123a"
        },
        "text": "#ffffff",
        "text_on_brand": "#04123a",
        "video_bg": "#0a1733",
        "danger": "#ff5c5c",
        "success": "#3ddc97",
        "warning": "#fdc921"
      },
      "logo": "https://taylormadeacademy.com/assets/logo-nav.webp"
    }
  }
}
```

Session-time role changes never rewrite presets: promote a member to speak = `meeting.stage.grantAccess([userId])` ([stage-management](https://developers.cloudflare.com/realtime/realtimekit/core/stage-management/)); give a student poll creation or chat files for the session = `meeting.participants.updatePermissions(ids, {...})`, limited to chat/polls/plugins ([remote-participants](https://developers.cloudflare.com/realtime/realtimekit/core/remote-participants/)); a permanent change = `PATCH $RTK/meetings/{meeting_id}/participants/{participant_id} {preset_name}` (`$RTK` as defined in §11) from `ea-rtk-join` on the next join (whether it applies to an already-joined peer is spike 6). Breakout rooms are connected meetings; each breakout is an independent meeting that the platform can record separately ([breakout-rooms](https://developers.cloudflare.com/realtime/realtimekit/core/breakout-rooms/)). Breakout meetings are audit-only in v1: not recorded, not transcribed; the host bar's REC covers the main room only.

---

## 5. Edge functions

Common to all three (`_shared/rtk.ts`):
- Base `https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/realtime/kit/{CF_RTK_APP_ID}/…`, header `Authorization: Bearer {CF_RTK_API_TOKEN}`, `Content-Type: application/json` ([quickstart](https://developers.cloudflare.com/realtime/realtimekit/quickstart/)). The RealtimeKit token is a **new** token with Realtime + Realtime Admin only — never the Stream:Edit `CF_API_TOKEN`.
- Cloudflare responses are read as `{success, result | data, errors}`; the helper unwraps `data` (the brief's field name) and, if absent, `result`, and logs the raw envelope on the first staging call so the shape is pinned (spike 10(c)).
- Every non-2xx from Cloudflare → `502 {error: "cloudflare_<status>"}` to the page (the `ea-live-publish` convention, `:103`).
- CORS block (`ea-live-publish/index.ts:28-34`), `json()` helper (`:37-42`) and the OPTIONS/405 guards (`:45-46`) copied verbatim. `ALLOWED_ORIGIN = "https://taylormadeacademy.com"`; the pages call from that origin via `window.BM_CONFIG.FUNCTIONS_BASE` (`js/config.js`).
- Auth (join + host): `Authorization: Bearer <supabase access token>` → `admin.auth.getUser(token)` → 401 `sign_in`; role RPCs via `createClient(url, ANON_KEY, {global:{headers:{Authorization: 'Bearer '+token}}})` exactly as `ea-live-publish/index.ts:64-77`.
- Deploy: `supabase functions deploy <name> --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`; add the three to `supabase/functions/README.md`'s table.

### 5.1 `createOrGetMeeting(room, ref)` (helper; hosts only)
1. Service-role `select rtk_meeting_id, title, is_live, mode from ea_live where id = $1` / `… from ea_opil_sessions where no = $1 and kind = 'thread'`. Missing → 404 `not_found`; wrong kind → 400 `bad_session`. `live_id` is always a real row: the Academy page inserts the `ea_live` row itself before calling (§10.3, the same admin write `setLive` uses); neither `ea-rtk-join` nor `ea-rtk-host` ever inserts a room row, and `{room:'academy', live_id:null}` is a 400 `bad_room`.
2. If `rtk_meeting_id` is set → return it.
3. `POST /meetings` ([Create Meeting](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/create/) — no required fields):
   ```json
   {
     "title": "Academy Live — <title>"  |  "OPIL Session <no> — <title>",
     "persist_chat": true,
     "session_keep_alive_time_in_secs": 120,
     "transcribe_on_end": true,
     "summarize_on_end": true,
     "ai_config": {
       "transcription": { "language": "en-US", "keywords": ["Interledger", "Open Payments", "Taylormade"], "profanity_filter": false },
       "summarization": { "summary_type": "lecture", "text_format": "markdown", "word_limit": 500 }
     }
   }
   ```
   No `record_on_start`, no `live_stream_on_start`, no `recording_config.storage_config` (the `type: "cloudflare"` + `account_id` form is **not** in the Create Meeting schema — the enumerated types are aws | azure | digitalocean | gcs | sftp; the `cloudflare` form appears only in the custom-storage guide for Start Recording and the dashboard). Response field used: `data.id`. `session_keep_alive_time_in_secs: 120` means the session outlives its last participant by up to 120 s: after `end_session`'s kick-all the empty session lingers, and its `meeting.ended` lands up to two minutes later. If the host presses Start again inside that window, that delayed event must not flip the NEW room off air — which is why `start` pins `rtk_session_id` + `rtk_started_at` on the row (§5.3, §9) and the webhook checks them (§6.3).
4. **Race:** `update ea_live set rtk_meeting_id = $new where id = $1 and rtk_meeting_id is null returning id` (same for `ea_opil_sessions` on `no`). Service role runs this, so the trigger in §9 lets it through. If 0 rows, a second host won: re-read the winner's id, retire ours with `PATCH /meetings/{new} {"status": "INACTIVE"}` ([update meeting](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/update_meeting_by_id/) — there is no DELETE meeting endpoint), and continue with the winner's id. The loser's join therefore succeeds instead of erroring.
5. Meeting type is set by the participant's preset `config.view_type`, not on the meeting ([meeting-metadata](https://developers.cloudflare.com/realtime/realtimekit/core/meeting-metadata/)).

### 5.2 `ea-rtk-join`
**Request** `POST`, body `{room: "academy", live_id: "<uuid>"}` | `{room: "opil", session_no: <int>}`.

**Steps**
1. Auth → `user`.
2. Role (as the caller, allowlisted preset):
   - academy: `ea_is_admin` → `tma-webinar-host`; else `ea_is_member` → `tma-webinar-member`; else 403 `not_allowed`. **Public-access rows are broadcast-only in v1: room mode is members-only; a public row (`ea_live.access = 'public'`, `0023`) with `mode = 'meeting'` is a configuration error the host UI prevents (the Start webinar button is disabled on public rows with a note, §10.3).** Ticket holders and public rooms in room mode are §17 item 1.
   - opil: `session_no` must be an integer (400 `bad_session`); `ea_opil_my_role` → `role.admin === true || (role.facilitator_sessions||[]).includes(no)` → `opil-host`; else `role.judge === true` → `opil-judge`; else `ea_opil_in_cohort` → `opil-student`; else 403 `not_allowed`.
3. Load the row (service role). `isHost = preset.endsWith('-host')`.
4. **Gate for non-hosts:** if `!(row.is_live && row.mode === 'meeting' && row.rtk_meeting_id)` → 409 `not_open`. Non-hosts never cause a meeting to be created (the brief's premium-gate risk) and cannot run up participant minutes in a room the host has not opened. Hosts may join any time — that is the join phase of the Start class / Start webinar button (§3.1, §10.3), which joins before anything writes `is_live`.
5. Meeting id: hosts → `createOrGetMeeting`; non-hosts → `row.rtk_meeting_id`.
6. No INACTIVE check on join. Nothing in v1 sets a row's meeting INACTIVE: the only `PATCH {"status": "INACTIVE"}` is the orphan retirement in §5.1, and an orphan never sits on a row. `ea-rtk-host start` step 1 self-heals if one ever does (`GET /meetings/{meeting_id}` — [get meeting](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/get_meeting_by_id/)). RealtimeKit has no scheduler; the time window is ours ([FAQ](https://developers.cloudflare.com/realtime/realtimekit/faq/)) — step 4 is that window (the host having pressed Start).
7. Participant (service role, `ea_rtk_participants` keyed `(meeting_id, user_id)`):
   - none → `POST /meetings/{meeting_id}/participants` `{"custom_participant_id": "<auth.users.id>", "preset_name": "<preset>", "name": "<ea_profiles.display_name || 'Member'>", "picture": "<avatar_url if https>"}` ([Add Participant](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/add_participant/); required: `custom_participant_id`, `preset_name`). Used: `data.id`, `data.token`. Insert the row.
   - exists, `preset_name` ≠ today's → `PATCH /meetings/{meeting_id}/participants/{participant_id}` `{"preset_name": "<preset>"}` ([Edit Participant](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/edit_participant/); returns the participant with a token). Update the row.
   - exists, same preset → `POST /meetings/{meeting_id}/participants/{participant_id}/token` (no body) → `data.token` ([refresh participant token](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/refresh_participant_token/); the skeptic confirmed it returns `{token}`). Tokens are time-bound with an undocumented lifetime ([concepts/participant](https://developers.cloudflare.com/realtime/realtimekit/concepts/participant/)) — refresh on **every** join; the page never caches one.
   - set `last_token_at = now()`. (`ea_rtk_participants` stores no display name; §8 joins `ea_profiles.display_name` on `user_id` when it needs one.)
8. **Response** `200 {token, meeting_id, preset, room, ref, host: boolean}`.

**Errors** `401 sign_in`, `400 bad_room | bad_session`, `403 not_allowed`, `404 not_found`, `409 not_open`, `502 cloudflare_<status>`, `503 rtk_not_configured` (missing secrets, mirrors `stream_not_configured`).

**Idempotency**: repeat calls return a fresh token for the same participant; nothing is duplicated. Rate: one participant row per (meeting, user) bounds Cloudflare writes to one per person per meeting.

### 5.3 `ea-rtk-host`
**Request** `POST`, body `{room, live_id | session_no, action, record?: boolean}`; `action ∈ start | end_session | start_recording | stop_recording | status` (`end_session` as approved in rtk-decisions §4: kick-all + explicit recording stop). Auth as join; **only** host presets pass (academy: `ea_is_admin`; opil: `role.admin || facilitator_sessions.includes(no)`) — the same rule `ea-live-publish` uses at `:66-77`. Others → 403 `not_allowed`.

- **`start`** (the Start class / Start webinar button, §10.3; the page has already called `ea-rtk-join`, mounted the room and seen `rtkStatesUpdate` `joined`, and calls `start` on that first `joined` — so a session exists for the recording to attach to):
  1. `createOrGetMeeting`; `GET /meetings/{id}` ([get meeting](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/get_meeting_by_id/)) → if `data.status === 'INACTIVE'` → `PATCH /meetings/{id} {"status": "ACTIVE"}` ([update meeting](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/update_meeting_by_id/)). Belt-and-braces only: v1 never sets a row's meeting INACTIVE (§5.2 step 6).
  2. **One-live rule** (service role, bypasses RLS but not unique indexes): `update ea_opil_sessions set is_live = false, mode = 'stream' where is_live and no <> $1` then `update ea_opil_sessions set is_live = true, mode = 'meeting' where no = $1` (Academy: same on `ea_live` by `id`). The clear resets `mode` as well as `is_live`, so a room row bumped off air by another host never keeps `mode = 'meeting'` (§3.1). This mirrors what the pages do client-side (`live/index.html` `setLive`, `opil/hub/live/index.html:300-305`) but cannot be filtered to zero rows by a facilitator's RLS. On `23505` (two hosts starting two rooms in the same instant) retry the pair once, then 409 `another_live`.
  2b. **Pin the session** (the restart race, §5.1): `GET /meetings/{id}/active-session` ([get active session](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/active-session/methods/get_active_session/)) — the host is already joined, so one exists — then `update … set rtk_session_id = $sid, rtk_started_at = now() where <pk> = $1`. If the GET fails (non-200, or the envelope has no id — spike 10(c)), write `rtk_session_id = null` anyway — an explicit overwrite, never the previous session's id left on the row — and rely on the `meeting.started` webhook to fill it (§6.3) and on the `rtk_started_at` fallback in the `meeting.ended` rule. `rtk_started_at` is always written.
  3. If `record !== false` → the `start_recording` steps.
  4. Response `{meeting_id, is_live: true, mode: "meeting", recording_id | null}`.
- **`start_recording`**: `GET /recordings/active-recording/{meeting_id}` ([get active recording](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/recordings/methods/get_active_recordings/)) → if 200 return it (idempotent). Else `POST /recordings` ([Start Recording](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/recordings/methods/start_recordings/)):
  ```json
  {
    "meeting_id": "<meeting_id>",
    "file_name_prefix": "academy_live_<id>"  |  "opil_s<no>",
    "max_seconds": 10800,
    "video_config": { "codec": "H264", "width": 1280, "height": 720, "export_file": true },
    "audio_config": { "codec": "AAC", "channel": "stereo", "export_file": true },
    "realtimekit_bucket_config": { "enabled": true }
  }
  ```
  Used: `data.id` (recording id). Upsert `ea_rtk_artifacts` (kind `recording`, `provider_id` = id, status `INVOKED`). Lifecycle INVOKED → RECORDING → UPLOADING → UPLOADED | ERRORED ([monitor-status](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/monitor-status/)). Recordings shorter than ~5 s may ERROR; a recording stops on its own after 60 s with nobody in the room ([start-recording](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/start-recording/)). Whether Start Recording succeeds before the first participant joins is spike 16 — the client order (join, then Start) sidesteps it.
- **`stop_recording`**: `GET /recordings/active-recording/{meeting_id}` ([get active recording](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/recordings/methods/get_active_recordings/)) → `PUT /recordings/{recording_id} {"action": "stop"}` ([pause/resume/stop](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/recordings/methods/pause_resume_stop_recording/)); 404 from the GET → `{stopped: false}` (nothing running), not an error.
- **`end_session`** ("End for everyone"), in this order: `stop_recording` (so the file has the last words) → `POST /meetings/{meeting_id}/active-session/kick-all` ([kick-all](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/active-session/methods/kick_all_participants/), returns `{action, kicked_participants_count}` and nothing about recordings) → `update … set is_live = false, mode = 'stream' where <pk> = $1` (setting `is_live` false never trips the index; resetting `mode` is what keeps the next broadcast Go live on the HLS path, §3.1). Response `{ended: true, kicked_participants_count, mode: "stream"}`. The meeting stays ACTIVE for next time. The session does not end at kick-all: it lingers empty for up to `session_keep_alive_time_in_secs` (120 s, §5.1) and its `meeting.ended` arrives after that. On a row that stayed off air the event matches nothing (`mode = 'stream'`). If the host pressed Start again inside the window, the row is back to `mode = 'meeting'` with a fresh `rtk_session_id` / `rtk_started_at` (step 2b), and the §6.3 rule — the payload's session id must equal the row's `rtk_session_id` (or the row's is null), or, when the payload carries no session id, `rtk_started_at` must be older than 150 s — is what keeps the old session's delayed `meeting.ended` from flipping the NEW room off air. `end_session` leaves `rtk_session_id` / `rtk_started_at` alone; `start` overwrites them.
- **`status`**: if the row has no `rtk_meeting_id` (host opened the page before ever pressing Start class / Start webinar) → `{active: false, recording: null}` without calling Cloudflare. Otherwise `GET /meetings/{meeting_id}/active-session` → 200 `{live_participants, minutes_consumed, started_at}` or 404 "No active session found" ([get active session](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/active-session/methods/get_active_session/)) → `{active: false}`; plus `recording: null | {id, status}` from `GET /recordings/active-recording/{meeting_id}` (404 → `null`). Feeds the host bar's headcount and the REC toggle's state (§10.6).

Nothing here returns HTML or asks the page to navigate; the page applies the JSON to the DOM (§10.6).

### 5.4 `ea-rtk-webhook`
Full handling in §6. Contract: `POST` only, no CORS (server-to-server), `verify_jwt` OFF, the RSA signature over the raw body is the auth. Responses: `200` handled / duplicate / unknown event, `401` bad signature or wrong `rtk-webhook-id`, `503` transient failure (RealtimeKit retries 5xx and never retries 4xx — [retry behaviour](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#retry-behavior); schedule undocumented, spike 10(b)).

---

## 6. Webhook handling

### 6.1 Verification
1. `const raw = await req.arrayBuffer()` **before** anything else. Parsing and re-serialising the JSON breaks the signature.
2. Headers: `rtk-signature` (Base64 RSA-SHA256 over the raw body), `rtk-uuid` (delivery id), `rtk-webhook-id` ([verify signatures](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#verify-webhook-signatures)).
3. Public key: `GET https://api.realtime.cloudflare.com/.well-known/webhooks.json`, cached in module scope for 24 h. The response is `{"success": true, "data": {"publicKey": "-----BEGIN PUBLIC KEY-----\n..."}, "message": ""}` — read `data.publicKey` ([verify webhook signatures](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#verify-webhook-signatures) prints it verbatim); strip `-----BEGIN/END PUBLIC KEY-----` and whitespace, base64-decode, `crypto.subtle.importKey('spki', der, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify'])`, then `crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, raw)`. Fail → 401.
4. Second guard: `rtk-webhook-id` must equal the secret `CF_RTK_WEBHOOK_ID` (the id returned at registration). Mismatch → 401.

### 6.2 Dedupe (`ea_rtk_events`)
`insert into ea_rtk_events (id, webhook_id, event, meeting_id, session_id, payload) values (rtk-uuid, …) on conflict (id) do nothing returning id`. Payload is stored with `streamKey` (and any key matching `/stream_?key/i`) replaced by `"[redacted]"` before insert. If the insert returns nothing **and** the existing row has `handled_at` set → `200 duplicate`. If it exists with `handled_at` null (our earlier attempt returned 503 and RealtimeKit retried) → process again. On success set `handled_at = now()`; on failure set `error` and return 503. This is why dedupe cannot be "insert then always 200".

### 6.3 Event → effect
Map `meeting.id` → room row: `select id from ea_live where rtk_meeting_id = $1` then `select no from ea_opil_sessions where rtk_meeting_id = $1`. Unknown meeting → audit only, 200. Breakout meetings are audit-only in v1: not recorded, not transcribed; the host bar's REC covers the main room only — a breakout (connected) meeting's id is on no row, so its events take the unknown-meeting path. Payload field names come from the webhooks page ([recording.statusUpdate](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#recordingstatusupdate), [meeting.transcript](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#meetingtranscript), [livestreaming.statusUpdate](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#livestreamingstatusupdate)); the exact envelope (where `meeting.id` / `session.id` sit) is pinned from one captured payload per event in staging (spike 10(c)).

| Event | Effect |
|---|---|
| `meeting.started` | Pins the session when the row has none: `update ea_live set rtk_session_id = $sid where rtk_meeting_id = $1 and rtk_session_id is null` (same for `ea_opil_sessions`) — the fill-in for a `start` whose active-session GET failed (§5.3 step 2b). Otherwise audit only. `is_live` stays the host's decision (`ea-rtk-host start`); a webhook setting it true would hit `ea_*_one_live` whenever a stale broadcast row is still live. |
| `meeting.ended` | Off-air backstop for a host who closed the tab instead of pressing End (§3.1), guarded against the restart race (§5.1, §5.3): `update ea_live set is_live = false, mode = 'stream' where rtk_meeting_id = $1 and mode = 'meeting' and (rtk_session_id is null or rtk_session_id = $sid)` (same for `ea_opil_sessions`). When the payload carries no session id (spike 10(c) still unpinned), the fallback is `… and mode = 'meeting' and rtk_started_at < now() - interval '150 seconds'` — a room the host (re)started inside the last 150 s is never touched by an event that cannot name its session. Setting `is_live` false never violates the partial unique index. The `mode = 'meeting'` guard also means a broadcast that went live after the room ended is never switched off by a late webhook. |
| `recording.statusUpdate` | Upsert artifact kind `recording` (`provider_id` = recording id, `status`, `meta` = `{fileSize, recordingDuration, outputFileName}`, plus `downloadUrl` when the Stream copy fails so a retry has it — §7). `UPLOADED` → §7 Stream copy → `url` = watch URL, `expires_at` = `downloadUrlExpiry`, and `update ea_live set replay_url = $watch where rtk_meeting_id = $m` / `update ea_opil_sessions set recording_url = $watch where rtk_meeting_id = $m`. `ERRORED` → status only; no replay change; the host bar shows "Recording failed" from `status`. |
| `meeting.transcript` | **Upsert, never insert.** First claim the row: `insert … (kind 'transcript', status 'pending') on conflict (session_id, kind) do update` — or `on conflict (room, ref, kind)` on the partial key when the envelope carries no session id (§9 block 5). Then `fetch(transcriptDownloadUrl)` → CSV text → the same upsert again with `text` = CSV and `status = 'ready'`. When the envelope carries a session id, also `GET /sessions/{sessionId}/transcript?format=JSON` ([session transcripts](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/sessions/methods/get_session_transcripts/), 7-day availability) and store it in `data`; otherwise store the CSV only and leave `data` null (the row is then keyed on `(room, ref)` — §8, §9 block 5). Then §8 compose. A 503 from us + a RealtimeKit retry re-runs the same event onto the same row (`pending` → `ready` again); nothing is duplicated. |
| `meeting.summary` | Same shape: upsert `(kind 'summary', status 'pending')` on the same conflict key, `fetch(summaryDownloadUrl)` → markdown text → upsert again with `text` and `status = 'ready'`. Then §8 compose. Retry-safe for the same reason. |
| `livestreaming.statusUpdate` | **v1: audit only** (redacted). Webhook vocabulary is `LIVE | OFFLINE | IDLE`; the REST livestream `status` enum is `LIVE | IDLE | ERRORED | INVOKED` (no OFFLINE) — two switches, never one, when phase 2 wires overflow. |
| anything else | Audit, 200. |

Every artifact write in this table is an upsert on one of the §9 block 5 unique indexes (`insert … on conflict … do update`), status `pending` first and `ready` (playbook: `draft`) once the text/data is stored — that is what makes the 503-then-retry path in §6.2 safe: the retried event lands on the row the first attempt claimed.

Store content, never links: every RealtimeKit artifact (recording in their bucket, transcript, summary) expires after seven days. Transient `fetch` failures (download URL, Stream API, Supabase) → 503 so RealtimeKit retries; permanent ones (4xx from a download URL = expired) → mark `error`, return 200 (a retry cannot help). Work runs inline in the request; a one-hour transcript CSV is well under a megabyte. `EdgeRuntime.waitUntil` is not used until spike 17 shows it survives the response on this runtime.

Not subscribed in v1: `meeting.participantJoined/Left` and `meeting.chatSynced` (attendance and chat export are v2 proposals, not yet approved — §16; their payloads carry `userDisplayName` + our user id, so when added they stay in service-role tables).

---

## 7. Recording → replay via Stream copy-by-URL

**Why this path.** RealtimeKit's own bucket keeps the MP4 for seven days behind a presigned `downloadUrl` ([realtimekit bucket config](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/configure-realtimekit-bucket-config/)). Copying it into Cloudflare Stream keeps every replay in the same Hosted Videos library as the OBS/WHIP recordings, behind the same `/watch` page both pages already embed, and needs no new bucket, no public R2 domain and no new player branch.

**The call** (decision; the Stream endpoint is not in the brief's claim set — [Stream: upload via link](https://developers.cloudflare.com/stream/uploading-videos/upload-via-link/); to be confirmed by the first staging run (§11.7, spike 13)):
```
POST https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/stream/copy
Authorization: Bearer {CF_API_TOKEN}          # existing Stream:Edit token
Content-Type: application/json
{ "url": "<downloadUrl from recording.statusUpdate>",
  "meta": { "name": "OPIL Session 03 — <title> — 2026-10-01" | "Academy Live — <title> — <date>" } }
```
Response field used: `result.uid` (the envelope is `{success, result, errors}` like the tus call in `ea-live-publish`). Watch URL = `https://${CF_STREAM_SUBDOMAIN}.cloudflarestream.com/${uid}/watch` — i.e. `https://customer-nimm2h959enrq4x1.cloudflarestream.com/<uid>/watch`, the same shape `ea-live-publish` returns at `:104` and both `saved` callbacks store today (`live/index.html:367`, `opil/hub/live/index.html:352`).

**Which column.** `ea_live.replay_url` (`0021:10`) for Academy; `ea_opil_sessions.recording_url` (`0013:52`) for OPIL. `ea_live` has no `recording_url`; `ea_opil_sessions` has no `replay_url`. The existing player code's non-`.m3u8` branch (iframe) plays a `/watch` URL unchanged in both pages, so the brief's "new `<video>` branch for R2 .mp4" is not needed.

**Timing.** The copy is asynchronous on Stream's side; the URL is written immediately (today's `saved` callback does the same after a tus upload, and the note reads "it becomes the replay once Cloudflare finishes processing it").

**7-day window.** The webhook fires on UPLOADED, well inside the window. If the copy call fails transiently, the webhook returns 503 and RealtimeKit retries; the artifact row keeps `url = null`, `expires_at = downloadUrlExpiry`, `meta.downloadUrl`, so a host can press "Retry replay" (`ea-rtk-host` v2 action `retry_replay`, §16: re-run the copy while `expires_at > now()`). In v1 the recovery is manual, and there is no "broadcast recording path" to reuse — the steps are: (1) read `meta.downloadUrl` from `ea_rtk_session_notes` (§9 block 6 returns `meta`; the `ea_rtk_artifacts` row keeps the URL for the seven days) and download the MP4; (2) Cloudflare dashboard → Stream → Videos → Upload → drop the file; (3) copy the new video's `/watch` URL; (4) put it on the row — **OPIL:** paste it into that session's **Recording URL** field on the coordinator page (`opil/hub/admin/index.html`, the sessions manager, which writes `ea_opil_sessions.recording_url` at `:384`); **Academy:** there is no replay field in the UI today, so set it in the Supabase SQL editor, one line: `update public.ea_live set replay_url = 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/<uid>/watch' where id = '<live_id>';` — a Replay URL field on the Academy admin card is a v2 item (proposed, not yet approved). All of that before the seven days run out. If the window is missed, the recording is gone. Nothing in v1 writes a status for that (the nightly reconcile is a v2 proposal): `ea_rtk_session_notes` computes `expired: expires_at < now()` per recording (§9 block 6) so the panel can say "download link expired, no replay", and there is no local fallback in room mode — that is the trade-off of server-side recording.

Breakout meetings are audit-only in v1: not recorded, not transcribed; the host bar's REC covers the main room only.

**Multiple recordings per meeting** (host stopped/started, or a >60 s empty room split the session): each UPLOADED overwrites `replay_url`/`recording_url` with the **latest**; every recording keeps its own artifact row, so the earlier parts are listed in the host's session notes (the §9 block 6 RPC returns all recordings).

---

## 8. AI: transcript + summary → playbook draft

Meeting-level `transcribe_on_end` + `summarize_on_end` with `ai_config.summarization {summary_type: "lecture", text_format: "markdown", word_limit: 500}` ([summary](https://developers.cloudflare.com/realtime/realtimekit/ai/summary/): word_limit 150–1000, text_format plain_text | markdown, summaries stored 7 days). Post-meeting transcription is Whisper Large v3 Turbo, each participant stream processed separately so speakers are attributed, and uses RealtimeKit-managed storage regardless of any recording storage config ([transcription](https://developers.cloudflare.com/realtime/realtimekit/ai/transcription/)). Post-meeting transcription is GA since 2026-06-08 ([changelog](https://developers.cloudflare.com/changelog/post/2026-06-08-realtimekit-post-meeting-transcription-ga/)).

**Live captions** run only for participants whose preset has `permissions.transcription_enabled: true` — the two host presets. Viewers toggle them with the stock [`rtk-caption-toggle`](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-caption-toggle/) (more-menu) / [`rtk-transcripts`](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-transcripts/) on the stage; [`rtk-ai-toggle`](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-ai-toggle/) / [`rtk-ai-transcriptions`](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-ai-transcriptions/) show the running transcript. If we ever draw our own caption bar: `meeting.ai.on('transcript', t => …)` with `isPartialTranscript` ([consume transcripts](https://developers.cloudflare.com/realtime/realtimekit/ai/transcription/#consume-real-time-transcripts)).

**Compose** — the v1 playbook draft is the summary with a header, nothing generated by us. Trigger: **every** `meeting.transcript` and **every** `meeting.summary` event runs compose after storing its own artifact; compose reads whatever artifacts exist for that `session_id` right then and **upserts** the `(session_id, 'playbook')` row (`ea_rtk_artifacts_session_kind_idx`) — `insert … on conflict (session_id, kind) do update set text = excluded.text, status = excluded.status, updated_at = now()`, first claimed with `status = 'pending'`, then written with the markdown and `status = 'draft'` (the playbook's ready state) — so the second event overwrites the first's draft. The transcript and summary artifacts the same two events store are upserts too (§6.3, §9 block 5), which is why a 503 from us followed by a RealtimeKit retry re-runs the whole event safely: same rows, no duplicates. When the webhook envelope carries no session id (spike 10(c) pins the envelope), the key is `(room, ref)` instead — every artifact row carries both — and the upsert targets `ea_rtk_artifacts_room_ref_kind_idx` (§9 block 5), so there is still exactly one draft per room. A section whose artifact has not landed yet renders as `pending`. No other trigger — which is why the **replay link is not in the draft**: the 1-hour MP4's `UPLOADED` is not ordered before `meeting.summary`, and a draft baked with `pending` would never refresh. The panel renders the replay from `recordings[]` in the `ea_rtk_session_notes` result instead (§9 block 6), which is always current.

Playbook template (the markdown compose writes; a fenced sample, not headings of this document):
```markdown
# <Room title> — <date>            (OPIL: "Session 03 · <title>"; Academy: "Academy Live · <title>")
Host(s): <display names>          (select p.user_id, pr.display_name from ea_rtk_participants p
                                    left join ea_profiles pr on pr.user_id = p.user_id
                                    where p.meeting_id = $1 and p.preset_name like '%-host';
                                    null display_name → 'Host')

### Summary
<summary_md verbatim | "pending">

### Transcript
<"stored (<n> lines)" | "pending">   (the CSV itself is returned separately by the RPC; not inlined)
```
(No Replay section — see the Compose paragraph; the RPC's `recordings[]` carries `url`, `status`, `expires_at`, `expired`.)
→ artifact kind `playbook`, `status = 'draft'` (after the `pending` claim), `text` = the markdown. Never `published` by code. A Timeline section (5-minute buckets with `?t=` links into the Stream `/watch` page) is **v2, proposed — not yet approved** (§16).

**Where it surfaces.** Only through `ea_rtk_session_notes(p_room, p_ref)` (§9 block 6), **read-only** in v1: the OPIL coordinator page (`/opil/hub/admin/`, Sessions & content manager) gets a "Session notes (AI draft)" panel showing the playbook draft, the summary and the transcript for that session; the Academy admin panel on `/live/` gets the same under the class. The draft text lives only in `ea_rtk_artifacts` behind that admin RPC. `ea_opil_sessions.playbook_url text` already **exists** (`supabase/migrations/0013_opil_lab_hub.sql:53`) and is edited on the coordinator page — the Playbook URL input and the "playbook ✓" badge in the sessions manager (`opil/hub/admin/index.html:276-281`, saved at `:384`); it is student-readable through `sess_read`, which is correct, because it holds the published playbook **link**, never draft text. So "Insert into session notes" in v1 is two steps by hand: the coordinator reviews the draft, copies the text to wherever OPIL playbooks are published, and pastes that page's link into `playbook_url`. Code never writes the draft text to a member-readable row; `ea_live` has no equivalent link field. Students and members never see the draft — the 4-agent review rule and Jamal's sign-off apply before anything becomes an official OPIL playbook page. A one-click publish is §17 item 9.

**If the summary never arrives** (rare; needs a transcript first): `ea-rtk-host action=summarize` (v2, §16) calls `POST /sessions/{session_id}/summary` ([generate summary](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/sessions/methods/generate_summary_of_transcripts/)) and polls `GET /sessions/{session_id}/summary` → `summaryDownloadUrl` ([get session summary](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/sessions/methods/get_session_summary/)). In v1 the coordinator runs the same two curls from the runbook shell.

---

## 9. Data model — migration `supabase/migrations/0029_realtimekit_rooms.sql`

Everything RealtimeKit-specific is service-role only. The room tables gain `rtk_meeting_id` and `mode` (both approved, rtk-decisions §4) plus `rtk_session_id` and `rtk_started_at` (the restart-race pins, §5.3 / §6.3); all four server-written, all four trigger-locked from `authenticated`/`anon`. `ea_live_upcoming` (definer view, `0028`) is **not** touched: none of the four reach anon.

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

-- ---------------------------------------------------------------- 2. lock rtk_meeting_id + mode + rtk_session_id + rtk_started_at from clients
-- Why a trigger and not a column-level REVOKE: Supabase's default privileges grant authenticated
-- table-level UPDATE, and Postgres says "granting the privilege at the table level and then revoking
-- it for one column will not do what one might wish: the table-level grant is unaffected by a
-- column-level operation" (https://www.postgresql.org/docs/current/sql-grant.html). sess_fac_update
-- (0018) lets a facilitator update any column of their own sessions and ea_live_admin_write is FOR ALL,
-- so without this a client could clobber or NULL the meeting id and the join function's
-- "WHERE rtk_meeting_id IS NULL" claim would no longer be the only writer.
-- INSERT is guarded too: ea_live_admin_write is FOR ALL and OPIL admins insert sessions, so a client
-- could otherwise seed rtk_meeting_id on a new row and the join function's "where rtk_meeting_id is
-- null" claim would see a client-chosen id. On INSERT there is no OLD row, so the baseline is null.
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
    if new.mode is distinct from old_mode then
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
-- 'anon' for page traffic and 'service_role' for the edge functions. mode is guarded exactly like
-- rtk_meeting_id (rtk-decisions §4): ea-rtk-host start sets 'meeting', ea-rtk-host end_session and the
-- meeting.ended webhook reset 'stream'; broadcast Go live / End never touch it (flipLive, setLive), and
-- a client insert without mode gets the default 'stream', which the INSERT baseline accepts.
-- rtk_session_id / rtk_started_at are guarded the same way: ea-rtk-host start writes both (§5.3 2b),
-- the meeting.started webhook fills rtk_session_id when null, and meeting.ended only flips a row off
-- air where mode = 'meeting' and (rtk_session_id is null or rtk_session_id = <payload session id>) —
-- or, with no session id in the payload, where rtk_started_at < now() - interval '150 seconds' (§6.3).

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
  webhook_id  text,                              -- rtk-webhook-id
  event       text not null,
  meeting_id  text,
  session_id  text,
  payload     jsonb not null,                    -- streamKey redacted before insert
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
  ref         text not null,                     -- ea_live.id::text or ea_opil_sessions.no::text
  kind        text not null check (kind in ('recording','transcript','summary','playbook')),
  provider_id text,                              -- recording id for kind='recording'
  status      text,                              -- recording: INVOKED|RECORDING|UPLOADING|UPLOADED|ERRORED (webhook-written); transcript/summary: pending|ready; playbook: pending|draft (nothing else writes it in v1)
  url         text,                              -- Stream /watch URL for recordings
  expires_at  timestamptz,                       -- downloadUrlExpiry / transcript expiry
  text        text,                              -- CSV transcript, summary markdown, playbook markdown
  data        jsonb,                             -- JSON transcript
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists ea_rtk_artifacts_recording_idx
  on public.ea_rtk_artifacts (provider_id) where kind = 'recording' and provider_id is not null;
create unique index if not exists ea_rtk_artifacts_session_kind_idx
  on public.ea_rtk_artifacts (session_id, kind) where session_id is not null and kind <> 'recording';
create index if not exists ea_rtk_artifacts_room_idx on public.ea_rtk_artifacts (room, ref, kind);
-- Playbook artifacts key on (room, ref) when the webhook envelope carries no session id (§8):
-- one transcript / summary / playbook per room in that case. Recordings are excluded — a meeting
-- can legitimately produce several (§7) and they are keyed by provider_id above.
create unique index if not exists ea_rtk_artifacts_room_ref_kind_idx
  on public.ea_rtk_artifacts (room, ref, kind) where session_id is null and kind <> 'recording';
-- Every webhook write to this table is an UPSERT on one of the three partial keys above, never a
-- bare insert, so a 503 from us + a RealtimeKit retry re-runs the same event onto the same row (§6.2,
-- §6.3, §8). The shape the functions use (transcript shown; summary and playbook are identical):
--   insert into public.ea_rtk_artifacts (meeting_id, session_id, room, ref, kind, status)
--     values ($m, $sid, $room, $ref, 'transcript', 'pending')
--     on conflict (session_id, kind) where session_id is not null and kind <> 'recording'
--     do update set status = 'pending', updated_at = now();
--   … fetch the text …
--   insert into public.ea_rtk_artifacts (meeting_id, session_id, room, ref, kind, text, data, expires_at, status)
--     values ($m, $sid, $room, $ref, 'transcript', $csv, $json, $exp, 'ready')
--     on conflict (session_id, kind) where session_id is not null and kind <> 'recording'
--     do update set text = excluded.text, data = excluded.data, expires_at = excluded.expires_at,
--                   status = excluded.status, updated_at = now();
-- When the envelope carries no session id the conflict target is the other partial key:
--     on conflict (room, ref, kind) where session_id is null and kind <> 'recording'
-- (Postgres only infers a partial unique index when ON CONFLICT repeats its predicate.)
-- Recordings upsert on (provider_id) where kind = 'recording' and provider_id is not null (§5.3, §6.3).
-- status: transcript | summary go pending → ready; playbook goes pending → draft (§8).
alter table public.ea_rtk_artifacts enable row level security;
revoke all on table public.ea_rtk_artifacts from anon, authenticated, public;

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

After running it against prod, re-run the write attacks from `0023` as anon, as a non-admin member **and as an admin / OPIL coordinator**: `PATCH ea_live?id=eq.<x> {rtk_meeting_id: 'x'}` → 42501; `PATCH ea_live?id=eq.<x> {mode: 'meeting'}` as an admin → 42501; `PATCH ea_opil_sessions?no=eq.<n> {rtk_session_id: 'x'}` / `{rtk_started_at: '2026-01-01'}` as a coordinator → 42501; `POST ea_live {title: 'x', rtk_meeting_id: 'x'}` as an admin → 42501 (the INSERT case); `POST ea_opil_sessions {no: 98, kind: 'thread', mode: 'meeting'}` as a coordinator → 42501; `POST ea_opil_sessions {no: 99, kind: 'thread', rtk_meeting_id: 'x'}` as a coordinator → 42501; the same inserts **without** `rtk_meeting_id` → 201 (the guard must not break normal session creation); `INSERT/SELECT ea_rtk_*` → permission denied; `SELECT ea_live_upcoming` → no `rtk_meeting_id`/`mode` column. `ea_rtk_session_notes('opil','3')` as a student → `null`.

Secrets added: `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN`, `CF_RTK_WEBHOOK_ID`. Reused: `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_STREAM_SUBDOMAIN`. No R2 secrets.

---

## 10. Client

### 10.1 Files
- `js/rtk-room.js` (new ESM module, shared by both pages). The JS is a lazy `import()` — fetched only when a page enters room mode (§10.3); the CSS is a small always-loaded link (next item).
- `css/rtk-room.css` (new): `#rtk-root` layout, host bar, the OPIL dock rule. Loaded by `<link rel="stylesheet" href="/css/rtk-room.css">` in **both** pages (`live/index.html`, `opil/hub/live/index.html`), stamped `?v=` by `_ASSET_RX` exactly like `broadcast.css` (`live/index.html:152`, `opil/hub/live/index.html:11`).
- `live/index.html` and `opil/hub/live/index.html`: a `<section id="rtk-root" hidden>` sibling of `#player`; the **Start class / Start webinar** button for hosts (the one room-mode button) — Academy: `#aStartRoom` in the admin card next to `#aGo`, shown while `!liveNow`, disabled with a note when `show.access === 'public'`; OPIL: `#bcStartRoom` in the Broadcast control card next to `#bcGo`, acting on the `#bcSess` selection (`cur()`), shown while `!cur().is_live` — and the mode switch. Pages import `/js/rtk-room.js` with the **bare** path: `build_site.py` stamps `?v=<hash>` on it once `js/rtk-room\.js|css/rtk-room\.css` is in `_ASSET_RX` (a hand-written `?v=…` would be stamped to `?v=<hash>…` and 404). The host bar (`rtk-room.js`, §10.6) carries End, Mute all, REC and the headcount — not Start; Start is the page button above.
- `build_site.py`: add `"js/rtk-room.js", "css/rtk-room.css"` to the `_asset_ver` tuple (`:15-18`) and `js/rtk-room\.js|css/rtk-room\.css` to `_ASSET_RX` (`:214`) so both hub-stamped pages (`HUB_PAGES` includes `"live"` and `opil/hub/live`) get `?v=`.
- `sw.js`: `VERSION = 'tma-v9-rtk-rooms'`. Same-origin js/css is cache-first (`sw.js:75-89`); without the bump existing visitors keep the old pages. Cross-origin (jsdelivr, Supabase) is passed through (`sw.js:57`), so the RealtimeKit bundles are never SW-cached.

### 10.2 CDN (pinned 2.0.2 — never `@latest`; every URL below HEAD-checked 200 on 2026-09-10 unless marked 404 or dead, and the three we use loaded end-to-end in spike 1 the same day)
| What | URL | Note |
|---|---|---|
| **Core (IIFE — the one we use)** | `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js` | Classic `<script>`; exposes `window.RealtimeKitClient`, 643 KB, no imports. Loaded and joined a real staging meeting in spike 1 (2026-09-10). `rtk-room.js` injects the tag itself (§10.3), so the core is fetched only in room mode. |
| Core, `/+esm` — **dead** | `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/+esm` | HEAD is 200, but jsdelivr's ESM conversion of the dependency `sdp-transform@2.15.0` (`/npm/sdp-transform@2.15.0/+esm`) returns 404 and the whole import graph aborts (spike 1, verified in Playwright). `dist/index.es.js` is 200 but has bare specifiers and **cannot** load in a browser. Do not use either. |
| UI kit loader (`defineCustomElements`) | `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js` | The documented plain-HTML route ([ui-kit](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/)); registers the `rtk-*` elements. ESM; loads (spike 1). |
| UI kit module (`provideRtkDesignSystem`, …) | `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js` | Documented on the [design-system page](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/branding/design-system/) (as `@latest`); re-exports `./esm/index.js` (200). `dist/index.es.js` → **404** (that path is on the addons page). ESM; loads (spike 1) and exports `provideRtkDesignSystem`, `BreakoutRoomsManager`, `RtkUiBuilder`, `defaultConfig`, `defaultIconPack`, `extendConfig`, `registerAddons`. |
| Addons (not in v1) | `https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui-addons@0.1.0/dist/<name>.js` | The docs' per-name paths are 404. |

Version note: "Requires RealtimeKit Web Core 2.0.0 or later" is on the UI Kit **2.0.0** release entry, not 2.0.2 ([web-ui-kit release notes](https://developers.cloudflare.com/realtime/realtimekit/release-notes/web-ui-kit/)); 2.0.2 lists the Safari 16.x fix. Both packages pinned at 2.0.2 satisfy it.

### 10.3 Init sequence (`mountRoom({room, ref, sb, cfg, onState})`)

Host-ness comes from `join.host` in the `ea-rtk-join` response, never from the page. `fetchJoin` maps `ref` → `live_id` (academy) / `session_no` (opil) when it builds the §5.2 body. The core is an IIFE (spike 1, 2026-09-10): `rtk-room.js` injects the `<script>` tag on demand and reads `window.RealtimeKitClient`; there is no ESM import of the core anywhere.
```js
// js/rtk-room.js  (ESM; the UI kit is ESM, the core is not)
import { defineCustomElements } from 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js';
import { provideRtkDesignSystem } from 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js';

const CORE_SRC = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js';
function loadCore() {                  // IIFE → window.RealtimeKitClient (spike 1). The /+esm route is dead:
  if (window.RealtimeKitClient) return Promise.resolve(window.RealtimeKitClient);   // sdp-transform@2.15.0/+esm → 404
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CORE_SRC; s.async = true;
    s.onload = () => resolve(window.RealtimeKitClient); s.onerror = reject;
    document.head.appendChild(s);
  });
}

const TOKENS = {                       // design-system page: theme light|dark|darkest; colors → --rtk-colors-* RGB triplets
  theme: 'darkest',
  fontFamily: 'Inter',                 // already loaded by both pages; Space Grotesk stays on page chrome
  borderRadius: 'rounded',
  borderWidth: 'thin',
  colors: {
    brand: { 300: '#fee38a', 400: '#fdd45a', 500: '#fdc921', 600: '#d9a90f', 700: '#b28a0a' },
    background: { 600: '#22345f', 700: '#162650', 800: '#0f1d44', 900: '#0a1733', 1000: '#04123a' },
    text: '#ffffff', 'text-on-brand': '#04123a', 'video-bg': '#0a1733',
    danger: '#ff5c5c', success: '#3ddc97', warning: '#fdc921',
  },
};

export async function mountRoom({ room, ref, sb, cfg, onState }) {
  await defineCustomElements();
  const root = document.getElementById('rtk-root');
  provideRtkDesignSystem(root, TOKENS);

  const join = await fetchJoin({ room, ref, sb, cfg });          // POST ea-rtk-join; see 10.4 for the status → state map
  if (!join.ok) return onState(join.state);                     // upsell | not_open | not_configured | error

  const RealtimeKitClient = await loadCore();
  const meeting = await RealtimeKitClient.init({                // https://developers.cloudflare.com/realtime/realtimekit/core/ — authToken, defaults, onError
    authToken: join.token,
    defaults: {
      audio: join.host,                                          // hosts arrive unmuted
      video: join.host || join.preset === 'opil-student',
      mediaConfiguration: {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
        screenshare: { frameRate: { ideal: 15, max: 30 }, displaySurface: 'monitor' },
      },
    },
    onError: (e) => { if (isAuthExpiry(e)) rejoin(); },          // token TTL undocumented: refetch, re-init, no reload
  });

  const el = document.createElement('rtk-meeting');
  // mode / size / gridLayout / config: deliberately UNSET here — set after spike 1(c) from the
  // rtk-meeting API reference / harness (§10.5). Spike 1 mounted and joined with only
  // showSetupScreen + .meeting, so the defaults are the baseline until 1(c) says otherwise.
  el.showSetupScreen = true;                                     // phone users grant cam/mic before joining; their Join button joins
  el.leaveOnUnmount = true;
  el.applyDesignSystem = false;                                  // we own the tokens on #rtk-root
  el.loadConfigFromPreset = true;                                // preset ui.design_tokens (logo) — spike 1(f)
  el.meeting = meeting;                                          // NEVER call meeting.join() here (see below)
  root.replaceChildren(el);
  root.hidden = false;
  document.body.classList.add('in-meeting');

  // <rtk-meeting> emits rtkStatesUpdate. Verified shape (spike 1, 2026-09-10):
  //   detail = { meeting: 'idle' | 'joined' | …, prefs: { mirrorVideo, muteNotificationSounds }, peerId, … }
  // https://developers.cloudflare.com/realtime/realtimekit/ui-kit/state-management/
  el.addEventListener('rtkStatesUpdate', (e) => {
    const s = e.detail;
    onState(s.meeting, s);
    if (s.meeting === 'ended') { document.body.classList.remove('in-meeting'); }
  });
  return { meeting, el, join };
}

// Host action, called by the page on the first `joined` (below): POST ea-rtk-host {action:'start', record:true}
export async function hostStart({ room, ref, sb, cfg, record = true }) {
  return postHost({ room, ref, sb, cfg, action: 'start', record });   // → {meeting_id, is_live, mode, recording_id} | {error}
}
```
**Joining.** With `showSetupScreen = false`, assigning `.meeting` makes `<rtk-meeting>` join by itself; calling `meeting.join()` as well throws `UnsupportedConcurrentMethodExecution` (spike 1, 2026-09-10). With the setup screen on (v1, above) the user's Join button does it. In neither mode does our code call `join()`. After `joined` the following are live-verified (spike 1) and are what the host bar reads: `meeting.self.roomJoined`, `meeting.self.presetName`, `meeting.self.permissions.{canProduceVideo | canProduceAudio | canProduceScreenshare}` (`'ALLOWED'` | …), `meeting.self.permissions.chatPublic.canSend`, `meeting.self.permissions.polls.canCreate`, `meeting.self.permissions.connectedMeetings`; `meeting.participants.joined` is a `Map` (its `.size` is the local headcount between §5.3 `status` polls).
`RealtimeKitClient.init({ authToken, defaults: { audio, video, mediaConfiguration: { video: {width,height,frameRate}, screenshare: {frameRate, displaySurface} } }, onError })` — every key is on the [core](https://developers.cloudflare.com/realtime/realtimekit/core/) page (its example: `video.frameRate: { ideal: 15 }`, `screenshare: { frameRate: { ideal: 15, max: 30 }, displaySurface: "monitor" }`, an `onError` callback); we ask `ideal: 24` for video to match the presets' `frame_rate: 24`.

The page-state model hangs on that one event ([ui-kit state management](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/state-management/): "The meeting component also emits a `rtkStatesUpdate` event"). Spike 1 saw `idle` and `joined`; `ended` is the documented state End relies on (§10.6) and is to be confirmed by the first staging run (§11.7).

Page side (both pages), after the row and role are known (`isHost` is the page's guess — `isAdmin` on `/live/`, `staff` on OPIL — used only to show the button; a wrong guess costs nothing, `ea-rtk-join` decides and `join.host` is what the host bar trusts). `ROOM` is `'academy'` | `'opil'`; `refOf(row)` is `row.id` | `row.no`:
```js
if (row && row.is_live && row.mode === 'meeting') {
  // everyone: the room is open
  const { mountRoom } = await import('/js/rtk-room.js');              // bare path; build_site.py stamps ?v= (§10.1)
  hideBroadcastPlayerAndPageChat();
  const r = await mountRoom({ room: ROOM, ref: refOf(row), sb, cfg: window.BM_CONFIG, onState });
  if (r && r.join.host) {                                             // already live (host reloaded): bar without a start call —
    let armed = false;                                                // but only once the host is actually in the room (same guard as start)
    r.el.addEventListener('rtkStatesUpdate', (e) => {
      if (e.detail.meeting !== 'joined' || armed) return;
      armed = true;
      armHostBar(r, null);                                            // never synchronously after mountRoom: the host is still on the setup screen (§10.6)
    });
  }
}

// hosts only: the ONE room-mode button — "Start class" (OPIL) / "Start webinar" (Academy).
// 1. join (no is_live gate, no is_live write), 2. on the first `joined` → ea-rtk-host start, 3. host bar.
async function startRoom(ref) {
  if (typeof wakePoll !== 'undefined' && wakePoll) { clearInterval(wakePoll); wakePoll = null; }   // OPIL: :233-237 is armed at :247 exactly when nothing is live
  const { mountRoom, hostStart } = await import('/js/rtk-room.js');
  hideBroadcastPlayerAndPageChat();
  const r = await mountRoom({ room: ROOM, ref, sb, cfg: window.BM_CONFIG, onState });
  if (!r || !r.join.host) return;                                    // ea-rtk-join decides host-ness; a non-host just watches
  let started = false;
  r.el.addEventListener('rtkStatesUpdate', async (e) => {            // never meeting.join(): the setup screen's Join does it
    if (e.detail.meeting !== 'joined' || started) return;
    started = true;
    const res = await hostStart({ room: ROOM, ref, sb, cfg: window.BM_CONFIG, record: true });   // mode='meeting', one-live clear, is_live, recording
    armHostBar(r, res);                                              // 200: LIVE chip + REC + End; error: message + Retry (start only) — §10.6
  });
}

// OPIL — opil/hub/live/index.html, inside the `if (staff)` Broadcast control card, #bcStartRoom next to #bcGo.
// liveSess (:83) is null whenever nothing is live, so the session is the #bcSess selection, cur() (:271-296).
// This page has no `$` helper (live/index.html:158 defines one; opil/hub/live/index.html uses getElementById directly).
document.getElementById('bcStartRoom').addEventListener('click', () => { const s = cur(); if (s && !s.is_live) startRoom(s.no); });

// Academy — live/index.html, inside the admin card, #aStartRoom next to #aGo. `show` is null when no ea_live
// row falls in the window (:195-208); the broadcast path inserts lazily in setLive (:338-340), so the same
// button makes the same insert first, then joins with the new id. rtk_meeting_id and mode are not in the
// payload, so the §9 trigger passes; ea_live_admin_write (0021) is the policy. Public rows are broadcast-only
// in v1 (§5.2): the button is disabled with a note, and the handler refuses as a backstop.
$('aStartRoom').disabled = !!(show && show.access === 'public');
$('aStartRoom').title = $('aStartRoom').disabled ? 'Public shows are broadcast-only. Room mode is for members.' : '';
$('aStartRoom').addEventListener('click', async () => {
  if (liveNow) return;
  if (!show) {
    const { data, error } = await sb.from('ea_live')
      .insert({ title: $('aTitle').value.trim() || 'Taylormade Academy Live', is_live: false })
      .select('*').single();
    if (error) { $('aNote').textContent = error.message; return; }
    show = data;
  }
  if (show.access === 'public') { $('aNote').textContent = 'Public shows are broadcast-only. Room mode is for members.'; return; }
  startRoom(show.id);
});
```

### 10.4 States per role (what the page shows)
| `ea-rtk-join` result | Academy page | OPIL page |
|---|---|---|
| 200 | room mounts; page chat hidden. In-meeting chat: members can send files (`tma-webinar-member` `chat.public.files: true`), emoji per the stock UI | same; `.ln-dock` hidden. In-meeting chat: students can send files (`opil-student` `chat.public.files: true`); judges are text-only (`opil-judge` `files: false`) |
| 403 `not_allowed` | the **existing** gatecard/upsell (`live/index.html` non-member branch), untouched | the existing "not on a team yet / pending" state (`ea_opil_my_registration_status`) |
| 409 `not_open` | idle card: "The room opens when the class starts." (only possible in a race: page saw `is_live` before the host finished) | same |
| 401 `sign_in` | existing signed-out state | `boot()` already redirected to `/login/` |
| 404 `not_found` / 400 `bad_session` / 400 `bad_room` | `error` state → the existing "could not load" card with Retry (a row that vanished or a non-thread session; nothing to mount) | same |
| 503 `rtk_not_configured` | `not_configured` state → the same "could not load" card, copy "Rooms are not set up yet", no Retry (secrets missing — §11) | same |
| 5xx / network | `error` state → the existing "could not load" card with Retry (no reload loop) | same |
| `rtkStatesUpdate` → `ended` | "Class ended. The replay lands here once it is processed." + `#rtk-root` collapses back to the idle card | same, dock restored |

Broadcast mode (`mode === 'stream'`) is byte-for-byte today's code path: `mountStream`, `ea_live_chat` / `ea_opil_live_chat`, the WHIP camera panel, `location.reload()` on Go live/End — all unchanged.

### 10.5 `<rtk-meeting>` props
The [rtk-meeting API page](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-meeting/) lists `meeting`, `showSetupScreen`, `mode`, `size`, `gridLayout`, `config`, `applyDesignSystem`, `loadConfigFromPreset`, `leaveOnUnmount`, `iconPack`, `overrides`, `t`, and marks **nine** of them required — `meeting`, `showSetupScreen`, `mode`, `size`, `gridLayout`, `config`, `applyDesignSystem`, `loadConfigFromPreset`, `leaveOnUnmount` — but does **not** enumerate their values (the brief's `fill|fixed`, `sm|md|lg|xl`, `overrides.disablePrivateChat` are not on that page). The documented plain-HTML mount ([ui-kit](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/)) sets only `show-setup-screen` and assigns `.meeting`, so the defaults evidently work. Plan: the §10.3 sketch leaves `mode`, `size`, `gridLayout` and `config` **unset** — exactly the quickstart shape (`showSetupScreen` + `.meeting`) that spike 1 mounted and joined with. They are set after spike 1(c), from the rtk-meeting API reference and the harness: which of the four the element actually needs, and their legal values, come from that page and the harness/console — never from memory, and no value (not even `mode = 'fill'`) is hardcoded before then. Breakpoints `sm < 768`, `md < 1080` are package-verified (2.0.2), not documented.

### 10.6 Host controls (room mode; never reload)
Host bar rendered under the existing control card once `rtkStatesUpdate` reports `joined` and `join.host` is true (the host got here through **Start class / Start webinar**, §3.1/§10.3):
- **Start is not a bar button.** The page's Start class / Start webinar button (§10.3) mounts the room and, on the first `joined`, calls `ea-rtk-host {action:'start', record:true}`; the bar renders from that response — LIVE chip, headcount pill and the REC toggle (defined below) from the JSON, and End. (Order matters: the host is already in the room, so a session exists for the recording to attach to.) If `start` fails (409 `another_live`, 5xx) the host stays in the room and the bar shows the error with a **Retry** that repeats only the `start` call; students keep seeing the idle card until it succeeds. A host who reloads into an already-live room gets the bar without a start call (`armHostBar(r, null)`), armed on the first `rtkStatesUpdate` with `meeting === 'joined'` — the same guard as the `start` call — never synchronously after `mountRoom`, because the host is still on the setup screen at that point (§10.3).
- **Mute all** → `meeting.participants.disableAllAudio()` (needs `disable_participant_audio`; affects everyone including the local participant — [manage participants](https://developers.cloudflare.com/realtime/realtimekit/core/manage-participants-in-a-session/); the boolean argument seen in one snippet is unexplained — spike 14). Missing permission throws `ClientError 1201`.
- **REC** → a toggle button on the host bar. `start` records by default (`record: true`); pressing REC while recording calls `ea-rtk-host stop_recording`, pressing it while stopped calls `start_recording`; its state is refreshed from `ea-rtk-host status` (`recording: null | {id, status}`) on the same 30 s poll as the headcount, and from each toggle's own response. **The host bar's REC is the only recording control in v1.** `can_record: true` on the host presets makes the stock [`rtk-recording-toggle`](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-recording-toggle/) appear too, and a recording started from it does **not** carry the §5.3 body (`realtimekit_bucket_config`, `file_name_prefix`), so what storage it uses is unknown (spike 18) and the decision refuses to rely on dashboard storage config. Until spike 18 answers, the toggle is hidden through `<rtk-meeting>` `config`/`overrides` (how — spike 1(g)); if it cannot be hidden, `can_record` goes `false` on both host presets and the server-side path is unaffected (it uses the API token, not the participant's permission).
- **Hand-raise queue (Academy)** → built from `meeting.stage.on('stageAccessRequestUpdate' | 'newStageRequest', …)`; buttons call `meeting.stage.grantAccess([userId])` / `denyAccess([userId])` / `kick([userId])` ([stage-management](https://developers.cloudflare.com/realtime/realtimekit/core/stage-management/)). Whether the stock UI already shows this queue ([`rtk-participants-stage-queue`](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-participants-stage-queue/)) is spike 9; the bar is the fallback, not a duplicate.
- **Breakouts (OPIL)** → the stock breakout control (`can_alter_connected_meetings`). Breakout meetings are audit-only in v1: not recorded, not transcribed; the host bar's REC covers the main room only.
- **Headcount** → `ea-rtk-host status` every 30 s while joined, with `meeting.participants.joined.size` (a `Map`, spike 1) as the instant local number between polls.
- **End for everyone** → `ea-rtk-host end_session` → on 200 (`{ended, kicked_participants_count, mode: 'stream'}`): `#rtk-root` shows "Class ended", chip off, dock restored, the idle control card comes back with Start class / Start webinar. The meeting's own `ended` state arrives via `rtkStatesUpdate` when kick-all lands.
- No handler in the bar calls `location.reload()`, `flipLive` or `setLive`. The OPIL `armWake()` poll (`opil/hub/live/index.html:233-237`) is armed at `:247` exactly when nothing is live — which is the moment a host presses Start class — and it would `location.reload()` the host's page 30 s after `start` flips `is_live` (`:236`, `selfBroadcast` is false on this path). So `startRoom` clears `wakePoll` **before** mounting, the way the camera path does (`:337`); a student's idle page keeps its poll and reloads into the `true | meeting` branch, which is today's behaviour for a broadcast going live. The Academy page has no wake poll, only the 12 s chat poll, which is stopped when the page chat is hidden.

### 10.7 Layout and phones
- `#rtk-root { height: calc(100dvh - var(--room-chrome, 120px)); min-height: 520px; border-radius: 16px; overflow: hidden; background: #04123a; }` in the grid's first column; the chat column is hidden in room mode by the body class §10.3 sets (`body.in-meeting .live-grid { grid-template-columns: 1fr }` — the class goes on `document.body`, so every room-mode rule is written `body.in-meeting …`, never `.live-grid.in-meeting`). It is **not** the `.player` box (`aspect-ratio: 16/9`, `live/index.html:18`, `opil/hub/live/index.html:16`).
- OPIL: `body.in-meeting .ln-dock { display: none } body.in-meeting.has-dock { padding-bottom: 0 }` — `nav()` appends the fixed dock on every page (`hub.js:128-136`) and `hub.css:51-61` reserves 58 px + safe-area under it; a full-height meeting at `100dvh` would sit under it and its own control bar would collide.
- `rtk-meeting` sizes itself from its width; below 768 px chat/participants/polls move to the more-menu and the sidebar goes full-screen (package-verified). Keep the existing viewport meta. iOS Safari screen share is not documented anywhere — facilitators share from a laptop. The setup screen stays on so a phone user grants permissions before joining.

---

## 11. Setup runbook (Nelson, in Chrome, once per environment)

Every curl below uses two shell placeholders, set once per shell (these exports are never committed; `scripts/rtk-presets.sh` reads them from the shell — step 4 lists once what is and is not committed):
```bash
export CF_ACCOUNT_ID=<account id> CF_RTK_APP_ID=<app id> CF_RTK_API_TOKEN=<Realtime + Realtime Admin token>
RTK="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/realtime/kit/$CF_RTK_APP_ID"
H=(-H "Authorization: Bearer $CF_RTK_API_TOKEN" -H "Content-Type: application/json")
```

1. **App.** Cloudflare dashboard → Realtime → RealtimeKit → create app `taylormade-academy-prod` (and `taylormade-academy-staging`). Dashboard creation is what the docs describe for getting the default presets ([concepts/preset](https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/), [quickstart](https://developers.cloudflare.com/realtime/realtimekit/quickstart/)); the API alternative, `POST /accounts/{account_id}/realtime/kit/apps` ([apps API](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/apps/)), does not mention presets anywhere on its page, so nothing documents that it seeds them. Separate apps for staging and production. Copy each app id.
2. **Token.** My Profile → API Tokens → Create → custom: permissions **Realtime** + **Realtime Admin** only, scoped to the account. Roll it the way the other routine keys are rolled; verify with `curl "$RTK/presets" "${H[@]}"` (the list call — unverified: no API page was found for it under `presets/methods/` on 2026-09-10, spike 15; the fallback verifier is `curl "$RTK/presets/<preset_id>" "${H[@]}"` — [fetch preset](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/presets/methods/get_preset_by_id/) — with any id from the dashboard).
3. **Secrets.**
   ```bash
   supabase secrets set CF_RTK_APP_ID=<prod app id> CF_RTK_API_TOKEN=<token> --project-ref pgqdmnmessbbzyszjfvr
   ```
   `CF_ACCOUNT_ID`, `CF_API_TOKEN` (Stream:Edit) and `CF_STREAM_SUBDOMAIN` already exist. Staging: the same names in `supabase/.env.staging` (untracked; `supabase functions serve --env-file supabase/.env.staging`), pointing at the staging app.
   **Staging Supabase is the local stack, not a second hosted project** (there is none; the only ref is prod `pgqdmnmessbbzyszjfvr`) — **but the local stack is unverified (spike 19, §15)**: the repo has no `supabase/config.toml` and no `supabase/seed.sql`, and `0001`–`0028` have only ever been run by hand in the SQL editor, never through `supabase db reset`. Spike 19 is the pre-build gate for this step; if any migration fails locally, staging becomes a second hosted Supabase project instead and this step's stack is that project. The intended shape: `supabase init` once (commit the `config.toml` with the `[functions.*] verify_jwt = false` blocks `supabase/functions/README.md` already describes), `supabase start`, `supabase db reset` applies `0001`–`0029`, and `supabase/seed.sql` creates two auth users — **host** `host@test.local` (`public.profiles.role = 'admin'` → `ea_is_admin()`, plus a row in `ea_opil_admins` → OPIL coordinator) and **student** `student@test.local` (`ea_memberships` row with `status = 'active'` → `ea_is_member()`, plus a row in `ea_opil_team_members` on a seeded `ea_opil_teams` row → `ea_opil_in_cohort()`), and one `ea_opil_sessions` row `{no: 1, kind: 'thread'}`. The staging app's webhook points at a `cloudflared tunnel` URL to the local functions port; without the tunnel, §14.5 replay is the webhook test.
4. **Presets.** `scripts/rtk-presets.sh` (curl; reads `$RTK` / `H` from the shell) sends §4.1's five bodies verbatim from `scripts/rtk-presets/<name>.json`. **Committed:** the script and the five `scripts/rtk-presets/<name>.json` bodies. **Untracked:** `scripts/rtk-presets.ids` (the returned ids) and the shell exports (`$CF_ACCOUNT_ID`, `$CF_RTK_APP_ID`, `$CF_RTK_API_TOKEN`).
   ```bash
   for n in tma-webinar-host tma-webinar-member opil-host opil-student opil-judge; do
     curl -X POST "$RTK/presets" "${H[@]}" -d @"scripts/rtk-presets/$n.json"
   done
   ```
   Re-runnable: the script stores each returned `id` in `scripts/rtk-presets.ids` (untracked) and on the next run updates by that id — `curl -X PATCH "$RTK/presets/$PRESET_ID" "${H[@]}" -d @"scripts/rtk-presets/$n.json"` ([update preset](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/presets/methods/update/)); `curl "$RTK/presets" "${H[@]}"` to discover ids by name is the unverified list call (spike 15) and is not relied on. Keep the dashboard defaults untouched.
5. **Webhook.**
   ```bash
   curl -X POST "$RTK/webhooks" "${H[@]}" -d '{
     "name": "supabase-prod",
     "url": "https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-rtk-webhook",
     "events": ["meeting.started", "meeting.ended", "recording.statusUpdate", "meeting.transcript", "meeting.summary", "livestreaming.statusUpdate"],
     "enabled": true
   }'
   ```
   ([register a webhook](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#register-a-webhook)). Copy the returned id → `supabase secrets set CF_RTK_WEBHOOK_ID=<id> --project-ref pgqdmnmessbbzyszjfvr`. Then probe **both** `curl "$RTK/webhooks" "${H[@]}"` ([API index: get webhooks](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/webhooks/methods/get_webhooks/)) and `curl "$RTK/webhooks/all" "${H[@]}"` (the [webhooks guide's](https://developers.cloudflare.com/realtime/realtimekit/webhooks/#register-a-webhook) curl) — one of them will 404; note which in `README.md` (spike 15). The public key needs no probe: `GET https://api.realtime.cloudflare.com/.well-known/webhooks.json` → `data.publicKey` (§6.1).
6. **Deploy.** `supabase functions deploy ea-rtk-join|ea-rtk-host|ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`; run `0029` in the SQL editor; `python3 build_site.py` (stamps `?v=`), bump `sw.js` VERSION, push.
7. **First staging run** (before prod): one host + one student browser; host: Start class (setup screen → Join → the page calls `ea-rtk-host start` on `joined`); student: reload → joined; talk 2 min → End; confirm in order: both pages see `rtkStatesUpdate` `ended` after End (§10.3); `ea_rtk_events` rows for `meeting.started`, `recording.statusUpdate` × N, `meeting.ended`, `meeting.transcript`, `meeting.summary`; the Stream copy shows in Stream → Videos; `recording_url` opens the `/watch` page; `ea_rtk_session_notes` returns the draft for the coordinator and `null` for the student.
8. **Billing alert.** Cloudflare Billing → notifications → $50/month, before the first real class.

---

## 12. Security

- **Token scope.** `CF_RTK_API_TOKEN` = Realtime + Realtime Admin only; lives only in function secrets; never returned to a page; never the Stream:Edit token. Participant tokens are the client credential and are issued per person, per request, only after the role check ([realtimekit](https://developers.cloudflare.com/realtime/realtimekit/)).
- **No secrets in pages.** `js/config.js` carries only the publishable key (as today). `rtk-room.js` holds no app id, no API token, no webhook id.
- **Identity.** `custom_participant_id` = `auth.users.id`, never email or phone ([concepts/participant](https://developers.cloudflare.com/realtime/realtimekit/concepts/participant/), [FAQ](https://developers.cloudflare.com/realtime/realtimekit/faq/)). Display name from `ea_profiles.display_name`; `can_edit_display_name` is false on every non-host preset.
- **Premium gate.** Unchanged: RLS on `ea_live` / `ea_opil_sessions` for reads, `ea-rtk-join`'s role check for tokens, the 409 `not_open` gate so non-hosts never create meetings or spend minutes early. `ea_live_upcoming` (definer view) is not altered, so none of the four server-only columns reach anon; the 0023/0028 grant ordering rule stands for any future view rebuild.
- **Server-only columns.** `rtk_meeting_id`, `mode`, `rtk_session_id` and `rtk_started_at` are trigger-locked against `authenticated`/`anon` (§9 block 2). `sess_fac_update` still lets a facilitator edit everything else on their sessions, as before.
- **Service-role tables.** `ea_rtk_participants`, `ea_rtk_events`, `ea_rtk_artifacts`: RLS on, no policies, explicit `revoke all` (Supabase default privileges grant ALL on new tables). Transcripts, summaries, chat exports and webhook payloads carry names and our user ids — member data; only `ea_rtk_session_notes` exposes any of it, to admins/coordinators/that session's facilitator.
- **Webhook.** RSA-SHA256 over the raw bytes; 401 on failure; `rtk-webhook-id` must match `CF_RTK_WEBHOOK_ID`; dedupe on `rtk-uuid`; the function only ever writes `{is_live: false, mode: 'stream'}` and replay/artifact columns, so a forged payload's blast radius is a false "off air" or a bad replay link — and the signature stops it.
- **PII in payloads.** `streamKey` (livestreaming events) redacted before persist. Participant events (phase 2) carry `userDisplayName` + `customParticipantId` (our uid, no email) — stay in service-role tables.
- **Preset allowlist** in `ea-rtk-join` and the `check` on `ea_rtk_participants.preset_name`: a typo can never hand out a dashboard default preset.
- **CORS** locked to `https://taylormadeacademy.com` on join/host; the webhook has no CORS surface.
- **Kick/ban** (v2, proposed — not yet approved): `POST $RTK/meetings/{meeting_id}/active-session/kick {custom_participant_ids: [uid]}` ([kick](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/active-session/methods/kick_participants/)); a ban is `DELETE $RTK/meetings/{meeting_id}/participants/{participant_id}` ([delete participant](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/delete_meeting_participant/)) plus deleting our `ea_rtk_participants` row so no new token is minted. In v1 a host kicks from the stock participant menu (`kick_participant: true` on both host presets).

---

## 13. Cost model

Rates verified 2026-09-10 against [RealtimeKit pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/) and [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/#audio-model-pricing):

| Item | Rate |
|---|---|
| Audio/Video participant (webinar **viewers included** — billed as A/V) | $0.002 / participant-minute |
| Audio-only participant | $0.0005 / participant-minute |
| Export (recording, RTMP or HLS out) | $0.010 / minute |
| Audio-only export | $0.003 / minute |
| Raw RTP into R2 | $0.0005 / minute |
| Live captions, Nova-3 WebSocket | $0.0092 / audio-minute per captioned participant (836.36 Neurons/min) |
| Post-meeting transcript, Whisper Large v3 Turbo | $0.0005 / audio-minute (46.63 Neurons/min) |
| Workers AI free allowance | 10,000 Neurons/day, then $0.011 per 1,000 (Workers Paid also includes the first 10k/day) |
| Free tier | none listed in the developer docs ([Realtime overview](https://developers.cloudflare.com/realtime/): "None"); the marketing calculator's "beta, free" is not in the docs — model as paid from day one |

Worked examples (60 minutes):
1. **OPIL class, 27 people, recorded**: 27 × 60 × $0.002 = **$3.24** room + 60 × $0.010 = **$0.60** recording = **$3.84**. Host-only captions (one mic): 50,181 Neurons − 10,000 free ≈ **$0.44** (≈ $0.99 with coordinator + facilitator both captioned; the free 10k assumes nothing else on the account burned Neurons that day). Post-meeting Whisper, worst case all 27 streams: 75.5k Neurons ≈ **$0.83** (whether only captioned participants are transcribed post-meeting is spike 11). Total ≈ **$4.30–5.70**.
2. **Academy webinar, Nelson + 50 members**: 51 × 60 × $0.002 = **$6.12** + $0.60 recording = **$6.72**; + $0.44 captions; Whisper on stage audio only ≈ $0.03 → ≈ **$7.20**.
3. **Academy, 200 watching**: 200 × 60 × $0.002 = **$24.00** + $0.60 = **$24.60 / hour**. This is the number that makes phase-2 overflow (HLS viewers on Stream at Stream's rates) worth building; until then, cap Academy room events at the cohort size Nelson is happy paying for.

Not in the room rate: the Stream copy (Stream storage and delivery bill on the existing Stream plan; those rates are in the live-streaming note, not this brief); the summary model (undocumented — spike 12; read the Workers AI usage after the first real session); whether recording + a phase-2 livestream export bill $0.010 once or twice (undocumented). Editing a preset in the dashboard can silently flip `transcription_enabled` on students — the §11.4 script re-asserts the five presets.

---

## 14. Testing

1. **Staging app + local functions.** Staging = the local stack and its two seeded users defined in §11 step 3 — once spike 19 (§15) has shown that `supabase db reset` applies `0001`–`0029` on a fresh local Postgres and the seed creates `host@test.local` / `student@test.local`; if it fails, staging is a second hosted Supabase project and every test below points at that ref instead. `supabase functions serve --env-file supabase/.env.staging` with `CF_RTK_APP_ID` = the staging app. Never against prod Supabase from a browser test (an E2E on a live page writes to prod — known gotcha).
2. **Harness page** `dev/rtk-harness/index.html` (excluded from `build_site.py`'s page list, served with `python3 -m http.server`): loads the core IIFE (`dist/browser.js` → `window.RealtimeKitClient`) plus the two UI-kit ESM modules, accepts a pasted participant token (from a curl against the staging app), calls `RealtimeKitClient.init` and mounts `<rtk-meeting>` with the §10.3 props. **Fake adapters**: a `window.__rtkJoin` stub returning `{token, preset, host}` so the page code path from `mountRoom` down runs without Supabase; a fake `ea-rtk-host` that resolves `{is_live:true, recording_id:'r1'}` so the host bar's DOM updates are testable with no Cloudflare call. This was spike 1's harness (closed 2026-09-10, §15); it stays for the open sub-items 1(c)–1(g).
3. **Playwright, two browsers** (`npx playwright test tests/rtk-room.spec.ts`): Chromium launched with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`; context A = host (`host@test.local`), context B = student (`student@test.local`), both signed in against the §11 staging stack. Sequence: before A presses anything, B's page shows the idle card and never calls `ea-rtk-join` while `is_live` is false (§10.3), so context B asserts the gate directly: `page.request.post(FUNCTIONS_BASE + '/ea-rtk-join', {headers: {Authorization: 'Bearer ' + studentJwt}, data: {room: 'opil', session_no: 1}})` → 409 `not_open`; A presses Start class → A's setup screen → Join → A reaches `rtkStatesUpdate` `joined` (the row still reads `is_live=false` at that instant) → A's page calls `ea-rtk-host start` → 200 with `mode:'meeting'` and the row reads `{is_live:true, mode:'meeting'}`; B reloads and reaches `joined`; from that point `page.on('framenavigated')` stays 0 on **both** contexts; A's End puts B in `ended` and the row reads `{is_live:false, mode:'stream'}`; `ea_rtk_participants` has exactly two rows; a second join for A returns a **different** token, same `participant_id`.
4. **Edge function unit tests** (`deno test -A supabase/functions/_shared/rtk_test.ts`): `createOrGetMeeting` race (mock the UPDATE returning 0 rows → expect the PATCH INACTIVE and the winner's id); preset allowlist; role resolution table from §4 with mocked RPC returns; the 409 `not_open` gate for non-hosts.
5. **Webhook replay.** Capture one real delivery per event from staging (the function logs the raw body + the three headers at debug level for the first 24 h) into `tests/fixtures/rtk-webhooks/*.json`; each capture is two files — `<event>.body.json` (the raw bytes, never re-serialised, because the signature is over them) and `<event>.headers.json` (`{"rtk-signature": "...", "rtk-uuid": "...", "rtk-webhook-id": "..."}`) — and the replay reads the headers from the fixture:
   ```bash
   E=tests/fixtures/rtk-webhooks/recording.statusUpdate.UPLOADED      # one pair per event
   curl -X POST http://127.0.0.1:54321/functions/v1/ea-rtk-webhook --data-binary @"$E.body.json" \
     -H "Content-Type: application/json" \
     -H "rtk-signature: $(jq -r '.["rtk-signature"]' "$E.headers.json")" \
     -H "rtk-uuid: $(jq -r '.["rtk-uuid"]' "$E.headers.json")" \
     -H "rtk-webhook-id: $(jq -r '.["rtk-webhook-id"]' "$E.headers.json")"
   ```
   against the local function (`supabase functions serve`, §11 step 3). Assert: tampered body → 401; same `rtk-uuid` twice → second is `duplicate`; `UPLOADED` with the Stream API mocked to 500 → 503 and `handled_at` null; mocked 200 → `recording_url` = the watch URL and `handled_at` set; a `meeting.transcript` alone → a `playbook` artifact whose Summary reads `pending`; the following `meeting.summary` → the same row (one `playbook` per `session_id`; when the fixture envelope carries no session id, one per `(room, ref)` via `ea_rtk_artifacts_room_ref_kind_idx`, §9 block 5) with the summary filled in.
6. **RLS attacks** (SQL, as `anon` and as a member): §9 checklist.
7. **Only Nelson can test:** iPhone Safari / Android Chrome join, camera flip, captions and the mobile control bar under the brand bar (spike 8); the Cloudflare dashboard steps (§11); whether `design_tokens.logo` renders; a real 27-person OPIL rehearsal for grid behaviour and the bill; the first real Stream copy (`/watch` appears in Stream → Videos); the Workers Paid plan status.

---

## 15. Spikes & unknowns

Each: the question, then the cheapest probe.

1. **Kit loads and joins from jsdelivr with no bundler — CLOSED (spike 1, 2026-09-10, passed).** (a) closed: the core loads as the IIFE `dist/browser.js` → `window.RealtimeKitClient`; `realtimekit@2.0.2/+esm` is dead because jsdelivr's ESM conversion of `sdp-transform@2.15.0` returns 404 and aborts the graph. (b) closed: `realtimekit-ui@2.0.2/loader/index.es2017.js` → `defineCustomElements()` and `dist/index.js` (exports `provideRtkDesignSystem`, `BreakoutRoomsManager`, `RtkUiBuilder`, `defaultConfig`, `defaultIconPack`, `extendConfig`, `registerAddons`) both load as ESM. Also learned: with `showSetupScreen = false` assigning `.meeting` joins on its own and a second `meeting.join()` throws `UnsupportedConcurrentMethodExecution`; `rtkStatesUpdate` detail is `{meeting, prefs, peerId}`; `meeting.self.{roomJoined, presetName, permissions.*}` and `meeting.participants.joined` (`Map`) are as §10.3 lists; the default `group_call_*` presets grant everything (§4). **Still open**, kept under this number: (c) which of `mode`/`size`/`gridLayout`/`config` must be set and with what values (the element mounted and joined with only `showSetupScreen` + `.meeting`); (d) `provideRtkDesignSystem` on `#rtk-root` vs `loadConfigFromPreset` colours — who wins; (e) `applyDesignSystem=false` behaves as expected; (f) `ui.design_tokens.logo` renders in `rtk-logo`; (g) how `<rtk-meeting>` `config`/`overrides` hides the stock `rtk-recording-toggle` (§10.6). **(c) and (g) are pre-build gates; (d)–(f) are not** (§16). For (c), read the [rtk-meeting API reference](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-meeting/) during the plan. Probe for (c)–(g): the §14.2 harness with one real staging token; 1 hour.
2. **Participant token lifetime**, and whether `POST $RTK/meetings/{meeting_id}/participants/{participant_id}/token` invalidates the previous token (two open tabs). Probe: mint, wait 1/6/24 h, join; mint twice, join with the first.
3. **Overflow into the existing Stream input** (phase 2): does `rtmp_out_config.rtmp_url` on Start Recording / `recording_config.live_streaming_config.rtmp_url` on Create Meeting accept `rtmps://live.cloudflare.com:443/live/<key>` and light the existing Stream live input `56eb439b0d4b1aee58f2b60a1dcbfec9` with HLS + Stream auto-record; is the composite file still produced; which status reflects the push. Probe: one test meeting, 1 hour. (The built-in `POST /meetings/{id}/livestreams` provisions its **own** Stream input and cannot take ours — [start livestream](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/livestreams/methods/start_livestreaming_a_meeting/).)
4. **Judge rendering.** How a no-media `GROUP_CALL` participant looks in the class (empty tile vs hidden), and whether a WEBINAR-view judge preset inside the GROUP_CALL room is nicer (mixed views are documented). Probe: staging room with one judge token.
5. **Meeting size cap.** None documented; the only number is the core's grid paging of 100 per page ([web-core release notes](https://developers.cloudflare.com/realtime/realtimekit/release-notes/web-core/)). Probe: N headless viewers (60/120/250) in a WEBINAR meeting and 30 cameras in a GROUP_CALL; read `minutes_consumed` from active-session. Do not promise Jamal or a sponsor a room size before this.
6. **`PATCH $RTK/meetings/{meeting_id}/participants/{participant_id} {preset_name}`** — does an already-joined peer pick up the new preset, need a refreshed token, or need leave/rejoin? Probe: promote a joined student.
7. **Session splits.** With `session_keep_alive_time_in_secs = 120` (max 600) and the recording's 60 s empty-room stop, does a host reconnect inside the window keep the same session **and** recording? Probe: kill the host's network for 90 s. The webhook already tolerates several recordings per meeting (§7).
8. **Phones.** iOS Safari 16/17/18 and Android Chrome: join, camera flip, captions, chat compose, whether screen share is hidden or errors (`1105`), and the mobile control bar under our brand bar. Only Nelson's devices.
9. **Hand-raise UX in the stock UI.** Does `<rtk-meeting>` show the member a "Raise hand" and give Nelson a queue (`rtk-participants-stage-queue`) without our bar? Probe: harness with a member + a host token.
10. **Webhooks.** (a) does `meeting.started` fire when a bot/recorder joins before any human; (b) retry count/backoff for 5xx (return 503 from staging and watch); (c) the exact envelope for each event (capture one of each — §14.5). The `.well-known/webhooks.json` shape is documented (`data.publicKey`, §6.1) and is not a spike.
11. **Post-meeting transcript scope.** With `transcribe_on_end` but `transcription_enabled` only on hosts, are all participants transcribed post-meeting (Whisper cost ×27) or only the enabled ones; does silence bill. Probe: Workers AI usage after one staging class with 3 students.
12. **Summary model and cost.** Undocumented; read the Workers AI dashboard after the first real session.
13. **Stream copy-by-URL** accepts the long presigned RealtimeKit `downloadUrl`; how long processing takes for a 1 h 720p file; `result.uid` is the field. Probe: §11.7.
14. **`disableAllAudio(true)`** — the boolean's meaning is not documented (the brief called it `allowUnmute`). Probe: call both forms in staging and see whether students can unmute.
15. **`GET /webhooks` vs `/webhooks/all`** — which exists. Probe: §11.5. Same probe for **`GET $RTK/presets`** (list): no API page was found for it (`presets/methods/list`, `get_presets`, `get_all_presets`, `get_all` all 404 on 2026-09-10; only [create](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/presets/methods/create/), [update](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/presets/methods/update/) and [fetch by id](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/presets/methods/get_preset_by_id/) were found) — one curl; the runbook does not depend on it (§11.2, §11.4).
16. **Start Recording before the first participant joins** — accepted, queued, or 4xx. Probe: `POST /recordings` on an empty meeting.
17. **`EdgeRuntime.waitUntil` on Supabase's runtime** — does a fetch started after the response completes? Probe: a throwaway function that returns 200 then writes a row 5 s later. Until proven, the webhook works inline.
18. **What storage does a client-started recording use?** A recording started from the stock `rtk-recording-toggle` carries none of the §5.3 body (`realtimekit_bucket_config`, `file_name_prefix`); the docs do not say whether it lands in RealtimeKit's bucket, the dashboard storage config, or nowhere. Probe: press the toggle once in staging, read `recording.statusUpdate` and `GET /recordings/{id}`. Until answered the host bar is the only recording control (§10.6).
19. **The local Supabase stack — UNVERIFIED (pre-build gate).** No `supabase/config.toml` or `supabase/seed.sql` exists, and the migrations have only ever been run in the SQL editor. Probe: `supabase init` + `supabase start` + `supabase db reset` applies `0001`–`0029` in order on a fresh local Postgres, and a `seed.sql` creates `host@test.local` (`profiles.role = 'admin'`, a row in `ea_opil_admins`) and `student@test.local` (approved registration + a row in `ea_opil_team_members`); §11 step 3 has the full seed. If any migration fails locally, staging becomes a second hosted Supabase project instead (§11 step 3, §14.1). Half a day.

Refuted brief claims that must **not** come back as facts: `recording_config.storage_config {type:"cloudflare"}` on Create Meeting; member preset `audio/video ALLOWED`; kick-all stops recordings; `meeting.stage.getAccessRequests()`; "mixing view types is undocumented"; "Add Participant forbids email" (wrong page); `rtk-ui-provider` "must contain" three children (overstated; unused in v1); "plugins are no longer iframes" cited to the component page (release-notes fact, irrelevant here); the brief's `profiles.display_name`, `ea_opil_my_role() in ('admin','coordinator','facilitator')`, `approved`-based student check, `verify_jwt ON`, and migration number `0024`.

---

## 16. Phasing

**v1 — rooms + recording → replay + transcript/summary draft.**
- `0029` migration; `_shared/rtk.ts`; `ea-rtk-join`; `ea-rtk-host` (start / end_session / start_recording / stop_recording / status); `ea-rtk-webhook` (meeting.ended → `{is_live:false, mode:'stream'}`, recording.statusUpdate → Stream copy, meeting.transcript, meeting.summary → playbook draft; the rest audited).
- `js/rtk-room.js`, `css/rtk-room.css`; both pages gain `#rtk-root`, the mode switch, the one Start class / Start webinar button (join → `start` on `joined`), the host bar (End, Mute all, REC, headcount), the OPIL dock rule; `build_site.py` + `sw.js` bumps.
- Five presets, webhook, secrets (§11).
- Coordinator/admin "Session notes (AI draft)" panel via `ea_rtk_session_notes` — read-only (playbook draft, summary, transcript, recordings).
- Spikes **before build**, exactly as approved (§2.6): (1) kit loads from jsdelivr with a real token in a harness against a staging app — **closed 2026-09-10, passed, for loading and joining** (§15). Two of its open sub-items **are pre-build gates**: **1(c)** the `<rtk-meeting>` required props and their legal values (read https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/core/rtk-meeting/ during the plan, then confirm in the harness) and **1(g)** hiding the stock `rtk-recording-toggle` via `<rtk-meeting>` `config`/`overrides` (§10.6). 1(d)/(e)/(f) (design-system precedence, `applyDesignSystem=false`, the logo) are **not** gates — polish, measured in the same harness whenever convenient; (2) token lifetime; (3) `rtmp_out_config` — phase 2; (4) judge no-media rendering; (5) meeting size cap. The pre-build gates are therefore **1(c), 1(g), 2, 4, 5 and 19** (19 = the local Supabase stack actually applies `0001`–`0029` and seeds the two test users, or staging becomes a second hosted project — §11 step 3, §14.1); 3 is v2. Also closed before the first real class: 6, 9, 10, 13, 14, 15, 16, 18 (6 gates the join path's `PATCH` preset step, 14 gates the Mute-all button, 18 gates the stock recording toggle); measured during the first rehearsal: 7, 8, 11, 12 (7 = session/recording split on a host reconnect); 17 stays deferred — the webhook works inline until it is answered.
- Broadcast mode untouched.

**v2 — after two real sessions.**
- Overflow: `rtmp_out_config` into the existing Stream input behind a host switch (spike 3), or the built-in livestream with `playback_url` → `ea_live.stream_url` for HLS viewers; the two livestream status vocabularies handled separately. `can_livestream` is `false` on all five v1 presets and flips to `true` on the two host presets with spike 3.
- Captions for students as an opt-in per session (cost shown to the host before enabling) — the decision's "hosts only by default" allows this; the opt-in itself is **proposed — not yet approved**.
- Breakout presets polish (student `can_switch_*` tuning; judge observation flow).
- `retry_replay` / `summarize` host actions (recovery paths for the v1 recording and summary; §7, §8).
- Playbook Timeline section (5-minute buckets from the JSON transcript with `?t=<seconds>` links into the Stream `/watch` page) — **proposed — not yet approved**.
- Attendance from `meeting.participantJoined/Left` + `GET /sessions/{id}/participants` ([session participants](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/sessions/methods/get_session_participants/)) as a **suggestion** in the coordinator's click-to-mark attendance, never an auto-mark; chat export via `meeting.chatSynced` — **proposed — not yet approved**.
- Nightly reconcile: `GET /sessions?associated_id=<meeting>` ([get sessions](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/sessions/methods/get_sessions/): `associated_id` — "ID of the meeting that sessions should be associated with") against `ea_rtk_artifacts` to pull anything a missed webhook left inside the 7-day window — **proposed — not yet approved**.
- Kick/ban from our host bar (§12) — **proposed — not yet approved**; the stock participant-menu kick works in v1.

---

## 17. Open questions for Nelson

1. **Ticket holders and public rooms on Academy rooms.** `0027` lets a valid ticket holder (`ea_has_ticket(event_id)`) read an event-linked `ea_live` row and its chat on `/agent/live/`, but §2.2 admits only `ea_is_member()` to the webinar room, and v1 keeps `ea_live.access = 'public'` rows broadcast-only (§5.2: the Start webinar button is disabled on public rows). Two halves: (a) should `ea-rtk-join` also accept `ea_has_ticket(row.event_id)` → `tma-webinar-member`? (Recommended yes; one extra RPC call, and it matches the RLS that already lets them watch a broadcast.) (b) Should a public row ever open in room mode — for ticket holders only, or for anyone signed in? Until answered, public = broadcast.
2. **Judges hidden?** `hidden_participant: true` on `opil-judge` so students do not see judges in the roster — Jamal's call.
3. **Student DMs.** `opil-student` allows private text chat; keep, or public-only?
4. **Waiting room.** All presets use `waiting_room_type: SKIP` because cohort membership is the gate. Should the coordinator admit students by hand instead?
5. **Co-teaching facilitators.** A facilitator not listed on `session_nos[]` for a session, and not on a team, gets 403 today. Should they be `opil-student` for other sessions, `opil-host`, or stay out? (`ea_opil_facilitators.session_nos[]` is Jamal's list.)
6. **Workers plan.** Confirm the account is on Workers Paid: one hour of host captions ≈ 50k Neurons and the free plan stops at 10k/day, so captions would die mid-class.
7. **Replay gate.** Replays stay Stream `/watch` pages behind the same RLS-only gate as today's broadcast recordings (the URL itself is not signed). Acceptable as before, or should v2 sign playback?
8. **Room type.** The design-token `font_family` takes one family (§2.5). The spec uses Inter inside the room and keeps Space Grotesk on the page chrome around it. Nod, or put Space Grotesk in the token (headings and controls inside the room would then all be Space Grotesk)?
9. **Publish playbook.** Should v2 add a one-click "publish playbook" that turns the reviewed draft into a hosted page and fills `ea_opil_sessions.playbook_url` (the link column that exists today, `0013:53`, edited by hand on the coordinator page — §8)? `ea_live` has no equivalent field.

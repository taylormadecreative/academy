# OPIL automatic replays — design

**Date:** 2026-09-14 · **Status:** approved in chat ("these are supposed to record so the students can see") · **Builds on:** `2026-09-10-realtimekit-live-rooms-design.md` §3 (recording decisions), `2026-09-14-opil-parallel-live-rooms-design.md` · **Deadline:** OPIL orientation Wed 2026-09-16.

## The ask

- Nelson: every class records **without pressing anything**; the replay is there for students.
- Jamal (on the 9/14 call): the replay must **not** go to students automatically — the program team
  reviews (and trims if needed) first, then releases it. A publish switch, not a password.

## What happens

1. **Start class** → the page asks the server to start a RealtimeKit recording of that meeting.
   If that fails the class still runs; the control says the replay could not be started.
2. **Host leaves / ends the meeting** → the page asks the server to stop the recording, then ends
   the session (already shipped: leave = end).
3. RealtimeKit uploads the file and calls our webhook (`recording.statusUpdate`). On `UPLOADED`
   the webhook copies the file into Cloudflare Stream (`POST /stream/copy`, the token
   `ea-live-publish` already uses) and stores the Stream watch URL as a **draft** on that session.
4. **Coordinator page** (`/opil/hub/admin/`), per session: *Recording…* → *Processing…* →
   **Replay ready — Review** (opens the Stream watch page) + **Publish to students** switch →
   *Published ✓* (switch back = unpublish). Facilitators see this for their own sessions.
5. **Publish** writes the watch URL into `ea_opil_sessions.recording_url` — the column hub home
   already shows as "Recording" under the session — so students see it only from that moment.
   Unpublish clears it. Nothing else on the student side changes.

Trim: the Stream watch page is the review surface; trimming for v1 is done in the Cloudflare
Stream dashboard (clip) and the coordinator pastes nothing — the same Stream asset is served.
In-app trim is a follow-up.

## Data — migration `0033_opil_replays.sql`

```
ea_opil_replays
  id uuid pk, session_no int → ea_opil_sessions(no), meeting_id text, recording_id text unique,
  status text check in ('invoked','recording','uploading','uploaded','ready','error'),
  download_url text, download_expires_at timestamptz, stream_uid text, watch_url text,
  duration_s int, file_size bigint, error text, published boolean default false,
  created_at, updated_at
ea_rtk_events
  id text pk (recording_id + ':' + status, or event name + meeting id + endedAt), event text,
  payload jsonb, received_at   — dedupe for webhook retries; service role only
```
- RLS: `ea_opil_replays` SELECT for `ea_opil_is_program_team(auth.uid())` (0029); no client
  INSERT/UPDATE/DELETE policies — the edge functions write with the service role.
- `ea_opil_publish_replay(p_session int, p_publish boolean) returns jsonb` — security definer;
  caller must be admin or a facilitator of that session (`ea_opil_fac_sessions`); on publish sets
  the latest ready replay `published=true` and `ea_opil_sessions.recording_url = watch_url`; on
  unpublish sets `published=false` and clears `recording_url` only if it still equals that URL.
  Execute granted to `authenticated`, revoked from `anon`.
- Students' `sess_read` is untouched; they never see `ea_opil_replays`.

## Edge functions (Deno, `verify_jwt` off, own auth like `ea-rtk-join`)

**`ea-rtk-record`** — `POST { session_no, action }`, caller's bearer → user → role as the caller.
- `start` (host of that session): meeting id = the session's `stream_url` after `rtk:`;
  if a replay row for that meeting is already `invoked|recording`, return it (idempotent —
  a reload does not start a second recording). Else `POST /recordings { meeting_id }`, insert
  the row (`invoked`), return `{ recording_id, status }`.
- `stop` (host): latest `invoked|recording` row for the meeting → `PUT /recordings/{id}
  { action: 'stop' }` → status stays as the webhook reports it; returns `{ stopped: true }`.
  No row → `{ stopped: false }` (nothing was recording), still 200.
- `register_webhook` (admin only, one-time): `POST /webhooks { name, url: <SUPABASE_URL>/
  functions/v1/ea-rtk-webhook, events: ['recording.statusUpdate','meeting.ended'], enabled }`.
  `list_webhooks` (admin) for checking. Never returns tokens.

**`ea-rtk-webhook`** — `POST` from RealtimeKit only.
- Verify `rtk-signature` (RSASSA-PKCS1-v1_5 / SHA-256) against the public key from
  `https://api.realtime.cloudflare.com/.well-known/webhooks.json` (cached in memory). Bad or
  missing signature → 401. No CORS (no browser calls it).
- Dedupe: insert into `ea_rtk_events`; a duplicate id → 200 and stop.
- `recording.statusUpdate`: find the session by `meeting_id` (`stream_url = 'rtk:' + meetingId`);
  upsert the replay row by `recording_id`; map status (`RECORDING→recording`,
  `UPLOADING→uploading`, `UPLOADED→uploaded`, `ERRORED→error`). On `UPLOADED`: Stream copy
  → `stream_uid`, `watch_url = https://customer-<CF_STREAM_SUBDOMAIN>.cloudflarestream.com/<uid>/watch`,
  status `ready`. A Stream failure → status `error` with the message; the download URL is kept
  (valid ~7 days) so it can be retried by re-sending the event.
- `meeting.ended`: recorded in `ea_rtk_events` only (no effect in v1).
- Always 200 after a verified event, even on handler errors (logged in the row's `error`), so
  RealtimeKit does not retry forever.

## Pages

- `opil/hub/live/index.html`: after `flipLive(on)` in Start class → `record('start')`; in
  `onLeft` (host) → `record('stop')` before `flipLive(off)`. Copy: "Recording" chip in the
  control while a recording is invoked/recording; "Replay could not start — the class is still
  on" on failure.
- `opil/hub/admin/index.html`: per session row, a replay line from `ea_opil_replays` (latest
  row): status text, **Review** link (watch_url), **Publish to students** / **Unpublish** button
  calling `ea_opil_publish_replay`. Polls every 20 s while any replay is `invoked|recording|
  uploading|uploaded`. The tour gets one line.
- `js/rtk-room.js`: unchanged.

## Out of scope
In-app trim; transcript attached to the replay; Academy `/live/` recordings (same functions will
serve it later — `session_no` becomes a room ref); recording layout choices; per-track recording.

## Testing
1. **`deno test`** for `ea-rtk-webhook`'s handler with a generated RSA keypair, stubbed `fetch`
   and a stubbed store: signature accept/reject, dedupe, status mapping, UPLOADED → Stream copy
   → ready, Stream failure → error, unknown meeting → 200 no-op.
2. **`deno test`** for `ea-rtk-record`'s handler with stubbed deps: host gate, idempotent start,
   stop with/without an active row, admin-only webhook registration.
3. **Browser harness** (existing scratchpad, stubbed `fetch` to FUNCTIONS_BASE): Start class calls
   start; host leave calls stop then flips off; coordinator page renders each replay state and
   Publish calls the RPC.
4. **Production, one real run** on a spare session: apply 0033, deploy both functions, register
   the webhook, Start class on session 02 alone, wait ~1 min, Leave, wait for `ready`, Review,
   Publish, confirm hub home shows the Recording link, Unpublish. Delete the test Stream asset.

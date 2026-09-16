# Class features — the ten (+1) that make the room a program

**Date:** 2026-09-16 · **Status:** approved in chat ("add all these functions and make them great they will be added to other classes in taylormade academy once this one is done") · **Owner:** Nelson (non-technical; plain English everywhere) · **First class:** tonight 6:30 PM ET — **nothing here ships to the live room page between 4:30 PM CT and the end of that class.**

## Why one design
Every feature below is built as a **class plugin**: one module file, one migration, one test file, talking to the room only through a fixed contract (`ctx`, below). The room host (`js/rtk-room-v2.js`) loads the plugin list, hands each plugin the same `ctx`, and owns the tabs, bar, stage, sheet and channels. That is what makes the same code light up the OPIL room today and the Academy `/room/` and HT `/ht/hub/live/` rooms tomorrow: a plugin never queries the room's DOM and never knows which program it is in — it knows a **room key**.

## Room key
`roomKey` is a string that names the class in every table and channel:
- `opil:<session no>` — an OPIL session (tonight: `opil:1`)
- `room:<uuid>` — an Academy / HT room (`ea_rooms.id`)
- `team:<uuid>` — a team's standing room (`ea_opil_teams.id`, feature 3)

Generic tables are keyed by `room_key text` and guarded by two definer functions (migration **0042_class_core.sql**, written by the integrator before any plugin):
- `ea_class_can(p_key text) → boolean` — may this person read/take part? `opil:` → `ea_opil_in_cohort() or ea_opil_is_program_team(auth.uid())`; `room:` → any signed-in person (the rooms' rule: signed in = in); `team:` → a member of that team (`ea_opil_team_members`) or the program team.
- `ea_class_is_host(p_key text) → boolean` — `opil:N` → `ea_opil_is_session_host(N)`; `room:` → `ea_is_admin()` or the caller's email in `ea_rooms.host_emails`; `team:` → program team.
- `ea_class_events (id uuid pk, room_key text, at timestamptz default now(), kind text, label text, data jsonb, user_id uuid default auth.uid())` — the class's timeline (chapters, activity). Insert: `ea_class_can(room_key)`; read: same. Index (room_key, at). In realtime.
- `ea_class_room_of(p_key text) → jsonb` — `{kind, title, starts_at, ends_at, facilitator}` for a key (used by plugins that need the class's own facts; opil reads `ea_opil_sessions`).

## The plugin contract (`ctx`) — implemented by the integrator in `js/rtk-room-v2.js`
A plugin is an ES module at `js/rtk-<name>.js` exporting `create(ctx) → plugin`. **Top level must be import-safe in Node** (no `document`/`window` at import time) so `node --test` can import its pure helpers. It may also export pure helpers for tests.

```js
ctx = {
  sb, copy, el, esc,                 // supabase client; opil/hub/live-rooms.js; el(html)→Element; esc(s)
  user, uid, host, isRoom,           // who am I; host = runs this class; isRoom = Academy/HT room (not OPIL)
  roomKey, words, facilitator,       // 'opil:2'; the room's nouns (words.thing/one/many/host); facilitator name or null
  session,                           // OPIL: { no, title, session_date, start_time, end_time, kind } | null
  target,                            // rooms: the target object (id, slug, title …) | null
  getMeeting(), rootId,              // the live RealtimeKit meeting (changes in a small group); the main room's id
  inSmallGroup(),                    // true inside a breakout
  toast(msg, ms), openSheet(title, node), closeSheet(), confirmInline(btn, label),   // room UI
  panel: { addTab(name, label) → { pane, count, show() } },   // a tab + pane in the side panel (pane is an empty div)
  bar:   { addButton(html) → Element, primary: Element },     // a button in the bar's right group; the big centre slot
  stage: { overlay(className) → Element },                     // an absolutely positioned layer over the video (hidden by default)
  channel(name) → { on(cb), send(payload), stop() },           // broadcast on `<name>-<roomKey>`; payload.from is set by send;
                                                               // cb(payload, { fromHost }) — fromHost is true only for a remembered host
  events: { log(kind, label, data) → Promise, list() → Promise<rows> },   // ea_class_events for this room
  on(event, cb),                     // 'bind' (meeting changed: small group in/out), 'joined', 'left', 'ended', 'recording' (bool)
  now(),                             // Date.now() (injectable in tests)
}
plugin = { start(), stop(), onBind?(meeting) }   // start after the room is bound; stop on destroy; onBind on every re-bind
```
Rules every plugin follows: words over icons, every state a sentence, targets ≥ 48 px, one gold action per surface, navy/gold tokens from `css/rtk-room-v2.css` (`.r2-btn`, `.r2-mini`, `.r2-mini.r2-bring` = gold, `.r2-cta`, `.r2-empty`, `.r2-hand`, `.r2-who`, `.r2-fine`, `.r2-toast`), never print computer text in a toast (console.warn it, say a sentence), never set `display` on a kit element, phone ≤ 720 px works. A plugin's CSS lives in `css/rtk-<name>.css` and the module injects `<link>` once with its own `?v=` (`new URL(import.meta.url).search`). A plugin must not break the room if it throws: `create` is wrapped by the host, but `start` must catch its own failures.

## The features

### 1. Attendance that takes itself — `js/rtk-presence.js` · 0043
Room writes presence; Jamal reads it. RPC `ea_class_presence_beat(p_key text, p_state text)` (definer): upserts `ea_class_presence (room_key, user_id, first_seen, last_seen, seconds int, waited_s int, state)` one row per person per room; adds `least(90, now - last_seen)` seconds to `seconds` (state 'in') or `waited_s` (state 'waiting'); called on join, every 30 s, on leave/hide. The waiting screen beats too (state 'waiting'). Read: `ea_class_can` for own row; program team for all. Coordinator page: per session "Attendance" line under the replay line → a table (name, school, team, in at, out at, minutes, waited) + **Export CSV** (Nelson's CSV guard: signed numbers are fine, see gotcha). `ea_opil_attendance` (the check-in code) is also written automatically for anyone with ≥ 10 minutes (so existing reports keep working). Honest limit: a tab left open counts as present; the export shows "last seen" so a coordinator can judge.

### 2. A replay that's a lesson — `js/rtk-chapters.js` + `supabase/functions/ea-class-summary` + `opil/hub/replay/index.html` · 0044
The host page logs the timeline to `ea_class_events`: `stage` (someone brought on stage), `file` (shown to class), `groups_start`/`groups_end`, `poll`, `board`. The host page also saves the transcript: RPC `ea_class_transcript_add(p_key, p_lines jsonb)` (host only) into `ea_class_transcripts (room_key, id text, at, speaker_id, speaker_name, text)` — final lines only, deduped by id, batched every 20 s. Replay page `/opil/hub/replay/?s=N`: the Cloudflare Stream player (`https://customer-nimm2h959enrq4x1.cloudflarestream.com/<uid>/iframe` + `https://embed.cloudflarestream.com/embed/sdk.latest.js` for seeking) with **Chapters** (offset = event.at − replay.created_at, one row per event, click seeks), **Summary** (5 lines), **What was assigned**, **Files** (the session's materials), **Transcript** (searchable). Summary comes from edge function `ea-class-summary` (service role; POST `{ room_key }` by an admin/facilitator; reads transcript + events; calls Anthropic `claude-sonnet-5` when `ANTHROPIC_API_KEY` is set, else OpenAI when `OPENAI_API_KEY` is set (model from `SUMMARY_MODEL`, default `gpt-5-mini`), else returns `no_key` and the page says "Summary not set up yet"); writes `ea_class_summaries (room_key, summary, assignments jsonb, chapters jsonb, model, created_at)`. The coordinator's **Publish** button also calls it; a **Make summary** button retries. Hub home's session row links "Replay" to the replay page once published. Honest limit: chapter offsets are ± a few seconds.

### 3. Team rooms that persist — `ea-rtk-join` team branch + `opil/hub/team/room/index.html` · 0045
`ea_opil_teams` gets `meeting_id text`, `room_open_since timestamptz`. `ea-rtk-join` body `{ team: <uuid> }`: caller must be a member (or program team); first person mints the meeting (`POST /meetings`, title "Team <name>"), stores it; everyone gets preset `opil-student` (every tool). The page mounts `mountRoomV2` with `target: { kind: 'team', id, title: 'Team <name>', words: TEAM_WORDS }` — no host, no recording, no question line (hands off), Files scoped to `team:<id>` (materials rows with `room_key` — 0045 adds `room_key text` to `ea_opil_materials`; Files plugin filters by `room_key` when present, else `session_no`), Chat via the kit, Whiteboard (7). Team page gets a gold **Open team room** with "N teammates in the room now" (presence). Honest limit: a team room is not recorded and not transcribed.

### 4. Judge scoring + leaderboard — `js/rtk-scoring.js` · 0046
Rubric per session: `ea_opil_sessions.rubric jsonb` (default: Problem 1–5, Solution 1–5, Open-payments use 1–5, Business model 1–5, Delivery 1–5) editable on the coordinator page. Host: **Now presenting** — a Tools pane listing teams (from the roster) → sets `ea_opil_sessions.presenting_team uuid` (fac/admin update policy exists) and broadcasts `stage`. Judges (and admin): a **Score** tab appears with the presenting team's name, rubric rows (1–5 taps, ≥ 48 px), a comment, **Save score** (upsert `ea_class_scores (room_key, team_id, judge_id, scores jsonb, comment, total numeric)` unique (room_key, team_id, judge_id); judge writes own). **Leaderboard** tab for judges + admin: avg total per team, count of judges, live (realtime on scores). Coordinator page: per session **Scores** → table + Export CSV. Students never see scores. Honest limit: judges score from the main room; if the presenting team is in a breakout, the host brings them back first.

### 5. Need help outside class — hub button + `supabase/functions/ea-class-help-ping` · 0047
Hub home and team page: gold **Need help with something?** → a sheet: which track (Business / Open payments / HPC / The hub itself), one paragraph, **Send** → `ea_class_help (id, user_id, track, text, status 'open'|'claimed'|'answered'|'closed', claimed_by, answer, created_at, updated_at)` (insert own; read own; program team read/update all). `ea-class-help-ping` (called by the page after insert; verifies the row) emails the facilitators for that track (`ea_opil_facilitators` by label keyword; HPC → Ashley; hub → Nelson + Jamal) via Resend with the text and a link to the coordinator page. Coordinator page: **Help requests** section — claim, answer (text; emails the student), close; "Start a quick room" = link to the student's team room (3). Student sees the answer on hub home ("Casey answered your question"). Realtime on the table.

### 6. Reactions + live pulse — `js/rtk-reactions.js` (no table)
Bar button **React** → tray: 👍 Got it · 🙋 Confused · 🐢 Slower · 🐇 Faster · 👏 · ❤️. Sends `react` on `channel('react')`. Everyone: the emoji floats up over the stage for 2 s (reduced-motion: fades). Host: a **Pulse** strip under the Now line — counts per kind over a rolling 60 s ("6 confused · 3 slower"), red when confused ≥ 25% of people in the room; tapping it resets. Rate limit: 1 per person per 2 s (client side; the channel is host-verified only for host payloads — reactions are from anyone by design). Portable to every room.

### 7. Whiteboard — `js/rtk-board.js` · 0048
Tools → **Whiteboard** (anyone; the host can lock it). A stage overlay canvas: pen (3 widths, 5 colors), text, sticky note, rectangle/arrow, image (from Files or upload), select/move, undo (own ops), clear (host, two-tap). Ops are JSON (`{id, kind, points|text|rect, color, w, by}`); each op is broadcast on `channel('board')` AND inserted into `ea_class_board_ops (room_key, board_id text, seq bigserial, user_id, op jsonb, at)` so late joiners load the board and the board survives a reload. `board_id` = 'main' or the small-group meeting id (a board per breakout). **Save to Files**: renders the canvas to PNG and uploads it as a material (Files plugin's storage path) titled "Whiteboard <time>". Close hides it for me; **Close for everyone** (host). Honest limit: no infinite canvas — one screen, scrolls on phones.

### 8. Warm-ups on the waiting screen — `js/rtk-warmup.js` · 0049
`ea_opil_sessions.warmup_q text` (coordinator page + a field in the room control for the host: "Question of the day"). Waiting screen (the getting-in screen before the class exists): **Question of the day** card with a one-line answer (`ea_class_warmups (room_key, user_id, answer, city, created_at)` unique (room_key, user_id); read: `ea_class_can`), **Where are you joining from?** (a text field, "Atlanta, GA") → a line of cities under the card ("Joining from Atlanta · Tallahassee · Dallas…"), and **Already here** — teammates and classmates whose presence row says waiting/in (names). When the class starts the host's Questions tab shows a **Warm-up answers** section (name + answer) to read out. Honest limit: no map — a list of places.

### 9. Calendar + reminders — `supabase/functions/ea-opil-calendar` + `ea-opil-remind` + pg_cron · 0050
`ea-opil-calendar` (GET, public, `text/calendar`, cache 10 min): every non-milestone session with a time (0039) as a VEVENT in America/New_York, title "OPIL · <label> · <title>", location = the room link, plus milestones as all-day. Hub home: **Add to calendar** → Google (opens the subscribe-by-URL), Apple / Outlook (`webcal://…`), and "Download .ics". Reminders: pg_cron every 5 min → `net.http_post` to `ea-opil-remind` (secret header) → for any session starting in 25–35 min not yet reminded (`ea_class_reminders (room_key, kind, sent_at)`) email every approved registration + the facilitators via Resend batch: "Class starts at 6:30 PM ET — here's your link", the room link, "no code needed — type the email you applied with". Honest limit: email only; SMS would need a Twilio account.

### 10. Showcase page per team — `opil/showcase/team/index.html` · 0051
`ea_opil_teams` gets `slug text unique`, `tagline`, `project text`, `prototype_url`, `video_url`, `cover_path`, `published boolean default false`. Team page (members) edits these + a **Publish our page** switch (two-tap; the coordinator can also publish/unpublish). Public page `/opil/showcase/team/?t=<slug>`: anon-readable view `ea_opil_showcase_team (slug, name, school, tagline, project, prototype_url, video_url, cover_url, members jsonb [display names only], files jsonb [published materials with room_key team:<id>])` where `published`. Shows: team name + school, tagline, the project, the prototype link, the video (YouTube/Stream embed or a link), photos/files, members. The `/opil/showcase/` index links every published team. Honest limit: the pitch video is a URL the team pastes (clipping from a replay is a later feature).

### 11. Profile cards in People — `js/rtk-roster.js` · (0043 adds `ea_opil_roster_cards()`)
People pane: above the kit's list, **Class roster**: everyone in the room now (from the meeting), each tappable → a card: name, school, team, what they're building (registration `project` first line), "Ask a question" count is not shown. RPC `ea_opil_roster_cards()` (cohort/program team) returns (user_id, name, school, team, blurb). Students may hide their card (`ea_profiles.hide_card`). Portable: for rooms the card is name + bio from `ea_profiles`.

## Migrations
0042 core (integrator) · 0043 presence + roster · 0044 chapters/transcripts/summaries · 0045 team rooms + materials.room_key · 0046 scoring · 0047 help · 0048 board · 0049 warmups · 0050 calendar/reminders · 0051 showcase. Each is additive, idempotent (`if not exists`, `drop policy if exists`), RLS on every table, `revoke … from anon` on RPCs unless the spec says public. Applied by Nelson with staged `!` scripts (`apply-00NN.sh`).

## Testing
- `node --test tests/opil/<feature>.test.mjs` for every pure decision (copy, ordering, offsets, rubric math, ICS text, CSV rows, reaction windows, board op reduce/undo).
- The stubbed harness `tests/ht/harness/ht-room.mjs` stays green (148).
- Two-browser rigs on prod session 02 (`~/.cache/opil-rig/`): one per feature that has a live surface (presence, reactions, board, scoring, chapters/transcript save, warm-up).
- Deploy order after tonight's class: 6 reactions → 1 presence → 8 warm-ups → 11 roster → 9 calendar → 5 help → 4 scoring → 2 replay → 7 board → 3 team rooms → 10 showcase. Each: migration applied by Nelson, functions deployed, rig green, then push to main.

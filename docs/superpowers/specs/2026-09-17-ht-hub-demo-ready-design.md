# HT Hub — demo ready for Dr. Wallace: the OPIL class features in HT's room, and the hub that exists, made current

**Date:** 2026-09-17 · **Owner:** Nelson Taylor · **Status:** design, approved in chat 9/17 ("continue")
**Builds on:** `2026-09-15-ht-class-room-design.md` (HT's room = `ea_rooms` row `ht`), `2026-09-16-class-features-design.md` (the class plugin host and the ten features), `2026-09-03-ht-partnership-program-design.md` (the hub). This spec says only what is *different* or *new*.
**Brand:** `htu-brand-guidelines` — maroon `#660100`, gold `#FFCC00`; standing HT-page rules (no prices, no vendor names, never "avatar", sample stays labeled sample).

## 1. What Nelson asked for, and what was decided

> "get the hub as it is now demo ready … i want to ensure everything is working first and she can easily get into everything and also have all the new stuff i put in the opil academy classes"

No date is set for the demo; the hub must read as current on **any** day. The v2 UI concept set (`~/Downloads/HT-Hub-UI/`) is reference only — Nelson: "i'm not sure if i like that stuff." Nothing in the hub's frame, navigation or layout changes.

| Question | Decision (9/17) |
|---|---|
| Which OPIL class features come to HT? | Everything that fits a standing room with no cohort: **Files** (+ Whiteboard save), **the replay page** (chapters, summary, assigned, files, transcript), **warm-up question per room**, **Next session + Add to calendar**. Already live in the HT room via the shared plugin host and only need verifying: reactions + Pulse, warm-ups, roster cards, presence, chapters logging, Whiteboard, Small groups, captions, Transcript, open door, replays. |
| What stays OPIL-only? | Judge scoring, team rooms, showcase pages, private class channels, email reminders (all keyed to cohorts, teams or scheduled sessions HT does not have). Named as "next" nowhere on the page — simply absent. |
| Who hosts the demo? | **Nelson.** Dr. Wallace's email is added to `ea_rooms.host_emails` for `ht` **after** the demo so she can Start class herself. |
| How does she get in? | One link (`taylormadeacademy.com/ht/hub/`), sign in with email + 6-digit code, name once, in. The open door (0038) already admits any signed-in account while a class runs. `/login/` gains one HT line when reached from `/ht/`. |
| Content | Every dated sample item rolls forward; no relative weekday words; every sample date checked against HT's published 2026–27 calendar (`ht-hub-real-academic-calendar`); sample chips stay. |
| The dot-pills | `● TODAY` / `● LIVE` / `● On now` become typography — no capsule with a dot (`feedback_avoid_ai_tell_elements`). |

## 2. The room: what changes for `target.kind === 'room'`

### 2.1 Files (the Files tab, the Files button, the stage overlay, Whiteboard → Save to Files)
- **DB (migration 0054):** `ea_opil_materials` rows may carry `room_key = 'room:<uuid>'`. Read: `ea_class_can(room_key)` (signed in = in). Insert/update/delete: `ea_class_is_host(room_key)` (Nelson + the row's `host_emails`). The `opil-files` bucket policies gain the same `room:` branch (path prefix `room-<uuid>/`, same as the team prefix pattern `team-<uuid>/` from 0045). Session rows and team rows are untouched.
- **Client (`js/rtk-room-v2.js`):** the three `isRoom ? '' : …` gates on the Files tab, pane and button open for rooms; `createResources` is called with `roomKey: 'room:<id>'` (the team path already does exactly this). `js/rtk-board.js` Save to Files: when `ctx.isRoom`, insert with `room_key` instead of refusing. Copy: "everyone in the class" is right for HT.
- **Guests upload?** No — hosts only, as in OPIL sessions. A guest sees Files and can download and watch a file on stage.

### 2.2 The replay page — `/ht/hub/replay/`
- A page on the HT frame (`ht/hub/_shell.tpl` look: preview bar, HT head "Replay · The live room", the space tabs with Live current) with the OPIL replay grid: the player left, the lesson card right (Chapters · Summary · Assigned · Files · Transcript).
- Data by `room_key = 'room:<ea_rooms.id>'`: `ea_room_replays` (newest **published** row for guests; hosts see the newest ready row), `ea_class_events`, `ea_class_summaries`, `ea_class_transcripts` (transcript is gated exactly as OPIL: hosts and people who were in the room), `ea_opil_materials` by `room_key`.
- **Publish makes the summary:** `ht/hub/room.js` calls `ea-class-summary` with `{ room_key: 'room:<id>' }` after a successful `ea_room_publish_replay(…, true)` — the function already resolves `room:` keys to `ea_room_replays`. The page's "Make summary" button (hosts) retries.
- The HT Live space's **Last session** card links to the replay page ("Chapters, summary and transcript →"). The replay page is `noindex`, not in the sitemap, and reads the room id from `ea_room_state(null, 'ht')` like the Live space (no `?s=`).

### 2.3 Warm-up question per room
- **DB (0054):** `ea_rooms.warmup_q text` (≤ 160 chars, same cap as `ea_opil_sessions.warmup_q`); `ea_room_set_warmup(p_room uuid, p_q text)` security definer, hosts only (`ea_room_is_host`). `ea_room_state` returns `warmup_q`.
- **Client:** `mountWaiting` and the in-class `create(ctx)` in `js/rtk-warmup.js` take the question from `ctx.room`/`target.warmup_q` when there is no session; the host's "Change the question" writes through the RPC for rooms instead of the OPIL update. The HT host card gets a **Warm-up question** field beside Title/Host name (saves on blur).

### 2.4 Next session + Add to calendar
- **DB (0054):** `ea_rooms.next_title text`, `ea_rooms.next_at timestamptz`, set by hosts through `ea_room_set_next(p_room, p_title, p_at)`; returned by `ea_room_state`.
- **Client:** the host card gets **Next session** (title + local date/time; clear = none). The Live space shows "Next session · Thu Oct 8 · 12:00 PM CT" above the room with **Apple · Google · Outlook** links built client-side (the `.ics` builder already in `ht/hub/ht.js`; Google/Outlook are URL templates) whose description carries the room link. Nothing emails anyone.

### 2.5 The stamp
`ht/build.mjs` already hashes `js/rtk-room-v2.js` and `js/room-page.js`; it must also hash the plugin modules the room now loads for HT (`js/rtk-{presence,reactions,warmup,roster,help,chapters,board,resources,small-groups}.js` and their CSS) so a cache-first client is freed on any plugin change. `sw.js` VERSION bumps once per deploy.

## 3. The hub that exists, made current

- **Dates.** A sample event is never past on the demo day. Rule: home "Coming up on the Hill", every space's `calendar` block, Ada's lines, announcements and `stats` reference only (a) HT's published calendar dates or (b) sample dates ≥ 2026-10-06 that do not collide with a published event (deadlines may share a date, events may not). No "Thursday", "Tuesday", "on the 14th" — say the date or say "the next session".
- **Announcements** lose "Today / Yesterday / Monday" stamps that anchor to a week; they read "This week" / "Last week" / a date.
- **Chips.** `.chip.live` and the `Today` / `On now` flags render as a bold maroon/brick word with no capsule and no dot; `Next up` stays a plain maroon chip (no dot, already). The `nowbar` "Live" mark follows the same rule.
- **Live space copy** matches the room as shipped 9/15: Leave only leaves; End is two taps in Tools or on the host card; guests are admitted by sign-in while the class runs.
- **`/login/`:** when `next` starts with `/ht/`, the card's kicker reads "Signing in to the HT Hub" and the sub-line "Huston-Tillotson × Taylormade Academy". Nothing else on the login page changes.
- **Playbook:** §07 "Every feature" gains the room rows that are now true for HT (Files, Whiteboard, reactions, warm-ups, replay page, Next session). One pass, same table style.

## 4. Verification — what "everything is working" means here

1. **Static:** node + deno suites green; `tests/ht/harness/ht-room.mjs` (Playwright, stubbed) extended with: Files tab present in the HT room for a host, warm-up question round-trip, Next session round-trip, replay page renders with chapters/summary/transcript from stubbed rows.
2. **Live, two browsers, prod** (the rig in `opil-class-room-test-rig`, host = Nelson via emailed code, guest = a fresh account): the Dr. Gray path (sign in from the room link with a new email → in), reactions + Pulse, warm-up answer → host sees it, roster card, Files upload → guest downloads and sees it on stage, Whiteboard + Save to Files, Small groups, captions, question queue + Bring on stage, Leave (class keeps running) → rejoin, End (two taps) → replay → Publish → the replay page shows chapters, summary, transcript, files → Last session on the Live space. `is_live` checked false after.
3. **Every hub page** at 1440 and 390: 0 console errors, 0 horizontal overflow, no sample date < today, no dot-chips, every link 200 (`~/Downloads/HT-Hub-livecheck.sh` + a date sweep script that fails on any past sample date).
4. **The phone:** Nelson installs from Safari on a real iPhone and launches it (steps in the run-of-show). Not automatable here.

## 5. Deliverables to Nelson
- The build on `origin/main` (push `academy-room:main`), stamp rebuilt, sw bumped.
- `~/Downloads/apply-0054.sh` — the migration, run by Nelson with `!` (prod writes are classifier-denied for me), with a verify block.
- `~/Downloads/HT-Hub-demo-runofshow.md` — the demo order (home → Events → Live: Start class → a guest joins from a text → Files → Whiteboard → a question on stage → End → Publish → the replay page → the President space → the playbook), what to say (no prices, no vendor names), the iPhone install steps, and the "after the demo" list (add her email as host, rotate the link).

## 6. Out of scope (say so if asked)
Persisting the hub's local check-in/chat/feed/DMs to the database; the v2 app shell; Ada speaking; email reminders for HT; a white-label login; HT staff accounts beyond email + code; scheduled per-session links.

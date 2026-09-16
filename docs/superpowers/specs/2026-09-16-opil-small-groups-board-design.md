# OPIL class room — Small Groups board (design)

**Date:** 2026-09-16 · **Status:** approved in chat ("go build the small groups board") · **Reference board:** `~/Downloads/academy-room-concepts-v2/04-small-groups.png` (concept 4 of 4)

## The ask
"test the breakout rooms and see how they work and the ui/ux should look like this image but with my real logo instead — the peek in option, message room, time left in small groups with the clock, students need help part, etc"

## What exists (9/15)
Tools → Small groups: split evenly into 2–6 rooms (`connectedMeetings.createMeetings` + `moveParticipants`), Visit a room, Bring everyone back (`deleteMeetings`). Students in a room see "Small groups · Room 1" and a Back button. No timer, no messages, no help signal, no board.

## The board (Tools → Small groups, everyone — the 9/15 rule: every tool for everyone)
- **Before rooms exist:** one form — *Split by team (recommended) / Evenly into N rooms*, *Minutes* (5/10/15/20/30, default 15), the two-tap **Split students into rooms**. By team uses the roster (`ea_opil_roster_teams()`, program team only; staff teams and teamless students go to "Open room"); rooms are titled with the team names. Academy/HT rooms (no roster) split evenly only.
- **While rooms are open:** "Small Groups in Progress · Students are in their team rooms. You can visit any room or bring everyone back." One card per room: title, "N students" + names, a dot — **Needs help** (red) when someone in that room asked, **Working** (green) otherwise, **Empty** (grey) — and two buttons: **Peek In** (you move into that room; the bar reads *Back to the main room*) and **Message Room** (inline one-line note → shows in that room). **Message all rooms** in the header.
- **Right rail:** **Time left in small groups** — mm:ss clock, progress bar, "15 minute session · Ends at 7:24 PM"; at zero the clock turns gold and reads "Time's up". **Rooms needing help (N)** with a **Join** button (Peek In + clears that room's help flags). **All rooms (N)**. One gold **Bring Everyone Back** (two-tap; closes every room; timer cleared).
- **Phone:** the same board in the sheet, one column.

## The student side (in a room)
- Strip: "Small groups · Data Divas · 09:32 left" (counts down). At zero: "Time's up — heading back to the main room" (nobody is moved until the host presses Bring Everyone Back).
- Bar: gold **Ask for help** ("Your facilitator will pop in") → after: **Help is on the way** · *Never mind*; plus **Back to the main room**.
- A note from the host appears as a banner under the strip (dismissable) and a toast.

## Under the hood
- Rooms: Cloudflare RealtimeKit `connectedMeetings` as today (ids from `getConnectedMeetings()`, matched by `customParticipantId`).
- Help: `ea_opil_hands` / `ea_room_hands` rows with `kind = 'help'`, `note = <room meeting id>` (0040 widens the kind check and the one-open-hand index to `(…, user_id, kind)`). Students insert/delete their own; the host marks them done when they join the room. `queueOrder()` ignores help rows.
- Timer + notes: Supabase realtime **broadcast** on channel `sg-<session no>` (`sg-room-<id>` for rooms), event `sg`: `{type:'timer', endsAt, minutes}` (sent at split and every 15 s while rooms are open; `endsAt:null` on bring-back) and `{type:'note', room:<id|'all'>, text, from}`. No table.
- Roster: `ea_opil_roster_teams()` (definer; admin/program team) → `(user_id, team_name)` excluding staff teams.
- Code: `js/rtk-small-groups.js` (board, student bits, channel), imported by `js/rtk-room-v2.js` with the page's `?v=`; pure helpers + tests in `opil/hub/live-rooms.js`.

## Honest limits
No live video from a room you are not in (names on the card; Peek In to see faces). "In discussion / On track" cannot be sensed from outside; the dot is Working / Needs help / Empty.

## Testing
`node --test tests/opil` (helpers), `tests/ht/harness` (stubbed; R3 split-is-two-taps keeps `.r2-groups [data-g="split"]`), two-browser rig `~/.cache/opil-rig/bo5.mjs` on prod session 02 (host + demo student): split → strip with time → Ask for help → board shows Needs help → Join → Back → Message room → banner → Bring everyone back.

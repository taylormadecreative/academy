# OPIL class room v2 — design

**Date:** 2026-09-14 · **Status:** approved in chat ("these look amazing build the ui/ux to be like this for desktop and mobile" · timing: "Everything before Wednesday" 2026-09-16, with a switch back) · **Reference boards:** `~/Downloads/academy-room-concepts-v2/` (desktop 1–4) and `~/Downloads/academy-room-concepts-mobile/` (phone 1–4), generated 2026-09-14 on gpt-image-2.5.

## The ask
Rebuild the class room's look and flow to match the concept boards: state in words, one obvious action, nothing important behind a ⋮ menu, big labeled targets, the Academy navy/gold — on desktop and phone.

## Approach
Keep Cloudflare RealtimeKit as the engine and its **composable components** (`<rtk-ui-provider>` + `rtk-grid` / `rtk-chat` / `rtk-participants` / `rtk-polls` / `rtk-breakout-rooms-manager` / `rtk-participants-audio` / `rtk-notifications` / `rtk-dialog-manager` / `rtk-screenshare-view`) inside **our own layout** — instead of the all-in-one `<rtk-meeting>` shell. Our HTML owns: the join screen, the "what's happening now" strip, the state-in-words toggles, the Ask-a-question queue, the instructor's Ready-to-speak panel, the Tools sheet, the mobile bottom sheet. The kit owns: tiles, video, audio, chat, people list, polls, breakouts, dialogs.

**Kill switch:** `js/rtk-room.js` (today's `<rtk-meeting>` shell) stays untouched. `opil/hub/live/index.html` imports `rtk-room-v2.js` when `ROOM_V2 = true` (one constant at the top of the page's script) and the URL has no `?classic=1`; otherwise it mounts the old room exactly as today. Everything server-side (join, record, replays, chat policies) is shared and unchanged.

## Screens (desktop / phone)

### 1. Getting in (`/opil/hub/live/?s=N`, before Enter)
- Headline **"You're in the right place."** · session label + title · "with <facilitator>" (from `ea_opil_facilitators` when set, else "the OPIL team") · a live line: "<Name> is in the room · N students joined" when the class is running, or "Class hasn't started yet. You're all set!" with "Starts <time>" when not.
- **Camera preview** = the kit's `<rtk-participant-setup>`-equivalent (our own `<video>` from `meeting.self` preview) with two word-chips under it: "Camera looks good! / Camera is off" and "Mic on / Mic muted", each a toggle. Effects button (blur/backdrops — the existing addon) beside them.
- "Joining as <display name>" (read-only — names come from the profile).
- One full-width gold **Enter Class →** (desktop: right column; phone: fixed at the bottom). Under it: "You'll be muted when you join. You can unmute anytime." Hosts enter with mic on.
- Not started yet → Enter is replaced by the waiting card; the page enters by itself when the session flips live (existing 30 s poll → auto-enter, no reload needed).
- Instructor (host) sees the same screen with **Start class** where Enter would be; Start = today's flow (open the room, flip live, record on joined).

### 2. In class — everyone
- **Now strip** (top, full width, in words): "<Facilitator> is teaching · <title>" and "This class is being recorded" (from the replays row; students see it too). Live dot.
- **Stage:** `rtk-grid` (spotlight layout when someone is pinned; screenshare via the grid's own handling). Nothing overlays faces.
- **Right panel (desktop) / bottom sheet (phone):** tabs **Chat · People** (`rtk-chat`, `rtk-participants`). Phone: "Swipe up for chat and people" handle.
- **Bottom bar — students:** two word-chips "You're muted · Tap to unmute" / "Camera is off · Tap to turn on" (toggle), one big gold **Ask a question** (→ queue; while queued it reads "You're #3 in line · Leave the line"), and **Need help?** (opens chat with a prefilled "I need help with…"). **Leave** at the far right (desktop) / in the sheet (phone).
- **Bottom bar — instructor:** the same two word-chips, **Bring <next name> on stage** (gold; pins that participant for everyone and marks their question answered; disabled with "No one in line" when empty), **Tools** (opens a sheet: Share my screen · Effects · Breakout rooms · Poll · Save transcript · End class for everyone), **Leave**.
- **Instructor side panel:** tabs **Ready to speak (N) · Chat · People**. Ready-to-speak lists the queue in order with "Has a question" / "Would like to comment", each row: **Bring on stage** and a quiet "Done" (clear without staging). "Recording 00:12:36 · saves automatically for your students" sits under the Now strip for hosts.
- Judges: the student layout minus Ask a question (their preset has no media).

### 3. Small groups (Wednesday scope)
The kit's `rtk-breakout-rooms-manager` inside our Tools sheet, restyled; students in a breakout see the Now strip read "Small groups · <room name> · <time left>" (time from the breakout's own timer if exposed; else the instructor's typed minutes stored on the session). The overview board with Peek In / Needs help is **after Wednesday**.

### 4. Question queue (new, shared by student + instructor)
Table `ea_opil_hands (id, session_no, user_id, kind 'question'|'comment', note text, created_at, staged_at, done_at)`. Students insert their own (one open row per person per session), see their position (count of open rows created before theirs), and can delete their own. Hosts update `staged_at`/`done_at`. Realtime on the table drives both panels. RLS: cohort + program team read open rows for live sessions; insert own; hosts update.

## Brand + layout tokens
Navy `#0a1733`/`#04123a`, gold `#fdc921`, paper `#fcfdff`, slate `#9fb0d4`, emerald `#3ddc97`. Space Grotesk / Inter. 16px panels, 999px pills, hairlines at 10% white. Targets ≥ 48px. Desktop ≥ 1024: stage + 340px panel. Phone ≤ 720: one column, sheet, fixed bottom bar with safe-area inset. The kit's design tokens are set once (`provideRtkDesignSystem`) to match.

## Out of scope for Wednesday
Breakout overview board (Peek In / Needs help), the "Class flow" steps idea, custom tile chrome inside the grid, transcripts panel styling, the Academy `/live/` room (still on the old shell).

## Testing
- `node --test` for the pure bits: queue ordering/position, Now-strip copy, bottom-bar state copy, kill-switch selection.
- Harness (stubbed hub.js + stubbed kit): join screen states (not started / live / host), bottom bar copy toggles, Ask a question inserts and shows position, Bring on stage calls pin + marks done, `?classic=1` mounts the old room.
- Real rooms: Nelson + a second account (Jamal or a test student) — join, ask, bring on stage, chat, share screen, breakout, leave-ends-session, recording still lands. Phone: Nelson's iPhone on the real URL.

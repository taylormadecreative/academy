# OPIL parallel live rooms — design

**Date:** 2026-09-14 · **Status:** approved by Nelson in chat (approach A) · **Builds on:** `2026-09-10-realtimekit-live-rooms-design.md`, plan `2026-09-11-realtimekit-live-rooms.md`

## The ask

Three or more instructors go live at the same time, each in their own room, and each room has a
URL an instructor can hand out ("send a link to a live").

Decisions taken in chat:
- A room is attached to a **scheduled session** (`ea_opil_sessions.no`), not to an instructor.
- A room link is **cohort + program team only** — same sign-in wall as today. No guests.
- Hub home lists **every** live room; a student picks. No per-student assignment.

## What exists (and why it blocks this)

| Piece | Today | Problem |
|---|---|---|
| `ea_opil_sessions_one_live` (0023) | partial unique index: at most one row with `is_live` | the hard block |
| `/opil/hub/live/` | one page; queries "the" live session (`is_live = true … limit 1`) | no way to name a room |
| `flipLive()` on that page | clears every live session before flipping one on | a coordinator starting a class kills everyone else's |
| hub home banner (`opil/hub/index.html`) | "A session is live right now → Join" | one link |
| `hub.js` `boot()` login bounce | `next=` carries `location.pathname` only | `?s=` is dropped through sign-in |
| `ea-rtk-join` | already keyed on `session_no`; opens one RealtimeKit meeting per session | **no change** |
| `ea_opil_live_chat` + `lc_write` (0028) | already keyed on `session_no`; write requires *that* session live | **no change** to SQL |
| one-way broadcast (`js/broadcast.js` → `ea-live-publish`) | one shared Cloudflare Stream input (`CF_STREAM_INPUT_ID`) | physically one at a time; **stays one at a time** |

## Design

### URL
`/opil/hub/live/?s=<session no>` is a room. `/opil/hub/live/` with no `s`:
- exactly one session live → behave exactly as today (enter it). Old links keep working.
- several live → a "Live now" list, one button per room.
- none live → today's idle message.

`?s=` names a session that is *not* live → the idle card says "This room opens when your
facilitator starts it" and the page keeps watching that one session (30 s poll, as today) and
reloads when it flips live. A bad `s` (not a number / no such session) → the no-`s` behaviour.

### Database — migration `0032_opil_parallel_live.sql`
- Drop `ea_opil_sessions_one_live`.
- Create `ea_opil_sessions_one_stream`: partial unique on `((is_live)) where is_live and
  coalesce(stream_url, '') not like 'rtk:%'`. Class rooms (`rtk:` ids) are unbounded; anything
  else (camera broadcast via the shared Cloudflare input, YouTube URL, the rehearsal clip) keeps
  the one-at-a-time rule.
- No policy or function changes. Safe to re-run.

### Live page (`opil/hub/live/index.html`)
- Read `s` from the query string; select that session (any `is_live` state) instead of "the" live one.
- `sessionNo` for chat = the room's session. Realtime subscription filtered
  `session_no=eq.<no>` so a message in another room does not re-fetch this one.
- `flipLive(no, on, u)`: **no blanket clear**. Flip only `no`. A `23505` now only ever comes from
  the stream index → message: "Another camera broadcast is running. End that one first."
- Broadcast control gains a **link row** under the session picker: the full URL
  (`https://taylormadeacademy.com/opil/hub/live/?s=N`) in a read-only field + **Copy link**
  button (`navigator.clipboard`, with a select-the-text fallback). Changing the picker updates
  the URL. Starting a class or broadcast also `history.replaceState`s the page to `?s=N` so the
  host's page is bound to that room (a reload after a class ends returns to that room's idle
  state, not to whichever room is live).
- Wake poll watches the named session only (`eq('no', s).eq('is_live', true)`); with no `s`,
  watches for any live session as today.
- "Live now" list (no-`s`, several live) reuses the hub-home markup: session label · title · Join.

### Hub home (`opil/hub/index.html`)
`liveNote` becomes a list: one row per live session — `sessLabel · title` and a **Join** link to
`/opil/hub/live/?s=N`. One live → same single-line banner as today but linking to `?s=N`.

### Sign-in hand-off (`opil/hub/hub.js`)
`boot()` bounces to `/login/?next=` + `encodeURIComponent(location.pathname + location.search)`.
`/welcome/` already accepts any same-origin path starting with `/` (query string included) —
verified by reading `welcome/index.html:227-246`; no change there.

### Cache
`sw.js` `VERSION` → `tma-v10-parallel-rooms` (cache-first assets, see
`gotcha-unversioned-assets-opil-hub`). `build_site.py` stamps `?v=` on the hub pages.

### Out of scope (say so, do not build)
- Guests without an account.
- Per-student room assignment / tracks.
- Parallel one-way broadcasts (needs one Cloudflare input per session — "approach B").
- Recordings, transcription, breakouts (still on the 9/11 plan).
- The Academy `/live/` room and its `ea_live_one_live` index — untouched.

## Error handling
| Case | Behaviour |
|---|---|
| student opens `?s=N` before the host starts | idle card "opens when your facilitator starts it"; page polls that session and reloads when live |
| host starts a camera broadcast while another is running | 23505 → "Another camera broadcast is running. End that one first." |
| `?s=` malformed / unknown session | fall back to the no-`s` view |
| clipboard blocked | link field text is selected so ⌘C works; button reads "Select link" |
| student has no cohort membership | `ea-rtk-join` 403 → existing "Could not open the class" card |

## Testing (per "Testing reality" in the 9/11 plan — no staging, prod is the only DB)
1. **SQL** — apply 0032 on prod (additive: one index dropped, one created). Verify with
   `pg_indexes` read. Then, as Nelson (admin), flip two `zz-`-free sessions live with `rtk:`
   values via the UI in two browser tabs — both stay live. Try the rehearsal clip on a third →
   23505 message. End all. (Students see the banner for the minutes it runs; do it at an off
   hour and end promptly.)
2. **Client logic** — a scratch Playwright run against a local static server with a stubbed
   Supabase client (never sign in against prod from an automated test —
   `gotcha-e2e-hits-prod-supabase`): `?s=7` picks session 7; no `s` + 2 live → list with 2 Join
   links pointing at `?s=`; no `s` + 1 live → enters it; Copy link writes the right URL and
   tracks the picker; hub home renders N rows; `boot()` bounce preserves `?s=`.
3. **Real rooms** — Nelson + Jamal, two browsers, two sessions, both in class mode at once; each
   sees only their own chat. This is the sign-off.

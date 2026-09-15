# Academy Room — the OPIL class room for Taylormade Academy, shareable by one link

**Date:** 2026-09-14 · **Owner:** Nelson Taylor · **Status:** design, approved in chat, critiqued (3 lenses, 26 findings folded in); plan written 2026-09-14 (`docs/superpowers/plans/2026-09-14-academy-room.md`)
**Supersedes for `/live/`:** §2.2 and §3.1 of `2026-09-10-realtimekit-live-rooms-design.md` (the `ea_live` row, *Start webinar*, the `tma-webinar-host/member` presets) — Task 8 of the 9/11 plan, never built.

## 1. What Nelson asked for, and what was decided

> "in taylormade academy i want to have the classroom feature like in the opil cohort and i want to be able to send a link to anyone i want to join me"

Decisions made in the brainstorm (2026-09-14), in his words where he made them:

| Question | Decision |
|---|---|
| What happens when someone opens the link? | **Sign in first, then walk in.** Email → 6-digit code (the existing `/login/`), first-timers type their name once. Everyone in the room is an Academy account. |
| One way to go live on the Academy, like OPIL? | **Yes — the class room is the only way.** The camera broadcast, the rehearsal clip and *End broadcast* come off `/live/`. |
| One room or many? | **One room.** *"i don't need several rooms it's only one me i can only go live one at a time."* |
| Part 1 (what people see) | *"perfect"* — nothing cut. |

Standing rules that shaped it: one primary go-live action per surface, never a second path ([feedback_opil_one_way_to_go_live]); virtual sessions run in his own room, never Teams ([feedback_virtual_sessions_on_academy_never_teams]); sell the outcome, define the jargon.

Not in this build: co-hosts, several rooms, a waiting room where the host admits people by hand, replays for guests, the iOS wrapper, a client-branded join screen, replays in `/library/`.

## 2. The experience

### 2.1 Nelson (host)

`/live/` — the **Your room** card replaces *Broadcast control* (admin only):

- **The link** `https://taylormadeacademy.com/room/?k=<key>` in a read-only field · **Copy link** · **New link** (two-tap confirm; cuts off everyone holding the old link — a forwarded link, someone removed). *Remove* (in People) takes someone out for now — they can reopen the link; **New link** is how you keep someone out.
- **Title** field (default "Taylormade Academy Live"), saved when he clicks away (a small *Saved* note); shows on the join screen and on the members' door. **Max people (you included)**, default 50, saved the same way. Over the cap the join is refused with "The room is full right now."
- **Open your room →** goes to `/room/` (no key needed for him).
- Status line: *Off air* / *Live now · 12 people* — the count is `ea_room_members` rows with `last_joined_at >= live_since`, refreshed every 20 s. A room left live from a tab that died shows *Class is running* + **End session** here too; guests are refused after 4 h regardless (§6.1 step 5).
- **Replays**: the latest recordings, newest first, each as *Replay preparing* / *Replay ready — Review · Publish to members* / *Published ✓ · Unpublish* / *Replay failed — Retry* — the same wording as Jamal's coordinator row.
- **Who joined**: "Last session · 12 people" with names under a disclosure — the same rows (`last_joined_at >= live_since` of the most recent session; `live_since` is overwritten at Start, so this shows the previous session until he starts again), names from `ea_profiles.display_name`.

`/room/` as the host:

1. Title (read-only here; edit on `/live/`), the link + Copy link (the page reads `link_key` from `ea_rooms` directly — admin RLS), and **Start class — everyone on camera**.
2. Start class → the server opens a **fresh** meeting → the page flips the room live → the camera-check screen (mic/camera chips, Effects) → **Enter Class** → the room v2 layout exactly as OPIL: grid, chat, People (Pin / Turn off video / Remove), Ask-a-question queue with **Bring on stage**, Tools sheet (share screen, effects, breakout rooms, poll, camera & mic, save transcript, end class for everyone).
3. Recording starts the moment he is in ("joined"), never on Start class (Cloudflare stops an empty recording after 60 s).
4. **Leave = end, for everyone**: two taps (*End the session for everyone? Tap again*); everyone else is removed from the meeting, the recording stops, the room flips off air, guests see "This session has ended." There is one host, so there is no "a co-host leaving does not end it" case and no `hosting` flag.
5. **Reload or second device while live:** the page shows *Class is running* + **End session** in the control AND enters the running class as host straight away (same meeting, no new recording — start is idempotent). His Leave from there ends the session too.

### 2.2 A guest (anyone Nelson sent the link to)

| State | What they see |
|---|---|
| Opens `/room/?k=…`, signed out | Navy card: *Nelson Taylor's room* · the title · **Sign in to join** → `/login/?next=/room/?k=…`. Email → 6-digit code (the card says *enter the code here* — the emailed link can lose its way back on phones); first-timers give their name on `/welcome/`; they land back on `/room/?k=…` automatically. |
| Dead or rotated key (non-member) | *This link isn't active anymore — ask Nelson for the new one.* (No title is shown.) A member or Nelson with a stale key never sees this — membership admits them. |
| Signed in, key good, Nelson not started | The v2 join screen in **waiting** mode: *Nelson hasn't started yet — we'll bring you in the moment he does.* The page checks every 20 s. |
| Nelson starts | A guest who was waiting is walked straight in — muted, camera off, one tap to turn on (the same auto-enter OPIL students get). A guest who opens the link after he started gets the camera-check screen → **Enter**. *This session is being recorded* on the strip. |
| Room full | *The room is full right now.* |
| Nelson leaves, or removes them | *This session has ended.* One line: *Members can rewatch it on the Live page* → `/live/` (a non-member lands on the membership card there). |
| They press Leave themselves | *You left the room.* + **Rejoin →** |
| Signed in, no key, not a member | *You need Nelson's link or an Academy membership to join.* → `/pricing/`. |

### 2.3 A member

`/live/`, signed-in member: if the room is live → *Nelson is live: <title>* + **Join the room →** (`/room/`, no key). Off air → *Nothing is live right now* + **Last session** (the published replay, embedded) when there is one. Members never need the link.

Signed-out and signed-in non-member visitors keep exactly today's gate card; its *Happening right now* / *Members only* header now reads the room's state.

## 3. Architecture

```
/live/  (door + Nelson's card)          /room/?k=…  (the room page, everyone)
   │ ea_room_state() · ea_rooms (admin)     │ ea_room_state(k) → landing / waiting / room / ended
   │ ea_room_replays (admin) · publish RPC  │ mountRoomV2({ target:{kind:'room',…} })
   ▼                                        ▼
Supabase ──── ea-rtk-join {room:true,key}  ── host → creates a fresh meeting, writes ea_rooms.meeting_id
         ──── ea-rtk-record {room:true,…}  ── start on joined / stop on leave → ea_room_replays
         ◄─── ea-rtk-webhook               ── meeting → Academy room FIRST, else OPIL session → Stream copy
```

OPIL keeps every path it has today except one **hardening it needs anyway** (§6.1 OPIL branch). The three functions grow a **room branch** beside the OPIL branch. The room module `js/rtk-room-v2.js` gains a `target` option whose default reproduces today's OPIL behaviour byte for byte (checked by the OPIL tests and harness).

**"The room"** everywhere (state RPC, join, record, `/live/`) = `select … from ea_rooms order by created_at limit 1`; a unique index makes one row a database fact. A second room would need a `room_id` in the bodies — not this build.

## 4. Data — migration `0036_academy_room.sql`

Applied to prod by Nelson with `!` (classifier rule). Safe to re-run. Every definer function: `stable`/`volatile` as needed, `security definer set search_path = public`, `revoke all … from public, anon` (and from `authenticated` where noted), then grant.

### 4.1 `ea_rooms` — one row
```sql
create or replace function public.ea_room_new_key() returns text language sql volatile
  security definer set search_path = public as
$$ select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_') $$;   -- 22 chars, [A-Za-z0-9_-]
revoke all on function public.ea_room_new_key() from public, anon, authenticated;

create table if not exists public.ea_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Taylormade Academy Live' check (char_length(title) <= 120),
  link_key text not null unique default public.ea_room_new_key(),
  is_live boolean not null default false,
  meeting_id text,                       -- the CURRENT session's RealtimeKit meeting; server-only (grants below);
                                         -- a NEW meeting at every Start class (§6.1); kept after Leave so a late webhook still files (§6.3)
  max_participants int not null default 50 check (max_participants between 2 and 500),
  recording_url text,                    -- the published replay (Stream /watch page)
  live_since timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists ea_rooms_single on public.ea_rooms ((true));   -- exactly one room
insert into public.ea_rooms default values on conflict do nothing;                -- seeded as the migration owner
alter table public.ea_rooms enable row level security;
create policy rooms_admin_read   on public.ea_rooms for select to authenticated using (public.ea_is_admin());
create policy rooms_admin_update on public.ea_rooms for update to authenticated using (public.ea_is_admin()) with check (public.ea_is_admin());
-- no insert / delete policy: the seed runs as the owner, the service role never inserts either
revoke insert, delete, truncate, references, trigger on public.ea_rooms from anon, authenticated, public;
revoke update on public.ea_rooms from anon, authenticated, public;
grant update (title, is_live, max_participants, live_since, ended_at, updated_at) on public.ea_rooms to authenticated;
```
`meeting_id` and `link_key` are never writable from a page: the join function writes `meeting_id` with the service role; `ea_room_rotate_link()` writes `link_key`. Revokes run AFTER create (the 0023 lesson). Why not `ea_live`: it is the hardened members-only paywall with a one-live index and ticket-holder policies (0023/0027) and `/agent/live/` reads it and `ea_live_chat`; both stay untouched.

### 4.2 `ea_room_state(p_key text default null) returns jsonb` — the only read path for non-admins
Security definer, granted to **anon and authenticated**. `privileged := ea_is_admin() or ea_is_member()`. Returns, for the room:
```
{ id, title, is_live, host_name: 'Nelson Taylor',            -- a constant in the function until co-hosts exist
  signed_in: auth.uid() is not null,
  is_host:   ea_is_admin(),
  can_join:  privileged or (p_key is not null and p_key = link_key),
  bad_link:  not privileged and p_key is not null and p_key <> link_key,
  recording_url: only when ea_is_member(),
  people:    only when ea_is_admin(): count(*) from ea_room_members where last_joined_at >= coalesce(live_since, 'epoch') }
```
When `bad_link` is true the function returns `{ bad_link: true }` and nothing else. Never returns `link_key` or `meeting_id`. Guests poll it while waiting and while in the room (20 s); `/live/` reads it for every visitor. (A 128-bit key behind an anon-callable equality check is not brute-forceable.)

### 4.3 `ea_room_members` — who joined
```sql
(room_id uuid references ea_rooms(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
 first_joined_at timestamptz default now(), last_joined_at timestamptz default now(), joins int default 1,
 primary key (room_id, user_id))
```
Written only by the join function (service role upsert: `joins + 1`, `last_joined_at = now()`). RLS: select to authenticated `using (ea_is_admin())`; nothing else. **A membership row admits nothing by itself** — only a join in the *current* session does (§4.4).

### 4.4 `ea_room_hands` — the question queue (shape of `ea_opil_hands`)
Same columns with `room_id uuid not null references ea_rooms(id) on delete cascade` in place of `session_no`; same partial indexes (`one_open` on `(room_id, user_id) where done_at is null`). Because policies on this table cannot read `ea_rooms`/`ea_room_members` through those tables' own RLS (the 2026-08-31 recursion lesson; OPIL uses `ea_opil_in_cohort()` for the same reason), the check is a definer helper:
```sql
create or replace function public.ea_room_in_session(p_room uuid) returns boolean language sql stable
  security definer set search_path = public as
$$ select exists (select 1 from public.ea_room_members m join public.ea_rooms r on r.id = m.room_id
                  where m.room_id = p_room and m.user_id = auth.uid() and r.is_live and m.last_joined_at >= r.live_since) $$;
-- revoked from public/anon, granted to authenticated
```
Policies: `read` `using (ea_is_admin() or ea_room_in_session(room_id))` · `insert` `with check (user_id = auth.uid() and ea_room_in_session(room_id))` · `update` `using/with check (ea_is_admin())` · `delete` `using (user_id = auth.uid() or ea_is_admin())`. Column grants after create: `revoke insert on ea_room_hands from authenticated; grant insert (room_id, user_id, kind, note) on ea_room_hands to authenticated;` so a guest cannot set `staged_at`/`created_at` and jump the queue. Added to `supabase_realtime`.

**Rider (same hole, one line):** `ea_opil_hands` keeps the default full INSERT grant today, so an OPIL student could insert `staged_at`. 0036 also runs `revoke insert on ea_opil_hands from authenticated; grant insert (session_no, user_id, kind, note) on ea_opil_hands to authenticated;` — the OPIL page inserts exactly `{session_no, user_id, kind}` (`js/rtk-room-v2.js` askQuestion). Rollout step 1 proves an OPIL-shaped insert still works.

### 4.5 `ea_room_replays` — drafts (shape of `ea_opil_replays` + 0034 privacy)
Same columns with `room_id uuid references ea_rooms(id) on delete set null` in place of `session_no`; same status check; indexes on `(room_id, created_at desc)` and `(meeting_id, created_at desc)`; `recording_id` unique. RLS: select to authenticated `using (ea_is_admin())`; no write policies (service role only). Grants, in this order after create: `revoke select on ea_room_replays from anon, authenticated, public;` then `grant select (id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at) on ea_room_replays to authenticated;` — the raw `download_url` / `download_expires_at` never reach a browser; pages select explicit columns. Dedupe stays in the existing `ea_rtk_events` (ids are `<recordingId>:<STATUS>`, never OPIL numbers).

### 4.6 Admin RPCs (security definer; revoked from public/anon; granted to authenticated; each re-checks `ea_is_admin()` and raises `42501` otherwise)
- `ea_room_rotate_link() returns text` — sets `link_key = ea_room_new_key()`, returns it.
- `ea_room_publish_replay(p_replay uuid, p_publish boolean) returns jsonb` — the row must be `ready` with a `watch_url`; publish sets `published`, unpublishes the others, copies `watch_url` → `ea_rooms.recording_url`; unpublish clears both. Mirrors `ea_opil_publish_replay`.

## 5. Cloudflare presets

Two new GROUP_CALL presets on app `0f38f396-7ab8-41ed-bc08-8cf48fa695c7`, committed as `scripts/rtk-presets/tma-class-host.json` (a copy of `opil-host.json`, `name` changed) and `tma-class-guest.json` (a copy of `opil-student.json`, `name` changed, **and one deliberate diff: `chat.public.files: false`, `chat.private.files: false`** — strangers must not push files to each other under Nelson's name; text chat stays). Both already carry the Academy tokens and logo. Guests: camera/mic/screen share ALLOWED (arrive muted by client default), text chat, vote on polls, no pin/kick/record; waiting room SKIP (the key + sign-in are the gate). Host: everything `opil-host` has.

`tma-webinar-host.json` / `tma-webinar-member.json` are superseded: delete the two files (the presets already on Cloudflare stay, unused and harmless; without the files `rtk-presets.sh` stops touching them).

**Creation without a shell token:** the join function's room branch calls `ensurePresets()` the first time a host opens the room — `GET /presets`; `POST` either of the two that is missing; `PATCH` `tma-class-guest` if its `chat.*.files` is not false (the bodies live in `_shared/rtk_presets.ts`, generated from the JSON). Idempotent, cached per isolate. `scripts/rtk-presets.sh` still works for anyone with the token in their shell.

## 6. Edge functions

All three keep `verify_jwt` OFF and the CORS lock to `https://taylormadeacademy.com`.

### 6.0 `ea-rtk-join` is split first
Today it is one `Deno.serve` with no tests. Before any room code: split like `ea-rtk-record` into `handler.ts` (`handleJoin(body, caller, deps)`) + `index.ts`, port the OPIL branch verbatim, and cover it in `handler_test.ts` (host preset, judge, cohort student, not_allowed, not_open, host creates a meeting). Those tests are the proof the OPIL branch did not move when the room branch and the hardening land. `resolveCaller` (`_shared/rtk_auth.ts`) is reused and gains `academyAdmin: rpc('ea_is_admin') === true`.

### 6.1 `ea-rtk-join` — body `{ room: true, key?: string }` (room branch) · `{ session_no }` (OPIL)
**OPIL branch — one hardening, no other change** (the critique found a side door): (a) a client-supplied `meeting_id` is **ignored** — the meeting is the session's stored `rtk:` id, or created by a host; a student on a session with no stored id gets 409 `not_open` as today; (b) before minting, if the resolved meeting equals `ea_rooms.meeting_id` or appears in `ea_room_replays.meeting_id` → 403 `not_allowed` (a facilitator pointing a session's `stream_url` at the Academy meeting gets nothing). The OPIL page never relied on (a): it passes the id it read from the same row the server reads.

Room branch, in order:
1. Bearer token → `admin.auth.getUser` (401 `sign_in`) — same as now.
2. Rate limit with the service role, **fail-open** like every other `ea_rate_check` caller (429 only on `allowed === false`): `ea_rate_check('rtk-join:u:' + uid, 30, 600)` and `ea_rate_check('rtk-join:ip:' + ip, 90, 600)` → 429 `slow_down`, where `ip = cf-connecting-ip header || LAST entry of x-forwarded-for || 'unknown'` (the first entry is caller-controlled). The per-user bucket is the real guard; IP is defence in depth. Runs before any Cloudflare call.
3. Read the room row with the service role (`id, title, link_key, is_live, live_since, meeting_id, max_participants`, `order by created_at limit 1`).
4. Role, as the caller: `isHost = academyAdmin`. Otherwise `allowed = rpc('ea_is_member') === true || (key && key === row.link_key)`. Not allowed → `key ? 404 bad_link : 403 not_allowed`.
5. Guest and not open → 409 `not_open`, where open = `row.is_live and row.live_since > now() − 4 h` (a tab that died leaves `is_live` true; after 4 h — the recording cap — guests are refused until he ends and restarts; `/live/` shows End session for the stale row).
6. Meeting. **Host, room off air** (a Start class): `POST /meetings { title: 'Academy · ' + title + ' · ' + date, persist_chat: false }`; **the function writes the new `meeting_id` — and `is_live = true, live_since = now()`, so a row a dead tab left live more than 4 h ago admits people again the moment Nelson re-enters — on the row with the service role**; then best-effort `PATCH /meetings/{previous} { status: 'INACTIVE' }` (ignore failure) so a token from the last session opens nothing — not even an empty billable session. **Host, room already live** (reload, second device): reuse `row.meeting_id`. **Guest:** `row.meeting_id`. The room branch never reads a client-supplied `meeting_id`.
7. Host → `ensurePresets()` (§5).
8. Cap (guests only): `GET /meetings/{id}/active-session` → `data.live_participants` (HTTP 404 = no session yet = 0; the field counts Nelson too, hence *Max people (you included)*). `live_participants >= max_participants` → 429 `room_full`.
9. `POST /meetings/{id}/participants { custom_participant_id: uid, preset_name: host ? 'tma-class-host' : 'tma-class-guest', name }` — name from `ea_profiles.display_name` or the email prefix, `slice(0, 60)`, exactly as today.
10. Upsert `ea_room_members`.
11. Return `{ token, preset, host, name }` and, **for the host only**, `meeting_id` (only the host's `onOpened` consumes it; guests never learn the meeting id).

### 6.2 `ea-rtk-record` — body `{ room: true, action, replay_id? }` (room branch) · `{ session_no, action }` (OPIL)
Room branch: host = `academyAdmin` (403 `not_host`); the meeting is `ea_rooms.meeting_id` (409 `no_room` when null); `start` / `stop` unchanged in logic (idempotent start, trust-but-verify against `GET /recordings/{id}`, 4 h cap) writing `ea_room_replays` with `room_id`. **`retry_replay` takes `replay_id`** (a fresh meeting per session means "latest replay of the current meeting" is the wrong row the morning after): load that `ea_room_replays` row with the service role, require `status = 'error'`, reprocess its own stored UPLOADED event by its `recording_id`. OPIL branch: unchanged except the same room-meeting refusal as §6.1 (a session whose `rtk:` id is a room meeting → 403). `register_webhook` / `list_webhooks` stay OPIL-admin-keyed as today.

### 6.3 `ea-rtk-webhook`
`sessionByMeeting(meetingId)` becomes `targetByMeeting(meetingId)` → `{ kind: 'room', id, title } | { kind: 'opil', no, title, kind } | null`. **Lookup order: `ea_rooms.meeting_id`, then `ea_room_replays.meeting_id → room_id` (a recording that finishes after the next Start class replaced `meeting_id` still files under its room), then `ea_opil_sessions.stream_url = 'rtk:' + id` last** — so a session pointed at the room meeting can never pull Academy recordings into OPIL's table. Unknown → ignored, as today. `upsertReplay` / `currentStatus` route by kind; `markFailed` (called from the catch with only the payload) updates by `recording_id` in `ea_room_replays` and, if nothing matched, `ea_opil_replays`. Stream copy name for a room: `Academy · <title> · <YYYY-MM-DD>` with the date from the replay row's `created_at` in America/Chicago. The forward-only RANK rule and dedupe are untouched.

### 6.4 Error codes the pages translate
`sign_in` · `not_allowed` · `bad_link` · `not_open` · `room_full` · `slow_down` · `no_room` · `not_host` · `no_replay` · `nothing_to_retry` · `rtk_not_configured` · `cloudflare_<status>`.

## 7. Client

### 7.1 Words — `opil/hub/live-rooms.js` stays where it is
No new shared module before Wednesday: a re-exported file would sit in front of three OPIL pages (hub home, live, admin) as an unversioned, cache-first import. Instead `nowCopy` and `joinCopy` in `opil/hub/live-rooms.js` gain an optional `words` argument with OPIL defaults that reproduce today's strings byte-for-byte (the 18 OPIL tests are the check; `thing` is capitalised where it starts a sentence):
```js
OPIL: { one: 'student', many: 'students', host: 'your facilitator', teaching: 'is teaching', thing: 'class', waiting: undefined, replayFor: 'your students' }
ROOM: { one: 'person',  many: 'people',   host: 'Nelson',           teaching: 'is live',     thing: 'session',
        waiting: 'Nelson hasn’t started yet — we’ll bring you in the moment he does.', replayFor: 'members' }
```
`joinCopy({ live:false, host:false }, ROOM)` returns `words.waiting` when set. `js/rtk-room-v2.js` stops importing the helpers statically and does `const copy = await import('/opil/hub/live-rooms.js' + new URL(import.meta.url).search)` (the pattern `opil/hub/hub.js` uses for `tour.js`), so the helpers ride the module's own `?v=` and never need a service-worker bump again.

The `/room/`-only pure logic — `roomKey(search)` and `roomBranch(state)` — lives in a new `js/room-page.js`, imported only by `/room/index.html` (stamped `?v=` via `_ASSET_RX`) and by `tests/academy/`.

### 7.2 `js/rtk-room-v2.js` — the `target` option
At the top of `mountRoomV2`: `const target = o.target || { kind: 'opil', session: o.session }`, then derive ONCE and pass only derived values down (no `session.` read survives outside this block):

| derived | OPIL (today's values) | room |
|---|---|---|
| `label` | `sessLabel(session) + ' · ' + session.title` | `target.title` |
| `startsAt` | `session.session_date + 'T19:00:00'` | `null` → *Starts when Nelson opens the room* |
| `autoKey` | `String(session.no)` | `'room:' + target.id` |
| `hands` | `{ table:'ea_opil_hands', col:'session_no', val:no, chan:'hands-'+no }` | `{ table:'ea_room_hands', col:'room_id', val:target.id, chan:'hands-room-'+id }` |
| `joinBody` | `{ session_no }` | `{ room: true, key }` (key null for members/host) |
| `words` | OPIL | ROOM |
| `facilitator` | `o.facilitator` | `words.host` |

Call sites the plan touches: L92 (label), L100/L194 (autoKey), L105 (join body), L233/L248 (startsAt, title), L317 (nowCopy + the inline recording suffix → `words.thing`), L376–396 (hands). `words` is also threaded into the templates that hard-code OPIL wording today — L235 (*Start class →* / *Enter Class →*), L236, L248, L249, L272 (*Recording · saves automatically for* `words.replayFor`), L371, L372, L384, L419, L425/L435, L443, L459 — each with its OPIL default. Error map gains `bad_link`, `room_full`, `slow_down`; `not_allowed` reads *You need Nelson's link or an Academy membership.* in room mode.

Behaviour changes in room mode only:
- the host's **Leave** does what *End class for everyone* does today (`participants.kickAll()` then `leave()`), confirm text *End the session for everyone?*; OPIL keeps plain Leave.
- `onState(state, meeting, reason)` gains a third argument `reason ∈ 'left' | 'kicked' | 'ended'` (L220 passes `ev.state` through); the first argument keeps today's values, so `opil/hub/live/index.html` is untouched.

Honest size: ~40 lines of the 480-line module change, all mechanical substitutions with OPIL defaults; the OPIL tests, the rebuilt OPIL harness (§10) and the prod check gate it.

### 7.3 `/room/index.html` (new, hand-written, listed in `HUB_PAGES`)
Loads `css/build-mode.css`, `css/rtk-room-v2.css`, `js/config.js`, `js/room-page.js`, and the same Google Fonts `<link>` as `live/index.html` (Inter + Space Grotesk — `build-mode.css` only names them); **not** `opil/hub/hub.js`, `hub.css` or `rtk-room.css`. The mount is `<div id="rtkMount"></div>` (`rtk-room-v2.css` keys every rule on `#rtkMount.r2host`). Own small header (logo + "Taylormade Academy"); one rule `body.in-room .room-ctl, body.in-room .site-header { display:none }`. Boot:
1. `k = roomKey(location.search)` (`[A-Za-z0-9_-]{22}` or null).
2. `sb.auth.getSession()`; `state = rpc('ea_room_state', { p_key: k })`.
3. `roomBranch(state)` (pure, unit-tested) → `dead_link` · `landing` (**Sign in to join** → `/login/?next=` + `encodeURIComponent('/room/' + (k ? '?k=' + k : ''))`) · `not_allowed` · `host_idle` (control with Start class) · `host_live` (control with *Class is running* + **End session**, AND `mountRoomV2` host mode **without** `onOpened` — reuses the meeting; `pendingRecord` → `record('start')` on `joined`, idempotent) · `waiting` (`mountRoomV2` waiting + 20 s poll; `location.reload()` when `is_live` flips — the auto-enter walks them in) · `student` (`mountRoomV2` student mode).
4. Host flow mirrors `opil/hub/live/index.html` in structure minus the `hosting` flag: `onOpened` → `update ea_rooms set is_live = true, live_since = now()` (admin RLS), `pendingRecord` → `record('start')` on `joined`, `onState('left')` as host → `record('stop')` then `is_live = false, ended_at = now()`; **End session** (control) does the same without entering. No `location.reload()` while hosting.
5. A guest in the room keeps the 20 s `ea_room_state` poll: `is_live` false → `room.leave()` + ended card (belt and braces for a host tab that died). `onState` reasons: `'ended'` / `'kicked'` → ended card; `'left'` (their own Leave) → *You left the room* + **Rejoin →** (reload).

### 7.4 `/live/index.html` (rewrite of the page body; header/footer/gate card kept)
- Drop: `js/broadcast.js`, `css/broadcast.css`, the demo clip, hls.js, `mountStream`, `ea_live` reads, `ea_live_chat` and its realtime channel, *End broadcast*.
- Every visitor: `rpc('ea_room_state')` → title + LIVE chip.
- Member stage: **Join the room →** or *Nothing is live right now* + **Last session**: `recording_url.replace(/\/watch$/, '/iframe')` in the existing 16:9 `.player` iframe (`allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"`) with *Open in a new tab* → the `/watch` page beneath (the `/watch` URL is Cloudflare's hosted page, not embeddable).
- Admin card per §2.1: `ea_rooms` read/update (title, max_participants — both save on blur), `ea_room_rotate_link`, `ea_room_replays` list (explicit columns) with Publish/Unpublish via `ea_room_publish_replay`, Retry via `ea-rtk-record {room:true, action:'retry_replay', replay_id}`, `ea_room_members` + `ea_profiles` names, `people` from the state RPC. Polls every 20 s while a session is live or a replay is preparing.
- "How live works" copy: 02 keeps *the room chat*; 03 becomes *The replay stays here — every published session, on this page, for members.*
- **Dead after this rewrite:** `js/broadcast.js`, `css/broadcast.css` and the `ea-live-publish` function have no remaining caller (a repo grep: only `live/index.html`; OPIL dropped them 9/14; `/agent/live/` uses `ea_live` + `ea_live_chat` only). Delete the two files (and their entries in `build_site.py`'s hash list and `_ASSET_RX`), delete the function directory and `supabase functions delete ea-live-publish`. `ea_live`, `ea_live_chat` and the Cloudflare Stream live input stay untouched.

### 7.5 Cache and build plumbing
`sw.js` `VERSION` → `tma-v21-academy-room` (this bump also frees the bare `/opil/hub/live-rooms.js` entry the old static import pinned). `build_site.py`: `room` added to `HUB_PAGES`; `js/room-page.js` added to the hash list and `_ASSET_RX`; broadcast entries removed. Run `build_site.py` and diff the generated pages before committing (it reverts hand edits to generated pages; `/live/` and `/room/` are hand-written and only get their `?v=` stamped).

## 8. Recording and replays
Identical to OPIL's loop (spec `2026-09-14-opil-auto-replays-design.md`): start on the host's `joined` → stop on Leave → RTK webhook RECORDING/UPLOADING/UPLOADED → Stream copy → `ea_room_replays.status = ready` → Nelson publishes from `/live/` → `ea_rooms.recording_url` → members see **Last session**. A failed copy shows *Replay failed — Retry* (by replay id, any session). Guests are told on the strip that the session is recorded; they never receive the replay in this build.

## 9. Security invariants (each has a test in §10)
1. No Cloudflare credential ever reaches a page: only per-person participant tokens, minted server-side; guests are not told the meeting id.
2. `meeting_id` and `link_key` are not writable from any page (column grants); no page insert into `ea_rooms`; the room branch never reads a client `meeting_id`.
3. Non-admins never read `ea_rooms`, `ea_room_members` or `ea_room_replays` directly; `ea_room_state` never returns `link_key`, `meeting_id`, or the title for a bad key.
4. A guest needs BOTH a signed-in account and (the current key OR membership); a rotated key refuses with `bad_link` at the server, not just the page.
5. Guests are refused while the room is off air or stale (`not_open`) and over the cap (`room_full`); join is rate-limited per user (and per IP, fail-open).
6. Every Academy replay row lands in `ea_room_replays`, never in `ea_opil_replays`; OPIL coordinators cannot read Academy rows; raw `download_url` has no select grant for authenticated.
7. Definer functions and views: revoke after create; no `to authenticated using (true)` anywhere new; policies never read a protected table inline (definer helpers instead).
8. `custom_participant_id` is the Supabase uid, never an email.
9. Hosts are `ea_is_admin()` only (Nelson). The host preset is unreachable from a key.
10. Every Start class is a new Cloudflare meeting and the previous one is set INACTIVE; a token from a previous session opens nothing.
11. **No OPIL role can obtain a token for, record, or file a replay of the room meeting** — the OPIL join and record branches refuse a room meeting; the webhook resolves rooms first.
12. A hand can only be raised by someone who joined the current session, and only with `room_id, user_id, kind, note`.

## 10. Testing and rollout

**Unit (`node --test tests/opil/*.test.mjs tests/academy/*.test.mjs`):** the 18 OPIL tests stay green with the `words` defaults; new: `words` ROOM strings incl. `waiting`; `roomKey`; `roomBranch` for every combination of `bad_link / signed_in / can_join / is_host / is_live` (incl. member with a stale key → `student`/`waiting`, never `dead_link`).

**Functions (`deno test`, stubbed fetch/supabase):** `ea-rtk-join/handler_test.ts` — OPIL branch (ported, incl. client `meeting_id` ignored, room meeting refused); room branch — every code in §6.4, rotated key, stale `is_live` (> 4 h), cap incl. the 404-means-0 case, rate limit fail-open, member without key, host creates + persists + inactivates the previous meeting, guest response carries no `meeting_id`. `ea-rtk-record`: room start/stop, `retry_replay` by id after a newer Start class, OPIL branch refuses a room meeting. `ea-rtk-webhook`: room-first lookup, replay-row fallback after `meeting_id` moved on, Stream name, `markFailed` reaching the room table.

**Pages (scratchpad Playwright harness, system Chrome, Supabase and the kit stubbed — never signs in to prod):** `/room/` — every `roomBranch` outcome, the host flow (Start → joined → recording → Leave → off air), `host_live` re-entry, guest poll → ended card, member off-air replay renders the `/iframe` URL; `/live/` — anon / non-member / member off-air / member live / admin (copy link, new link confirm, publish/unpublish, retry). **Before step 3 below:** rebuild the OPIL room-v2 harness from `docs/superpowers/plans/2026-09-14-opil-room-v2.md` and run its student path (waiting → reload → auto-enter → Ask a question → Bring on stage) against the changed module with OPIL defaults — that harness, not a prod click, is the gate for the 30 students on Wednesday.

**Rollout order (each step verified before the next):**
1. Migration 0036 — Nelson runs the staged script with `!`. Verify in a rolled-back transaction: `ea_room_new_key() ~ '^[A-Za-z0-9_-]{22}$'`; as `anon`: `ea_room_state()` shape, bad key → `{bad_link:true}`, zero rows from every room table; as `authenticated` with a `zz-test-` uid: `ea_rooms` insert → refused, update `meeting_id` → refused, `select download_url from ea_room_replays` → refused, hand insert with `staged_at` → refused, hand insert while not in session → `42501`, in session (a service-role membership row + live room) → ok; an OPIL-shaped `ea_opil_hands` insert as a cohort member → ok.
2. Deploy the three functions (`--no-verify-jwt`); `supabase functions delete ea-live-publish`. Call join once as Nelson from a scratch page to create the presets and the first meeting; confirm both presets (and the guest preset's `files: false`) on the Cloudflare dashboard.
3. Push pages + `sw.js` bump; verify on the bare URL.
4. **OPIL guard:** on prod, open `/opil/hub/live/?s=<a session that is NOT 9/16's — check `session_date` first; 02 was used for the 9/14 tests>`, Start class → Enter → Leave as Nelson; `?classic=1` still loads v1; delete the draft replay this creates in `ea_opil_replays`.
5. **Real run:** Nelson hosts in one browser; a second browser signs in as a `zz-test-` guest through the real link; check tile, chat, Ask a question → Bring on stage, share screen, cap message with `max_participants = 2`, New link → old link dead, Remove → ended card; Leave → replay ready → Publish → members see it on `/live/`; then delete the test rows, the test replay, and the Stream asset.

**Wednesday guard (OPIL orientation 9/16):** the OPIL fallback is a one-line commit flipping `ROOM_V2` in `opil/hub/live/index.html` + a Pages deploy (~2 min) — `?classic=1` is for Nelson/Jamal, not students; v1 (`js/rtk-room.js`) imports nothing that changes. The harness run in §10 Pages happens before step 3; steps 4 and 5 happen before the room is announced as done.

## 11. Risks and open items
- **Both surfaces untested with a second real person** until rollout step 5; the room v2 layout itself was verified solo on 9/14 only.
- **Costs**: ~$0.12 per person-hour of video + $0.60/h to record (rates verified 9/10); 50 × 1 h ≈ $6.60. The cap is the guard; a $50/mo Cloudflare billing alert is still recommended.
- **A member who is also removed** can rejoin without the key (membership admits); removing a member for good is a membership action, out of scope.
- **Within one session**, a removed guest who copied their participant token from devtools could rejoin the same meeting with the SDK (Remove does not revoke the token). Bounded to that session by the fresh-meeting + INACTIVE rule; not worth a token-revocation call in this build.
- **Native iOS wrapper**: the dashboard links `/live/`; the room inside the wrapper is untested (Google sign-in is hidden there; the email code works). Say "web-only for now" if he asks.
- **Ticket holders** (`/agent/live/`, Oct 3 workshop) keep their separate one-way room; whether a ticket should open this room is a later decision.

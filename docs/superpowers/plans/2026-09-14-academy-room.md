# Academy Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the OPIL class room to Taylormade Academy as one room at `taylormadeacademy.com/room/?k=<key>` that Nelson opens from `/live/` and shares by link with anyone, who signs in and walks in.

**Architecture:** One new migration (`ea_rooms` and three satellite tables behind one anon-callable state RPC), a room branch beside the OPIL branch in the three RealtimeKit edge functions (join / record / webhook), a `target` option on the shared room module `js/rtk-room-v2.js` whose default reproduces OPIL byte-for-byte, a new hand-written `/room/` page, and `/live/` rewritten as the members' door plus Nelson's "Your room" card. The camera broadcast and its function are retired. Every Start class is a fresh Cloudflare meeting; guests never learn the meeting id.

**Tech Stack:** Static GitHub Pages site (hand-written HTML + ES modules, `build_site.py` stamps `?v=`), Supabase (Postgres RLS + security-definer RPCs, Deno edge functions, `deno test` with std 0.224.0), Cloudflare RealtimeKit 2.0.2 (core IIFE + UI kit from jsdelivr) and Cloudflare Stream for replays, `node --test` for pure modules, a scratchpad Playwright harness on system Chrome for pages.

**Spec:** `docs/superpowers/specs/2026-09-14-academy-room-design.md` — read it first; the plan argues from it. The exact names every task shares are in the **Spine** section below.

## Global Constraints

- OPIL orientation is **Wednesday 2026-09-16**. Every OPIL string is reproduced byte-for-byte by default; `node --test tests/opil/*.test.mjs` (18 tests) stays green after every task; v1 (`?classic=1`, `js/rtk-room.js`) is not touched; the rebuilt OPIL harness (Task 7) is the gate before any deploy.
- No new shared module in front of OPIL pages: `opil/hub/live-rooms.js` keeps its file and every export; `js/rtk-room-v2.js` imports it with `await import('/opil/hub/live-rooms.js' + new URL(import.meta.url).search)`.
- SQL: `security definer set search_path = public`; revoke AFTER create; explicit column lists on replay tables; never `to authenticated using (true)`; policies never read a protected table inline (definer helpers).
- Edge functions: `verify_jwt` OFF (`--no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`), CORS `https://taylormadeacademy.com`, Deno std `0.224.0`.
- Claude never writes to prod: the migration is applied by Nelson with `! bash scripts/apply-0036.sh` (keychain token, curl only). Page tests never sign in to prod.
- Brand tokens from `css/build-mode.css` (`--navy --gold --hair --r --display --muted --gold-ink`); Space Grotesk + Inter via the same Google Fonts link `live/index.html` uses.
- Copy in plain words: "Nelson" not "the host", guests are "people" never "students"; every "saved" message names where the thing went.
- Commits small, prefixed `feat(academy)` / `fix(academy)` / `db(academy)` / `test(academy)` / `docs(academy)`, ending with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`; push only in Task 10.
- Error codes (spec §6.4): `sign_in · not_allowed · bad_link · not_open · room_full · slow_down · no_room · not_host · no_replay · nothing_to_retry · rtk_not_configured · cloudflare_<status>`.

---

## Spine — the names every task shares

This is the contract the tasks were written against. When a task and this section disagree, this section wins; when this section and the spec disagree, this section wins (it is more specific).

### File structure
| File | Task | Responsibility |
|---|---|---|
| `opil/hub/live-rooms.js` | T1 | + `OPIL_WORDS`, `ROOM_WORDS`, `capFirst`; `nowCopy`/`joinCopy` gain `words` param (defaults = OPIL) |
| `js/room-page.js` (new) | T1 | pure `/room/` logic: `roomKey`, `roomBranch`, `loginHref`, `joinErrorText` |
| `tests/academy/room-page.test.mjs`, `tests/academy/words.test.mjs` (new) | T1 | node tests |
| `supabase/migrations/0036_academy_room.sql` (new) | T2 | tables, RPCs, grants, rider on ea_opil_hands |
| `scripts/apply-0036.sh` (new, committed; reads keychain) + verify SQL | T2 | Nelson runs `! bash scripts/apply-0036.sh` |
| `supabase/functions/_shared/rtk_auth.ts` | T3 | `resolveCaller` + `academyAdmin`; `clientIp(req)` |
| `supabase/functions/ea-rtk-join/handler.ts`, `handler_test.ts` (new), `index.ts` (rewritten) | T3 (OPIL port + hardening), T4 (room branch) | |
| `supabase/functions/_shared/rtk_presets.ts` (new) + `scripts/rtk-presets/tma-class-host.json`, `tma-class-guest.json` (new); delete `tma-webinar-*.json` | T4 | preset bodies + `ensurePresets(cf)` |
| `supabase/functions/ea-rtk-record/handler.ts`, `handler_test.ts`, `index.ts` | T5 | room branch, `retry_replay` by `replay_id`, OPIL room-meeting refusal |
| `supabase/functions/ea-rtk-webhook/handler.ts`, `handler_test.ts`, `index.ts`; `_shared/replay_deps.ts` | T6 | `targetByMeeting`, routing, `markFailed` both tables |
| `js/rtk-room-v2.js` | T7 | `target` option; words threading; room-mode Leave = kickAll; `onState` reason; dynamic import |
| `room/index.html` (new) | T8 | the room page |
| `live/index.html` (rewrite) ; delete `js/broadcast.js`, `css/broadcast.css`, `supabase/functions/ea-live-publish/` ; `build_site.py`, `sw.js` | T9 | the door + Your room card; plumbing |
| `supabase/functions/README.md` | T9 | document ea-rtk-* + removal of ea-live-publish |
| rollout | T10 | apply, deploy, verify, OPIL guard, real run, cleanup, memory |

### T1 — words + room-page (exact)
```js
// opil/hub/live-rooms.js — ADD (keep every existing export and its behaviour)
export const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const OPIL_WORDS = Object.freeze({
  one: 'student', many: 'students', host: 'your facilitator', teaching: 'is teaching', thing: 'class',
  waiting: null, replayFor: 'your students',
  notAllowed: 'Your account is not in this cohort.', notOpen: 'The room opens when your facilitator starts the class.',
});
export const ROOM_WORDS = Object.freeze({
  one: 'person', many: 'people', host: 'Nelson', teaching: 'is live', thing: 'session',
  waiting: 'Nelson hasn’t started yet — we’ll bring you in the moment he does.', replayFor: 'members',
  notAllowed: 'You need Nelson’s link or an Academy membership.', notOpen: 'Nelson hasn’t started yet.',
});
// nowCopy({ facilitator, title, recording, breakout }, words = OPIL_WORDS):
//   breakout → unchanged
//   who = facilitator ? facilitator + ' ' + words.teaching + ': ' + title : capFirst(words.thing) + ' in progress: ' + title
//   recording ? who + ' · This ' + words.thing + ' is being recorded' : who
// joinCopy({ live, host, facilitator, joined, startsAt }, words = OPIL_WORDS):
//   n = Number(joined||0); people = n === 1 ? '1 ' + words.one + ' joined' : n + ' ' + words.many + ' joined'
//   host && live  → 'Your ' + words.thing + ' is running · ' + people
//   host && !live → 'This room is yours. Start the ' + words.thing + ' when you’re ready — ' + words.many + ' who have the link are waiting here.'
//   live          → (facilitator ? facilitator + ' is in the room' : 'The ' + words.thing + ' is running') + ' · ' + people
//   !live         → words.waiting ? words.waiting
//                   : startsAt ? capFirst(words.thing) + ' hasn’t started yet. You’re all set — it starts at ' + startsAt + ' and you’ll enter on your own.'
//                   : capFirst(words.thing) + ' hasn’t started yet. You’re all set — you’ll enter on your own when ' + (facilitator || words.host) + ' starts it.'
// (with OPIL_WORDS every existing test string is reproduced exactly)

// js/room-page.js (new, pure, no DOM)
export const KEY_RX = /^[A-Za-z0-9_-]{22}$/;
export function roomKey(search)            // ?k=… matching KEY_RX → the key, else null (bad URLSearchParams → null)
export function roomBranch(state)          // → 'error' | 'dead_link' | 'landing' | 'host_live' | 'host_idle' | 'not_allowed' | 'student' | 'waiting'
//   order: !state||typeof state!=='object' → 'error'; state.bad_link → 'dead_link'; !state.signed_in → 'landing';
//          state.is_host → (state.is_live ? 'host_live' : 'host_idle'); !state.can_join → 'not_allowed'; state.is_live ? 'student' : 'waiting'
export function loginHref(k)               // '/login/?next=' + encodeURIComponent('/room/' + (k ? '?k=' + k : ''))
export function joinErrorText(code, status, words)   // room-page wording for ea-rtk-join / ea-rtk-record errors:
//   sign_in 'Sign in again and retry.' · not_allowed words.notAllowed · bad_link 'This link isn’t active anymore — ask Nelson for the new one.'
//   not_open words.notOpen · room_full 'The room is full right now.' · slow_down 'Too many tries — wait a minute and try again.'
//   no_room 'The room isn’t open yet.' · not_host 'Only Nelson can do that.' · rtk_not_configured 'The room is not set up yet.'
//   anything else → 'The server said ' + status + '.'
export function statusLine(state)          // admin card: !state.is_live ? 'Off air' : 'Live now · ' + n + (n === 1 ? ' person' : ' people')  (n = Number(state.people||0))
export function replayLabel(row)           // {status,published} → 'Replay preparing' (invoked/recording/uploading/uploaded) | 'Replay ready — review, then publish' (ready&&!published) | 'Published ✓' (ready&&published) | 'Replay failed' (error)
export function iframeUrl(watchUrl)        // watchUrl.replace(/\/watch$/, '/iframe') (null-safe → null)
```

### T2 — migration 0036 (exact object names; bodies per spec §4)
Tables: `public.ea_rooms`, `public.ea_room_members`, `public.ea_room_hands`, `public.ea_room_replays`.
Functions: `ea_room_new_key() returns text` (volatile, definer, revoked from public/anon/authenticated) · `ea_room_state(p_key text default null) returns jsonb` (stable, definer, grant execute to anon, authenticated) · `ea_room_in_session(p_room uuid) returns boolean` (stable, definer, grant to authenticated) · `ea_room_rotate_link() returns text` (volatile, definer, grant to authenticated, raises 42501 unless ea_is_admin()) · `ea_room_publish_replay(p_replay uuid, p_publish boolean) returns jsonb` (volatile, definer, grant to authenticated, raises 42501 unless ea_is_admin(); P0002 when the replay is not ready).
`ea_room_state` result (jsonb): `{"id","title","is_live","host_name":"Nelson Taylor","signed_in","is_host","can_join","bad_link":false,"recording_url" (null unless ea_is_member()),"people" (null unless ea_is_admin())}` — or exactly `{"bad_link": true}`. `privileged := ea_is_admin() or ea_is_member()`; `can_join := privileged or (p_key is not null and p_key = r.link_key)`; `bad_link := not privileged and p_key is not null and p_key <> r.link_key`. The room = `select * from ea_rooms order by created_at limit 1`.
`ea_room_hands` columns: `id uuid pk default gen_random_uuid(), room_id uuid not null references ea_rooms(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, kind text not null default 'question' check (kind in ('question','comment')), note text check (note is null or char_length(note) <= 200), created_at timestamptz not null default now(), staged_at timestamptz, done_at timestamptz`. Indexes `ea_room_hands_open_idx (room_id, created_at) where done_at is null`, unique `ea_room_hands_one_open (room_id, user_id) where done_at is null`. Policies `room_hands_read`, `room_hands_insert`, `room_hands_update_host`, `room_hands_delete_own`. Grants: `revoke insert on ea_room_hands from authenticated; grant insert (room_id, user_id, kind, note) on ea_room_hands to authenticated;`. `alter publication supabase_realtime add table public.ea_room_hands` in the same do-block pattern as 0035.
`ea_room_replays` columns = 0033's minus `session_no`, plus `room_id uuid references ea_rooms(id) on delete set null`; `recording_id text not null unique`; indexes `ea_room_replays_room_idx (room_id, created_at desc)`, `ea_room_replays_meeting_idx (meeting_id, created_at desc)`; policy `room_replays_admin_read`; `revoke select on ea_room_replays from anon, authenticated, public; grant select (id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at) on ea_room_replays to authenticated;`.
`ea_room_members`: `room_id uuid references ea_rooms(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, first_joined_at timestamptz not null default now(), last_joined_at timestamptz not null default now(), joins int not null default 1, primary key (room_id, user_id)`; policy `room_members_admin_read`.
Rider: `revoke insert on public.ea_opil_hands from authenticated; grant insert (session_no, user_id, kind, note) on public.ea_opil_hands to authenticated;`
Final line: `select 'academy room ready' as status;`
Apply script `scripts/apply-0036.sh`: reads keychain token, POSTs the migration file as `{"query": …}` (jq -Rs), prints the result, then POSTs a VERIFY query wrapped in `begin; … rollback;` that: sets `role anon` → `select ea_room_state('x'::text)` = `{"bad_link":true}`, `select count(*) from ea_rooms` → permission denied (expected error text) … (the exact verify statements are T2's job; each expectation printed as a line `OK <check>` / `FAIL <check>`).

### T3/T4 — ea-rtk-join (exact)
```ts
// _shared/rtk_auth.ts
export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type Resolved = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; asUser: SupabaseClient };
export async function resolveCaller(req, admin, url, anonKey): Promise<Resolved | ResolveFail>   // adds academyAdmin = (await asUser.rpc('ea_is_admin')).data === true
export function clientIp(req: Request): string   // req.headers.get('cf-connecting-ip') || last non-empty entry of x-forwarded-for || 'unknown'
export function rtkClient(acct, app, token)      // unchanged; add "DELETE" to the method union is NOT needed; add "PATCH" already there

// ea-rtk-join/handler.ts
export type JoinBody = { room?: boolean; key?: string | null; session_no?: number; meeting_id?: string };
export type Caller = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; ip: string };
export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
export type RoomRow = { id: string; title: string; link_key: string; is_live: boolean; live_since: string | null; meeting_id: string | null; max_participants: number };
export type CfResult = { ok: boolean; status: number; data: unknown };
export type JoinDeps = {
  cf: (method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) => Promise<CfResult>;
  rateCheck: (key: string, max: number, windowSecs: number) => Promise<boolean | null>;   // null = limiter unavailable → treat as allowed
  getSession: (no: number) => Promise<SessionRow | null>;      // OPIL row, service role
  inCohort: () => Promise<boolean>;                             // rpc ea_opil_in_cohort AS CALLER
  isMember: () => Promise<boolean>;                             // rpc ea_is_member AS CALLER
  getRoom: () => Promise<RoomRow | null>;                       // order by created_at limit 1, service role
  setRoomMeeting: (roomId: string, meetingId: string) => Promise<void>;   // service role update: meeting_id AND is_live = true, live_since = now() (a fresh meeting is a fresh session — a stale live row admits people again on Nelson's re-entry)
  roomMeetingIds: () => Promise<Set<string>>;                   // ea_rooms.meeting_id ∪ ea_room_replays.meeting_id (non-null)
  upsertMember: (roomId: string, userId: string) => Promise<void>;
  displayName: (userId: string) => Promise<string | null>;      // ea_profiles.display_name
  ensurePresets: () => Promise<void>;
  now: () => Date;
};
export type Reply = { status: number; body: unknown };
export const PRESETS = ["opil-host", "opil-student", "opil-judge", "tma-class-host", "tma-class-guest"] as const;
export const OPEN_WINDOW_MS = 4 * 3600 * 1000;
export async function handleJoin(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply>
// OPIL branch (body.room !== true): exactly today's logic EXCEPT: body.meeting_id is ignored; after resolving meetingId (stored or host-created),
//   if (await deps.roomMeetingIds()).has(meetingId) → 403 not_allowed (before any participant POST). Response { token, meeting_id, preset, host, name }.
// Room branch (body.room === true), in order:
//   1 rate: (await deps.rateCheck('rtk-join:u:'+uid, 30, 600)) === false → 429 slow_down; same for 'rtk-join:ip:'+ctx.ip, 90, 600
//   2 room = await deps.getRoom(); !room → 503 rtk_not_configured
//   3 isHost = ctx.academyAdmin; key = typeof body.key === 'string' && /^[A-Za-z0-9_-]{22}$/.test(body.key) ? body.key : null
//     !isHost: allowed = (await deps.isMember()) || (key !== null && key === room.link_key); !allowed → key ? 404 bad_link : 403 not_allowed
//   4 open = room.is_live && room.live_since && (deps.now().getTime() - Date.parse(room.live_since)) < OPEN_WINDOW_MS; !isHost && !open → 409 not_open
//   5 meetingId: isHost && !open → POST /meetings { title: ('Academy · ' + room.title + ' · ' + YYYY-MM-DD in America/Chicago of deps.now()).slice(0,80), persist_chat:false } → !ok → 502 cloudflare_<status>; id → deps.setRoomMeeting; if room.meeting_id (previous) → best-effort PATCH /meetings/{prev} { status:'INACTIVE' } (ignore result)
//                isHost && open → room.meeting_id (if null → treat as !open: create as above)
//                guest → room.meeting_id (null → 409 not_open)
//   6 isHost → await deps.ensurePresets()
//   7 guest cap: r = GET /meetings/{id}/active-session; live = r.status === 404 ? 0 : Number((r.data as any)?.live_participants ?? 0); live >= room.max_participants → 429 room_full
//   8 name = (await deps.displayName(uid)) || (email||'Member').split('@')[0], slice(0,60); POST /meetings/{id}/participants { custom_participant_id: uid, preset_name: isHost ? 'tma-class-host' : 'tma-class-guest', name } → !ok → 502
//   9 await deps.upsertMember(room.id, uid)
//  10 return isHost ? { token, meeting_id, preset:'tma-class-host', host:true, name } : { token, preset:'tma-class-guest', host:false, name }
// index.ts: builds deps with the service-role client + rtkClient; ctx from resolveCaller + clientIp; rateCheck via admin.rpc('ea_rate_check', {p_key, p_max, p_window_secs}) returning data===true/false, null on error.

// _shared/rtk_presets.ts
export const PRESET_BODIES: Record<"tma-class-host" | "tma-class-guest", Record<string, unknown>>;   // the two JSON bodies, verbatim
export async function ensurePresets(cf: JoinDeps["cf"]): Promise<void>
//   GET /presets → names present (data is an array of {id,name,…}; tolerate {data:{data:[…]}} shapes by unwrapping arrays);
//   for each of the two: missing → POST /presets body; present && name==='tma-class-guest' && (permissions.chat.public.files !== false || permissions.chat.private.files !== false) → PATCH /presets/{id} body.
//   Caches success in a module-level boolean; never throws (log + return) — a preset failure must not block a join, the participant POST will 4xx and say cloudflare_<status>.
```

### T5 — ea-rtk-record (exact deltas)
```ts
export type RecordBody = { room?: boolean; replay_id?: string; session_no?: number; action?: "start" | "stop" | "retry_replay" | "register_webhook" | "list_webhooks" };
export type Caller = { user; role: Role; academyAdmin: boolean; functionsBase: string };
export type ReplayStore = {                      // one per table; the OPIL one is today's top-level deps (unchanged names)
  latestActive: (meetingId: string) => Promise<ActiveReplay | null>;
  latestAny: (meetingId: string) => Promise<{ recording_id: string; status: string } | null>;
  insertReplay: (row: { session_no?: number; room_id?: string; meeting_id: string; recording_id: string; status: string }) => Promise<void>;
  updateReplayStatus: (recordingId: string, status: string) => Promise<void>;
};
export type RecordDeps = /* today's fields, unchanged */ & {
  getRoom: () => Promise<{ id: string; meeting_id: string | null } | null>;
  roomMeetingIds: () => Promise<Set<string>>;
  room: ReplayStore & { replayById: (id: string) => Promise<{ id: string; room_id: string | null; meeting_id: string; recording_id: string; status: string } | null> };
};
// room branch (body.room === true): !ctx.academyAdmin → 403 not_host; retry_replay: replay_id required (400 bad_replay) → deps.room.replayById → null → 404 no_replay; status !== 'error' → 409 nothing_to_retry; payload = deps.uploadedEvent(recording_id) → null → 409 no_upload; deps.reprocess(payload) → 200 { recording_id, status }.
//   start/stop: room = deps.getRoom(); !room → 404 not_found; !room.meeting_id → 409 no_room; then today's start/stop logic against deps.room.* with insertReplay({ room_id: room.id, meeting_id, recording_id, status:'invoked' }).
// OPIL branch: unchanged + after meetingId resolved: (await deps.roomMeetingIds()).has(meetingId) → 403 not_allowed.
```

### T6 — ea-rtk-webhook (exact)
```ts
export type Target = { kind: "room"; room: { id: string; title: string | null; startedAt: string | null } } | { kind: "opil"; session: { no: number; title: string | null; kind: string | null } };
export type ReplayRow = { session_no?: number | null; room_id?: string | null; meeting_id; recording_id; status; download_url?; download_expires_at?; stream_uid?; watch_url?; duration_s?; file_size?; error? };
export type WebhookDeps = { dedupe; targetByMeeting: (meetingId: string) => Promise<Target | null>; upsertReplay: (row: ReplayRow, target: Target) => Promise<void>; streamCopy; subdomain; currentStatus: (recordingId: string, target: Target) => Promise<string | null> };
// handleEvent: unchanged flow; row gets room_id (room) or session_no (opil); Stream name: room → `Academy · ${title || 'session'} · ${date}` where date = (startedAt ? new Date(startedAt) : new Date()) formatted YYYY-MM-DD in America/Chicago via Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }); opil → unchanged 'OPIL S.. · title'.
// replay_deps.ts: targetByMeeting order: ea_rooms.meeting_id → ea_room_replays.meeting_id (latest, startedAt = created_at) → ea_opil_sessions.stream_url. upsertReplay/currentStatus route on target.kind. markFailed(admin, payload, message): update ea_room_replays by recording_id; if 0 rows, update ea_opil_replays.
// ea-rtk-record's reprocess keeps using replayDeps(admin, { dedupe:false }).
```

### T7 — js/rtk-room-v2.js (exact)
```js
// mountRoomV2(o): o = { mountEl, cfg, token, sb, user, mode:'waiting'|'student'|'host', meetingId?, facilitator?, onState?, onOpened?, session?, target? }
// target = o.target || { kind:'opil', session: o.session }
// derived once:
//   const isRoom = target.kind === 'room';
//   words = isRoom ? copy.ROOM_WORDS : copy.OPIL_WORDS
//   label = isRoom ? target.title : copy.sessLabel(session) + ' · ' + session.title
//   startsAt = isRoom ? null : (session.session_date ? new Date(session.session_date + 'T19:00:00').toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : null)
//   autoKey = isRoom ? 'room:' + target.id : String(session.no)
//   hands = isRoom ? { table:'ea_room_hands', col:'room_id', val:target.id, chan:'hands-room-' + target.id } : { table:'ea_opil_hands', col:'session_no', val:session.no, chan:'hands-' + session.no }
//   joinBody = isRoom ? { room:true, key: target.key || null } : (o.meetingId ? { session_no: session.no, meeting_id: o.meetingId } : { session_no: session.no })   // OPIL keeps sending meeting_id; the server now ignores it
//   facilitator = o.facilitator ?? (isRoom ? words.host : null)
// joinTarget(cfg, token, joinBody, words) error map: sign_in, not_allowed: words.notAllowed, not_open: words.notOpen, not_found, bad_link, room_full, slow_down, rtk_not_configured (strings as in room-page joinErrorText; OPIL strings unchanged)
// waiting mode: joinScreen({ label, title: isRoom ? target.title : session.title, startsAt, live:false, host:false, facilitator, joined:0, preview:false, words })
// onState(state, meeting, reason): 'joined' | 'left' | 'ended' as today; reason = ev.state ('left'|'kicked'|'ended') on roomLeft, 'left' for our own leave
// host Leave in room mode: leaveNow() → if (isRoom && host) { try { await current.participants.kickAll?.() } catch {} } then current.leave()
// confirm text: leave button label = isRoom && host ? 'End the session for everyone?' : 'Leave class?'
// strings threaded through words (defaults reproduce today's text): enter button ('Start class →'/'Enter Class →' → capFirst? NO: keep 'Start ' + words.thing + ' →' / 'Enter ' + capFirst(words.thing) + ' →'), 'You’ll be muted when you join…' unchanged, 'Starts when ' + words.host + ' opens it', words.host + ' will know you’re here.' (OPIL: 'Your facilitator will know you’re here.' — use capFirst(words.host) + ' will know you’re here.'), 'Recording · saves automatically for ' + words.replayFor, nameOf fallback capFirst(words.one) ('Student'/'Person'), 'When a ' + words.one + ' presses Ask a question, they appear here in order.', 'That ' + words.one, share tool: capFirst(words.many) + ' see your screen instead of the grid', 'End ' + words.thing + ' for everyone' (button + confirm 'End ' + words.thing + ' for everyone?'), help: 'Only if ' + words.host + ' asks', leave confirm 'Leave ' + words.thing + '?', strip suffix ' · This ' + words.thing + ' is being recorded'.
// return { meetingId, host, leave, setRecording }  (unchanged)
```
`css/rtk-room-v2.css` unchanged (keys on `#rtkMount.r2host`).

### T8 — room/index.html (exact ids)
Head: same Google Fonts link as live/index.html line 8; `/css/build-mode.css`, `/css/rtk-room-v2.css`, `/js/config.js`, module script importing `/js/room-page.js` and `https://esm.sh/@supabase/supabase-js@2`. Body: `<header class="site-header">` (logo + "Taylormade Academy" + a `/live/` link for members), `<main><div class="wrap"><section id="card"></section><section id="roomCtl" class="room-ctl" hidden></section><div id="rtkMount"></div></div></main>`. Control ids: `#rTitle`, `#rLink` (input readonly), `#rCopy`, `#rStart`, `#rEnd` (hidden unless live), `#rNote`, `#rRec` (chip, hidden). CSS: `body.in-room .room-ctl, body.in-room .site-header, body.in-room #card { display:none }`.
Boot per spec §7.3 using `roomKey`, `roomBranch`, `loginHref`, `joinErrorText`; poll `ea_room_state` every 20 000 ms while `waiting` and while a guest is in the room; host writes `ea_rooms` via `sb.from('ea_rooms').update({...}).eq('id', state.id)`; record via `fetch(cfg.FUNCTIONS_BASE + '/ea-rtk-record', { body: JSON.stringify({ room:true, action }) })`.

### T9 — live/index.html (exact ids) + plumbing
Keep header/footer/gate card markup and the `.gatecard/.airchip/.lockroom/.hiw` CSS. Remove the broadcast link/script lines (154–157), DEMO, hls/mountStream, chat, ea_live. Admin card `#admin` → `.adminbar` with `#yrLink #yrCopy #yrNew #yrTitle #yrMax #yrOpen #yrStatus #yrReplays #yrPeople #yrNote`. Member stage: `#stage` → `#joinRoom` button or `.player` iframe `#replayFrame` + `#replayOpen`. `build_site.py`: hash list + `_ASSET_RX` gain `js/room-page.js`, lose `js/broadcast.js`, `css/broadcast.css`; `HUB_PAGES` gains `"room"`. `sw.js` VERSION `'tma-v21-academy-room'`. Delete `js/broadcast.js`, `css/broadcast.css`, `supabase/functions/ea-live-publish/`. README functions table: add ea-rtk-join/record/webhook rows (secrets CF_ACCOUNT_ID, CF_RTK_APP_ID, CF_RTK_API_TOKEN, CF_API_TOKEN, CF_STREAM_SUBDOMAIN), remove ea-live-publish.

### Harness convention (T7/T8/T9)
Scratchpad Playwright harness (`/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/*.mjs`), system Chrome via `playwright` npm package installed in the scratchpad (`npm i playwright@1.47.2` there; `chromium.launch({ channel: 'chrome', headless: true })`), a static server on 127.0.0.1:8770 serving the repo root, and `page.route()` stubs for `https://esm.sh/@supabase/supabase-js@2` (a fake createClient with programmable rpc/from/auth/channel), `cdn.jsdelivr.net/npm/@cloudflare/*` (a fake RealtimeKitClient + custom elements), and `*.functions.supabase.co/*`. NEVER a real Supabase session. Each harness prints `PASS <name>` / `FAIL <name>` lines and exits non-zero on any FAIL.


---

### Task 1: Words + the /room/ page logic (pure JS, node tests)

Repo root is `/Users/nelsontaylor/taylormade-academy`, branch `domain-migration`, HEAD `cb0f080`, clean tree. Every command below starts with `cd` into it so it pastes from anywhere. Do **not** run `build_site.py` in this task (Task 9 restamps the `?v=` on the OPIL pages; the OPIL pages import `/opil/hub/live-rooms.js?v=3ef77ddd84` and keep working because every existing export keeps its name and behaviour). Do not push.

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/js/room-page.js`
- Create: `/Users/nelsontaylor/taylormade-academy/tests/academy/words.test.mjs`
- Create: `/Users/nelsontaylor/taylormade-academy/tests/academy/room-page.test.mjs`
- Modify: `/Users/nelsontaylor/taylormade-academy/opil/hub/live-rooms.js:54-59` (nowCopy) and `:74-82` (joinCopy)
- Test: `tests/academy/words.test.mjs`, `tests/academy/room-page.test.mjs`, plus the untouched `tests/opil/*.test.mjs` (18 tests) — run `node --test tests/opil/*.test.mjs tests/academy/*.test.mjs`

**Interfaces:**
- Consumes: today's `nowCopy({ facilitator, title, recording, breakout })` (`opil/hub/live-rooms.js:55`) and `joinCopy({ live, host, facilitator, joined, startsAt })` (`:75`); the `ea_room_state` jsonb shape from spine §T2 (`bad_link, signed_in, is_host, can_join, is_live, people`); the error codes from spec §6.4 (`sign_in · not_allowed · bad_link · not_open · room_full · slow_down · no_room · not_host · rtk_not_configured · cloudflare_<status>`); the `ea_room_replays.status` values from 0033 (`invoked, recording, uploading, uploaded, ready, error`).
- Produces (from `opil/hub/live-rooms.js`, used by Task 7 `js/rtk-room-v2.js`): `capFirst(s)`, `OPIL_WORDS`, `ROOM_WORDS` (frozen objects with keys `one, many, host, teaching, thing, waiting, replayFor, notAllowed, notOpen`), `nowCopy(o, words = OPIL_WORDS)`, `joinCopy(o, words = OPIL_WORDS)`.
- Produces (from `js/room-page.js`, used by Task 8 `room/index.html` and Task 9 `live/index.html`): `KEY_RX` (= `/^[A-Za-z0-9_-]{22}$/`, the same regex Task 3/4's `handleJoin` step 3 uses), `roomKey(search)`, `roomBranch(state)` → `'error' | 'dead_link' | 'landing' | 'host_live' | 'host_idle' | 'not_allowed' | 'student' | 'waiting'`, `loginHref(k)`, `joinErrorText(code, status, words)`, `statusLine(state)`, `replayLabel(row)`, `iframeUrl(watchUrl)`.

- [ ] **Step 1: Write the failing words test**

Create `tests/academy/` and write this file in full:

```bash
cd /Users/nelsontaylor/taylormade-academy && mkdir -p tests/academy
```

`tests/academy/words.test.mjs`:

```js
// tests/academy/words.test.mjs — run: node --test tests/opil/*.test.mjs tests/academy/*.test.mjs
// The room's words (ROOM_WORDS) through the same nowCopy/joinCopy the OPIL class room uses,
// and the proof that the OPIL defaults did not move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../opil/hub/live-rooms.js';
import { capFirst, OPIL_WORDS, ROOM_WORDS, nowCopy, joinCopy } from '../../opil/hub/live-rooms.js';

test('live-rooms.js keeps every OPIL export and adds exactly capFirst, OPIL_WORDS, ROOM_WORDS', () => {
  assert.deepEqual(Object.keys(mod).sort(), [
    'OPIL_WORDS', 'ROOM_WORDS', 'capFirst', 'joinCopy', 'liveListHTML', 'nextInLine', 'nowCopy', 'pickRoom',
    'queueOrder', 'queuePosition', 'roomFromQuery', 'roomPath', 'sessLabel', 'stateCopy', 'useV2',
  ]);
});

test('OPIL_WORDS and ROOM_WORDS are frozen and carry the same keys', () => {
  assert.equal(Object.isFrozen(OPIL_WORDS), true);
  assert.equal(Object.isFrozen(ROOM_WORDS), true);
  const keys = ['one', 'many', 'host', 'teaching', 'thing', 'waiting', 'replayFor', 'notAllowed', 'notOpen'];
  assert.deepEqual(Object.keys(OPIL_WORDS).sort(), keys.slice().sort());
  assert.deepEqual(Object.keys(ROOM_WORDS).sort(), keys.slice().sort());
  assert.deepEqual(OPIL_WORDS, {
    one: 'student', many: 'students', host: 'your facilitator', teaching: 'is teaching', thing: 'class',
    waiting: null, replayFor: 'your students',
    notAllowed: 'Your account is not in this cohort.', notOpen: 'The room opens when your facilitator starts the class.',
  });
  assert.deepEqual(ROOM_WORDS, {
    one: 'person', many: 'people', host: 'Nelson', teaching: 'is live', thing: 'session',
    waiting: 'Nelson hasn’t started yet — we’ll bring you in the moment he does.', replayFor: 'members',
    notAllowed: 'You need Nelson’s link or an Academy membership.', notOpen: 'Nelson hasn’t started yet.',
  });
});

test('capFirst capitalises the first letter only', () => {
  assert.equal(capFirst('class'), 'Class');
  assert.equal(capFirst('session'), 'Session');
  assert.equal(capFirst('your facilitator'), 'Your facilitator');
  assert.equal(capFirst('Nelson'), 'Nelson');
  assert.equal(capFirst(''), '');
});

test('nowCopy: the OPIL default and an explicit OPIL_WORDS give the exact strings tests/opil/room-v2.test.mjs checks', () => {
  const a = { facilitator: 'Casey Dike', title: 'Your AI Toolkit', recording: true };
  const b = { facilitator: null, title: 'Your AI Toolkit', recording: false };
  const c = { facilitator: 'Casey Dike', title: 'Your AI Toolkit', recording: true, breakout: { name: 'Data Divas', left: '11:42' } };
  assert.equal(nowCopy(a), 'Casey Dike is teaching: Your AI Toolkit · This class is being recorded');
  assert.equal(nowCopy(b), 'Class in progress: Your AI Toolkit');
  assert.equal(nowCopy(c), 'Small groups · Data Divas · 11:42 left');
  assert.equal(nowCopy(a, OPIL_WORDS), nowCopy(a));
  assert.equal(nowCopy(b, OPIL_WORDS), nowCopy(b));
  assert.equal(nowCopy(c, OPIL_WORDS), nowCopy(c));
});

test('nowCopy with ROOM_WORDS: Nelson is live, a session in progress, recorded, and breakout unchanged', () => {
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'Taylormade Academy Live', recording: true }, ROOM_WORDS),
    'Nelson is live: Taylormade Academy Live · This session is being recorded');
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'Taylormade Academy Live', recording: false }, ROOM_WORDS),
    'Nelson is live: Taylormade Academy Live');
  assert.equal(nowCopy({ facilitator: null, title: 'Office hours', recording: false }, ROOM_WORDS),
    'Session in progress: Office hours');
  assert.equal(nowCopy({ facilitator: null, title: 'Office hours', recording: true }, ROOM_WORDS),
    'Session in progress: Office hours · This session is being recorded');
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'x', recording: true, breakout: { name: 'Table 2' } }, ROOM_WORDS),
    'Small groups · Table 2');
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'x', recording: true, breakout: { name: 'Table 2', left: '4:10' } }, ROOM_WORDS),
    'Small groups · Table 2 · 4:10 left');
});

test('joinCopy: the OPIL default and an explicit OPIL_WORDS give the exact strings tests/opil/room-v2.test.mjs checks', () => {
  const cases = [
    [{ live: true, host: false, facilitator: 'Casey Dike', joined: 26 }, 'Casey Dike is in the room · 26 students joined'],
    [{ live: true, host: false, facilitator: null, joined: 1 }, 'The class is running · 1 student joined'],
    [{ live: false, host: false, facilitator: 'Casey Dike', startsAt: '7:00 PM' }, 'Class hasn’t started yet. You’re all set — it starts at 7:00 PM and you’ll enter on your own.'],
    [{ live: false, host: false, facilitator: 'Casey Dike', startsAt: null }, 'Class hasn’t started yet. You’re all set — you’ll enter on your own when Casey Dike starts it.'],
    [{ live: false, host: false, facilitator: null, startsAt: null }, 'Class hasn’t started yet. You’re all set — you’ll enter on your own when your facilitator starts it.'],
    [{ live: false, host: true, facilitator: 'Casey Dike' }, 'This room is yours. Start the class when you’re ready — students who have the link are waiting here.'],
    [{ live: true, host: true, facilitator: 'Casey Dike', joined: 3 }, 'Your class is running · 3 students joined'],
    [{ live: true, host: true, facilitator: 'Casey Dike' }, 'Your class is running · 0 students joined'],
  ];
  for (const [input, want] of cases) {
    assert.equal(joinCopy(input), want);
    assert.equal(joinCopy(input, OPIL_WORDS), want);
  }
});

test('joinCopy with ROOM_WORDS: not live and not Nelson → the waiting sentence, whatever startsAt or facilitator say', () => {
  const want = 'Nelson hasn’t started yet — we’ll bring you in the moment he does.';
  assert.equal(joinCopy({ live: false, host: false }, ROOM_WORDS), want);
  assert.equal(joinCopy({ live: false, host: false, facilitator: 'Nelson', joined: 4 }, ROOM_WORDS), want);
  assert.equal(joinCopy({ live: false, host: false, facilitator: null, startsAt: '7:00 PM' }, ROOM_WORDS), want);
});

test('joinCopy with ROOM_WORDS: live and host sentences count people', () => {
  assert.equal(joinCopy({ live: true, host: false, facilitator: 'Nelson', joined: 12 }, ROOM_WORDS), 'Nelson is in the room · 12 people joined');
  assert.equal(joinCopy({ live: true, host: false, facilitator: 'Nelson', joined: 1 }, ROOM_WORDS), 'Nelson is in the room · 1 person joined');
  assert.equal(joinCopy({ live: true, host: false, facilitator: null, joined: 1 }, ROOM_WORDS), 'The session is running · 1 person joined');
  assert.equal(joinCopy({ live: true, host: false, facilitator: null, joined: 0 }, ROOM_WORDS), 'The session is running · 0 people joined');
  assert.equal(joinCopy({ live: false, host: true }, ROOM_WORDS), 'This room is yours. Start the session when you’re ready — people who have the link are waiting here.');
  assert.equal(joinCopy({ live: true, host: true, joined: 3 }, ROOM_WORDS), 'Your session is running · 3 people joined');
  assert.equal(joinCopy({ live: true, host: true, joined: 1 }, ROOM_WORDS), 'Your session is running · 1 person joined');
});

test('joinCopy without a waiting sentence falls through to the hasn’t-started sentences, capitalised from words.thing', () => {
  const noWait = Object.freeze({ ...ROOM_WORDS, waiting: null });
  assert.equal(joinCopy({ live: false, host: false, startsAt: '7:00 PM' }, noWait),
    'Session hasn’t started yet. You’re all set — it starts at 7:00 PM and you’ll enter on your own.');
  assert.equal(joinCopy({ live: false, host: false, facilitator: null, startsAt: null }, noWait),
    'Session hasn’t started yet. You’re all set — you’ll enter on your own when Nelson starts it.');
  assert.equal(joinCopy({ live: false, host: false, facilitator: 'Casey Dike', startsAt: null }, noWait),
    'Session hasn’t started yet. You’re all set — you’ll enter on your own when Casey Dike starts it.');
});
```

- [ ] **Step 2: Run it and watch it fail on the missing exports**

(The combined glob only works once `tests/academy/` has a file — zsh prints `no matches found` otherwise, which is why Step 1 came first.)

```bash
cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs tests/academy/*.test.mjs 2>&1 | grep -v "^✔"
```

Expected (the 18 OPIL tests pass; the new file cannot even load):

```
SyntaxError: The requested module '../../opil/hub/live-rooms.js' does not provide an export named 'OPIL_WORDS'
...
✖ tests/academy/words.test.mjs
ℹ tests 19
ℹ pass 18
ℹ fail 1
```

- [ ] **Step 3: Add the words to `opil/hub/live-rooms.js` (two edits, nothing else in the file changes)**

Edit A — replace today's lines 54–59:

```js
/* the "what's happening now" strip */
export function nowCopy({ facilitator, title, recording, breakout }) {
  if (breakout) return 'Small groups · ' + breakout.name + (breakout.left ? ' · ' + breakout.left + ' left' : '');
  const who = facilitator ? facilitator + ' is teaching: ' + title : 'Class in progress: ' + title;
  return recording ? who + ' · This class is being recorded' : who;
}
```

with:

```js
/* The words that differ between the OPIL class room and Nelson's Academy room. Every helper
   below defaults to OPIL_WORDS, so the OPIL pages read exactly what they read before. */
export const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const OPIL_WORDS = Object.freeze({
  one: 'student', many: 'students', host: 'your facilitator', teaching: 'is teaching', thing: 'class',
  waiting: null, replayFor: 'your students',
  notAllowed: 'Your account is not in this cohort.', notOpen: 'The room opens when your facilitator starts the class.',
});
export const ROOM_WORDS = Object.freeze({
  one: 'person', many: 'people', host: 'Nelson', teaching: 'is live', thing: 'session',
  waiting: 'Nelson hasn’t started yet — we’ll bring you in the moment he does.', replayFor: 'members',
  notAllowed: 'You need Nelson’s link or an Academy membership.', notOpen: 'Nelson hasn’t started yet.',
});

/* the "what's happening now" strip */
export function nowCopy({ facilitator, title, recording, breakout }, words = OPIL_WORDS) {
  if (breakout) return 'Small groups · ' + breakout.name + (breakout.left ? ' · ' + breakout.left + ' left' : '');
  const who = facilitator ? facilitator + ' ' + words.teaching + ': ' + title : capFirst(words.thing) + ' in progress: ' + title;
  return recording ? who + ' · This ' + words.thing + ' is being recorded' : who;
}
```

Edit B — replace today's lines 74–82 (after Edit A they sit at 88–96; match on the text):

```js
/* the sentence under the title on the join screen */
export function joinCopy({ live, host, facilitator, joined, startsAt }) {
  const n = Number(joined || 0), students = n === 1 ? '1 student joined' : n + ' students joined';
  if (host) return live ? 'Your class is running · ' + students : 'This room is yours. Start the class when you’re ready — students who have the link are waiting here.';
  if (live) return (facilitator ? facilitator + ' is in the room' : 'The class is running') + ' · ' + students;
  return startsAt
    ? 'Class hasn’t started yet. You’re all set — it starts at ' + startsAt + ' and you’ll enter on your own.'
    : 'Class hasn’t started yet. You’re all set — you’ll enter on your own when ' + (facilitator || 'your facilitator') + ' starts it.';
}
```

with:

```js
/* the sentence under the title on the join screen; words.waiting (the Academy room) replaces
   the two "hasn’t started yet" sentences because that room has no scheduled start time */
export function joinCopy({ live, host, facilitator, joined, startsAt }, words = OPIL_WORDS) {
  const n = Number(joined || 0), people = n === 1 ? '1 ' + words.one + ' joined' : n + ' ' + words.many + ' joined';
  if (host) return live ? 'Your ' + words.thing + ' is running · ' + people : 'This room is yours. Start the ' + words.thing + ' when you’re ready — ' + words.many + ' who have the link are waiting here.';
  if (live) return (facilitator ? facilitator + ' is in the room' : 'The ' + words.thing + ' is running') + ' · ' + people;
  if (words.waiting) return words.waiting;
  return startsAt
    ? capFirst(words.thing) + ' hasn’t started yet. You’re all set — it starts at ' + startsAt + ' and you’ll enter on your own.'
    : capFirst(words.thing) + ' hasn’t started yet. You’re all set — you’ll enter on your own when ' + (facilitator || words.host) + ' starts it.';
}
```

Lines 1–53 and 60–73 (`queueOrder`, `queuePosition`, `nextInLine`, everything above `nowCopy`) are byte-identical to today. The file ends at line 98. `git diff --stat opil/hub/live-rooms.js` should read `1 file changed, 26 insertions(+), 10 deletions(-)`.

- [ ] **Step 4: Run green — 27 tests, the 18 OPIL ones untouched**

```bash
cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs tests/academy/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected:

```
ℹ tests 27
ℹ pass 27
ℹ fail 0
```

The OPIL proof is two-fold: `tests/opil/room-v2.test.mjs` (unchanged, its `nowCopy`/`joinCopy` tests call with one argument) still passes, and the words test's two "OPIL default and an explicit OPIL_WORDS" tests pin every string from that file a second time.

- [ ] **Step 5: Commit the words**

```bash
cd /Users/nelsontaylor/taylormade-academy && git add opil/hub/live-rooms.js tests/academy/words.test.mjs && git commit -m "feat(academy): room words — OPIL_WORDS, ROOM_WORDS, capFirst; nowCopy/joinCopy take words, OPIL defaults unchanged" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Write the failing room-page test**

`tests/academy/room-page.test.mjs`:

```js
// tests/academy/room-page.test.mjs — run: node --test tests/opil/*.test.mjs tests/academy/*.test.mjs
// The pure decisions /room/ makes from the URL and from ea_room_state(). No DOM, no supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_RX, roomKey, roomBranch, loginHref, joinErrorText, statusLine, replayLabel, iframeUrl } from '../../js/room-page.js';
import { OPIL_WORDS, ROOM_WORDS } from '../../opil/hub/live-rooms.js';

const KEY = 'AbC123_-xyzXYZ0987ab-_';   // 22 chars, the shape ea_room_new_key() mints

test('KEY_RX: exactly 22 url-safe base64 characters', () => {
  assert.equal(KEY.length, 22);
  assert.equal(KEY_RX.test(KEY), true);
  assert.equal(KEY_RX.test(KEY.slice(0, 21)), false);
  assert.equal(KEY_RX.test(KEY + 'A'), false);
  assert.equal(KEY_RX.test('AbC123+-xyzXYZ0987ab-_'), false);   // + is not url-safe
  assert.equal(KEY_RX.test('AbC123/-xyzXYZ0987ab-_'), false);   // / is not url-safe
  assert.equal(KEY_RX.test('AbC123_-xyzXYZ0987ab-='), false);   // padding never appears
  assert.equal(KEY_RX.test(''), false);
});

test('roomKey reads a 22-char url-safe ?k=, nothing else', () => {
  assert.equal(roomKey('?k=' + KEY), KEY);
  assert.equal(roomKey('?x=1&k=' + KEY), KEY);
  assert.equal(roomKey('?k=' + KEY + '&tour=1'), KEY);
  for (const bad of ['', '?', '?k=', '?x=1', '?k=' + KEY.slice(0, 21), '?k=' + KEY + 'A', '?k=AbC123+-xyzXYZ0987ab-_', '?k=' + KEY.replace('_', ' ')]) {
    assert.equal(roomKey(bad), null, JSON.stringify(bad));
  }
  assert.equal(roomKey(undefined), null);
  assert.equal(roomKey(null), null);
});

test('roomKey survives a search it cannot parse', () => {
  const explodes = { [Symbol.iterator]() { throw new Error('boom'); } };
  assert.equal(roomKey(explodes), null);
});

/* every combination of the five flags ea_room_state() returns, in the order the page decides:
   bad_link → signed_in → is_host → can_join → is_live */
const F = (bad_link, signed_in, is_host, can_join, is_live) => ({ bad_link, signed_in, is_host, can_join, is_live });
test('roomBranch: all 32 combinations of bad_link / signed_in / is_host / can_join / is_live', () => {
  const table = [
    // bad_link wins over everything (the server sends {bad_link:true} alone, but the order must hold for any shape)
    [F(true, false, false, false, false), 'dead_link'], [F(true, false, false, false, true), 'dead_link'],
    [F(true, false, false, true, false), 'dead_link'], [F(true, false, false, true, true), 'dead_link'],
    [F(true, false, true, false, false), 'dead_link'], [F(true, false, true, false, true), 'dead_link'],
    [F(true, false, true, true, false), 'dead_link'], [F(true, false, true, true, true), 'dead_link'],
    [F(true, true, false, false, false), 'dead_link'], [F(true, true, false, false, true), 'dead_link'],
    [F(true, true, false, true, false), 'dead_link'], [F(true, true, false, true, true), 'dead_link'],
    [F(true, true, true, false, false), 'dead_link'], [F(true, true, true, false, true), 'dead_link'],
    [F(true, true, true, true, false), 'dead_link'], [F(true, true, true, true, true), 'dead_link'],
    // signed out → the sign-in card, whatever the rest says
    [F(false, false, false, false, false), 'landing'], [F(false, false, false, false, true), 'landing'],
    [F(false, false, false, true, false), 'landing'], [F(false, false, false, true, true), 'landing'],
    [F(false, false, true, false, false), 'landing'], [F(false, false, true, false, true), 'landing'],
    [F(false, false, true, true, false), 'landing'], [F(false, false, true, true, true), 'landing'],
    // Nelson: live or idle, can_join is irrelevant for him
    [F(false, true, true, false, false), 'host_idle'], [F(false, true, true, false, true), 'host_live'],
    [F(false, true, true, true, false), 'host_idle'], [F(false, true, true, true, true), 'host_live'],
    // a signed-in person who cannot join
    [F(false, true, false, false, false), 'not_allowed'], [F(false, true, false, false, true), 'not_allowed'],
    // a signed-in person who can join: in when live, waiting when not
    [F(false, true, false, true, false), 'waiting'], [F(false, true, false, true, true), 'student'],
  ];
  assert.equal(table.length, 32);
  for (const [state, want] of table) assert.equal(roomBranch(state), want, JSON.stringify(state));
});

test('roomBranch: the exact shapes ea_room_state() returns', () => {
  // a dead or rotated key for a non-member: the function returns only this
  assert.equal(roomBranch({ bad_link: true }), 'dead_link');
  // a member (or Nelson) holding a stale key: privileged, so bad_link is false and can_join is true → never dead_link
  const memberStaleKey = { id: 'r1', title: 'Taylormade Academy Live', is_live: false, host_name: 'Nelson Taylor', signed_in: true, is_host: false, can_join: true, bad_link: false, recording_url: null, people: null };
  assert.equal(roomBranch(memberStaleKey), 'waiting');
  assert.equal(roomBranch({ ...memberStaleKey, is_live: true }), 'student');
  // Nelson with a stale key
  assert.equal(roomBranch({ ...memberStaleKey, is_host: true, people: 0 }), 'host_idle');
  assert.equal(roomBranch({ ...memberStaleKey, is_host: true, is_live: true, people: 12 }), 'host_live');
  // signed out, no key
  assert.equal(roomBranch({ id: 'r1', title: 'Taylormade Academy Live', is_live: true, host_name: 'Nelson Taylor', signed_in: false, is_host: false, can_join: false, bad_link: false, recording_url: null, people: null }), 'landing');
  // signed in, no key, not a member
  assert.equal(roomBranch({ id: 'r1', title: 'Taylormade Academy Live', is_live: true, host_name: 'Nelson Taylor', signed_in: true, is_host: false, can_join: false, bad_link: false, recording_url: null, people: null }), 'not_allowed');
});

test('roomBranch: anything that is not an object is an error', () => {
  for (const bad of [null, undefined, '', 'x', 0, 42, true]) assert.equal(roomBranch(bad), 'error', String(bad));
});

test('loginHref keeps the key through sign-in', () => {
  assert.equal(loginHref(KEY), '/login/?next=%2Froom%2F%3Fk%3D' + KEY);
  assert.equal(loginHref(null), '/login/?next=%2Froom%2F');
  assert.equal(loginHref(undefined), '/login/?next=%2Froom%2F');
  assert.equal(loginHref(''), '/login/?next=%2Froom%2F');
  assert.equal(decodeURIComponent(loginHref(KEY).slice('/login/?next='.length)), '/room/?k=' + KEY);
});

test('joinErrorText: every code ea-rtk-join / ea-rtk-record send, in the room’s words', () => {
  assert.equal(joinErrorText('sign_in', 401, ROOM_WORDS), 'Sign in again and retry.');
  assert.equal(joinErrorText('not_allowed', 403, ROOM_WORDS), 'You need Nelson’s link or an Academy membership.');
  assert.equal(joinErrorText('bad_link', 404, ROOM_WORDS), 'This link isn’t active anymore — ask Nelson for the new one.');
  assert.equal(joinErrorText('not_open', 409, ROOM_WORDS), 'Nelson hasn’t started yet.');
  assert.equal(joinErrorText('room_full', 429, ROOM_WORDS), 'The room is full right now.');
  assert.equal(joinErrorText('slow_down', 429, ROOM_WORDS), 'Too many tries — wait a minute and try again.');
  assert.equal(joinErrorText('no_room', 409, ROOM_WORDS), 'The room isn’t open yet.');
  assert.equal(joinErrorText('not_host', 403, ROOM_WORDS), 'Only Nelson can do that.');
  assert.equal(joinErrorText('rtk_not_configured', 503, ROOM_WORDS), 'The room is not set up yet.');
  assert.equal(joinErrorText('cloudflare_502', 502, ROOM_WORDS), 'The server said 502.');
  assert.equal(joinErrorText(undefined, 500, ROOM_WORDS), 'The server said 500.');
  assert.equal(joinErrorText('nothing_to_retry', 409, ROOM_WORDS), 'The server said 409.');
  // the two words-driven lines read the OPIL words when given OPIL_WORDS
  assert.equal(joinErrorText('not_allowed', 403, OPIL_WORDS), 'Your account is not in this cohort.');
  assert.equal(joinErrorText('not_open', 409, OPIL_WORDS), 'The room opens when your facilitator starts the class.');
});

test('statusLine: Off air, or Live now with the head count', () => {
  assert.equal(statusLine({ is_live: false, people: 5 }), 'Off air');
  assert.equal(statusLine({ is_live: false, people: null }), 'Off air');
  assert.equal(statusLine({ is_live: true, people: 0 }), 'Live now · 0 people');
  assert.equal(statusLine({ is_live: true, people: 1 }), 'Live now · 1 person');
  assert.equal(statusLine({ is_live: true, people: 12 }), 'Live now · 12 people');
  assert.equal(statusLine({ is_live: true, people: null }), 'Live now · 0 people');
  assert.equal(statusLine({ is_live: true }), 'Live now · 0 people');
});

test('replayLabel: one label per replay status', () => {
  for (const status of ['invoked', 'recording', 'uploading', 'uploaded']) {
    assert.equal(replayLabel({ status, published: false }), 'Replay preparing', status);
  }
  assert.equal(replayLabel({ status: 'ready', published: false }), 'Replay ready — review, then publish');
  assert.equal(replayLabel({ status: 'ready', published: null }), 'Replay ready — review, then publish');
  assert.equal(replayLabel({ status: 'ready', published: true }), 'Published ✓');
  assert.equal(replayLabel({ status: 'error', published: false }), 'Replay failed');
  assert.equal(replayLabel({ status: 'error', published: true }), 'Replay failed');
});

test('iframeUrl turns the Stream /watch page into the embeddable /iframe URL', () => {
  assert.equal(iframeUrl('https://customer-abc123.cloudflarestream.com/0123456789abcdef/watch'), 'https://customer-abc123.cloudflarestream.com/0123456789abcdef/iframe');
  assert.equal(iframeUrl('https://customer-abc123.cloudflarestream.com/0123456789abcdef/iframe'), 'https://customer-abc123.cloudflarestream.com/0123456789abcdef/iframe');
  assert.equal(iframeUrl('https://example.com/watch/'), 'https://example.com/watch/');
  assert.equal(iframeUrl(null), null);
  assert.equal(iframeUrl(undefined), null);
  assert.equal(iframeUrl(''), null);
});
```

- [ ] **Step 7: Run it and watch it fail on the missing module**

```bash
cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs tests/academy/*.test.mjs 2>&1 | grep -v "^✔"
```

Expected:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/nelsontaylor/taylormade-academy/js/room-page.js' imported from /Users/nelsontaylor/taylormade-academy/tests/academy/room-page.test.mjs
...
✖ tests/academy/room-page.test.mjs
ℹ tests 28
ℹ pass 27
ℹ fail 1
```

- [ ] **Step 8: Create `js/room-page.js`**

Full file:

```js
/* /room/ — the decisions the Academy room page makes before it touches the DOM. Pure: no DOM,
   no supabase, so `node --test tests/academy/*.test.mjs` covers every branch.
   Imported by /room/index.html (stamped ?v= by build_site.py) and by /live/index.html for the
   status line and replay labels on Nelson's card. Nothing under /opil/ imports this file. */

/* the shape ea_room_new_key() mints: 16 random bytes, url-safe base64, no padding → 22 chars */
export const KEY_RX = /^[A-Za-z0-9_-]{22}$/;

/* ?k=<key> → the key; anything else → null, so a mangled link lands on the sign-in card (or,
   signed in, on whatever ea_room_state says for "no key") instead of a blank page. */
export function roomKey(search) {
  let v; try { v = new URLSearchParams(search || '').get('k'); } catch (e) { return null; }
  return v != null && KEY_RX.test(v) ? v : null;
}

/* ea_room_state(k) → which card the page shows. The order is the whole rule: a dead link wins
   over everything, sign-in over role, Nelson over people, the key over the clock. */
export function roomBranch(state) {
  if (!state || typeof state !== 'object') return 'error';
  if (state.bad_link) return 'dead_link';
  if (!state.signed_in) return 'landing';
  if (state.is_host) return state.is_live ? 'host_live' : 'host_idle';
  if (!state.can_join) return 'not_allowed';
  return state.is_live ? 'student' : 'waiting';
}

/* "Sign in to join" → /login/?next=/room/?k=… so the key survives the round trip through
   the email code and /welcome/ */
export function loginHref(k) {
  return '/login/?next=' + encodeURIComponent('/room/' + (k ? '?k=' + k : ''));
}

/* what an ea-rtk-join / ea-rtk-record error says on this page; the two words-driven lines
   (not_allowed, not_open) read from ROOM_WORDS or OPIL_WORDS in opil/hub/live-rooms.js */
export function joinErrorText(code, status, words) {
  switch (code) {
    case 'sign_in': return 'Sign in again and retry.';
    case 'not_allowed': return words.notAllowed;
    case 'bad_link': return 'This link isn’t active anymore — ask Nelson for the new one.';
    case 'not_open': return words.notOpen;
    case 'room_full': return 'The room is full right now.';
    case 'slow_down': return 'Too many tries — wait a minute and try again.';
    case 'no_room': return 'The room isn’t open yet.';
    case 'not_host': return 'Only Nelson can do that.';
    case 'rtk_not_configured': return 'The room is not set up yet.';
    default: return 'The server said ' + status + '.';
  }
}

/* Nelson's card: "Off air" or "Live now · 12 people" (people = ea_room_state().people, admin only) */
export function statusLine(state) {
  if (!state.is_live) return 'Off air';
  const n = Number(state.people || 0);
  return 'Live now · ' + n + (n === 1 ? ' person' : ' people');
}

/* one label per ea_room_replays row, the same words as the OPIL coordinator row */
export function replayLabel(row) {
  const s = row.status;
  if (s === 'invoked' || s === 'recording' || s === 'uploading' || s === 'uploaded') return 'Replay preparing';
  if (s === 'ready') return row.published ? 'Published ✓' : 'Replay ready — review, then publish';
  return 'Replay failed';
}

/* the Stream /watch page is Cloudflare's hosted player and cannot be embedded; /iframe can */
export function iframeUrl(watchUrl) {
  return watchUrl ? watchUrl.replace(/\/watch$/, '/iframe') : null;
}
```

- [ ] **Step 9: Run green — 38 tests**

```bash
cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs tests/academy/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected:

```
ℹ tests 38
ℹ pass 38
ℹ fail 0
```

(18 OPIL + 9 words + 11 room-page.)

- [ ] **Step 10: Commit the room-page module**

```bash
cd /Users/nelsontaylor/taylormade-academy && git add js/room-page.js tests/academy/room-page.test.mjs && git commit -m "feat(academy): js/room-page.js — the pure /room/ page decisions, node-tested" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 11: OPIL guard — prove nothing OPIL moved**

```bash
cd /Users/nelsontaylor/taylormade-academy && git diff cb0f080 --stat -- tests/opil js/rtk-room-v2.js js/rtk-room.js opil/hub/live/index.html opil/hub/index.html opil/hub/admin/index.html; echo "(nothing above = untouched)"; node --test tests/opil/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"; git status --short; git log --oneline -3
```

Expected:

```
(nothing above = untouched)
ℹ tests 18
ℹ pass 18
ℹ fail 0
<git status prints nothing — clean tree>
<sha> feat(academy): js/room-page.js — the pure /room/ page decisions, node-tested
<sha> feat(academy): room words — OPIL_WORDS, ROOM_WORDS, capFirst; nowCopy/joinCopy take words, OPIL defaults unchanged
cb0f080 docs(academy): Academy Room design spec — the OPIL class room on /room/, one link, sign-in first
```

Why this is enough for OPIL: `js/rtk-room-v2.js:10` still statically imports `{ stateCopy, nowCopy, queueOrder, queuePosition, nextInLine, joinCopy, sessLabel }` and calls `joinCopy(...)` (`:234`) and `nowCopy(...)` (`:317`) with one argument, so it gets `OPIL_WORDS` by default; the export-list test in `words.test.mjs` fails the build if any of those names ever disappears; `?classic=1` (`js/rtk-room.js`) imports nothing from this file. The three OPIL pages keep importing `/opil/hub/live-rooms.js?v=3ef77ddd84` until Task 9 restamps — the old cached copy and the new file answer the same calls the same way. Two things are deliberately not done here: no push, and no `build_site.py` run.

---

### Task 2: Migration 0036 + the apply/verify script Nelson runs

**Files:**
- Create: `supabase/migrations/0036_academy_room.sql` (226 lines — tables, RPCs, grants, the `ea_opil_hands` rider, final `select 'academy room ready'`)
- Create: `scripts/verify-0036.sql` (576 lines — the proof, run inside `begin; … rollback;`; 41 checks, each printed as one `OK …` / `FAIL …` line)
- Create: `scripts/apply-0036.sh` (63 lines, mode 755 — reads the keychain token, POSTs the migration, then POSTs the verify and prints the lines)
- Modify: none. This task touches no page, no function, no test and no OPIL string. `js/rtk-room-v2.js`, `opil/hub/live-rooms.js`, `tests/opil/*` are untouched (Step 7 proves it).
- Test: `scripts/verify-0036.sql` (executed on prod by `scripts/apply-0036.sh`, everything rolled back) + `bash -n scripts/apply-0036.sh` + the jq exercises in Step 6. There is no Postgres on this Mac (`which psql postgres docker` → nothing), so the SQL cannot be dry-parsed locally; the verify script IS the test and it only runs when Nelson pastes the `!` line (Step 9 / rollout step 1).

**Interfaces:**
- Consumes (already on prod): `public.ea_is_admin()` (0001_build_mode_schema.sql:10 — `profiles.role = 'admin'`), `public.ea_is_member()` (0001:61 — active `ea_memberships` row OR admin), `public.ea_opil_hands` (0035_opil_hands.sql:5-14; columns `session_no, user_id, kind, note, created_at, staged_at, done_at`; its `hands_insert` policy 0035:30-33 admits `ea_opil_in_cohort()` OR `ea_opil_is_program_team(auth.uid())` on a live session), `public.ea_opil_is_admin(uid)` (0016_opil_lms_layer.sql:15-20 — an `ea_opil_admins` row OR an email on `ea_opil_admin_emails`), the `supabase_realtime` publication do-block (0035:40-44), the 0033 replay column set (0033_opil_replays.sql:7-23) and the 0034 column-grant pattern (0034:12-14), `extensions.gen_random_bytes` (pgcrypto), `auth.users(id, email, created_at)`, `public.profiles(id, role)`, `public.ea_opil_team_members(user_id, created_at)` (0013:8-14), `public.ea_opil_sessions(no, is_live)` (0013:47-55, 0019:4). Keychain token per the spine: `security find-generic-password -s "Supabase CLI" -w` → strip `go-keyring-base64:` → `base64 -d`. SQL endpoint: `POST https://api.supabase.com/v1/projects/pgqdmnmessbbzyszjfvr/database/query` with `{"query": …}` (curl only). The endpoint returns the rows of the LAST statement that produced any (postgres-meta `src/lib/db.ts`: `res.reverse().find((x) => x.rows.length !== 0)`), so a file ending in `select … ; rollback;` returns the select's rows.
- Produces (later tasks rely on these exact names):
  - Tables `public.ea_rooms (id, title, link_key, is_live, meeting_id, max_participants, recording_url, live_since, ended_at, created_at, updated_at)`, `public.ea_room_members (room_id, user_id, first_joined_at, last_joined_at, joins)` pk `(room_id, user_id)`, `public.ea_room_hands (id, room_id, user_id, kind, note, created_at, staged_at, done_at)`, `public.ea_room_replays (id, room_id, meeting_id, recording_id, status, download_url, download_expires_at, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at)` with `recording_id` unique.
  - T3/T4 (`ea-rtk-join`): service-role `select id, title, link_key, is_live, live_since, meeting_id, max_participants from ea_rooms order by created_at limit 1`; service-role `update ea_rooms set meeting_id`; service-role upsert into `ea_room_members (room_id, user_id)` on conflict `(room_id, user_id)` do update `joins = ea_room_members.joins + 1, last_joined_at = now()`; `ea_room_replays.meeting_id` for `roomMeetingIds`; `rpc('ea_is_member')` as the caller.
  - T5 (`ea-rtk-record`): service-role insert `ea_room_replays { room_id, meeting_id, recording_id, status }`; select by `id`.
  - T6 (`ea-rtk-webhook`): `ea_rooms.meeting_id` → `ea_room_replays.meeting_id` lookup order; upsert `ea_room_replays` on `recording_id`.
  - T7 (`js/rtk-room-v2.js`): hands table `ea_room_hands`, column `room_id`, browser insert exactly `{ room_id, user_id, kind }` (+ optional `note`); realtime on `public.ea_room_hands`.
  - T8/T9 (pages): `rpc('ea_room_state', { p_key })` → `{ id, title, is_live, host_name: 'Nelson Taylor', signed_in, is_host, can_join, bad_link: false, recording_url (null unless member), people (null unless admin) }` or exactly `{ "bad_link": true }`, or `null` when there is no room row; admin `sb.from('ea_rooms').update({ title | is_live | max_participants | live_since | ended_at | updated_at })` (any other column → 42501 permission denied); `rpc('ea_room_rotate_link')` → text (42501 unless admin); `rpc('ea_room_publish_replay', { p_replay, p_publish })` → `{ ok: true, published, recording_url }` (42501 unless admin, `P0002` unless the row is `ready` with a `watch_url`); browser selects on `ea_room_replays` must list columns from `id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at` (`select('*')` fails for authenticated by design).
  - T10 (rollout): `bash scripts/apply-0036.sh` (apply + verify) and `bash scripts/apply-0036.sh --verify-only` (verify again without re-applying; safe after real sessions — every count is scoped to the verify's own rows); exit 0 only when the verify prints `0 FAIL`.

- [ ] **Step 1: Baseline — the OPIL tests are green and the tree is clean before you touch anything**

Run from the repo root:

```bash
cd /Users/nelsontaylor/taylormade-academy && git status --short && node --test tests/opil/*.test.mjs 2>&1 | grep -E "^ℹ (tests|suites|pass|fail|cancelled|skipped|todo)"
```

Expected: `git status --short` prints nothing — or only `?? docs/superpowers/plans/2026-09-14-academy-room.md` (the plan file itself, untracked while it is being written); any `M` line means the tree is dirty — then exactly these seven lines (the `grep` drops the `ℹ duration_ms` line, whose number varies):

```
ℹ tests 18
ℹ suites 0
ℹ pass 18
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

If `pass` is not 18, stop: Task 1 is not done or the tree is dirty. Nothing in this task may change that number.

- [ ] **Step 2: Write the migration `supabase/migrations/0036_academy_room.sql`**

Create the file with exactly this content (226 lines; the file ends with a newline). Every object name is the spine's. Note the order inside each table block — `create table` → index → seed → `enable row level security` → `drop policy if exists` + `create policy` → **revoke** → **grant** — the revokes must come after the create (0023_live_paywall_hardening.sql:40-45: Supabase's default privileges hand `anon`/`authenticated` ALL on a table the moment it exists, so a revoke before the create is a no-op that looks like a fix). The seed `insert … default values on conflict do nothing` needs the unique index `ea_rooms_single` to exist first, which is why the index line sits between the table and the insert.

```sql
-- 0036: the Academy room — the OPIL class room on /room/, one room, one link.
-- Spec: docs/superpowers/specs/2026-09-14-academy-room-design.md §4. Safe to re-run.
-- Four tables (ea_rooms, ea_room_members, ea_room_hands, ea_room_replays), one read RPC for
-- everyone (ea_room_state), one definer helper for the hands policies (ea_room_in_session),
-- two admin RPCs (ea_room_rotate_link, ea_room_publish_replay), and one rider that closes the
-- same column hole on ea_opil_hands. Every revoke runs AFTER its create: Supabase's default
-- privileges hand anon/authenticated ALL on a new table the moment it exists (the 0023 lesson).
-- Only Nelson (ea_is_admin) is ever the host; the service role writes meeting_id and the
-- membership rows from the edge functions; no page inserts into ea_rooms.

-- gen_random_bytes lives in pgcrypto, which Supabase installs in the extensions schema.
create extension if not exists pgcrypto with schema extensions;

-- ---------- 4.1 the link key ----------
-- 16 random bytes → base64 → strip '=' padding → url-safe alphabet: 22 chars of [A-Za-z0-9_-].
create or replace function public.ea_room_new_key() returns text
language sql volatile security definer set search_path = public as
$$ select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_') $$;
revoke all on function public.ea_room_new_key() from public, anon, authenticated;

-- ---------- 4.1 ea_rooms — exactly one row ----------
create table if not exists public.ea_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Taylormade Academy Live' check (char_length(title) <= 120),
  link_key text not null unique default public.ea_room_new_key(),
  is_live boolean not null default false,
  meeting_id text,                       -- the CURRENT session's RealtimeKit meeting; server-only (grants below);
                                         -- a NEW meeting at every Start class; kept after Leave so a late webhook still files
  max_participants int not null default 50 check (max_participants between 2 and 500),
  recording_url text,                    -- the published replay (Stream /watch page)
  live_since timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ea_rooms_single on public.ea_rooms ((true));   -- exactly one room
-- the seed runs as the migration owner; 'on conflict do nothing' needs the unique index above
insert into public.ea_rooms default values on conflict do nothing;
alter table public.ea_rooms enable row level security;
drop policy if exists rooms_admin_read on public.ea_rooms;
create policy rooms_admin_read on public.ea_rooms for select to authenticated
  using (public.ea_is_admin());
drop policy if exists rooms_admin_update on public.ea_rooms;
create policy rooms_admin_update on public.ea_rooms for update to authenticated
  using (public.ea_is_admin()) with check (public.ea_is_admin());
-- no insert / delete policy: the seed ran as the owner, the service role never inserts either
revoke insert, delete, truncate, references, trigger on public.ea_rooms from anon, authenticated, public;
-- meeting_id and link_key are never writable from a page: the join function writes meeting_id
-- with the service role; ea_room_rotate_link() writes link_key
revoke update on public.ea_rooms from anon, authenticated, public;
grant update (title, is_live, max_participants, live_since, ended_at, updated_at) on public.ea_rooms to authenticated;

-- ---------- 4.3 ea_room_members — who joined ----------
-- Written only by the join function (service role upsert). A row here admits nothing by itself;
-- only a join in the CURRENT session does (ea_room_in_session below).
create table if not exists public.ea_room_members (
  room_id uuid references public.ea_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  first_joined_at timestamptz not null default now(),
  last_joined_at timestamptz not null default now(),
  joins int not null default 1,
  primary key (room_id, user_id)
);
alter table public.ea_room_members enable row level security;
drop policy if exists room_members_admin_read on public.ea_room_members;
create policy room_members_admin_read on public.ea_room_members for select to authenticated
  using (public.ea_is_admin());
-- no write policies: browsers never write here
revoke insert, update, delete, truncate, references, trigger on public.ea_room_members from anon, authenticated, public;

-- ---------- 4.4 in-session check for the hands policies ----------
-- Policies on ea_room_hands cannot read ea_rooms / ea_room_members through those tables' own
-- RLS (the 2026-08-31 recursion lesson; OPIL uses ea_opil_in_cohort() for the same reason).
create or replace function public.ea_room_in_session(p_room uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.ea_room_members m join public.ea_rooms r on r.id = m.room_id
                  where m.room_id = p_room and m.user_id = auth.uid() and r.is_live and m.last_joined_at >= r.live_since) $$;
revoke all on function public.ea_room_in_session(uuid) from public, anon;
grant execute on function public.ea_room_in_session(uuid) to authenticated;

-- ---------- 4.4 ea_room_hands — the question queue (shape of ea_opil_hands) ----------
create table if not exists public.ea_room_hands (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ea_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'question' check (kind in ('question','comment')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  staged_at timestamptz,
  done_at timestamptz
);
create index if not exists ea_room_hands_open_idx on public.ea_room_hands (room_id, created_at) where done_at is null;
create unique index if not exists ea_room_hands_one_open on public.ea_room_hands (room_id, user_id) where done_at is null;
alter table public.ea_room_hands enable row level security;
drop policy if exists room_hands_read on public.ea_room_hands;
create policy room_hands_read on public.ea_room_hands for select to authenticated
  using (public.ea_is_admin() or public.ea_room_in_session(room_id));
drop policy if exists room_hands_insert on public.ea_room_hands;
create policy room_hands_insert on public.ea_room_hands for insert to authenticated
  with check (user_id = auth.uid() and public.ea_room_in_session(room_id));
drop policy if exists room_hands_update_host on public.ea_room_hands;
create policy room_hands_update_host on public.ea_room_hands for update to authenticated
  using (public.ea_is_admin()) with check (public.ea_is_admin());
drop policy if exists room_hands_delete_own on public.ea_room_hands;
create policy room_hands_delete_own on public.ea_room_hands for delete to authenticated
  using (user_id = auth.uid() or public.ea_is_admin());
-- a person can raise a hand with these four columns only — never staged_at / created_at (no queue jumping)
revoke insert on public.ea_room_hands from authenticated;
grant insert (room_id, user_id, kind, note) on public.ea_room_hands to authenticated;
do $$ begin
  begin
    alter publication supabase_realtime add table public.ea_room_hands;
  exception when duplicate_object then null; end;
end $$;

-- ---------- 4.5 ea_room_replays — drafts (shape of ea_opil_replays + 0034 privacy) ----------
create table if not exists public.ea_room_replays (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.ea_rooms(id) on delete set null,
  meeting_id text not null,
  recording_id text not null unique,
  status text not null default 'invoked' check (status in ('invoked','recording','uploading','uploaded','ready','error')),
  download_url text,
  download_expires_at timestamptz,
  stream_uid text,
  watch_url text,
  duration_s int,
  file_size bigint,
  error text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ea_room_replays_room_idx on public.ea_room_replays (room_id, created_at desc);
create index if not exists ea_room_replays_meeting_idx on public.ea_room_replays (meeting_id, created_at desc);
alter table public.ea_room_replays enable row level security;
drop policy if exists room_replays_admin_read on public.ea_room_replays;
create policy room_replays_admin_read on public.ea_room_replays for select to authenticated
  using (public.ea_is_admin());
-- no insert/update/delete policies: only the service role writes here
revoke insert, update, delete, truncate, references, trigger on public.ea_room_replays from anon, authenticated, public;
-- the raw download_url / download_expires_at never reach a browser: pages select explicit columns
revoke select on public.ea_room_replays from anon, authenticated, public;
grant select (id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at)
  on public.ea_room_replays to authenticated;

-- ---------- 4.2 ea_room_state — the only read path for non-admins ----------
-- Never returns link_key or meeting_id. A bad key (non-privileged caller) gets exactly {"bad_link": true}.
create or replace function public.ea_room_state(p_key text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.ea_rooms%rowtype;
  privileged boolean;
  v_admin boolean;
  v_member boolean;
begin
  select * into r from public.ea_rooms order by created_at limit 1;
  if not found then return null; end if;
  v_admin := public.ea_is_admin();
  v_member := public.ea_is_member();
  privileged := v_admin or v_member;
  if (not privileged) and p_key is not null and p_key <> r.link_key then
    return jsonb_build_object('bad_link', true);
  end if;
  return jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'is_live', r.is_live,
    'host_name', 'Nelson Taylor',
    'signed_in', auth.uid() is not null,
    'is_host', v_admin,
    'can_join', privileged or (p_key is not null and p_key = r.link_key),
    'bad_link', false,
    'recording_url', case when v_member then r.recording_url else null end,
    'people', case when v_admin then (select count(*) from public.ea_room_members m
                                       where m.room_id = r.id and m.last_joined_at >= coalesce(r.live_since, 'epoch'::timestamptz))
                   else null end
  );
end $$;
revoke all on function public.ea_room_state(text) from public;
grant execute on function public.ea_room_state(text) to anon, authenticated;

-- ---------- 4.6 admin RPCs ----------
create or replace function public.ea_room_rotate_link() returns text
language plpgsql volatile security definer set search_path = public as $$
declare k text;
begin
  if not public.ea_is_admin() then raise exception 'only Nelson can do that' using errcode = '42501'; end if;
  update public.ea_rooms set link_key = public.ea_room_new_key(), updated_at = now()
    where id = (select id from public.ea_rooms order by created_at limit 1)
    returning link_key into k;
  return k;
end $$;
revoke all on function public.ea_room_rotate_link() from public, anon;
grant execute on function public.ea_room_rotate_link() to authenticated;

-- publish copies watch_url → ea_rooms.recording_url (what members see on /live/); unpublish clears both.
create or replace function public.ea_room_publish_replay(p_replay uuid, p_publish boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r public.ea_room_replays%rowtype; v_room uuid;
begin
  if not public.ea_is_admin() then raise exception 'only Nelson can do that' using errcode = '42501'; end if;
  select * into r from public.ea_room_replays where id = p_replay and status = 'ready' and watch_url is not null;
  if not found then raise exception 'this replay is not ready' using errcode = 'P0002'; end if;
  v_room := coalesce(r.room_id, (select id from public.ea_rooms order by created_at limit 1));
  if p_publish then
    update public.ea_room_replays set published = true, updated_at = now() where id = r.id;
    update public.ea_room_replays set published = false, updated_at = now() where id <> r.id and published;
    update public.ea_rooms set recording_url = r.watch_url, updated_at = now() where id = v_room;
    return jsonb_build_object('ok', true, 'published', true, 'recording_url', r.watch_url);
  else
    update public.ea_room_replays set published = false, updated_at = now() where id = r.id and published;
    update public.ea_rooms set recording_url = null, updated_at = now() where id = v_room and recording_url = r.watch_url;
    return jsonb_build_object('ok', true, 'published', false, 'recording_url', null);
  end if;
end $$;
revoke all on function public.ea_room_publish_replay(uuid, boolean) from public, anon;
grant execute on function public.ea_room_publish_replay(uuid, boolean) to authenticated;

-- ---------- rider: the same column hole on ea_opil_hands ----------
-- 0035 left the default full INSERT grant, so an OPIL student could insert staged_at and jump
-- the queue. The OPIL page inserts exactly {session_no, user_id, kind} (js/rtk-room-v2.js askQuestion).
revoke insert on public.ea_opil_hands from authenticated;
grant insert (session_no, user_id, kind, note) on public.ea_opil_hands to authenticated;

select 'academy room ready' as status;
```

- [ ] **Step 3: Static checks on the migration (no Postgres here — this is what you CAN check locally)**

```bash
cd /Users/nelsontaylor/taylormade-academy && wc -l supabase/migrations/0036_academy_room.sql && grep -n "^create table if not exists\|^create or replace function\|^revoke\|^grant\|^insert into public.ea_rooms\|^create unique index\|^select 'academy" supabase/migrations/0036_academy_room.sql
```

Expected output (the line numbers prove every `revoke`/`grant` sits AFTER the `create` it applies to, and the seed insert sits after the unique index):

```
     226 supabase/migrations/0036_academy_room.sql
16:create or replace function public.ea_room_new_key() returns text
19:revoke all on function public.ea_room_new_key() from public, anon, authenticated;
22:create table if not exists public.ea_rooms (
36:create unique index if not exists ea_rooms_single on public.ea_rooms ((true));   -- exactly one room
38:insert into public.ea_rooms default values on conflict do nothing;
47:revoke insert, delete, truncate, references, trigger on public.ea_rooms from anon, authenticated, public;
50:revoke update on public.ea_rooms from anon, authenticated, public;
51:grant update (title, is_live, max_participants, live_since, ended_at, updated_at) on public.ea_rooms to authenticated;
56:create table if not exists public.ea_room_members (
69:revoke insert, update, delete, truncate, references, trigger on public.ea_room_members from anon, authenticated, public;
74:create or replace function public.ea_room_in_session(p_room uuid) returns boolean
78:revoke all on function public.ea_room_in_session(uuid) from public, anon;
79:grant execute on function public.ea_room_in_session(uuid) to authenticated;
82:create table if not exists public.ea_room_hands (
93:create unique index if not exists ea_room_hands_one_open on public.ea_room_hands (room_id, user_id) where done_at is null;
108:revoke insert on public.ea_room_hands from authenticated;
109:grant insert (room_id, user_id, kind, note) on public.ea_room_hands to authenticated;
117:create table if not exists public.ea_room_replays (
141:revoke insert, update, delete, truncate, references, trigger on public.ea_room_replays from anon, authenticated, public;
143:revoke select on public.ea_room_replays from anon, authenticated, public;
144:grant select (id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at)
149:create or replace function public.ea_room_state(p_key text default null) returns jsonb
180:revoke all on function public.ea_room_state(text) from public;
181:grant execute on function public.ea_room_state(text) to anon, authenticated;
184:create or replace function public.ea_room_rotate_link() returns text
194:revoke all on function public.ea_room_rotate_link() from public, anon;
195:grant execute on function public.ea_room_rotate_link() to authenticated;
198:create or replace function public.ea_room_publish_replay(p_replay uuid, p_publish boolean) returns jsonb
217:revoke all on function public.ea_room_publish_replay(uuid, boolean) from public, anon;
218:grant execute on function public.ea_room_publish_replay(uuid, boolean) to authenticated;
223:revoke insert on public.ea_opil_hands from authenticated;
224:grant insert (session_no, user_id, kind, note) on public.ea_opil_hands to authenticated;
226:select 'academy room ready' as status;
```

If your line numbers differ, your file is not the one above — fix it before going on (the verify in Step 4 depends on exactly these grants). A real parse only happens on prod (the Management API runs the whole file as one implicit transaction: if any statement fails, nothing is kept and the script in Step 5 prints the error).

- [ ] **Step 4: Write the proof `scripts/verify-0036.sql`**

This is the test for the migration. It runs on prod but keeps nothing: everything sits between `begin;` and `rollback;` — the throwaway guest account it inserts into `auth.users`, the `ea_room_members` row, the hands, the `is_live` flip, the OPIL session flip. Each check appends one line to a temp table and the last `select` returns them; the Management API returns the rows of the last statement that produced any (postgres-meta `db.ts`: `res.reverse().find((x) => x.rows.length !== 0)`), which is why every result funnels through `verify_out` and the `select` sits right before the `rollback`. Expected-failure checks live in their own `begin … exception … end` sub-blocks (each is a savepoint, so a caught error also reverts the `set local role` and the claims). Role switching is exactly the brief's: `set local role anon` / `set local role authenticated` + `set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)` — plus `request.jwt.claim.sub` alongside it, so either version of Supabase's `auth.uid()` (the old one reads only `request.jwt.claim.sub`; the current one coalesces both) sees the fake user; clearing writes `'{}'` / `''`, never `''` into the JSON one (`''::jsonb` throws inside `auth.uid()` and would turn every later anon check into a spurious FAIL). `reset role` runs before every write to `verify_out` (the temp table belongs to the connection's `postgres` role). The guest uid is the fixed `00000000-0000-4000-8000-000000000001`; because `ea_room_members.user_id` references `auth.users(id)`, block 0 inserts a throwaway `auth.users` row for it inside the transaction (rolled back), and falls back to a real non-admin, non-member account only if this project refuses that insert — the `INFO guest = …` line says which path ran.

Two things a re-run must survive, and does: (1) every count in blocks 11 and 12b is scoped to the guest's own row (`… and user_id = v_guest`), so `--verify-only` after real sessions (T10 step 5 leaves a real join and a real hand) still prints OK; `people = 1` also holds because the verify overwrites `live_since = now()` inside the transaction and only the guest's `last_joined_at` is that new. (2) Block 14 — the ONLY runtime proof of the `ea_opil_hands` rider, i.e. spec §10 rollout step 1 — can never SKIP: it uses a cohort member when `ea_opil_team_members` has a row, otherwise an OPIL coordinator (the `hands_insert` policy, 0035:30-33, also admits `ea_opil_is_program_team(auth.uid())`), and prints FAIL when it finds neither. *Note on the reviewer's suggested fallback:* the repo never inserts into `ea_opil_admins` (0013:15-18 creates it; 0016 and `opil/hub/hub.js:25` only read it) — `ea_opil_is_admin(uid)` (0016:15-20) is what makes Nelson/Jamal coordinators, via the `ea_opil_admin_emails` allowlist (0016:6-8) — so the fallback selects through `ea_opil_is_admin(u.id)` over `auth.users`, not from `ea_opil_admins` alone. Per memory (`opil-hub-live-data-state`: 0 student teams until sign-in) the coordinator path is the one that will run today.

Create the file with exactly this content (576 lines):

```sql
-- scripts/verify-0036.sql — proves migration 0036 on prod and KEEPS NOTHING.
-- Everything between begin and rollback is thrown away: the throwaway guest account, the
-- members row, the hands, the live flag, the OPIL session flip. Each check appends one line
-- (OK … / FAIL … / SKIP … / INFO …) to a temp table and the final select returns them all —
-- the Management API answers with the rows of the LAST statement that produced any
-- (postgres-meta: res.reverse().find(x => x.rows.length !== 0)), so the select before the
-- rollback is what comes back. Impersonation sets BOTH request.jwt.claims (json) and
-- request.jwt.claim.sub (plain) so either version of auth.uid() sees the fake user; clearing
-- writes '{}' / '' — never '' into the json one, because ''::jsonb throws inside auth.uid().
-- Run by scripts/apply-0036.sh. Never paste this anywhere without the rollback at the end.
begin;
create temp table verify_out (n serial primary key, line text not null) on commit drop;

do $v$
declare
  v_room       uuid;
  v_key        text;
  v_state      jsonb;
  v_n          bigint;
  v_guest      uuid := '00000000-0000-4000-8000-000000000001';
  v_cand       uuid;
  v_claims     text;
  v_adm_claims text;
  v_how        text := 'throwaway auth.users row (rolled back)';
  v_opil_uid   uuid;
  v_opil_sno   int;
  v_opil_how   text;
  v_new_key    text;
begin
  -- 0. the guest: a throwaway auth.users row so the ea_room_members foreign key can be satisfied;
  --    if this project refuses inserts into auth.users, fall back to a real account that is
  --    neither admin nor member (checked through the same functions the RPC uses).
  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values (v_guest, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zz-test-0036@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
            '', '', '', '');
  exception when others then
    v_how := 'existing account (auth.users insert refused: ' || sqlstate || ')';
    v_guest := null;
    for v_cand in select u.id from auth.users u order by u.created_at limit 50 loop
      perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_cand), true),
              set_config('request.jwt.claim.sub', v_cand::text, true);
      if not public.ea_is_admin() and not public.ea_is_member() then v_guest := v_cand; exit; end if;
    end loop;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
  end;
  if v_guest is null then
    insert into verify_out(line) values ('FAIL no guest account to test with (auth.users insert refused and no non-admin, non-member account found)');
    return;
  end if;
  v_claims := format('{"sub":"%s","role":"authenticated"}', v_guest);
  insert into verify_out(line) values ('INFO guest = ' || v_guest || ' · ' || v_how);

  -- 1. the room row exists and its key has the right shape
  select id, link_key into v_room, v_key from public.ea_rooms order by created_at limit 1;
  if v_room is null then
    insert into verify_out(line) values ('FAIL the room row exists (ea_rooms is empty — the seed did not run)');
    return;
  end if;
  insert into verify_out(line) values ('OK the room row exists (ea_rooms has one row)');
  insert into verify_out(line) values (case when v_key ~ '^[A-Za-z0-9_-]{22}$' then 'OK ' else 'FAIL ' end || 'the seeded link_key is 22 url-safe chars');
  insert into verify_out(line) values (case when public.ea_room_new_key() ~ '^[A-Za-z0-9_-]{22}$' then 'OK ' else 'FAIL ' end || 'ea_room_new_key() returns 22 url-safe chars');
  insert into verify_out(line) values (case when (select count(*) from public.ea_rooms) = 1 then 'OK ' else 'FAIL ' end || 'exactly one room (ea_rooms_single index)');

  -- 2. anon with a bad key gets exactly {"bad_link": true}
  begin
    set local role anon;
    select public.ea_room_state('nope') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'anon ea_room_state(bad key) = {"bad_link":true} · got ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon ea_room_state(bad key) raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 3. anon with no key: the public shape, no secrets
  begin
    set local role anon;
    select public.ea_room_state() into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'signed_in' = 'false' and v_state->>'is_host' = 'false'
        and v_state->>'can_join' = 'false' and v_state->>'bad_link' = 'false' and v_state->>'host_name' = 'Nelson Taylor'
        and (v_state ? 'id') and (v_state ? 'title') and (v_state ? 'is_live')
        and not (v_state ? 'link_key') and not (v_state ? 'meeting_id')
        and v_state->'recording_url' = 'null'::jsonb and v_state->'people' = 'null'::jsonb
      then 'OK ' else 'FAIL ' end || 'anon ea_room_state() shape: signed_in/is_host/can_join/bad_link false, no link_key or meeting_id, recording_url and people null · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon ea_room_state() raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 4. anon reads nothing from the room tables (0 rows through RLS, or no select grant at all)
  begin
    set local role anon;
    select count(*) into v_n from public.ea_rooms;
    reset role;
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'anon sees 0 rows of ea_rooms · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon sees 0 rows of ea_rooms · permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_rooms raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role anon;
    select count(*) into v_n from public.ea_room_members;
    reset role;
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'anon sees 0 rows of ea_room_members · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon sees 0 rows of ea_room_members · permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_room_members raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role anon;
    select count(*) into v_n from public.ea_room_hands;
    reset role;
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'anon sees 0 rows of ea_room_hands · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon sees 0 rows of ea_room_hands · permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_room_hands raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role anon;
    select count(*) into v_n from public.ea_room_replays;
    reset role;
    insert into verify_out(line) values ('FAIL anon can select from ea_room_replays (select grant should be revoked) · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon select from ea_room_replays → 42501 permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_room_replays raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 5. a signed-in guest with no key: signed in, cannot join, not the host
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state() into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state->>'signed_in' = 'true' and v_state->>'can_join' = 'false'
        and v_state->>'is_host' = 'false' and v_state->>'bad_link' = 'false' and v_state->'people' = 'null'::jsonb
      then 'OK ' else 'FAIL ' end || 'guest, no key: signed_in true, can_join false, is_host false, people null · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state() raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 6. the same guest with the real key can join; with a wrong 22-char key gets bad_link
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state(v_key) into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state->>'can_join' = 'true' and v_state->>'bad_link' = 'false' and v_state->>'is_host' = 'false'
      then 'OK ' else 'FAIL ' end || 'guest with the real key: can_join true, is_host false · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state(real key) raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state('AAAAAAAAAAAAAAAAAAAAAA') into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'guest with a wrong key = {"bad_link":true} (no title leaks) · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state(wrong key) raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 7. guest cannot insert into ea_rooms
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_rooms default values;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL guest insert into ea_rooms was ALLOWED');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK guest insert into ea_rooms → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest insert into ea_rooms raised ' || sqlstate || ' (expected 42501) ' || sqlerrm);
  end;

  -- 8. guest cannot write meeting_id or link_key (column-level: permission denied, not just 0 rows)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_rooms set meeting_id = 'x' where id = v_room;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL guest update ea_rooms.meeting_id was ALLOWED (no column-level revoke)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'permission denied%' then 'OK ' else 'FAIL ' end || 'guest update ea_rooms.meeting_id → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update ea_rooms.meeting_id raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_rooms set link_key = 'AAAAAAAAAAAAAAAAAAAAAA' where id = v_room;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL guest update ea_rooms.link_key was ALLOWED (no column-level revoke)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'permission denied%' then 'OK ' else 'FAIL ' end || 'guest update ea_rooms.link_key → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update ea_rooms.link_key raised ' || sqlstate || ' ' || sqlerrm);
  end;
  -- an allowed column is gated by RLS instead: the update runs and touches 0 rows for a non-admin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_rooms set title = 'hacked' where id = v_room;
    get diagnostics v_n = row_count;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'guest update ea_rooms.title touches 0 rows (admin-only RLS) · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update ea_rooms.title raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 9. the raw download link never reaches a browser; the allowed columns do (0 rows for a guest)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select count(download_url) into v_n from public.ea_room_replays;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL authenticated can select ea_room_replays.download_url');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK select download_url from ea_room_replays → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL select download_url from ea_room_replays raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select count(id) into v_n from public.ea_room_replays;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'guest select id from ea_room_replays runs and sees 0 rows · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest select id from ea_room_replays raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 10. hands: staged_at is not insertable (column grant), and no hand without a join in THIS session (RLS)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_room_hands (room_id, user_id, kind, staged_at) values (v_room, v_guest, 'question', now());
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL hand insert with staged_at was ALLOWED (column grant missing)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'permission denied%' then 'OK ' else 'FAIL ' end || 'hand insert with staged_at → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL hand insert with staged_at raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_room_hands (room_id, user_id, kind) values (v_room, v_guest, 'question');
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL hand insert while NOT in session was ALLOWED');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'new row violates row-level security%' then 'OK ' else 'FAIL ' end || 'hand insert while not in session → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL hand insert while not in session raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 11. as the owner: the guest joins the current session (the exact upsert the join function
  --     will do with the service role), and the room goes live. Every count below is scoped to
  --     the guest's own rows, so a --verify-only re-run after real sessions still passes.
  insert into public.ea_room_members (room_id, user_id) values (v_room, v_guest)
    on conflict (room_id, user_id) do update set last_joined_at = now(), joins = public.ea_room_members.joins + 1;
  update public.ea_rooms set is_live = true, live_since = now() where id = v_room;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_room_hands (room_id, user_id, kind) values (v_room, v_guest, 'question');
    get diagnostics v_n = row_count;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'hand insert (room_id, user_id, kind) while in session succeeds · ' || v_n || ' row');
  exception when unique_violation then
    reset role;
    insert into verify_out(line) values ('OK hand insert (room_id, user_id, kind) while in session passed the grant and the policy (stopped only by the one-open index, 23505)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL hand insert while in session raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select count(*) into v_n from public.ea_room_hands where room_id = v_room and user_id = v_guest;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'a person in the session reads the queue (room_hands_read) · ' || v_n || ' row');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest read of ea_room_hands raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_room_hands set staged_at = now() where room_id = v_room and user_id = v_guest;
    get diagnostics v_n = row_count;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'a person cannot stage their own hand (update is admin-only) · ' || v_n || ' rows');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update of ea_room_hands raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state() into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state->>'is_live' = 'true' and v_state->>'can_join' = 'false' then 'OK ' else 'FAIL ' end || 'a members row admits nothing by itself (is_live true, can_join still false without the key) · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state() while live raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 12. the admin RPCs refuse a guest
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    perform public.ea_room_rotate_link();
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL ea_room_rotate_link() ran for a guest');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_rotate_link() for a guest → 42501');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_rotate_link() for a guest raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    perform public.ea_room_publish_replay(gen_random_uuid(), true);
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL ea_room_publish_replay() ran for a guest');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_publish_replay() for a guest → 42501');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_publish_replay() for a guest raised ' || sqlstate || ' ' || sqlerrm);
  end;
  -- ea_room_new_key is server-only
  begin
    set local role authenticated;
    perform public.ea_room_new_key();
    reset role;
    insert into verify_out(line) values ('FAIL authenticated can call ea_room_new_key()');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_new_key() is revoked from authenticated → 42501');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_new_key() as authenticated raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 12b. as Nelson (the first admin in public.profiles): host, sees people, reads the tables, rotates the link
  select p.id into v_cand from public.profiles p where p.role = 'admin' order by p.id limit 1;
  if v_cand is null then
    insert into verify_out(line) values ('SKIP admin checks — no profiles row with role = admin');
  else
    v_adm_claims := format('{"sub":"%s","role":"authenticated"}', v_cand);
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select public.ea_room_state() into v_state;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_state->>'is_host' = 'true' and v_state->>'can_join' = 'true'
          and v_state->>'bad_link' = 'false' and (v_state->>'people')::int = 1 and (v_state ? 'recording_url')
        then 'OK ' else 'FAIL ' end || 'admin ea_room_state(): is_host true, can_join true, people = 1 (the seeded join) · ' || coalesce(v_state::text, 'null'));
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_state() raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select public.ea_room_state('AAAAAAAAAAAAAAAAAAAAAA') into v_state;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_state->>'bad_link' = 'false' and v_state->>'can_join' = 'true'
        then 'OK ' else 'FAIL ' end || 'admin with a stale key is never told bad_link (privilege admits) · ' || coalesce(v_state::text, 'null'));
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_state(stale key) raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select count(*) into v_n from public.ea_rooms;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'admin reads ea_rooms directly (rooms_admin_read) · ' || v_n || ' row');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin select ea_rooms raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select count(*) into v_n from public.ea_room_members where room_id = v_room and user_id = v_guest;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'admin reads ea_room_members (room_members_admin_read) · ' || v_n || ' row');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin select ea_room_members raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      update public.ea_rooms set title = 'verify title', updated_at = now() where id = v_room;
      get diagnostics v_n = row_count;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'admin updates ea_rooms.title (rooms_admin_update + column grant) · ' || v_n || ' row');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin update ea_rooms.title raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select public.ea_room_rotate_link() into v_new_key;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_new_key ~ '^[A-Za-z0-9_-]{22}$' and v_new_key <> v_key then 'OK ' else 'FAIL ' end || 'admin ea_room_rotate_link() returns a fresh 22-char key');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_rotate_link() raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      perform public.ea_room_publish_replay(gen_random_uuid(), true);
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values ('FAIL admin ea_room_publish_replay(unknown id) did not raise');
    exception when no_data_found then
      reset role;
      insert into verify_out(line) values ('OK admin ea_room_publish_replay(unknown id) → P0002 (not ready)');
    when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_publish_replay(unknown id) raised ' || sqlstate || ' (expected P0002) ' || sqlerrm);
    end;
  end if;

  -- 13. the column grants, both tables (the OPIL rider is the OPIL-facing change in this migration)
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_opil_hands', 'staged_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'created_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'done_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'session_no', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'user_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'kind', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'note', 'INSERT')
    then 'OK ' else 'FAIL ' end || 'rider: authenticated may insert ea_opil_hands (session_no, user_id, kind, note) and not staged_at / created_at / done_at');
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_room_hands', 'staged_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'created_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'done_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'room_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'user_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'kind', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'note', 'INSERT')
    then 'OK ' else 'FAIL ' end || 'authenticated may insert ea_room_hands (room_id, user_id, kind, note) and not staged_at / created_at / done_at');
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_rooms', 'meeting_id', 'UPDATE') = false
    and has_column_privilege('authenticated', 'public.ea_rooms', 'link_key', 'UPDATE') = false
    and has_column_privilege('authenticated', 'public.ea_rooms', 'recording_url', 'UPDATE') = false
    and has_column_privilege('authenticated', 'public.ea_rooms', 'title', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'is_live', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'max_participants', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'live_since', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'ended_at', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'updated_at', 'UPDATE')
    and has_table_privilege('authenticated', 'public.ea_rooms', 'INSERT') = false
    and has_table_privilege('authenticated', 'public.ea_rooms', 'DELETE') = false
    then 'OK ' else 'FAIL ' end || 'ea_rooms grants: update only title/is_live/max_participants/live_since/ended_at/updated_at; no insert/delete');
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_room_replays', 'download_url', 'SELECT') = false
    and has_column_privilege('authenticated', 'public.ea_room_replays', 'download_expires_at', 'SELECT') = false
    and has_column_privilege('authenticated', 'public.ea_room_replays', 'watch_url', 'SELECT')
    and has_column_privilege('anon', 'public.ea_room_replays', 'id', 'SELECT') = false
    then 'OK ' else 'FAIL ' end || 'ea_room_replays grants: no download_url / download_expires_at for authenticated, nothing for anon');
  insert into verify_out(line) values (case when
        exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ea_room_hands')
    then 'OK ' else 'FAIL ' end || 'ea_room_hands is in the supabase_realtime publication');

  -- 14. an OPIL-shaped hand insert (session_no, user_id, kind) still works after the rider — spec
  --     §10 rollout step 1. Subject: a cohort member (ea_opil_team_members) if one exists; else an
  --     OPIL coordinator — hands_insert (0035:30-33) also admits ea_opil_is_program_team(), and
  --     ea_opil_is_admin(uid) (0016:15-20) is true for an ea_opil_admins row OR an allowlisted
  --     email, so Nelson/Jamal always qualify. Both missing is a FAIL, never a SKIP. Uses a live
  --     session if there is one, else flips the lowest-numbered session live INSIDE this
  --     rolled-back transaction.
  select tm.user_id into v_opil_uid from public.ea_opil_team_members tm order by tm.created_at limit 1;
  v_opil_how := 'cohort member';
  if v_opil_uid is null then
    select u.id into v_opil_uid from auth.users u where public.ea_opil_is_admin(u.id) order by u.created_at limit 1;
    v_opil_how := 'OPIL coordinator (ea_opil_team_members is empty — no student has claimed a team yet)';
  end if;
  select s.no into v_opil_sno from public.ea_opil_sessions s where s.is_live order by s.no limit 1;
  if v_opil_sno is null then
    select min(s.no) into v_opil_sno from public.ea_opil_sessions s;
    if v_opil_sno is not null then
      update public.ea_opil_sessions set is_live = true where no = v_opil_sno;   -- rolled back below
    end if;
  end if;
  if v_opil_uid is null or v_opil_sno is null then
    insert into verify_out(line) values ('FAIL OPIL-shaped ea_opil_hands insert — no cohort member and no OPIL coordinator account, or no OPIL session');
  else
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_opil_uid), true),
              set_config('request.jwt.claim.sub', v_opil_uid::text, true);
      insert into public.ea_opil_hands (session_no, user_id, kind) values (v_opil_sno, v_opil_uid, 'question');
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values ('OK OPIL-shaped ea_opil_hands insert (session_no, user_id, kind) still works · as ' || v_opil_how || ' · session ' || v_opil_sno);
    exception when unique_violation then
      reset role;
      insert into verify_out(line) values ('OK OPIL-shaped ea_opil_hands insert passed the grant and the policy (stopped only by the one-open index, 23505) · as ' || v_opil_how || ' · session ' || v_opil_sno);
    when others then
      reset role;
      insert into verify_out(line) values ('FAIL OPIL-shaped ea_opil_hands insert raised ' || sqlstate || ' ' || sqlerrm || ' · as ' || v_opil_how);
    end;
  end if;
end $v$;

select line from verify_out order by n;
rollback;
```

Check the file and its three load-bearing anchors:

```bash
cd /Users/nelsontaylor/taylormade-academy && wc -l scripts/verify-0036.sql && grep -n "select count(\*) into v_n from public.ea_room_hands where\|select count(\*) into v_n from public.ea_room_members where\|select tm.user_id into v_opil_uid\|where public.ea_opil_is_admin(u.id)\|^select line from verify_out\|^rollback;" scripts/verify-0036.sql
```

Expected:

```
     576 scripts/verify-0036.sql
325:    select count(*) into v_n from public.ea_room_hands where room_id = v_room and user_id = v_guest;
445:      select count(*) into v_n from public.ea_room_members where room_id = v_room and user_id = v_guest;
541:  select tm.user_id into v_opil_uid from public.ea_opil_team_members tm order by tm.created_at limit 1;
544:    select u.id into v_opil_uid from auth.users u where public.ea_opil_is_admin(u.id) order by u.created_at limit 1;
575:select line from verify_out order by n;
576:rollback;
```

The OPIL session flip is safe under 0032's `ea_opil_sessions_one_stream` index (0032:11-13 — at most one live row whose `stream_url` is not `rtk:…`): the verify flips a session only when NO session is live, and the flip is rolled back. A rolled-back insert into `ea_opil_hands` never reaches the `supabase_realtime` publication (aborted transactions are not decoded), so no OPIL page sees a phantom hand.

RED state, for the record: before 0036 is applied this file errors inside the DO block at `select id, link_key into v_room, v_key from public.ea_rooms` with `42P01 relation "public.ea_rooms" does not exist`; the Management API answers with an error object instead of rows and the script prints it followed by `VERIFY FAILED`. You do not run it against prod yourself (Step 9 explains why); after apply it must print `0 FAIL`.

- [ ] **Step 5: Write `scripts/apply-0036.sh`**

Create the file with exactly this content (63 lines), then make it executable like `scripts/rtk-presets.sh` (mode 755):

```bash
#!/usr/bin/env bash
# Apply migration 0036 (the Academy room) to the ONE database and prove it, without keeping
# anything from the proof. Nelson runs it from the repo root:
#
#     ! bash scripts/apply-0036.sh                 # apply, then verify
#     ! bash scripts/apply-0036.sh --verify-only   # verify again without re-applying
#
# The migration is safe to re-run. The verify runs inside `begin; … rollback;` — every row it
# writes (a throwaway guest account, a members row, a hand, the live flag) is thrown away.
# Token: the Supabase CLI login in the macOS keychain (memory: supabase-mgmt-api-token-keychain).
# Transport: curl only — python urllib is Cloudflare-blocked. Nothing here prints the token.
set -euo pipefail

REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0036_academy_room.sql"
VERIFY="$ROOT/scripts/verify-0036.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
MODE="${1:-apply}"

command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
[ -f "$VERIFY" ] || { echo "missing $VERIFY"; exit 1; }

RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# post <sql file>: POSTs the file as {"query": "<contents>"}; prints the HTTP status; body in $TMP/out.json
post() {
  jq -Rs '{query: .}' < "$1" > "$TMP/body.json"
  curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" \
    -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
    -d @"$TMP/body.json"
}

if [ "$MODE" != "--verify-only" ]; then
  echo "== apply supabase/migrations/0036_academy_room.sql → $REF"
  code="$(post "$MIG")"
  echo "HTTP $code"
  cat "$TMP/out.json"; echo
  case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code) — nothing below ran"; exit 1;; esac
  jq -e '.[0].status == "academy room ready"' "$TMP/out.json" >/dev/null \
    || { echo "APPLY FAILED — the last statement did not return 'academy room ready'"; exit 1; }
  echo "applied."
fi

echo "== verify (begin … rollback — nothing is kept)"
code="$(post "$VERIFY")"
echo "HTTP $code"
case "$code" in 2*) ;; *) cat "$TMP/out.json"; echo; echo "VERIFY FAILED (HTTP $code)"; exit 1;; esac
jq -e 'type == "array"' "$TMP/out.json" >/dev/null \
  || { cat "$TMP/out.json"; echo; echo "VERIFY FAILED — expected an array of {line} rows"; exit 1; }
jq -r '.[].line' "$TMP/out.json"
ok="$(jq -r '[.[].line | select(startswith("OK "))] | length' "$TMP/out.json")"
fail="$(jq -r '[.[].line | select(startswith("FAIL "))] | length' "$TMP/out.json")"
skip="$(jq -r '[.[].line | select(startswith("SKIP "))] | length' "$TMP/out.json")"
echo "== $ok OK · $fail FAIL · $skip SKIP"
[ "$fail" = "0" ] || { echo "VERIFY FAILED — read the FAIL lines above; the migration is applied, fix and re-run with --verify-only"; exit 1; }
echo "0036 is on prod and verified. Nothing from the verify was kept."
```

```bash
cd /Users/nelsontaylor/taylormade-academy && chmod +x scripts/apply-0036.sh && wc -l scripts/apply-0036.sh && ls -l scripts/apply-0036.sh scripts/verify-0036.sql
```

Expected: `      63 scripts/apply-0036.sh`, then `-rwxr-xr-x … scripts/apply-0036.sh` and `-rw-r--r-- … scripts/verify-0036.sql`.

- [ ] **Step 6: Test the script locally — syntax, then its jq logic against fake API responses (no network, no token)**

```bash
cd /Users/nelsontaylor/taylormade-academy && bash -n scripts/apply-0036.sh && echo SYNTAX-OK
```

Expected: `SYNTAX-OK` (and nothing else). Then exercise the three jq expressions the script relies on, with the exact shapes the Management API returns:

```bash
cd /Users/nelsontaylor/taylormade-academy && printf 'select 1;\n-- x\n' | jq -c -Rs '{query: .}' && echo '[{"status":"academy room ready"}]' | jq -e '.[0].status == "academy room ready"' && echo '[{"line":"INFO guest = x"},{"line":"OK a"},{"line":"OK b"},{"line":"FAIL c"},{"line":"SKIP d"}]' > /tmp/verify-fake.json && jq -r '.[].line' /tmp/verify-fake.json && echo "ok=$(jq -r '[.[].line | select(startswith("OK "))] | length' /tmp/verify-fake.json) fail=$(jq -r '[.[].line | select(startswith("FAIL "))] | length' /tmp/verify-fake.json) skip=$(jq -r '[.[].line | select(startswith("SKIP "))] | length' /tmp/verify-fake.json)"; echo '{"message":"boom"}' | jq -e 'type == "array"'; echo "non-array exit=$?"; rm -f /tmp/verify-fake.json
```

Expected output, in order:

```
{"query":"select 1;\n-- x\n"}
true
INFO guest = x
OK a
OK b
FAIL c
SKIP d
ok=2 fail=1 skip=1
false
non-array exit=1
```

This proves: the SQL file is wrapped as `{"query": …}` with newlines escaped (the `jq -Rs` line), the apply success check matches the migration's last row, the OK/FAIL/SKIP counters count only prefixed lines, and an error object (`{"message": …}`) is detected as non-array so the script exits 1 instead of printing nothing. One more local check — the real files round-trip through the wrapper byte-for-byte:

```bash
cd /Users/nelsontaylor/taylormade-academy && jq -Rs '{query: .}' < supabase/migrations/0036_academy_room.sql | jq -j '.query' | cmp - supabase/migrations/0036_academy_room.sql && jq -Rs '{query: .}' < scripts/verify-0036.sql | jq -j '.query' | cmp - scripts/verify-0036.sql && echo ROUNDTRIP-OK
```

Expected: `ROUNDTRIP-OK` (no `cmp` output).

- [ ] **Step 7: Prove OPIL did not move — same 18 tests, only three new files in the tree**

```bash
cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)" && git status --short
```

Expected:

```
ℹ tests 18
ℹ pass 18
ℹ fail 0
?? scripts/apply-0036.sh
?? scripts/verify-0036.sql
?? supabase/migrations/0036_academy_room.sql
```

(plus the untracked `?? docs/superpowers/plans/2026-09-14-academy-room.md` if it is still uncommitted — not yours). No `M` lines: no tracked file changed, so `?classic=1` (`js/rtk-room.js`), room v2, the hub and every OPIL string are byte-identical. The only OPIL-facing change in this task is the `ea_opil_hands` rider (migration lines 223-224), and it is proved by two verify lines, not by a page: `OK rider: authenticated may insert ea_opil_hands (session_no, user_id, kind, note) and not staged_at / created_at / done_at` (the grant) and `OK OPIL-shaped ea_opil_hands insert (session_no, user_id, kind) still works · as …` (a real insert through the `hands_insert` policy on a live session, rolled back; it cannot SKIP) — the OPIL page inserts exactly `{ session_no, user_id, kind }` (`js/rtk-room-v2.js:377`, `askQuestion`), which is inside the granted column list.

- [ ] **Step 8: Commit the three files (no push)**

```bash
cd /Users/nelsontaylor/taylormade-academy && git add supabase/migrations/0036_academy_room.sql scripts/apply-0036.sh scripts/verify-0036.sql && git commit -m "db(academy): 0036 — the Academy room (ea_rooms, members, hands, replays, RPCs) + apply/verify script

One room, one link. ea_room_state is the only read path for non-admins and never
returns link_key or meeting_id; meeting_id and link_key are server-only (column grants);
a hand is inserted with (room_id, user_id, kind, note) only, and the same column grant
now closes ea_opil_hands.staged_at for OPIL students. scripts/apply-0036.sh POSTs the
migration through the Management API, then proves it inside begin…rollback (41 checks
as anon, a signed-in guest, a person in the session, Nelson, and an OPIL cohort member
or coordinator for the rider — every count scoped so --verify-only stays green after
real sessions).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" && git log --oneline -1
```

Expected: one line like `<sha> db(academy): 0036 — the Academy room (ea_rooms, members, hands, replays, RPCs) + apply/verify script`. Do not push — the rollout task (T10) pushes.

- [ ] **Step 9: Hand Nelson the one line (this is rollout step 1; T10 triggers it — do NOT run it yourself)**

Claude must not write to prod: the auto-mode classifier denies `curl … api.supabase.com/…/database/query` as a Production Deploy even after "go" (memory: gotcha-prod-deploy-classifier-use-bang-script), and the spine forbids it outright. When T10 reaches its step 1, paste exactly this into the chat for Nelson (the `!` prefix runs it in his Claude Code session and the output lands in the chat, so you can read every line yourself):

```
! bash scripts/apply-0036.sh
```

(From any other directory: `! bash /Users/nelsontaylor/taylormade-academy/scripts/apply-0036.sh` — the script resolves the repo root from its own path.)

Expected output, in full (the `·` tails carry the live values; `INFO` is not a failure):

```
== apply supabase/migrations/0036_academy_room.sql → pgqdmnmessbbzyszjfvr
HTTP 201
[{"status":"academy room ready"}]
applied.
== verify (begin … rollback — nothing is kept)
HTTP 201
INFO guest = 00000000-0000-4000-8000-000000000001 · throwaway auth.users row (rolled back)
OK the room row exists (ea_rooms has one row)
OK the seeded link_key is 22 url-safe chars
OK ea_room_new_key() returns 22 url-safe chars
OK exactly one room (ea_rooms_single index)
OK anon ea_room_state(bad key) = {"bad_link":true} · got {"bad_link": true}
OK anon ea_room_state() shape: signed_in/is_host/can_join/bad_link false, no link_key or meeting_id, recording_url and people null · {…}
OK anon sees 0 rows of ea_rooms · 0
OK anon sees 0 rows of ea_room_members · 0
OK anon sees 0 rows of ea_room_hands · 0
OK anon select from ea_room_replays → 42501 permission denied
OK guest, no key: signed_in true, can_join false, is_host false, people null · {…}
OK guest with the real key: can_join true, is_host false · {…}
OK guest with a wrong key = {"bad_link":true} (no title leaks) · {"bad_link": true}
OK guest insert into ea_rooms → 42501 permission denied for table ea_rooms
OK guest update ea_rooms.meeting_id → 42501 permission denied for table ea_rooms
OK guest update ea_rooms.link_key → 42501 permission denied for table ea_rooms
OK guest update ea_rooms.title touches 0 rows (admin-only RLS) · 0
OK select download_url from ea_room_replays → 42501 permission denied for table ea_room_replays
OK guest select id from ea_room_replays runs and sees 0 rows · 0
OK hand insert with staged_at → 42501 permission denied for table ea_room_hands
OK hand insert while not in session → 42501 new row violates row-level security policy for table "ea_room_hands"
OK hand insert (room_id, user_id, kind) while in session succeeds · 1 row
OK a person in the session reads the queue (room_hands_read) · 1 row
OK a person cannot stage their own hand (update is admin-only) · 0 rows
OK a members row admits nothing by itself (is_live true, can_join still false without the key) · {…}
OK ea_room_rotate_link() for a guest → 42501
OK ea_room_publish_replay() for a guest → 42501
OK ea_room_new_key() is revoked from authenticated → 42501
OK admin ea_room_state(): is_host true, can_join true, people = 1 (the seeded join) · {…}
OK admin with a stale key is never told bad_link (privilege admits) · {…}
OK admin reads ea_rooms directly (rooms_admin_read) · 1 row
OK admin reads ea_room_members (room_members_admin_read) · 1 row
OK admin updates ea_rooms.title (rooms_admin_update + column grant) · 1 row
OK admin ea_room_rotate_link() returns a fresh 22-char key
OK admin ea_room_publish_replay(unknown id) → P0002 (not ready)
OK rider: authenticated may insert ea_opil_hands (session_no, user_id, kind, note) and not staged_at / created_at / done_at
OK authenticated may insert ea_room_hands (room_id, user_id, kind, note) and not staged_at / created_at / done_at
OK ea_rooms grants: update only title/is_live/max_participants/live_since/ended_at/updated_at; no insert/delete
OK ea_room_replays grants: no download_url / download_expires_at for authenticated, nothing for anon
OK ea_room_hands is in the supabase_realtime publication
OK OPIL-shaped ea_opil_hands insert (session_no, user_id, kind) still works · as OPIL coordinator (ea_opil_team_members is empty — no student has claimed a team yet) · session <n>
== 41 OK · 0 FAIL · 0 SKIP
0036 is on prod and verified. Nothing from the verify was kept.
```

Acceptable variations that are still a pass: `HTTP 200` instead of `201`; `INFO guest = <a real uuid> · existing account (auth.users insert refused: 42501)`; the three `anon sees 0 rows` lines ending `· permission denied`; the in-session hand line reading `…passed the grant and the policy (stopped only by the one-open index, 23505)`; the last OPIL line ending `· as cohort member · session <n>` (a student has claimed a team since memory was written — `ea_opil_team_members` is empty today per `opil-hub-live-data-state`, so expect the coordinator variant) or `…passed the grant and the policy (stopped only by the one-open index, 23505) · as …` (that account already had an open hand on that session — the grant and the policy still ran). A `SKIP` line can only come from block 12b, and only if prod has no `profiles.role = 'admin'` row — Nelson is admin, so expect `0 SKIP`. The OPIL line can never SKIP: with no cohort member AND no OPIL coordinator account it prints FAIL and the script exits 1.

What a `FAIL` means and what to do: the migration IS applied (the apply half succeeded and the verify half is rolled back either way); read the FAIL line, fix `supabase/migrations/0036_academy_room.sql` (every statement is re-runnable: `create … if not exists`, `create or replace`, `drop policy if exists`, `on conflict do nothing`, revokes/grants), commit the fix, and hand Nelson the same line again — re-applying is safe. To re-run only the proof: `! bash scripts/apply-0036.sh --verify-only` (safe at any later time, including after real sessions — block 11/12b counts are scoped to the verify's own guest row). An `APPLY FAILED` with a Postgres error means nothing at all was kept (the file runs as one implicit transaction) — fix the statement it names and re-run. The one environment failure to know about: `FAIL … raised 42501 permission denied to set role "anon"` on every role-switch line means the API connection's role cannot `set role` — the checks themselves are fine; report it rather than editing them out.

---

### Task 3: ea-rtk-join — split into handler + tests, port the OPIL branch, close the side door

**Files:**
- Create: `supabase/functions/ea-rtk-join/handler.ts`
- Create: `supabase/functions/ea-rtk-join/handler_test.ts`
- Create: `supabase/functions/_shared/rtk_auth_test.ts`
- Modify: `supabase/functions/_shared/rtk_auth.ts:1-28` (header, `Resolved`, `resolveCaller`; `clientIp` inserted after line 28; `rtkClient` at lines 30-43 untouched)
- Modify (full rewrite): `supabase/functions/ea-rtk-join/index.ts:1-107`
- Test: `supabase/functions/ea-rtk-join/handler_test.ts`, `supabase/functions/_shared/rtk_auth_test.ts`; guards that must stay green: `supabase/functions/ea-rtk-record/handler_test.ts` (14), `supabase/functions/ea-rtk-webhook/handler_test.ts` (14), `tests/opil/*.test.mjs` (18)

**Interfaces:**
- Consumes: `resolveCaller(req, admin, url, anonKey)` and `rtkClient(acct, app, token)` from `supabase/functions/_shared/rtk_auth.ts:11` and `:31`; RPCs `ea_opil_my_role`, `ea_opil_in_cohort`, `ea_is_member`, `ea_is_admin` (migration 0001) and `ea_rate_check(p_key text, p_max int, p_window_secs int)` (migration 0004:18, service_role only); Task 2's tables `ea_rooms` (`id, title, link_key, is_live, live_since, meeting_id, max_participants, created_at`), `ea_room_members` (`room_id, user_id, first_joined_at, last_joined_at, joins`), `ea_room_replays.meeting_id`; the bodies the pages already send — `{ session_no }` or `{ session_no, meeting_id }` (`js/rtk-room-v2.js:41`, `js/rtk-room.js:40`); the response shape `{ token, meeting_id, preset, host, name }` that `js/rtk-room.js:53` and `opil/hub/live/index.html:127` rely on.
- Produces (spine §T3/T4, exact): from `handler.ts` — `JoinBody`, `Caller`, `SessionRow`, `RoomRow`, `CfResult`, `JoinDeps`, `Reply`, `Role`, `PRESETS`, `OPEN_WINDOW_MS`, `handleJoin(body, ctx, deps)`; from `rtk_auth.ts` — `Resolved.academyAdmin` (Task 5 reads it), `clientIp(req)`. The room branch is not built here: `handleJoin` answers `body.room === true` with `{ status: 404, body: { error: "not_found" } }` (one line, first thing in `handleJoin`) and the test named `body.room === true answers 404 not_found and never enters the OPIL path` pins that. **Task 4 replaces exactly those two things** plus one line in `index.ts`: `ensurePresets: async () => {}` becomes the real `ensurePresets(cf)` from `_shared/rtk_presets.ts`. Every dep Task 4's room branch needs (`rateCheck`, `getRoom`, `setRoomMeeting`, `roomMeetingIds`, `isMember`, `upsertMember`, `now`) is already built in `index.ts` by this task.

**What moves for OPIL, and why it is safe** (everything else is byte-identical — same RPC order, same 400/403/404/409/502 codes and error strings, same meeting title `OPIL ${no} — ${title.slice(0,80)}`, same participant body, same response):
1. `body.meeting_id` is ignored (the side door). The OPIL pages send the id they read from the same `ea_opil_sessions` row the server reads (`js/rtk-room-v2.js:41`), so their response does not change. Proof: tests `the side door is shut…` and `a client meeting_id never wins over the stored one`.
2. A session whose stored meeting is the Academy room's → 403 `not_allowed` before any participant POST. No OPIL session points at a room meeting today. Proof: `a session pointed at the Academy room's meeting is refused for every role…`.
3. A signed-out caller with a bad body now gets 401 `sign_in` instead of 400 `bad_session` (`resolveCaller` runs before the body is read — the `ea-rtk-record` convention). The pages never send a body without a token.
4. `cf()` is now the shared `rtkClient` (its `data` fallback is `j` rather than `{}` when Cloudflare sends neither `data` nor `result`; Cloudflare always sends `data`). `resolveCaller` makes one extra RPC (`ea_is_admin`) per join.
Byte-identity proof: the ten OPIL-shaped tests in `handler_test.ts` (`a coordinator gets opil-host…` through `Cloudflare failures…`) plus `the OPIL branch never touches the room plumbing except the room-meeting check`, and `node --test tests/opil/*.test.mjs` staying at 18 passed.

- [ ] **Step 1: Write the `clientIp` test and watch it fail**

Create `supabase/functions/_shared/rtk_auth_test.ts`:

```ts
// deno test supabase/functions/_shared/rtk_auth_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clientIp } from "./rtk_auth.ts";

const req = (headers: Record<string, string>) => new Request("https://p.supabase.co/functions/v1/ea-rtk-join", { method: "POST", headers });

Deno.test("clientIp prefers cf-connecting-ip", () => {
  assertEquals(clientIp(req({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1, 203.0.113.9" })), "203.0.113.9");
});

Deno.test("clientIp takes the LAST x-forwarded-for entry — the first one is written by the caller", () => {
  assertEquals(clientIp(req({ "x-forwarded-for": "1.1.1.1, 198.51.100.7" })), "198.51.100.7");
  assertEquals(clientIp(req({ "x-forwarded-for": " 198.51.100.7 " })), "198.51.100.7");
  assertEquals(clientIp(req({ "x-forwarded-for": "198.51.100.7, , " })), "198.51.100.7");
});

Deno.test("clientIp falls back to 'unknown'", () => {
  assertEquals(clientIp(req({})), "unknown");
  assertEquals(clientIp(req({ "x-forwarded-for": " , " })), "unknown");
});
```

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/_shared/rtk_auth_test.ts
```
Expected failure (type-check stage):
```
Check supabase/functions/_shared/rtk_auth_test.ts
TS2305 [ERROR]: Module '"file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk_auth.ts"' has no exported member 'clientIp'.
import { clientIp } from "./rtk_auth.ts";
         ~~~~~~~~
    at file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk_auth_test.ts:3:10

error: Type checking failed.
```

- [ ] **Step 2: `rtk_auth.ts` — `academyAdmin` on `resolveCaller`, add `clientIp`; go green; commit**

In `supabase/functions/_shared/rtk_auth.ts`, replace today's lines 1–28 (everything above the `/* The Cloudflare RealtimeKit REST client, scoped to this app. */` comment at line 30) with the block below. Lines 30–43 (`rtkClient`) stay exactly as they are.

Old (lines 1–28):
```ts
// Who is calling, and what may they do — the pattern every OPIL room function shares.
// verify_jwt is OFF on these functions: the browser sends its own access token, we resolve the
// user with the SERVICE ROLE client, then ask the database AS THAT USER for the OPIL role through
// the same RPC the hub pages use. Tokens never leave the function.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type Resolved = { user: { id: string; email?: string | null }; role: Role; asUser: SupabaseClient };
export type ResolveFail = { error: string; status: number };

export async function resolveCaller(req: Request, admin: SupabaseClient, url: string, anonKey: string): Promise<Resolved | ResolveFail> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "sign_in", status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: "sign_in", status: 401 };
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: role } = await asUser.rpc("ea_opil_my_role");
  const r = (role || {}) as Record<string, unknown>;
  return {
    user: { id: user.id, email: user.email },
    role: {
      admin: r.admin === true,
      judge: r.judge === true,
      facilitator_sessions: Array.isArray(r.facilitator_sessions) ? (r.facilitator_sessions as unknown[]).map(Number).filter(Number.isInteger) : [],
    },
    asUser,
  };
}
```

New:
```ts
// Who is calling, and what may they do — the pattern every OPIL room function shares.
// verify_jwt is OFF on these functions: the browser sends its own access token, we resolve the
// user with the SERVICE ROLE client, then ask the database AS THAT USER for the OPIL role through
// the same RPC the hub pages use, and whether they are the Academy admin (ea_is_admin — Nelson,
// the only host of the Academy room). Tokens never leave the function.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type Resolved = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; asUser: SupabaseClient };
export type ResolveFail = { error: string; status: number };

export async function resolveCaller(req: Request, admin: SupabaseClient, url: string, anonKey: string): Promise<Resolved | ResolveFail> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "sign_in", status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: "sign_in", status: 401 };
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: role } = await asUser.rpc("ea_opil_my_role");
  const { data: isAdmin } = await asUser.rpc("ea_is_admin");
  const r = (role || {}) as Record<string, unknown>;
  return {
    user: { id: user.id, email: user.email },
    role: {
      admin: r.admin === true,
      judge: r.judge === true,
      facilitator_sessions: Array.isArray(r.facilitator_sessions) ? (r.facilitator_sessions as unknown[]).map(Number).filter(Number.isInteger) : [],
    },
    academyAdmin: isAdmin === true,
    asUser,
  };
}

/* The caller's IP for rate limiting. Cloudflare's header when present; otherwise the LAST entry
   of x-forwarded-for — the first entry is whatever the caller wrote, the last is what the edge saw. */
export function clientIp(req: Request): string {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const hops = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : "unknown";
}
```

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/_shared/rtk_auth_test.ts && deno check supabase/functions/ea-rtk-record/index.ts
```
Expected:
```
running 3 tests from ./supabase/functions/_shared/rtk_auth_test.ts
clientIp prefers cf-connecting-ip ... ok (0ms)
clientIp takes the LAST x-forwarded-for entry — the first one is written by the caller ... ok (0ms)
clientIp falls back to 'unknown' ... ok (0ms)

ok | 3 passed | 0 failed (2ms)
Check supabase/functions/ea-rtk-record/index.ts
```
(`ea-rtk-record` only reads `who.user` and `who.role`; the added field breaks nothing.) Commit:
```
cd /Users/nelsontaylor/taylormade-academy && git add supabase/functions/_shared/rtk_auth.ts supabase/functions/_shared/rtk_auth_test.ts && git commit -m "feat(academy): rtk_auth — academyAdmin on resolveCaller, clientIp(req) for rate limiting

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Write `ea-rtk-join/handler_test.ts` and watch it fail**

Create `supabase/functions/ea-rtk-join/handler_test.ts`:

```ts
// deno test supabase/functions/ea-rtk-join/
// The OPIL branch, ported from the one-file function of 9/11–9/14. These tests are the proof that
// the OPIL class room did not move when the Academy room branch and the hardening landed.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleJoin, type Caller, type JoinDeps, OPEN_WINDOW_MS, PRESETS } from "./handler.ts";

const base = { academyAdmin: false, ip: "203.0.113.9" };
const COORD: Caller = { ...base, user: { id: "u-coord", email: "coord@x" }, role: { admin: true, judge: false, facilitator_sessions: [] } };
const FAC7: Caller = { ...base, user: { id: "u-fac", email: "fac@x" }, role: { admin: false, judge: false, facilitator_sessions: [7] } };
const JUDGE: Caller = { ...base, user: { id: "u-judge", email: "judge@x" }, role: { admin: false, judge: true, facilitator_sessions: [] } };
const STUDENT: Caller = { ...base, user: { id: "u-stu", email: "stu@x" }, role: { admin: false, judge: false, facilitator_sessions: [] } };
const A_UUID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

/* Sessions: 6 and 7 have a stored meeting; 8 has none yet; 9's stored meeting is the Academy room's.
   Every dep is wrapped so `touched` lists what the handler reached for, in order — overrides included. */
function deps(over: Partial<JoinDeps> = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const touched: string[] = [];
  const raw: JoinDeps = {
    cf: async (method, path, body) => {
      calls.push({ method, path, body });
      if (path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      return { ok: true, status: 200, data: { token: "tok-" + path.split("/")[2] } };
    },
    rateCheck: async () => true,
    getSession: async (no) =>
      no === 6 ? { no: 6, title: "Intro", stream_url: "rtk:meet-6", is_live: true }
      : no === 7 ? { no: 7, title: "Agents 101", stream_url: "rtk:meet-7", is_live: true }
      : no === 8 ? { no: 8, title: "No room", stream_url: null, is_live: false }
      : no === 9 ? { no: 9, title: "Pointed at the room", stream_url: "rtk:meet-room", is_live: true }
      : null,
    inCohort: async () => false,
    isMember: async () => false,
    getRoom: async () => null,
    setRoomMeeting: async () => {},
    roomMeetingIds: async () => new Set(["meet-room"]),
    upsertMember: async () => {},
    displayName: async () => null,
    ensurePresets: async () => {},
    now: () => new Date("2026-09-16T19:05:00-05:00"),
    ...over,
  };
  const d = { calls, touched } as JoinDeps & { calls: typeof calls; touched: typeof touched };
  for (const k of Object.keys(raw) as (keyof JoinDeps)[]) {
    const fn = raw[k] as (...a: unknown[]) => unknown;
    (d as unknown as Record<string, unknown>)[k] = k === "now" ? fn : (...a: unknown[]) => { touched.push(k); return fn(...a); };
  }
  return d;
}
const participantPosts = (d: { calls: { method: string; path: string }[] }) => d.calls.filter((c) => c.method === "POST" && c.path.endsWith("/participants"));
const err = (r: { body: unknown }) => (r.body as { error: string }).error;

Deno.test("the constants later tasks rely on", () => {
  assertEquals([...PRESETS], ["opil-host", "opil-student", "opil-judge", "tma-class-host", "tma-class-guest"]);
  assertEquals(OPEN_WINDOW_MS, 14400000);
});

Deno.test("a coordinator gets opil-host on any session, with the stored meeting", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 7 }, COORD, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-7", meeting_id: "meet-7", preset: "opil-host", host: true, name: "coord" });
  assertEquals(d.calls, [{ method: "POST", path: "/meetings/meet-7/participants", body: { custom_participant_id: "u-coord", preset_name: "opil-host", name: "coord" } }]);
});

Deno.test("the facilitator of THIS session is a host; of another session, a student at most", async () => {
  const mine = await handleJoin({ session_no: 7 }, FAC7, deps());
  assertEquals(mine.status, 200); assertEquals((mine.body as { preset: string; host: boolean }).preset, "opil-host"); assertEquals((mine.body as { host: boolean }).host, true);
  const other = await handleJoin({ session_no: 6 }, FAC7, deps({ inCohort: async () => true }));
  assertEquals(other.status, 200); assertEquals((other.body as { preset: string }).preset, "opil-student"); assertEquals((other.body as { host: boolean }).host, false);
  const outsider = await handleJoin({ session_no: 6 }, FAC7, deps());
  assertEquals(outsider.status, 403); assertEquals(err(outsider), "not_allowed");
});

Deno.test("a judge gets opil-judge without a cohort check", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 7 }, JUDGE, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-7", meeting_id: "meet-7", preset: "opil-judge", host: false, name: "judge" });
  assertEquals(d.touched.includes("inCohort"), false);
});

Deno.test("a cohort member gets opil-student", async () => {
  const r = await handleJoin({ session_no: 7 }, STUDENT, deps({ inCohort: async () => true }));
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-7", meeting_id: "meet-7", preset: "opil-student", host: false, name: "stu" });
});

Deno.test("a stranger is refused before the session is even read", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 7 }, STUDENT, d);
  assertEquals(r.status, 403); assertEquals(err(r), "not_allowed");
  assertEquals(d.calls.length, 0);
  assertEquals(d.touched, ["inCohort"]);
});

Deno.test("the side door is shut: a student on a session with no stored meeting gets 409 not_open EVEN WITH a meeting_id in the body", async () => {
  const d = deps({ inCohort: async () => true });
  const r = await handleJoin({ session_no: 8, meeting_id: A_UUID }, STUDENT, d);
  assertEquals(r.status, 409); assertEquals(err(r), "not_open");
  assertEquals(d.calls.length, 0);
  const plain = await handleJoin({ session_no: 8 }, STUDENT, deps({ inCohort: async () => true }));
  assertEquals(plain.status, 409); assertEquals(err(plain), "not_open");
});

Deno.test("a client meeting_id never wins over the stored one", async () => {
  const d = deps({ inCohort: async () => true });
  const r = await handleJoin({ session_no: 7, meeting_id: A_UUID }, STUDENT, d);
  assertEquals(r.status, 200); assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-7");
  assertEquals(d.calls.map((c) => c.path), ["/meetings/meet-7/participants"]);
  const h = deps();
  await handleJoin({ session_no: 7, meeting_id: A_UUID }, COORD, h);
  assertEquals(h.calls.map((c) => c.path), ["/meetings/meet-7/participants"]);
});

Deno.test("a host on a session with no meeting creates one and the reply carries its id", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 8 }, COORD, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-new", meeting_id: "meet-new", preset: "opil-host", host: true, name: "coord" });
  assertEquals(d.calls, [
    { method: "POST", path: "/meetings", body: { title: "OPIL 8 — No room", persist_chat: false } },
    { method: "POST", path: "/meetings/meet-new/participants", body: { custom_participant_id: "u-coord", preset_name: "opil-host", name: "coord" } },
  ]);
});

Deno.test("a session pointed at the Academy room's meeting is refused for every role, with zero participant POSTs", async () => {
  const FAC9: Caller = { ...FAC7, role: { admin: false, judge: false, facilitator_sessions: [9] } };
  for (const [who, over] of [[COORD, {}], [FAC9, {}], [JUDGE, {}], [STUDENT, { inCohort: async () => true }]] as [Caller, Partial<JoinDeps>][]) {
    const d = deps(over);
    const r = await handleJoin({ session_no: 9 }, who, d);
    assertEquals(r.status, 403, who.user.id); assertEquals(err(r), "not_allowed", who.user.id);
    assertEquals(participantPosts(d).length, 0, who.user.id);
    assertEquals(d.touched.includes("roomMeetingIds"), true, who.user.id);
  }
});

Deno.test("bad session_no → 400 bad_session; unknown session → 404 not_found", async () => {
  assertEquals(err(await handleJoin({}, COORD, deps())), "bad_session");
  assertEquals((await handleJoin({}, COORD, deps())).status, 400);
  assertEquals((await handleJoin({ session_no: 1.5 }, COORD, deps())).status, 400);
  assertEquals((await handleJoin({ session_no: "7" as unknown as number }, COORD, deps())).status, 200);   /* the page sends a number; a numeric string still parses, as today */
  const gone = await handleJoin({ session_no: 99 }, COORD, deps());
  assertEquals(gone.status, 404); assertEquals(err(gone), "not_found");
});

Deno.test("the name is ea_profiles.display_name, else the email prefix, else 'Member', cut to 60", async () => {
  const named = await handleJoin({ session_no: 7 }, COORD, deps({ displayName: async () => "Nelson Taylor" }));
  assertEquals((named.body as { name: string }).name, "Nelson Taylor");
  const long = await handleJoin({ session_no: 7 }, COORD, deps({ displayName: async () => "x".repeat(70) }));
  assertEquals((long.body as { name: string }).name.length, 60);
  const noEmail = await handleJoin({ session_no: 7 }, { ...COORD, user: { id: "u-coord", email: null } }, deps());
  assertEquals((noEmail.body as { name: string }).name, "Member");
});

Deno.test("Cloudflare failures surface as 502 cloudflare_<status>", async () => {
  const p = await handleJoin({ session_no: 7 }, COORD, deps({ cf: async () => ({ ok: false, status: 403, data: {} }) }));
  assertEquals(p.status, 502); assertEquals(err(p), "cloudflare_403");
  const m = await handleJoin({ session_no: 8 }, COORD, deps({ cf: async () => ({ ok: false, status: 500, data: {} }) }));
  assertEquals(m.status, 502); assertEquals(err(m), "cloudflare_500");
  const noId = await handleJoin({ session_no: 8 }, COORD, deps({ cf: async () => ({ ok: true, status: 200, data: {} }) }));
  assertEquals(noId.status, 502); assertEquals(err(noId), "cloudflare_no_id");
});

Deno.test("the OPIL branch never touches the room plumbing except the room-meeting check", async () => {
  const d = deps();
  await handleJoin({ session_no: 7 }, COORD, d);
  assertEquals(d.touched, ["getSession", "roomMeetingIds", "displayName", "cf"]);
  const s = deps({ inCohort: async () => true });
  await handleJoin({ session_no: 7 }, STUDENT, s);
  assertEquals(s.touched, ["inCohort", "getSession", "roomMeetingIds", "displayName", "cf"]);
});

Deno.test("body.room === true answers 404 not_found and never enters the OPIL path", async () => {
  const d = deps();
  const r = await handleJoin({ room: true, key: "k".repeat(22) }, COORD, d);
  assertEquals(r.status, 404); assertEquals(err(r), "not_found");
  assertEquals(d.touched, []); assertEquals(d.calls.length, 0);
});
```

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-join/
```
Expected failure (first lines; the implicit-any errors that follow are the same missing module):
```
Check supabase/functions/ea-rtk-join/handler_test.ts
TS2307 [ERROR]: Cannot find module 'file:///Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/handler.ts'.
    at file:///Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-join/handler_test.ts:5:81
```

- [ ] **Step 4: Write `handler.ts` — the OPIL branch ported, `meeting_id` ignored, room meetings refused; go green; commit**

Create `supabase/functions/ea-rtk-join/handler.ts` (no imports — `deno test` runs fully offline):

```ts
// ea-rtk-join — the pure decisions behind "hand this signed-in person a token for the meeting".
// No network, no env, no supabase here: index.ts injects `deps`, handler_test.ts stubs them.
//
// OPIL branch (body.room !== true) — the one-file function of 9/11–9/14, ported line for line,
// with two hardenings the critique of the Academy room asked for:
//   · a client-supplied meeting_id is IGNORED. The meeting is the session's stored "rtk:" id or
//     one a host creates here; a student on a session with no stored id gets 409 not_open.
//   · a session whose meeting is the Academy room's (ea_rooms.meeting_id, or any
//     ea_room_replays.meeting_id) is refused with 403 not_allowed before a participant is minted.
//   coordinator (role.admin) or facilitator of this session  -> opil-host
//   judge (role.judge)                                       -> opil-judge   (watch + chat, no media)
//   cohort member (ea_opil_in_cohort)                        -> opil-student
//   anyone else                                              -> 403 not_allowed
//
// Room branch (body.room === true): the Academy room. Until it is built, a room body answers
// 404 not_found — nothing on the OPIL path runs for it.

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type JoinBody = { room?: boolean; key?: string | null; session_no?: number; meeting_id?: string };
export type Caller = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; ip: string };
export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
export type RoomRow = { id: string; title: string; link_key: string; is_live: boolean; live_since: string | null; meeting_id: string | null; max_participants: number };
export type CfResult = { ok: boolean; status: number; data: unknown };
export type JoinDeps = {
  cf: (method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) => Promise<CfResult>;
  rateCheck: (key: string, max: number, windowSecs: number) => Promise<boolean | null>;   /* null = limiter unavailable → treat as allowed */
  getSession: (no: number) => Promise<SessionRow | null>;      /* OPIL row, service role */
  inCohort: () => Promise<boolean>;                             /* rpc ea_opil_in_cohort AS CALLER */
  isMember: () => Promise<boolean>;                             /* rpc ea_is_member AS CALLER */
  getRoom: () => Promise<RoomRow | null>;                       /* order by created_at limit 1, service role */
  setRoomMeeting: (roomId: string, meetingId: string) => Promise<void>;   /* service role update */
  roomMeetingIds: () => Promise<Set<string>>;                   /* ea_rooms.meeting_id ∪ ea_room_replays.meeting_id (non-null) */
  upsertMember: (roomId: string, userId: string) => Promise<void>;
  displayName: (userId: string) => Promise<string | null>;      /* ea_profiles.display_name */
  ensurePresets: () => Promise<void>;
  now: () => Date;
};
export type Reply = { status: number; body: unknown };
export const PRESETS = ["opil-host", "opil-student", "opil-judge", "tma-class-host", "tma-class-guest"] as const;
export const OPEN_WINDOW_MS = 4 * 3600 * 1000;   /* a room left live by a dead tab admits guests for this long */

const RTK_PREFIX = "rtk:";

export async function handleJoin(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  if (body.room === true) return { status: 404, body: { error: "not_found" } };
  return joinOpil(body, ctx, deps);
}

async function joinOpil(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  const no = Number(body.session_no);
  if (!Number.isInteger(no)) return { status: 400, body: { error: "bad_session" } };

  // Role check ran AS THE CALLER in resolveCaller (ea_opil_my_role); the cohort check runs here,
  // only when the cheaper answers said no — exactly the order the one-file function used.
  const isHost = ctx.role.admin === true || ctx.role.facilitator_sessions.includes(no);
  let preset: typeof PRESETS[number] | null = null;
  if (isHost) preset = "opil-host";
  else if (ctx.role.judge === true) preset = "opil-judge";
  else if (await deps.inCohort()) preset = "opil-student";
  if (!preset || !PRESETS.includes(preset)) return { status: 403, body: { error: "not_allowed" } };

  // The session row is the shared source of truth for which meeting this is. Read with the
  // service role so a student who cannot yet see the row still gets the right meeting.
  const row = await deps.getSession(no);
  if (!row) return { status: 404, body: { error: "not_found" } };
  const stored = typeof row.stream_url === "string" && row.stream_url.startsWith(RTK_PREFIX) ? row.stream_url.slice(RTK_PREFIX.length) : null;

  let meetingId = stored;
  if (!meetingId) {
    // Only a host opens a room. A student arriving before the facilitator gets a plain 409 so the
    // page can say "the room opens when your facilitator starts it" instead of spending minutes.
    if (!isHost) return { status: 409, body: { error: "not_open" } };
    const made = await deps.cf("POST", "/meetings", { title: `OPIL ${no} — ${String(row.title || "session").slice(0, 80)}`, persist_chat: false });
    if (!made.ok) return { status: 502, body: { error: "cloudflare_" + made.status } };
    meetingId = String(((made.data || {}) as Record<string, unknown>).id || "");
    if (!meetingId) return { status: 502, body: { error: "cloudflare_no_id" } };
  }

  // The Academy room's meeting is never an OPIL class: a facilitator who points a session's
  // stream_url at it gets nothing, whatever their OPIL role.
  if ((await deps.roomMeetingIds()).has(meetingId)) return { status: 403, body: { error: "not_allowed" } };

  // One participant per person per meeting. custom_participant_id is the Supabase uid — never an email.
  const name = String((await deps.displayName(ctx.user.id)) || (ctx.user.email || "Member").split("@")[0]).slice(0, 60);
  const added = await deps.cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: ctx.user.id, preset_name: preset, name });
  if (!added.ok) return { status: 502, body: { error: "cloudflare_" + added.status } };
  const token = ((added.data || {}) as Record<string, unknown>).token;

  return { status: 200, body: { token, meeting_id: meetingId, preset, host: isHost, name } };
}
```

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-join/
```
Expected:
```
Check supabase/functions/ea-rtk-join/handler_test.ts
running 15 tests from ./supabase/functions/ea-rtk-join/handler_test.ts
the constants later tasks rely on ... ok (0ms)
a coordinator gets opil-host on any session, with the stored meeting ... ok (5ms)
the facilitator of THIS session is a host; of another session, a student at most ... ok (0ms)
a judge gets opil-judge without a cohort check ... ok (0ms)
a cohort member gets opil-student ... ok (0ms)
a stranger is refused before the session is even read ... ok (0ms)
the side door is shut: a student on a session with no stored meeting gets 409 not_open EVEN WITH a meeting_id in the body ... ok (0ms)
a client meeting_id never wins over the stored one ... ok (0ms)
a host on a session with no meeting creates one and the reply carries its id ... ok (0ms)
a session pointed at the Academy room's meeting is refused for every role, with zero participant POSTs ... ok (0ms)
bad session_no → 400 bad_session; unknown session → 404 not_found ... ok (0ms)
the name is ea_profiles.display_name, else the email prefix, else 'Member', cut to 60 ... ok (0ms)
Cloudflare failures surface as 502 cloudflare_<status> ... ok (0ms)
the OPIL branch never touches the room plumbing except the room-meeting check ... ok (0ms)
body.room === true answers 404 not_found and never enters the OPIL path ... ok (0ms)

ok | 15 passed | 0 failed (8ms)
```
(These tests are load-bearing: restoring today's `stored || given` fails `the side door is shut…`; deleting the `roomMeetingIds` line fails `a session pointed at the Academy room's meeting…` and `the OPIL branch never touches…`. Both mutations were run while writing this task.) Commit:
```
cd /Users/nelsontaylor/taylormade-academy && git add supabase/functions/ea-rtk-join/handler.ts supabase/functions/ea-rtk-join/handler_test.ts && git commit -m "feat(academy): ea-rtk-join — handler.ts + tests; OPIL branch ported, client meeting_id ignored, room meetings refused

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Rewrite `index.ts` to build the deps and call `handleJoin`; type-check; commit**

Replace the whole of `supabase/functions/ea-rtk-join/index.ts` (today's lines 1–107 — the one-file function whose logic now lives in `handler.ts`) with:

```ts
// ea-rtk-join — hands one signed-in person a token for a RealtimeKit meeting, with the preset
// their role earns. The rules live in handler.ts; handler_test.ts is the proof. This file only
// wires the world in: env, the service-role client, the caller, the Cloudflare client.
//
// Two bodies, one function:
//   { session_no }          an OPIL class. coordinator (role.admin) or facilitator of this session
//                           -> opil-host · judge -> opil-judge (watch + chat, no media) · cohort
//                           member -> opil-student · anyone else -> 403. The meeting is the
//                           session's stored "rtk:" id (ea_opil_sessions.stream_url) or one a host
//                           creates here; a meeting_id in the body is ignored, and a session
//                           pointed at the Academy room's meeting is refused.
//   { room: true, key? }    the Academy room — answers 404 not_found until the room branch lands.
//
// Auth model: verify_jwt is OFF. The caller sends its own logged-in access token; we resolve the
// user with the SERVICE ROLE client, then ask the database AS THAT USER which role they hold
// (resolveCaller: ea_opil_my_role + ea_is_admin). The Cloudflare token never leaves this function.
//
// Secrets: CF_ACCOUNT_ID, CF_RTK_APP_ID, CF_RTK_API_TOKEN (Realtime Admin), SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Deploy: --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientIp, resolveCaller, rtkClient } from "../_shared/rtk_auth.ts";
import { handleJoin, type JoinBody } from "./handler.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";
const ROOM_COLS = "id, title, link_key, is_live, live_since, meeting_id, max_participants";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const acct = Deno.env.get("CF_ACCOUNT_ID"), app = Deno.env.get("CF_RTK_APP_ID"), cfToken = Deno.env.get("CF_RTK_API_TOKEN");
  if (!acct || !app || !cfToken) return json({ error: "rtk_not_configured" }, 503);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const who = await resolveCaller(req, admin, url, ANON_KEY);
  if ("error" in who) return json({ error: who.error }, who.status);

  let body: JoinBody = {};
  try { body = await req.json(); } catch (_) { /* handler answers bad_session */ }

  const reply = await handleJoin(body, { user: who.user, role: who.role, academyAdmin: who.academyAdmin, ip: clientIp(req) }, {
    cf: rtkClient(acct, app, cfToken),
    /* fail-open like every other ea_rate_check caller: only an explicit false refuses */
    rateCheck: async (key, max, windowSecs) => {
      const { data } = await admin.rpc("ea_rate_check", { p_key: key, p_max: max, p_window_secs: windowSecs });
      return data === true ? true : data === false ? false : null;
    },
    getSession: async (no) => {
      const { data } = await admin.from("ea_opil_sessions").select("no, title, stream_url, is_live").eq("no", no).maybeSingle();
      return data ?? null;
    },
    inCohort: async () => (await who.asUser.rpc("ea_opil_in_cohort")).data === true,
    isMember: async () => (await who.asUser.rpc("ea_is_member")).data === true,
    getRoom: async () => {
      const { data } = await admin.from("ea_rooms").select(ROOM_COLS).order("created_at", { ascending: true }).limit(1).maybeSingle();
      return data ?? null;
    },
    setRoomMeeting: async (roomId, meetingId) => {   /* a fresh meeting IS a fresh session: is_live + live_since move with it, so a row left live by a dead tab (> 4 h, spec §6.1 step 5) admits people again the moment Nelson re-enters — the page's onOpened writes the same two fields a moment later on a normal Start, and nothing at all on a host_live re-entry */
      const at = new Date().toISOString(), { error } = await admin.from("ea_rooms").update({ meeting_id: meetingId, is_live: true, live_since: at, updated_at: at }).eq("id", roomId);
      if (error) throw new Error(error.message);
    },
    /* Every meeting the Academy room has used. A query error (the room tables not there yet, a
       hiccup) logs and yields an empty set: the room's plumbing must never lock an OPIL class out. */
    roomMeetingIds: async () => {
      const ids = new Set<string>();
      const [rooms, replays] = await Promise.all([
        admin.from("ea_rooms").select("meeting_id").not("meeting_id", "is", null),
        admin.from("ea_room_replays").select("meeting_id").not("meeting_id", "is", null),
      ]);
      if (rooms.error) console.error("[ea-rtk-join] ea_rooms", rooms.error.message);
      if (replays.error) console.error("[ea-rtk-join] ea_room_replays", replays.error.message);
      for (const r of [...(rooms.data || []), ...(replays.data || [])]) if (typeof r.meeting_id === "string" && r.meeting_id) ids.add(r.meeting_id);
      return ids;
    },
    /* joins + 1 and last_joined_at = now(); the first join also sets first_joined_at (a default,
       but stated so a re-join never resets it) */
    upsertMember: async (roomId, userId) => {
      const { data: have } = await admin.from("ea_room_members").select("joins").eq("room_id", roomId).eq("user_id", userId).maybeSingle();
      const at = new Date().toISOString();
      const row: Record<string, unknown> = have
        ? { room_id: roomId, user_id: userId, joins: Number(have.joins || 0) + 1, last_joined_at: at }
        : { room_id: roomId, user_id: userId, joins: 1, first_joined_at: at, last_joined_at: at };
      const { error } = await admin.from("ea_room_members").upsert(row, { onConflict: "room_id,user_id" });
      if (error) throw new Error(error.message);
    },
    displayName: async (userId) => {
      const { data } = await admin.from("ea_profiles").select("display_name").eq("user_id", userId).maybeSingle();
      return typeof data?.display_name === "string" ? data.display_name : null;
    },
    /* nothing to ensure until the room branch exists — no Cloudflare preset is touched today */
    ensurePresets: async () => {},
    now: () => new Date(),
  }).catch((e) => { console.error("[ea-rtk-join]", String(e && e.message || e)); return { status: 500, body: { error: "server" } }; });

  return json(reply.body, reply.status);
});
```

Notes for the engineer: `row: Record<string, unknown>` is deliberate — a union-typed literal trips supabase-js's excess-property check on `upsert` (seen while writing this task). `roomMeetingIds` fails open on a query error on purpose: if this function is ever deployed before migration 0036 exists, OPIL joins must keep working; the error is logged. There is no unit test for `index.ts` (it is `Deno.serve` + network); the check is the type-checker. Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno check supabase/functions/ea-rtk-join/index.ts
```
Expected (no errors; fetches esm.sh on a cold cache, already cached on this machine):
```
Check supabase/functions/ea-rtk-join/index.ts
```
Commit:
```
cd /Users/nelsontaylor/taylormade-academy && git add supabase/functions/ea-rtk-join/index.ts && git commit -m "feat(academy): ea-rtk-join — index.ts wires resolveCaller + clientIp + deps around handleJoin

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: The guards — every deno suite and the 18 OPIL node tests stay green; nothing to commit**

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno check supabase/functions/ea-rtk-join/index.ts supabase/functions/ea-rtk-record/index.ts supabase/functions/ea-rtk-webhook/index.ts && deno test supabase/functions/ea-rtk-join/ supabase/functions/ea-rtk-record/ supabase/functions/ea-rtk-webhook/ supabase/functions/_shared/rtk_auth_test.ts && node --test tests/opil/*.test.mjs
```
Expected (summary lines; per-test lines omitted):
```
Check supabase/functions/ea-rtk-join/index.ts
Check supabase/functions/ea-rtk-record/index.ts
Check supabase/functions/ea-rtk-webhook/index.ts
running 3 tests from ./supabase/functions/_shared/rtk_auth_test.ts
running 15 tests from ./supabase/functions/ea-rtk-join/handler_test.ts
running 14 tests from ./supabase/functions/ea-rtk-record/handler_test.ts
running 14 tests from ./supabase/functions/ea-rtk-webhook/handler_test.ts

ok | 46 passed | 0 failed (165ms)
ℹ tests 18
ℹ suites 0
ℹ pass 18
ℹ fail 0
```
Then `git status --short` shows nothing under `supabase/functions/` (three commits made in Steps 2, 4, 5; no push — the rollout task deploys with `supabase functions deploy ea-rtk-join --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`). `js/rtk-room.js` (`?classic=1`), `js/rtk-room-v2.js` and `opil/hub/live/index.html` are not touched by this task; they keep sending `{ session_no, meeting_id }` and keep receiving `{ token, meeting_id, preset, host, name }`. If `deno test` is ever run from a directory that has a `package.json` above it (the scratchpad harness has one), deno switches to node_modules resolution and fails with `Could not find a matching package for 'npm:@types/node'` — always run from the repo root, which has no `package.json` or `deno.json`.

---

### Task 4: ea-rtk-join — the room branch, the two Academy presets, `ensurePresets`

**Files:**
- Create: `scripts/rtk-presets/tma-class-host.json` (copy of `opil-host.json`, `name` changed)
- Create: `scripts/rtk-presets/tma-class-guest.json` (copy of `opil-student.json`, `name` changed, `chat.public.files` and `chat.private.files` false)
- Delete (git rm): `scripts/rtk-presets/tma-webinar-host.json`, `scripts/rtk-presets/tma-webinar-member.json` (both tracked today; `scripts/rtk-presets.ids` is gitignored via `scripts/.gitignore:1` and is not touched)
- Create: `supabase/functions/_shared/rtk_presets.ts`
- Create: `supabase/functions/_shared/rtk_presets_test.ts`
- Modify: `supabase/functions/ea-rtk-join/handler.ts` — the file Task 3 created (90 lines as Task 3 leaves it). Three located edits: the header comment at lines 15–16, the placeholder at line 45, and a block appended after line 90. Nothing in `joinOpil` moves.
- Modify: `supabase/functions/ea-rtk-join/handler_test.ts` — the file Task 3 created (179 lines as Task 3 leaves it). ONE Task 3 test is replaced (lines 174–179, the one that pins the placeholder's `404 not_found`); a block is APPENDED after it; nothing else above it changes.
- Modify: `supabase/functions/ea-rtk-join/index.ts` — Task 3 rewrote it (108 lines as Task 3 leaves it; today's pre-Task-3 file is 107 lines and is gone). Four located edits: line 12 (header comment), line 22 (one import added above it), lines 53–54 (`cf` hoisted into a `const`), lines 102–103 (`ensurePresets` wired). No full-file overwrite — Task 3's `roomMeetingIds` (`Promise.all` + error logging, on the OPIL path) and `upsertMember` (single `.upsert(…, { onConflict })`) stay exactly as Task 3 wrote them.
- Test: `supabase/functions/ea-rtk-join/handler_test.ts`, `supabase/functions/_shared/rtk_presets_test.ts`
- Not modified: `scripts/rtk-presets.sh` (it loops over `scripts/rtk-presets/*.json`; after this task those are `opil-host`, `opil-judge`, `opil-student`, `tma-class-host`, `tma-class-guest` — still "the five presets" its header names). Line numbers for the three `ea-rtk-join` files are as Task 3 leaves them, so every edit below is located with a `grep -n` first and the grep's expected line is stated.

**Interfaces:**
- Consumes (from Task 3's `supabase/functions/ea-rtk-join/handler.ts`, spine §T3/T4): `handleJoin(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply>`, `JoinBody`, `Caller` (`{ user, role, academyAdmin, ip }`), `JoinDeps` (`cf`, `rateCheck`, `getSession`, `inCohort`, `isMember`, `getRoom`, `setRoomMeeting`, `roomMeetingIds`, `upsertMember`, `displayName`, `ensurePresets`, `now`), `RoomRow`, `Reply`, `OPEN_WINDOW_MS = 4 * 3600 * 1000`, `PRESETS` (already lists `tma-class-host`, `tma-class-guest`). From Task 3's `handler_test.ts`: the `deps()` helper (records `touched` and `calls`), `COORD`, `err()`. From Task 3's `_shared/rtk_auth.ts`: `resolveCaller(req, admin, url, anonKey)` returning `academyAdmin`, `clientIp(req)`, `rtkClient(acct, app, token)`. From Task 2 (0036): `public.ea_rooms (id, title, link_key, is_live, live_since, meeting_id, max_participants, created_at, updated_at)`, `public.ea_room_members (room_id, user_id, first_joined_at, last_joined_at, joins)`, `public.ea_room_replays.meeting_id`, RPC `ea_is_member`. From 0004: RPC `ea_rate_check(p_key text, p_max int, p_window_secs int) returns boolean` (service role only).
- Produces: `PRESET_BODIES: Record<"tma-class-host" | "tma-class-guest", Record<string, unknown>>` and `ensurePresets(cf: JoinDeps["cf"]): Promise<void>` in `_shared/rtk_presets.ts`; the room-branch contract the pages build on — request `{ room: true, key?: string }`, host reply `{ token, meeting_id, preset: 'tma-class-host', host: true, name }`, guest reply `{ token, preset: 'tma-class-guest', host: false, name }` (NO `meeting_id`), error codes `slow_down` 429 · `rtk_not_configured` 503 · `bad_link` 404 · `not_allowed` 403 · `not_open` 409 · `room_full` 429 · `cloudflare_<status>` 502 (Task 7's `joinTarget` error map and Task 8's `joinErrorText` translate exactly these); `ea_rooms.meeting_id` written on every Start class (Task 5's `getRoom().meeting_id` and Task 6's `targetByMeeting` read it); Cloudflare presets named `tma-class-host` / `tma-class-guest` (Task 10 confirms them on the dashboard).

**OPIL stays byte-identical:** no OPIL page ever sends `room: true`. This task changes one dispatch line in `handleJoin` (line 45) and nothing inside `joinOpil`; `index.ts`'s OPIL deps (`getSession`, `inCohort`, `roomMeetingIds`, `displayName`) are not touched. The proof is Step 8: all 14 untouched Task 3 OPIL tests in `handler_test.ts` still print `ok`, `node --test tests/opil/*.test.mjs` still says `pass 18`, and the record + webhook suites still contribute their 28 to `ok | 55 passed | 0 failed`.

---

- [ ] **Step 1: Create the two Academy preset bodies and retire the webinar pair**

`tma-class-host.json` is `opil-host.json` with only line 2 changed. Write it in full (116 lines):

```json
{
  "name": "tma-class-host",
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
      "can_edit_config": true,
      "config": {}
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
      "logo": "https://taylormadeacademy.com/assets/logo-nav.webp",
      "spacing_base": 4
    }
  }
}
```

`tma-class-guest.json` is `opil-student.json` with line 2 changed and line 52 (`chat.public.files`) flipped to `false`; line 58 (`chat.private.files`) is already `false` in `opil-student.json` and stays `false`. People Nelson does not know must not push files at each other under his name; text chat stays. Write it in full (116 lines):

```json
{
  "name": "tma-class-guest",
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
      "can_edit_config": false,
      "config": {}
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
      "logo": "https://taylormadeacademy.com/assets/logo-nav.webp",
      "spacing_base": 4
    }
  }
}
```

Prove both are exact copies with only the intended lines changed, then retire the webinar pair:

```bash
cd /Users/nelsontaylor/taylormade-academy
diff scripts/rtk-presets/opil-host.json scripts/rtk-presets/tma-class-host.json
diff scripts/rtk-presets/opil-student.json scripts/rtk-presets/tma-class-guest.json
git rm scripts/rtk-presets/tma-webinar-host.json scripts/rtk-presets/tma-webinar-member.json
ls -1 scripts/rtk-presets/
```

Expected output, exactly (one name per line from `ls -1`, so it does not depend on terminal width):

```
2c2
<   "name": "opil-host",
---
>   "name": "tma-class-host",
2c2
<   "name": "opil-student",
---
>   "name": "tma-class-guest",
52c52
<         "files": true
---
>         "files": false
rm 'scripts/rtk-presets/tma-webinar-host.json'
rm 'scripts/rtk-presets/tma-webinar-member.json'
opil-host.json
opil-judge.json
opil-student.json
tma-class-guest.json
tma-class-host.json
```

If either `diff` prints anything else, the JSON is not a verbatim copy — fix the file, do not proceed. Commit (the `git rm` already staged the two deletions; git may display the pair as renames in the commit stat because the bodies are similar — that is cosmetic):

```bash
cd /Users/nelsontaylor/taylormade-academy
git add scripts/rtk-presets/tma-class-host.json scripts/rtk-presets/tma-class-guest.json
git commit -m "$(cat <<'EOF'
feat(academy): Academy room presets — tma-class-host / tma-class-guest bodies, webinar pair retired

tma-class-host = opil-host with the name changed. tma-class-guest = opil-student with the
name changed and chat.public.files / chat.private.files false (people who do not know each
other must not push files under Nelson's name; text chat stays). tma-webinar-host/member
are superseded by the spec (2026-09-14 §5); the presets already on Cloudflare stay unused.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Write the failing test for `ensurePresets`**

`ensurePresets` remembers success in a module-level boolean, so each test imports its own copy of the module — in Deno a different query string on a local specifier is a fresh module instance (verified on deno 2.7.7). Create `supabase/functions/_shared/rtk_presets_test.ts`:

```ts
// deno test --allow-read=scripts/rtk-presets supabase/functions/_shared/rtk_presets_test.ts
// ensurePresets caches success in a module-level boolean, so every test imports its own copy of
// the module (a different query string = a fresh instance in Deno) instead of sharing one cache.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PRESET_BODIES } from "./rtk_presets.ts";
import type { JoinDeps } from "../ea-rtk-join/handler.ts";

type Call = { method: string; path: string; body?: unknown };
type Answer = (method: string, path: string) => { ok: boolean; status: number; data: unknown };

function fakeCf(answer: Answer): JoinDeps["cf"] & { calls: Call[] } {
  const calls: Call[] = [];
  const cf = (async (method: string, path: string, body?: unknown) => { calls.push({ method, path, body }); return answer(method, path); }) as JoinDeps["cf"] & { calls: Call[] };
  cf.calls = calls;
  return cf;
}
const HOST_ON_CF = { id: "p-host", name: "tma-class-host", permissions: PRESET_BODIES["tma-class-host"].permissions };
const GUEST_OK_ON_CF = { id: "p-guest", name: "tma-class-guest", permissions: PRESET_BODIES["tma-class-guest"].permissions };
const GUEST_FILES_ON = { id: "p-guest", name: "tma-class-guest", permissions: { chat: { public: { can_send: true, text: true, files: true }, private: { can_send: true, can_receive: true, text: true, files: false } } } };

Deno.test("the TS bodies are the committed JSON files, verbatim", async () => {
  for (const name of ["tma-class-host", "tma-class-guest"] as const) {
    const json = JSON.parse(await Deno.readTextFile(new URL(`../../../scripts/rtk-presets/${name}.json`, import.meta.url)));
    assertEquals(PRESET_BODIES[name], json);
  }
});

Deno.test("both missing → POST both bodies, in order", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=missing");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [] } : { ok: true, status: 200, data: { id: "p-new" } }));
  await ensurePresets(cf);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "POST", path: "/presets", body: PRESET_BODIES["tma-class-host"] },
    { method: "POST", path: "/presets", body: PRESET_BODIES["tma-class-guest"] },
  ]);
});

Deno.test("404 from the list means 'none yet' → POST both", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=404");
  const cf = fakeCf((m) => (m === "GET" ? { ok: false, status: 404, data: {} } : { ok: true, status: 200, data: { id: "p-new" } }));
  await ensurePresets(cf);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets", "POST /presets", "POST /presets"]);
});

Deno.test("guest present with files on → PATCH the guest by id, host untouched", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=patch");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HOST_ON_CF, GUEST_FILES_ON] } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "PATCH", path: "/presets/p-guest", body: PRESET_BODIES["tma-class-guest"] },
  ]);
});

Deno.test("only the host missing → one POST", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=hostonly");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [GUEST_OK_ON_CF] } : { ok: true, status: 200, data: { id: "p-new" } }));
  await ensurePresets(cf);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets", "POST /presets"]);
  assertEquals((cf.calls[1].body as { name: string }).name, "tma-class-host");
});

Deno.test("all good → nothing but the list; and the second call is served from the cache", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=good");
  const cf = fakeCf(() => ({ ok: true, status: 200, data: { data: [HOST_ON_CF, GUEST_OK_ON_CF] } }));   /* the nested {data:[…]} shape */
  await ensurePresets(cf);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets"]);
  await ensurePresets(cf);
  assertEquals(cf.calls.length, 1);
});

Deno.test("a failed list or create never throws and is not cached — the next join tries again", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=fail");
  const cf = fakeCf((m) => (m === "GET" ? { ok: false, status: 500, data: {} } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf);
  assertEquals(cf.calls.length, 1);   /* no POST after a failed list */
  await ensurePresets(cf);
  assertEquals(cf.calls.length, 2);   /* tried the list again */
  const cf2 = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [] } : { ok: false, status: 403, data: {} }));
  await ensurePresets(cf2);
  await ensurePresets(cf2);
  assertEquals(cf2.calls.filter((c) => c.method === "GET").length, 2);   /* a failed create is not cached either */
  const boom = (async () => { throw new Error("network down"); }) as unknown as JoinDeps["cf"];
  await ensurePresets(boom);   /* resolves, does not reject */
});
```

Run it and watch it fail because the module does not exist yet:

```bash
cd /Users/nelsontaylor/taylormade-academy
deno test --allow-read=scripts/rtk-presets supabase/functions/_shared/rtk_presets_test.ts
```

Expected failure (first lines):

```
Check supabase/functions/_shared/rtk_presets_test.ts
TS2307 [ERROR]: Cannot find module 'file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk_presets.ts'.
    at file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/rtk_presets_test.ts:5:31

error: Type checking failed.
```

(Do not run `deno test supabase/functions/_shared/` on the whole directory — `email_test.ts` there needs `--allow-env` and fails with `NotCapable: Requires env access to "ACADEMY_FROM"`; that is pre-existing and not yours. Run the one file.)

- [ ] **Step 3: Write `_shared/rtk_presets.ts` — the bodies and `ensurePresets`**

The bodies are the JSON from Step 1 written as TS objects (shared `CONFIG`/`UI` sub-objects keep the two literals honest — the first test in Step 2 proves them deep-equal to the files). Create `supabase/functions/_shared/rtk_presets.ts`:

```ts
// The two Academy room presets, and the one call that makes sure Cloudflare has them.
// Nelson has no shell token on the road, so the join function's room branch calls
// ensurePresets() the first time he opens the room: list the app's presets, create either
// of the two that is missing, and re-send the guest body if its file-sharing switches are
// not off. Idempotent; cached per isolate once everything is right; never throws — a preset
// problem must not block a join (the participant POST will 4xx and the page says cloudflare_<status>).
//
// PRESET_BODIES are the committed JSON files, verbatim (rtk_presets_test.ts proves they match):
//   scripts/rtk-presets/tma-class-host.json   — a copy of opil-host.json, name changed
//   scripts/rtk-presets/tma-class-guest.json  — a copy of opil-student.json, name changed,
//                                               chat.public.files and chat.private.files false
import type { JoinDeps } from "../ea-rtk-join/handler.ts";

const UI = {
  design_tokens: {
    theme: "darkest",
    font_family: "Inter",
    border_radius: "rounded",
    border_width: "thin",
    colors: {
      brand: { "300": "#fee38a", "400": "#fdd45a", "500": "#fdc921", "600": "#d9a90f", "700": "#b28a0a" },
      background: { "600": "#22345f", "700": "#162650", "800": "#0f1d44", "900": "#0a1733", "1000": "#04123a" },
      text: "#ffffff",
      text_on_brand: "#04123a",
      video_bg: "#0a1733",
      danger: "#ff5c5c",
      success: "#3ddc97",
      warning: "#fdc921",
    },
    logo: "https://taylormadeacademy.com/assets/logo-nav.webp",
    spacing_base: 4,
  },
};

const CONFIG = {
  view_type: "GROUP_CALL",
  max_video_streams: { desktop: 9, mobile: 4 },
  max_screenshare_count: 1,
  media: {
    video: { frame_rate: 24, quality: "hd", simulcast: true },
    screenshare: { frame_rate: 5, quality: "hd" },
  },
};

export const PRESET_BODIES: Record<"tma-class-host" | "tma-class-guest", Record<string, unknown>> = {
  "tma-class-host": {
    name: "tma-class-host",
    config: CONFIG,
    permissions: {
      media: { audio: { can_produce: "ALLOWED" }, video: { can_produce: "ALLOWED" }, screenshare: { can_produce: "ALLOWED" } },
      stage_enabled: false,
      stage_access: "ALLOWED",
      accept_stage_requests: true,
      can_accept_production_requests: true,
      accept_waiting_requests: true,
      kick_participant: true,
      pin_participant: true,
      can_spotlight: true,
      disable_participant_audio: true,
      disable_participant_video: true,
      disable_participant_screensharing: true,
      can_change_participant_permissions: true,
      can_record: true,
      can_livestream: false,
      chat: {
        public: { can_send: true, text: true, files: true },
        private: { can_send: true, can_receive: true, text: true, files: true },
      },
      polls: { can_create: true, can_view: true, can_vote: true },
      plugins: { can_start: true, can_close: true, can_edit_config: true, config: {} },
      connected_meetings: { can_alter_connected_meetings: true, can_switch_connected_meetings: true, can_switch_to_parent_meeting: true },
      show_participant_list: true,
      can_edit_display_name: true,
      hidden_participant: false,
      waiting_room_type: "SKIP",
      recorder_type: "NONE",
      transcription_enabled: true,
    },
    ui: UI,
  },
  "tma-class-guest": {
    name: "tma-class-guest",
    config: CONFIG,
    permissions: {
      media: { audio: { can_produce: "ALLOWED" }, video: { can_produce: "ALLOWED" }, screenshare: { can_produce: "ALLOWED" } },
      stage_enabled: false,
      stage_access: "ALLOWED",
      accept_stage_requests: false,
      can_accept_production_requests: false,
      accept_waiting_requests: false,
      kick_participant: false,
      pin_participant: false,
      can_spotlight: false,
      disable_participant_audio: false,
      disable_participant_video: false,
      disable_participant_screensharing: false,
      can_change_participant_permissions: false,
      can_record: false,
      can_livestream: false,
      chat: {
        public: { can_send: true, text: true, files: false },
        private: { can_send: true, can_receive: true, text: true, files: false },
      },
      polls: { can_create: false, can_view: true, can_vote: true },
      plugins: { can_start: false, can_close: false, can_edit_config: false, config: {} },
      connected_meetings: { can_alter_connected_meetings: false, can_switch_connected_meetings: true, can_switch_to_parent_meeting: true },
      show_participant_list: true,
      can_edit_display_name: false,
      hidden_participant: false,
      waiting_room_type: "SKIP",
      recorder_type: "NONE",
      transcription_enabled: false,
    },
    ui: UI,
  },
};

const NAMES = ["tma-class-host", "tma-class-guest"] as const;

/* set once every preset is known to be right; a failed run leaves it false so the next join tries again */
let ensured = false;

/* Cloudflare answers GET /presets as [ {id,name,…} ] or { data: [ … ] } (rtkClient already peels
   one `data`); walk down `.data` until an array turns up, else treat it as an empty list. */
function presetList(data: unknown): Record<string, unknown>[] {
  let cur: unknown = data;
  for (let i = 0; i < 3 && cur && typeof cur === "object" && !Array.isArray(cur); i++) cur = (cur as Record<string, unknown>).data;
  return Array.isArray(cur) ? cur.filter((x) => x && typeof x === "object").map((x) => x as Record<string, unknown>) : [];
}

function guestFilesOff(preset: Record<string, unknown>): boolean {
  const perms = (preset.permissions || {}) as Record<string, unknown>;
  const chat = (perms.chat || {}) as Record<string, unknown>;
  const pub = (chat.public || {}) as Record<string, unknown>;
  const priv = (chat.private || {}) as Record<string, unknown>;
  return pub.files === false && priv.files === false;
}

export async function ensurePresets(cf: JoinDeps["cf"]): Promise<void> {
  if (ensured) return;
  try {
    const listed = await cf("GET", "/presets");
    /* 404 = the app has no presets yet (the same convention ea-rtk-record uses for /webhooks) */
    if (!listed.ok && listed.status !== 404) { console.warn("[rtk_presets] list failed", listed.status); return; }
    const have = listed.ok ? presetList(listed.data) : [];
    let allGood = true;
    for (const name of NAMES) {
      const found = have.find((p) => p.name === name);
      if (!found) {
        const r = await cf("POST", "/presets", PRESET_BODIES[name]);
        if (!r.ok) { console.warn("[rtk_presets] create failed", name, r.status); allGood = false; }
      } else if (name === "tma-class-guest" && !guestFilesOff(found)) {
        const r = await cf("PATCH", `/presets/${found.id}`, PRESET_BODIES[name]);
        if (!r.ok) { console.warn("[rtk_presets] update failed", name, r.status); allGood = false; }
      }
    }
    ensured = allGood;
  } catch (e) {
    console.warn("[rtk_presets]", String((e && (e as Error).message) || e));
  }
}
```

Run the test green:

```bash
cd /Users/nelsontaylor/taylormade-academy
deno test --allow-read=scripts/rtk-presets supabase/functions/_shared/rtk_presets_test.ts
```

Expected: seven `... ok` lines and the last line `ok | 7 passed | 0 failed`. The last test prints an `------- output -------` block containing exactly `[rtk_presets] list failed 500` (twice), `[rtk_presets] create failed tma-class-host 403` and `[rtk_presets] create failed tma-class-guest 403` (twice each) and `[rtk_presets] network down` — those are the warnings the "never throws" path is supposed to log, not failures.

- [ ] **Step 4: Commit the presets module**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/functions/_shared/rtk_presets.ts supabase/functions/_shared/rtk_presets_test.ts
git commit -m "$(cat <<'EOF'
feat(academy): _shared/rtk_presets — the two room preset bodies + ensurePresets(cf)

GET /presets, POST whichever of tma-class-host / tma-class-guest is missing, PATCH the
guest when its chat.*.files are not false. Cached per isolate on success, never throws:
a preset problem must not block a join. The TS bodies are proven equal to the JSON files.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Write the failing room-branch tests — replace the one Task 3 test that pins the placeholder, then append**

Task 3's `handler_test.ts` has exactly one test that asserts the placeholder's `404 not_found`; it must change with the placeholder, because after Step 6 a room body answers `503 rtk_not_configured` from Task 3's `deps()` (whose `getRoom` returns `null`). It is the only Task 3 test that changes; every other Task 3 test stays byte-for-byte. Locate it:

```bash
cd /Users/nelsontaylor/taylormade-academy
grep -n "answers 404 not_found" supabase/functions/ea-rtk-join/handler_test.ts
wc -l supabase/functions/ea-rtk-join/handler_test.ts
```

Expected: `174:Deno.test("body.room === true answers 404 not_found and never enters the OPIL path", async () => {` and `179 supabase/functions/ea-rtk-join/handler_test.ts` — the block is the last six lines of the file. Replace exactly this block (lines 174–179):

```ts
Deno.test("body.room === true answers 404 not_found and never enters the OPIL path", async () => {
  const d = deps();
  const r = await handleJoin({ room: true, key: "k".repeat(22) }, COORD, d);
  assertEquals(r.status, 404); assertEquals(err(r), "not_found");
  assertEquals(d.touched, []); assertEquals(d.calls.length, 0);
});
```

with exactly:

```ts
Deno.test("body.room === true never enters the OPIL path", async () => {
  const d = deps();   /* getRoom → null: the room branch stops at 503 before any OPIL dep is reached */
  const r = await handleJoin({ room: true, key: "k".repeat(22) }, COORD, d);
  assertEquals(r.status, 503); assertEquals(err(r), "rtk_not_configured");
  assertEquals(d.touched, ["rateCheck", "rateCheck", "getRoom"]); assertEquals(d.calls.length, 0);
});
```

Now append the block below at the very end of the file (the file already imports `assertEquals` from `https://deno.land/std@0.224.0/assert/mod.ts` and `handleJoin, type JoinDeps` from `./handler.ts`; the extra `import type { RoomRow }` line is a top-level import declaration and is legal after other statements). `NELSON` is deliberately NOT an OPIL coordinator (`role.admin: false`) — the room keys on `academyAdmin` alone.

```ts

/* ───────────── the room branch (body.room === true) — Academy room, Task 4 ───────────── */
import type { RoomRow } from "./handler.ts";

/* Nelson is ea_is_admin() on the Academy and NOT an OPIL coordinator: the room keys on academyAdmin alone */
const NELSON = { user: { id: "u-nelson", email: "nelson@x" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: true, ip: "9.9.9.9" };
const PERSON = { user: { id: "u-guest", email: "sam@example.com" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: false, ip: "5.5.5.5" };
const KEY = "AbCdEfGhIjKlMnOpQrStUv";          /* 22 chars of [A-Za-z0-9_-], what ea_room_new_key() mints */
const WRONG = "ZzZzZzZzZzZzZzZzZzZzZz";
const NOW = new Date("2026-09-14T20:00:00Z");   /* 15:00 in Chicago */
const LIVE_ROOM = { id: "room-1", title: "Taylormade Academy Live", link_key: KEY, is_live: true, live_since: "2026-09-14T19:30:00Z", meeting_id: "meet-live", max_participants: 50 };
const OFF_ROOM = { ...LIVE_ROOM, is_live: false, live_since: "2026-09-13T19:00:00Z", meeting_id: "meet-old" };
const STALE_ROOM = { ...LIVE_ROOM, live_since: "2026-09-14T15:00:00Z" };   /* 5 h ago: the tab died, the row still says live */

function roomDeps(over: Partial<JoinDeps> = {}, room: RoomRow = LIVE_ROOM) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const meetingSet: [string, string][] = [];
  const members: [string, string][] = [];
  const rates: string[] = [];
  let presets = 0;
  const d: JoinDeps & { calls: typeof calls; meetingSet: typeof meetingSet; members: typeof members; rates: typeof rates; presets: () => number } = {
    calls, meetingSet, members, rates, presets: () => presets,
    cf: async (method, path, body) => {
      calls.push({ method, path, body });
      if (method === "GET" && path.endsWith("/active-session")) return { ok: false, status: 404, data: {} };
      if (method === "POST" && path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      if (method === "POST" && path.endsWith("/participants")) return { ok: true, status: 200, data: { token: "tok-1" } };
      return { ok: true, status: 200, data: {} };
    },
    rateCheck: async (key) => { rates.push(key); return true; },
    getSession: async () => null,
    inCohort: async () => false,
    isMember: async () => false,
    getRoom: async () => room,
    setRoomMeeting: async (roomId, meetingId) => { meetingSet.push([roomId, meetingId]); },
    roomMeetingIds: async () => new Set<string>(),
    upsertMember: async (roomId, userId) => { members.push([roomId, userId]); },
    displayName: async (id) => (id === "u-nelson" ? "Nelson Taylor" : null),
    ensurePresets: async () => { presets++; },
    now: () => NOW,
    ...over,
  };
  return d;
}
const paths = (d: { calls: { method: string; path: string }[] }) => d.calls.map((c) => c.method + " " + c.path);

Deno.test("room: a person with the right key while live gets a guest token and never the meeting id", async () => {
  const d = roomDeps();
  const r = await handleJoin({ room: true, key: KEY }, PERSON, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-1", preset: "tma-class-guest", host: false, name: "sam" });
  assertEquals("meeting_id" in (r.body as Record<string, unknown>), false);
  assertEquals(paths(d), ["GET /meetings/meet-live/active-session", "POST /meetings/meet-live/participants"]);
  assertEquals(d.calls[1].body, { custom_participant_id: "u-guest", preset_name: "tma-class-guest", name: "sam" });
  assertEquals(d.members, [["room-1", "u-guest"]]);
  assertEquals(d.presets(), 0);
});

Deno.test("room: the wrong key → 404 bad_link; no key and not a member → 403 not_allowed; a malformed key counts as no key", async () => {
  const wrong = await handleJoin({ room: true, key: WRONG }, PERSON, roomDeps());
  assertEquals(wrong.status, 404); assertEquals(wrong.body, { error: "bad_link" });
  const none = await handleJoin({ room: true }, PERSON, roomDeps());
  assertEquals(none.status, 403); assertEquals(none.body, { error: "not_allowed" });
  const short = await handleJoin({ room: true, key: "short" }, PERSON, roomDeps());
  assertEquals(short.status, 403); assertEquals(short.body, { error: "not_allowed" });
  const d = roomDeps();
  await handleJoin({ room: true, key: WRONG }, PERSON, d);
  assertEquals(d.calls.length, 0);   /* refused before any Cloudflare call */
});

Deno.test("room: a member without a key is in; a member with a stale key is in too", async () => {
  const d = roomDeps({ isMember: async () => true });
  const r = await handleJoin({ room: true }, PERSON, d);
  assertEquals(r.status, 200); assertEquals((r.body as { preset: string }).preset, "tma-class-guest");
  const stale = await handleJoin({ room: true, key: WRONG }, PERSON, roomDeps({ isMember: async () => true }));
  assertEquals(stale.status, 200);
});

Deno.test("room: a person while off air → 409 not_open; when live_since is 5 h old → 409 not_open", async () => {
  const off = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps({}, OFF_ROOM));
  assertEquals(off.status, 409); assertEquals(off.body, { error: "not_open" });
  const stale = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps({}, STALE_ROOM));
  assertEquals(stale.status, 409); assertEquals(stale.body, { error: "not_open" });
  const noMeeting = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps({}, { ...LIVE_ROOM, meeting_id: null }));
  assertEquals(noMeeting.status, 409); assertEquals(noMeeting.body, { error: "not_open" });
});

Deno.test("room: Nelson off air → a fresh meeting, saved on the row, the previous one set INACTIVE, meeting_id returned", async () => {
  const d = roomDeps({}, OFF_ROOM);
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-1", meeting_id: "meet-new", preset: "tma-class-host", host: true, name: "Nelson Taylor" });
  assertEquals(paths(d), ["POST /meetings", "PATCH /meetings/meet-old", "POST /meetings/meet-new/participants"]);
  assertEquals(d.calls[0].body, { title: "Academy · Taylormade Academy Live · 2026-09-14", persist_chat: false });
  assertEquals(d.calls[1].body, { status: "INACTIVE" });
  assertEquals(d.meetingSet, [["room-1", "meet-new"]]);
  assertEquals(d.members, [["room-1", "u-nelson"]]);
  assertEquals(d.presets(), 1);
});

Deno.test("room: Nelson while live (reload, second device) reuses the meeting — no POST /meetings, no cap check", async () => {
  const d = roomDeps();
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-live");
  assertEquals(paths(d), ["POST /meetings/meet-live/participants"]);
  assertEquals(d.meetingSet, []);
  assertEquals(d.presets(), 1);
});

Deno.test("room: Nelson on a stale live row (5 h) starts a fresh meeting like off air; a failed INACTIVE is ignored", async () => {
  const d = roomDeps({
    cf: async (method, path, body) => {
      d.calls.push({ method, path, body });
      if (method === "PATCH") return { ok: false, status: 500, data: {} };
      if (method === "POST" && path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      return { ok: true, status: 200, data: { token: "tok-1" } };
    },
  }, STALE_ROOM);
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 200);
  assertEquals(paths(d), ["POST /meetings", "PATCH /meetings/meet-live", "POST /meetings/meet-new/participants"]);
  assertEquals(d.meetingSet, [["room-1", "meet-new"]]);
});

Deno.test("room: Cloudflare refusing the meeting → 502 cloudflare_<status>, nothing saved", async () => {
  const d = roomDeps({ cf: async (method, path, body) => { d.calls.push({ method, path, body }); return { ok: false, status: 429, data: {} }; } }, OFF_ROOM);
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 502); assertEquals(r.body, { error: "cloudflare_429" });
  assertEquals(d.meetingSet, []); assertEquals(d.members, []);
});

Deno.test("room: the cap — 50 in with max 50 → 429 room_full; 404 from active-session means nobody yet", async () => {
  const full = roomDeps({ cf: async (method, path, body) => { full.calls.push({ method, path, body }); return path.endsWith("/active-session") ? { ok: true, status: 200, data: { live_participants: 50 } } : { ok: true, status: 200, data: { token: "tok-1" } }; } });
  const r = await handleJoin({ room: true, key: KEY }, PERSON, full);
  assertEquals(r.status, 429); assertEquals(r.body, { error: "room_full" });
  assertEquals(paths(full), ["GET /meetings/meet-live/active-session"]);
  assertEquals(full.members, []);
  const room = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps());   /* default fake: 404 */
  assertEquals(room.status, 200);
  const under = roomDeps({ cf: async (method, path, body) => { under.calls.push({ method, path, body }); return path.endsWith("/active-session") ? { ok: true, status: 200, data: { live_participants: 49 } } : { ok: true, status: 200, data: { token: "tok-1" } }; } });
  assertEquals((await handleJoin({ room: true, key: KEY }, PERSON, under)).status, 200);
});

Deno.test("room: rate limit — false → 429 slow_down before any Cloudflare call; null (limiter down) → allowed", async () => {
  const d = roomDeps({ rateCheck: async (key) => { d.rates.push(key); return key.startsWith("rtk-join:u:") ? false : true; } });
  const r = await handleJoin({ room: true, key: KEY }, PERSON, d);
  assertEquals(r.status, 429); assertEquals(r.body, { error: "slow_down" });
  assertEquals(d.calls.length, 0);
  const ip = roomDeps({ rateCheck: async (key) => key.startsWith("rtk-join:ip:") ? false : true });
  assertEquals((await handleJoin({ room: true, key: KEY }, PERSON, ip)).status, 429);
  const down = roomDeps({ rateCheck: async () => null });
  assertEquals((await handleJoin({ room: true, key: KEY }, PERSON, down)).status, 200);
  const keys = roomDeps();
  await handleJoin({ room: true, key: KEY }, PERSON, keys);
  assertEquals(keys.rates, ["rtk-join:u:u-guest", "rtk-join:ip:5.5.5.5"]);
});

Deno.test("room: a client-supplied meeting_id in a room body is ignored", async () => {
  const d = roomDeps();
  const r = await handleJoin({ room: true, key: KEY, meeting_id: "meet-evil" }, PERSON, d);
  assertEquals(r.status, 200);
  assertEquals(paths(d), ["GET /meetings/meet-live/active-session", "POST /meetings/meet-live/participants"]);
  const h = roomDeps();
  await handleJoin({ room: true, meeting_id: "meet-evil" }, NELSON, h);
  assertEquals(paths(h), ["POST /meetings/meet-live/participants"]);
});

Deno.test("room: no room row → 503 rtk_not_configured; a long title is cut at 80 for Cloudflare", async () => {
  const none = await handleJoin({ room: true }, NELSON, roomDeps({ getRoom: async () => null }));
  assertEquals(none.status, 503); assertEquals(none.body, { error: "rtk_not_configured" });
  const d = roomDeps({}, { ...OFF_ROOM, title: "T".repeat(100) });
  await handleJoin({ room: true }, NELSON, d);
  assertEquals(String((d.calls[0].body as { title: string }).title).length, 80);
});
```

Run and watch the 13 tests that need the room branch fail against Task 3's placeholder (the replaced test plus the 12 `room:` tests), while the 14 untouched Task 3 tests still print `ok`:

```bash
cd /Users/nelsontaylor/taylormade-academy
deno test supabase/functions/ea-rtk-join/
```

Expected: the line `body.room === true never enters the OPIL path ... FAILED`, every `room: …` line ending `FAILED`, every other Task 3 line still ending `ok`, the first failure detail reading

```
body.room === true never enters the OPIL path => ./supabase/functions/ea-rtk-join/handler_test.ts:174:6
error: AssertionError: Values are not equal.


    [Diff] Actual / Expected


-   404
+   503
```

and the summary `FAILED | 14 passed | 13 failed`, then `error: Test failed`.

- [ ] **Step 6: Implement the room branch in `handler.ts`**

Locate the placeholder and the header comment that describes it:

```bash
cd /Users/nelsontaylor/taylormade-academy
grep -n 'if (body.room === true)' supabase/functions/ea-rtk-join/handler.ts
grep -n 'Until it is built' supabase/functions/ea-rtk-join/handler.ts
wc -l supabase/functions/ea-rtk-join/handler.ts
```

Expected: `45:  if (body.room === true) return { status: 404, body: { error: "not_found" } };`, `15:// Room branch (body.room === true): the Academy room. Until it is built, a room body answers`, and `90 supabase/functions/ea-rtk-join/handler.ts`. (A plain `grep -n "body.room"` prints three lines — two header comments and the code — which is why the two greps above are the anchors.)

Edit A — the header comment, lines 15–16. Replace exactly:

```ts
// Room branch (body.room === true): the Academy room. Until it is built, a room body answers
// 404 not_found — nothing on the OPIL path runs for it.
```

with exactly:

```ts
// Room branch (body.room === true): the Academy room — handleRoomJoin at the end of this file.
// Nothing on the OPIL path runs for a room body.
```

Edit B — the placeholder, line 45. Replace exactly:

```ts
  if (body.room === true) return { status: 404, body: { error: "not_found" } };
```

with exactly:

```ts
  if (body.room === true) return handleRoomJoin(body, ctx, deps);
```

Change nothing else inside `handleJoin` or `joinOpil`.

Edit C — append this block at the END of the file, after line 90 (the closing `}` of `joinOpil`). `JoinBody`, `Caller`, `JoinDeps`, `Reply` and `OPEN_WINDOW_MS` are the file's own exports, so nothing new is imported:

```ts

/* ───────────── the Academy room (body.room === true) ─────────────
   One room, one link. Nelson (ea_is_admin) is the host; a person gets in with the current link key
   or an Academy membership, only while Nelson is live (and for at most 4 h after he started, the
   recording cap — a tab that died leaves is_live true). Every Start class is a fresh Cloudflare
   meeting and the previous one is set INACTIVE, so a token from last time opens nothing. People are
   never told the meeting id; a client-supplied meeting_id is never read. */

const KEY_RX = /^[A-Za-z0-9_-]{22}$/;
/* YYYY-MM-DD in America/Chicago (en-CA prints ISO order) — the meeting title people see in the dashboard */
const CHICAGO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });

async function handleRoomJoin(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  const uid = ctx.user.id;
  /* 1 — rate limit, fail-open (null = the limiter is down → allowed), before any Cloudflare call */
  if ((await deps.rateCheck("rtk-join:u:" + uid, 30, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  if ((await deps.rateCheck("rtk-join:ip:" + ctx.ip, 90, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  /* 2 — the room */
  const room = await deps.getRoom();
  if (!room) return { status: 503, body: { error: "rtk_not_configured" } };
  /* 3 — who is this: Nelson, a member, or someone holding the current link */
  const isHost = ctx.academyAdmin;
  const key = typeof body.key === "string" && KEY_RX.test(body.key) ? body.key : null;
  if (!isHost) {
    const allowed = (await deps.isMember()) || (key !== null && key === room.link_key);
    if (!allowed) return key ? { status: 404, body: { error: "bad_link" } } : { status: 403, body: { error: "not_allowed" } };
  }
  /* 4 — is the room open: live, and started less than 4 h ago */
  const open = room.is_live && !!room.live_since && (deps.now().getTime() - Date.parse(room.live_since)) < OPEN_WINDOW_MS;
  if (!isHost && !open) return { status: 409, body: { error: "not_open" } };
  /* 5 — the meeting: Nelson starting (or re-starting a stale room) gets a fresh one; a live Nelson and people reuse it */
  let meetingId: string | null = room.meeting_id;
  if (isHost && (!open || !meetingId)) {
    const title = ("Academy · " + room.title + " · " + CHICAGO_DAY.format(deps.now())).slice(0, 80);
    const made = await deps.cf("POST", "/meetings", { title, persist_chat: false });
    if (!made.ok) return { status: 502, body: { error: "cloudflare_" + made.status } };
    const id = String(((made.data || {}) as Record<string, unknown>).id || "");
    if (!id) return { status: 502, body: { error: "cloudflare_no_id" } };
    await deps.setRoomMeeting(room.id, id);
    if (room.meeting_id) {
      /* best effort: the previous meeting closes so an old token opens nothing, not even an empty billable session */
      try { await deps.cf("PATCH", `/meetings/${room.meeting_id}`, { status: "INACTIVE" }); } catch (_) { /* ignored */ }
    }
    meetingId = id;
  }
  if (!meetingId) return { status: 409, body: { error: "not_open" } };
  /* 6 — Nelson makes sure the two presets exist on Cloudflare (cached; never throws) */
  if (isHost) await deps.ensurePresets();
  /* 7 — the cap, people only; Cloudflare counts Nelson too ("Max people (you included)"); 404 = no session yet */
  if (!isHost) {
    const r = await deps.cf("GET", `/meetings/${meetingId}/active-session`);
    const live = r.status === 404 ? 0 : Number(((r.data || {}) as Record<string, unknown>).live_participants ?? 0);
    if (live >= room.max_participants) return { status: 429, body: { error: "room_full" } };
  }
  /* 8 — one participant per person; custom_participant_id is the Supabase uid, never an email */
  const name = String((await deps.displayName(uid)) || (ctx.user.email || "Member").split("@")[0]).slice(0, 60);
  const preset = isHost ? "tma-class-host" : "tma-class-guest";
  const added = await deps.cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: uid, preset_name: preset, name });
  if (!added.ok) return { status: 502, body: { error: "cloudflare_" + added.status } };
  const token = ((added.data || {}) as Record<string, unknown>).token;
  /* 9 — who joined (the Your room card on /live/ reads it) */
  await deps.upsertMember(room.id, uid);
  /* 10 — only Nelson learns the meeting id */
  return { status: 200, body: isHost ? { token, meeting_id: meetingId, preset, host: true, name } : { token, preset, host: false, name } };
}
```

Do not "improve" the order of steps 1–10: rate → room → role → open → meeting → presets → cap → participant → member → reply is the spine's order, and the tests pin it (rate refuses before any `cf` call; a person's cap check happens after the key check; the previous meeting is PATCHed only after the new id is saved). `cloudflare_no_id` is the wording Task 3 ported from the pre-Task-3 `index.ts:97`, reused, not new.

Confirm the anchors moved as intended, then run green:

```bash
cd /Users/nelsontaylor/taylormade-academy
grep -n "body.room" supabase/functions/ea-rtk-join/handler.ts
deno test supabase/functions/ea-rtk-join/
```

Expected grep, exactly four lines: `4:// OPIL branch (body.room !== true) — …`, `15:// Room branch (body.room === true): the Academy room — handleRoomJoin at the end of this file.`, `45:  if (body.room === true) return handleRoomJoin(body, ctx, deps);`, `92:/* ───────────── the Academy room (body.room === true) ─────────────`. Expected test run: every line ends `ok` — the 14 untouched Task 3 OPIL tests, the replaced `body.room === true never enters the OPIL path`, and the 12 `room: …` tests — and the summary is `ok | 27 passed | 0 failed`.

- [ ] **Step 7: Wire `ensurePresets` into `index.ts` — four located edits, no overwrite**

Task 3's `index.ts` already builds every `JoinDeps` field; only the `ensurePresets` stub and one stale header line change. Do NOT paste a whole new file over it — Task 3's `roomMeetingIds` (`Promise.all`, logs `[ea-rtk-join] ea_rooms` / `ea_room_replays` errors, on the OPIL path) and `upsertMember` (one `.upsert(row, { onConflict: "room_id,user_id" })` that throws on error) must stay as Task 3 wrote them. Locate the four anchors:

```bash
cd /Users/nelsontaylor/taylormade-academy
grep -n 'answers 404 not_found until the room branch lands' supabase/functions/ea-rtk-join/index.ts
grep -n 'handleJoin, type JoinBody' supabase/functions/ea-rtk-join/index.ts
grep -n 'cf: rtkClient(acct, app, cfToken),' supabase/functions/ea-rtk-join/index.ts
grep -n 'ensurePresets' supabase/functions/ea-rtk-join/index.ts
```

Expected, one line each: `12`, `22`, `54`, `103` (`103:    ensurePresets: async () => {},`), with the comment `/* nothing to ensure until the room branch exists — no Cloudflare preset is touched today */` on line 102 directly above the last one and `  const reply = await handleJoin(body, { user: who.user, role: who.role, academyAdmin: who.academyAdmin, ip: clientIp(req) }, {` on line 53 directly above `cf: rtkClient(…)`.

Edit A — header comment, line 12. Replace exactly:

```ts
//   { room: true, key? }    the Academy room — answers 404 not_found until the room branch lands.
```

with exactly:

```ts
//   { room: true, key? }    the Academy room. Nelson (ea_is_admin) -> tma-class-host; a member or
//                           someone holding the current link -> tma-class-guest; the two presets
//                           are created on Cloudflare by ensurePresets the first time he joins.
```

Edit B — the import, line 22. Replace exactly:

```ts
import { handleJoin, type JoinBody } from "./handler.ts";
```

with exactly:

```ts
import { ensurePresets } from "../_shared/rtk_presets.ts";
import { handleJoin, type JoinBody } from "./handler.ts";
```

Edit C — hoist `cf` so both `handleJoin` and `ensurePresets` share one client, lines 53–54 as grepped (54–55 once Edit B has added its import line — match on the text). Replace exactly:

```ts
  const reply = await handleJoin(body, { user: who.user, role: who.role, academyAdmin: who.academyAdmin, ip: clientIp(req) }, {
    cf: rtkClient(acct, app, cfToken),
```

with exactly:

```ts
  const cf = rtkClient(acct, app, cfToken);
  const reply = await handleJoin(body, { user: who.user, role: who.role, academyAdmin: who.academyAdmin, ip: clientIp(req) }, {
    cf,
```

Edit D — the stub, lines 102–103 as grepped (103–104 once Edit B is in — match on the text). Replace exactly:

```ts
    /* nothing to ensure until the room branch exists — no Cloudflare preset is touched today */
    ensurePresets: async () => {},
```

with exactly:

```ts
    /* Nelson's first join creates tma-class-host / tma-class-guest on Cloudflare (cached; never throws) */
    ensurePresets: () => ensurePresets(cf),
```

Type-check it (this fetches `esm.sh` once; it is the same import every other function uses) and confirm the diff is only those edits:

```bash
cd /Users/nelsontaylor/taylormade-academy
deno check supabase/functions/ea-rtk-join/index.ts; echo "exit=$?"
git diff --stat supabase/functions/ea-rtk-join/index.ts
```

Expected: `Check supabase/functions/ea-rtk-join/index.ts` (Deno omits this line when its check cache is already warm — either way the next line is what matters), then `exit=0`, then `1 file changed, 8 insertions(+), 4 deletions(-)`.

- [ ] **Step 8: The OPIL guard — prove nothing OPIL moved**

```bash
cd /Users/nelsontaylor/taylormade-academy
node --test tests/opil/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"
deno test supabase/functions/ea-rtk-join/ supabase/functions/ea-rtk-record/ supabase/functions/ea-rtk-webhook/ 2>&1 | tail -1
```

Expected, exactly:

```
ℹ tests 18
ℹ pass 18
ℹ fail 0
ok | 55 passed | 0 failed
```

(55 = 27 join + 28 record and webhook; the 28 is today's total and this task does not touch those two functions.) `js/rtk-room.js` (`?classic=1`) and `js/rtk-room-v2.js` are not touched in this task; the OPIL page keeps sending `{ session_no, meeting_id }`, which Task 3's `joinOpil` answers exactly as before — this task changed one dispatch line in `handleJoin` and nothing in `joinOpil` or in `index.ts`'s OPIL deps, so the 14 untouched Task 3 OPIL tests passing green here IS the byte-identical proof.

- [ ] **Step 9: Commit the room branch**

```bash
cd /Users/nelsontaylor/taylormade-academy
git add supabase/functions/ea-rtk-join/handler.ts supabase/functions/ea-rtk-join/handler_test.ts supabase/functions/ea-rtk-join/index.ts
git commit -m "$(cat <<'EOF'
feat(academy): ea-rtk-join room branch — one link, a fresh meeting per Start, cap, rate limit, presets

{ room: true, key? }: rate limit (fail-open) → the one room → Nelson (ea_is_admin) or a member
or the current link key → open only while live and under 4 h → Nelson off air gets a fresh
Cloudflare meeting, saved with the service role, the previous one set INACTIVE → ensurePresets
→ people are refused at max_participants (active-session, 404 = nobody) → participant token
→ ea_room_members. People never receive the meeting id; a client meeting_id is never read.
joinOpil is untouched (its 14 tests are the proof); the one placeholder test now pins 503
rtk_not_configured with no room row. 12 room tests; index.ts wires ensurePresets(cf).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected `git status --short` afterwards: nothing from this task left unstaged.

- [ ] **Step 10: The deploy command (do NOT run it here — Task 10 runs it, after migration 0036 is applied)**

Recorded so Task 10 copies it verbatim. Deploying before 0036 is on prod would make every room join answer `503 rtk_not_configured` (no `ea_rooms` table to read) and the OPIL hardening's `roomMeetingIds` would log query errors on every OPIL join (it yields an empty set, so OPIL still works); `verify_jwt` stays OFF because the browser's own token is checked by `resolveCaller`:

```bash
cd /Users/nelsontaylor/taylormade-academy
supabase functions deploy ea-rtk-join --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
```

After Task 10 deploys it, the first host join (Nelson opening `/room/` once from a scratch page) is what creates `tma-class-host` and `tma-class-guest` on Cloudflare app `0f38f396-7ab8-41ed-bc08-8cf48fa695c7` — Task 10's step 2 then confirms both on the dashboard, including the guest preset's `files: false`. Anyone with `CF_ACCOUNT_ID`/`CF_RTK_APP_ID`/`CF_RTK_API_TOKEN` in their shell can still run `bash scripts/rtk-presets.sh` instead; it now manages the five JSON bodies in `scripts/rtk-presets/`.

---

### Task 5: ea-rtk-record — the room branch and retry by replay id

**Files:**
- Modify: `supabase/functions/ea-rtk-record/handler.ts:1–26` (header + types) and `:57–103` (the OPIL body → OPIL branch + room branch + one shared start/stop helper)
- Modify: `supabase/functions/ea-rtk-record/handler_test.ts:5–26` (fixtures + `deps()` helper), then append 7 tests after today's line 135
- Modify: `supabase/functions/ea-rtk-record/index.ts:1–6` (header), `:42` (caller ctx), `:68–73` (add the room stores after `reprocess`)
- Test: `supabase/functions/ea-rtk-record/handler_test.ts` — today 14 tests; after this task **21**

**Interfaces:**
- Consumes: `resolveCaller(req, admin, url, anonKey): Promise<Resolved | ResolveFail>` with `Resolved.academyAdmin: boolean` (Task 3, `supabase/functions/_shared/rtk_auth.ts`); `rtkClient(acct, app, token)` (unchanged; `rtk_auth.ts:43` once Task 3's `academyAdmin` + `clientIp` block is in — `:31` today); `handleEvent(payload, deps)` (`ea-rtk-webhook/handler.ts:40`); `replayDeps(admin, { dedupe: false })` (`_shared/replay_deps.ts:7`); tables from migration 0036 (Task 2): `public.ea_rooms (id, meeting_id, created_at)`, `public.ea_room_replays (id, room_id, meeting_id, recording_id, status, created_at, updated_at)`.
- Produces: `RecordBody = { room?: boolean; replay_id?: string; session_no?: number; action?: "start" | "stop" | "retry_replay" | "register_webhook" | "list_webhooks" }`; `Caller = { user; role: Role; academyAdmin: boolean; functionsBase: string }`; `ReplayStore`; `RecordDeps` (today's fields + `getRoom`, `roomMeetingIds`, `room: ReplayStore & { replayById }`); `handleRecord(body, ctx, deps): Promise<Reply>`. HTTP contract Task 8 (`/room/`) and Task 9 (`/live/` admin card) call: `POST ea-rtk-record` with `{ room: true, action: "start" | "stop" }` → `{ recording_id, status, reused }` / `{ stopped, recording_id? }`; `{ room: true, action: "retry_replay", replay_id }` → `{ recording_id, status }`. Error codes: `not_host` (403), `bad_replay` (400), `no_replay` (404), `nothing_to_retry` (409), `no_upload` (409), `not_found` (404), `no_room` (409), `not_allowed` (403, OPIL session pointed at the room meeting), `cloudflare_<status>` (502).

**What stays byte-identical:** every OPIL response. The 14 tests already in `handler_test.ts` are the proof — they are not edited except for the fixtures gaining `academyAdmin: false` and the `deps()` helper gaining harmless room defaults (`getRoom → null`, `roomMeetingIds → new Set()`, an empty room store). The only new work on the OPIL path is one extra read (`roomMeetingIds()`) that answers an empty set unless a session has been pointed at Nelson's room.

**Order matters:** Task 3 must already be on the branch (it adds `academyAdmin` to `Resolved`). Task 2's tables must exist on prod before this function is deployed (rollout, Task 10 — nothing here deploys or pushes). Until Task 6 lands, a room `retry_replay` reprocesses through today's OPIL-only `replayDeps`: the webhook handler answers `ignored: "unknown_meeting"` for a room meeting, so the function returns `200 { recording_id, status: "unknown" }` and writes nothing — harmless; Task 6 routes it to `ea_room_replays`.

- [ ] **Step 1: Widen the types and the test fixtures — no behaviour change, 14 tests stay green**

Replace `supabase/functions/ea-rtk-record/handler.ts` lines 1–26. Old block (today):

```ts
     1	// ea-rtk-record — the pure decisions behind "the class records itself".
     2	//   start  (host)  : begin a RealtimeKit recording of the session's meeting; idempotent
     3	//   stop   (host)  : stop the active recording (the webhook reports what happens next)
     4	//   register_webhook / list_webhooks (admin) : one-time wiring of ea-rtk-webhook
     5	// No network, no env, no supabase here: index.ts injects `deps`, handler_test.ts stubs them.
     6	
     7	export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
     8	export type Caller = { user: { id: string; email?: string | null }; role: Role; functionsBase: string };
     9	export type RecordBody = { session_no?: number; action?: "start" | "stop" | "retry_replay" | "register_webhook" | "list_webhooks" };
    10	export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
    11	export type ActiveReplay = { recording_id: string; status: string };
    12	export type CfResult = { ok: boolean; status: number; data: unknown };
    13	export type RecordDeps = {
    14	  getSession: (no: number) => Promise<SessionRow | null>;
    15	  latestActive: (meetingId: string) => Promise<ActiveReplay | null>;
    16	  insertReplay: (row: { session_no: number; meeting_id: string; recording_id: string; status: string }) => Promise<void>;
    17	  cf: (method: "GET" | "POST" | "PUT", path: string, body?: unknown) => Promise<CfResult>;
    18	  /* a row we believed active turned out not to be (Cloudflare says so): record the truth */
    19	  updateReplayStatus: (recordingId: string, status: string) => Promise<void>;
    20	  /* Retry: the latest replay for a meeting (any status), the stored UPLOADED event for it, and
    21	     the same processing the webhook does — dedupe bypassed on purpose. */
    22	  latestAny: (meetingId: string) => Promise<{ recording_id: string; status: string } | null>;
    23	  uploadedEvent: (recordingId: string) => Promise<Record<string, unknown> | null>;
    24	  reprocess: (payload: Record<string, unknown>) => Promise<{ status: string }>;
    25	};
    26	export type Reply = { status: number; body: unknown };
```

New block:

```ts
// ea-rtk-record — the pure decisions behind "the class records itself".
//   start  (host)  : begin a RealtimeKit recording of the meeting; idempotent
//   stop   (host)  : stop the active recording (the webhook reports what happens next)
//   retry_replay   : re-run a failed replay's stored UPLOADED event
//   register_webhook / list_webhooks (admin) : one-time wiring of ea-rtk-webhook
// Two branches share the start/stop rules: { session_no } is an OPIL class (ea_opil_replays,
// host = coordinator or that session's facilitator); { room: true } is Nelson's Academy room
// (ea_room_replays, host = the Academy admin, retry by replay_id).
// No network, no env, no supabase here: index.ts injects `deps`, handler_test.ts stubs them.

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type Caller = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; functionsBase: string };
export type RecordBody = { room?: boolean; replay_id?: string; session_no?: number; action?: "start" | "stop" | "retry_replay" | "register_webhook" | "list_webhooks" };
export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
export type ActiveReplay = { recording_id: string; status: string };
export type CfResult = { ok: boolean; status: number; data: unknown };
/* One store per replay table. The OPIL store is the top level of RecordDeps (ea_opil_replays,
   today's names); the room store is deps.room (ea_room_replays). Same calls, different table. */
export type ReplayStore = {
  latestActive: (meetingId: string) => Promise<ActiveReplay | null>;
  latestAny: (meetingId: string) => Promise<{ recording_id: string; status: string } | null>;
  insertReplay: (row: { session_no?: number; room_id?: string; meeting_id: string; recording_id: string; status: string }) => Promise<void>;
  /* a row we believed active turned out not to be (Cloudflare says so): record the truth */
  updateReplayStatus: (recordingId: string, status: string) => Promise<void>;
};
export type RecordDeps = ReplayStore & {
  getSession: (no: number) => Promise<SessionRow | null>;
  cf: (method: "GET" | "POST" | "PUT", path: string, body?: unknown) => Promise<CfResult>;
  /* Retry: the stored UPLOADED event for a recording, and the same processing the webhook
     does — dedupe bypassed on purpose. */
  uploadedEvent: (recordingId: string) => Promise<Record<string, unknown> | null>;
  reprocess: (payload: Record<string, unknown>) => Promise<{ status: string }>;
  /* the Academy room — one row, read with the service role */
  getRoom: () => Promise<{ id: string; meeting_id: string | null } | null>;
  /* every meeting that is or was the room's: ea_rooms.meeting_id ∪ ea_room_replays.meeting_id */
  roomMeetingIds: () => Promise<Set<string>>;
  room: ReplayStore & { replayById: (id: string) => Promise<{ id: string; room_id: string | null; meeting_id: string; recording_id: string; status: string } | null> };
};
export type Reply = { status: number; body: unknown };
```

(The file is now 13 lines longer: today's line 57 `const no = Number(body.session_no);` sits at line 70. Nothing below the types changes in this step.)

Replace `supabase/functions/ea-rtk-record/handler_test.ts` lines 5–26. Old block (today):

```ts
     5	const HOST = { user: { id: "u-host", email: "host@x" }, role: { admin: false, judge: false, facilitator_sessions: [7] }, functionsBase: "https://p.supabase.co/functions/v1" };
     6	const ADMIN = { ...HOST, role: { admin: true, judge: false, facilitator_sessions: [] } };
     7	const STUDENT = { ...HOST, role: { admin: false, judge: false, facilitator_sessions: [] } };
     8	
     9	function deps(over: Partial<RecordDeps> = {}) {
    10	  const calls: { method: string; path: string; body?: unknown }[] = [];
    11	  const inserted: unknown[] = [];
    12	  const updated: [string, string][] = [];
    13	  const d: RecordDeps & { calls: typeof calls; inserted: typeof inserted; updated: typeof updated } = {
    14	    calls, inserted, updated,
    15	    getSession: async (no) => (no === 7 ? { no: 7, title: "Agents 101", stream_url: "rtk:meet-7", is_live: true } : no === 8 ? { no: 8, title: "No room", stream_url: null, is_live: false } : null),
    16	    latestActive: async () => null,
    17	    insertReplay: async (row) => { inserted.push(row); },
    18	    cf: async (method, path, body) => { calls.push({ method, path, body }); return { ok: true, status: 200, data: { id: "rec-1", status: "INVOKED" } }; },
    19	    updateReplayStatus: async (id, status) => { updated.push([id, status]); },
    20	    latestAny: async () => null,
    21	    uploadedEvent: async () => null,
    22	    reprocess: async () => ({ status: "ready" }),
    23	    ...over,
    24	  };
    25	  return d;
    26	}
```

New block:

```ts
const HOST = { user: { id: "u-host", email: "host@x" }, role: { admin: false, judge: false, facilitator_sessions: [7] }, academyAdmin: false, functionsBase: "https://p.supabase.co/functions/v1" };
const ADMIN = { ...HOST, role: { admin: true, judge: false, facilitator_sessions: [] } };
const STUDENT = { ...HOST, role: { admin: false, judge: false, facilitator_sessions: [] } };
/* Nelson: the Academy admin (ea_is_admin). No OPIL role at all — the room branch keys on academyAdmin alone. */
const NELSON = { user: { id: "u-nelson", email: "nelson@x" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: true, functionsBase: "https://p.supabase.co/functions/v1" };
const ROOM = { id: "room-1", meeting_id: "meet-room" };
const REPLAY_ID = "6b1f4a2e-9c3d-4e5f-8a7b-1c2d3e4f5a6b";

type Over = Partial<Omit<RecordDeps, "room">> & { room?: Partial<RecordDeps["room"]> };

function deps(over: Over = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const inserted: unknown[] = [];
  const updated: [string, string][] = [];
  const roomInserted: unknown[] = [];
  const roomUpdated: [string, string][] = [];
  const d: RecordDeps & { calls: typeof calls; inserted: typeof inserted; updated: typeof updated; roomInserted: typeof roomInserted; roomUpdated: typeof roomUpdated } = {
    calls, inserted, updated, roomInserted, roomUpdated,
    getSession: async (no) => (no === 7 ? { no: 7, title: "Agents 101", stream_url: "rtk:meet-7", is_live: true } : no === 8 ? { no: 8, title: "No room", stream_url: null, is_live: false } : no === 9 ? { no: 9, title: "Points at the room", stream_url: "rtk:meet-room", is_live: true } : null),
    latestActive: async () => null,
    insertReplay: async (row) => { inserted.push(row); },
    cf: async (method, path, body) => { calls.push({ method, path, body }); return { ok: true, status: 200, data: { id: "rec-1", status: "INVOKED" } }; },
    updateReplayStatus: async (id, status) => { updated.push([id, status]); },
    latestAny: async () => null,
    uploadedEvent: async () => null,
    reprocess: async () => ({ status: "ready" }),
    getRoom: async () => null,
    roomMeetingIds: async () => new Set<string>(),
    ...over,
    room: {
      latestActive: async () => null,
      latestAny: async () => null,
      insertReplay: async (row) => { roomInserted.push(row); },
      updateReplayStatus: async (id, status) => { roomUpdated.push([id, status]); },
      replayById: async () => null,
      ...(over.room || {}),
    },
  };
  return d;
}
```

Run:

```bash
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-record/
```

Expected (the same 14 names as today, every one `ok`), last line:

```
ok | 14 passed | 0 failed (9ms)
```

Commit:

```bash
cd /Users/nelsontaylor/taylormade-academy && git add supabase/functions/ea-rtk-record/handler.ts supabase/functions/ea-rtk-record/handler_test.ts && git commit -m "test(academy): ea-rtk-record — room-aware deps and callers in the harness (types only, 14 OPIL tests unchanged)" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the 7 failing tests**

Append to the end of `supabase/functions/ea-rtk-record/handler_test.ts` (after the last `});`, today's line 135):

```ts

/* ── The Academy room ── */

Deno.test("room: start as the Academy admin records the room meeting and files a draft with room_id, never session_no", async () => {
  const d = deps({ getRoom: async () => ROOM });
  const r = await handleRecord({ room: true, action: "start" }, NELSON, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { recording_id: "rec-1", status: "invoked", reused: false });
  assertEquals(d.calls, [{ method: "POST", path: "/recordings", body: { meeting_id: "meet-room", max_seconds: 14400 } }]);
  assertEquals(d.roomInserted, [{ room_id: "room-1", meeting_id: "meet-room", recording_id: "rec-1", status: "invoked" }]);
  assertEquals("session_no" in (d.roomInserted[0] as object), false);   /* ea_room_replays has no such column */
  assertEquals(d.inserted.length, 0);   /* nothing lands in ea_opil_replays */
});

Deno.test("room: an OPIL coordinator who is not the Academy admin gets 403 not_host and no Cloudflare call", async () => {
  const d = deps({ getRoom: async () => ROOM });
  for (const action of ["start", "stop", "retry_replay"] as const) {
    const r = await handleRecord({ room: true, action, replay_id: REPLAY_ID }, ADMIN, d);
    assertEquals(r.status, 403); assertEquals((r.body as { error: string }).error, "not_host");
  }
  assertEquals((await handleRecord({ room: true, action: "start" }, STUDENT, d)).status, 403);
  assertEquals(d.calls.length, 0); assertEquals(d.roomInserted.length, 0);
});

Deno.test("room: no meeting yet → 409 no_room; no room row → 404 not_found; nothing is posted to Cloudflare", async () => {
  const noMeeting = deps({ getRoom: async () => ({ id: "room-1", meeting_id: null }) });
  const r = await handleRecord({ room: true, action: "start" }, NELSON, noMeeting);
  assertEquals(r.status, 409); assertEquals((r.body as { error: string }).error, "no_room");
  const noRow = deps();
  const r2 = await handleRecord({ room: true, action: "stop" }, NELSON, noRow);
  assertEquals(r2.status, 404); assertEquals((r2.body as { error: string }).error, "not_found");
  assertEquals(noMeeting.calls.length, 0); assertEquals(noRow.calls.length, 0);
});

Deno.test("room: stop sends the stop action for the room's active recording", async () => {
  const d = deps({ getRoom: async () => ROOM, room: { latestActive: async (m) => (m === "meet-room" ? { recording_id: "rec-r9", status: "recording" } : null) } });
  const r = await handleRecord({ room: true, action: "stop" }, NELSON, d);
  assertEquals(r.status, 200); assertEquals(r.body, { stopped: true, recording_id: "rec-r9" });
  assertEquals(d.calls, [{ method: "PUT", path: "/recordings/rec-r9", body: { action: "stop" } }]);
});

Deno.test("room: retry_replay by replay_id re-runs that replay's stored UPLOADED event, even after a newer Start class moved the room's meeting on", async () => {
  const seen: unknown[] = [];
  const d = deps({
    getRoom: async () => ({ id: "room-1", meeting_id: "meet-newer" }),
    uploadedEvent: async (id) => (id === "rec-old" ? { event: "recording.statusUpdate", recording: { id: "rec-old" } } : null),
    reprocess: async (p) => { seen.push(p); return { status: "ready" }; },
    room: {
      replayById: async (id) => (id === REPLAY_ID ? { id: REPLAY_ID, room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-old", status: "error" } : null),
      latestAny: async () => { throw new Error("a room retry never looks up the latest replay"); },
    },
  });
  const r = await handleRecord({ room: true, action: "retry_replay", replay_id: REPLAY_ID }, NELSON, d);
  assertEquals(r.status, 200); assertEquals(r.body, { recording_id: "rec-old", status: "ready" });
  assertEquals(seen, [{ event: "recording.statusUpdate", recording: { id: "rec-old" } }]);
  assertEquals(d.calls.length, 0);
});

Deno.test("room: retry_replay → 400 bad_replay without an id, 404 no_replay for an unknown id, 409 nothing_to_retry when ready, 409 no_upload when it never uploaded", async () => {
  const bad = await handleRecord({ room: true, action: "retry_replay" }, NELSON, deps());
  assertEquals(bad.status, 400); assertEquals((bad.body as { error: string }).error, "bad_replay");
  const junk = await handleRecord({ room: true, action: "retry_replay", replay_id: "not-a-uuid" }, NELSON, deps());
  assertEquals(junk.status, 400); assertEquals((junk.body as { error: string }).error, "bad_replay");
  const unknown = await handleRecord({ room: true, action: "retry_replay", replay_id: REPLAY_ID }, NELSON, deps());
  assertEquals(unknown.status, 404); assertEquals((unknown.body as { error: string }).error, "no_replay");
  const ready = await handleRecord({ room: true, action: "retry_replay", replay_id: REPLAY_ID }, NELSON,
    deps({ room: { replayById: async () => ({ id: REPLAY_ID, room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-old", status: "ready" }) } }));
  assertEquals(ready.status, 409); assertEquals((ready.body as { error: string }).error, "nothing_to_retry");
  const noUp = await handleRecord({ room: true, action: "retry_replay", replay_id: REPLAY_ID }, NELSON,
    deps({ room: { replayById: async () => ({ id: REPLAY_ID, room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-old", status: "error" }) } }));
  assertEquals(noUp.status, 409); assertEquals((noUp.body as { error: string }).error, "no_upload");
});

Deno.test("OPIL: a session whose meeting is the Academy room's is refused with 403 not_allowed before any Cloudflare call", async () => {
  const d = deps({ roomMeetingIds: async () => new Set(["meet-room"]), latestAny: async () => ({ recording_id: "rec-x", status: "error" }) });
  for (const action of ["start", "stop", "retry_replay"] as const) {
    const r = await handleRecord({ session_no: 9, action }, ADMIN, d);
    assertEquals(r.status, 403); assertEquals((r.body as { error: string }).error, "not_allowed");
  }
  assertEquals(d.calls.length, 0); assertEquals(d.inserted.length, 0);
  /* session 7's meeting is not the room's: untouched */
  assertEquals((await handleRecord({ session_no: 7, action: "start" }, ADMIN, d)).status, 200);
});
```

Run:

```bash
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-record/
```

Expected: the 14 old tests `ok`, the 7 new ones fail. Today's handler treats `{ room: true }` as an OPIL body with no `session_no` (→ `400 bad_session`) and has no room-meeting refusal, so the diffs read:

```
room: start as the Academy admin records the room meeting … => ./supabase/functions/ea-rtk-record/handler_test.ts:157:6
error: AssertionError: Values are not equal.
    [Diff] Actual / Expected
-   400
+   200
…
room: retry_replay → 400 bad_replay without an id, … 
-   bad_session
+   bad_replay
…
OPIL: a session whose meeting is the Academy room's is refused …
-   200
+   403

FAILED | 14 passed | 7 failed (5ms)

error: Test failed
```

Do not commit a red suite; go straight to Step 3.

- [ ] **Step 3: Implement the room branch, the OPIL refusal, and one shared start/stop helper**

First, in `supabase/functions/ea-rtk-record/handler.ts`, add one constant. Old (today's line 32, line 45 after Step 1):

```ts
const WEBHOOK_EVENTS = ["recording.statusUpdate", "meeting.ended"];
```

New:

```ts
const WEBHOOK_EVENTS = ["recording.statusUpdate", "meeting.ended"];
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;   /* ea_room_replays.id */
```

Then replace everything from `  const no = Number(body.session_no);` (today's line 57; line 71 after the constant above) to the end of the file. Old block (today's lines 57–103):

```ts
    57	  const no = Number(body.session_no);
    58	  if (!Number.isInteger(no)) return { status: 400, body: { error: "bad_session" } };
    59	  const isHost = ctx.role.admin || ctx.role.facilitator_sessions.includes(no);
    60	  if (!isHost) return { status: 403, body: { error: "not_host" } };
    61	  const s = await deps.getSession(no);
    62	  if (!s) return { status: 404, body: { error: "not_found" } };
    63	  const meetingId = typeof s.stream_url === "string" && s.stream_url.startsWith(RTK_PREFIX) ? s.stream_url.slice(RTK_PREFIX.length) : null;
    64	  if (!meetingId) return { status: 409, body: { error: "no_room" } };
    65	
    66	  if (action === "retry_replay") {
    67	    const last = await deps.latestAny(meetingId);
    68	    if (!last) return { status: 404, body: { error: "no_replay" } };
    69	    /* only a FAILED replay is retried: a second run on a ready one would mint another Stream copy */
    70	    if (last.status !== "error") return { status: 409, body: { error: "nothing_to_retry" } };
    71	    const payload = await deps.uploadedEvent(last.recording_id);
    72	    if (!payload) return { status: 409, body: { error: "no_upload" } };   /* it errored before ever uploading */
    73	    const out = await deps.reprocess(payload);
    74	    return { status: 200, body: { recording_id: last.recording_id, status: out.status } };
    75	  }
    76	
    77	  let active = await deps.latestActive(meetingId);
    78	  if (action === "start") {
    79	    if (active) {
    80	      /* Trust but verify: a lost webhook would leave this row "recording" forever and block every
    81	         later class of this session. Ask Cloudflare; if it is over, record that and start fresh. */
    82	      const chk = await deps.cf("GET", `/recordings/${active.recording_id}`);
    83	      const raw = String(((chk.data || {}) as Record<string, unknown>).status || "");
    84	      if (chk.ok && raw && raw !== "INVOKED" && raw !== "RECORDING") {
    85	        await deps.updateReplayStatus(active.recording_id, CF_STATUS[raw] || "error");
    86	        active = null;
    87	      } else {
    88	        return { status: 200, body: { recording_id: active.recording_id, status: active.status, reused: true } };
    89	      }
    90	    }
    91	    const r = await deps.cf("POST", "/recordings", { meeting_id: meetingId, max_seconds: MAX_SECONDS });
    92	    const d = (r.data || {}) as Record<string, unknown>;
    93	    const recordingId = typeof d.id === "string" ? d.id : "";
    94	    if (!r.ok || !recordingId) return { status: 502, body: { error: "cloudflare_" + r.status } };
    95	    await deps.insertReplay({ session_no: no, meeting_id: meetingId, recording_id: recordingId, status: "invoked" });
    96	    return { status: 200, body: { recording_id: recordingId, status: "invoked", reused: false } };
    97	  }
    98	  // stop
    99	  if (!active) return { status: 200, body: { stopped: false } };
    100	  const r = await deps.cf("PUT", `/recordings/${active.recording_id}`, { action: "stop" });
    101	  if (!r.ok) return { status: 502, body: { error: "cloudflare_" + r.status } };
    102	  return { status: 200, body: { stopped: true, recording_id: active.recording_id } };
    103	}
```

New block (the line `if (body.room === true) …` goes where line 57 was, directly under the webhook block's closing `}` and its blank line):

```ts
  if (body.room === true) return handleRoom(action, body, ctx, deps);

  // ── OPIL branch: exactly the rules the cohort has today ──
  const no = Number(body.session_no);
  if (!Number.isInteger(no)) return { status: 400, body: { error: "bad_session" } };
  const isHost = ctx.role.admin || ctx.role.facilitator_sessions.includes(no);
  if (!isHost) return { status: 403, body: { error: "not_host" } };
  const s = await deps.getSession(no);
  if (!s) return { status: 404, body: { error: "not_found" } };
  const meetingId = typeof s.stream_url === "string" && s.stream_url.startsWith(RTK_PREFIX) ? s.stream_url.slice(RTK_PREFIX.length) : null;
  if (!meetingId) return { status: 409, body: { error: "no_room" } };
  /* A session whose stream_url points at Nelson's Academy room meeting records nothing:
     no OPIL role can record or file a replay of the room (room spec §6.2, §9.11). */
  if ((await deps.roomMeetingIds()).has(meetingId)) return { status: 403, body: { error: "not_allowed" } };

  if (action === "retry_replay") {
    const last = await deps.latestAny(meetingId);
    if (!last) return { status: 404, body: { error: "no_replay" } };
    /* only a FAILED replay is retried: a second run on a ready one would mint another Stream copy */
    if (last.status !== "error") return { status: 409, body: { error: "nothing_to_retry" } };
    const payload = await deps.uploadedEvent(last.recording_id);
    if (!payload) return { status: 409, body: { error: "no_upload" } };   /* it errored before ever uploading */
    const out = await deps.reprocess(payload);
    return { status: 200, body: { recording_id: last.recording_id, status: out.status } };
  }
  return startOrStop(action, meetingId, { session_no: no }, deps, deps.cf);
}

/* ── Room branch: Nelson's Academy room. Only the Academy admin is its host. ── */
async function handleRoom(action: "start" | "stop" | "retry_replay", body: RecordBody, ctx: Caller, deps: RecordDeps): Promise<Reply> {
  if (!ctx.academyAdmin) return { status: 403, body: { error: "not_host" } };

  if (action === "retry_replay") {
    /* Every Start class is a NEW meeting, so "latest replay of the current meeting" is the wrong
       row the morning after. The page names the replay it wants retried. */
    const replayId = typeof body.replay_id === "string" ? body.replay_id.trim() : "";
    if (!UUID_RX.test(replayId)) return { status: 400, body: { error: "bad_replay" } };
    const row = await deps.room.replayById(replayId);
    if (!row) return { status: 404, body: { error: "no_replay" } };
    if (row.status !== "error") return { status: 409, body: { error: "nothing_to_retry" } };
    const payload = await deps.uploadedEvent(row.recording_id);
    if (!payload) return { status: 409, body: { error: "no_upload" } };
    const out = await deps.reprocess(payload);
    return { status: 200, body: { recording_id: row.recording_id, status: out.status } };
  }

  const room = await deps.getRoom();
  if (!room) return { status: 404, body: { error: "not_found" } };
  if (!room.meeting_id) return { status: 409, body: { error: "no_room" } };   /* Start class has not run yet */
  return startOrStop(action, room.meeting_id, { room_id: room.id }, deps.room, deps.cf);
}

/* ── start / stop, the same for both tables. `ref` is the column that files the row:
   { session_no } for OPIL, { room_id } for the room. ── */
async function startOrStop(action: "start" | "stop", meetingId: string, ref: { session_no?: number; room_id?: string }, store: ReplayStore, cf: RecordDeps["cf"]): Promise<Reply> {
  let active = await store.latestActive(meetingId);
  if (action === "start") {
    if (active) {
      /* Trust but verify: a lost webhook would leave this row "recording" forever and block every
         later class of this session. Ask Cloudflare; if it is over, record that and start fresh. */
      const chk = await cf("GET", `/recordings/${active.recording_id}`);
      const raw = String(((chk.data || {}) as Record<string, unknown>).status || "");
      if (chk.ok && raw && raw !== "INVOKED" && raw !== "RECORDING") {
        await store.updateReplayStatus(active.recording_id, CF_STATUS[raw] || "error");
        active = null;
      } else {
        return { status: 200, body: { recording_id: active.recording_id, status: active.status, reused: true } };
      }
    }
    const r = await cf("POST", "/recordings", { meeting_id: meetingId, max_seconds: MAX_SECONDS });
    const d = (r.data || {}) as Record<string, unknown>;
    const recordingId = typeof d.id === "string" ? d.id : "";
    if (!r.ok || !recordingId) return { status: 502, body: { error: "cloudflare_" + r.status } };
    await store.insertReplay({ ...ref, meeting_id: meetingId, recording_id: recordingId, status: "invoked" });
    return { status: 200, body: { recording_id: recordingId, status: "invoked", reused: false } };
  }
  // stop
  if (!active) return { status: 200, body: { stopped: false } };
  const r = await cf("PUT", `/recordings/${active.recording_id}`, { action: "stop" });
  if (!r.ok) return { status: 502, body: { error: "cloudflare_" + r.status } };
  return { status: 200, body: { stopped: true, recording_id: active.recording_id } };
}
```

Why it is still byte-identical for OPIL: `startOrStop` is lines 77–102 with `deps.` → `store.`/`cf(` and the inserted row spelled `{ ...ref, … }` — with `ref = { session_no: no }` that is exactly `{ session_no, meeting_id, recording_id, status }` as before, and `latestActive` is still read before the `start`/`stop` split. The order of checks (`bad_action` → webhooks → `bad_session` → `not_host` → `not_found` → `no_room` → retry → start/stop) is unchanged; `not_allowed` is the only new stop, and only when a session's meeting is the room's.

Run:

```bash
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-record/
```

Expected:

```
running 21 tests from ./supabase/functions/ea-rtk-record/handler_test.ts
start as the session's host creates a recording and a draft row ... ok (0ms)
… (the 13 other OPIL tests, ok) …
room: start as the Academy admin records the room meeting and files a draft with room_id, never session_no ... ok (0ms)
room: an OPIL coordinator who is not the Academy admin gets 403 not_host and no Cloudflare call ... ok (0ms)
room: no meeting yet → 409 no_room; no room row → 404 not_found; nothing is posted to Cloudflare ... ok (0ms)
room: stop sends the stop action for the room's active recording ... ok (0ms)
room: retry_replay by replay_id re-runs that replay's stored UPLOADED event, even after a newer Start class moved the room's meeting on ... ok (0ms)
room: retry_replay → 400 bad_replay without an id, 404 no_replay for an unknown id, 409 nothing_to_retry when ready, 409 no_upload when it never uploaded ... ok (0ms)
OPIL: a session whose meeting is the Academy room's is refused with 403 not_allowed before any Cloudflare call ... ok (0ms)

ok | 21 passed | 0 failed (4ms)
```

Commit:

```bash
cd /Users/nelsontaylor/taylormade-academy && git add supabase/functions/ea-rtk-record/handler.ts supabase/functions/ea-rtk-record/handler_test.ts && git commit -m "feat(academy): ea-rtk-record — room branch (start/stop, retry by replay_id) and OPIL refuses the room meeting" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Wire the real stores in index.ts — ea_rooms, ea_room_replays, academyAdmin**

Three edits to `supabase/functions/ea-rtk-record/index.ts`.

(a) Replace lines 1–6. Old:

```ts
     1	// ea-rtk-record — start/stop the recording of an OPIL class, and (admin) wire the webhook.
     2	// The page calls `start` right after Start class and `stop` when the host leaves; nobody
     3	// presses Record. See handler.ts for the rules and handler_test.ts for the proof.
     4	//
     5	// Secrets: CF_ACCOUNT_ID, CF_RTK_APP_ID, CF_RTK_API_TOKEN (Realtime Admin), SUPABASE_URL,
     6	// SUPABASE_SERVICE_ROLE_KEY. Deploy: --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr.
```

New:

```ts
// ea-rtk-record — start/stop the recording of an OPIL class or of Nelson's Academy room, and
// (admin) wire the webhook. The page calls `start` right after the host is in and `stop` when
// the host leaves; nobody presses Record. See handler.ts for the rules and handler_test.ts for
// the proof. Body { session_no, action } = OPIL (ea_opil_replays); { room: true, action,
// replay_id? } = the Academy room (ea_room_replays).
//
// Secrets: CF_ACCOUNT_ID, CF_RTK_APP_ID, CF_RTK_API_TOKEN (Realtime Admin), SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Deploy: --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr.
```

(b) Replace line 42 (line 44 after (a)). Old:

```ts
    42	  const reply = await handleRecord(body, { user: who.user, role: who.role, functionsBase: url + "/functions/v1" }, {
```

New:

```ts
  const reply = await handleRecord(body, { user: who.user, role: who.role, academyAdmin: who.academyAdmin, functionsBase: url + "/functions/v1" }, {
```

(c) Replace lines 68–73 (70–75 after (a)). Old:

```ts
    68	    reprocess: async (payload) => {
    69	      const r = await handleEvent(payload, replayDeps(admin, { dedupe: false }));
    70	      const b = r.body as { status?: string };
    71	      return { status: b.status || "unknown" };
    72	    },
    73	  }).catch((e) => { console.error("[ea-rtk-record]", String(e && e.message || e)); return { status: 500, body: { error: "server" } }; });
```

New:

```ts
    reprocess: async (payload) => {
      const r = await handleEvent(payload, replayDeps(admin, { dedupe: false }));
      const b = r.body as { status?: string };
      return { status: b.status || "unknown" };
    },
    /* ── the Academy room (ea_rooms / ea_room_replays, migration 0036) ── */
    getRoom: async () => {
      const { data } = await admin.from("ea_rooms").select("id, meeting_id").order("created_at", { ascending: true }).limit(1).maybeSingle();
      return data ?? null;
    },
    roomMeetingIds: async () => {
      /* both reads fail soft: before 0036 exists the tables are missing, data is null, the set is
         empty and OPIL behaves exactly as today */
      const ids = new Set<string>();
      const [rooms, replays] = await Promise.all([
        admin.from("ea_rooms").select("meeting_id").not("meeting_id", "is", null),
        admin.from("ea_room_replays").select("meeting_id"),
      ]);
      for (const r of rooms.data || []) if (typeof r.meeting_id === "string") ids.add(r.meeting_id);
      for (const r of replays.data || []) if (typeof r.meeting_id === "string") ids.add(r.meeting_id);
      return ids;
    },
    room: {
      latestActive: async (meetingId) => {
        const { data } = await admin.from("ea_room_replays").select("recording_id, status").eq("meeting_id", meetingId).in("status", ACTIVE)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        return data ?? null;
      },
      latestAny: async (meetingId) => {
        const { data } = await admin.from("ea_room_replays").select("recording_id, status").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        return data ?? null;
      },
      insertReplay: async (row) => {
        const { error } = await admin.from("ea_room_replays").insert(row);
        if (error) throw new Error(error.message);
      },
      updateReplayStatus: async (recordingId, status) => {
        await admin.from("ea_room_replays").update({ status, updated_at: new Date().toISOString() }).eq("recording_id", recordingId);
      },
      replayById: async (id) => {
        const { data } = await admin.from("ea_room_replays").select("id, room_id, meeting_id, recording_id, status").eq("id", id).maybeSingle();
        return data ?? null;
      },
    },
  }).catch((e) => { console.error("[ea-rtk-record]", String(e && e.message || e)); return { status: 500, body: { error: "server" } }; });
```

Every select on `ea_room_replays` names its columns (`recording_id, status` / `id, room_id, meeting_id, recording_id, status` / `meeting_id`); `download_url` is never read here. The service role reads `ea_rooms` — pages never do (Task 2's grants). `getRoom` is "the room" per spine: `order by created_at limit 1`.

Run the type check (this is where a missing Task 3 shows up — if it says `Property 'academyAdmin' does not exist on type 'Resolved'`, stop: Task 3 is not on this branch yet):

```bash
cd /Users/nelsontaylor/taylormade-academy && deno check supabase/functions/ea-rtk-record/index.ts; echo "exit=$?"
```

Expected:

```
Check file:///Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-record/index.ts
exit=0
```

(When deno has already checked this exact file it prints only `exit=0`.) Then confirm the tests still stand:

```bash
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-record/ 2>&1 | tail -1
```

Expected: `ok | 21 passed | 0 failed (4ms)`

Commit:

```bash
cd /Users/nelsontaylor/taylormade-academy && git add supabase/functions/ea-rtk-record/index.ts && git commit -m "feat(academy): ea-rtk-record index — ea_rooms/ea_room_replays stores, academyAdmin caller" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: OPIL guard — the cohort suite is still green**

This task touches no OPIL page, but the global rule is that the OPIL tests stay green after every task:

```bash
cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail) "
```

Expected:

```
ℹ tests 18
ℹ pass 18
ℹ fail 0
```

Nothing to commit. Do not deploy and do not push — deploying `ea-rtk-record` (`supabase functions deploy ea-rtk-record --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`) happens in Task 10 after migration 0036 is applied, because this build reads `ea_rooms` and `ea_room_replays`.

---

### Task 6: ea-rtk-webhook — rooms first, replay-row fallback, markFailed on both tables

**Files:**
- Modify: `supabase/functions/ea-rtk-webhook/handler.ts:1-19` (header + types), `:37-38` (add `streamName` after `sessLabel`), `:58-61`, `:65`, `:71-72`, `:81`, `:93` — today's numbers; match each edit on its quoted text. Once the 1-19 block (+7) and the 37-38 block (+11) are in, those anchors sit at 44-45, 76-79, 83, 89-90, 100 and 112.
- Modify: `supabase/functions/ea-rtk-webhook/handler_test.ts:3`, `:32-47` (the `deps()` helper), `:49-56`, `:58-66`, `:140`, then append after `:145` — today's numbers; match on the quoted text. Once the 32-47 block (+9) and the 49-56 block (+13) are in, those anchors sit at 58-65, 80-88, 163 and the append goes after 168.
- Modify: `supabase/functions/_shared/replay_deps.ts:1-54` (that is the whole file — replace it)
- Modify: `supabase/functions/ea-rtk-webhook/index.ts:1-4` (header comment only; no code changes)
- Create: `supabase/functions/ea-rtk-webhook/replay_deps_test.ts`
- Test: `supabase/functions/ea-rtk-webhook/handler_test.ts`, `supabase/functions/ea-rtk-webhook/replay_deps_test.ts`
- NOT touched: `supabase/functions/ea-rtk-record/index.ts` — its `reprocess` (today's lines 68-72; Task 5 may have moved them) keeps calling `replayDeps(admin, { dedupe: false })`, whose signature does not change. Step 5 type-checks it to prove that.

**Interfaces:**
- Consumes: `handleEvent(payload, deps)` and `verifySignature` (today's `handler.ts`); `replayDeps(admin: SupabaseClient, opts: { dedupe: boolean }): WebhookDeps` and `markFailed(admin, payload, message)` (today's `replay_deps.ts`, both keep their signatures); Task 2's tables `public.ea_rooms (id, title, meeting_id, live_since)` and `public.ea_room_replays (room_id, meeting_id, recording_id, status, error, updated_at, created_at)`; today's `ea_opil_sessions.stream_url = 'rtk:' + meetingId` and `ea_opil_replays`.
- Produces: `export type Target = { kind: "room"; room: { id; title; startedAt } } | { kind: "opil"; session: { no; title; kind } }`; `ReplayRow` gains `room_id?: string | null` (`session_no` becomes optional); `WebhookDeps.targetByMeeting(meetingId): Promise<Target | null>`, `upsertReplay(row, target)`, `currentStatus(recordingId, target)`; `replayDeps()` that routes on `target.kind` (`room` → `ea_room_replays`); `markFailed` that tries `ea_room_replays` then `ea_opil_replays`. Task 5's room `retry_replay` → `deps.reprocess(payload)` → this handler now heals the row in `ea_room_replays`. Task 10 step 5 (the real run) is where PostgREST's real answer to `update().select("id")` is proven.

Two red→green cycles, one commit: the handler and the shared module share the `WebhookDeps` type, so a commit between Step 2 and Step 4 would not type-check.

Two deliberate readings, so nobody re-litigates them mid-build: (1) for a meeting that is the room's CURRENT `ea_rooms.meeting_id`, `startedAt` is `ea_rooms.live_since` (the spine leaves it open; the spec's "replay row's `created_at`" differs from it by the seconds between Start class and Nelson's `joined`, and `live_since` is on the row we already read); for the fallback it is the replay row's `created_at`, as the spine says. (2) A table that is not there yet (function deployed before 0036) makes supabase-js answer `{ data: null, error }` — never a throw — so every room lookup falls through and OPIL keeps working; a test covers it.

- [ ] **Step 1: Rewrite the webhook test helper for `targetByMeeting` and add the room tests (red)**

Edit `supabase/functions/ea-rtk-webhook/handler_test.ts`.

Line 3 — old:
```ts
import { verifySignature, handleEvent, type WebhookDeps } from "./handler.ts";
```
new:
```ts
import { verifySignature, handleEvent, type WebhookDeps, type Target } from "./handler.ts";
```

Lines 32-47 — old (the whole `deps()` helper):
```ts
function deps(over: Partial<WebhookDeps> = {}) {
  const upserts: Record<string, unknown>[] = [];
  const copies: { url: string; name: string }[] = [];
  const seen = new Set<string>();
  const d: WebhookDeps & { upserts: typeof upserts; copies: typeof copies } = {
    upserts, copies,
    dedupe: async (id) => { if (seen.has(id)) return false; seen.add(id); return true; },
    sessionByMeeting: async (m) => (m === "meet-7" ? { no: 7, title: "Agents 101", kind: "thread" } : null),
    upsertReplay: async (row) => { upserts.push(row); },
    streamCopy: async (url, name) => { copies.push({ url, name }); return { uid: "uid-abc" }; },
    subdomain: "customer-xyz",
    currentStatus: async (id) => { const last = [...upserts].reverse().find(r => r.recording_id === id); return last ? String(last.status) : null; },
    ...over,
  };
  return d;
}
```
new:
```ts
/* the two kinds of meeting the webhook can be told about: OPIL session 7 and Nelson's room.
   "meet-r" is the room's CURRENT meeting; "meet-old" is one the room has moved on from and is
   known only through its ea_room_replays row (startedAt = that row's created_at). */
const OPIL_7: Target = { kind: "opil", session: { no: 7, title: "Agents 101", kind: "thread" } };
const ROOM_NOW: Target = { kind: "room", room: { id: "room-1", title: "Taylormade Academy Live", startedAt: "2026-09-15T03:30:00.000Z" } };   /* 22:30 on 9/14 in Chicago */
const ROOM_OLD: Target = { kind: "room", room: { id: "room-1", title: "Taylormade Academy Live", startedAt: "2026-09-12T18:05:00.000Z" } };
const TARGETS: Record<string, Target> = { "meet-7": OPIL_7, "meet-r": ROOM_NOW, "meet-old": ROOM_OLD };

function deps(over: Partial<WebhookDeps> = {}) {
  const upserts: Record<string, unknown>[] = [];
  const routed: string[] = [];   /* target.kind handed to upsertReplay, in order */
  const copies: { url: string; name: string }[] = [];
  const seen = new Set<string>();
  const d: WebhookDeps & { upserts: typeof upserts; routed: typeof routed; copies: typeof copies } = {
    upserts, routed, copies,
    dedupe: async (id) => { if (seen.has(id)) return false; seen.add(id); return true; },
    targetByMeeting: async (m) => TARGETS[m] ?? null,
    upsertReplay: async (row, target) => { upserts.push(row); routed.push(target.kind); },
    streamCopy: async (url, name) => { copies.push({ url, name }); return { uid: "uid-abc" }; },
    subdomain: "customer-xyz",
    currentStatus: async (id) => { const last = [...upserts].reverse().find(r => r.recording_id === id); return last ? String(last.status) : null; },
    ...over,
  };
  return d;
}
```

Lines 49-56 — old:
```ts
Deno.test("RECORDING → the row is recording, no Stream copy", async () => {
  const d = deps();
  const r = await handleEvent(REC("RECORDING"), d);
  assertEquals(r.status, 200);
  assertEquals(d.upserts.length, 1);
  assertEquals(d.upserts[0].recording_id, "rec-1"); assertEquals(d.upserts[0].status, "recording"); assertEquals(d.upserts[0].session_no, 7);
  assertEquals(d.copies.length, 0);
});
```
new (one added assertion, then the OPIL guard test right after it):
```ts
Deno.test("RECORDING → the row is recording, no Stream copy", async () => {
  const d = deps();
  const r = await handleEvent(REC("RECORDING"), d);
  assertEquals(r.status, 200);
  assertEquals(d.upserts.length, 1);
  assertEquals(d.upserts[0].recording_id, "rec-1"); assertEquals(d.upserts[0].status, "recording"); assertEquals(d.upserts[0].session_no, 7);
  assertEquals(d.routed, ["opil"]);
  assertEquals(d.copies.length, 0);
});

Deno.test("OPIL guard: the row an OPIL event files is byte-identical to today's — session_no, never room_id", async () => {
  const d = deps();
  await handleEvent(REC("RECORDING"), d);
  assertEquals(d.upserts[0], {
    session_no: 7, meeting_id: "meet-7", recording_id: "rec-1", status: "recording",
    download_url: "https://dl/rec-1.mp4", download_expires_at: "2026-09-21T00:00:00.000Z",
    duration_s: 1800, file_size: 2044680, error: null,
  });
  assertEquals("room_id" in d.upserts[0], false);
  assertEquals(Object.keys(d.upserts[0])[0], "session_no");
});
```

Lines 58-66 — old:
```ts
Deno.test("UPLOADED → copied into Stream, row ready with the watch URL", async () => {
  const d = deps();
  await handleEvent(REC("UPLOADED"), d);
  assertEquals(d.copies, [{ url: "https://dl/rec-1.mp4", name: "OPIL 07 · Agents 101" }]);
  const row = d.upserts[d.upserts.length - 1];
  assertEquals(row.status, "ready"); assertEquals(row.stream_uid, "uid-abc");
  assertEquals(row.watch_url, "https://customer-xyz.cloudflarestream.com/uid-abc/watch");
  assertEquals(row.download_url, "https://dl/rec-1.mp4"); assertEquals(row.duration_s, 1800); assertEquals(row.file_size, 2044680);
});
```
new:
```ts
Deno.test("UPLOADED → copied into Stream, row ready with the watch URL", async () => {
  const d = deps();
  await handleEvent(REC("UPLOADED"), d);
  assertEquals(d.copies, [{ url: "https://dl/rec-1.mp4", name: "OPIL 07 · Agents 101" }]);
  const row = d.upserts[d.upserts.length - 1];
  assertEquals(row.status, "ready"); assertEquals(row.stream_uid, "uid-abc");
  assertEquals(row.watch_url, "https://customer-xyz.cloudflarestream.com/uid-abc/watch");
  assertEquals(row.download_url, "https://dl/rec-1.mp4"); assertEquals(row.duration_s, 1800); assertEquals(row.file_size, 2044680);
  assertEquals(d.routed, ["opil"]);
});
```

Line 140 — old:
```ts
Deno.test("a stranger's validly-signed event leaves no trace: session lookup runs before the dedupe write", async () => {
```
new:
```ts
Deno.test("a stranger's validly-signed event leaves no trace: target lookup runs before the dedupe write", async () => {
```

Append after line 145 (the end of the file):
```ts

/* ---- the Academy room ---- */

Deno.test("a room meeting files a row with room_id and no session_no; the Stream name starts 'Academy · ' and carries the Chicago date", async () => {
  const d = deps();
  const r = await handleEvent(REC("UPLOADED", { meetingId: "meet-r" }), d);
  assertEquals(r.status, 200); assertEquals((r.body as { status?: string }).status, "ready");
  assertEquals(d.routed, ["room"]);
  const row = d.upserts[0];
  assertEquals(row.room_id, "room-1");
  assertEquals("session_no" in row, false);
  assertEquals(row.meeting_id, "meet-r"); assertEquals(row.recording_id, "rec-1");
  assertEquals(row.status, "ready"); assertEquals(row.watch_url, "https://customer-xyz.cloudflarestream.com/uid-abc/watch");
  assert(d.copies[0].name.startsWith("Academy · "));
  assertEquals(d.copies[0].name, "Academy · Taylormade Academy Live · 2026-09-14");   /* 03:30Z on 9/15 is still 9/14 in Chicago */
});

Deno.test("a room without a title is named 'Academy · session · <date>'; no startedAt → today's Chicago date", async () => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const d = deps({ targetByMeeting: async () => ({ kind: "room", room: { id: "room-1", title: null, startedAt: null } }) });
  await handleEvent(REC("UPLOADED", { meetingId: "meet-r" }), d);
  assertEquals(d.copies[0].name, "Academy · session · " + today);
});

Deno.test("a meeting known only through ea_room_replays (the room has moved on) still files under the room", async () => {
  const d = deps();
  const r = await handleEvent(REC("UPLOADED", { id: "rec-old", recordingId: "rec-old", meetingId: "meet-old" }), d);
  assertEquals(r.status, 200);
  assertEquals(d.routed, ["room"]);
  assertEquals(d.upserts[0].room_id, "room-1"); assertEquals(d.upserts[0].meeting_id, "meet-old"); assertEquals(d.upserts[0].recording_id, "rec-old");
  assertEquals("session_no" in d.upserts[0], false);
  assertEquals(d.copies[0].name, "Academy · Taylormade Academy Live · 2026-09-12");   /* the date of THAT session, not today */
});

Deno.test("a room RECORDING event never touches Stream and routes to the room table", async () => {
  const d = deps();
  await handleEvent(REC("RECORDING", { meetingId: "meet-r" }), d);
  assertEquals(d.copies.length, 0); assertEquals(d.routed, ["room"]);
  assertEquals(d.upserts[0], {
    room_id: "room-1", meeting_id: "meet-r", recording_id: "rec-1", status: "recording",
    download_url: "https://dl/rec-1.mp4", download_expires_at: "2026-09-21T00:00:00.000Z",
    duration_s: 1800, file_size: 2044680, error: null,
  });
});

Deno.test("currentStatus is asked with the target, so the forward-only rule reads the right table", async () => {
  const asked: string[] = [];
  const d = deps({ currentStatus: async (_id, target) => { asked.push(target.kind); return null; } });
  await handleEvent(REC("UPLOADED", { meetingId: "meet-r" }), d);
  await handleEvent(REC("UPLOADED", { id: "rec-2", recordingId: "rec-2" }), d);
  assertEquals(asked, ["room", "opil"]);
});

Deno.test("a meeting that is neither the room's nor an OPIL session's → ignored unknown_meeting, zero writes", async () => {
  const ids: string[] = [];
  const d = deps({ dedupe: async (id) => { ids.push(id); return true; } });
  const r = await handleEvent(REC("UPLOADED", { meetingId: "meet-x" }), d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { ok: true, ignored: "unknown_meeting" });
  assertEquals(ids, []); assertEquals(d.upserts, []); assertEquals(d.copies, []); assertEquals(d.routed, []);
});
```

Run it and watch it fail at type-check (nothing runs yet):
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-webhook/
```
Expected (first error; four more TS7006/TS2322 errors follow on the `targetByMeeting`/`upsertReplay` lines of `deps()`):
```
Check supabase/functions/ea-rtk-webhook/handler_test.ts
TS2305 [ERROR]: Module '"file:///Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/handler.ts"' has no exported member 'Target'.
import { verifySignature, handleEvent, type WebhookDeps, type Target } from "./handler.ts";
                                                              ~~~~~~
    at file:///Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/handler_test.ts:3:63
...
error: Type checking failed.
```

- [ ] **Step 2: Teach the handler about targets (green for the handler)**

Edit `supabase/functions/ea-rtk-webhook/handler.ts`.

Lines 1-19 — old:
```ts
// ea-rtk-webhook — what RealtimeKit tells us about a recording becomes a draft replay.
//   RECORDING / UPLOADING / UPLOADED / ERRORED → ea_opil_replays.status
//   UPLOADED → copy the file into Cloudflare Stream → status ready + the watch URL
// Pure: index.ts injects `deps` (database + Stream); handler_test.ts stubs them. Every
// verified event answers 200 — RealtimeKit retries anything else and a bad row is ours to fix.

export type ReplayRow = {
  session_no: number | null; meeting_id: string; recording_id: string; status: string;
  download_url?: string | null; download_expires_at?: string | null; stream_uid?: string | null;
  watch_url?: string | null; duration_s?: number | null; file_size?: number | null; error?: string | null;
};
export type WebhookDeps = {
  dedupe: (id: string, event: string, payload: unknown) => Promise<boolean>;   // true = first time we see it
  sessionByMeeting: (meetingId: string) => Promise<{ no: number; title: string | null; kind: string | null } | null>;
  upsertReplay: (row: ReplayRow) => Promise<void>;
  streamCopy: (url: string, name: string) => Promise<{ uid: string }>;
  subdomain: string;   // customer-xxxx
  currentStatus: (recordingId: string) => Promise<string | null>;   // what the row says now, or null if no row
};
```
new:
```ts
// ea-rtk-webhook — what RealtimeKit tells us about a recording becomes a draft replay.
//   RECORDING / UPLOADING / UPLOADED / ERRORED → ea_room_replays.status (Nelson's room)
//                                              or ea_opil_replays.status (an OPIL session)
//   UPLOADED → copy the file into Cloudflare Stream → status ready + the watch URL
// Pure: index.ts injects `deps` (database + Stream); handler_test.ts stubs them. Every
// verified event answers 200 — RealtimeKit retries anything else and a bad row is ours to fix.

/* Who a meeting belongs to. The room is looked up FIRST (ea_rooms, then ea_room_replays), an OPIL
   session last — so an OPIL session pointed at the room's meeting can never pull an Academy
   recording into OPIL's table. startedAt = when that room session began (the Stream name's date). */
export type Target =
  | { kind: "room"; room: { id: string; title: string | null; startedAt: string | null } }
  | { kind: "opil"; session: { no: number; title: string | null; kind: string | null } };
export type ReplayRow = {
  session_no?: number | null; room_id?: string | null; meeting_id: string; recording_id: string; status: string;
  download_url?: string | null; download_expires_at?: string | null; stream_uid?: string | null;
  watch_url?: string | null; duration_s?: number | null; file_size?: number | null; error?: string | null;
};
export type WebhookDeps = {
  dedupe: (id: string, event: string, payload: unknown) => Promise<boolean>;   // true = first time we see it
  targetByMeeting: (meetingId: string) => Promise<Target | null>;
  upsertReplay: (row: ReplayRow, target: Target) => Promise<void>;           // target.kind picks the table
  streamCopy: (url: string, name: string) => Promise<{ uid: string }>;
  subdomain: string;   // customer-xxxx
  currentStatus: (recordingId: string, target: Target) => Promise<string | null>;   // what the row says now, or null if no row
};
```

Lines 37-38 — old:
```ts
const sessLabel = (s: { no: number; kind: string | null }) =>
  s.kind === "curriculum" ? "S" + (s.no % 100) : s.kind === "hpc" ? "H" + (s.no % 100) : String(s.no).padStart(2, "0");
```
new (same two lines, then the Stream name helper):
```ts
const sessLabel = (s: { no: number; kind: string | null }) =>
  s.kind === "curriculum" ? "S" + (s.no % 100) : s.kind === "hpc" ? "H" + (s.no % 100) : String(s.no).padStart(2, "0");

/* The name the file gets in Cloudflare Stream. OPIL: unchanged. Room: 'Academy · <title> · YYYY-MM-DD',
   the date being the day that session started in Chicago (an 8 pm class that uploads after midnight
   UTC still says the evening's date); no startedAt → today. */
const CHICAGO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" });
const streamName = (t: Target): string => {
  if (t.kind === "opil") return `OPIL ${sessLabel(t.session)} · ${t.session.title || "session"}`;
  const started = t.room.startedAt ? new Date(t.room.startedAt) : new Date();
  const day = CHICAGO_DAY.format(Number.isNaN(started.getTime()) ? new Date() : started);
  return `Academy · ${t.room.title || "session"} · ${day}`;
};
```

Lines 58-61 — old:
```ts
  /* a valid signature only proves Cloudflare sent it — the key is global to RealtimeKit, so look
     the meeting up BEFORE writing anything: a stranger's event never leaves a row behind */
  const session = await deps.sessionByMeeting(meetingId);
  if (!session) return { status: 200, body: { ok: true, ignored: "unknown_meeting" } };
```
new:
```ts
  /* a valid signature only proves Cloudflare sent it — the key is global to RealtimeKit, so look
     the meeting up BEFORE writing anything: a stranger's event never leaves a row behind */
  const target = await deps.targetByMeeting(meetingId);
  if (!target) return { status: 200, body: { ok: true, ignored: "unknown_meeting" } };
```

Line 65 — old:
```ts
  const have = await deps.currentStatus(recordingId);
```
new:
```ts
  const have = await deps.currentStatus(recordingId, target);
```

Lines 71-72 — old:
```ts
  const row: ReplayRow = {
    session_no: session.no, meeting_id: meetingId, recording_id: recordingId, status,
```
new:
```ts
  /* the owner column comes first so an OPIL row is the exact object it was before rooms existed */
  const row: ReplayRow = {
    ...(target.kind === "room" ? { room_id: target.room.id } : { session_no: target.session.no }),
    meeting_id: meetingId, recording_id: recordingId, status,
```

Line 81 — old:
```ts
    const name = `OPIL ${sessLabel(session)} · ${session.title || "session"}`.slice(0, 120);
```
new:
```ts
    const name = streamName(target).slice(0, 120);
```

Line 93 — old:
```ts
  await deps.upsertReplay(row);
```
new:
```ts
  await deps.upsertReplay(row, target);
```

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-webhook/
```
Expected: `ok | 21 passed | 0 failed` (the 14 you started with, all still green, plus 7 new). The OPIL proof is the test named `OPIL guard: the row an OPIL event files is byte-identical to today's — session_no, never room_id` together with the untouched `UPLOADED → copied into Stream…` test still expecting `"OPIL 07 · Agents 101"`.

The shared module is now out of step with the type — confirm that, it is what Step 4 fixes:
```
cd /Users/nelsontaylor/taylormade-academy && deno check supabase/functions/_shared/replay_deps.ts
```
Expected:
```
Check supabase/functions/_shared/replay_deps.ts
TS2353 [ERROR]: Object literal may only specify known properties, and 'sessionByMeeting' does not exist in type 'WebhookDeps'.
    sessionByMeeting: async (meetingId) => {
    ~~~~~~~~~~~~~~~~
    at file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/replay_deps.ts:17:5
...
Found 2 errors.
```
Do not commit yet.

- [ ] **Step 3: Write the shared-module test against an in-memory supabase stand-in (red)**

Create `supabase/functions/ea-rtk-webhook/replay_deps_test.ts` with exactly this content:
```ts
// deno test supabase/functions/ea-rtk-webhook/
// _shared/replay_deps.ts against an in-memory stand-in for the supabase client: the meeting lookup
// (room FIRST, OPIL last), which table each kind writes to, and markFailed's two-table fallback.
// What this cannot prove — PostgREST's real answer to update().select("id") — is Task 10's real run.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { replayDeps, markFailed } from "../_shared/replay_deps.ts";

type Row = Record<string, unknown>;
type Call = { op: "select" | "update" | "upsert"; table: string; eq: [string, unknown][] };

/* Just enough of supabase-js's builder for replay_deps.ts: from().select().eq().order().limit().maybeSingle(),
   from().update().eq()[.select()], from().upsert(). A table missing from `tables` answers the way PostgREST
   does for an unknown relation — { data: null, error } — never a throw. */
function fakeAdmin(tables: Record<string, Row[]>) {
  const calls: Call[] = [];
  const missing = (table: string) => ({ data: null, error: { code: "42P01", message: `relation "public.${table}" does not exist` } });
  const from = (table: string) => {
    const build = (op: "select" | "update", patch?: Row) => {
      const eq: [string, unknown][] = [];
      let orderBy = "", desc = false, take = Infinity, returning = false;
      const run = () => {
        calls.push({ op, table, eq });
        const rows = tables[table];
        if (!rows) return missing(table);
        let hit = rows.filter((r) => eq.every(([k, v]) => r[k] === v));
        if (op === "update") { hit.forEach((r) => Object.assign(r, patch)); return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null }; }
        if (orderBy) hit = [...hit].sort((a, b) => (String(a[orderBy]) < String(b[orderBy]) ? -1 : 1) * (desc ? -1 : 1));
        return { data: hit.slice(0, take), error: null };
      };
      const q = {
        eq(k: string, v: unknown) { eq.push([k, v]); return q; },
        order(k: string, o: { ascending: boolean }) { orderBy = k; desc = !o.ascending; return q; },
        limit(n: number) { take = n; return q; },
        select(_cols: string) { returning = true; return q; },
        maybeSingle() { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : null, error: r.error }); },
        then(onOk: (v: { data: unknown; error: unknown }) => unknown, onErr?: (e: unknown) => unknown) { return Promise.resolve(run()).then(onOk, onErr); },
      };
      return q;
    };
    return {
      select: (_cols: string) => build("select"),
      update: (patch: Row) => build("update", patch),
      upsert(row: Row, opts: { onConflict: string }) {
        calls.push({ op: "upsert", table, eq: [[opts.onConflict, row[opts.onConflict]]] });
        const rows = tables[table];
        if (!rows) return Promise.resolve(missing(table));
        const i = rows.findIndex((r) => r[opts.onConflict] === row[opts.onConflict]);
        if (i >= 0) Object.assign(rows[i], row); else rows.push({ ...row });
        return Promise.resolve({ data: null, error: null });
      },
    };
  };
  return { admin: { from } as unknown as SupabaseClient, calls, tables };
}

/* Nelson's room is on meeting "meet-r" now; "meet-old" was a previous Start class whose recording is
   still uploading; OPIL session 7 lives on "meet-7". */
const world = () => ({
  ea_rooms: [{ id: "room-1", title: "Taylormade Academy Live", meeting_id: "meet-r", live_since: "2026-09-15T01:00:00.000Z" }],
  ea_room_replays: [
    { id: "rr-1", room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-old", status: "uploading", created_at: "2026-09-12T18:05:00.000Z" },
    { id: "rr-0", room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-older", status: "error", created_at: "2026-09-12T17:00:00.000Z" },
  ],
  ea_opil_replays: [{ id: "or-1", session_no: 7, meeting_id: "meet-7", recording_id: "rec-7", status: "recording", created_at: "2026-09-10T00:00:00.000Z" }],
  ea_opil_sessions: [{ no: 7, title: "Agents 101", kind: "thread", stream_url: "rtk:meet-7" }],
});
const tablesAsked = (calls: Call[], op: Call["op"]) => calls.filter((c) => c.op === op).map((c) => c.table);

Deno.test("targetByMeeting: the room's current meeting → room, startedAt = live_since, and OPIL is never asked", async () => {
  const { admin, calls } = fakeAdmin(world());
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-r");
  assertEquals(t, { kind: "room", room: { id: "room-1", title: "Taylormade Academy Live", startedAt: "2026-09-15T01:00:00.000Z" } });
  assertEquals(tablesAsked(calls, "select"), ["ea_rooms"]);
});

Deno.test("targetByMeeting: an OPIL session pointed at the room's meeting still loses — rooms resolve first", async () => {
  const w = world();
  w.ea_opil_sessions.push({ no: 9, title: "Hijack", kind: "thread", stream_url: "rtk:meet-r" });
  const { admin } = fakeAdmin(w);
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-r");
  assertEquals(t?.kind, "room");
});

Deno.test("targetByMeeting: a meeting the room has moved on from → room via its latest ea_room_replays row; startedAt = that row's created_at; title from ea_rooms", async () => {
  const { admin, calls } = fakeAdmin(world());
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-old");
  assertEquals(t, { kind: "room", room: { id: "room-1", title: "Taylormade Academy Live", startedAt: "2026-09-12T18:05:00.000Z" } });
  assertEquals(tablesAsked(calls, "select"), ["ea_rooms", "ea_room_replays", "ea_rooms"]);
});

Deno.test("targetByMeeting: an OPIL session's meeting → opil with { no, title, kind }, asked last", async () => {
  const { admin, calls } = fakeAdmin(world());
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-7");
  assertEquals(t, { kind: "opil", session: { no: 7, title: "Agents 101", kind: "thread" } });
  assertEquals(tablesAsked(calls, "select"), ["ea_rooms", "ea_room_replays", "ea_opil_sessions"]);
});

Deno.test("targetByMeeting: nobody's meeting → null", async () => {
  const { admin } = fakeAdmin(world());
  assertEquals(await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-x"), null);
});

Deno.test("targetByMeeting: with the room tables not there yet (0036 unapplied) an OPIL meeting still resolves", async () => {
  const { admin } = fakeAdmin({ ea_opil_sessions: world().ea_opil_sessions });
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-7");
  assertEquals(t, { kind: "opil", session: { no: 7, title: "Agents 101", kind: "thread" } });
});

Deno.test("upsertReplay: a room row lands in ea_room_replays, an OPIL row in ea_opil_replays, both with updated_at", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  const d = replayDeps(admin, { dedupe: false });
  await d.upsertReplay({ room_id: "room-1", meeting_id: "meet-r", recording_id: "rec-new", status: "recording" }, { kind: "room", room: { id: "room-1", title: null, startedAt: null } });
  await d.upsertReplay({ session_no: 7, meeting_id: "meet-7", recording_id: "rec-7", status: "uploading" }, { kind: "opil", session: { no: 7, title: null, kind: null } });
  assertEquals(tablesAsked(calls, "upsert"), ["ea_room_replays", "ea_opil_replays"]);
  const roomRow = tables.ea_room_replays.find((r) => r.recording_id === "rec-new")!;
  assertEquals(roomRow.room_id, "room-1"); assert(typeof roomRow.updated_at === "string");
  assertEquals(tables.ea_opil_replays[0].status, "uploading"); assertEquals(tables.ea_opil_replays.length, 1);
  assertEquals(tables.ea_room_replays.length, 3);
});

Deno.test("upsertReplay: a database error becomes a throw (the handler's catch → markFailed)", async () => {
  const { admin } = fakeAdmin({});
  const d = replayDeps(admin, { dedupe: false });
  let threw = "";
  try { await d.upsertReplay({ room_id: "room-1", meeting_id: "m", recording_id: "r", status: "recording" }, { kind: "room", room: { id: "room-1", title: null, startedAt: null } }); }
  catch (e) { threw = String((e as Error).message); }
  assert(threw.includes("ea_room_replays"));
});

Deno.test("currentStatus reads the table of the target's kind", async () => {
  const { admin } = fakeAdmin(world());
  const d = replayDeps(admin, { dedupe: false });
  const room = { kind: "room", room: { id: "room-1", title: null, startedAt: null } } as const;
  const opil = { kind: "opil", session: { no: 7, title: null, kind: null } } as const;
  assertEquals(await d.currentStatus("rec-old", room), "uploading");
  assertEquals(await d.currentStatus("rec-7", opil), "recording");
  assertEquals(await d.currentStatus("rec-7", room), null);   /* an OPIL recording is not in the room table */
});

const FAIL = (recordingId: string) => ({ event: "recording.statusUpdate", recording: { id: recordingId, status: "UPLOADED" } });

Deno.test("markFailed: a room recording → ea_room_replays marked error; ea_opil_replays never touched", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  await markFailed(admin, FAIL("rec-old"), "boom: bad column");
  assertEquals(tablesAsked(calls, "update"), ["ea_room_replays"]);
  const row = tables.ea_room_replays.find((r) => r.recording_id === "rec-old")!;
  assertEquals(row.status, "error"); assertEquals(row.error, "boom: bad column"); assert(typeof row.updated_at === "string");
  assertEquals(tables.ea_opil_replays[0].status, "recording");
});

Deno.test("markFailed: an OPIL recording → the room table matched nothing, so ea_opil_replays is marked", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  await markFailed(admin, FAIL("rec-7"), "boom");
  assertEquals(tablesAsked(calls, "update"), ["ea_room_replays", "ea_opil_replays"]);
  assertEquals(tables.ea_opil_replays[0].status, "error"); assertEquals(tables.ea_opil_replays[0].error, "boom");
  assertEquals(tables.ea_room_replays.map((r) => r.status), ["uploading", "error"]);   /* untouched */
});

Deno.test("markFailed: no room table yet (0036 unapplied) → OPIL row still marked, exactly as today", async () => {
  const { admin, tables } = fakeAdmin({ ea_opil_replays: world().ea_opil_replays });
  await markFailed(admin, FAIL("rec-7"), "boom");
  assertEquals(tables.ea_opil_replays[0].status, "error");
});

Deno.test("markFailed: the message is cut at 500; no recording id → no write; a throwing client is swallowed", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  await markFailed(admin, FAIL("rec-old"), "x".repeat(900));
  assertEquals(String(tables.ea_room_replays[0].error).length, 500);
  await markFailed(admin, { event: "recording.statusUpdate", recording: {} }, "boom");
  assertEquals(tablesAsked(calls, "update").length, 1);
  const bad = { from: () => { throw new Error("db down"); } } as unknown as SupabaseClient;
  await markFailed(bad, FAIL("rec-old"), "boom");   /* resolves, does not throw */
});
```

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-webhook/
```
Expected (red — the old shared module does not fit the new type; nothing runs):
```
Check supabase/functions/ea-rtk-webhook/handler_test.ts
Check supabase/functions/ea-rtk-webhook/replay_deps_test.ts
TS2353 [ERROR]: Object literal may only specify known properties, and 'sessionByMeeting' does not exist in type 'WebhookDeps'.
    sessionByMeeting: async (meetingId) => {
    ~~~~~~~~~~~~~~~~
    at file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/replay_deps.ts:17:5

TS7006 [ERROR]: Parameter 'meetingId' implicitly has an 'any' type.
    sessionByMeeting: async (meetingId) => {
                             ~~~~~~~~~
    at file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/replay_deps.ts:17:30

Found 2 errors.

error: Type checking failed.
```
Run it from the repo root exactly as shown: a directory with a `package.json` above it (the scratchpad harness has one) makes Deno look for `npm:@types/node` in a `node_modules` folder and fail before this point; the repo root has no `package.json`.

- [ ] **Step 4: Replace the shared module — three-step lookup, routing by kind, markFailed on both tables (green)**

Replace the whole of `supabase/functions/_shared/replay_deps.ts` (today's lines 1-54; the parts that move are lines 17-20 `sessionByMeeting`, 21-24 `upsertReplay`, 38-41 `currentStatus`, 47-54 `markFailed`; `dedupe` and `streamCopy` keep their bodies) with exactly:
```ts
// The real-world dependencies behind a replay event: dedupe table, meeting → owner lookup, replay
// upsert, Cloudflare Stream copy. Shared by ea-rtk-webhook (live events) and ea-rtk-record
// (a Retry re-runs a stored event through the same code). A recording belongs to Nelson's room
// (ea_room_replays) or to an OPIL session (ea_opil_replays); target.kind says which table.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { WebhookDeps, ReplayRow, Target } from "../ea-rtk-webhook/handler.ts";

const table = (t: Target) => (t.kind === "room" ? "ea_room_replays" : "ea_opil_replays");

export function replayDeps(admin: SupabaseClient, opts: { dedupe: boolean }): WebhookDeps {
  return {
    dedupe: async (id, event, p) => {
      if (!opts.dedupe) return true;   // a Retry deliberately re-runs an event we have already seen
      const { error } = await admin.from("ea_rtk_events").insert({ id, event, payload: p });
      if (!error) return true;
      if (error.code === "23505") return false;   // seen before
      const e = new Error(error.message); e.name = "DedupeError"; throw e;   // the caller answers 503 so Cloudflare retries
    },
    /* Room FIRST, OPIL LAST: an OPIL session whose stream_url points at the room's meeting must never
       receive an Academy recording. Step 2 catches a recording that finishes after the next Start class
       replaced ea_rooms.meeting_id — its own replay row still says which room it belongs to. A table
       that is not there yet (0036 unapplied) answers { data: null } and simply falls through. */
    targetByMeeting: async (meetingId) => {
      const live = await admin.from("ea_rooms").select("id, title, live_since").eq("meeting_id", meetingId).limit(1).maybeSingle();
      if (live.data) return { kind: "room", room: { id: String(live.data.id), title: live.data.title ?? null, startedAt: live.data.live_since ?? null } };
      const prior = await admin.from("ea_room_replays").select("room_id, created_at").eq("meeting_id", meetingId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (prior.data) {
        if (!prior.data.room_id) return null;   // an Academy replay whose room is gone is still not OPIL's
        const r = await admin.from("ea_rooms").select("title").eq("id", prior.data.room_id).maybeSingle();
        return { kind: "room", room: { id: String(prior.data.room_id), title: r.data?.title ?? null, startedAt: prior.data.created_at ?? null } };
      }
      const { data } = await admin.from("ea_opil_sessions").select("no, title, kind").eq("stream_url", "rtk:" + meetingId).limit(1).maybeSingle();
      return data ? { kind: "opil", session: { no: data.no, title: data.title ?? null, kind: data.kind ?? null } } : null;
    },
    upsertReplay: async (row: ReplayRow, target) => {
      const { error } = await admin.from(table(target)).upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "recording_id" });
      if (error) throw new Error(error.message);
    },
    streamCopy: async (dl, name) => {
      const acct = Deno.env.get("CF_ACCOUNT_ID") || "", streamToken = Deno.env.get("CF_API_TOKEN") || "";
      if (!acct || !streamToken) throw new Error("Stream is not configured");
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/stream/copy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${streamToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: dl, meta: { name } }),
      });
      const j = await r.json().catch(() => ({})) as { success?: boolean; result?: { uid?: string }; errors?: unknown };
      const uid = j?.result?.uid;
      if (!r.ok || !j?.success || !uid) throw new Error(`Stream copy ${r.status}: ${JSON.stringify(j?.errors || {}).slice(0, 200)}`);
      return { uid };
    },
    /* env is read when used, not when the deps are built: replay_deps_test.ts builds them with no --allow-env */
    get subdomain() { return Deno.env.get("CF_STREAM_SUBDOMAIN") || ""; },
    currentStatus: async (recordingId, target) => {
      const { data } = await admin.from(table(target)).select("status").eq("recording_id", recordingId).maybeSingle();
      return data?.status ?? null;
    },
  };
}

/* When the handler itself blows up (a bad column value, say), the row must not sit on "preparing"
   forever: mark it failed with the reason so Nelson (or the coordinator) sees Retry. The catch only
   has the payload, not the target, so try the room table first and, if it matched no row, OPIL's.
   .select("id") on the update makes supabase-js return the rows it touched. */
export async function markFailed(admin: SupabaseClient, payload: Record<string, unknown>, message: string) {
  try {
    const rec = (payload.recording || {}) as Record<string, unknown>;
    const recordingId = typeof rec.id === "string" ? rec.id : typeof rec.recordingId === "string" ? rec.recordingId : "";
    if (!recordingId) return;
    const patch = { status: "error", error: message.slice(0, 500), updated_at: new Date().toISOString() };
    const room = await admin.from("ea_room_replays").update(patch).eq("recording_id", recordingId).select("id");
    if (Array.isArray(room.data) && room.data.length > 0) return;
    await admin.from("ea_opil_replays").update(patch).eq("recording_id", recordingId);
  } catch (_) { /* best effort */ }
}
```
The one runtime change outside the brief: `CF_*` env is read inside `streamCopy` / a `subdomain` getter instead of once at construction, so the test can build the deps without `--allow-env` (`Deno.env.get` throws `NotCapable` under a plain `deno test`). Edge-function env does not change within a request, so nothing observable moves.

Run:
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-webhook/
```
Expected (times vary):
```
Check supabase/functions/ea-rtk-webhook/handler_test.ts
Check supabase/functions/ea-rtk-webhook/replay_deps_test.ts
running 21 tests from ./supabase/functions/ea-rtk-webhook/handler_test.ts
a body signed with the key verifies; a tampered body does not ... ok (61ms)
RECORDING → the row is recording, no Stream copy ... ok (0ms)
OPIL guard: the row an OPIL event files is byte-identical to today's — session_no, never room_id ... ok (0ms)
UPLOADED → copied into Stream, row ready with the watch URL ... ok (0ms)
a fractional duration (Cloudflare sends 102.783) is stored as whole seconds ... ok (0ms)
UPLOADED but Stream fails → row error, download URL kept, still 200 ... ok (0ms)
ERRORED → row error with the reason ... ok (0ms)
the same event twice is handled once ... ok (0ms)
a recording for a meeting we do not know is ignored (200) ... ok (0ms)
meeting.ended is recorded and nothing else happens ... ok (0ms)
an event without a recognisable shape is a 200 no-op ... ok (0ms)
a late RECORDING after ready is ignored — the row never moves backwards ... ok (0ms)
a failed row can still be healed by a later successful upload ... ok (0ms)
an ERRORED event after ready does not un-ready a replay ... ok (0ms)
a stranger's validly-signed event leaves no trace: target lookup runs before the dedupe write ... ok (0ms)
a room meeting files a row with room_id and no session_no; the Stream name starts 'Academy · ' and carries the Chicago date ... ok (0ms)
a room without a title is named 'Academy · session · <date>'; no startedAt → today's Chicago date ... ok (0ms)
a meeting known only through ea_room_replays (the room has moved on) still files under the room ... ok (0ms)
a room RECORDING event never touches Stream and routes to the room table ... ok (0ms)
currentStatus is asked with the target, so the forward-only rule reads the right table ... ok (0ms)
a meeting that is neither the room's nor an OPIL session's → ignored unknown_meeting, zero writes ... ok (0ms)
running 13 tests from ./supabase/functions/ea-rtk-webhook/replay_deps_test.ts
targetByMeeting: the room's current meeting → room, startedAt = live_since, and OPIL is never asked ... ok (0ms)
targetByMeeting: an OPIL session pointed at the room's meeting still loses — rooms resolve first ... ok (0ms)
targetByMeeting: a meeting the room has moved on from → room via its latest ea_room_replays row; startedAt = that row's created_at; title from ea_rooms ... ok (0ms)
targetByMeeting: an OPIL session's meeting → opil with { no, title, kind }, asked last ... ok (0ms)
targetByMeeting: nobody's meeting → null ... ok (0ms)
targetByMeeting: with the room tables not there yet (0036 unapplied) an OPIL meeting still resolves ... ok (0ms)
upsertReplay: a room row lands in ea_room_replays, an OPIL row in ea_opil_replays, both with updated_at ... ok (1ms)
upsertReplay: a database error becomes a throw (the handler's catch → markFailed) ... ok (0ms)
currentStatus reads the table of the target's kind ... ok (0ms)
markFailed: a room recording → ea_room_replays marked error; ea_opil_replays never touched ... ok (0ms)
markFailed: an OPIL recording → the room table matched nothing, so ea_opil_replays is marked ... ok (0ms)
markFailed: no room table yet (0036 unapplied) → OPIL row still marked, exactly as today ... ok (0ms)
markFailed: the message is cut at 500; no recording id → no write; a throwing client is swallowed ... ok (0ms)

ok | 34 passed | 0 failed (283ms)
```
What the fake cannot prove: that PostgREST really returns the touched rows for `update(...).eq(...).select("id")` with the service role (it does — `Prefer: return=representation` is what `.select()` adds — but only Task 10 step 5's real run, where a forced failure on a room recording shows *Replay failed — Retry* on `/live/` and leaves `ea_opil_replays` alone, is the proof).

- [ ] **Step 5: Fix the webhook's header comment, type-check every entry point, re-run the OPIL guards**

Edit `supabase/functions/ea-rtk-webhook/index.ts` lines 1-4 — old:
```ts
// ea-rtk-webhook — RealtimeKit calls this when a recording changes state (and when a meeting
// ends). Signature-verified against Cloudflare's published key, deduped in ea_rtk_events, and
// on UPLOADED the file is copied into Cloudflare Stream so it never expires. The result is a
// DRAFT replay row the coordinator publishes from /opil/hub/admin/. See handler.ts.
```
new:
```ts
// ea-rtk-webhook — RealtimeKit calls this when a recording changes state (and when a meeting
// ends). Signature-verified against Cloudflare's published key, deduped in ea_rtk_events, and
// on UPLOADED the file is copied into Cloudflare Stream so it never expires. The result is a
// DRAFT replay row: ea_room_replays when the meeting is Nelson's room (published from /live/),
// ea_opil_replays when it is an OPIL session (published from /opil/hub/admin/). See handler.ts.
```
No code in `index.ts` changes: `handleEvent(payload, replayDeps(admin, { dedupe: true }))` and the catch's `markFailed(admin, payload, message)` (lines 53-59) already have the right shapes.

Type-check the three modules that import the shared file (this is also the proof that `ea-rtk-record`'s `reprocess`, untouched by this task, still compiles):
```
cd /Users/nelsontaylor/taylormade-academy && deno check supabase/functions/ea-rtk-webhook/index.ts supabase/functions/ea-rtk-record/index.ts supabase/functions/_shared/replay_deps.ts
```
Expected (three `Check` lines, no errors, exit 0):
```
Check file:///Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-webhook/index.ts
Check file:///Users/nelsontaylor/taylormade-academy/supabase/functions/ea-rtk-record/index.ts
Check file:///Users/nelsontaylor/taylormade-academy/supabase/functions/_shared/replay_deps.ts
```

OPIL guards — this task touches no page JS, so both must be exactly as before:
```
cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```
Expected:
```
ℹ tests 18
ℹ pass 18
ℹ fail 0
```
```
cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-record/
```
Expected: `ok | N passed | 0 failed` with 0 failed (N is 14 today; Task 5 adds its own, none of them touch this module).

- [ ] **Step 6: Commit**

```
cd /Users/nelsontaylor/taylormade-academy && git add supabase/functions/ea-rtk-webhook/handler.ts supabase/functions/ea-rtk-webhook/handler_test.ts supabase/functions/ea-rtk-webhook/replay_deps_test.ts supabase/functions/ea-rtk-webhook/index.ts supabase/functions/_shared/replay_deps.ts && git commit -m "feat(academy): ea-rtk-webhook files Academy room recordings — ea_rooms first, ea_room_replays fallback, OPIL last; markFailed on both tables

targetByMeeting replaces sessionByMeeting: the room's current meeting, then a meeting the
room has moved on from (its own ea_room_replays row), then an OPIL session's stream_url.
Rows carry room_id or session_no by target.kind; upsertReplay/currentStatus route by kind.
Stream name for a room: 'Academy · <title> · YYYY-MM-DD' (Chicago date of that session).
OPIL rows, names and tables are byte-identical (handler_test OPIL guard; 18 node tests).
markFailed tries ea_room_replays then ea_opil_replays; a missing room table falls through.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Expected: one commit on `domain-migration`, 5 files changed. Do not push — Task 10 deploys (`supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`, after 0036 is applied) and runs the real webhook path; nothing here touches prod.

---

### Task 7: `js/rtk-room-v2.js` — the `target` option, words, Leave = end for everyone, `onState` reason

**Files:**
- Modify: `js/rtk-room-v2.js:10` (static import → module-level `let copy`), `:36-55` (`joinTarget`), `:89-92` (`mountRoomV2` head → target block), `:99-100`, `:105`, `:147-148`, `:154`, `:194`, `:204`, `:218-222` (call sites, `gone`/`roomLeft`/`leaveNow`), `:232-235`, `:240`, `:248-249` (`joinScreen`), `:260` (`wireChips`), `:270-272`, `:317`, `:353`, `:356`, `:360`, `:366`, `:370-372`, `:376-379`, `:384`, `:389-390`, `:396`, `:419`, `:425`, `:435`, `:443`, `:459` (`classRoom`)
- Create: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/package.json` and `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-v2.mjs` (the scratchpad, never the repo)
- Test: `tests/opil/*.test.mjs` (unchanged, 18 tests, must stay green) and the harness above (**this harness is the Wednesday gate**: it is what proves the 30 OPIL students on 9/16 see exactly today's room; spec §10 says it, not a prod click, gates step 3 of the rollout)
- NOT touched: `opil/hub/live/index.html` (line 127 keeps calling `mountRoomV2({ … session, mode, meetingId, facilitator, onState, onOpened })` with no `target`, so it takes the default path), `js/rtk-room.js` (v1, `?classic=1`), `css/rtk-room-v2.css`, `build_site.py`, `sw.js` (Task 9 restamps `?v=` — the stamp is a content hash of the shared assets, so this edit changes it — and bumps `VERSION`; do neither here). No push.

**Interfaces:**
- Consumes (Task 1, `opil/hub/live-rooms.js`): `OPIL_WORDS`, `ROOM_WORDS`, `capFirst(s)`, `sessLabel(s)`, `stateCopy({audio,video})`, `nowCopy({facilitator,title,recording,breakout}, words = OPIL_WORDS)`, `joinCopy({live,host,facilitator,joined,startsAt}, words = OPIL_WORDS)`, `queueOrder(rows)`, `queuePosition(rows,uid)`, `nextInLine(rows)` — all loaded at mount time by `await import('/opil/hub/live-rooms.js' + new URL(import.meta.url).search)`.
- Consumes (Tasks 3/4, `ea-rtk-join`): request body `{ session_no, meeting_id? }` (OPIL) or `{ room: true, key: string|null }` (room); error codes `sign_in · not_allowed · not_open · not_found · bad_link · room_full · slow_down · rtk_not_configured`; the host reply carries `meeting_id`, a guest's does not.
- Consumes (Task 2): tables `ea_opil_hands (session_no, user_id, kind)` and `ea_room_hands (room_id, user_id, kind)` — the page inserts exactly those three columns (the column grants in 0036 allow nothing more).
- Produces (for Task 8, `room/index.html`): `mountRoomV2(o)` with `o = { mountEl, cfg, token, sb, user, mode:'waiting'|'student'|'host', meetingId?, facilitator?, onState?, onOpened?, session?, target? }`, `target = o.target || { kind:'opil', session: o.session }`, room target shape `{ kind:'room', id, title, key }`; `onState(state, meeting, reason)` with `state ∈ 'joined'|'left'|'ended'` (unchanged values) and `reason ∈ 'left'|'kicked'|'ended'`; return `{ meetingId, host, leave, setRecording }` (unchanged). Errors thrown from `mountRoomV2` carry `e.code` and `e.status` so `/room/` can re-word them with `joinErrorText`. One thing Task 8 must plan for: on a person's OWN Leave, `onState('left', m, 'left')` fires twice (the kit's `roomLeft` event and our own call) — that is today's behaviour and is kept; treat it as idempotent.

- [ ] **Step 1: Install the harness runtime in the scratchpad (system Chrome, Playwright 1.47.2).**

```bash
mkdir -p /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness && cd /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness && printf '{ "name": "harness", "private": true, "type": "module" }\n' > package.json && npm i playwright@1.47.2 && grep '"version"' node_modules/playwright/package.json
```

Expected last line: `  "version": "1.47.2",`. (The `package.json` must exist first — without it npm walks up to a parent and installs nothing here.) Chrome is `/Applications/Google Chrome.app`; Playwright launches it with `channel: 'chrome'`, nothing is downloaded.

- [ ] **Step 2: Write the harness — the COMPLETE file `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-v2.mjs`.**

It serves the repo root on `127.0.0.1:8770`, drives the REAL `/opil/hub/live/?s=2` page with the REAL `hub.js`, `live-rooms.js` and `rtk-room-v2.js`, and stubs only `https://esm.sh/@supabase/supabase-js@2` (fake `createClient` with programmable `rpc`/`from`/`auth`/`channel`), the jsdelivr RealtimeKit files (fake `RealtimeKitClient.init` → a meeting with `self`/`participants`/`join`/`leave`/`on`, plus real-but-inert custom elements for every `rtk-*` tag the module uses) and `https://pgqdmnmessbbzyszjfvr.functions.supabase.co/*`. Part A is the OPIL page with OPIL defaults; Part B mounts the module in room mode from a page the harness serves itself (`/__t7/room.html`), so this task's own behaviour is proven before `/room/` exists. It never signs in to prod: any request that reaches supabase.co/cloudflare prints `LEAK` and fails the run.

```js
// harness/room-v2.mjs — the OPIL room-v2 gate for Wednesday 9/16, rebuilt for the Academy Room work.
//
// Drives the REAL /opil/hub/live/ page + the REAL opil/hub/hub.js + the REAL js/rtk-room-v2.js and
// opil/hub/live-rooms.js served from the repo root, in the system Chrome, with three things faked:
//   • https://esm.sh/@supabase/supabase-js@2  → a fake createClient (programmable rpc / from / auth / channel)
//   • https://cdn.jsdelivr.net/npm/@cloudflare/* → a fake RealtimeKitClient + inert custom elements
//   • https://*.functions.supabase.co/*        → fake ea-rtk-join / ea-rtk-record
// Nothing here ever signs in to prod; any request that slips through to supabase.co or cloudflare
// is reported as a LEAK and fails the run.
//
// Part A walks the OPIL page (/opil/hub/live/?s=2) with OPIL defaults — every string must be
// byte-identical to today's. Part B mounts the module in room mode from a tiny page the harness
// serves itself (/__t7/room.html), so Task 7's own behaviour is proven before /room/ exists.
//
// Run from anywhere:  node <this file>
// Optional, for trying an edited copy without touching the repo:
//   R2_MODULE=/path/to/rtk-room-v2.js  R2_WORDS=/path/to/live-rooms.js  node <this file>
// Prints PASS <name> / FAIL <name> lines and exits 1 on any FAIL.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = '/Users/nelsontaylor/taylormade-academy';
const PORT = Number(process.env.PORT || 8770), BASE = 'http://127.0.0.1:' + PORT;   /* PORT=8779 when another harness holds 8770 — the same switch live-page.mjs reads */
const FN = 'https://pgqdmnmessbbzyszjfvr.functions.supabase.co';   /* what js/config.js really says */

/* ---------- static server on 127.0.0.1:8770 (python's http.server, repo root) ---------- */
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch (e) {} });   /* a crash before the last line must not leave python holding 8770 for room-page.mjs / live-page.mjs */
await new Promise((res) => { const t = setInterval(async () => { try { await fetch(BASE + '/js/config.js'); clearInterval(t); res(); } catch (e) {} }, 100); });

/* ---------- the world the fakes describe ---------- */
const state = {
  sessions: [
    { no: 2, kind: 'thread', title: 'Orientation', session_date: '2026-09-16', is_live: false, stream_url: null, outcome: 'Your team, your problem, your first agent', recording_url: null },
    { no: 5, kind: 'thread', title: 'Open build', session_date: null, is_live: false, stream_url: null, outcome: '', recording_url: null },
  ],
  opilHands: [], roomHands: [], recCalls: [], joinCalls: [], peers: [],   /* peers: who the fake kit says is in the room */
  room: { id: 'room-1', title: 'Taylormade Academy Live', link_key: 'kkkkkkkkkkkkkkkkkkkkkk', is_live: false, meeting_id: null },
  joinReply: null,   /* when set, the next room join answers with this { status, body } instead */
};
const sess = (no) => state.sessions.find(s => s.no === no);
const table = (t) => t === 'ea_opil_hands' ? state.opilHands : t === 'ea_room_hands' ? state.roomHands : null;

/* ---------- fake supabase-js: createClient → { auth, rpc, from, channel, removeChannel } ---------- */
const stubSupabase = (role) => `
const ROLE = ${JSON.stringify(role)};
function from(table) {
  const f = { filters: [], neq: [], ins: [], iss: [], orderKey: null, lim: null, single: false, upd: null, del: false, ins_row: null };
  const api = {
    select() { return api; }, order(k) { f.orderKey = k; return api; }, limit(n) { f.lim = n; return api; },
    eq(k, v) { f.filters.push([k, v]); return api; }, neq(k, v) { f.neq.push([k, v]); return api; },
    in(k, vs) { f.ins.push([k, vs]); return api; }, is(k, v) { f.iss.push([k, v]); return api; }, not() { return api; }, or() { return api; },
    maybeSingle() { f.single = true; return api; }, single() { f.single = true; return api; },
    update(u) { f.upd = u; return api; }, delete() { f.del = true; return api; },
    insert(row) { f.ins_row = row; return api; }, upsert() { return Promise.resolve({ error: null }); },
    then(res, rej) {
      (async () => {
        if (f.ins_row) return res(await window.__insert(table, f.ins_row));
        const all = await window.__rows(table);
        let rows = all.filter(r => f.filters.every(([k, v]) => r[k] === v) && f.neq.every(([k, v]) => r[k] !== v) && f.ins.every(([k, vs]) => vs.includes(r[k])) && f.iss.every(([k, v]) => r[k] == v));
        if (f.del) { await window.__deleteRows(table, rows.map(r => r.id ?? r.no)); return res({ data: null, error: null }); }
        if (f.upd) { for (const r of rows) await window.__updateRow(table, r.id ?? r.no, f.upd); return res({ data: rows.map(r => ({ ...r, ...f.upd })), error: null }); }
        if (f.orderKey) rows = rows.slice().sort((a, b) => a[f.orderKey] > b[f.orderKey] ? 1 : -1);
        if (f.lim != null) rows = rows.slice(0, f.lim);
        res({ data: f.single ? (rows[0] || null) : rows, error: null });
      })().catch(rej);
    },
  };
  return api;
}
export function createClient() {
  return {
    from,
    rpc: async (name, args) => {
      if (name === 'ea_opil_claim_team') return { data: ROLE.admin ? null : 'team-1', error: null };
      if (name === 'ea_opil_my_role') return { data: { admin: ROLE.admin, judge: false, facilitator_sessions: [] }, error: null };
      if (name === 'ea_opil_session_facilitator') return { data: 'Casey Dike', error: null };
      return { data: null, error: null };
    },
    channel: (name) => { window.__channels = (window.__channels || []).concat([name]); const c = { on() { return c; }, subscribe() { return c; } }; return c; },
    removeChannel() {},
    auth: { getSession: async () => ({ data: { session: { access_token: 't-' + ROLE.uid, user: { id: ROLE.uid, email: ROLE.uid + '@example.test' } } } }) },
  };
}`;

/* ---------- fake RealtimeKit: enough of the kit for the room to run ---------- */
const stubCore = `
window.RealtimeKitClient = { init: async ({ defaults }) => {
  const on = (o) => (n, f) => { (o[n] = o[n] || []).push(f); }; const emit = (o, n, a) => (o[n] || []).forEach(f => f(a));
  const selfEv = {}, joinedEv = {};
  const self = {
    audioEnabled: !!defaults.audio, videoEnabled: !!defaults.video, screenShareEnabled: false, videoTrack: null, roomJoined: false, isPinned: false,
    customParticipantId: window.__uid, name: window.__uid, permissions: {},
    on: on(selfEv),
    enableAudio: async () => { self.audioEnabled = true; emit(selfEv, 'audioUpdate'); }, disableAudio: async () => { self.audioEnabled = false; emit(selfEv, 'audioUpdate'); },
    enableVideo: async () => { self.videoEnabled = true; emit(selfEv, 'videoUpdate'); }, disableVideo: async () => { self.videoEnabled = false; emit(selfEv, 'videoUpdate'); },
    enableScreenShare: async () => { self.screenShareEnabled = true; }, disableScreenShare: async () => { self.screenShareEnabled = false; },
    unpin: () => { self.isPinned = false; },
  };
  const peers = () => (window.__peers || []).map(p => ({ id: 'p-' + p.uid, customParticipantId: p.uid, name: p.name, isPinned: !!p.pinned, pin: async () => { window.__pins.push(p.uid); p.pinned = true; }, unpin: () => { p.pinned = false; } }));
  const meeting = {
    self, participants: { joined: { toArray: peers, on: on(joinedEv) }, kickAll: async () => { window.__kicked = (window.__kicked || 0) + 1; } },
    connectedMeetings: { on: () => {} }, ai: { transcripts: [], on: () => {} },
    join: async () => { self.roomJoined = true; emit(selfEv, 'roomJoined'); },
    leave: async () => { self.roomJoined = false; emit(selfEv, 'roomLeft', { state: 'left' }); },
    __gone: (st) => { self.roomJoined = false; emit(selfEv, 'roomLeft', { state: st }); },   /* the server took us out: 'kicked' | 'ended' */
  };
  window.__meeting = meeting; window.__pins = window.__pins || [];
  return meeting;
} };`;
const RTK_TAGS = ['rtk-ui-provider', 'rtk-grid', 'rtk-participants-audio', 'rtk-notifications', 'rtk-dialog-manager', 'rtk-chat', 'rtk-participants', 'rtk-polls', 'rtk-breakout-rooms-manager', 'rtk-settings'];
const stubLoader = `export function defineCustomElements() { ${JSON.stringify(RTK_TAGS)}.forEach(t => { if (!customElements.get(t)) customElements.define(t, class extends HTMLElement { set meeting(m) { this._m = m; window.__bound = (window.__bound || []).concat([this.tagName.toLowerCase()]); } get meeting() { return this._m; } }); }); }`;
const stubUi = `export function provideRtkDesignSystem() {}`;
const stubVb = `export default { init: async () => ({ applyBlurBackground: async () => { window.__fx = 'blur'; }, applyVirtualBackground: async (u) => { window.__fx = u; }, removeBackground: async () => { window.__fx = 'none'; } }) };`;
const stubTour = `export function tour() { return false; } export function start() {}`;
const stubV1 = `export async function mountRoom(o) { window.__v1 = { sessionNo: o.sessionNo }; return { meetingId: 'm-v1', leave: async () => {} }; }`;

/* the room-mode page: mounts the module with target { kind:'room' } and records what it reports */
const roomPage = (mode, key, uid) => `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/rtk-room-v2.css"><script src="/js/config.js"></script></head>
<body><div id="rtkMount"></div><script type="module">
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
const { mountRoomV2 } = await import('/js/rtk-room-v2.js?v=t7');
window.__states = []; window.__opened = null; window.__err = null;
try {
  window.__room = await mountRoomV2({
    mountEl: document.getElementById('rtkMount'), cfg: window.BM_CONFIG, token: 't', sb: createClient(), user: { id: ${JSON.stringify(uid)} },
    mode: ${JSON.stringify(mode)}, onState: (s, m, reason) => window.__states.push([s, reason]), onOpened: async (id) => { window.__opened = id; },
    target: { kind: 'room', id: 'room-1', title: 'Taylormade Academy Live', key: ${JSON.stringify(key)} },
  });
} catch (e) { window.__err = { code: e.code, status: e.status, message: e.message }; }
window.__done = true;
</script></body></html>`;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const js = (body) => ({ contentType: 'text/javascript', headers: CORS, body });
const json = (status, obj) => ({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(obj) });

/* ---------- one browser context per person ---------- */
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function person(role, viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'America/Chicago' });
  ctx.on('requestfailed', r => { if (/supabase\.co|cloudflare|jsdelivr|esm\.sh/.test(r.url())) { console.log('LEAK ' + r.url()); process.exitCode = 1; } });
  await ctx.route(/^https:\/\/esm\.sh\/@supabase\/supabase-js@2/, r => r.fulfill(js(stubSupabase(role))));
  await ctx.route(/realtimekit@2\.0\.2\/dist\/browser\.js/, r => r.fulfill(js(`window.__uid = ${JSON.stringify(role.uid)}; window.__peers = ${JSON.stringify(state.peers.filter(p => p.uid !== role.uid))};` + stubCore)));
  await ctx.route(/realtimekit-ui@2\.0\.2\/loader/, r => r.fulfill(js(stubLoader)));
  await ctx.route(/realtimekit-ui@2\.0\.2\/dist\/index\.js/, r => r.fulfill(js(stubUi)));
  await ctx.route(/realtimekit-ui-addons/, r => r.fulfill(js(stubVb)));
  await ctx.route(/\/opil\/hub\/tour\.js/, r => r.fulfill(js(stubTour)));
  await ctx.route(/\/js\/rtk-room\.js/, r => r.fulfill(js(stubV1)));
  if (process.env.R2_MODULE) await ctx.route(/\/js\/rtk-room-v2\.js/, r => r.fulfill(js(readFileSync(process.env.R2_MODULE, 'utf8'))));
  if (process.env.R2_WORDS) await ctx.route(/\/opil\/hub\/live-rooms\.js/, r => r.fulfill(js(readFileSync(process.env.R2_WORDS, 'utf8'))));
  await ctx.route(/\/__t7\/room\.html/, r => { const u = new URL(r.request().url()); r.fulfill({ contentType: 'text/html', body: roomPage(u.searchParams.get('mode'), u.searchParams.get('key') || null, role.uid) }); });
  await ctx.route(FN + '/ea-rtk-join', async r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const b = r.request().postDataJSON(); state.joinCalls.push({ ...b, uid: role.uid });
    if (b.room === true) {   /* the Academy room branch */
      if (state.joinReply) { const rep = state.joinReply; state.joinReply = null; return r.fulfill(json(rep.status, rep.body)); }
      const host = !!role.admin;
      if (!host && !state.room.is_live) return r.fulfill(json(409, { error: 'not_open' }));
      if (host && !state.room.is_live) { state.room.is_live = true; state.room.meeting_id = 'm-room-' + (state.joinCalls.length); }
      return r.fulfill(json(200, host ? { token: 't', meeting_id: state.room.meeting_id, preset: 'tma-class-host', host: true, name: 'Nelson Taylor' } : { token: 't', preset: 'tma-class-guest', host: false, name: role.uid }));
    }
    const s = sess(Number(b.session_no)); let mid = (s.stream_url || '').replace(/^rtk:/, '') || null;
    if (!mid) { if (!role.admin) return r.fulfill(json(409, { error: 'not_open' })); mid = 'm-' + b.session_no; }
    return r.fulfill(json(200, { token: 't', meeting_id: mid, preset: role.admin ? 'opil-host' : 'opil-student', host: !!role.admin, name: role.uid }));
  });
  await ctx.route(FN + '/ea-rtk-record', async r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const b = r.request().postDataJSON(); state.recCalls.push({ ...b, uid: role.uid });
    return r.fulfill(json(200, b.action === 'start' ? { recording_id: 'rec', status: 'invoked' } : { stopped: true }));
  });
  await ctx.route(/fonts\.g|\/sw\.js|supabase\.co\/(rest|auth|realtime)/, r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  await page.exposeFunction('__rows', (t) => t === 'ea_opil_sessions' ? state.sessions : (table(t) || []));
  await page.exposeFunction('__insert', (t, row) => {
    const rows = table(t); if (!rows) return { error: null };
    state.lastInsert = { table: t, row };
    if (rows.some(h => h.user_id === row.user_id && !h.done_at)) return { error: { code: '23505', message: 'dup' } };
    rows.push({ id: 'h' + (rows.length + 1), created_at: new Date(Date.now() + rows.length).toISOString(), staged_at: null, done_at: null, note: null, ...row });
    return { error: null };
  });
  await page.exposeFunction('__updateRow', (t, id, upd) => { const rows = t === 'ea_opil_sessions' ? state.sessions : (table(t) || []); const r = rows.find(x => (x.id ?? x.no) === id); if (r) Object.assign(r, upd); });
  await page.exposeFunction('__deleteRows', (t, ids) => { const rows = table(t); if (rows) rows.splice(0, rows.length, ...rows.filter(h => !ids.includes(h.id))); });
  page.on('pageerror', e => { console.log('PAGE ERROR ' + e.message); process.exitCode = 1; });
  page.on('dialog', async d => { console.log('DIALOG ' + d.message()); process.exitCode = 1; await d.dismiss(); });
  return page;
}

/* ---------- tiny assertion kit: PASS/FAIL lines, never a silent stop ---------- */
const text = async (p, sel) => ((await p.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();
const click = (p, sel) => p.$eval(sel, b => b.click());
const wait = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms });
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const pass = (name) => console.log('PASS ' + name);
const fail = (name, why) => { fails++; process.exitCode = 1; console.log('FAIL ' + name + (why ? ' — ' + why : '')); };
const eq = (name, got, want) => (Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want)) ? pass(name) : fail(name, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
const like = (name, got, rx) => rx.test(got) ? pass(name) : fail(name, 'got ' + JSON.stringify(got) + ', wanted ' + rx);
async function scenario(name, fn) { try { await fn(); } catch (e) { fail(name + ' (scenario aborted)', e.message.split('\n')[0]); } }

/* ============================ Part A — the OPIL page, OPIL defaults ============================ */
const teacher = await person({ uid: 'u-casey', admin: true });
const student = await person({ uid: 'u-jada', admin: false });

await scenario('A1 student waiting', async () => {
  await student.goto(BASE + '/opil/hub/live/?s=2'); await student.waitForSelector('.r2-join');
  eq('A1 kicker', await text(student, '.r2-kicker'), 'You’re in the right place.');
  eq('A1 label = S-label · title', await text(student, '.r2-title'), '02 · Orientation');
  eq('A1 OPIL waiting sentence (startsAt from session_date)', await text(student, '.r2-line'), 'Class hasn’t started yet. You’re all set — it starts at 7:00 PM and you’ll enter on your own.');
  eq('A1 waiting card title + Starts at', await text(student, '.r2-wait b') + ' | ' + await text(student, '.r2-wait span'), 'Orientation | Starts at 7:00 PM');
  eq('A1 waiting card list', await student.$$eval('.r2-wait li', ls => ls.map(l => l.textContent)), ['You’ll enter the class on your own.', 'Your facilitator will know you’re here.', 'You’ll see everyone once it starts.']);
  eq('A1 no Enter button while waiting', await student.$('.r2-enter'), null);
  eq('A1 auto-enter key = session no', await student.evaluate(() => sessionStorage.getItem('r2-auto-enter')), '2');
  /* a session with no date: the other OPIL sentence */
  await student.goto(BASE + '/opil/hub/live/?s=5'); await student.waitForSelector('.r2-join');
  eq('A1 OPIL waiting sentence (no date)', await text(student, '.r2-line'), 'Class hasn’t started yet. You’re all set — you’ll enter on your own when Casey Dike starts it.');
  eq('A1 "Starts when your facilitator opens it"', await text(student, '.r2-wait span'), 'Starts when your facilitator opens it');
  await student.goto(BASE + '/opil/hub/live/?s=2'); await student.waitForSelector('.r2-join');   /* back to waiting on 2, key re-armed */
});

await scenario('A2 staff control + Start class', async () => {
  await teacher.goto(BASE + '/opil/hub/live/?s=2'); await teacher.waitForSelector('#bcSess');
  eq('A2 staff sees the class control', await text(teacher, '#bcClass'), 'Start class — everyone on camera');
  eq('A2 idle card says the room is theirs', await text(teacher, '#idle b'), 'This room is yours.');
  await click(teacher, '#bcClass'); await teacher.waitForSelector('.r2-enter');
  eq('A2 session flipped live with rtk: url', [sess(2).is_live, sess(2).stream_url], [true, 'rtk:m-2']);
  eq('A2 host join body = { session_no } only', state.joinCalls.filter(c => c.uid === 'u-casey').map(({ uid, ...b }) => b), [{ session_no: 2 }]);
  eq('A2 host Enter button', await text(teacher, '.r2-enter'), 'Enter Class →');
  eq('A2 host line', await text(teacher, '.r2-line'), 'Your class is running · 0 students joined');
  eq('A2 host under-text', await text(teacher, '.r2-under'), 'You’ll join with your mic and camera on.');
  like('A2 mic chip in words', await text(teacher, '.r2-chip[data-t="mic"]'), /^Mic is on/);
});

await scenario('A3 host enters', async () => {
  await click(teacher, '.r2-enter'); await teacher.waitForSelector('.r2'); await settle();
  eq('A3 strip: Casey Dike is teaching', await text(teacher, '.r2-nowtxt'), 'Casey Dike is teaching: Orientation');
  eq('A3 recording chip text', await teacher.$eval('.r2-rec', el => el.textContent), 'Recording · saves automatically for your students');
  eq('A3 recording started on joined', state.recCalls.map(c => c.action), ['start']);
  eq('A3 #bcRec shown', await teacher.$eval('#bcRec', el => el.hidden), false);
  eq('A3 panel tabs', await teacher.$$eval('.r2-tab', ts => ts.map(t => t.textContent.replace(/\s+/g, ' ').trim())), ['Questions 0', 'Chat', 'People 1']);
  like('A3 primary: no one in line', await text(teacher, '.r2-primary .r2-cta'), /No one in line/);
  await click(teacher, '.r2-open'); await teacher.waitForSelector('.r2-pane[data-pane="queue"]:not([hidden])');
  eq('A3 empty queue sentence', await text(teacher, '.r2-empty'), 'When a student presses Ask a question, they appear here in order.');
  await click(teacher, '.r2-tab[data-tab="chat"]'); eq('A3 chat tab opens its pane', await teacher.$eval('.r2-pane[data-pane="chat"]', p => p.hidden), false);
  await click(teacher, '.r2-tab[data-tab="people"]'); eq('A3 people tab opens its pane', await teacher.$eval('.r2-pane[data-pane="people"]', p => p.hidden), false);
  eq('A3 kit parts bound to the meeting', await teacher.evaluate(() => [...new Set(window.__bound || [])].sort()), ['rtk-chat', 'rtk-dialog-manager', 'rtk-grid', 'rtk-notifications', 'rtk-participants', 'rtk-participants-audio', 'rtk-ui-provider']);
  eq('A3 hands channel name', await teacher.evaluate(() => (window.__channels || []).filter(c => /^hands/.test(c))), ['hands-2']);
  await click(teacher, '.r2-tools'); await teacher.waitForSelector('.r2-sheet:not([hidden]) .r2-tools');
  eq('A3 tools: share + end wording', await teacher.$$eval('.r2-sheet [data-tool="share"] span, .r2-sheet [data-tool="end"] b', es => es.map(e => e.textContent)), ['Students see your screen instead of the grid', 'End class for everyone']);
  await click(teacher, '.r2-sheet [data-tool="end"]'); like('A3 End class confirm', await text(teacher, '.r2-sheet [data-tool="end"]'), /^End class for everyone\? Tap again/);
  await click(teacher, '.r2-sheet-close');
});

await scenario('A4 student auto-enters after reload', async () => {
  state.peers = [{ uid: 'u-casey', name: 'Casey Dike' }];
  await student.reload(); await student.waitForSelector('.r2', { timeout: 10000 });
  eq('A4 walked straight in, no Enter', await student.$('.r2-enter'), null);
  eq('A4 student join body = { session_no, meeting_id }', state.joinCalls.filter(c => c.uid === 'u-jada').map(({ uid, ...b }) => b), [{ session_no: 2, meeting_id: 'm-2' }]);
  eq('A4 strip says recorded', await text(student, '.r2-nowtxt'), 'Casey Dike is teaching: Orientation · This class is being recorded');
  like('A4 muted in words', await text(student, '.r2-bar .r2-chip[data-t="mic"]'), /^You’re muted/);
  like('A4 camera off in words', await text(student, '.r2-bar .r2-chip[data-t="cam"]'), /^Camera is off/);
  await click(student, '.r2-help'); await student.waitForSelector('.r2-sheet:not([hidden]) [data-h="share"]');
  eq('A4 help: share wording', await text(student, '.r2-sheet [data-h="share"] span'), 'Only if your facilitator asks');
  await click(student, '.r2-sheet-close');
});

await scenario('A5 fresh student sees the join screen', async () => {
  await student.evaluate(() => sessionStorage.clear());
  await student.goto(BASE + '/opil/hub/live/?s=2'); await student.waitForSelector('.r2-enter');
  eq('A5 line', await text(student, '.r2-line'), 'Casey Dike is in the room · 1 student joined');
  eq('A5 Enter button', await text(student, '.r2-enter'), 'Enter Class →');
  eq('A5 under-text', await text(student, '.r2-under'), 'You’ll be muted when you join. You can unmute anytime.');
  await click(student, '.r2-enter'); await student.waitForSelector('.r2');
});

await scenario('A6 Ask a question → Bring on stage', async () => {
  await click(student, '.r2-primary .r2-cta');
  await wait(student, () => /You’re #1 in line/.test(document.querySelector('.r2-primary').textContent));
  eq('A6 insert row is exactly {session_no,user_id,kind}', state.lastInsert, { table: 'ea_opil_hands', row: { session_no: 2, user_id: 'u-jada', kind: 'question' } });
  eq('A6 one open hand', state.opilHands.length, 1);
  await teacher.evaluate(() => { window.__peers = [{ uid: 'u-jada', name: 'Jada Hill' }]; });
  await wait(teacher, () => /Bring Jada Hill on stage/.test(document.querySelector('.r2-primary').textContent), null, 20000);
  like('A6 Questions tab count', await text(teacher, '.r2-tab[data-tab="queue"]'), /^Questions 1/);
  await click(teacher, '.r2-primary .r2-stage-btn');
  await wait(teacher, () => (window.__pins || []).includes('u-jada'));
  await wait(teacher, () => !!document.querySelector('.r2-hand.staged'), null, 20000);
  eq('A6 Bring on stage pins + stages', [await teacher.evaluate(() => window.__pins), !!state.opilHands[0].staged_at], [['u-jada'], true]);
  await click(teacher, '.r2-hand .r2-done');
  await wait(teacher, () => /No one in line/.test(document.querySelector('.r2-primary').textContent), null, 20000);
  eq('A6 Done clears the hand', !!state.opilHands[0].done_at, true);
});

await scenario('A7 Leave', async () => {
  await click(student, '.r2-leave'); like('A7 student confirm label', await text(student, '.r2-leave'), /^Leave class\? Tap again/);
  await click(student, '.r2-leave'); await wait(student, () => !document.querySelector('.r2'));
  eq('A7 student Leave does not end the class', sess(2).is_live, true);
  await click(teacher, '.r2-leave'); like('A7 host confirm label is plain Leave', await text(teacher, '.r2-leave'), /^Leave class\? Tap again/);
  await click(teacher, '.r2-leave');
  await wait(teacher, () => /Class ended/.test(document.getElementById('bcNote').textContent), null, 10000);
  eq('A7 host Leave never kicks in OPIL', await teacher.evaluate(() => window.__kicked || 0), 0);
  eq('A7 host Leave → stop + off air', [sess(2).is_live, state.recCalls.map(c => c.action)], [false, ['start', 'stop']]);
  eq('A7 room class removed from body', await teacher.evaluate(() => document.body.classList.contains('in-room')), false);
});

await scenario('A8 ?classic=1', async () => {
  sess(2).is_live = true; sess(2).stream_url = 'rtk:m-2';
  await student.goto(BASE + '/opil/hub/live/?s=2&classic=1'); await wait(student, () => window.__v1 && window.__v1.sessionNo === 2);
  eq('A8 ?classic=1 mounts v1, not v2', await student.$('.r2-join'), null);
  sess(2).is_live = false; sess(2).stream_url = null;
});

await scenario('A9 OPIL error wording', async () => {
  await student.evaluate(() => sessionStorage.clear());
  sess(2).is_live = true; sess(2).stream_url = 'rtk:m-2';
  const oldPeers = state.peers; state.peers = [];
  const ctxJoin = student.context();
  const refuse = (r) => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill(json(403, { error: 'not_allowed' }));
  await ctxJoin.route(FN + '/ea-rtk-join', refuse);
  await student.goto(BASE + '/opil/hub/live/?s=2'); await wait(student, () => /cohort/.test(document.getElementById('idle').textContent), null, 10000);
  eq('A9 not_allowed reads the OPIL sentence', await text(student, '#idle b'), 'Your account is not in this cohort.');
  await ctxJoin.unroute(FN + '/ea-rtk-join', refuse); state.peers = oldPeers; sess(2).is_live = false; sess(2).stream_url = null;
});

/* ============================ Part B — room mode (target: { kind:'room' }) ============================ */
state.peers = [];   /* nobody is in the Academy room yet */
const nelson = await person({ uid: 'u-nelson', admin: true });
const guest = await person({ uid: 'u-guest', admin: false });
const KEY = state.room.link_key;

await scenario('B1 guest waiting', async () => {
  await guest.goto(BASE + '/__t7/room.html?mode=waiting&key=' + KEY); await guest.waitForSelector('.r2-join');
  eq('B1 title', await text(guest, '.r2-title'), 'Taylormade Academy Live');
  eq('B1 ROOM waiting sentence', await text(guest, '.r2-line'), 'Nelson hasn’t started yet — we’ll bring you in the moment he does.');
  eq('B1 Starts when Nelson opens it', await text(guest, '.r2-wait span'), 'Starts when Nelson opens it');
  eq('B1 list', await guest.$$eval('.r2-wait li', ls => ls.map(l => l.textContent)), ['You’ll enter the session on your own.', 'Nelson will know you’re here.', 'You’ll see everyone once it starts.']);
  eq('B1 auto-enter key = room:<id>', await guest.evaluate(() => sessionStorage.getItem('r2-auto-enter')), 'room:room-1');
  eq('B1 no join call while waiting', state.joinCalls.filter(c => c.uid === 'u-guest').length, 0);
});

await scenario('B2 guest refused', async () => {
  for (const [code, status, want] of [['not_allowed', 403, 'You need Nelson’s link or an Academy membership.'], ['not_open', 409, 'Nelson hasn’t started yet.'], ['bad_link', 404, 'This link isn’t active anymore — ask Nelson for the new one.'], ['room_full', 429, 'The room is full right now.'], ['slow_down', 429, 'Too many tries — wait a minute and try again.']]) {
    state.joinReply = { status, body: { error: code } };
    await guest.goto(BASE + '/__t7/room.html?mode=student&key=' + KEY); await wait(guest, () => window.__done);
    eq('B2 ' + code + ' → ' + status + ' + words', await guest.evaluate(() => window.__err), { code, status, message: want });
  }
});

await scenario('B3 Nelson starts', async () => {
  await nelson.goto(BASE + '/__t7/room.html?mode=host'); await nelson.waitForSelector('.r2-enter');
  eq('B3 host join body = { room:true, key:null }', state.joinCalls.filter(c => c.uid === 'u-nelson').map(({ uid, ...b }) => b), [{ room: true, key: null }]);
  eq('B3 onOpened got the meeting id', await nelson.evaluate(() => window.__opened), state.room.meeting_id);
  eq('B3 Enter button', await text(nelson, '.r2-enter'), 'Enter Session →');
  eq('B3 host line', await text(nelson, '.r2-line'), 'Your session is running · 0 people joined');
  await click(nelson, '.r2-enter'); await nelson.waitForSelector('.r2'); await settle();
  eq('B3 strip: Nelson is live', await text(nelson, '.r2-nowtxt'), 'Nelson is live: Taylormade Academy Live');
  eq('B3 recording chip for members', await nelson.$eval('.r2-rec', el => el.textContent), 'Recording · saves automatically for members');
  eq('B3 onState joined', await nelson.evaluate(() => window.__states), [['joined', undefined]]);
  eq('B3 hands channel', await nelson.evaluate(() => (window.__channels || []).filter(c => /^hands/.test(c))), ['hands-room-room-1']);
  await click(nelson, '.r2-open'); await nelson.waitForSelector('.r2-pane[data-pane="queue"]:not([hidden])');
  eq('B3 empty queue sentence', await text(nelson, '.r2-empty'), 'When a person presses Ask a question, they appear here in order.');
  await click(nelson, '.r2-tools'); await nelson.waitForSelector('.r2-sheet:not([hidden]) .r2-tools');
  eq('B3 tools wording', await nelson.$$eval('.r2-sheet [data-tool="share"] span, .r2-sheet [data-tool="end"] b', es => es.map(e => e.textContent)), ['People see your screen instead of the grid', 'End session for everyone']);
  await click(nelson, '.r2-sheet [data-tool="end"]'); like('B3 End session confirm', await text(nelson, '.r2-sheet [data-tool="end"]'), /^End session for everyone\? Tap again/);
  await click(nelson, '.r2-sheet-close');
});

await scenario('B4 guest enters + asks', async () => {
  state.peers = [{ uid: 'u-nelson', name: 'Nelson Taylor' }];
  /* the guest who was waiting in B1 (key room:room-1 still set) is walked straight in, like an OPIL student */
  await guest.goto(BASE + '/__t7/room.html?mode=student&key=' + KEY); await guest.waitForSelector('.r2', { timeout: 10000 });
  eq('B4 waiting guest auto-enters once Nelson starts', await guest.$('.r2-enter'), null);
  await guest.evaluate(() => sessionStorage.clear());
  /* a guest who opens the link after Nelson started gets the camera-check screen */
  await guest.goto(BASE + '/__t7/room.html?mode=student&key=' + KEY); await guest.waitForSelector('.r2-enter');
  eq('B4 guest join body = { room:true, key }', state.joinCalls.filter(c => c.uid === 'u-guest').slice(-1).map(({ uid, ...b }) => b), [{ room: true, key: KEY }]);
  eq('B4 guest line', await text(guest, '.r2-line'), 'Nelson is in the room · 1 person joined');
  eq('B4 under-text unchanged', await text(guest, '.r2-under'), 'You’ll be muted when you join. You can unmute anytime.');
  await click(guest, '.r2-enter'); await guest.waitForSelector('.r2'); await settle();
  eq('B4 strip says recorded (session)', await text(guest, '.r2-nowtxt'), 'Nelson is live: Taylormade Academy Live · This session is being recorded');
  await click(guest, '.r2-help'); await guest.waitForSelector('.r2-sheet:not([hidden]) [data-h="share"]');
  eq('B4 help wording', await text(guest, '.r2-sheet [data-h="share"] span'), 'Only if Nelson asks');
  await click(guest, '.r2-sheet-close');
  await click(guest, '.r2-primary .r2-cta'); await wait(guest, () => /You’re #1 in line/.test(document.querySelector('.r2-primary').textContent));
  eq('B4 hand lands in ea_room_hands as {room_id,user_id,kind}', state.lastInsert, { table: 'ea_room_hands', row: { room_id: 'room-1', user_id: 'u-guest', kind: 'question' } });
  eq('B4 OPIL hands untouched', state.opilHands.length, 1);
  await nelson.evaluate(() => { window.__peers = [{ uid: 'u-guest', name: 'A Guest' }]; });
  await wait(nelson, () => /Bring A Guest on stage/.test(document.querySelector('.r2-primary').textContent), null, 20000);
  await click(nelson, '.r2-primary .r2-stage-btn'); await wait(nelson, () => (window.__pins || []).includes('u-guest'));
  pass('B4 Bring on stage pins the guest');
  await click(guest, '.r2-leave'); like('B4 guest confirm label', await text(guest, '.r2-leave'), /^Leave session\? Tap again/);
  await click(guest, '.r2-leave'); await wait(guest, () => !document.querySelector('.r2'));
  /* our own Leave reports 'left' twice (the kit's roomLeft, then our own call) — today's behaviour, unchanged */
  eq('B4 guest own Leave → reason left', await guest.evaluate(() => [window.__states.filter(s => s[0] === 'joined').length, window.__states.slice(-1)[0], window.__states.some(s => s[1] === 'kicked' || s[1] === 'ended')]), [1, ['left', 'left'], false]);
});

await scenario('B5 reasons kicked / ended', async () => {
  for (const st of ['kicked', 'ended']) {
    await guest.goto(BASE + '/__t7/room.html?mode=student&key=' + KEY); await guest.waitForSelector('.r2-enter');
    await click(guest, '.r2-enter'); await guest.waitForSelector('.r2');
    await guest.evaluate((s) => window.__meeting.__gone(s), st); await wait(guest, () => !document.querySelector('.r2'));
    eq('B5 roomLeft ' + st + ' → onState(' + (st === 'ended' ? 'ended' : 'left') + ', m, ' + st + ')', await guest.evaluate(() => window.__states.slice(-1)[0]), [st === 'ended' ? 'ended' : 'left', st]);
  }
});

await scenario('B6 Nelson Leave = end for everyone', async () => {
  await click(nelson, '.r2-leave'); like('B6 confirm label', await text(nelson, '.r2-leave'), /^End the session for everyone\? Tap again/);
  await click(nelson, '.r2-leave'); await wait(nelson, () => !document.querySelector('.r2'));
  eq('B6 kickAll then leave', await nelson.evaluate(() => [window.__kicked, window.__meeting.self.roomJoined]), [1, false]);
  eq('B6 onState left/left', await nelson.evaluate(() => window.__states.slice(-1)[0]), ['left', 'left']);
  eq('B6 return shape', await nelson.evaluate(() => [window.__room.meetingId, window.__room.host, typeof window.__room.leave, typeof window.__room.setRecording]), [state.room.meeting_id, true, 'function', 'function']);
});

await browser.close(); server.kill();
console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
```

- [ ] **Step 3: Run the harness RED, against today's module (Task 1 already merged, this task not started).**

```bash
cd /Users/nelsontaylor/taylormade-academy && node /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-v2.mjs; echo "exit=$?"
```

Expected (takes about two minutes; two 15-second queue polls are waited on): 52 `PASS A…` lines — every OPIL check already passes on today's module, which is the baseline this task must keep — then exactly these ten FAIL lines and `FAILED 10`, `exit=1`:

```
FAIL B1 guest waiting (scenario aborted) — page.waitForSelector: Timeout 30000ms exceeded.
FAIL B2 not_allowed → 403 + words — got {"message":"Cannot read properties of undefined (reading 'no')"}, wanted {"code":"not_allowed","status":403,"message":"You need Nelson’s link or an Academy membership."}
FAIL B2 not_open → 409 + words — got {"message":"Cannot read properties of undefined (reading 'no')"}, wanted {"code":"not_open","status":409,"message":"Nelson hasn’t started yet."}
FAIL B2 bad_link → 404 + words — got {"message":"Cannot read properties of undefined (reading 'no')"}, wanted {"code":"bad_link","status":404,"message":"This link isn’t active anymore — ask Nelson for the new one."}
FAIL B2 room_full → 429 + words — got {"message":"Cannot read properties of undefined (reading 'no')"}, wanted {"code":"room_full","status":429,"message":"The room is full right now."}
FAIL B2 slow_down → 429 + words — got {"message":"Cannot read properties of undefined (reading 'no')"}, wanted {"code":"slow_down","status":429,"message":"Too many tries — wait a minute and try again."}
FAIL B3 Nelson starts (scenario aborted) — page.waitForSelector: Timeout 30000ms exceeded.
FAIL B4 guest enters + asks (scenario aborted) — page.waitForSelector: Timeout 10000ms exceeded.
FAIL B5 reasons kicked / ended (scenario aborted) — page.waitForSelector: Timeout 30000ms exceeded.
FAIL B6 Nelson Leave = end for everyone (scenario aborted) — page.$eval: Failed to find element matching selector ".r2-leave"
FAILED 10
```

(`reading 'no'`: today's line 92 reads `session.no` and the room page passes no `session`.) If any `PASS A…` line is a FAIL or a `LEAK`/`PAGE ERROR` prints, stop — the harness or Task 1 is wrong, not this task.

- [ ] **Step 4: Edit 1 — the static import becomes a module-level `let copy` (line 10).**

Old (line 10):
```js
import { stateCopy, nowCopy, queueOrder, queuePosition, nextInLine, joinCopy, sessLabel } from '/opil/hub/live-rooms.js';
```
New:
```js
/* The words and the queue helpers live in OPIL's live-rooms.js. They are imported when a room
   mounts, on this module's own ?v= (the pattern opil/hub/hub.js uses for tour.js), so they ride
   its cache stamp and never need a service-worker bump of their own. */
let copy = null;
```
Why a module-level variable and not a `const` inside `mountRoomV2`: `joinScreen`, `wireChips` and `classRoom` are module-level functions that call `joinCopy`/`stateCopy`/`nowCopy`/`queueOrder`/`queuePosition`/`nextInLine`; `copy` is set once at the top of `mountRoomV2` (Step 6) before any of them can run, and every use below becomes `copy.<name>`.

- [ ] **Step 5: Edit 2 — `joinTarget(cfg, token, joinBody, words)` (lines 36–55).**

Old (lines 36–55):
```js
/* Ask the server for a token. It decides the role; the page never names a preset. */
async function joinTarget(cfg, token, sessionNo, meetingId) {
  const r = await fetch(cfg.FUNCTIONS_BASE + '/ea-rtk-join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(meetingId ? { session_no: sessionNo, meeting_id: meetingId } : { session_no: sessionNo }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error({
      sign_in: 'Sign in again and retry.',
      not_allowed: 'Your account is not in this cohort.',
      not_open: 'The room opens when your facilitator starts the class.',
      not_found: 'That session no longer exists.',
      rtk_not_configured: 'The class room is not set up yet.',
    }[d.error] || ('The server said ' + r.status + '.'));
    e.code = d.error; e.status = r.status; throw e;
  }
  return d;
}
```
New:
```js
/* Ask the server for a token. It decides the role; the page never names a preset.
   joinBody is { session_no, meeting_id? } for an OPIL class or { room: true, key } for the Academy room. */
async function joinTarget(cfg, token, joinBody, words) {
  const r = await fetch(cfg.FUNCTIONS_BASE + '/ea-rtk-join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(joinBody),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error({
      sign_in: 'Sign in again and retry.',
      not_allowed: words.notAllowed,
      not_open: words.notOpen,
      not_found: 'That session no longer exists.',
      bad_link: 'This link isn’t active anymore — ask Nelson for the new one.',
      room_full: 'The room is full right now.',
      slow_down: 'Too many tries — wait a minute and try again.',
      rtk_not_configured: 'The class room is not set up yet.',
    }[d.error] || ('The server said ' + r.status + '.'));
    e.code = d.error; e.status = r.status; throw e;
  }
  return d;
}
```
`OPIL_WORDS.notAllowed` / `.notOpen` are today's two sentences verbatim (harness A9 proves `not_allowed`). `rtk_not_configured` and `not_found` stay constant: on `/room/`, Task 8 re-words every code through `joinErrorText(e.code, e.status, words)`, so only the OPIL page ever shows these two.

- [ ] **Step 6: Edit 3 — the target block at the top of `mountRoomV2` (lines 89–92).**

Old (lines 89–92):
```js
   Returns { meetingId, leave(), setRecording(bool) }. onState gets 'joined' | 'left' | 'ended'. */
export async function mountRoomV2(o) {
  const { mountEl, cfg, token, sb, user, session, mode, facilitator, onState, onOpened } = o;
  const no = session.no, title = sessLabel(session) + ' · ' + session.title;
```
New:
```js
   Returns { meetingId, leave(), setRecording(bool) }. onState gets ('joined' | 'left' | 'ended', meeting, reason)
   where reason is 'left' | 'kicked' | 'ended' — why the room went away.
   o.target says where the room lives: { kind:'opil', session } (the default, today's OPIL behaviour byte
   for byte) or { kind:'room', id, title, key } (the Academy room, spec 2026-09-14-academy-room-design.md). */
export async function mountRoomV2(o) {
  copy = await import('/opil/hub/live-rooms.js' + new URL(import.meta.url).search);
  const { mountEl, cfg, token, sb, user, mode, onState, onOpened } = o;
  const target = o.target || { kind: 'opil', session: o.session };
  /* derived once; nothing below reads target.session again */
  const isRoom = target.kind === 'room';
  const session = isRoom ? null : target.session;
  const words = isRoom ? copy.ROOM_WORDS : copy.OPIL_WORDS;
  const label = isRoom ? target.title : copy.sessLabel(session) + ' · ' + session.title;
  const title = isRoom ? target.title : session.title;
  const startsAt = isRoom ? null : (session.session_date ? new Date(session.session_date + 'T19:00:00').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);
  const autoKey = isRoom ? 'room:' + target.id : String(session.no);
  const hands = isRoom
    ? { table: 'ea_room_hands', col: 'room_id', val: target.id, chan: 'hands-room-' + target.id }
    : { table: 'ea_opil_hands', col: 'session_no', val: session.no, chan: 'hands-' + session.no };
  /* OPIL keeps sending meeting_id; the server ignores it now and uses the session's stored one */
  const joinBody = isRoom ? { room: true, key: target.key || null } : (o.meetingId ? { session_no: session.no, meeting_id: o.meetingId } : { session_no: session.no });
  const facilitator = o.facilitator ?? (isRoom ? words.host : null);
```
Two names in this block map onto the spine's: the spine's `label` is the `<h2>` / transcript name (`'02 · Orientation'` or the room title) and `title` is the short one (`session.title` / `target.title`) used by the strip and the waiting card; today's single `title` variable was the long one, so it is renamed `label` where it flows (Steps 7 and 8). `facilitator` keeps `o.facilitator` for OPIL (the page passes the rpc result, `null` when none); `??` means a room page that passes nothing gets `'Nelson'`.

- [ ] **Step 7: Edit 4 — the call sites inside `mountRoomV2` (lines 99–100, 105, 147–148, 154, 194, 204, 218–222).**

Old (lines 99–100):
```js
    mountEl.appendChild(joinScreen({ title, session, live: false, host: false, facilitator, joined: 0, preview: false }));
    try { sessionStorage.setItem(AUTO_KEY, String(no)); } catch (e) {}   /* when the page reloads live, walk straight in */
```
New:
```js
    mountEl.appendChild(joinScreen({ label, title, startsAt, live: false, host: false, facilitator, joined: 0, preview: false, words }));
    try { sessionStorage.setItem(AUTO_KEY, autoKey); } catch (e) {}   /* when the page reloads live, walk straight in */
```

Old (line 105):
```js
  const join = await joinTarget(cfg, token, no, o.meetingId || null);
```
New:
```js
  const join = await joinTarget(cfg, token, joinBody, words);
```

Old (lines 147–148):
```js
    a.href = URL.createObjectURL(new Blob([title + '\n' + new Date().toLocaleString() + '\n\n' + body + '\n'], { type: 'text/plain' }));
    a.download = (title.replace(/[^\w\- ]+/g, '').trim() || 'transcript') + ' transcript.txt';
```
New:
```js
    a.href = URL.createObjectURL(new Blob([label + '\n' + new Date().toLocaleString() + '\n\n' + body + '\n'], { type: 'text/plain' }));
    a.download = (label.replace(/[^\w\- ]+/g, '').trim() || 'transcript') + ' transcript.txt';
```

Old (line 154):
```js
  const screen = joinScreen({ title, session, live: true, host, facilitator, joined: joinedCount(), preview: true });
```
New:
```js
  const screen = joinScreen({ label, title, startsAt, live: true, host, facilitator, joined: joinedCount(), preview: true, words });
```

Old (line 194):
```js
  try { autoEnter = sessionStorage.getItem(AUTO_KEY) === String(no); sessionStorage.removeItem(AUTO_KEY); } catch (e) {}
```
New:
```js
  try { autoEnter = sessionStorage.getItem(AUTO_KEY) === autoKey; sessionStorage.removeItem(AUTO_KEY); } catch (e) {}
```

Old (line 204):
```js
  const room = classRoom({ meeting, ui, host, title, session, facilitator, sb, user, saveTranscript, getEffects: () => effects, onLeave: leaveNow, onSwitch: (m) => { current = m; } });
```
New:
```js
  const room = classRoom({ meeting, ui, host, isRoom, title, hands, words, facilitator, sb, user, saveTranscript, getEffects: () => effects, onLeave: leaveNow, onSwitch: (m) => { current = m; } });
```

Old (lines 218–222):
```js
  const gone = (why) => () => { if (switching) return; room.destroy(); document.body.classList.remove('in-room', 'in-room-v2'); mountEl.innerHTML = ''; if (onState) onState(why, current); };
  /* roomLeft carries why: 'left' (we pressed Leave), 'ended' (the host ended it), 'kicked' */
  try { meeting.self.on('roomLeft', (ev) => gone(ev && ev.state === 'ended' ? 'ended' : 'left')()); } catch (e) {}

  async function leaveNow() { try { await current.leave(); } catch (e) {} gone('left')(); }
```
New:
```js
  const gone = (why, reason) => () => { if (switching) return; room.destroy(); document.body.classList.remove('in-room', 'in-room-v2'); mountEl.innerHTML = ''; if (onState) onState(why, current, reason); };
  /* roomLeft carries why: 'left' (we pressed Leave), 'ended' (the host ended it), 'kicked' (removed).
     The first onState argument keeps its two values; the third says which of the three it was. */
  try { meeting.self.on('roomLeft', (ev) => { const st = ev && ev.state; gone(st === 'ended' ? 'ended' : 'left', st === 'kicked' || st === 'ended' ? st : 'left')(); }); } catch (e) {}

  /* In the Academy room there is one host, so Nelson leaving IS the end: everyone else is removed
     first (what "End class for everyone" does in the Tools sheet), then he leaves. OPIL keeps plain Leave. */
  async function leaveNow() {
    if (isRoom && host) { try { await current.participants.kickAll?.(); } catch (e) {} }
    try { await current.leave(); } catch (e) {}
    gone('left', 'left')();
  }
```
Line 207 (`if (onState) onState('joined', meeting);`) is unchanged — `reason` is `undefined` on 'joined'.

- [ ] **Step 8: Edit 5 — `joinScreen` (lines 232–235, 240, 248–249).**

Old (lines 232–235):
```js
function joinScreen({ title, session, live, host, facilitator, joined, preview }) {
  const when = session.session_date ? new Date(session.session_date + 'T19:00:00').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  const line = joinCopy({ live, host, facilitator, joined, startsAt: live ? null : when });
  const cta = !live && !host ? '' : `<button type="button" class="r2-enter">${host && !live ? 'Start class →' : 'Enter Class →'}</button>
```
New:
```js
function joinScreen({ label, title, startsAt, live, host, facilitator, joined, preview, words }) {
  const line = copy.joinCopy({ live, host, facilitator, joined, startsAt: live ? null : startsAt }, words);
  const cta = !live && !host ? '' : `<button type="button" class="r2-enter">${host && !live ? 'Start ' + esc(words.thing) + ' →' : 'Enter ' + esc(copy.capFirst(words.thing)) + ' →'}</button>
```
(Line 236, `You’ll join with your mic and camera on.` / `You’ll be muted when you join. You can unmute anytime.`, is unchanged.)

Old (line 240):
```js
      <h2 class="r2-title">${esc(title)}</h2>
```
New:
```js
      <h2 class="r2-title">${esc(label)}</h2>
```

Old (lines 248–249):
```js
        </div></div>` : `<div class="r2-wait"><b>${esc(session.title)}</b><span>${when ? 'Starts at ' + esc(when) : 'Starts when your facilitator opens it'}</span>
        <ol><li>You’ll enter the class on your own.</li><li>Your facilitator will know you’re here.</li><li>You’ll see everyone once it starts.</li></ol></div>`}
```
New:
```js
        </div></div>` : `<div class="r2-wait"><b>${esc(title)}</b><span>${startsAt ? 'Starts at ' + esc(startsAt) : 'Starts when ' + esc(words.host) + ' opens it'}</span>
        <ol><li>You’ll enter the ${esc(words.thing)} on your own.</li><li>${esc(copy.capFirst(words.host))} will know you’re here.</li><li>You’ll see everyone once it starts.</li></ol></div>`}
```
One string beyond the spine's list is threaded here: `You’ll enter the class on your own.` → `'You’ll enter the ' + words.thing + ' on your own.'` (OPIL default proven by harness A1 `waiting card list`; a guest reads `session`). OPIL results: `Start class →` / `Enter Class →` / `Starts when your facilitator opens it` / `Your facilitator will know you’re here.` — byte-identical (A1, A2, A5).

- [ ] **Step 9: Edit 6 — `wireChips` and `classRoom` (lines 260, 270–272, 317, 353, 356, 360, 366, 370–372, 376–379, 384, 389–390, 396, 419, 425, 435, 443, 459).**

Old (line 260):
```js
    const c = stateCopy({ audio: !!s.audioEnabled, video: !!s.videoEnabled });
```
New:
```js
    const c = copy.stateCopy({ audio: !!s.audioEnabled, video: !!s.videoEnabled });
```

Old (lines 270–272):
```js
function classRoom({ meeting, ui, host, title, session, facilitator, sb, user, saveTranscript, getEffects, onLeave, onSwitch }) {
  const node = el(`<div class="r2">
    <div class="r2-now"><span class="r2-dot"></span><span class="r2-nowtxt"></span><span class="r2-rec" hidden>Recording · saves automatically for your students</span></div>
```
New (`hands` is renamed `handsAt` on the way in because `classRoom` already has `let hands = []` for the rows at line 347):
```js
function classRoom({ meeting, ui, host, isRoom, title, hands: handsAt, words, facilitator, sb, user, saveTranscript, getEffects, onLeave, onSwitch }) {
  const node = el(`<div class="r2">
    <div class="r2-now"><span class="r2-dot"></span><span class="r2-nowtxt"></span><span class="r2-rec" hidden>Recording · saves automatically for ${esc(words.replayFor)}</span></div>
```

Old (line 317):
```js
  const setNow = () => { q('.r2-nowtxt').textContent = nowCopy({ facilitator, title: session.title, recording: false }); q('.r2-rec').hidden = !recording || !host; if (recording && !host) q('.r2-nowtxt').textContent += ' · This class is being recorded'; };
```
New:
```js
  const setNow = () => { q('.r2-nowtxt').textContent = copy.nowCopy({ facilitator, title, recording: false }, words); q('.r2-rec').hidden = !recording || !host; if (recording && !host) q('.r2-nowtxt').textContent += ' · This ' + words.thing + ' is being recorded'; };
```

Old (line 353):
```js
      const next = nextInLine(hands);
```
New:
```js
      const next = copy.nextInLine(hands);
```

Old (line 356):
```js
        ? `<button type="button" class="r2-cta r2-stage-btn"><b>Bring ${esc(nm)} on stage</b><span>${queueOrder(hands).length} in line</span></button>`
```
New:
```js
        ? `<button type="button" class="r2-cta r2-stage-btn"><b>Bring ${esc(nm)} on stage</b><span>${copy.queueOrder(hands).length} in line</span></button>`
```

Old (line 360):
```js
      const pos = queuePosition(hands, uid);
```
New:
```js
      const pos = copy.queuePosition(hands, uid);
```

Old (line 366):
```js
    const em = q('.r2-tab[data-tab="queue"] em'); if (em) em.textContent = queueOrder(hands).length;
```
New:
```js
    const em = q('.r2-tab[data-tab="queue"] em'); if (em) em.textContent = copy.queueOrder(hands).length;
```

Old (lines 370–372):
```js
    const rows = queueOrder(hands);
    box.innerHTML = rows.length ? rows.map((r, i) => `<div class="r2-hand${r.staged_at ? ' staged' : ''}"><span class="r2-n">${i + 1}</span><div class="r2-who"><b>${esc(nameOf(r.user_id) || 'Student')}</b><span>${r.kind === 'comment' ? 'Would like to comment' : 'Has a question'}${r.staged_at ? ' · on stage' : ''}</span></div><button type="button" class="r2-mini r2-bring" data-id="${r.id}">Bring on stage</button><button type="button" class="r2-mini r2-done" data-id="${r.id}">Done</button></div>`).join('')
      : '<div class="r2-empty">When a student presses Ask a question, they appear here in order.</div>';
```
New:
```js
    const rows = copy.queueOrder(hands);
    box.innerHTML = rows.length ? rows.map((r, i) => `<div class="r2-hand${r.staged_at ? ' staged' : ''}"><span class="r2-n">${i + 1}</span><div class="r2-who"><b>${esc(nameOf(r.user_id) || copy.capFirst(words.one))}</b><span>${r.kind === 'comment' ? 'Would like to comment' : 'Has a question'}${r.staged_at ? ' · on stage' : ''}</span></div><button type="button" class="r2-mini r2-bring" data-id="${r.id}">Bring on stage</button><button type="button" class="r2-mini r2-done" data-id="${r.id}">Done</button></div>`).join('')
      : '<div class="r2-empty">When a ' + esc(words.one) + ' presses Ask a question, they appear here in order.</div>';
```

Old (lines 376–379):
```js
  const loadHands = async () => { const { data } = await sb.from('ea_opil_hands').select('*').eq('session_no', session.no).is('done_at', null).order('created_at'); hands = data || []; renderPrimary(); renderQueue(); };
  async function askQuestion() { const { error } = await sb.from('ea_opil_hands').insert({ session_no: session.no, user_id: uid, kind: 'question' }); if (error && error.code !== '23505') toast('Could not raise your hand — ' + error.message); await loadHands(); }
  async function leaveLine() { await sb.from('ea_opil_hands').delete().eq('session_no', session.no).eq('user_id', uid).is('done_at', null); await loadHands(); }
  async function markDone(h) { if (!h) return; await sb.from('ea_opil_hands').update({ done_at: new Date().toISOString() }).eq('id', h.id); if (pinnedId === h.user_id) { unpin(); } await loadHands(); }
```
New:
```js
  const loadHands = async () => { const { data } = await sb.from(handsAt.table).select('*').eq(handsAt.col, handsAt.val).is('done_at', null).order('created_at'); hands = data || []; renderPrimary(); renderQueue(); };
  async function askQuestion() { const { error } = await sb.from(handsAt.table).insert({ [handsAt.col]: handsAt.val, user_id: uid, kind: 'question' }); if (error && error.code !== '23505') toast('Could not raise your hand — ' + error.message); await loadHands(); }
  async function leaveLine() { await sb.from(handsAt.table).delete().eq(handsAt.col, handsAt.val).eq('user_id', uid).is('done_at', null); await loadHands(); }
  async function markDone(h) { if (!h) return; await sb.from(handsAt.table).update({ done_at: new Date().toISOString() }).eq('id', h.id); if (pinnedId === h.user_id) { unpin(); } await loadHands(); }
```
The insert stays exactly three columns — `{ session_no, user_id, kind }` for OPIL (harness A6) and `{ room_id, user_id, kind }` for the room (B4) — which is all the 0036 column grants allow.

Old (line 384):
```js
      if (!p) { toast((nameOf(h.user_id) || 'That student') + ' isn’t in the room right now.'); return; }
```
New:
```js
      if (!p) { toast((nameOf(h.user_id) || 'That ' + words.one) + ' isn’t in the room right now.'); return; }
```

Old (lines 389–390):
```js
      const prev = hands.find(x => x.staged_at && x.id !== h.id); if (prev) await sb.from('ea_opil_hands').update({ done_at: new Date().toISOString() }).eq('id', prev.id);
      await sb.from('ea_opil_hands').update({ staged_at: new Date().toISOString() }).eq('id', h.id);
```
New:
```js
      const prev = hands.find(x => x.staged_at && x.id !== h.id); if (prev) await sb.from(handsAt.table).update({ done_at: new Date().toISOString() }).eq('id', prev.id);
      await sb.from(handsAt.table).update({ staged_at: new Date().toISOString() }).eq('id', h.id);
```

Old (line 396):
```js
  const watchHands = () => { try { handsChan = sb.channel('hands-' + session.no).on('postgres_changes', { event: '*', schema: 'public', table: 'ea_opil_hands', filter: 'session_no=eq.' + session.no }, loadHands).subscribe(); } catch (e) {} setInterval(loadHands, 15000); };
```
New:
```js
  const watchHands = () => { try { handsChan = sb.channel(handsAt.chan).on('postgres_changes', { event: '*', schema: 'public', table: handsAt.table, filter: handsAt.col + '=eq.' + handsAt.val }, loadHands).subscribe(); } catch (e) {} setInterval(loadHands, 15000); };
```

Old (line 419):
```js
      <button type="button" class="r2-btn" data-tool="share"><b>Share my screen</b><span>Students see your screen instead of the grid</span></button>
```
New:
```js
      <button type="button" class="r2-btn" data-tool="share"><b>Share my screen</b><span>${esc(copy.capFirst(words.many))} see your screen instead of the grid</span></button>
```

Old (line 425):
```js
      <button type="button" class="r2-btn danger" data-tool="end"><b>End class for everyone</b><span>Closes the room and stops the recording</span></button>
```
New:
```js
      <button type="button" class="r2-btn danger" data-tool="end"><b>End ${esc(words.thing)} for everyone</b><span>Closes the room and stops the recording</span></button>
```

Old (line 435):
```js
      else if (t === 'end') { if (confirmInline(b, 'End class for everyone?')) { try { if (m.participants.kickAll) await m.participants.kickAll(); } catch (e) {} await onLeave(); } }
```
New:
```js
      else if (t === 'end') { if (confirmInline(b, 'End ' + words.thing + ' for everyone?')) { try { if (m.participants.kickAll) await m.participants.kickAll(); } catch (e) {} await onLeave(); } }
```

Old (line 443):
```js
      <button type="button" class="r2-btn" data-h="share"><b>Share my screen</b><span>Only if your facilitator asks</span></button>
```
New:
```js
      <button type="button" class="r2-btn" data-h="share"><b>Share my screen</b><span>Only if ${esc(words.host)} asks</span></button>
```

Old (line 459):
```js
  leaveBtn.addEventListener('click', async () => { if (confirmInline(leaveBtn, 'Leave class?')) await onLeave(); });
```
New:
```js
  leaveBtn.addEventListener('click', async () => { if (confirmInline(leaveBtn, isRoom && host ? 'End the session for everyone?' : 'Leave ' + words.thing + '?')) await onLeave(); });
```

- [ ] **Step 10: Static checks — syntax, no stray `session.`/bare-helper reads, the 18 OPIL node tests.**

```bash
cd /Users/nelsontaylor/taylormade-academy && node --check js/rtk-room-v2.js && echo SYNTAX OK && grep -n "session\.\|sessLabel\|'ea_opil_hands'\|String(no)\|[^.]stateCopy(\|[^.]nowCopy(\|[^.]joinCopy(\|[^.]queueOrder(\|[^.]queuePosition(\|[^.]nextInLine(" js/rtk-room-v2.js | grep -v 'copy\.' ; git diff --stat && node --test tests/opil/*.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

Expected: `SYNTAX OK`; the grep prints exactly five lines, all inside the derived block (today's numbering shifted by +17: `title = … session.title`, `startsAt = … session.session_date …`, `autoKey = … String(session.no)`, the `: { table: 'ea_opil_hands', … session.no … }` line, and `joinBody = …`), nothing else; `git diff --stat` shows ` js/rtk-room-v2.js | 135 +++++++++++++++++++++++++++---------` (one file, 511 lines after); then

```
ℹ tests 18
ℹ pass 18
ℹ fail 0
```

(The node tests never import this module — they prove Task 1's words; the harness is this task's test.)

- [ ] **Step 11: Run the harness GREEN — the Wednesday gate.**

```bash
cd /Users/nelsontaylor/taylormade-academy && node /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-v2.mjs | tee /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-v2.last.txt; echo "exit=${pipestatus[1]}"; grep -c '^PASS' /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-v2.last.txt
```

Expected: 91 `PASS` lines (52 Part A, the same 52 that passed in Step 3 — this is the proof OPIL is byte-identical: every string, the `{session_no}` / `{session_no, meeting_id}` join bodies, `ea_opil_hands` + `hands-2`, plain `Leave class?` for the host with `kickAll` never called, `?classic=1` still v1 — plus 39 Part B), no `FAIL`, no `LEAK`, no `PAGE ERROR`, last line `ALL PASS`, `exit=0`, count `91`. The Part B lines to look for by name: `B1 ROOM waiting sentence`, `B2 not_allowed → 403 + words` … `B2 slow_down → 429 + words`, `B3 host join body = { room:true, key:null }`, `B3 Enter button` (`Enter Session →`), `B3 strip: Nelson is live`, `B3 hands channel` (`hands-room-room-1`), `B4 waiting guest auto-enters once Nelson starts`, `B4 hand lands in ea_room_hands as {room_id,user_id,kind}`, `B4 Bring on stage pins the guest`, `B5 roomLeft kicked → onState(left, m, kicked)`, `B5 roomLeft ended → onState(ended, m, ended)`, `B6 confirm label` (`End the session for everyone? Tap again`), `B6 kickAll then leave`. Any FAIL: fix the module (never the assertion) and rerun; do not go to Step 12 until this prints `ALL PASS`. Keep `room-v2.last.txt` — the rollout task (Task 10) cites it before pushing.

- [ ] **Step 12: Commit the module only (no build, no push).**

```bash
cd /Users/nelsontaylor/taylormade-academy && git add js/rtk-room-v2.js && git commit -m "feat(academy): room v2 takes a target — Academy room words, Leave = end for everyone, onState reason

mountRoomV2(o) gains o.target ({ kind:'opil', session } by default, { kind:'room', id, title, key } for /room/).
Words come from live-rooms.js (OPIL_WORDS / ROOM_WORDS), imported at mount on the module's own ?v=,
so the OPIL room reads byte for byte as before (harness: 52 OPIL checks + 18 node tests green).
Room mode only: hands in ea_room_hands, join body { room:true, key }, Nelson's Leave kicks everyone
then leaves ('End the session for everyone?'), onState(state, meeting, reason) with reason
left | kicked | ended. ?v= restamp + sw.js bump come with the /live/ rewrite.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" && git log --oneline -1 && git status --short
```

Expected: one commit on `domain-migration` whose subject starts `feat(academy): room v2 takes a target`, and `git status --short` shows nothing for `js/`, `opil/`, `build_site.py` or `sw.js` (the harness lives in the scratchpad and is not tracked). Task 8 builds `/room/` on this exact `mountRoomV2` contract; Task 9 restamps `opil/hub/live/index.html`'s `?v=` and bumps `sw.js` so existing OPIL visitors pick the new module up.

---

### Task 8: `/room/index.html` — the room page for everyone

**Files:**
- Create: `/Users/nelsontaylor/taylormade-academy/room/index.html`
- Modify: `/Users/nelsontaylor/taylormade-academy/build_site.py:233-236` (`HUB_PAGES` gains `"room"`; the hash list at lines 15-19 and `_ASSET_RX` at line 215 are **Task 9's** edit — do not touch them here)
- Test: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-page.mjs` (Playwright, 21 checks, PASS/FAIL lines, exit 1 on any FAIL); OPIL guard `tests/opil/*.test.mjs` (untouched, 18 tests)

**Interfaces:**
- Consumes (Task 1, `/js/room-page.js`): `roomKey(search)`, `roomBranch(state)` → `'error'|'dead_link'|'landing'|'host_live'|'host_idle'|'not_allowed'|'student'|'waiting'`, `loginHref(k)`, `joinErrorText(code, status, words)`. (Task 1, `/opil/hub/live-rooms.js`): `ROOM_WORDS` (`notAllowed`, `notOpen`, `waiting`, `host: 'Nelson'`, `thing: 'session'`).
- Consumes (Task 7, `/js/rtk-room-v2.js`): `mountRoomV2({ mountEl, cfg, token, sb, user, mode:'waiting'|'student'|'host', target:{ kind:'room', id, title, key }, onState(state, meeting, reason), onOpened(meetingId) })` → `{ meetingId, host, leave(), setRecording(bool) }`; `onState` states `'joined'|'left'|'ended'`, `reason ∈ 'left'|'kicked'|'ended'`; waiting mode stores the auto-enter key `'room:' + id` in `sessionStorage`; a host's Leave in room mode = `kickAll` + `leave`.
- Consumes (Task 2): `rpc('ea_room_state', { p_key })` → `{ id, title, is_live, host_name, signed_in, is_host, can_join, bad_link:false, recording_url, people }` or `{ bad_link:true }`; `ea_rooms` admin select `link_key,title` and the admin update grant on `is_live, live_since, ended_at`. (Tasks 3/4/5): `ea-rtk-join` body `{ room:true, key }`; `ea-rtk-record` body `{ room:true, action:'start'|'stop' }` (stop → `{ stopped }`); error codes `sign_in not_allowed bad_link not_open room_full slow_down no_room not_host rtk_not_configured cloudflare_<n>`.
- Produces: the page at `/room/` with ids `#card #roomCtl #rtkMount #rTitle #rLink #rCopy #rStart #rEnd #rNote #rRec` (+ `#signIn` on the landing card, `#rejoin` on the left card) and the rule `body.in-room .room-ctl, body.in-room .site-header, body.in-room #card { display:none }`; `build_site.HUB_PAGES` contains `"room"` (Task 9's `python3 build_site.py` then stamps the page's `?v=`; Task 9 also adds `js/room-page.js` to the hash list + `_ASSET_RX` so that one link gets stamped too); Task 9's **Open your room →** on `/live/` links to `/room/` with no key.

Order matters: Tasks 1 and 7 must be on the branch first — the harness drives the **real** `js/rtk-room-v2.js` (only the Cloudflare kit and supabase-js are faked), and the page imports Task 1's module. Tasks 2-6 (database, functions) are not needed to run this task: every server call is stubbed.

Review notes folded in (each verified against the repo on 9/14): (1) `node --test` on this machine (node v25.8.2) uses the `spec` reporter even when piped, so `grep "^# pass"` matched nothing — every OPIL guard here passes `--test-reporter=tap` (prints `# pass 18` / `# fail 0`). (2) The draft's reload marker was set by an init script, which re-runs on every reload, so "no reload while hosting" could never fail — the marker is now set once with `page.evaluate` after the first load, and the two guest reloads assert it came back `undefined`. (3) FAIL lines print only the first line of Playwright's message (the `Call log:` lines are dropped), and the `host_live: join refused` test waits for `#rNote` before its `waitForFunction`, so a missing page fails every check the same way. (4) The shell is zsh: `${PIPESTATUS[0]}` is empty there, so the harness commands read `$?` directly (the harness writes nothing to stderr); the build_site check runs with `PYTHONDONTWRITEBYTECODE=1` so the tracked `__pycache__/build_site.cpython-314.pyc` is never rewritten, and `git status --short -uno` hides the untracked plan document.

- [ ] **Step 1: Playwright is in the scratchpad (one-time)**

```bash
cd /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad && ls node_modules/playwright/package.json >/dev/null 2>&1 || npm i playwright@1.47.2
node -e "console.log(require('playwright/package.json').version)"
mkdir -p harness
```
Expected: `1.47.2`. System Chrome is used (`channel: 'chrome'`), nothing is downloaded. (It is already installed from Task 7's harness; the `ls ||` guard makes this a no-op then.)

- [ ] **Step 2: Write the harness (the failing test)**

Write this file in full to `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/room-page.mjs` (overwrite the copy that is already there — the content below is the one that counts). It serves the repo root on `127.0.0.1:8770`, fakes `https://esm.sh/@supabase/supabase-js@2` (a programmable `createClient`: `rpc('ea_room_state')` answers from the scenario, every `from(...).update(...)` and `select` is recorded on `window.__calls`), fakes `cdn.jsdelivr.net/npm/@cloudflare/*` (a fake `RealtimeKitClient` whose meeting records `join/leave/kickAll` and can fire `roomLeft` on demand), and answers the edge functions from the scenario (`FUNCTIONS_BASE` is pointed at the same origin so no request can leave the machine; the `*.functions.supabase.co/*` pattern is stubbed as well, as a guard). The page's 20 s poll runs every 250 ms under the harness (only an interval of exactly 20000 ms is shortened). The reload marker `window.__mark = 'same-load'` is set once, after the first load, with `page.evaluate` — init scripts re-run on a reload, so a reloaded page reads it as `undefined`; the host tests assert it is still `'same-load'`, the two guest reloads assert it is gone. Never a real Supabase session.

```js
// harness/room-page.mjs — /room/ page harness: every roomBranch outcome, the host flow, the guest flow.
// Run from the scratchpad:  node harness/room-page.mjs
// System Chrome, a static server on 127.0.0.1:8770 serving the repo root, supabase-js and the
// RealtimeKit CDN stubbed with page.route(). Nothing here ever talks to Supabase or Cloudflare.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const REPO = process.env.ROOM_REPO || '/Users/nelsontaylor/taylormade-academy';
const PORT = Number(process.env.ROOM_PORT || 8770);   /* ROOM_PORT=8781 when another harness holds 8770 */
const ORIGIN = 'http://127.0.0.1:' + PORT;
const KEY = 'AbCdEfGhIjKlMnOpQrStUv';                       /* 22 chars of [A-Za-z0-9_-], like ea_room_new_key() */
const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

/* ---------- the static server: the repo root, no cache ---------- */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(REPO, p);
  if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

/* ---------- the fakes ---------- */
/* supabase-js: rpc('ea_room_state') answers from window.__scenario.state (plus a sessionStorage patch that
   survives a reload); from('ea_rooms').update(...) and every select are recorded on window.__calls */
const FAKE_SUPABASE = `
export function createClient() {
  const S = () => window.__scenario;
  const C = window.__calls = window.__calls || { rpc: [], updates: [], selects: [] };
  const from = (table) => {
    const b = { _op: 'select', _payload: null, _filters: [], _cols: null };
    const f = (k) => (...a) => { b._filters.push([k, ...a]); return b; };
    b.select = (cols) => { b._op = 'select'; b._cols = cols; return b; };
    b.update = (p) => { b._op = 'update'; b._payload = p; return b; };
    b.insert = (p) => { b._op = 'insert'; b._payload = p; return b; };
    b.delete = () => { b._op = 'delete'; return b; };
    ['eq', 'neq', 'is', 'in', 'or', 'order', 'limit'].forEach(k => { b[k] = f(k); });
    b.single = () => b; b.maybeSingle = () => b;
    b.then = (ok, bad) => Promise.resolve().then(() => {
      if (b._op === 'update') { C.updates.push({ table, payload: b._payload, filters: b._filters }); return S().updateError ? { data: null, error: { message: S().updateError } } : { data: null, error: null }; }
      if (b._op === 'select') { C.selects.push({ table, cols: b._cols, filters: b._filters }); const t = (S().tables || {})[table]; return { data: t === undefined ? [] : t, error: null }; }
      return { data: null, error: null };
    }).then(ok, bad);
    return b;
  };
  return {
    auth: { getSession: async () => ({ data: { session: S().session || null } }) },
    rpc: async (name, args) => {
      C.rpc.push({ name, args });
      if (name !== 'ea_room_state') return { data: null, error: null };
      if (S().rpcError) return { data: null, error: { message: 'boom' } };
      const st = JSON.parse(JSON.stringify(S().state));
      let patch = {}; try { patch = JSON.parse(sessionStorage.getItem('__patch') || '{}'); } catch (e) {}
      return { data: st && typeof st === 'object' ? Object.assign(st, patch) : st, error: null };
    },
    from,
    channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    removeChannel() {},
  };
}
`;
/* the kit: core sets window.RealtimeKitClient; the UI loader/main/addon are empty modules */
const FAKE_CORE = `window.RealtimeKitClient = { init: async (opts) => window.__fake.newMeeting(opts) };`;
const FAKE_LOADER = `export function defineCustomElements() {}`;
const FAKE_UI = `export const fakeUi = true;`;
const FAKE_VB = `export default { init: async () => null };`;
/* runs before every page script (and again after any reload): the 20 s poll shortened to 250 ms, and the fake meeting */
const INIT = `
(() => { const si = window.setInterval; window.setInterval = (fn, ms, ...a) => si(fn, ms === 20000 ? 250 : ms, ...a); })();
window.__fake = (() => {
  const calls = { init: 0, join: 0, leave: 0, kickAll: 0 };
  let meeting = null;
  const newMeeting = async (opts) => {
    calls.init++;
    const H = {};
    const on = (ev, fn) => { (H[ev] = H[ev] || []).push(fn); };
    const emit = (ev, arg) => (H[ev] || []).forEach(fn => { try { fn(arg); } catch (e) {} });
    const self = {
      audioEnabled: !!(opts && opts.defaults && opts.defaults.audio), videoEnabled: false, videoTrack: null, isPinned: false, screenShareEnabled: false, on,
      enableAudio: async () => { self.audioEnabled = true; emit('audioUpdate'); }, disableAudio: async () => { self.audioEnabled = false; emit('audioUpdate'); },
      enableVideo: async () => { self.videoEnabled = true; emit('videoUpdate'); }, disableVideo: async () => { self.videoEnabled = false; emit('videoUpdate'); },
      unpin() {},
    };
    meeting = {
      self,
      participants: { joined: { toArray: () => [], on() {} }, kickAll: async () => { calls.kickAll++; } },
      connectedMeetings: { on() {} },
      join: async () => { calls.join++; },
      leave: async () => { calls.leave++; },
      roomLeft: (state) => emit('roomLeft', { state }),
    };
    return meeting;
  };
  return { calls, newMeeting, get meeting() { return meeting; } };
})();
`;

/* ---------- one page per test ---------- */
const openContexts = [];
let lastLogs = [];                                          /* the console of the page under test, printed on a FAIL */
async function open(scenario, { search = '?k=' + KEY, fns = {} } = {}) {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  openContexts.push(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const fetches = [], errors = [], logs = lastLogs = [];
  page.on('pageerror', e => { errors.push(String(e)); logs.push('pageerror: ' + e); });
  page.on('console', m => logs.push(m.type() + ': ' + m.text()));
  await page.addInitScript(INIT);
  await page.addInitScript((s) => { window.__scenario = s; }, scenario);
  const js = (body) => ({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/\/js\/config\.js/, r => r.fulfill(js(`window.BM_CONFIG = { SUPABASE_URL: '${ORIGIN}', SUPABASE_KEY: 'fake', FUNCTIONS_BASE: '${ORIGIN}/__fn' };`)));
  await page.route('https://esm.sh/@supabase/supabase-js@2', r => r.fulfill(js(FAKE_SUPABASE)));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@cloudflare\//, r => {
    const u = r.request().url();
    r.fulfill(js(u.includes('/dist/browser.js') ? FAKE_CORE : u.includes('/loader/') ? FAKE_LOADER : u.includes('video-background') ? FAKE_VB : FAKE_UI));
  });
  /* the edge functions: FUNCTIONS_BASE is same-origin here, and the supabase.co pattern is a guard so nothing ever leaves the machine */
  await page.route(/\/__fn\/|functions\.supabase\.co\//, r => {
    const name = new URL(r.request().url()).pathname.split('/').pop();
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    fetches.push({ name, body, auth: r.request().headers()['authorization'] || '' });
    const reply = (fns[name] ? fns[name](body) : null) || { status: 200, body: {} };
    r.fulfill({ status: reply.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(reply.body) });
  });
  await page.goto(ORIGIN + '/room/' + search, { waitUntil: 'load' });
  /* the reload marker: set on THIS load only. Init scripts re-run on a reload, this does not, so a
     reloaded page reads __mark as undefined and the "no reload while hosting" checks fail as they should */
  await page.evaluate(() => { window.__mark = 'same-load'; });
  return { page, fetches, errors, logs };
}

let fails = 0, passes = 0;
async function t(name, fn) {
  try { await fn(); passes++; console.log('PASS ' + name); }
  catch (e) { fails++; console.log('FAIL ' + name + ' — ' + String(e && e.message || e).split('\n')[0]); lastLogs.slice(-8).forEach(l => console.log('     ' + l)); }
  finally { while (openContexts.length) { try { await openContexts.pop().close(); } catch (e) {} } }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
async function until(pred, what, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await pred()) return; await new Promise(r => setTimeout(r, 40)); }
  throw new Error('timed out waiting for ' + what);
}
const cardText = (page) => page.locator('#card').innerText();
/* ROOM_SHOTS=1 also saves a PNG of a few states to harness/shots/ (a look, not an assertion) */
async function shot(page, name) {
  if (!process.env.ROOM_SHOTS) return;
  fs.mkdirSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'shots'), { recursive: true });
  for (const w of [1280, 400]) { await page.setViewportSize({ width: w, height: 900 }); await page.screenshot({ path: path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', name + '-' + w + '.png'), fullPage: true }); }
}
const inRoom = (page) => page.evaluate(() => document.body.classList.contains('in-room'));
const noErrors = (errors) => ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
const sameLoad = (page) => page.evaluate(() => window.__mark);

/* ---------- scenarios ---------- */
const HOST_SESSION = { access_token: 'jwt-nelson', user: { id: 'u-nelson', email: 'nelson@example.com' } };
const GUEST_SESSION = { access_token: 'jwt-guest', user: { id: 'u-guest', email: 'guest@example.com' } };
const ST = (o = {}) => ({ id: ROOM_ID, title: 'Thursday build', is_live: false, host_name: 'Nelson Taylor', signed_in: true, is_host: false, can_join: true, bad_link: false, recording_url: null, people: null, ...o });
const ROW = { link_key: KEY, title: 'Thursday build' };
const HOST_JOIN = () => ({ status: 200, body: { token: 'tok', meeting_id: 'm-1', preset: 'tma-class-host', host: true, name: 'Nelson' } });
const GUEST_JOIN = () => ({ status: 200, body: { token: 'tok', preset: 'tma-class-guest', host: false, name: 'Guest' } });
const REC = (b) => ({ status: 200, body: b.action === 'stop' ? { stopped: true } : { recording_id: 'r-1', status: 'invoked' } });
const WAIT_LINE = 'Nelson hasn’t started yet — we’ll bring you in the moment he does.';
const DEAD = 'This link isn’t active anymore — ask Nelson for the new one.';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  await t('error card when ea_room_state fails', async () => {
    const { page, errors } = await open({ rpcError: true });
    await page.waitForSelector('#card .gatecard');
    const txt = await cardText(page);
    ok(txt.includes('The room could not load.'), 'card: ' + txt);
    ok(await page.locator('#card a[href="/room/?k=' + KEY + '"]').count() === 1, 'try-again link back to this url');
    noErrors(errors);
  });

  await t('dead_link card, no title', async () => {
    const { page, errors } = await open({ session: GUEST_SESSION, state: { bad_link: true } });
    await page.waitForSelector('#card .gatecard');
    const txt = await cardText(page);
    ok(txt.includes(DEAD), 'card: ' + txt);
    ok(!txt.includes('Thursday build'), 'a dead link never shows the title');
    noErrors(errors);
  });

  await t('landing card with a key: Sign in to join → /login/?next=…', async () => {
    const { page, errors } = await open({ state: ST({ signed_in: false }) });
    await page.waitForSelector('#signIn');
    const txt = await cardText(page);
    ok((await page.locator('#card .kicker').textContent()) === 'Nelson Taylor’s room', 'kicker: ' + await page.locator('#card .kicker').textContent());   /* textContent: the kicker is uppercased by CSS */
    ok(txt.includes('Thursday build'), 'title on the landing');
    ok(txt.includes('6-digit code'), 'the enter-the-code line');
    ok((await page.getAttribute('#signIn', 'href')) === '/login/?next=%2Froom%2F%3Fk%3D' + KEY, 'href: ' + await page.getAttribute('#signIn', 'href'));
    ok(await page.locator('.site-header').isVisible(), 'header shows on the landing');
    await shot(page, 'landing');
    noErrors(errors);
  });

  await t('landing card without a key → /login/?next=%2Froom%2F', async () => {
    const { page, errors } = await open({ state: ST({ signed_in: false }) }, { search: '' });
    await page.waitForSelector('#signIn');
    ok((await page.getAttribute('#signIn', 'href')) === '/login/?next=%2Froom%2F', 'href: ' + await page.getAttribute('#signIn', 'href'));
    noErrors(errors);
  });

  await t('not_allowed card → /pricing/', async () => {
    const { page, errors } = await open({ session: GUEST_SESSION, state: ST({ can_join: false }) }, { search: '' });
    await page.waitForSelector('#card .gatecard');
    const txt = await cardText(page);
    ok(txt.includes('You need Nelson’s link or an Academy membership to join.'), 'card: ' + txt);
    ok(await page.locator('#card a[href="/pricing/"]').count() === 1, 'pricing link');
    noErrors(errors);
  });

  await t('host_idle: control with title, link from ea_rooms, Copy link', async () => {
    const { page, errors } = await open({ session: HOST_SESSION, state: ST({ is_host: true, people: 0 }), tables: { ea_rooms: ROW } }, { search: '' });
    await page.waitForSelector('#roomCtl:not([hidden])');
    await page.waitForFunction(() => document.getElementById('rLink').value !== '');
    ok((await page.inputValue('#rLink')) === ORIGIN + '/room/?k=' + KEY, 'link: ' + await page.inputValue('#rLink'));
    ok((await page.innerText('#rTitle')) === 'Thursday build', 'title');
    ok(await page.locator('#rEnd').isHidden(), 'End session hidden while off air');
    ok(!(await page.isDisabled('#rStart')), 'Start enabled');
    ok((await page.innerText('#rStart')) === 'Start class — everyone on camera', 'start label: ' + await page.innerText('#rStart'));
    await shot(page, 'host-idle');
    const sel = await page.evaluate(() => window.__calls.selects);
    ok(sel.some(s => s.table === 'ea_rooms' && s.cols === 'link_key,title' && s.filters.some(f => f[0] === 'eq' && f[1] === 'id' && f[2] === ROOM_ID)), 'link read: ' + JSON.stringify(sel));
    await page.click('#rCopy');
    await page.waitForFunction(() => document.getElementById('rCopy').textContent !== 'Copy link');
    const label = await page.innerText('#rCopy');
    ok(/^(Copied|Press ⌘C|Press Ctrl\+C)$/.test(label), 'copy label: ' + label);
    await page.waitForFunction(() => document.getElementById('rCopy').textContent === 'Copy link');
    ok(!(await inRoom(page)), 'not in the room yet');
    noErrors(errors);
  });

  await t('host_idle: Start class → room live → joined starts recording → Leave ends it (no reload)', async () => {
    const { page, fetches, errors } = await open({ session: HOST_SESSION, state: ST({ is_host: true, people: 0 }), tables: { ea_rooms: ROW } }, { search: '', fns: { 'ea-rtk-join': HOST_JOIN, 'ea-rtk-record': REC } });
    await page.waitForSelector('#roomCtl:not([hidden])');
    await page.click('#rStart');
    await page.waitForSelector('.r2-enter');
    const j = fetches.find(f => f.name === 'ea-rtk-join');
    ok(j && j.body.room === true && j.body.key === null && Object.keys(j.body).length === 2, 'join body: ' + JSON.stringify(j && j.body));
    ok(j.auth === 'Bearer jwt-nelson', 'join auth: ' + j.auth);
    let ups = await page.evaluate(() => window.__calls.updates);
    ok(ups.length === 1 && ups[0].table === 'ea_rooms' && ups[0].payload.is_live === true && /^\d{4}-\d\d-\d\dT/.test(ups[0].payload.live_since) && Object.keys(ups[0].payload).length === 2 && ups[0].filters[0].join() === 'eq,id,' + ROOM_ID, 'flip live: ' + JSON.stringify(ups));
    ok(await inRoom(page), 'body.in-room on the join screen');
    ok((await page.evaluate(() => document.getElementById('rStart').textContent)) === 'Class is running', 'start button says Class is running');
    ok(await page.evaluate(() => !document.getElementById('rEnd').hidden), 'End session available once live');
    ok(!fetches.some(f => f.name === 'ea-rtk-record'), 'no recording before Nelson is in');
    await page.click('.r2-enter');
    await until(() => fetches.some(f => f.name === 'ea-rtk-record' && f.body.action === 'start'), 'record start');
    const rs = fetches.find(f => f.name === 'ea-rtk-record');
    ok(rs.body.room === true && rs.body.action === 'start' && Object.keys(rs.body).length === 2, 'record start body: ' + JSON.stringify(rs.body));
    await page.waitForSelector('.r2');
    await page.waitForFunction(() => !document.getElementById('rRec').hidden);
    await page.click('.r2-leave'); await page.waitForTimeout(200); await page.click('.r2-leave');
    await page.waitForFunction(() => !document.body.classList.contains('in-room'));
    await until(() => fetches.some(f => f.name === 'ea-rtk-record' && f.body.action === 'stop'), 'record stop');
    await page.waitForFunction(() => window.__calls.updates.length >= 2);
    ups = await page.evaluate(() => window.__calls.updates);
    const last = ups[ups.length - 1];
    ok(last.table === 'ea_rooms' && last.payload.is_live === false && /^\d{4}-/.test(last.payload.ended_at) && Object.keys(last.payload).length === 2, 'flip off: ' + JSON.stringify(last));
    const fk = await page.evaluate(() => window.__fake.calls);
    ok(fk.kickAll === 1 && fk.leave === 1, 'host leave = kickAll + leave: ' + JSON.stringify(fk));
    await page.waitForFunction(() => /Session ended/.test(document.getElementById('rNote').textContent));
    ok(await page.evaluate(() => document.getElementById('rEnd').hidden && !document.getElementById('rStart').disabled && document.getElementById('rRec').hidden), 'control back to off air');
    ok((await sameLoad(page)) === 'same-load', 'no reload while hosting');
    noErrors(errors);
  });

  await t('host_live: reload re-enters the running class, no new live_since, Leave still ends it', async () => {
    const { page, fetches, errors } = await open({ session: HOST_SESSION, state: ST({ is_host: true, is_live: true, people: 3 }), tables: { ea_rooms: ROW } }, { search: '', fns: { 'ea-rtk-join': HOST_JOIN, 'ea-rtk-record': REC } });
    await page.waitForSelector('.r2-enter');
    const j = fetches.find(f => f.name === 'ea-rtk-join');
    ok(j && j.body.room === true && j.body.key === null, 'join body: ' + JSON.stringify(j && j.body));
    ok((await page.evaluate(() => window.__calls.updates)).length === 0, 'no ea_rooms write on re-entry (no onOpened)');
    ok(await page.evaluate(() => document.getElementById('rStart').disabled && document.getElementById('rStart').textContent === 'Class is running' && !document.getElementById('rEnd').hidden), 'control says Class is running + End session');
    await page.click('.r2-enter');
    await until(() => fetches.some(f => f.name === 'ea-rtk-record' && f.body.action === 'start'), 'record start (idempotent on the server)');
    await page.waitForSelector('.r2');
    await page.click('.r2-leave'); await page.waitForTimeout(200); await page.click('.r2-leave');
    await until(() => fetches.some(f => f.name === 'ea-rtk-record' && f.body.action === 'stop'), 'record stop');
    await page.waitForFunction(() => window.__calls.updates.length >= 1);
    const last = await page.evaluate(() => window.__calls.updates.slice(-1)[0]);
    ok(last.payload.is_live === false && /^\d{4}-/.test(last.payload.ended_at), 'flip off: ' + JSON.stringify(last));
    ok((await sameLoad(page)) === 'same-load', 'no reload while hosting');
    noErrors(errors);
  });

  await t('host_live: join refused → control stays, End session stops + flips off air (no reload)', async () => {
    const { page, fetches, errors } = await open({ session: HOST_SESSION, state: ST({ is_host: true, is_live: true, people: 1 }), tables: { ea_rooms: ROW } }, { search: '', fns: { 'ea-rtk-join': () => ({ status: 503, body: { error: 'rtk_not_configured' } }), 'ea-rtk-record': REC } });
    await page.waitForSelector('#rNote');
    await page.waitForFunction(() => /The room is not set up yet\./.test(document.getElementById('rNote').textContent));
    ok(!(await inRoom(page)), 'body.in-room cleared after the failed mount');
    ok(await page.evaluate(() => !document.getElementById('rEnd').hidden && document.getElementById('rStart').disabled), 'End session offered, Start off');
    await page.click('#rEnd');
    await until(() => fetches.some(f => f.name === 'ea-rtk-record' && f.body.action === 'stop'), 'record stop');
    await page.waitForFunction(() => window.__calls.updates.length >= 1);
    const last = await page.evaluate(() => window.__calls.updates.slice(-1)[0]);
    ok(last.table === 'ea_rooms' && last.payload.is_live === false && /^\d{4}-/.test(last.payload.ended_at), 'flip off: ' + JSON.stringify(last));
    await page.waitForFunction(() => document.getElementById('rEnd').hidden && !document.getElementById('rStart').disabled);
    ok((await sameLoad(page)) === 'same-load', 'no reload');
    noErrors(errors);
  });

  await t('waiting: the v2 waiting screen, then live → reload → auto-enter', async () => {
    const { page, fetches, errors } = await open({ session: GUEST_SESSION, state: ST() }, { fns: { 'ea-rtk-join': GUEST_JOIN } });
    await page.waitForSelector('.r2-join .r2-wait');
    ok((await page.innerText('.r2-line')) === WAIT_LINE, 'waiting line: ' + await page.innerText('.r2-line'));
    ok(fetches.length === 0, 'no join while waiting');
    ok(await inRoom(page), 'body.in-room while waiting');
    await shot(page, 'waiting');
    const reloaded = page.waitForEvent('load', { timeout: 6000 });
    await page.evaluate(() => { sessionStorage.setItem('__patch', JSON.stringify({ is_live: true })); });
    await reloaded;
    ok((await sameLoad(page)) === undefined, 'the poll reloaded the page');
    await page.waitForSelector('.r2');                     /* no click: v2 remembered the auto-enter */
    const j = fetches.find(f => f.name === 'ea-rtk-join');
    ok(j && j.body.room === true && j.body.key === KEY, 'join body: ' + JSON.stringify(j && j.body));
    ok((await page.evaluate(() => window.__fake.calls.join)) === 1, 'joined once');
    noErrors(errors);
  });

  await t('student: join with the key, enter, the strip says recorded, poll sees off air → leave + ended card', async () => {
    const { page, fetches, errors } = await open({ session: GUEST_SESSION, state: ST({ is_live: true }) }, { fns: { 'ea-rtk-join': GUEST_JOIN } });
    await page.waitForSelector('.r2-enter');
    const j = fetches.find(f => f.name === 'ea-rtk-join');
    ok(j && j.body.room === true && j.body.key === KEY && Object.keys(j.body).length === 2, 'join body: ' + JSON.stringify(j && j.body));
    ok(j.auth === 'Bearer jwt-guest', 'join auth: ' + j.auth);
    await page.click('.r2-enter');
    await page.waitForSelector('.r2');
    ok((await page.innerText('.r2-nowtxt')).includes('This session is being recorded'), 'strip: ' + await page.innerText('.r2-nowtxt'));
    await page.evaluate(() => { sessionStorage.setItem('__patch', JSON.stringify({ is_live: false })); });
    await page.waitForSelector('#card .gatecard');
    const txt = await cardText(page);
    ok(txt.includes('This session has ended.') && txt.includes('Members can rewatch it on the Live page'), 'ended card: ' + txt);
    await shot(page, 'ended');
    ok(await page.locator('#card a[href="/live/"]').count() === 1, 'link to /live/');
    ok((await page.evaluate(() => window.__fake.calls.leave)) === 1, 'room.leave() called by the poll');
    ok(!(await inRoom(page)), 'body.in-room cleared');
    ok((await sameLoad(page)) === 'same-load', 'no reload on the way out');
    noErrors(errors);
  });

  for (const why of ['ended', 'kicked']) {
    await t('student: the kit says ' + why + ' → ended card', async () => {
      const { page, errors } = await open({ session: GUEST_SESSION, state: ST({ is_live: true }) }, { fns: { 'ea-rtk-join': GUEST_JOIN } });
      await page.waitForSelector('.r2-enter');
      await page.click('.r2-enter');
      await page.waitForSelector('.r2');
      await page.evaluate((w) => window.__fake.meeting.roomLeft(w), why);
      await page.waitForSelector('#card .gatecard');
      const txt = await cardText(page);
      ok(txt.includes('This session has ended.'), 'ended card: ' + txt);
      ok((await page.evaluate(() => window.__fake.calls.leave)) === 0, 'the kit ended it; the page did not call leave');
      noErrors(errors);
    });
  }

  await t('student: Leave → You left the room + Rejoin reloads', async () => {
    const { page, errors } = await open({ session: GUEST_SESSION, state: ST({ is_live: true }) }, { fns: { 'ea-rtk-join': GUEST_JOIN } });
    await page.waitForSelector('.r2-enter');
    await page.click('.r2-enter');
    await page.waitForSelector('.r2');
    await page.click('.r2-leave'); await page.waitForTimeout(200); await page.click('.r2-leave');
    await page.waitForSelector('#rejoin');
    const txt = await cardText(page);
    ok(txt.includes('You left the room.'), 'left card: ' + txt);
    ok((await page.evaluate(() => window.__fake.calls.leave)) === 1, 'leave once');
    const reloaded = page.waitForEvent('load', { timeout: 6000 });
    await page.click('#rejoin');
    await reloaded;
    ok((await sameLoad(page)) === undefined, 'Rejoin reloaded the page');
    await page.waitForSelector('.r2-enter');            /* back on the join screen */
    noErrors(errors);
  });

  for (const [code, status, want] of [
    ['room_full', 429, 'The room is full right now.'],
    ['bad_link', 404, DEAD],
    ['not_open', 409, 'Nelson hasn’t started yet.'],
    ['slow_down', 429, 'Too many tries — wait a minute and try again.'],
    ['not_allowed', 403, 'You need Nelson’s link or an Academy membership.'],
    ['sign_in', 401, 'Sign in again and retry.'],
    ['kaboom', 500, 'The server said 500.'],
  ]) {
    await t('join refused: ' + code + ' → ' + want, async () => {
      const { page, errors } = await open({ session: GUEST_SESSION, state: ST({ is_live: true }) }, { fns: { 'ea-rtk-join': () => ({ status, body: { error: code } }) } });
      await page.waitForSelector('#card .gatecard');
      const txt = await cardText(page);
      ok(txt.includes(want), 'card: ' + txt);
      ok(!(await inRoom(page)), 'body.in-room cleared');
      noErrors(errors);
    });
  }
} finally {
  await browser.close();
  server.close();
}
console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL PASS (${passes})`);
process.exit(fails ? 1 : 0);
```

- [ ] **Step 3: Run it and watch it fail (no page yet)**

```bash
cd /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad && node harness/room-page.mjs; echo "exit=$?"
```
Expected (about 2 min 20 s: every check waits 6 s for a page that 404s): 21 entries, each a `FAIL` line ending `— page.waitForSelector: Timeout 6000ms exceeded.` followed by one indented console line, then the totals:
```
FAIL error card when ea_room_state fails — page.waitForSelector: Timeout 6000ms exceeded.
     error: Failed to load resource: the server responded with a status of 404 (Not Found)
FAIL dead_link card, no title — page.waitForSelector: Timeout 6000ms exceeded.
     error: Failed to load resource: the server responded with a status of 404 (Not Found)
…
FAIL join refused: kaboom → The server said 500. — page.waitForSelector: Timeout 6000ms exceeded.
     error: Failed to load resource: the server responded with a status of 404 (Not Found)
21 FAILED, 0 passed
exit=1
```
If the first line is instead `Error: listen EADDRINUSE: address already in use 127.0.0.1:8770`, another harness from this session is holding the port: rerun with `ROOM_PORT=8781 node harness/room-page.mjs; echo "exit=$?"` (every command below accepts the same prefix). Do not pipe the harness through `grep` and read `${PIPESTATUS[0]}` — the shell here is zsh, where that variable is empty; the harness prints nothing to stderr, so the bare `$?` is the exit code.

- [ ] **Step 4: Write `room/index.html`**

Write this file in full to `/Users/nelsontaylor/taylormade-academy/room/index.html`. Notes for the reader, in plain words: the head carries the same Google Fonts `<link>` as `live/index.html` line 8, `build-mode.css` and `rtk-room-v2.css` (not `hub.css`, not `rtk-room.css`), with `?v=3ef77ddd84` exactly as `live/index.html` has today — `build_site.py` rewrites those stamps once Step 7 lands (`js/room-page.js` gets its stamp in Task 9). The page imports `ROOM_WORDS` from the existing `/opil/hub/live-rooms.js` (an existing module; nothing new sits in front of an OPIL page) because `joinErrorText(code, status, words)` needs the words; `_HUB_ASSET_RX` (build_site.py line 237) already stamps that link. Three things share the page and only one shows at a time: `#card` (navy card), `#roomCtl` (Nelson's control) and `#rtkMount` (the room, drawn by `mountRoomV2`). `mountRoomV2` puts `in-room` on the body the moment it starts, which hides the header, the control and the card; `showCard()` and `unmount()` take it off again — the only two places the page touches that class. Strings that come from the server's error codes go through `joinErrorText`; anything without a code (the video library failing to load) speaks in its own words. There is no `location.reload()` anywhere on the host path; the guest path reloads exactly twice — when the poll sees the room flip live while waiting (v2's auto-enter then walks them in) and on **Rejoin**. `.gatecard` and `.acts` are page-local CSS (neither is in `build-mode.css`; `live/index.html` defines its own `.gatecard` the same way).

```html
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Room · Taylormade Academy</title>
<meta name="description" content="Nelson Taylor's live room at Taylormade Academy.">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico" sizes="any">
<meta name="theme-color" content="#04123a">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/build-mode.css?v=3ef77ddd84">
<link rel="stylesheet" href="/css/rtk-room-v2.css?v=3ef77ddd84">
<script>document.documentElement.classList.add('js')</script>
<style>
/* The room page. One of three things is on it at a time: a card (signed out, dead link, not allowed,
   ended, left, error), Nelson's control, or the room itself (#rtkMount, drawn by js/rtk-room-v2.js).
   While the room is mounted the body carries .in-room and everything else steps out of the way. */
.room-shell{padding-block:clamp(22px,4vw,44px) clamp(40px,6vw,80px)}
body.in-room .room-shell{padding-block:12px 16px}
body.in-room .room-ctl, body.in-room .site-header, body.in-room #card { display:none }
#card:empty,#card[hidden],#roomCtl[hidden],#rEnd[hidden],#rRec[hidden]{display:none!important}

/* ---- the card ---- */
.gatecard{background:var(--navy);color:#fff;border-radius:var(--r-lg);padding:clamp(26px,4vw,46px);box-shadow:var(--shadow-float);position:relative;overflow:hidden;max-width:760px;margin:0 auto}
.gatecard::after{content:"";position:absolute;right:-90px;top:-90px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(253,201,33,.16),transparent 68%);pointer-events:none}
.gatecard h2{font-family:var(--display);font-size:clamp(24px,3.4vw,38px);letter-spacing:-.02em;margin:12px 0 0;max-width:20ch;line-height:1.1}
.gatecard p.lede{color:#c3cee6;font-size:16px;line-height:1.65;max-width:52ch;margin:16px 0 0}
.gatecard p.fine{color:#9fb0d4;font-size:13.5px;line-height:1.6;max-width:52ch;margin:18px 0 0}
.gatecard .acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px;align-items:center;position:relative;z-index:1}

/* ---- Nelson's control ---- */
.room-ctl{background:var(--gold-soft);border:1px solid #f4e2ac;border-radius:var(--r);padding:16px 18px;margin-bottom:22px}
.room-ctl .ah{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.room-ctl .ah b{font-family:var(--display);font-size:14px;color:var(--gold-ink)}
.room-ctl .ah span{font-size:11.5px;font-weight:700;letter-spacing:.07em;color:#8a6d00;background:#fff;padding:3px 9px;border-radius:var(--pill)}
#rTitle{font-family:var(--display);font-size:clamp(20px,2.4vw,28px);letter-spacing:-.015em;margin:0 0 12px;color:var(--ink)}
.ctl-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
.ctl-row+.ctl-row{margin-top:9px}
.ctl-row input{flex:1;min-width:220px;padding:10px 14px;border:1px solid #eacf85;border-radius:10px;font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:#fff;color:var(--ink-2);outline-offset:2px}
.ctl-row button{font:inherit;font-weight:600;font-size:13.5px;min-height:44px;padding:0 16px;border-radius:var(--pill);cursor:pointer;background:#fff;color:var(--gold-ink);border:1px solid #eacf85;transition:transform .16s var(--ease)}
.ctl-row button:active{transform:scale(.97)}
.ctl-row button:disabled{opacity:.55;cursor:not-allowed}
.ctl-row .go{background:var(--navy);color:#fff;border-color:var(--navy)}
.ctl-row .end{background:var(--clay);color:#fff;border-color:var(--clay)}
.ctl-cap{font-size:13px;color:#8a6d00;margin:8px 0 12px;line-height:1.5}
.ctl-cap a{color:inherit;text-decoration:underline}
#rNote{font-size:13px;color:#8a6d00;margin:11px 0 0;line-height:1.5}
#rRec{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#b4451f;background:#fdf0e7;border-radius:var(--pill);padding:0 12px;min-height:44px}
#rRec i{width:8px;height:8px;border-radius:50%;background:#e0492a;animation:rpulse 1.6s ease-in-out infinite}
@keyframes rpulse{0%,100%{opacity:1}50%{opacity:.35}}
@media(prefers-reduced-motion:reduce){#rRec i{animation:none}}
</style>
</head><body>
<header class="site-header"><div class="wrap"><div class="bar">
<a class="brand" href="/"><img class="logo" src="/assets/logo-nav.webp" alt="" width="40" height="40" decoding="async"><span class="mark">Taylormade Academy</span></a>
<div class="nav-cta"><a class="btn ghost sm" href="/live/">Live page</a></div>
</div></div></header>

<main><div class="wrap room-shell">
<section id="card"></section>
<section id="roomCtl" class="room-ctl" hidden></section>
<div id="rtkMount"></div>
</div></main>

<script src="/js/config.js?v=3ef77ddd84"></script>
<script type="module">
import { roomKey, roomBranch, loginHref, joinErrorText } from '/js/room-page.js?v=3ef77ddd84';
import { ROOM_WORDS } from '/opil/hub/live-rooms.js?v=3ef77ddd84';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CFG = window.BM_CONFIG || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const POLL_MS = 20000;            /* how often a waiting or joined guest asks the server whether the room is live */
const words = ROOM_WORDS;
const k = roomKey(location.search);
const card = $('card'), ctl = $('roomCtl'), mount = $('rtkMount');
const here = location.pathname + location.search;
const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);

/* ---------- cards: one at a time, in place of everything else ---------- */
function showCard(html) {
  document.body.classList.remove('in-room', 'in-room-v2');   /* a mount that never finished still marked the body */
  mount.innerHTML = '';
  ctl.hidden = true;
  card.innerHTML = '<div class="gatecard on-ink">' + html + '</div>';
}
const tryAgain = '<div class="acts"><a class="btn gold" href="' + esc(here) + '">Try again <span class="arr">&rarr;</span></a></div>';
/* a join or record refusal carries a code from the server; anything else (the video library, a lost connection) speaks for itself */
const failText = (e) => (e && e.code) ? joinErrorText(e.code, e.status, words) : ((e && e.message) || 'Could not open the room.');

let poll = null;
const stopPoll = () => { if (poll) { clearInterval(poll); poll = null; } };
async function pollState() {
  try { const r = await sb.rpc('ea_room_state', { p_key: k }); return r.error ? null : r.data; } catch (e) { return null; }
}
function endedCard() {
  stopPoll();
  showCard('<span class="kicker gold">Thanks for coming</span><h2>This session has ended.</h2>' +
    '<p class="lede">Members can rewatch it on the Live page.</p>' +
    '<div class="acts"><a class="btn gold" href="/live/">Live page <span class="arr">&rarr;</span></a></div>');
}
function leftCard() {
  stopPoll();
  showCard('<span class="kicker gold">See you soon</span><h2>You left the room.</h2>' +
    '<p class="lede">You can come back in as long as Nelson is live.</p>' +
    '<div class="acts"><button type="button" class="btn gold" id="rejoin">Rejoin <span class="arr">&rarr;</span></button></div>');
  $('rejoin').addEventListener('click', () => location.reload());
}
function failCard(e) {
  stopPoll();
  showCard('<span class="kicker gold">Hold on</span><h2>' + esc(failText(e)) + '</h2>' + tryAgain);
}
/* a mount that threw after marking the body: put the page back the way it was */
function unmount() { document.body.classList.remove('in-room', 'in-room-v2'); mount.innerHTML = ''; }

/* ---------- boot: who is here, and what the room says about them ---------- */
let session = null, state = null;
try {
  session = (await sb.auth.getSession()).data.session || null;
  const r = await sb.rpc('ea_room_state', { p_key: k });
  state = r.error ? null : r.data;
} catch (e) { state = null; }
const user = session ? session.user : null;
const branch = roomBranch(state);

/* v2 in room mode: the same module OPIL uses, pointed at the room instead of a session */
async function enter(mode, hooks) {
  const tok = (await sb.auth.getSession()).data.session?.access_token || '';
  const { mountRoomV2 } = await import('/js/rtk-room-v2.js?v=3ef77ddd84');
  return mountRoomV2({ mountEl: mount, cfg: CFG, token: tok, sb, user, mode, target: { kind: 'room', id: state.id, title: state.title, key: k }, ...hooks });
}

if (branch === 'error') {
  showCard('<span class="kicker gold">Hold on</span><h2>The room could not load.</h2>' +
    '<p class="lede">That is on us, not you. Refresh in a moment. If Nelson is live and this keeps happening, message him and he will get you in.</p>' + tryAgain);
} else if (branch === 'dead_link') {
  showCard('<span class="kicker gold">This link</span><h2>' + esc(joinErrorText('bad_link', 404, words)) + '</h2>' +
    '<p class="lede">Nelson makes a new link now and then. The newest one he sent is the one that works.</p>');
} else if (branch === 'landing') {
  showCard('<span class="kicker gold">' + esc(state.host_name) + '’s room</span><h2>' + esc(state.title) + '</h2>' +
    '<p class="lede">Sign in and you walk straight in. Your email, then a 6-digit code — no password.</p>' +
    '<div class="acts"><a class="btn gold" id="signIn" href="' + esc(loginHref(k)) + '">Sign in to join <span class="arr">&rarr;</span></a></div>' +
    '<p class="fine">The code arrives by email. Enter the 6-digit code here, on the sign-in page — not the link in the email — and you land back in this room.</p>');
} else if (branch === 'not_allowed') {
  showCard('<span class="kicker gold">Members and invited people</span><h2>You need Nelson’s link or an Academy membership to join.</h2>' +
    '<p class="lede">If Nelson sent you a link, open that link. Members get in without one.</p>' +
    '<div class="acts"><a class="btn gold" href="/pricing/">See membership <span class="arr">&rarr;</span></a><a class="btn ghost" href="/live/">Live page</a></div>');
} else if (branch === 'waiting') {
  waitHere();
} else if (branch === 'student') {
  joinAsGuest();
} else {
  hostControl(branch === 'host_live');
}

/* ---------- a guest: wait, or go in ---------- */
let room = null, closing = false, inRoom = false;

async function waitHere() {
  try { room = await enter('waiting', {}); } catch (e) { failCard(e); return; }
  /* the server says when Nelson starts; the reload then walks them straight in (v2 remembered the auto-enter) */
  poll = setInterval(async () => { const st = await pollState(); if (st && st.is_live) location.reload(); }, POLL_MS);
}
function guestState(st, m, reason) {
  if (st === 'joined') { inRoom = true; return; }
  if (st !== 'left' && st !== 'ended') return;
  if (closing || !inRoom) return;                 /* the poll is already closing the room, or the kit said it twice */
  inRoom = false;
  const why = reason || st;                       /* 'ended' (Nelson left) and 'kicked' (Nelson removed them) both end it for this person */
  if (why === 'ended' || why === 'kicked') endedCard(); else leftCard();
}
async function guestPoll() {
  const st = await pollState();
  if (!st || st.is_live !== false) return;        /* {bad_link:true} has no is_live: a new link keeps people OUT, it does not pull them out */
  closing = true; stopPoll();                     /* belt and braces for a host tab that died */
  if (room) { try { await room.leave(); } catch (e) {} }
  endedCard();
}
async function joinAsGuest() {
  poll = setInterval(guestPoll, POLL_MS);
  try { room = await enter('student', { onState: guestState }); }
  catch (e) { failCard(e); }
}

/* ---------- Nelson: the control, Start class, and the room as host ---------- */
async function hostControl(liveNow) {
  let live = liveNow, pendingRecord = false, hostIn = false;
  ctl.innerHTML =
    '<div class="ah"><b>Your room</b><span>NELSON ONLY</span></div>' +
    '<h2 id="rTitle">' + esc(state.title) + '</h2>' +
    '<div class="ctl-row"><input id="rLink" readonly aria-label="Link to your room" value="" placeholder="Reading your link…"><button type="button" id="rCopy" aria-live="polite">Copy link</button></div>' +
    '<p class="ctl-cap">Send this link to anyone you want in the room. It works before you start &mdash; people wait in the room until you do. Change the title or make a new link on the <a href="/live/">Live page</a>.</p>' +
    '<div class="ctl-row"><button type="button" class="go" id="rStart">Start class &mdash; everyone on camera</button><button type="button" class="end" id="rEnd" hidden title="For a session left running from another device. Leaving the room from the device you started it on ends the session on its own.">End session</button><span id="rRec" hidden><i></i>Recording</span></div>' +
    '<p id="rNote">1. Copy the link and send it. &nbsp;2. Start class, check your camera, press Enter. &nbsp;3. When you are done, press Leave &mdash; that ends the session for everyone and the replay lands on the Live page.</p>';
  ctl.hidden = false;
  const startBtn = $('rStart'), endBtn = $('rEnd'), note = $('rNote'), recChip = $('rRec'), linkEl = $('rLink'), copyBtn = $('rCopy');
  const syncCtl = () => { endBtn.hidden = !live; startBtn.disabled = live; startBtn.innerHTML = live ? 'Class is running' : 'Start class &mdash; everyone on camera'; };
  syncCtl();

  /* the link: link_key is admin-only on ea_rooms (RLS), so only Nelson's page can read it */
  let row = null;
  try { row = (await sb.from('ea_rooms').select('link_key,title').eq('id', state.id).single()).data; } catch (e) {}
  if (row && row.link_key) { linkEl.value = location.origin + '/room/?k=' + row.link_key; if (row.title) $('rTitle').textContent = row.title; }
  else { linkEl.placeholder = 'Could not read your link — open the Live page.'; }
  copyBtn.addEventListener('click', async () => {
    linkEl.select();
    let done = false;
    try { await navigator.clipboard.writeText(linkEl.value); done = true; } catch (e) {}
    if (!done) { try { done = document.execCommand('copy'); } catch (e) {} }   /* older WebViews: the selection is copied the old way */
    copyBtn.textContent = done ? 'Copied' : (/Mac|iPhone|iPad/.test(navigator.platform) ? 'Press ⌘C' : 'Press Ctrl+C');
    setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1600);
  });

  async function record(action) {
    const tok = (await sb.auth.getSession()).data.session?.access_token || '';
    const r = await fetch(CFG.FUNCTIONS_BASE + '/ea-rtk-record', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ room: true, action }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(joinErrorText(d.error, r.status, words));
    return d;
  }
  /* the room row: is_live / live_since / ended_at are among the columns an admin may write (0036) */
  async function flip(on) {
    const r = await sb.from('ea_rooms').update(on ? { is_live: true, live_since: new Date().toISOString() } : { is_live: false, ended_at: new Date().toISOString() }).eq('id', state.id);
    if (r.error) throw new Error(r.error.message);
    live = on; syncCtl();
  }
  /* Leaving IS the end of the session — one action, for everyone (Nelson, 9/14). End session does the same from the control. */
  async function endSession(fromRoom) {
    let recorded = false;
    try { recorded = !!(await record('stop')).stopped; } catch (e) {}   /* a recording that never started has nothing to stop */
    recChip.hidden = true;
    try { await flip(false); }
    catch (e) { note.textContent = (fromRoom ? 'You left, but the session could not be closed (' : 'Could not end the session (') + e.message + '). Press End session.'; return; }
    room = null;
    note.textContent = recorded
      ? 'Session ended — the replay is being prepared. Review and publish it on the Live page; members see it once it is published.'
      : 'Session ended — the room is closed for everyone. Start class to open it again.';
  }
  /* the recording starts when Nelson is IN the room (joined), never at Start class: Cloudflare stops a
     recording that sits with nobody in it for 60 s, and the camera check can take longer than that */
  async function hostState(st) {
    if (st === 'joined') {
      hostIn = true;
      if (!pendingRecord) return;
      pendingRecord = false;
      try { await record('start'); recChip.hidden = false; if (room && room.setRecording) room.setRecording(true); }
      catch (e) { note.textContent = 'You’re in, but the replay could not start recording (' + e.message + '). The session itself is fine.'; }
      return;
    }
    if (st !== 'left' && st !== 'ended') return;
    if (!hostIn) return;             /* the kit can say it twice; one end per session */
    hostIn = false;
    await endSession(true);
  }
  /* into the room as host. A fresh Start gets onOpened (the server just made a new meeting: flip the room live).
     A reload or a second device while live joins the running meeting with no onOpened and no new recording
     (start is idempotent on the server). Never location.reload() while hosting — that drops the camera. */
  async function goIn(opened) {
    pendingRecord = true;
    try { room = await enter('host', opened ? { onState: hostState, onOpened: opened } : { onState: hostState }); }
    catch (e) { pendingRecord = false; unmount(); syncCtl(); throw e; }
  }
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true; startBtn.textContent = 'Opening the room…';
    try {
      await goIn(async () => {
        await flip(true);
        note.textContent = 'Your room is open. Check your camera below and press Enter — the recording starts when you’re in. When you’re done, press Leave and the session ends for everyone.';
      });
    } catch (e) { note.textContent = 'Could not start: ' + failText(e); }
  });
  endBtn.addEventListener('click', async () => {
    endBtn.disabled = true; endBtn.textContent = 'Ending…';
    await endSession(false);
    endBtn.disabled = false; endBtn.textContent = 'End session';
  });
  if (live) {
    /* already live (a reload, a second device, or a tab that died): straight back in as host */
    note.textContent = 'Class is running — taking you back in. If it was left running from another device, End session closes it from here.';
    try { await goIn(null); }
    catch (e) { note.textContent = 'Could not get back in: ' + failText(e) + ' End session closes the room from here.'; }
  }
}
</script>
</body></html>
```

How each `roomBranch` outcome lands, so you can read the code against the spec (§2.2, §7.3):
- `error` → "The room could not load." + **Try again** (back to this URL).
- `dead_link` → the `bad_link` sentence from `joinErrorText` (one source of truth), no title.
- `landing` → kicker `<host_name>’s room`, the title, **Sign in to join** → `loginHref(k)`, and the "enter the 6-digit code here" line.
- `not_allowed` → "You need Nelson’s link or an Academy membership to join." → `/pricing/` (+ a quiet link to `/live/`).
- `host_idle` → control (`#rTitle`, `#rLink` read from `ea_rooms` with admin RLS, `#rCopy` with the OPIL clipboard fallback from `opil/hub/live/index.html` 299-306, `#rStart`), `#rEnd` hidden. **Start class** → `mountRoomV2` host mode with `onOpened` → `update ea_rooms { is_live:true, live_since }` → the join screen → Enter → `onState('joined')` → `record('start')` (chip on) → Leave (v2: kickAll + leave) → `onState('left')` → `record('stop')` → `update { is_live:false, ended_at }` → control back, note says what happened.
- `host_live` → control with **Class is running** (disabled) + **End session**, AND `mountRoomV2` host mode without `onOpened` (same meeting, `record('start')` on joined — idempotent on the server). If that mount fails, the control stays and **End session** stops + flips off air without entering.
- `waiting` → `mountRoomV2` waiting mode; the 20 s poll reloads when `is_live` flips (v2's stored auto-enter key walks them in).
- `student` → `mountRoomV2` student mode; the 20 s poll: `is_live === false` → `room.leave()` + ended card; `onState` reason `ended`/`kicked` → ended card ("Members can rewatch it on the Live page" → `/live/`); reason `left` → "You left the room." + **Rejoin** (reload). Every join refusal → `joinErrorText`.

- [ ] **Step 5: Run the harness green**

```bash
cd /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad && node harness/room-page.mjs; echo "exit=$?"
```
Expected (about 20 s):
```
PASS error card when ea_room_state fails
PASS dead_link card, no title
PASS landing card with a key: Sign in to join → /login/?next=…
PASS landing card without a key → /login/?next=%2Froom%2F
PASS not_allowed card → /pricing/
PASS host_idle: control with title, link from ea_rooms, Copy link
PASS host_idle: Start class → room live → joined starts recording → Leave ends it (no reload)
PASS host_live: reload re-enters the running class, no new live_since, Leave still ends it
PASS host_live: join refused → control stays, End session stops + flips off air (no reload)
PASS waiting: the v2 waiting screen, then live → reload → auto-enter
PASS student: join with the key, enter, the strip says recorded, poll sees off air → leave + ended card
PASS student: the kit says ended → ended card
PASS student: the kit says kicked → ended card
PASS student: Leave → You left the room + Rejoin reloads
PASS join refused: room_full → The room is full right now.
PASS join refused: bad_link → This link isn’t active anymore — ask Nelson for the new one.
PASS join refused: not_open → Nelson hasn’t started yet.
PASS join refused: slow_down → Too many tries — wait a minute and try again.
PASS join refused: not_allowed → You need Nelson’s link or an Academy membership.
PASS join refused: sign_in → Sign in again and retry.
PASS join refused: kaboom → The server said 500.
ALL PASS (21)
exit=0
```
Reading a FAIL: the line names the assertion (first line of the error only) and prints the last 8 console lines of the page. `waiting line:` or `strip:` mismatches mean Task 7's words threading (`ROOM_WORDS.waiting`, the `' · This session is being recorded'` suffix), not this page; `kickAll` = 0 means Task 7's room-mode Leave; `no reload while hosting` failing means a `location.reload()` crept onto the host path; a `pageerror: … room-page.js` 404 means Task 1 is not on the branch. Optional look: `ROOM_SHOTS=1 node harness/room-page.mjs` also writes `harness/shots/{landing,host-idle,waiting,ended}-{1280,400}.png`.

- [ ] **Step 6: Commit the page**

```bash
cd /Users/nelsontaylor/taylormade-academy && git add room/index.html && git commit -m "feat(academy): /room/ — the room page for everyone (landing, waiting, the room, Nelson's control)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Expected: `1 file changed, 288 insertions(+)` and `create mode 100644 room/index.html`.

- [ ] **Step 7: `build_site.py` stamps `/room/` like the hub pages**

Today, `/Users/nelsontaylor/taylormade-academy/build_site.py` lines 233-236 read:
```python
HUB_PAGES = ("opil/hub", "opil/hub/team", "opil/hub/messages", "opil/hub/admin",
             "opil/hub/judge", "opil/hub/live", "opil/hub/survey", "opil/showcase",
             "opil", "opil/register", "opil/verify", "opil/demo", "opil/proposal",
             "live")   # the Academy live room: hand-maintained, stamped like the hub pages
```
Replace them with exactly:
```python
HUB_PAGES = ("opil/hub", "opil/hub/team", "opil/hub/messages", "opil/hub/admin",
             "opil/hub/judge", "opil/hub/live", "opil/hub/survey", "opil/showcase",
             "opil", "opil/register", "opil/verify", "opil/demo", "opil/proposal",
             "live", "room")   # the Academy live page + room: hand-written, stamped like the hub pages
```
Leave the hash list (lines 15-19) and `_ASSET_RX` (line 215) alone — Task 9 adds `js/room-page.js` to both and removes the broadcast entries there; do not run `python3 build_site.py` in this task either (it rewrites generated pages, and the hash will move again in Task 9). Check the edit without building — importing the module only computes the asset hash (the build sits behind `if __name__ == "__main__":`, line 1037), and `PYTHONDONTWRITEBYTECODE=1` keeps Python from rewriting the tracked `__pycache__/build_site.cpython-314.pyc`:
```bash
cd /Users/nelsontaylor/taylormade-academy && PYTHONDONTWRITEBYTECODE=1 python3 -c "
import build_site as b, re
assert 'room' in b.HUB_PAGES, 'room missing from HUB_PAGES'
html = open('room/index.html').read()
new = b._ASSET_RX.sub(r'\1?v=NEW', b._HUB_ASSET_RX.sub(r'\1?v=NEW', html))
print('room in HUB_PAGES'); print(sorted(set(re.findall(r'/([\w/.-]+)\?v=NEW', new)))); print(re.findall(r'/([\w/.-]+)\?v=3ef77ddd84', new))
"; git status --short -uno
```
Expected:
```
room in HUB_PAGES
['css/build-mode.css', 'css/rtk-room-v2.css', 'js/config.js', 'js/rtk-room-v2.js', 'opil/hub/live-rooms.js']
['js/room-page.js']
 M build_site.py
```
(`js/room-page.js` is the one link left unstamped until Task 9. `-uno` hides untracked files — the working tree also carries the untracked plan document `docs/superpowers/plans/2026-09-14-academy-room.md`, which is not part of this task; the only tracked change must be `build_site.py`, and the `.pyc` must not appear.) Then:
```bash
cd /Users/nelsontaylor/taylormade-academy && git add build_site.py && git commit -m "feat(academy): build_site stamps /room/ like the hub pages

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Expected: `1 file changed, 1 insertion(+), 1 deletion(-)`.

- [ ] **Step 8: OPIL guard — nothing OPIL moved**

This task adds one page and one tuple entry; no OPIL file is touched. Prove it (the `tap` reporter is required: node v25's default `spec` reporter prints `ℹ pass 18`, which the grep would miss):
```bash
cd /Users/nelsontaylor/taylormade-academy && git diff --stat HEAD~2 HEAD && node --test --test-reporter=tap tests/opil/*.test.mjs 2>&1 | grep -E "^# (pass|fail)"
```
Expected: the stat lists exactly `build_site.py` and `room/index.html` (`2 files changed, 289 insertions(+), 1 deletion(-)`); then
```
# pass 18
# fail 0
```
Do not push. The rollout (Task 10) pushes after Task 9's `python3 build_site.py` restamps `/room/` and `/live/` together.

---

### Task 9: /live/ becomes the door; Your room card; broadcast retired; plumbing

**Files:**
- Create: `tests/academy/live-door.test.mjs` (committed; the static half of the task)
- Create: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/live-page.mjs` (Playwright harness, NOT committed)
- Modify: `live/index.html:1-494` (full rewrite of the file; header/nav/footer markup 108-151, the `.airchip`/`.nowline` CSS 37-44, the `.gatecard/.lockroom` CSS 63-84, the `.hiw` CSS 100-106 and the gate card 410-434 are kept verbatim — today's broadcast bits are line 152 `broadcast.css`, line 155 `import … "/js/broadcast.js…"` (the brief's "154-157" is off by three: 153 is `config.js`, keep it), 160 `DEMO_URL`, 174-209 `ea_live` / `ea_live_upcoming` reads, 211-312 `brandChrome/safeUrl/embedUrl/playerFail/mountStream` + hls, 323-376 `setLive/aDemo/aGo/wirePanel`, 378-391 `shellHTML/chatHTML`, 437-490 `wireChat`)
- Modify: `build_site.py:15-19` (hash list), `build_site.py:215` (`_ASSET_RX`), `build_site.py:233-236` (`HUB_PAGES` — Task 8 already added `"room"`; Step 4 verifies)
- Modify: `sw.js:6` (`VERSION`)
- Modify: `supabase/functions/README.md:89` (append a section after the last line)
- Delete: `js/broadcast.js`, `css/broadcast.css`, `supabase/functions/ea-live-publish/` (only `index.ts` inside)
- Test: `tests/academy/live-door.test.mjs` · the harness above · `tests/opil/*.test.mjs` (18, must stay green)

**Interfaces:**
- Consumes (Task 1, `js/room-page.js`): `statusLine(state)` → `'Off air'` | `'Live now · N people'`; `replayLabel(row)` → `'Replay preparing'` | `'Replay ready — review, then publish'` | `'Published ✓'` | `'Replay failed'`; `iframeUrl(watchUrl)` → `watchUrl.replace(/\/watch$/, '/iframe')`.
- Consumes (Task 2, migration 0036): `rpc ea_room_state()` (no key; anon + authenticated) returning `{ id, title, is_live, host_name, signed_in, is_host, can_join, bad_link, recording_url (members), people (admins) }`; `rpc ea_room_rotate_link()` → text; `rpc ea_room_publish_replay({ p_replay, p_publish })`; `ea_rooms` (admin select of `id, title, link_key, is_live, live_since, max_participants`; update grant on `title, is_live, max_participants, live_since, ended_at, updated_at`); `ea_room_replays` (admin select of the explicit 13-column list); `ea_room_members` (admin select); `ea_profiles.display_name`; `ea_is_member()`, `ea_is_admin()` (existing).
- Consumes (Task 5, `ea-rtk-record`): `POST { room:true, action:'stop' }` and `POST { room:true, action:'retry_replay', replay_id }` with `Authorization: Bearer <supabase access token>`.
- Consumes (Task 8): `/room/` exists (`#yrOpen` and `#joinRoom` link there) and `HUB_PAGES` already contains `"room"`.
- Produces (Task 10 relies on): `sw.js` `VERSION = 'tma-v21-academy-room'`; the three deletions (Task 10 runs `supabase functions delete ea-live-publish --project-ref pgqdmnmessbbzyszjfvr`); the harness `harness/live-page.mjs` (Task 10 re-runs it before the push); every generated page re-stamped to the new `ASSET_VER`.

OPIL stays byte-identical: this task touches no file under `opil/` and none of `js/rtk-room*.js`; Step 8 proves it with `node --test tests/opil/*.test.mjs` → 18 pass, and Step 9 proves the only lines that move under `opil/` are `?v=` stamps.

- [ ] **Step 1: Write the static test for the door and the plumbing (red)**

Create `tests/academy/live-door.test.mjs`:

```js
// tests/academy/live-door.test.mjs — run: node --test tests/academy/*.test.mjs
// The static half of Task 9: /live/ is the door, the broadcast is gone, the plumbing points at
// js/room-page.js. The page's behaviour is exercised by the scratchpad Playwright harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const live = readFileSync(new URL('../../live/index.html', import.meta.url), 'utf8');
const build = readFileSync(new URL('../../build_site.py', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../../supabase/functions/README.md', import.meta.url), 'utf8');

test('live/: the broadcast, the demo clip, hls and the ea_live chat are gone', () => {
  for (const dead of ['broadcast.js', 'broadcast.css', 'ea-live-publish', 'DEMO_URL', 'hls.js', 'mountStream', 'ea_live', 'wireChat', 'End broadcast'])
    assert.equal(live.includes(dead), false, dead + ' still in live/index.html');
});

test('live/: reads the room state and imports the pure helpers', () => {
  assert.match(live, /sb\.rpc\("ea_room_state"\)/);
  assert.match(live, /import \{ statusLine, replayLabel, iframeUrl \} from "\/js\/room-page\.js\?v=[a-z0-9]+"/);
  assert.match(live, /sb\.rpc\("ea_is_member"\), sb\.rpc\("ea_is_admin"\)/);
});

test('live/: every id the spine names is rendered', () => {
  for (const id of ['hTitle', 'hChip', 'admin', 'stage', 'joinRoom', 'replayFrame', 'replayOpen', 'yrLink', 'yrCopy', 'yrNew', 'yrTitle', 'yrMax', 'yrOpen', 'yrStatus', 'yrEnd', 'yrReplays', 'yrPeople', 'yrNote'])
    assert.ok(live.includes('id="' + id + '"'), 'id="' + id + '" missing');
});

test('live/: the replay iframe allow list, the explicit replay columns, the door copy', () => {
  assert.ok(live.includes('allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"'));
  assert.ok(live.includes('"id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at"'));
  assert.equal(live.includes('download_url'), false);
  assert.ok(live.includes('Nelson is live: '));
  assert.ok(live.includes('Nothing is live right now'));
  assert.ok(live.includes('<h3>The replay stays here</h3><p>Every published session, on this page, for members.</p>'));
  assert.ok(live.includes('The room chat sits next to the video.'));   // 02 keeps the room chat
});

test('live/: the admin writes go through the RPCs and the room row, never the link or meeting columns', () => {
  assert.match(live, /sb\.rpc\("ea_room_rotate_link"\)/);
  assert.match(live, /sb\.rpc\("ea_room_publish_replay", \{ p_replay: id, p_publish: on \}\)/);
  assert.ok(live.includes('action:"retry_replay", replay_id: id'));
  assert.equal(/update\(\{[^}]*(link_key|meeting_id)/.test(live), false);
});

test('build_site.py: hash list + _ASSET_RX carry js/room-page.js and no broadcast entries; HUB_PAGES has room', () => {
  assert.equal(build.includes('broadcast'), false);
  assert.ok(build.includes('"js/room-page.js",'));
  assert.ok(build.includes('js/room-page\\.js'));
  assert.match(build, /HUB_PAGES = \([^)]*"room"[^)]*\)/);
});

test('sw.js VERSION is bumped for the room', () => {
  assert.ok(sw.includes("const VERSION = 'tma-v21-academy-room';"));
});

test('the retired files are gone and the README says so', () => {
  for (const f of ['../../js/broadcast.js', '../../css/broadcast.css', '../../supabase/functions/ea-live-publish/index.ts'])
    assert.equal(existsSync(new URL(f, import.meta.url)), false, f + ' still exists');
  assert.ok(readme.includes('## RealtimeKit rooms'));
  assert.ok(readme.includes('supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr'));
  assert.ok(readme.includes('Retired 2026-09-14: `ea-live-publish`'));
});
```

Run it and see it fail:

```bash
node --test tests/academy/live-door.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)|AssertionError' | head -12
```

Expected:

```
  AssertionError [ERR_ASSERTION]: broadcast.js still in live/index.html
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /sb\.rpc\("ea_room_state"\)/. Input:
  AssertionError [ERR_ASSERTION]: id="joinRoom" missing
  ...
  AssertionError [ERR_ASSERTION]: ../../js/broadcast.js still exists
ℹ tests 8
ℹ pass 0
ℹ fail 8
```

- [ ] **Step 2: Write the Playwright harness for /live/ (red)**

Install Playwright in the scratchpad once (system Chrome, no browser download) and create the harness directory:

```bash
cd /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad && (ls node_modules/playwright/package.json >/dev/null 2>&1 || npm i playwright@1.47.2) && mkdir -p harness && cd /Users/nelsontaylor/taylormade-academy
```

Create `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/live-page.mjs`:

```js
// live-page.mjs — Task 9 page harness for /live/ (the door + Your room card).
// Run from the scratchpad:  REPO=/Users/nelsontaylor/taylormade-academy node harness/live-page.mjs
// Serves the repo root on 127.0.0.1:8770, stubs supabase-js / Google Fonts / the functions host.
// NEVER a real Supabase session: every rpc/from/auth call answers from the scenario below.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const REPO = process.env.REPO || '/Users/nelsontaylor/taylormade-academy';
const PORT = Number(process.env.PORT || 8770);   // PORT=8779 when another harness holds 8770
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(REPO, p);
  try { await stat(f); const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

/* The fake supabase-js: a chainable query builder whose result comes from window.__SB.db(st). */
const SB_STUB = `
export function createClient(){
  const S = window.__SB;
  window.__calls = window.__calls || [];
  const q = (table) => {
    const st = { table, op:'select', cols:'*', filters:[], order:null, limit:null, single:false, payload:null };
    const b = {};
    const chain = (k, f) => { b[k] = (...a) => { f(...a); return b; }; };
    chain('select', (c) => { if (st.op === 'select') st.cols = c; });
    chain('update', (p) => { st.op = 'update'; st.payload = p; });
    chain('insert', (p) => { st.op = 'insert'; st.payload = p; });
    chain('eq',  (k, v) => st.filters.push(['eq', k, v]));
    chain('gte', (k, v) => st.filters.push(['gte', k, v]));
    chain('in',  (k, v) => st.filters.push(['in', k, v]));
    chain('order', (k, o) => { st.order = [k, o || null]; });
    chain('limit', (n) => { st.limit = n; });
    chain('maybeSingle', () => { st.single = true; });
    b.then = (res, rej) => Promise.resolve().then(() => { window.__calls.push({ kind:'db', ...st }); return S.db(st); }).then(res, rej);
    return b;
  };
  return {
    auth: { getSession: async () => ({ data: { session: S.session || null } }) },
    rpc: async (name, args) => { window.__calls.push({ kind:'rpc', name, args: args || {} }); return S.rpc(name, args || {}); },
    from: q,
    channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
  };
}`;

const results = [];
const ok = (name, cond, detail = '') => { results.push([name, !!cond]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' — ' + detail)); };

const STATE = (o = {}) => ({ id: 'r1', title: 'Taylormade Academy Live', is_live: false, host_name: 'Nelson Taylor', signed_in: false, is_host: false, can_join: false, bad_link: false, recording_url: null, people: null, ...o });

const browser = await chromium.launch({ channel: 'chrome', headless: true });

/* scenario: { session, member, admin, state, rows (tables the fake db answers from), fn(body, page) (the functions host) } */
async function open(scenario) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  ctx.setDefaultTimeout(5000);
  await ctx.route('https://esm.sh/@supabase/supabase-js@2', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: SB_STUB }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const fn = [], ref = { page: null };
  await ctx.route(/functions\.supabase\.co\//, async r => {
    const req = r.request(); const body = JSON.parse(req.postData() || '{}');
    fn.push({ url: req.url(), body, auth: req.headers()['authorization'] || '' });
    const reply = scenario.fn ? await scenario.fn(body, ref.page) : { status: 200, body: { ok: true } };
    await r.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  });
  await ctx.addInitScript(`
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
    window.__SB = {
      session: ${JSON.stringify(scenario.session || null)},
      state: ${JSON.stringify(scenario.state)},
      rows: ${JSON.stringify(scenario.rows || {})},
      rpc(name, args) {
        if (name === 'ea_is_member') return { data: ${!!scenario.member}, error: null };
        if (name === 'ea_is_admin') return { data: ${!!scenario.admin}, error: null };
        if (name === 'ea_room_state') return { data: this.state, error: null };
        if (name === 'ea_room_rotate_link') { this.rows.ea_rooms[0].link_key = 'BBBBBBBBBBBBBBBBBBBBBB'; return { data: 'BBBBBBBBBBBBBBBBBBBBBB', error: null }; }
        if (name === 'ea_room_publish_replay') {
          const row = this.rows.ea_room_replays.find(r => r.id === args.p_replay);
          this.rows.ea_room_replays.forEach(r => { r.published = false; });
          row.published = !!args.p_publish; this.state.recording_url = args.p_publish ? row.watch_url : null;
          return { data: { ok: true }, error: null };
        }
        return { data: null, error: { message: 'unknown rpc ' + name } };
      },
      db(st) {
        const rows = this.rows[st.table] || [];
        if (st.op === 'update') { Object.assign(rows[0] || {}, st.payload); if (st.table === 'ea_rooms' && 'is_live' in st.payload) this.state.is_live = st.payload.is_live; return { data: null, error: null }; }
        let out = rows.slice();
        for (const [op, k, v] of st.filters) {
          if (op === 'eq') out = out.filter(r => r[k] === v);
          if (op === 'gte') out = out.filter(r => r[k] >= v);
          if (op === 'in') out = out.filter(r => v.includes(r[k]));
        }
        if (st.limit) out = out.slice(0, st.limit);
        return { data: st.single ? (out[0] || null) : out, error: null };
      }
    };
  `);
  const page = await ctx.newPage(); ref.page = page;
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/live/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  return { page, ctx, fn, errors };
}
/* null-safe readers: a missing element is a FAIL line, never a 30 s timeout */
const has = (page, sel) => page.locator(sel).count().then(n => n > 0);
const text = async (page, sel) => (await has(page, sel)) ? (await page.locator(sel).first().textContent() || '').replace(/\s+/g, ' ').trim() : null;
const attr = async (page, sel, name) => (await has(page, sel)) ? page.locator(sel).first().getAttribute(name) : null;
const val = async (page, sel) => (await has(page, sel)) ? page.locator(sel).first().inputValue() : null;
const click = async (page, sel) => { if (await has(page, sel)) await page.locator(sel).first().click(); };
const fillBlur = async (page, sel, v) => { if (await has(page, sel)) { await page.fill(sel, v); await page.locator(sel).blur(); await page.waitForTimeout(100); } };

/* ---------- 1. anon ---------- */
{
  const { page, ctx, errors } = await open({ state: STATE() });
  ok('anon: no page errors', errors.length === 0, errors.join(' | '));
  ok('anon: title from state', await text(page, '#hTitle') === 'Taylormade Academy Live');
  ok('anon: chip Off air', await text(page, '#hChip') === 'Off air');
  ok('anon: gate card Members only', await text(page, '#stage .gatecard .kicker') === 'Members only');
  ok('anon: See membership + sign-in link', await text(page, '#stage .cta-row a.btn.gold') === 'See membership →' && await attr(page, '#stage a.btn.ghost', 'href') === '/login/?next=/live/');
  ok('anon: no admin card, no Join button', !(await has(page, '#yrLink')) && !(await has(page, '#joinRoom')));
  await ctx.close();
}
/* ---------- 2. signed-in non-member, room live ---------- */
{
  const { page, ctx, errors } = await open({ session: { user: { id: 'u9', email: 'x@y.z' }, access_token: 'tok' }, member: false, admin: false, state: STATE({ signed_in: true, is_live: true, title: 'Prompt night' }) });
  ok('non-member: no page errors', errors.length === 0, errors.join(' | '));
  ok('non-member: chip LIVE NOW', await text(page, '#hChip') === 'LIVE NOW');
  ok('non-member: gate reads the room state', await text(page, '#stage .gatecard .kicker') === 'Happening right now' && await text(page, '#stage .gatecard h2') === 'Prompt night');
  ok('non-member: Unlock live + Back to dashboard', await text(page, '#stage .cta-row a.btn.gold') === 'Unlock live →' && await attr(page, '#stage a.btn.ghost', 'href') === '/dashboard/');
  ok('non-member: no Join button, no admin card', !(await has(page, '#joinRoom')) && !(await has(page, '#yrLink')));
  await ctx.close();
}
/* ---------- 3. member, off air, published replay ---------- */
{
  const watch = 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/abc123/watch';
  const { page, ctx, errors } = await open({ session: { user: { id: 'u2', email: 'm@y.z' }, access_token: 'tok' }, member: true, admin: false, state: STATE({ signed_in: true, can_join: true, recording_url: watch }) });
  ok('member off: no page errors', errors.length === 0, errors.join(' | '));
  ok('member off: Nothing is live right now', await text(page, '#stage h2') === 'Nothing is live right now');
  ok('member off: replay iframe uses /iframe', await attr(page, '#replayFrame', 'src') === 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/abc123/iframe');
  ok('member off: iframe allow list', await attr(page, '#replayFrame', 'allow') === 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen');
  ok('member off: Open in a new tab → /watch', await attr(page, '#replayOpen', 'href') === watch && await attr(page, '#replayOpen', 'target') === '_blank' && await text(page, '#replayOpen') === 'Open in a new tab');
  ok('member off: no Join button, no admin card', !(await has(page, '#joinRoom')) && !(await has(page, '#yrLink')));
  await ctx.close();
}
/* ---------- 4. member, live ---------- */
{
  const { page, ctx, errors } = await open({ session: { user: { id: 'u2', email: 'm@y.z' }, access_token: 'tok' }, member: true, admin: false, state: STATE({ signed_in: true, can_join: true, is_live: true, title: 'Prompt night' }) });
  ok('member live: no page errors', errors.length === 0, errors.join(' | '));
  ok('member live: heading', await text(page, '#stage h2') === 'Nelson is live: Prompt night');
  ok('member live: Join the room → /room/', await attr(page, '#joinRoom', 'href') === '/room/' && await text(page, '#joinRoom') === 'Join the room →');
  ok('member live: no replay frame', !(await has(page, '#replayFrame')));
  await ctx.close();
}
/* ---------- 5. admin, off air ---------- */
{
  const now = new Date().toISOString();
  const rows = {
    ea_rooms: [{ id: 'r1', title: 'Taylormade Academy Live', link_key: 'AAAAAAAAAAAAAAAAAAAAAA', is_live: false, live_since: '2026-09-13T01:00:00Z', max_participants: 50 }],
    ea_room_replays: [
      { id: 'p1', room_id: 'r1', meeting_id: 'm1', recording_id: 'rec1', status: 'ready', stream_uid: 'v1', watch_url: 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/v1/watch', duration_s: 120, file_size: 1, error: null, published: false, created_at: now, updated_at: now },
      { id: 'p2', room_id: 'r1', meeting_id: 'm0', recording_id: 'rec0', status: 'error', stream_uid: null, watch_url: null, duration_s: null, file_size: null, error: 'copy failed', published: false, created_at: '2026-09-12T01:00:00Z', updated_at: now },
    ],
    ea_room_members: [{ room_id: 'r1', user_id: 'u1', last_joined_at: '2026-09-13T01:05:00Z' }, { room_id: 'r1', user_id: 'u2', last_joined_at: '2026-09-13T01:06:00Z' }, { room_id: 'r1', user_id: 'u3', last_joined_at: '2026-09-01T01:00:00Z' }],
    ea_profiles: [{ user_id: 'u1', display_name: 'Ada' }],
  };
  const { page, ctx, fn, errors } = await open({
    session: { user: { id: 'nelson', email: 'n@y.z' }, access_token: 'tok-admin' }, member: true, admin: true,
    state: STATE({ signed_in: true, is_host: true, can_join: true, people: 0 }), rows,
    /* the server's Retry re-runs the stored upload event: the row reads 'uploaded' on the next poll */
    fn: async (body, page) => {
      if (body.action !== 'retry_replay') return { status: 200, body: { ok: true } };
      await page.evaluate((id) => { window.__SB.rows.ea_room_replays.find(r => r.id === id).status = 'uploaded'; }, body.replay_id);
      return { status: 200, body: { recording_id: 'rec0', status: 'uploaded' } };
    },
  });
  ok('admin: no page errors', errors.length === 0, errors.join(' | '));
  ok('admin: member stage below the card', await text(page, '#stage h2') === 'Nothing is live right now');
  ok('admin: link field', await val(page, '#yrLink') === 'https://taylormadeacademy.com/room/?k=AAAAAAAAAAAAAAAAAAAAAA');
  ok('admin: Open your room → /room/', await attr(page, '#yrOpen', 'href') === '/room/');
  ok('admin: status Off air, End hidden', await text(page, '#yrStatus') === 'Off air' && await page.locator('#yrEnd').isHidden());
  await click(page, '#yrCopy');
  ok('admin: Copy puts the link on the clipboard', await page.evaluate(() => window.__copied) === 'https://taylormadeacademy.com/room/?k=AAAAAAAAAAAAAAAAAAAAAA' && (await text(page, '#yrNote')).startsWith('Copied —'));
  await click(page, '#yrNew');
  const rotateCalls = () => page.evaluate(() => (window.__calls || []).filter(c => c.kind === 'rpc' && c.name === 'ea_room_rotate_link').length);
  ok('admin: New link first tap only arms', await text(page, '#yrNew') === 'Tap again to cut off the old link' && (await rotateCalls()) === 0);
  await click(page, '#yrNew');
  await page.waitForTimeout(100);
  ok('admin: second tap rotates', (await rotateCalls()) === 1 && await val(page, '#yrLink') === 'https://taylormadeacademy.com/room/?k=BBBBBBBBBBBBBBBBBBBBBB' && (await text(page, '#yrNote')).startsWith('New link made'));
  await fillBlur(page, '#yrTitle', 'Prompt night');
  const upd = await page.evaluate(() => (window.__calls || []).filter(c => c.kind === 'db' && c.op === 'update' && c.table === 'ea_rooms').map(c => [c.payload, c.filters]));
  ok('admin: title saves on blur', JSON.stringify(upd[0]) === JSON.stringify([{ title: 'Prompt night' }, [['eq', 'id', 'r1']]]) && await text(page, '#yrNote') === 'Saved — shows on the join screen' && await text(page, '#hTitle') === 'Prompt night');
  await fillBlur(page, '#yrMax', '10');
  const upd2 = await page.evaluate(() => (window.__calls || []).filter(c => c.kind === 'db' && c.op === 'update' && c.table === 'ea_rooms').map(c => c.payload));
  ok('admin: max saves on blur', JSON.stringify(upd2[1]) === JSON.stringify({ max_participants: 10 }) && (await text(page, '#yrNote')).startsWith('Saved — the room stops at 10 people'));
  await fillBlur(page, '#yrMax', '1');
  ok('admin: max below 2 refused', await val(page, '#yrMax') === '10' && await text(page, '#yrNote') === 'Max people must be between 2 and 500.');
  const cols = await page.evaluate(() => ((window.__calls || []).find(c => c.kind === 'db' && c.table === 'ea_room_replays') || {}).cols || null);
  ok('admin: replays select explicit columns', cols === 'id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at');
  ok('admin: two replay rows', await page.locator('#yrReplays .yr-replay').count() === 2);
  ok('admin: ready row label + Review + Publish', (await text(page, '#yrReplays .yr-replay[data-id="p1"] .lbl')) === 'Replay ready — review, then publish' && await attr(page, '#yrReplays .yr-replay[data-id="p1"] a', 'href') === 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/v1/watch' && await attr(page, '#yrReplays .yr-replay[data-id="p1"] a', 'target') === '_blank' && await text(page, '#yrReplays .yr-replay[data-id="p1"] button.pubReplay') === 'Publish to members');
  ok('admin: failed row label + Retry', (await text(page, '#yrReplays .yr-replay[data-id="p2"] .lbl')) === 'Replay failed' && await text(page, '#yrReplays .yr-replay[data-id="p2"] button.retryReplay') === 'Retry');
  await click(page, '#yrReplays .yr-replay[data-id="p1"] button.pubReplay'); await page.waitForTimeout(150);
  const pubCall = await page.evaluate(() => (window.__calls || []).find(c => c.kind === 'rpc' && c.name === 'ea_room_publish_replay') || null);
  ok('admin: Publish calls the rpc', JSON.stringify(pubCall && pubCall.args) === JSON.stringify({ p_replay: 'p1', p_publish: true }));
  ok('admin: row flips to Published ✓ + Unpublish', (await text(page, '#yrReplays .yr-replay[data-id="p1"] .lbl')) === 'Published ✓' && await text(page, '#yrReplays .yr-replay[data-id="p1"] button.pubReplay') === 'Unpublish');
  ok('admin: member stage now shows Last session', await attr(page, '#replayFrame', 'src') === 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/v1/iframe');
  await click(page, '#yrReplays .yr-replay[data-id="p1"] button.pubReplay'); await page.waitForTimeout(150);
  ok('admin: Unpublish flips the row back and clears Last session', (await text(page, '#yrReplays .yr-replay[data-id="p1"] .lbl')) === 'Replay ready — review, then publish' && await text(page, '#yrReplays .yr-replay[data-id="p1"] button.pubReplay') === 'Publish to members' && !(await has(page, '#replayFrame')));
  await click(page, '#yrReplays .yr-replay[data-id="p2"] button.retryReplay'); await page.waitForTimeout(150);
  const retry = fn.find(c => c.body.action === 'retry_replay') || null;
  ok('admin: Retry calls ea-rtk-record by replay id', !!retry && retry.url.endsWith('/ea-rtk-record') && JSON.stringify(retry.body) === JSON.stringify({ room: true, action: 'retry_replay', replay_id: 'p2' }) && retry.auth === 'Bearer tok-admin');
  ok('admin: retried row reads preparing', (await text(page, '#yrReplays .yr-replay[data-id="p2"] .lbl')) === 'Replay preparing');
  ok('admin: who joined = 2 people since live_since', (await text(page, '#yrPeople summary')) === 'Last session · 2 people');
  ok('admin: names from profiles, Member fallback', JSON.stringify(await page.locator('#yrPeople li').allTextContents()) === JSON.stringify(['Ada', 'Member']));
  await ctx.close();
}
/* ---------- 6. admin, a live row (stale or running elsewhere) ---------- */
{
  const rows = {
    ea_rooms: [{ id: 'r1', title: 'Prompt night', link_key: 'AAAAAAAAAAAAAAAAAAAAAA', is_live: true, live_since: new Date().toISOString(), max_participants: 50 }],
    ea_room_replays: [], ea_room_members: [], ea_profiles: [],
  };
  const { page, ctx, fn, errors } = await open({
    session: { user: { id: 'nelson', email: 'n@y.z' }, access_token: 'tok-admin' }, member: true, admin: true,
    state: STATE({ signed_in: true, is_host: true, can_join: true, is_live: true, title: 'Prompt night', people: 3 }), rows,
  });
  ok('admin live: no page errors', errors.length === 0, errors.join(' | '));
  ok('admin live: status line', await text(page, '#yrStatus') === 'Live now · 3 people' && await page.locator('#yrEnd').isVisible());
  ok('admin live: member stage says Join', await text(page, '#joinRoom') === 'Join the room →');
  await click(page, '#yrEnd');
  ok('admin live: End first tap arms', await text(page, '#yrEnd') === 'Tap again to end it for everyone' && fn.length === 0);
  await click(page, '#yrEnd'); await page.waitForTimeout(200);
  const stop = fn.find(c => c.body.action === 'stop') || null;
  const off = await page.evaluate(() => (window.__calls || []).find(c => c.kind === 'db' && c.op === 'update' && c.table === 'ea_rooms') || null);
  ok('admin live: End stops the recording and flips the row', !!stop && JSON.stringify(stop.body) === JSON.stringify({ room: true, action: 'stop' }) && off && off.payload.is_live === false && typeof off.payload.ended_at === 'string');
  ok('admin live: card and stage go off air', await text(page, '#yrStatus') === 'Off air' && await page.locator('#yrEnd').isHidden() && await text(page, '#stage h2') === 'Nothing is live right now');
  await ctx.close();
}

await browser.close(); server.close();
const failed = results.filter(r => !r[1]).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
```

Run it against today's page (from the repo root; `REPO` defaults to the repo):

```bash
node /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/live-page.mjs; echo "exit=$?"
```

Expected: `PASS` for the 14 checks today's page happens to satisfy (`anon: chip Off air`, the "no Join button" checks, …), `FAIL` lines for the rest, starting `FAIL anon: title from state —`, `FAIL non-member: gate reads the room state —`, `FAIL member off: replay iframe uses /iframe —` … `FAIL admin live: card and stage go off air —`, then `14/50 passed` and `exit=1`. If the run dies with `listen EADDRINUSE: address already in use 127.0.0.1:8770`, another harness holds the port — rerun with `PORT=8779 node …`.

- [ ] **Step 3: Rewrite live/index.html — the door for everyone, Your room for Nelson**

Replace the whole of `live/index.html` (today's lines 1-494) with this file. The three `?v=3ef77ddd84` stamps are today's; `build_site.py` restamps them in Step 9, so leave them as written even if the repo's current hash differs.

```html
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live · Taylormade Academy</title>
<meta name="description" content="Live classes with Nelson Taylor. Watch the build happen in real time, ask questions in the room, and keep the replay.">
<link rel="icon" href="/favicon.ico" sizes="any">
<meta name="theme-color" content="#04123a">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/build-mode.css?v=3ef77ddd84">
<script>document.documentElement.classList.add('js')</script>
<style>
.live-shell{padding-block:clamp(26px,4vw,52px) clamp(50px,7vw,90px)}
.live-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:clamp(20px,2.6vw,30px)}

/* ---- player (the published replay, members only) ---- */
.player{background:#000;border-radius:var(--r);overflow:hidden;border:1px solid var(--hair);box-shadow:var(--shadow-card);aspect-ratio:16/9;position:relative}
.player iframe{width:100%;height:100%;border:0;display:block;background:#000}
@keyframes lvpulse{0%,100%{opacity:1}50%{opacity:.3}}

.airchip{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:12.5px;padding:7px 14px;border-radius:var(--pill)}
.airchip.live{background:var(--emerald-soft);color:#067a56}
.airchip.live i{width:8px;height:8px;border-radius:50%;background:var(--emerald);animation:lvpulse 1.6s ease-in-out infinite}
.airchip.off{background:var(--bg-soft);color:var(--muted)}

.nowline{margin-top:16px;display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
.nowline h2{font-family:var(--display);font-size:clamp(19px,2.2vw,25px);letter-spacing:-.015em;margin:0}
.nowline p{color:var(--muted);font-size:14.5px;margin:0;max-width:62ch;line-height:1.6}

/* ---- member stage ---- */
.stagecard{background:var(--paper);border:1px solid var(--hair);border-radius:var(--r);box-shadow:var(--shadow-sm);padding:clamp(20px,3vw,30px)}
.stagecard .nowline{margin-top:0}
.stagecard .cta-row{margin-top:18px}
.stagecard .lastsess{margin-top:26px}
.stagecard .lastsess .kicker{margin-bottom:12px}
.replayline{margin:12px 0 0;font-size:13.5px}
.replayline a{color:var(--blue-deep);font-weight:600}
[hidden]{display:none!important}

/* ---- upsell / signed-out ---- */
.gatecard{background:var(--navy);color:#fff;border-radius:var(--r-lg);padding:clamp(26px,4vw,46px);box-shadow:var(--shadow-float);position:relative;overflow:hidden}
.gatecard::after{content:"";position:absolute;right:-90px;top:-90px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(253,201,33,.16),transparent 68%);pointer-events:none}
.gatecard h2{font-family:var(--display);font-size:clamp(24px,3.4vw,38px);letter-spacing:-.02em;margin:12px 0 0;max-width:20ch;line-height:1.1}
.gatecard p.lede{color:#c3cee6;font-size:16px;line-height:1.65;max-width:52ch;margin:16px 0 0}
.gatecard ul{list-style:none;padding:0;margin:26px 0 0;display:grid;gap:11px;max-width:54ch}
.gatecard li{display:flex;gap:11px;align-items:flex-start;font-size:15px;color:#e3e9f6;line-height:1.5}
.gatecard li svg{flex:none;margin-top:3px;color:var(--gold)}
.gate-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.85fr);gap:clamp(26px,4vw,54px);align-items:center;position:relative;z-index:1}
@media(max-width:980px){.gate-grid{grid-template-columns:minmax(0,1fr)}}
.lockroom{position:relative;border-radius:var(--r);overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 60px -26px rgba(0,0,0,.7);aspect-ratio:16/9;background:#000}
.lockroom img.fr{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.9) brightness(.82)}
.lockroom .bb{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:9px;padding:11px 14px;background:linear-gradient(rgba(4,18,58,.8),transparent)}
.lockroom .bb img{width:23px;height:23px}
.lockroom .bb b{font-family:var(--display);font-weight:600;color:#fff;font-size:12.5px}
.lockroom .bb .lv{margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,.2);border:1px solid rgba(16,185,129,.5);color:#7ce8c3;font-weight:700;font-size:10px;letter-spacing:.08em;padding:4px 10px;border-radius:var(--pill)}
.lockroom .bb .lv i{width:6px;height:6px;border-radius:50%;background:var(--emerald);animation:lvpulse 1.6s ease-in-out infinite}
.lockroom .bb .lv.off{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25);color:#c3cfe8}
.lockcap{margin-top:13px}
.lockcap .lk{display:inline-flex;align-items:center;gap:7px;color:var(--gold);font-size:11.5px;font-weight:700;letter-spacing:.07em;margin-bottom:5px}
.lockcap p{margin:0;font-size:13px;line-height:1.5;color:#c3cfe8}
@media(max-width:980px){.lockshell{order:-1;margin-bottom:6px}}

/* ---- Your room (admin) ---- */
.adminbar{background:var(--gold-soft);border:1px solid #f4e2ac;border-radius:var(--r);padding:16px 18px;margin-bottom:22px}
.adminbar .ah{display:flex;align-items:center;gap:10px;margin-bottom:13px}
.adminbar .ah b{font-family:var(--display);font-size:14px;color:var(--gold-ink)}
.adminbar .ah span{font-size:11.5px;font-weight:700;letter-spacing:.07em;color:#8a6d00;background:#fff;padding:3px 9px;border-radius:var(--pill)}
.adminrow{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
.adminrow input{flex:1;min-width:210px;padding:10px 14px;border:1px solid #eacf85;border-radius:10px;font:inherit;font-size:13.5px;background:#fff;outline-offset:2px}
.adminrow button{border:0;font:inherit;font-weight:600;font-size:13.5px;padding:10px 16px;border-radius:var(--pill);cursor:pointer;transition:transform .16s var(--ease)}
.adminrow button:active{transform:scale(.97)}
.adminrow .go{background:var(--navy);color:#fff}
.adminrow .end{background:var(--clay);color:#fff}
.adminrow .plain{background:#fff;color:var(--gold-ink);border:1px solid #eacf85}
.adminnote{font-size:12.5px;color:#8a6d00;margin:11px 0 0;line-height:1.5}
.yr-fields{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:9px;margin-bottom:9px}
@media(max-width:600px){.yr-fields{grid-template-columns:1fr}}
.yr-fields label{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:700;letter-spacing:.05em;color:#8a6d00}
.yr-fields input{padding:10px 14px;border:1px solid #eacf85;border-radius:10px;font:inherit;font-size:13.5px;font-weight:400;letter-spacing:0;color:var(--ink);background:#fff;outline-offset:2px}
.yr-sec{margin-top:16px;padding-top:14px;border-top:1px solid #f0dfa8}
.yr-sec>b{font-family:var(--display);font-size:13.5px;color:var(--gold-ink);display:block;margin-bottom:9px}
.yr-replay{display:flex;gap:9px;flex-wrap:wrap;align-items:center;padding:8px 0;border-top:1px dashed #f0dfa8;font-size:13.5px}
.yr-replay:first-child{border-top:0;padding-top:0}
.yr-replay .lbl{font-weight:600;color:var(--ink)}
.yr-replay .w{color:#8a6d00;font-size:12.5px}
.yr-replay a,.yr-replay button{font:inherit;font-weight:600;font-size:12.5px;padding:7px 12px;border-radius:var(--pill);cursor:pointer;background:#fff;color:var(--gold-ink);border:1px solid #eacf85;text-decoration:none}
.yr-replay button.pub{background:var(--navy);color:#fff;border-color:var(--navy)}
.yr-people summary{cursor:pointer;font-weight:600;font-size:13.5px}
.yr-people ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;line-height:1.7}
.yr-empty{font-size:13.5px;color:#8a6d00;margin:0}

/* ---- how it works ---- */
.hiw{margin-top:clamp(46px,6vw,78px);border-top:1px solid var(--hair);padding-top:clamp(30px,4vw,46px)}
.hiw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(18px,2.6vw,34px);margin-top:26px}
@media(max-width:900px){.hiw-grid{grid-template-columns:1fr;gap:22px}}
.hiw-grid h3{font-family:var(--display);font-size:19.5px;margin:0 0 8px;letter-spacing:-.015em}
.hiw-grid p{color:var(--muted);font-size:14.5px;line-height:1.65;margin:0}
.hiw-grid .n{font-family:var(--display);font-size:13px;color:var(--gold-ink);font-weight:700;letter-spacing:.06em;display:block;margin-bottom:11px}
</style>
</head><body><header class="site-header"><div class="wrap"><div class="bar">
<a class="brand" href="/"><img class="logo" src="/assets/logo-nav.webp" alt="" width="40" height="40" decoding="async"><span class="mark">Taylormade Academy</span></a>
<nav class="nav"><a class="navlink active" href="/live/">Live</a><a class="navlink" href="/join/">Community</a><a class="navlink" href="/store/">Store</a><a class="navlink" href="/pricing/">Pricing</a><a class="navlink" href="/about/">About</a></nav>
<div class="nav-cta"><a class="navlink" href="/login/">Sign in</a><a class="btn gold sm" href="/login/?mode=join">Join free <span class="arr">&rarr;</span></a>
<button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="mnav" onclick="var o=document.getElementById('mnav').classList.toggle('open');this.setAttribute('aria-expanded',o)"><span></span><span></span><span></span></button></div>
</div></div><div class="mobile-nav" id="mnav"><a href="/live/">Live</a><a href="/join/">Community</a><a href="/store/">Store</a><a href="/pricing/">Pricing</a><a href="/about/">About</a><a href="/login/">Sign in</a><a class="btn gold" href="/login/?mode=join">Join free</a></div></header>

<main><section class="section tight"><div class="wrap live-shell">

<div class="live-head">
  <div>
    <span class="kicker gold">Taylormade Academy Live</span>
    <h1 class="display-l" style="margin-top:11px" id="hTitle">The live room</h1>
  </div>
  <span class="airchip off" id="hChip">Off air</span>
</div>

<div id="admin"></div>
<div id="stage"></div>

<div class="hiw">
  <span class="kicker gold">How live works</span>
  <div class="hiw-grid">
    <div><span class="n">01</span><h3>You watch it get built</h3><p>Not a polished course. The real thing, in real time, including the parts that break and how I get out of them.</p></div>
    <div><span class="n">02</span><h3>You ask while it matters</h3><p>The room chat sits next to the video. Ask when you are stuck, not three days later in a comment section.</p></div>
    <div><span class="n">03</span><h3>The replay stays here</h3><p>Every published session, on this page, for members.</p></div>
  </div>
</div>

</div></section></main>

<footer class="site-footer"><div class="wrap">
<div class="foot-top">
<div class="foot-brand"><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px"><img class="logo" src="/assets/logo-nav.webp" alt="" width="40" height="40" decoding="async"></div><div class="mark">Taylormade Academy</div></div>
<p>Learn the craft and build real things: graphic design, photography, video, and AI. By Nelson Taylor, Dallas-Fort Worth.</p></div>
<div class="foot-col"><h4>Explore</h4><a href="/live/">Live</a><a href="/store/">Store</a><a href="/pricing/">Pricing</a><a href="/about/">About Nelson</a></div>
<div class="foot-col"><h4>Community</h4><a href="/community/">The feed</a><a href="/login/">Sign in</a><a href="/login/?mode=join">Join free</a></div>
<div class="foot-col"><h4>Account</h4><a href="/dashboard/">Dashboard</a><a href="/library/">My library</a></div>
</div>
<div class="foot-bottom"><span>&copy; 2026 Taylormade Creative. All rights reserved.</span>
<span style="display:flex;gap:18px;font-size:13px"><a href="/privacy/" style="color:#8fa0c7">Privacy</a><a href="/terms/" style="color:#8fa0c7">Terms</a><a href="/refunds/" style="color:#8fa0c7">Refunds</a></span>
<span class="mono">LEARN THE CRAFT / BUILD REAL THINGS</span></div>
</div></footer>

<script src="/js/config.js?v=3ef77ddd84"></script>
<script type="module">
import { statusLine, replayLabel, iframeUrl } from "/js/room-page.js?v=3ef77ddd84";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CFG = window.BM_CONFIG || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
/* The link people get is always the real address, whichever domain this page was opened on. */
const ROOM_ORIGIN = "https://taylormadeacademy.com";
/* Explicit columns: the raw download link on a replay row is server-only. */
const REPLAY_COLS = "id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at";

function when(iso){
  const d = new Date(iso), s = Math.floor((Date.now() - d.getTime())/1000);
  if (s < 60) return "just now";
  const m = Math.floor(s/60); if (m < 60) return m + "m";
  const h = Math.floor(m/60); if (h < 24) return h + "h";
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}

const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
let me = null, isMember = false, isAdmin = false, state = null, bootError = false;

/* One read path for everyone: the room's state, never its link or meeting. */
async function roomState(){
  const { data, error } = await sb.rpc("ea_room_state");
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") throw new Error("no room");
  return data;
}

try {
  const { data:{ session } } = await sb.auth.getSession();
  me = session ? session.user : null;

  /* Membership comes from the membership table, never from "a row came back".
     ea_is_member() already returns true for admins. */
  if (me) {
    const [{ data: mem }, { data: adm }] = await Promise.all([
      sb.rpc("ea_is_member"), sb.rpc("ea_is_admin")
    ]);
    isMember = !!mem; isAdmin = !!adm;
  }
  state = await roomState();
} catch (e) { bootError = true; }

/* ---------- header: every visitor ---------- */
function paintHead(){
  if (!state) return;
  $("hTitle").textContent = state.title;
  $("hChip").className = state.is_live ? "airchip live" : "airchip off";
  $("hChip").innerHTML = state.is_live ? "<i></i>LIVE NOW" : "Off air";
}
paintHead();

/* ---------- member stage: the door ---------- */
const stage = $("stage");
function memberStage(){
  if (state.is_live) {
    stage.innerHTML = '<div class="stagecard">' +
      '<div class="nowline"><h2>Nelson is live: ' + esc(state.title) + '</h2><p>Everyone on camera, chat open, questions taken in order.</p></div>' +
      '<div class="cta-row"><a id="joinRoom" class="btn gold" href="/room/">Join the room <span class="arr">&rarr;</span></a></div></div>';
    return;
  }
  let h = '<div class="stagecard"><div class="nowline"><h2>Nothing is live right now</h2><p>When Nelson starts a session, <b>Join the room</b> shows up here.</p></div>';
  /* the /watch page is Cloudflare's hosted player and refuses to embed; /iframe is the embeddable one */
  if (state.recording_url && /^https:\/\//.test(state.recording_url)) {
    h += '<div class="lastsess"><span class="kicker gold">Last session</span>' +
      '<div class="player"><iframe id="replayFrame" src="' + esc(iframeUrl(state.recording_url)) + '" title="Last session" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
      '<p class="replayline"><a id="replayOpen" href="' + esc(state.recording_url) + '" target="_blank" rel="noopener">Open in a new tab</a></p></div>';
  }
  stage.innerHTML = h + '</div>';
}

const check = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

if (bootError) {
  stage.innerHTML = '<div class="gatecard on-ink"><span class="kicker gold">Hold on</span>' +
    '<h2>The live room could not load.</h2>' +
    '<p class="lede">That is on us, not you. Refresh in a moment. If a class is running and this keeps happening, message me and I will get you in.</p>' +
    '<div class="acts"><a class="btn gold" href="/live/">Try again <span class="arr">&rarr;</span></a></div></div>';
} else if (isMember) {
  memberStage();
} else {
  const signedOut = !me, liveNow = !!state.is_live;
  stage.innerHTML =
    '<div class="gatecard on-ink"><div class="gate-grid"><div>' +
    '<span class="kicker gold">' + (liveNow ? "Happening right now" : "Members only") + '</span>' +
    '<h2>' + (liveNow ? esc(state.title) : "Live classes are part of the membership.") + '</h2>' +
    '<p class="lede">' + (liveNow
      ? "This one is on the air right now. Members are in the room watching it and asking questions as it happens."
      : "I teach live, on camera, building the actual thing. Members get the room, the questions, and every replay.") + '</p>' +
    '<ul>' +
    '<li>' + check + '<span>Live classes with the room chat open the whole time</span></li>' +
    '<li>' + check + '<span>Every replay, kept in your library</span></li>' +
    '<li>' + check + '<span>Every ebook and every video course on the shelf</span></li>' +
    '<li>' + check + '<span>Cancel anytime, 7-day refund</span></li>' +
    '</ul>' +
    '<div class="cta-row">' +
    '<a class="btn gold" href="/pricing/">' + (signedOut ? "See membership" : "Unlock live") + ' <span class="arr">&rarr;</span></a>' +
    (signedOut ? '<a class="btn ghost" href="/login/?next=/live/">I already have an account</a>' : '<a class="btn ghost" href="/dashboard/">Back to dashboard</a>') +
    '</div></div>' +
    '<div class="lockshell"><div class="lockroom">' +
      '<img class="fr" src="/assets/live-demo/poster.jpg" alt="Nelson teaching in the Taylormade Academy studio" loading="lazy">' +
      '<div class="bb"><img src="/assets/logo-nav.webp" alt=""><b>Taylormade Academy Live</b>' +
        (liveNow ? '<span class="lv"><i></i>LIVE</span>' : '<span class="lv off">MEMBERS</span>') + '</div>' +
    '</div>' +
    '<div class="lockcap"><span class="lk"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>MEMBERS ONLY</span><p>The room, the chat, and the replay open the moment you join.</p></div>' +
    '</div></div>';
}

/* ---------- Your room (admin only) ---------- */
if (isAdmin && !bootError) await yourRoom();

async function yourRoom(){
  const box = $("admin");
  let room = null, replays = [], newArmed = null, endArmed = null;
  let stageKey = String(state.is_live) + "|" + (state.recording_url || "");
  const note = (t) => { $("yrNote").textContent = t; };
  const linkOf = () => ROOM_ORIGIN + "/room/?k=" + room.link_key;
  const tokenOf = async () => (await sb.auth.getSession()).data.session?.access_token || "";
  /* every recording call is the room's: the server refuses anyone but Nelson (not_host) */
  async function recordCall(body){
    const r = await fetch(CFG.FUNCTIONS_BASE + "/ea-rtk-record", {
      method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer " + await tokenOf() },
      body: JSON.stringify(Object.assign({ room:true }, body))
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error({ no_replay: "that replay row is gone", nothing_to_retry: "that replay is not failed, so there is nothing to retry", no_upload: "that recording never finished uploading, so there is nothing to retry", not_host: "only Nelson can do that", no_room: "the room isn’t open yet", sign_in: "you were signed out — reload and sign in again", rtk_not_configured: "the recording service isn’t set up" }[d.error] || (/^cloudflare_/.test(String(d.error)) ? "the recording service didn’t answer" : "the server said " + r.status));
    return d;
  }

  async function loadRoom(){
    /* admin RLS lets this page read the link; meeting_id is never asked for */
    const { data, error } = await sb.from("ea_rooms").select("id, title, link_key, is_live, live_since, max_participants").order("created_at").limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("no room row yet — run migration 0036");
    room = data;
  }
  async function loadReplays(){
    const { data, error } = await sb.from("ea_room_replays").select(REPLAY_COLS).order("created_at", { ascending:false }).limit(5);
    if (!error) replays = data || [];
  }
  /* who joined the most recent session: rows since live_since, names from profiles */
  async function loadPeople(){
    if (!room.live_since) return [];
    const { data } = await sb.from("ea_room_members").select("user_id, last_joined_at").eq("room_id", room.id).gte("last_joined_at", room.live_since);
    const rows = data || [], names = {};
    if (rows.length) {
      const { data: profs } = await sb.from("ea_profiles").select("user_id, display_name").in("user_id", rows.map(r => r.user_id));
      (profs || []).forEach(p => { if (p.display_name) names[p.user_id] = p.display_name; });
    }
    return rows.map(r => names[r.user_id] || "Member");
  }

  try { await loadRoom(); } catch (e) {
    box.innerHTML = '<div class="adminbar"><div class="ah"><b>Your room</b><span>ADMIN ONLY</span></div><p class="adminnote">Could not load your room: ' + esc(e.message) + '</p></div>';
    return;
  }
  await loadReplays();

  box.innerHTML =
    '<div class="adminbar">' +
    '<div class="ah"><b>Your room</b><span>ADMIN ONLY</span></div>' +
    '<div class="adminrow" style="margin-bottom:9px">' +
      '<input id="yrLink" readonly aria-label="Your room link" value="' + esc(linkOf()) + '">' +
      '<button class="go" id="yrCopy" type="button">Copy link</button>' +
      '<button class="plain" id="yrNew" type="button">New link</button></div>' +
    '<div class="yr-fields">' +
      '<label>Title<input id="yrTitle" maxlength="120" value="' + esc(room.title) + '"></label>' +
      '<label>Max people (you included)<input id="yrMax" type="number" min="2" max="500" inputmode="numeric" value="' + esc(room.max_participants) + '"></label></div>' +
    '<div class="adminrow">' +
      '<a class="btn gold sm" id="yrOpen" href="/room/">Open your room <span class="arr">&rarr;</span></a>' +
      '<span class="airchip off" id="yrStatus">Off air</span>' +
      '<button class="end" id="yrEnd" type="button" hidden>End session</button></div>' +
    '<p class="adminnote" id="yrNote">Send the link to anyone. They sign in with their email and walk in when you start. New link cuts off everyone holding the old one.</p>' +
    '<div class="yr-sec"><b>Replays</b><div id="yrReplays"></div></div>' +
    '<div class="yr-sec"><b>Who joined</b><div id="yrPeople" class="yr-people"></div></div>' +
    '</div>';

  function paintStatus(){
    $("yrStatus").className = state.is_live ? "airchip live" : "airchip off";
    $("yrStatus").innerHTML = (state.is_live ? "<i></i>" : "") + esc(statusLine(state));
    $("yrEnd").hidden = !state.is_live;
  }
  function renderReplays(){
    const el = $("yrReplays");
    if (!replays.length) { el.innerHTML = '<p class="yr-empty">Nothing yet. Every session records itself and lands here as a draft.</p>'; return; }
    el.innerHTML = replays.map(r => {
      let acts = "";
      if (r.status === "ready" && r.watch_url) {
        acts = '<a href="' + esc(r.watch_url) + '" target="_blank" rel="noopener">Review</a>' +
          (r.published
            ? '<button type="button" class="pubReplay" data-id="' + esc(r.id) + '" data-pub="0">Unpublish</button>'
            : '<button type="button" class="pubReplay pub" data-id="' + esc(r.id) + '" data-pub="1">Publish to members</button>');
      } else if (r.status === "error") {
        acts = '<button type="button" class="retryReplay" data-id="' + esc(r.id) + '">Retry</button>' +
          '<span class="w" title="' + esc(r.error || "") + '">Press Retry. If it fails again, the original file is gone after 7 days.</span>';
      }
      return '<div class="yr-replay" data-id="' + esc(r.id) + '"><span class="lbl">' + esc(replayLabel(r)) + '</span><span class="w">' + esc(when(r.created_at)) + '</span>' + acts + '</div>';
    }).join("");
  }
  async function renderPeople(){
    const names = await loadPeople(), n = names.length;
    $("yrPeople").innerHTML = n
      ? '<details><summary>Last session &middot; ' + n + (n === 1 ? " person" : " people") + '</summary><ul>' + names.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></details>'
      : '<p class="yr-empty">No one has joined yet.</p>';
  }
  async function refresh(){
    try { state = await roomState(); await loadRoom(); await loadReplays(); } catch (e) { return; }
    paintHead(); paintStatus(); renderReplays(); await renderPeople();
    const key = String(state.is_live) + "|" + (state.recording_url || "");
    if (key !== stageKey) { stageKey = key; memberStage(); }   /* never re-create the replay iframe for nothing */
  }
  paintStatus(); renderReplays(); await renderPeople();

  /* poll while a session is live or a replay is still being prepared */
  const busy = () => !!state.is_live || replays.some(r => r.status !== "ready" && r.status !== "error");
  setInterval(() => { if (busy()) refresh(); }, 20000);

  $("yrCopy").addEventListener("click", async () => {
    const link = linkOf();
    try { await navigator.clipboard.writeText(link); note("Copied — the link is on your clipboard. Paste it anywhere you send it."); }
    catch (e) { $("yrLink").select(); note("The browser blocked copying — the link is selected, press Ctrl+C or Cmd+C."); }
  });
  /* two taps: a new link cuts off everyone holding the old one */
  $("yrNew").addEventListener("click", async () => {
    const btn = $("yrNew");
    if (!newArmed) {
      newArmed = setTimeout(() => { newArmed = null; btn.textContent = "New link"; }, 6000);
      btn.textContent = "Tap again to cut off the old link";
      return;
    }
    clearTimeout(newArmed); newArmed = null;
    btn.disabled = true; btn.textContent = "Making…";
    const { data, error } = await sb.rpc("ea_room_rotate_link");
    btn.disabled = false; btn.textContent = "New link";
    if (error || typeof data !== "string") { note("Could not make a new link: " + (error ? error.message : "no key came back")); return; }
    room.link_key = data; $("yrLink").value = linkOf();
    note("New link made — the old one is dead. Copy this one and send it.");
  });
  async function saveField(field, value, okNote){
    const patch = {}; patch[field] = value;
    const { error } = await sb.from("ea_rooms").update(patch).eq("id", room.id);
    if (error) { note("Could not save: " + error.message); return false; }
    room[field] = value; note(okNote); return true;
  }
  $("yrTitle").addEventListener("blur", async () => {
    const t = $("yrTitle").value.trim() || "Taylormade Academy Live";
    $("yrTitle").value = t;
    if (t === room.title) return;
    if (await saveField("title", t, "Saved — shows on the join screen")) { state.title = t; paintHead(); if (state.is_live) memberStage(); }
  });
  $("yrMax").addEventListener("blur", async () => {
    const n = Math.round(Number($("yrMax").value));
    if (!Number.isInteger(n) || n < 2 || n > 500) { $("yrMax").value = room.max_participants; note("Max people must be between 2 and 500."); return; }
    if (n === room.max_participants) return;
    await saveField("max_participants", n, "Saved — the room stops at " + n + " people, you included");
  });
  /* a session left live from a tab that died: stop the recording, flip the row off air */
  $("yrEnd").addEventListener("click", async () => {
    const btn = $("yrEnd");
    if (!endArmed) {
      endArmed = setTimeout(() => { endArmed = null; btn.textContent = "End session"; }, 6000);
      btn.textContent = "Tap again to end it for everyone";
      return;
    }
    clearTimeout(endArmed); endArmed = null;
    btn.disabled = true; btn.textContent = "Ending…";
    try { await recordCall({ action:"stop" }); } catch (e) { /* nothing recording is fine — the row still goes off air */ }
    const { error } = await sb.from("ea_rooms").update({ is_live:false, ended_at: new Date().toISOString() }).eq("id", room.id);
    btn.disabled = false; btn.textContent = "End session";
    if (error) { note("Could not end the session: " + error.message); return; }
    note("Session ended — the room is off air. A replay, if one was recording, lands under Replays in a few minutes.");
    await refresh();
  });
  $("yrReplays").addEventListener("click", async (ev) => {
    const pub = ev.target.closest(".pubReplay");
    if (pub) {
      const id = pub.dataset.id, on = pub.dataset.pub === "1";
      pub.disabled = true; pub.textContent = on ? "Publishing…" : "Unpublishing…";
      const { error } = await sb.rpc("ea_room_publish_replay", { p_replay: id, p_publish: on });
      if (error) { pub.disabled = false; pub.textContent = on ? "Publish to members" : "Unpublish"; note("Could not " + (on ? "publish" : "unpublish") + ": " + error.message); return; }
      note(on ? "Published — members see it under Last session on this page." : "Unpublished — members no longer see it on this page.");
      await refresh(); return;
    }
    const rt = ev.target.closest(".retryReplay");
    if (rt) {
      const id = rt.dataset.id; rt.disabled = true; rt.textContent = "Retrying…";
      try { await recordCall({ action:"retry_replay", replay_id: id }); }
      catch (e) { rt.disabled = false; rt.textContent = "Retry"; note("Could not retry: " + e.message); return; }
      note("Retrying — it shows as preparing here until Cloudflare finishes.");
      await refresh();
    }
  });
}
</script>
</body></html>
```

Design notes the engineer must not "improve": the gate card (signed-out / non-member) is today's markup with `state.is_live` / `state.title` in place of `liveNow` / `show.title`; `#yrEnd` and `#yrNew` are two-tap because a single tap on either cuts people off (End flips the row off air and every guest's 20 s poll then leaves the meeting); the max-people note says where the number bites ("the room stops at N people, you included") while the title note is the brief's "Saved — shows on the join screen"; `ROOM_ORIGIN` is hard-coded so the link Nelson copies is the real address even if he opened the page on the old domain; the replay iframe is re-created only when `is_live` or `recording_url` changes, never on a plain poll.

Run the harness green:

```bash
node /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/live-page.mjs; echo "exit=$?"
```

Expected: 50 `PASS …` lines, then `50/50 passed` and `exit=0`. (The page imports `/js/room-page.js` from Task 1 — if the run prints `FAIL anon: no page errors — TypeError: Failed to fetch dynamically imported module` the Task 1 file is missing; stop and finish Task 1 first.)

- [ ] **Step 4: build_site.py — hash list, `_ASSET_RX`, and confirm `HUB_PAGES` has `"room"`**

Edit `build_site.py` lines 15-19. Old:

```python
    for rel in ("css/build-mode.css", "js/site.js", "js/config.js", "js/pwa.js", "js/native.js", "js/meta-pixel.js",
                "css/agent.css", "js/agent.js", "js/founder.js",
                "opil/hub/hub.css", "opil/hub/hub.js", "opil/hub/tour.js", "opil/hub/live-rooms.js",
                "js/broadcast.js", "css/broadcast.css",
                "js/rtk-room.js", "css/rtk-room.css", "js/rtk-room-v2.js", "css/rtk-room-v2.css"):
```

New:

```python
    for rel in ("css/build-mode.css", "js/site.js", "js/config.js", "js/pwa.js", "js/native.js", "js/meta-pixel.js",
                "css/agent.css", "js/agent.js", "js/founder.js",
                "opil/hub/hub.css", "opil/hub/hub.js", "opil/hub/tour.js", "opil/hub/live-rooms.js",
                "js/room-page.js",
                "js/rtk-room.js", "css/rtk-room.css", "js/rtk-room-v2.js", "css/rtk-room-v2.css"):
```

Edit line 215. Old:

```python
_ASSET_RX = re.compile(r'(/(?:css/build-mode\.css|css/broadcast\.css|css/rtk-room\.css|css/rtk-room-v2\.css|js/site\.js|js/config\.js|js/founder\.js|js/broadcast\.js|js/rtk-room\.js|js/rtk-room-v2\.js))(?:\?v=[a-z0-9]+)?')
```

New:

```python
_ASSET_RX = re.compile(r'(/(?:css/build-mode\.css|css/rtk-room\.css|css/rtk-room-v2\.css|js/site\.js|js/config\.js|js/founder\.js|js/room-page\.js|js/rtk-room\.js|js/rtk-room-v2\.js))(?:\?v=[a-z0-9]+)?')
```

`HUB_PAGES` (today's lines 233-236) already contains `"room"` — Task 8 added it. Confirm:

```bash
grep -n '"room"' build_site.py
```

Expected: exactly one line, inside the `HUB_PAGES = (…)` tuple (today it is line 236, e.g. `             "live", "room")   # …`). If the grep prints nothing, Task 8 was skipped: change today's line 236 from

```python
             "live")   # the Academy live room: hand-maintained, stamped like the hub pages
```

to

```python
             "live", "room")   # the Academy live door + room: hand-maintained, stamped like the hub pages
```

- [ ] **Step 5: sw.js — bump VERSION**

Edit `sw.js` line 6. Old:

```js
const VERSION = 'tma-v20-room-v2-on';
```

New:

```js
const VERSION = 'tma-v21-academy-room';
```

(This bump also frees the bare `/opil/hub/live-rooms.js` cache entry the old static import pinned — spec §7.5.)

- [ ] **Step 6: Delete the broadcast files and the function**

```bash
git rm -q js/broadcast.js css/broadcast.css && git rm -q -r supabase/functions/ea-live-publish && git status --short | grep '^D'
```

Expected:

```
D  css/broadcast.css
D  js/broadcast.js
D  supabase/functions/ea-live-publish/index.ts
```

Prove nothing else references them (the only remaining mentions are the plan/spec docs under `docs/`, which the grep excludes):

```bash
grep -rln 'broadcast\.js\|broadcast\.css\|ea-live-publish' --include='*.html' --include='*.js' --include='*.py' --include='*.ts' --include='*.md' --include='*.sh' --exclude-dir=docs .
```

Expected: empty output (exit 1 from grep is fine — `--exclude-dir=docs` drops the plan/spec docs, which are the only remaining mentions).

- [ ] **Step 7: README — the RealtimeKit rooms section, ea-live-publish retired**

Append to `supabase/functions/README.md` after today's last line 89 (the closing ``` of the `ea-stripe-webhook` deploy block):

````markdown

## RealtimeKit rooms (OPIL class rooms 2026-09-11 · the Academy room 2026-09-14)

Three functions, all `verify_jwt` OFF with their own auth (Bearer user token → service-role
`auth.getUser` → role RPCs run **as the caller**), CORS locked to `https://taylormadeacademy.com`.
No Cloudflare credential ever reaches a page: pages only ever hold a per-person participant token.

| Function | verify_jwt | What it does | Secrets it reads |
| --- | --- | --- | --- |
| `ea-rtk-join` | false | Mints a RealtimeKit participant token. `{ session_no }` = an OPIL class (host / judge / cohort student presets). `{ room: true, key? }` = the Academy room: Nelson (`ea_is_admin`) gets a **fresh** meeting at every Start and the previous one is set INACTIVE; anyone else needs the current link key or a membership, the room must be live (< 4 h), the cap applies, and joins are rate-limited through `ea_rate_check`. Creates the `tma-class-host` / `tma-class-guest` presets the first time Nelson joins. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCOUNT_ID`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN` |
| `ea-rtk-record` | false | `start` / `stop` the meeting recording (OPIL by `session_no`, Academy with `{ room: true }`), `retry_replay` (OPIL by `session_no`, Academy by `replay_id`), `register_webhook` / `list_webhooks` (OPIL admin). Retry re-runs the stored UPLOADED event through the same Stream copy the webhook uses. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCOUNT_ID`, `CF_RTK_APP_ID`, `CF_RTK_API_TOKEN`, `CF_API_TOKEN` (Stream:Edit), `CF_STREAM_SUBDOMAIN` |
| `ea-rtk-webhook` | false (checks RealtimeKit's signature against its published public key; no browser calls it) | Recording status events → copy the file to Cloudflare Stream → a draft row in `ea_room_replays` (the meeting is looked up in `ea_rooms` first, then `ea_room_replays`) or `ea_opil_replays` (last). Nelson / the coordinator publish from the page. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN` (Stream:Edit), `CF_STREAM_SUBDOMAIN` |

Tests (stubbed fetch + supabase, Deno std 0.224.0 asserts):

```bash
deno test supabase/functions/ea-rtk-join/ supabase/functions/ea-rtk-record/ supabase/functions/ea-rtk-webhook/
```

Deploy (CLI):

```bash
supabase functions deploy ea-rtk-join    --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-rtk-record  --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
```

**Retired 2026-09-14: `ea-live-publish`** — the camera broadcast behind `js/broadcast.js`. The class
room is now the only way to go live on the Academy (`/live/` → `/room/`) as it already was on OPIL, so
the function directory, `js/broadcast.js` and `css/broadcast.css` are deleted from the repo. It is
removed from the project in the rollout with
`supabase functions delete ea-live-publish --project-ref pgqdmnmessbbzyszjfvr`. Its secrets
`CF_STREAM_INPUT_ID` and `CF_STREAM_WHIP_KEY` have no remaining reader. `ea_live`, `ea_live_chat` and
the Cloudflare Stream live input stay untouched: `/agent/live/` (the ticket-holder room) still reads them.
````

(The secrets column is what each `index.ts` + `_shared/replay_deps.ts` actually `Deno.env.get`s today: join reads the three RTK secrets, record additionally imports `replay_deps.ts` for Retry, the webhook never touches the RTK API token.)

```bash
git diff --stat -- supabase/functions/README.md
```

Expected: ` supabase/functions/README.md | 34 ++++++++++++++++++++++++++++++++++` (1 file changed, 34 insertions).

- [ ] **Step 8: Node tests green — the door test and the OPIL guard**

```bash
node --test tests/academy/live-door.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

Expected:

```
ℹ tests 8
ℹ pass 8
ℹ fail 0
```

OPIL byte-identical (this task changes no `opil/` file):

```bash
node --test tests/opil/*.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

Expected:

```
ℹ tests 18
ℹ pass 18
ℹ fail 0
```

Then the whole suite, which must report `ℹ fail 0`:

```bash
node --test tests/opil/*.test.mjs tests/academy/*.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

Expected: `ℹ tests` = 18 + Task 1's academy tests + 8, `ℹ fail 0`.

- [ ] **Step 9: Run the build, prove only `?v=` stamps moved, re-run the harness on the stamped page**

```bash
python3 build_site.py
```

Expected (the hash is whatever the changed asset set produces; it is NOT `3ef77ddd84` any more):

```
built: home, store, 2 product pages, pricing, about, community, + 4 stubs
built: 404.html, robots.txt, sitemap.xml
asset cache-bust version: <10 hex chars>
stamped app pages (asset ?v= only, bodies untouched): community, login, dashboard, library, welcome, review, course, founder
stamped hub pages (hub.css/hub.js ?v= only): opil/hub, opil/hub/team, opil/hub/messages, opil/hub/admin, opil/hub/judge, opil/hub/live, opil/hub/survey, opil/showcase, opil, opil/register, opil/verify, opil/demo, live, room
```

Show what moved:

```bash
git status --short | grep -v '\.html$'; echo "html files changed: $(git status --short | grep -c '\.html$')"
```

Expected non-html list: ` M __pycache__/build_agent.cpython-314.pyc`, ` M build_site.py`, `D  css/broadcast.css`, `D  js/broadcast.js`, ` M supabase/functions/README.md`, `D  supabase/functions/ea-live-publish/index.ts`, ` M sw.js`, `?? tests/academy/live-door.test.mjs`; and about 40 html files (the build rewrites every generated page and re-stamps every APP/HUB page, `room/index.html` included).

Prove every changed html line outside `live/index.html` is a `?v=` stamp — the `build_site.py` gotcha (it reverts hand edits to generated pages) shows up here as a non-`?v=` line:

```bash
git diff -U0 -- '*.html' ':!live/index.html' | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v '?v=' | wc -l
```

Expected: `0`. If it is not 0, print the offending lines with the same pipeline minus `| wc -l`, restore each such file with `git checkout -- <file>` (it keeps its old, still-valid stamp) and rerun the count until it is 0.

Prove OPIL only moved on stamps:

```bash
git diff -U0 -- opil/ js/rtk-room.js js/rtk-room-v2.js css/rtk-room.css css/rtk-room-v2.css | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v '?v=' | wc -l
```

Expected: `0`.

Drop the tracked bytecode the build touched (never commit it):

```bash
git checkout -- __pycache__/build_agent.cpython-314.pyc && git status --short | grep -c pycache
```

Expected: `0`.

The stamped page still works (its three stamps now read the new hash):

```bash
grep -c '?v=' live/index.html && node /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/live-page.mjs | tail -1
```

Expected: `3` then `50/50 passed`.

- [ ] **Step 10: Commit the door, the plumbing and the test**

```bash
git add live/index.html tests/academy/live-door.test.mjs build_site.py sw.js supabase/functions/README.md && git commit -q -m "feat(academy): /live/ is the door — Nelson's Your room card, Join the room, Last session replay; camera broadcast retired" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" && git show --stat HEAD | tail -9
```

Expected (the three `git rm` deletions were already staged in Step 6, so they ride in this commit):

```
 build_site.py                                |    6 +-
 css/broadcast.css                            |  <n> -
 js/broadcast.js                              |  <n> -
 live/index.html                              |  <n> +-
 supabase/functions/README.md                 |   34 +
 supabase/functions/ea-live-publish/index.ts  |  <n> -
 sw.js                                        |    2 +-
 tests/academy/live-door.test.mjs             |   66 +
 8 files changed, …
```

- [ ] **Step 11: Commit the re-stamped pages separately**

```bash
git add -A -- '*.html' && git status --short | grep -v '^[AMD] ' ; git commit -q -m "fix(academy): restamp ?v= on every page after the room-page / broadcast asset change" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" && git status --short | wc -l
```

Expected: the `grep` prints nothing (everything left is staged), the commit succeeds, and the final count is `0` (clean tree; `docs/superpowers/plans/2026-09-14-academy-room.md` may show as `??` if the plan file itself is still unstaged — leave it to the plan's own commit). Do not push — Task 10 pushes.

---

### Task 10: Rollout — apply, deploy, verify, the OPIL guard, the real run, cleanup, memory

**Files:**
- Create: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-sessions.sh` (read-only session dates; Nelson runs it with `!`)
- Create: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh` (read-only edge-function console output via the Management API — the installed Supabase CLI 2.75.0 has no `functions logs` subcommand)
- Create: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-guard-cleanup.sh` (deletes the finished draft OPIL replay the guard run creates)
- Create: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/room-cleanup.sh` (deletes the zz-test rows + the test replays, restores `max_participants = 50`)
- Create: `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/livefn/` (scratch workdir for `supabase functions download`, never the repo)
- Modify: `/Users/nelsontaylor/taylormade-academy/scripts/rtk-presets.ids` (untracked, listed in `scripts/.gitignore` — append the two new preset ids so `scripts/rtk-presets.sh` PATCHes instead of POSTing duplicates)
- Modify: `/Users/nelsontaylor/.claude/projects/-Users-nelsontaylor/memory/academy-room-project.md` (whole file)
- Modify: `/Users/nelsontaylor/.claude/projects/-Users-nelsontaylor/memory/MEMORY.md:54` (the ACADEMY ROOM index segment)
- Test: no new test files — this task RUNS every gate the earlier tasks wrote: `tests/opil/*.test.mjs`, `tests/academy/*.test.mjs`, `supabase/functions/ea-rtk-{join,record,webhook}/handler_test.ts`, and the three harnesses `room-v2.mjs` (T7), `room-page.mjs` (T8), `live-page.mjs` (T9) in `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness/`.
- Repo commits in this task: `docs(academy): Academy Room implementation plan` (Step 1, the plan doc is untracked today), and two conditional ones — `chore(academy): stamp assets after the room build` (Step 1) and `chore(academy): redeploy` (Step 6, only after a failed Pages run).

**Interfaces:**
- Consumes: `scripts/apply-0036.sh` (T2; prints the migration result `[{"status":"academy room ready"}]` then one `OK <check>` / `FAIL <check>` line per verify check) · `supabase/functions/ea-rtk-join`, `ea-rtk-record`, `ea-rtk-webhook` (T3–T6; deployed with `--no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`; secrets `CF_ACCOUNT_ID CF_RTK_APP_ID CF_RTK_API_TOKEN CF_API_TOKEN CF_STREAM_SUBDOMAIN` already set on 9/14) · `ensurePresets(cf)` (T4; runs on the host's join, creates `tma-class-host` + `tma-class-guest`) · `sw.js` `VERSION = 'tma-v21-academy-room'` (T9) · `room/index.html` ids `#rTitle #rLink #rCopy #rStart #rEnd #rNote #rRec` and `body.in-room` (T8) · `live/index.html` ids `#yrLink #yrCopy #yrNew #yrTitle #yrMax #yrOpen #yrStatus #yrReplays #yrPeople #yrNote`, `#joinRoom`, `#replayFrame`, `#replayOpen` (T9) · RPCs `ea_room_state(p_key)`, `ea_room_rotate_link()`, `ea_room_publish_replay(p_replay, p_publish)` · tables `ea_rooms ea_room_members ea_room_hands ea_room_replays ea_opil_replays ea_opil_sessions` · strings `ROOM_WORDS.waiting`, `joinErrorText(...)`, `statusLine(...)`, `replayLabel(...)` from the spine.
- Produces: the room LIVE at `https://taylormadeacademy.com/room/?k=<key>` with Nelson's card on `https://taylormadeacademy.com/live/`; the memory note + index line; the plain-words hand-off in Step 13. Nothing later depends on this task.

Every command below runs from the repo root unless it starts with `!` — a `!` line is typed by **Nelson into this Claude Code prompt, `!` included** (in Terminal the `!` silently runs nothing — [gotcha-bang-prefix-is-claude-code-only]). Claude never writes to prod: every SQL write in this task lives in a script Nelson runs with `!`. After every hand-off, read the pasted output yourself before moving on. `SP` below means `/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad` — always spelled out in the commands.

- [ ] **Step 1: Local gates — commit the plan, node tests (the OPIL byte-identical proof), the three deno suites, a clean build**

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && git branch --show-current && git status --short
  ```
  Expected: `domain-migration`, then either nothing or exactly one line `?? docs/superpowers/plans/2026-09-14-academy-room.md` (the plan itself is untracked today — no earlier task commits it). Anything else listed → an earlier task is unfinished: finish and commit it there first. If the plan line is there, commit it now:
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && git add docs/superpowers/plans/2026-09-14-academy-room.md && git commit -m "docs(academy): Academy Room implementation plan

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" && git status --short
  ```
  Expected: one commit line, then no output from `git status --short`.

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs
  ```
  Expected tail: `ℹ tests 18` / `ℹ pass 18` / `ℹ fail 0`. **This is the proof the OPIL words did not move** — `tests/opil/room-v2.test.mjs` asserts today's exact `nowCopy` / `joinCopy` strings through the `OPIL_WORDS` default (`live-rooms.test.mjs` covers `sessLabel`/`roomFromQuery`/`pickRoom`/`roomPath`/`liveListHTML`).

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/*.test.mjs tests/academy/*.test.mjs
  ```
  Expected tail: `ℹ pass` equals `ℹ tests` (18 + T1's `room-page.test.mjs` and `words.test.mjs` cases) and `ℹ fail 0`.

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-join/
  ```
  Expected last line: `ok | N passed | 0 failed` — N includes the six OPIL-branch cases spec §6.0 names (host preset, judge, cohort student, not_allowed, not_open, host creates a meeting) plus `client meeting_id ignored` and `room meeting refused`; those are the proof the OPIL join branch did not move.

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-record/
  ```
  Expected last line: `ok | N passed | 0 failed` with N ≥ 14 (today's 14, unchanged, + T5's room cases).

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && deno test supabase/functions/ea-rtk-webhook/
  ```
  Expected last line: `ok | N passed | 0 failed` with N ≥ 14 (today's 14, unchanged, + T6's room cases).

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && deno test --allow-read=scripts/rtk-presets supabase/functions/_shared/rtk_auth_test.ts supabase/functions/_shared/rtk_presets_test.ts
  ```
  Expected last line: `ok | 10 passed | 0 failed` (Task 3's 3 `clientIp` cases + Task 4's 7 `ensurePresets` cases; the last test logs `[rtk_presets] …` warnings on purpose).

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && PYTHONDONTWRITEBYTECODE=1 python3 build_site.py >/dev/null && git status --short
  ```
  Expected: no output — the committed pages ARE the built pages ([gotcha-build-site-reverts-hand-edited-generated-pages]). If files are listed: `git diff` and read it. Only `?v=` stamp changes → commit them:
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && git add -A && git commit -m "chore(academy): stamp assets after the room build

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
  ```
  Anything else in that diff (a reverted hand edit to `live/index.html` or `room/index.html`) → `git checkout -- <file>` to undo the build's revert, then fix the cause in `build_site.py` under T9's rules before going on.

  If any gate fails: do not continue. Fix it in the task that owns the file (the spine's file table), rerun this whole step.

- [ ] **Step 2: Local gates — the three Playwright harnesses (the Wednesday gate)**

  The harness directory also holds `shot.mjs` (a screenshot helper that needs `REPO` and a relative path) — never glob `*.mjs`; name the three files.
  ```bash
  H=/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness; ls -1 "$H/room-v2.mjs" "$H/room-page.mjs" "$H/live-page.mjs"
  ```
  Expected: the three paths, no `No such file` — a missing one means that task (T7 / T8 / T9) is not done; stop.

  ```bash
  H=/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/harness; lsof -ti :8770 | xargs -r kill; cd /Users/nelsontaylor/taylormade-academy && for h in "$H/room-v2.mjs" "$H/room-page.mjs" "$H/live-page.mjs"; do echo "== $h"; node "$h" || { echo "HARNESS FAILED: $h"; break; }; done
  ```
  Expected: for each file, `PASS <name>` lines and no `FAIL` or `LEAK` line; the closing lines are `ALL PASS` (room-v2.mjs), `ALL PASS (<n>)` (room-page.mjs) and `<n>/<n> passed` (live-page.mjs); the loop reaches the third file and never prints `HARNESS FAILED`. The room-v2 run must include the PASS lines for its Part A student path spec §10 names — `A1 student waiting`, `A4 student auto-enters after reload`, `A6 Ask a question → Bring on stage`, `A7 Leave`, `A8 ?classic=1`, `A9 OPIL error wording` — run against the changed `js/rtk-room-v2.js` with OPIL defaults. That run, not a prod click, is the gate for the 30 students on Wednesday 9/16.

  If a harness prints `FAIL`: read the line (room-page.mjs also prints the page's last console lines under it), fix in the owning task, rerun Steps 1–2. If it hangs on `chromium.launch`: `ls "/Applications/Google Chrome.app"` must exist (system Chrome, `channel: 'chrome'`). A `LEAK <url>` line means a request escaped to supabase.co / cloudflare / jsdelivr / esm.sh — a stub is missing; fix before anything else. Never point a harness at prod or sign in — the stubs are the point ([gotcha-e2e-hits-prod-supabase]).

- [ ] **Step 3: Migration 0036 — hand Nelson the `!` line, read every row**

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && bash -n scripts/apply-0036.sh && echo SYNTAX_OK && git log --oneline -1 -- scripts/apply-0036.sh supabase/migrations/0036_academy_room.sql
  ```
  Expected: `SYNTAX_OK` and one commit line (both files are committed by T2).

  Hand Nelson exactly this, and say where to type it — *in this Claude Code window, `!` included*:
  ```
  ! cd /Users/nelsontaylor/taylormade-academy && bash scripts/apply-0036.sh
  ```
  Expected output, in order: the migration result `[{"status":"academy room ready"}]`, then one `OK <check>` line per check T2's verify block prints. The spine leaves the check names to T2; read them against what spec §10 step 1 says they cover — `ea_room_new_key()` is 22 url-safe chars; as `anon`: the `ea_room_state()` shape, a bad key → `{"bad_link": true}`, zero rows (or permission denied) from every room table; as a non-admin `authenticated` user: `ea_rooms` insert refused, `meeting_id` update refused, `select download_url from ea_room_replays` refused, a hand insert with `staged_at` refused, a hand insert while not in session → `42501`, in session → ok; an OPIL-shaped `ea_opil_hands` insert as a cohort member → ok (**that last one is the OPIL proof for the migration**). Any line starting `FAIL` → stop.

  The migration is safe to re-run: fix `supabase/migrations/0036_academy_room.sql` (or the verify SQL), commit `db(academy): …`, hand the same line again. If the first result is an error object like `{"message":"…"}` instead of `academy room ready`, the migration itself failed — read the message; nothing after that statement ran (the CREATEs before it are `if not exists`, so a re-run is still safe). If the classifier blocks Claude from even reading the script, T2 already committed it, so the line above needs nothing from the scratchpad.

  Then the anon smoke from here (a read through PostgREST with the publishable key — not the Management API — so it is not a prod write; if the classifier denies it anyway, hand it to Nelson with `!`):
  ```bash
  curl -sS -X POST "https://pgqdmnmessbbzyszjfvr.supabase.co/rest/v1/rpc/ea_room_state" -H "apikey: sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz" -H "Content-Type: application/json" -d '{"p_key":"x"}' | jq -c .; curl -sS -X POST "https://pgqdmnmessbbzyszjfvr.supabase.co/rest/v1/rpc/ea_room_state" -H "apikey: sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz" -H "Content-Type: application/json" -d '{}' | jq -S .
  ```
  Expected: first line exactly `{"bad_link":true}`; then a sorted JSON object with `"bad_link": false`, `"can_join": false`, `"host_name": "Nelson Taylor"`, `"id": "<uuid>"`, `"is_host": false`, `"is_live": false`, `"people": null`, `"recording_url": null`, `"signed_in": false`, `"title": "Taylormade Academy Live"` — and no `link_key`, no `meeting_id`. (Today, before 0036, the same call answers HTTP 404 — checked 9/14.) If either differs, the function body in 0036 is wrong — fix, re-run Step 3.

- [ ] **Step 4: Pre-flight the functions — the live source must not be newer than the repo's starting point**

  ```bash
  mkdir -p /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/livefn && supabase functions download ea-rtk-join --project-ref pgqdmnmessbbzyszjfvr --use-api --workdir /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/livefn && supabase functions download ea-rtk-record --project-ref pgqdmnmessbbzyszjfvr --use-api --workdir /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/livefn && supabase functions download ea-rtk-webhook --project-ref pgqdmnmessbbzyszjfvr --use-api --workdir /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/livefn && find /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/livefn -name '*.ts' | sort
  ```
  Expected: seven paths under `…/livefn/supabase/functions/` — `ea-rtk-join/index.ts`, `ea-rtk-record/{index,handler}.ts`, `ea-rtk-webhook/{index,handler}.ts`, `_shared/replay_deps.ts`, `_shared/rtk_auth.ts` (the CLI writes beneath the workdir — never the repo).

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && L=/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/livefn/supabase/functions; for f in ea-rtk-join/index.ts ea-rtk-record/index.ts ea-rtk-record/handler.ts ea-rtk-webhook/index.ts ea-rtk-webhook/handler.ts _shared/replay_deps.ts _shared/rtk_auth.ts; do if git show "cb0f080:supabase/functions/$f" | diff -q - "$L/$f" >/dev/null; then echo "SAME $f"; else echo "DIFF $f"; fi; done
  ```
  Expected: seven `SAME` lines (`cb0f080` is the repo state before T3–T6; the same seven files were downloaded and diffed on 9/14 22:27 — all identical; live `ea-rtk-join` v1 was deployed 2026-09-11 14:23 UTC = commit 3596936, live record/webhook v3 on 9/14 21:28 UTC = commit eba1882). Any `DIFF` → prod was patched in-session after the commit ([gotcha-repo-edge-function-stale-vs-live]): stop, `diff` the two files, fold the live change into the repo's new version as its own commit (`fix(opil): fold the live <fn> patch into the repo`), re-run the three deno suites from Step 1, then continue.

- [ ] **Step 5: Deploy the three functions, one per command; delete `ea-live-publish`**

  One function per command — a `for` loop over `supabase functions deploy` gets classifier-blocked ([gotcha-repo-edge-function-stale-vs-live]).
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && supabase functions deploy ea-rtk-join --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
  ```
  Expected: `Deployed Functions on project pgqdmnmessbbzyszjfvr: ea-rtk-join` (after `Bundling` / `Deploying` lines).
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && supabase functions deploy ea-rtk-record --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
  ```
  Expected: `Deployed Functions on project pgqdmnmessbbzyszjfvr: ea-rtk-record`.
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
  ```
  Expected: `Deployed Functions on project pgqdmnmessbbzyszjfvr: ea-rtk-webhook`.
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && supabase functions delete ea-live-publish --project-ref pgqdmnmessbbzyszjfvr
  ```
  Expected: `Deleted Function ea-live-publish from project pgqdmnmessbbzyszjfvr.` (the old `/live/` Broadcast control stops working for the minutes until Step 7 lands — only Nelson ever saw it).

  Verify:
  ```bash
  supabase functions list --project-ref pgqdmnmessbbzyszjfvr -o json 2>/dev/null | jq -r '.[] | select(.slug | test("ea-rtk|ea-live-publish")) | "\(.slug)\t\(.status)\t\(.version)"'
  ```
  Expected: exactly three lines — `ea-rtk-join	ACTIVE	2`, `ea-rtk-record	ACTIVE	4`, `ea-rtk-webhook	ACTIVE	4` (versions were 1 / 3 / 3 on 9/14) and no `ea-live-publish` line.
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-rtk-join" -H "Origin: https://taylormadeacademy.com" -H "Content-Type: application/json" -d '{"room":true}'; curl -sS -X POST "https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-rtk-join" -H "Origin: https://taylormadeacademy.com" -H "Content-Type: application/json" -d '{"room":true}'; echo; curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-live-publish" -H "Content-Type: application/json" -d '{}'
  ```
  Expected: `401`, then `{"error":"sign_in"}` (no bearer → the new code answers before touching Cloudflare), then `404` (the deleted function is gone).

  Write the log reader now — every "read the function's logs" fallback below uses it, because `supabase functions logs` does not exist in CLI 2.75.0 (`supabase functions --help` lists only delete / deploy / download / list / new / serve):
  ```bash
  mkdir -p /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout && cat > /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh <<'EOF'
#!/usr/bin/env bash
# READ-ONLY. Prints the last N minutes of console output from ONE edge function, newest first.
# (Supabase CLI 2.75.0 has no `functions logs`; this reads the Management API logs endpoint —
# the same rows the dashboard's Edge Functions → <fn> → Logs tab shows.) Never prints the token.
#   bash fn-logs.sh ea-rtk-webhook 15
set -euo pipefail
FN="${1:?usage: fn-logs.sh <function slug> [minutes, default 15]}"
MIN="${2:-15}"
REF=pgqdmnmessbbzyszjfvr
RAW=$(security find-generic-password -s "Supabase CLI" -w); SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
ID=$(supabase functions list --project-ref "$REF" -o json 2>/dev/null | jq -r --arg s "$FN" '.[] | select(.slug == $s) | .id')
[ -n "$ID" ] || { echo "no function named $FN on $REF"; exit 1; }
START=$(date -u -v "-${MIN}M" +%Y-%m-%dT%H:%M:%SZ); END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
Q="select id, function_logs.timestamp, event_message, metadata.level from function_logs cross join unnest(metadata) as metadata where metadata.function_id = '$ID' order by timestamp desc limit 200"
curl -sS -G "https://api.supabase.com/v1/projects/$REF/analytics/endpoints/logs.all" \
  --data-urlencode "sql=$Q" --data-urlencode "iso_timestamp_start=$START" --data-urlencode "iso_timestamp_end=$END" \
  -H "Authorization: Bearer $SB_TOKEN" \
  | jq -r '.error // empty, (.result[] | "\(.timestamp / 1000000 | todate)\t\(.level)\t\(.event_message)")'
EOF
  bash -n /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh && echo SYNTAX_OK && bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh ea-rtk-join 60 | head -3
  ```
  Expected: `SYNTAX_OK`, then up to three tab-separated lines like `2026-09-15T03:31:14Z	log	booted (time: 32ms)` from the deploy (verified against the real endpoint 9/14: both `iso_timestamp_start` and `iso_timestamp_end` are required or the result is empty). If the classifier denies the curl, hand the same line to Nelson with `! ` in front; the dashboard path is the same data — Supabase dashboard → Edge Functions → `<fn>` → **Logs** tab, last 15 minutes.

  If a deploy is classifier-denied: hand Nelson the same command with `! ` in front, one line at a time, and re-run the `functions list` check after each. If a deploy fails on a type error, `deno check supabase/functions/<fn>/index.ts` locally, fix in the owning task, commit `fix(academy): …`, redeploy that one function.

- [ ] **Step 6: Push pages — `git push origin domain-migration:main` — and wait for Pages**

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && grep -n "const VERSION" sw.js && git log --oneline origin/main..domain-migration | wc -l && git log --oneline origin/main..domain-migration | tail -1
  ```
  Expected: `6:const VERSION = 'tma-v21-academy-room';`, a commit count > 0, and the oldest outgoing commit is `cb0f080 docs(academy): Academy Room design spec — the OPIL class room on /room/, one link, sign-in first` (the spec was never pushed — `origin/main` sat at `06ad7d6` on 9/14; everything above it is T1–T9 work plus the plan). If VERSION still reads `tma-v20-room-v2-on`, T9 is not done — stop.

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && git push origin domain-migration:main
  ```
  Expected: a line ending `domain-migration -> main` (e.g. `06ad7d6..<sha>  domain-migration -> main`). Push to main is not classifier-blocked ([gotcha-prod-deploy-classifier-use-bang-script]); if it is denied anyway, hand Nelson `! cd /Users/nelsontaylor/taylormade-academy && git push origin domain-migration:main`.

  ```bash
  cd /Users/nelsontaylor/taylormade-academy && sleep 5; gh run watch "$(gh run list --workflow deploy-pages.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
  ```
  Expected: it ends with `✓ … Deploy BUILD MODE to Pages` and `completed with 'success'` (the 9/14 runs took 20–26 s). Then `gh run list --workflow deploy-pages.yml --limit 1` shows `completed	success	<your newest commit message>`.

  If the run shows `failure`: **never `gh run rerun`** — the rerun uploads a second `github-pages` artifact and `deploy-pages@v4` refuses it for good ([gotcha-pages-rerun-duplicate-artifact]). Push an empty commit instead:
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && git commit --allow-empty -m "chore(academy): redeploy

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" && git push origin domain-migration:main
  ```
  and watch the new run the same way.

- [ ] **Step 7: Verify on the BARE urls with curl, then in a real browser after a hard reload**

  taylormadeacademy.com is served by GitHub Pages directly (`server: GitHub.com`, `cache-control: max-age=600`, no Cloudflare cache in front — checked 9/14), so the CDN can hand back the previous build for up to 10 minutes; the `age:` header says how old the copy is. Bare urls only — `?cb=` is a false green ([gotcha-verify-deploys-on-the-bare-url]).
  ```bash
  curl -sSD - https://taylormadeacademy.com/room/ -o /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/room.html | grep -iE '^(HTTP|age:)'; grep -c 'id="rtkMount"' /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/room.html; grep -o '/js/room-page.js?v=[a-z0-9]*' /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/room.html
  ```
  Expected: `HTTP/2 200`, `age: 0` (or small), `1`, and `/js/room-page.js?v=<10 hex chars>` (the stamped import — proves `build_site.py` stamped `/room/` through `HUB_PAGES` + `_ASSET_RX`). A `404` on `/room/` means the commit that adds `room/index.html` is not on main — check `git log origin/main --oneline -3`.
  ```bash
  curl -sS https://taylormadeacademy.com/live/ -o /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/live.html; grep -c 'The replay stays here' /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/live.html; grep -c 'broadcast.js' /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/live.html; curl -sS https://taylormadeacademy.com/sw.js | grep -m1 'const VERSION'; for u in /js/broadcast.js /css/broadcast.css; do curl -sS -o /dev/null -w "%{http_code} $u\n" "https://taylormadeacademy.com$u"; done
  ```
  Expected: `1` (the new "How live works" 03 copy is static HTML), `0` (no broadcast import), `const VERSION = 'tma-v21-academy-room';`, then `404 /js/broadcast.js` and `404 /css/broadcast.css`. If any number is the old one and `age:` was > 0, the CDN copy is stale: re-run this exact command after a minute (up to ten) — do NOT add a query string to "make it pass".

  Real browser (Nelson, or Claude in Chrome on Nelson's signed-in profile — load `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__javascript_tool` first): open `https://taylormadeacademy.com/live/`, hard reload (Cmd+Shift+R), then in the console:
  ```js
  (await caches.keys()).join(' | ')
  ```
  Expected: contains `tma-app-tma-v21-academy-room` and `tma-rt-tma-v21-academy-room` and NO `tma-v20` name (the activate handler deleted every cache not matching the new VERSION — [gotcha-unversioned-assets-opil-hub]). The page shows Nelson's **Your room** card (`#yrLink` filled with `https://taylormadeacademy.com/room/?k=` + a 22-char key, `#yrStatus` reads `Off air`, `#yrMax` reads `50`) and no Broadcast control. If old caches remain: DevTools → Application → Service Workers → **Update**, reload, check again; if the card is missing, `navigator.serviceWorker.controller?.scriptURL` and `document.documentElement.outerHTML.includes('The replay stays here')` tell you whether the browser is running the new page.

- [ ] **Step 8: OPIL guard on prod — a session that is NOT the 9/16 orientation, Start → Enter → Leave, `?classic=1`, delete the draft**

  Write the read-only session lookup for Nelson (a `database/query` call — the classifier treats it as a prod deploy even for reads, [gotcha-prod-deploy-classifier-use-bang-script]):
  ```bash
  mkdir -p /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout && cat > /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-sessions.sh <<'EOF'
#!/usr/bin/env bash
# READ-ONLY. Lists every OPIL session with its date, so the guard run uses a session that is
# NOT Wednesday 2026-09-16 (orientation) and is not live. Token from the keychain, curl only.
set -euo pipefail
S=/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout
API=https://api.supabase.com/v1/projects/pgqdmnmessbbzyszjfvr/database/query
RAW=$(security find-generic-password -s "Supabase CLI" -w); SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
jq -n --arg q "select no, kind, session_date, is_live, title from public.ea_opil_sessions order by session_date nulls last, no;" '{query:$q}' > "$S/body-sessions.json"
curl -sS -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$S/body-sessions.json" \
  | jq -r '.[] | "\(.no)\t\(.kind)\t\(.session_date)\t\(.is_live)\t\(.title)"'
EOF
  bash -n /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-sessions.sh && echo SYNTAX_OK
  ```
  Expected: `SYNTAX_OK`. Hand Nelson:
  ```
  ! bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-sessions.sh
  ```
  Expected: one tab-separated row per session (`no  kind  session_date  is_live  title`). Pick a session whose `session_date` is NOT `2026-09-16` and whose `is_live` is `false` — prefer **02** if its date qualifies (it already carries the 9/14 test replay). Call its `no` **N** and note the current UTC time as **START**: `date -u +%Y-%m-%dT%H:%M:%SZ`. If the keychain read fails (`security: … could not be found`), fallback: Nelson reads the dates off `https://taylormadeacademy.com/opil/hub/admin/` (the coordinator page prints each session's `session_date` under its title).

  The guard itself — Nelson, or Claude in Chrome on Nelson's signed-in profile (a real session, never a harness), on `https://taylormadeacademy.com/opil/hub/live/?s=N`:
  1. The Broadcast control shows **Start class — everyone on camera**. Click it → the v2 join screen (navy, camera preview, the word chips) with the button **Enter Class →** and the control note *Your room is open. Check your camera below and press Enter Class — the recording starts when you're in. Send students the link above; when you're done, press Leave and the session ends.* — OPIL's own words, unchanged.
  2. Click **Enter Class →** → in the room; within a few seconds the control's **Recording** chip shows and the strip chip reads `Recording · saves automatically for your students`.
  3. After ~30 s press **Leave** → `Leave class? Tap again` → press again → the room closes; the control note reads *Class ended — the replay is being prepared. It shows on your sessions page (Coordinator, or My sessions) when it is ready to review; students see it once it is published.* and the control is back to **Start class — everyone on camera**.
  4. Open `https://taylormadeacademy.com/opil/hub/live/?s=N&classic=1` → **Start class — everyone on camera** → the kit's OWN grey setup screen (an `<rtk-meeting>` element, not our navy join screen) and the control note *Class is running. Press Join in the room below to go on camera — share screen, the participants list, and chat appear after that. Send students the link above; they join you here. When you're done, press Leave in the room and the session ends.* — v1 loads. Do not Join. Open `https://taylormadeacademy.com/opil/hub/live/?s=N` (no `classic`) → the control shows **Class is running** + **End session** → click **End session** → the page reloads with **Start class — everyone on camera** back (recording only ever starts on the host's `joined`, so this v1 start records nothing).

  Expected on `https://taylormadeacademy.com/opil/hub/admin/` for session N: the row reads `● Recording this session…` while you are in, `Replay is being prepared…` after Leave, then `Replay ready — review it, then publish` with **Review** and **Publish to students** within a few minutes (`opil/hub/admin/index.html:423-425`). Do NOT publish. If any string in 1–4 differs from OPIL's text, or the join screen says "session" / "Nelson" / "people" anywhere: stop — the `words` default leaked. Fallback for Wednesday is the one-line flip of `ROOM_V2` in `opil/hub/live/index.html` (line 79) + push (~2 min); then fix T7.

  Delete the draft this created — only once its row reads `Replay ready…` (a row still `recording`/`uploading`/`uploaded` comes straight back: the webhook upserts on `recording_id`, `supabase/functions/_shared/replay_deps.ts:22`). Write the cleanup (Claude), Nelson runs it with N and START:
  ```bash
  cat > /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-guard-cleanup.sh <<'EOF'
#!/usr/bin/env bash
# Deletes the UNPUBLISHED, FINISHED ea_opil_replays row(s) the guard run created on session $1
# since $2 (UTC). Only rows whose status is 'ready' or 'error' are deleted: a row still
# 'recording'/'uploading'/'uploaded' would come straight back — the webhook upserts on
# recording_id (supabase/functions/_shared/replay_deps.ts) — so those are listed, not deleted.
# Published rows and rows older than $2 (the 9/14 test replay on 02) are never touched.
set -euo pipefail
NO="${1:?usage: opil-guard-cleanup.sh <session no> <start UTC, e.g. 2026-09-15T14:00:00Z>}"
START="${2:?usage: opil-guard-cleanup.sh <session no> <start UTC, e.g. 2026-09-15T14:00:00Z>}"
S=/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout
API=https://api.supabase.com/v1/projects/pgqdmnmessbbzyszjfvr/database/query
RAW=$(security find-generic-password -s "Supabase CLI" -w); SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
q() { jq -n --arg q "$1" '{query:$q}' > "$S/body.json"; curl -sS -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$S/body.json"; echo; }
echo "-- rows on session $NO since $START still in flight (must be [] before anything is deleted; wait and re-run if not):"
q "select id, status, created_at from public.ea_opil_replays where session_no = $NO and created_at >= '$START' and status not in ('ready','error');"
echo "-- deleted (id, status, stream_uid — delete each stream_uid in the Stream dashboard):"
q "delete from public.ea_opil_replays where session_no = $NO and published = false and created_at >= '$START' and status in ('ready','error') returning id, status, stream_uid, created_at;"
echo "-- left on session $NO since $START (must be 0):"
q "select count(*) as left_since_start from public.ea_opil_replays where session_no = $NO and created_at >= '$START';"
EOF
  bash -n /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-guard-cleanup.sh && echo SYNTAX_OK
  ```
  Hand Nelson (with the real values — example shown):
  ```
  ! bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/opil-guard-cleanup.sh 2 2026-09-15T14:00:00Z
  ```
  Expected: `[]` for the in-flight list, one deleted row with `"status":"ready"` and its `stream_uid`, then `[{"left_since_start":0}]`. Write the `stream_uid` down for Step 11. If the in-flight list is not `[]`, nothing was deleted — wait two minutes and re-run; if a row sits in `uploading`/`uploaded` for more than ten minutes, read the webhook's console: `bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh ea-rtk-webhook 30` (or the dashboard's Edge Functions → `ea-rtk-webhook` → Logs) — a `targetByMeeting` miss on an OPIL meeting means the room-first lookup swallowed it (a T6 bug): stop and fix before the real run.

- [ ] **Step 9: The first host open creates the presets — `/room/` → Start class; End session from `/live/`; confirm on Cloudflare; record the ids**

  Nelson opens `https://taylormadeacademy.com/room/` (no key). Expected: his control — `#rTitle` *Taylormade Academy Live*, `#rLink` the same link `/live/` shows, **Copy link**, and **Start class** (`#rStart`). Click **Start class** → the server creates the meeting and runs `ensurePresets()` on that join, the page flips the room live, and the join screen appears with **Enter Session →** (T8 adds `body.in-room` when the room mounts — its harness asserts `body.in-room on the join screen` — so the `/room/` control is hidden from here on; the no-enter way to end is `/live/`, spec §2.1). Do not enter.

  Open `https://taylormadeacademy.com/live/` in a second tab. Expected: `#yrStatus` reads `Live now · 0 people` (Nelson's own `ea_room_members` row is written inside the join, before `onOpened` sets `live_since`, so he is never in that count — see the T2 note in Step 10) and the card shows **End session**. Press **End session** (it asks you to tap again — do) → `#yrStatus` reads `Off air`, `#yrReplays` stays empty (`ea-rtk-record {stop}` with nothing recording is a no-op — start only fires on `joined`, and he never entered, so no replay row exists). Close the `/room/` tab.

  Then Cloudflare dashboard → **Realtime** → **RealtimeKit** → the app `0f38f396-7ab8-41ed-bc08-8cf48fa695c7` → **Presets**. Expected: `tma-class-host` and `tma-class-guest` listed beside `opil-host / opil-student / opil-judge / tma-webinar-*`. Open **tma-class-guest** → Chat: public **files OFF**, private **files OFF**, text ON; Media: camera / mic / screen share ALLOWED; Pin / Kick / Record OFF; waiting room SKIP. Open **tma-class-host** → identical to `opil-host` (pin, kick, record, screen share, transcription on).

  If a preset is missing: `bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh ea-rtk-join 30` (or the dashboard's Edge Functions → `ea-rtk-join` → Logs) — `ensurePresets` logs and never throws; a `401`/`403` from `GET /presets` means `CF_RTK_API_TOKEN` is not a Realtime Admin token (re-issue it in the dashboard, `supabase secrets set CF_RTK_API_TOKEN=… --project-ref pgqdmnmessbbzyszjfvr`, redeploy `ea-rtk-join`, Start class again and End session again). If files are still ON for the guest: the PATCH branch in `_shared/rtk_presets.ts` is wrong (T4) — fix, redeploy join, Start class again (the module-level cache is per isolate; a redeploy clears it).

  Record the ids (from each preset's page URL) in the untracked ids file so a future `scripts/rtk-presets.sh` PATCHes instead of POSTing duplicates — replace both `<id>`s with the real uuids:
  ```bash
  cd /Users/nelsontaylor/taylormade-academy && printf 'tma-class-host=<id>\ntma-class-guest=<id>\n' >> scripts/rtk-presets.ids && tail -2 scripts/rtk-presets.ids && git status --short scripts/
  ```
  Expected: the two lines echoed back and NO git change (the file is in `scripts/.gitignore`).

- [ ] **Step 10: The real run — Nelson hosts, a `zz-test-` guest in a second browser (spec §10 step 5, in this order)**

  Setup: a second browser = a Chrome **Incognito** window or Safari (its own cookies). The guest account is Nelson's own Gmail with a plus-alias so the 6-digit code lands in his inbox: `taylormademd+zz-test@gmail.com`, display name **zz-test guest** (a fresh auth user: `profiles.role` is not `admin` and there is no `ea_memberships` row, so it is a plain guest). Note the current UTC time as **START** (`date -u +%Y-%m-%dT%H:%M:%SZ`) — Step 11 deletes everything created after it. Keep the session running at least two minutes so the replay is worth watching (Cloudflare drops a recording that sits EMPTY for 60 s; with people in it that never triggers).

  a. **Cap to 2.** Nelson on `https://taylormadeacademy.com/live/`: set `#yrMax` to `2`, click away → `#yrNote` reads `Saved — the room stops at 2 people, you included`. Click **Copy link** → paste the link into Notes; it is `https://taylormadeacademy.com/room/?k=<22 chars>`.
  b. **Guest before the start.** Second browser → the link. Expected: the navy card *Nelson Taylor's room* · *Taylormade Academy Live* · **Sign in to join** → `/login/?next=%2Froom%2F%3Fk%3D…` → email → the 6-digit code (type it on the page, not the emailed link) → first time: `/welcome/` name `zz-test guest` → lands back on `/room/?k=…` → the v2 join screen in waiting mode: *Nelson hasn't started yet — we'll bring you in the moment he does.*
  c. **Nelson starts.** `https://taylormadeacademy.com/room/` → **Start class** → join screen (camera preview live, mic/camera chips, Effects) → **Enter Session →** → in the room. Within a few seconds `#rRec` shows; the strip reads `Nelson is live: Taylormade Academy Live` and the chip beside it reads `Recording · saves automatically for members` (the host sees the chip, never the "is being recorded" suffix — `js/rtk-room-v2.js:348`, line 317 before Task 7). On `/live/` (another tab) `#yrStatus` reads `Live now · 0 people` within 20 s — Nelson is not counted (T2 note: `people` counts `ea_room_members.last_joined_at >= live_since`; the host's row is upserted inside `ea-rtk-join`, and `live_since = now()` is written by the page's `onOpened`, which `js/rtk-room-v2.js:130-131` (105-106 before Task 7) runs only after the join returns).
  d. **The guest is walked in.** Within 20 s the waiting page reloads and auto-enters: muted, camera off; the guest's strip reads `Nelson is live: Taylormade Academy Live · This session is being recorded`. Nelson sees a tile named **zz-test guest**; the guest sees Nelson's tile with video and hears him. Guest taps the camera on → Nelson sees their video. `/live/` → `Live now · 1 person`.
  e. **Chat + the queue.** Guest sends a chat line → Nelson sees it; Nelson replies → guest sees it. Guest presses **Ask a question** → their page shows their place in line; Nelson's queue pane shows **zz-test guest** → **Bring zz-test guest on stage** → the guest's tile goes big on both screens (pin) → **Done** → the queue empties.
  f. **Share screen.** Guest → Tools → share screen (ALLOWED in `tma-class-guest`) → Nelson sees the shared screen → guest stops it.
  g. **Cap message.** Guest opens the SAME link in a **second tab** of the guest browser → the join screen refuses with `The room is full right now.` (Cloudflare's `live_participants` is 2 — Nelson counts there — and `max_participants` is 2). Close that tab.
  h. **Guest leaves and rejoins.** Guest presses **Leave** → `Leave session? Tap again` → again → *You left the room.* + **Rejoin →** → Rejoin → camera check → **Enter Session →** → back in.
  i. **New link kills the old.** Nelson on `/live/` → **New link** → tap again → `#yrLink` shows a different 22-char key. The guest already in the room STAYS in (T8's poll leaves only on `is_live:false` — a new link keeps people out, it does not pull them out; Remove is how you take someone out, spec §2.1 / §7.3 step 5). Guest presses **Leave** → *You left the room.* → **Rejoin →** (the page reloads on the OLD `?k=`) → `This link isn't active anymore — ask Nelson for the new one.` (no title shown). Give the guest the NEW link → camera check → **Enter Session →** → in again.
  j. **Remove → ended card.** Nelson → People → ⋮ on zz-test guest → **Remove** → the guest sees *This session has ended.* with *Members can rewatch it on the Live page* → `/live/` (a non-member lands on the gate card there). Guest reopens the new link → camera check → **Enter Session →** → in again (Remove is "for now"; New link is "for good").
  k. **Leave = end for everyone → replay → Publish.** Nelson presses **Leave** → `End the session for everyone? Tap again` → again → the guest sees *This session has ended.*; Nelson's `/room/` is back on the control with `#rStart`; `/live/` `#yrStatus` reads `Off air`; `#yrReplays` shows the newest row as `Replay preparing`. Wait (the 9/14 OPIL copy of 103 s took a few minutes): the row becomes `Replay ready — review, then publish` → **Review** opens the Stream `/watch` page and plays → **Publish to members** → `Published ✓`. Nelson's own `/live/` member stage (he passes `ea_is_member()` — admins do) now shows *Nothing is live right now* + **Last session** with the `#replayFrame` iframe on the `/iframe` url playing and **Open in a new tab** (`#replayOpen`) under it. `#yrPeople` reads `Last session · 1 person` with **zz-test guest** under the disclosure (Nelson's row predates `live_since` — same T2 note as c).
  l. **Members only.** Re-run the second anon curl from Step 3 (`-d '{}'`) → `"recording_url": null` for a signed-out visitor; the guest's `/live/` (signed in, not a member) shows the gate card, no replay. That is the members-only gate holding.

  What to do if a sub-step fails (fix in the owning task, rerun Steps 1–2, push, then repeat from the failed letter):
  - b shows the dead-link card for a fresh key → `roomBranch` order or `ea_room_state` `bad_link` logic (T1/T2).
  - c/d count is one short of the people in the room → expected for Nelson (his row predates `live_since`, T2/T8); one short for the GUEST → the join's `upsertMember` did not run or `live_since` was written after the guest's join (T4/T8).
  - d never walks the guest in → the 20 s poll / `location.reload()` on the `is_live` flip (T8) or the auto-enter key under `autoKey 'room:' + id` (T7).
  - g lets a third tab in → the `active-session` cap check counts wrong (T4) — `bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh ea-rtk-join 15` (or the dashboard Logs tab) for the `live_participants` value.
  - i lets the guest back in on the OLD link → `ea_room_state` did not answer `{bad_link:true}` for the rotated key (T2) or `roomBranch` puts `dead_link` after `landing` (T1). The guest STILL being in the room after New link is correct — T8's poll leaves only on `is_live:false`; never change that.
  - k stalls on `Replay preparing` for > 10 min → `bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/fn-logs.sh ea-rtk-webhook 30`: a `markFailed` line means the Stream copy failed → the row reads `Replay failed` → **Retry** on `/live/` (it sends `{room:true, action:'retry_replay', replay_id}`); a `targetByMeeting` miss means the room meeting was not found first (T6).
  - k's replay lands in `ea_opil_replays` instead → spec §9 invariant 6 broke (T6 lookup order) — stop, fix, and Step 11's last query will show it as `opil_rows_since_start` > 0; add `delete from public.ea_opil_replays where meeting_id = '<id>' and status in ('ready','error');` to that script for the one row.

- [ ] **Step 11: Cleanup — the test rows, the test replay, the Stream assets, `max_participants` back to 50**

  ```bash
  cat > /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/room-cleanup.sh <<'EOF'
#!/usr/bin/env bash
# After the real run: removes the zz-test guest's room rows, unpublishes + deletes every Academy
# replay created since $2 (all of them are test recordings — this was the first session ever),
# and puts the cap back to 50. The guest's auth account and profile stay (reusable for tests).
# Run it only after every replay row reads ready/error (a row still in flight comes back —
# the webhook upserts on recording_id); the first query lists any that are not.
set -euo pipefail
EMAIL="${1:?usage: room-cleanup.sh <guest email> <start UTC, e.g. 2026-09-15T14:00:00Z>}"
START="${2:?usage: room-cleanup.sh <guest email> <start UTC, e.g. 2026-09-15T14:00:00Z>}"
S=/private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout
API=https://api.supabase.com/v1/projects/pgqdmnmessbbzyszjfvr/database/query
RAW=$(security find-generic-password -s "Supabase CLI" -w); SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
q() { jq -n --arg q "$1" '{query:$q}' > "$S/body.json"; curl -sS -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$S/body.json"; echo; }
echo "-- the guest account (must be exactly one row):"
q "select id, email from auth.users where email = '$EMAIL';"
echo "-- replays since $START still in flight (must be [] — wait and re-run if not):"
q "select id, status, created_at from public.ea_room_replays where created_at >= '$START' and status not in ('ready','error');"
echo "-- hands deleted:"
q "delete from public.ea_room_hands where user_id in (select id from auth.users where email = '$EMAIL') returning id, kind;"
echo "-- membership rows deleted:"
q "delete from public.ea_room_members where user_id in (select id from auth.users where email = '$EMAIL') returning room_id, joins;"
echo "-- room: replay unpublished, cap back to 50:"
q "update public.ea_rooms set recording_url = null, max_participants = 50, updated_at = now() returning title, max_participants, recording_url, is_live;"
echo "-- test replays deleted (delete each stream_uid in the Stream dashboard):"
q "delete from public.ea_room_replays where created_at >= '$START' and status in ('ready','error') returning id, status, published, stream_uid, watch_url;"
echo "-- replays left (must be 0) and OPIL rows created since $START (must be 0 — an Academy recording must never file under OPIL):"
q "select (select count(*) from public.ea_room_replays) as room_replays_left, (select count(*) from public.ea_opil_replays where created_at >= '$START') as opil_rows_since_start;"
EOF
  bash -n /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/room-cleanup.sh && echo SYNTAX_OK
  ```
  Hand Nelson (real START from Step 10):
  ```
  ! bash /private/tmp/claude-501/-Users-nelsontaylor/e6304bda-fb21-47c7-9d25-7e2da3e6d71a/scratchpad/rollout/room-cleanup.sh taylormademd+zz-test@gmail.com 2026-09-15T14:00:00Z
  ```
  Expected: one account row; `[]` in flight; ≥ 1 hand deleted (`question`); one membership row (`joins` ≥ 4 — b/d, h, i, j); the room row with `"max_participants":50`, `"recording_url":null`, `"is_live":false`; one replay row deleted with a `stream_uid` and `"published":true`; then `[{"room_replays_left":0,"opil_rows_since_start":0}]`. If the in-flight list is not `[]`, the replay was deleted by nothing — wait for `ready` and re-run. If `opil_rows_since_start` is not 0, an Academy recording filed under OPIL — spec §9 invariant 6 — stop and fix T6 before announcing anything.

  Stream assets (dashboard, no API token in the shell): Cloudflare → **Stream** → **Videos** → delete the video named `Academy · Taylormade Academy Live · <YYYY-MM-DD>` (uid from the script above), the guard's `OPIL <N as two digits> · <title>` from Step 8 (e.g. `OPIL 02 · <title>` — the webhook writes `S<n>` only for curriculum sessions, `supabase/functions/ea-rtk-webhook/handler.ts:37-38`; uid from that script), and — while there — the 9/14 orphan (~100 s, `OPIL 02 · Your AI Research Team`, noted in [opil-auto-replays]). Then reload `https://taylormadeacademy.com/live/`: `#yrMax` reads `50`, `#yrReplays` is empty, `#yrStatus` `Off air`, the member stage says *Nothing is live right now* with no Last session.

  If the keychain read fails, the same statements pasted into the Supabase SQL editor (dashboard) do the job — give Nelson the SQL from the script, not the .sh.

- [ ] **Step 12: Memory — the project note goes LIVE, and the index line**

  The date below assumes the real run finished on 2026-09-15 and the guard used session 02 — change both to the real values. Overwrite `/Users/nelsontaylor/.claude/projects/-Users-nelsontaylor/memory/academy-room-project.md` with:
  ```markdown
  ---
  name: academy-room-project
  description: "Academy Room — LIVE 2026-09-15: the OPIL class room on Taylormade Academy at /room/?k=<key>; ONE room, sign-in first, the class room is the ONLY way to go live; Nelson's card on /live/ (link · New link · title · Max people · replays · who joined); verified with a second real person; what was left out (replays for guests, iOS untested), the count quirk, and how to clean up a test"
  metadata:
    node_type: memory
    type: project
    originSessionId: e6304bda-fb21-47c7-9d25-7e2da3e6d71a
    modified: 2026-09-15T00:00:00.000Z
  ---

  **LIVE 2026-09-15** on taylormadeacademy.com (main = `domain-migration`; migration 0036 applied by Nelson with `!`;
  `ea-rtk-join` v2, `ea-rtk-record` v4, `ea-rtk-webhook` v4 deployed; `ea-live-publish` deleted; sw `tma-v21-academy-room`).
  Spec `docs/superpowers/specs/2026-09-14-academy-room-design.md`, plan `docs/superpowers/plans/2026-09-14-academy-room.md`.

  Nelson, 2026-09-14: *"in taylormade academy i want to have the classroom feature like in the opil cohort and i want
  to be able to send a link to anyone i want to join me."*

  **Where things are.** His link lives on `/live/` → the **Your room** card (`https://taylormadeacademy.com/room/?k=<22 chars>`,
  Copy link, New link = two taps and cuts off everyone holding the old link, Title, Max people (you included, default 50),
  Open your room →, Off air / Live now · N people, Replays with Publish to members / Unpublish / Retry, Who joined).
  He hosts at `/room/` (no key): Start class → camera check → Enter Session → → the OPIL room v2 layout; the recording
  starts on his `joined`; **Leave = end for everyone** (two taps). A guest opens the link → signs in (email code, name once
  on /welcome/) → waits (*Nelson hasn't started yet…*, polled every 20 s) → walked in muted when he starts. Members join
  from `/live/` without the key and see the published replay there as **Last session**.

  **Decisions he made (do not re-ask):** sign-in first, then walk in · ONE room, one link (*"it's only one me i can only
  go live one at a time"*) · the class room is the ONLY way to go live on the Academy (camera broadcast, demo clip, End
  broadcast, `js/broadcast.js`, `css/broadcast.css`, `ea-live-publish` are gone; `ea_live`/`ea_live_chat` stay for
  `/agent/live/`) · replays are members-only; guests are told on the strip that it is recorded and never get the replay.

  **How it is wired.** `ea_rooms` (one row, unique index on `(true)`), `ea_room_state(p_key)` = the only read path for
  non-admins (anon-callable, never returns `link_key`/`meeting_id`, `{bad_link:true}` for a rotated key),
  `ea_room_members` (join upserts), `ea_room_hands` (question queue, realtime), `ea_room_replays` (drafts; `download_url`
  has no select grant). Every Start class = a NEW Cloudflare meeting, previous set INACTIVE. Presets `tma-class-host`
  (= opil-host) and `tma-class-guest` (= opil-student with chat files OFF), created lazily by `ensurePresets()` on the
  host's join; ids appended to the untracked `scripts/rtk-presets.ids`. Room branches (`{room:true}`) in the three
  functions beside the OPIL branches; the webhook resolves rooms FIRST. `js/rtk-room-v2.js` takes `target`
  (`{kind:'room'}`), OPIL default byte-identical (18 OPIL tests + the OPIL harness + a prod guard on session 02,
  all green before the push). Words stay in `opil/hub/live-rooms.js` (`OPIL_WORDS` / `ROOM_WORDS`), imported by
  the module with its own `?v=`.

  **Known quirk:** the *Live now · N people* and *Last session · N people* counts never include Nelson — his
  `ea_room_members` row is written inside `ea-rtk-join`, before the page sets `live_since` in `onOpened`. The cap
  (Cloudflare's `live_participants`) DOES count him. Say "people besides you" if he asks.

  **OPIL hardening that rode along:** the join ignores a client `meeting_id`; OPIL join/record refuse a room meeting;
  `ea_opil_hands` insert grant narrowed to `(session_no, user_id, kind, note)`.

  **Verified 2026-09-15 with a second real person** (`taylormademd+zz-test@gmail.com`, "zz-test guest", Incognito): tiles
  both ways, chat, Ask a question → Bring on stage, share screen, cap message at max 2, New link → old link dead on the next open (people already in stay until Leave / Remove),
  Remove → ended card, Leave → replay preparing → ready → Publish → Last session on `/live/`; test rows, replay and Stream
  assets deleted afterwards (`scratchpad/rollout/room-cleanup.sh` pattern: email + start time, Nelson runs it with `!`;
  delete replay rows only once `ready`/`error` — the webhook upserts on `recording_id` and re-creates in-flight rows).

  **Tooling learned:** Supabase CLI 2.75.0 has no `functions logs`; the Management API
  `GET /v1/projects/<ref>/analytics/endpoints/logs.all?sql=…&iso_timestamp_start=…&iso_timestamp_end=…` (both bounds
  required) returns `function_logs` rows — pattern in `scratchpad/rollout/fn-logs.sh`.

  **Not built / untested:** replays for guests · co-hosts, several rooms, a waiting room Nelson admits by hand ·
  the iOS wrapper (say "web-only for now") · a client-branded join screen · replays in `/library/` · a $50/mo Cloudflare
  billing alert is still recommended (~$0.12 per person-hour + $0.60/h recording).

  Related: [[opil-class-room-live]], [[opil-room-v2]], [[opil-auto-replays]], [[realtimekit-live-rooms]],
  [[academy-live-streaming]], [[hillwood-alexis-burwinkel-webinar-lead]] (this room is the Hillwood venue),
  [[feedback_virtual_sessions_on_academy_never_teams]], [[gotcha-prod-deploy-classifier-use-bang-script]].
  ```

  Then in `/Users/nelsontaylor/.claude/projects/-Users-nelsontaylor/memory/MEMORY.md` line 54, replace exactly this segment:
  ```
  **[ACADEMY ROOM](academy-room-project.md) — OPIL class room at /room/?k=, ONE room, sign-in first, only way to go live; spec cb0f080 9/14, awaiting his review → plan.**
  ```
  with:
  ```
  **[ACADEMY ROOM](academy-room-project.md) — LIVE 9/15: /room/?k= (his link = Your room card on /live/), ONE room, sign-in first, ONLY way to go live; replays members-only; guests get no replay; counts exclude Nelson; iOS untested.**
  ```
  Verify:
  ```bash
  grep -c "LIVE 9/15" /Users/nelsontaylor/.claude/projects/-Users-nelsontaylor/memory/MEMORY.md; head -3 /Users/nelsontaylor/.claude/projects/-Users-nelsontaylor/memory/academy-room-project.md | grep -c "LIVE 2026-09-15"
  ```
  Expected: `1` and `1`. (Memory lives outside the repo — nothing to commit.)

- [ ] **Step 13: Tell Nelson, in plain words, what shipped and what was left out**

  Send this (adjust the date and the session number if they were not 9/15 and 02), nothing salesy, no jargon:

  > Your room is live.
  >
  > **Where the link is:** taylormadeacademy.com/live/ → the **Your room** card. Copy link and send it to anyone. They sign in with their email (a 6-digit code), type their name once, and wait on a page that says you haven't started yet. The moment you start, they're walked in — muted, camera off, one tap to turn on.
  >
  > **How you go live:** /live/ → **Open your room →** (or just taylormadeacademy.com/room/) → **Start class** → check your camera → **Enter Session**. Same room as OPIL: grid, chat, People (Pin / Turn off video / Remove), Ask a question with Bring on stage, share screen, Effects. Recording starts when you're in. **Leave ends it for everyone** — two taps.
  >
  > **Keeping people out:** **New link** cuts off everyone holding the old link (two taps). Remove takes someone out for now; they can come back with the link. **Max people** (you included) is 50; over that they see "The room is full right now." One quirk: the "Live now · N people" count on your card is people besides you.
  >
  > **Replays:** after you leave, the recording shows on /live/ as "Replay preparing" → "Replay ready — review, then publish". Nothing goes out until you press Publish to members. Members then see it as **Last session** on /live/. Guests never get the replay.
  >
  > **Tested today** with a second real person in another browser: tiles both ways, chat, the question queue, share screen, the full-room message, New link, Remove, Leave → replay → Publish. Test rows are deleted; the cap is back to 50.
  >
  > **Left out on purpose:** replays for guests (members only), co-hosts, several rooms. **Untested:** the room inside the iOS app — web-only for now. The camera broadcast is gone from /live/; the class room is the only way to go live.
  >
  > **OPIL is untouched** for Wednesday: the 18 OPIL tests, the OPIL harness and a live check on session <N> all passed before the push; ?classic=1 still loads the old room.

  If anything in Steps 3–11 was skipped or failed, say so in this message instead of the matching line — never report "verified" off a step that did not run ([gotcha-verify-deploys-on-the-bare-url]).

---


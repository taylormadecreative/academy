# HT class room — the OPIL class room inside the HT Hub, in Huston-Tillotson's colors

**Date:** 2026-09-15 · **Owner:** Nelson Taylor · **Status:** design, approved in chat 9/15 ("continue")
**Builds on:** `2026-09-14-academy-room-design.md` (the Academy room, in flight on branch `academy-room`) and `2026-09-14-opil-room-v2-design.md` (the room UI). Read those first; this spec only says what is *different* for HT.
**Brand:** `htu-brand-guidelines` — maroon `#660100`, gold `#FFCC00`, the academic wordmark and monogram, never the athletic marks.

## 1. What Nelson asked for, and what was decided

> "I want you to make a ht class in the ht hub like you did for opil i want it branded for huston tillotson too"

| Question | Decision (9/15) |
|---|---|
| Where does HT's room live? | **`/ht/hub/live/`** — the Live space of the HT Hub becomes the class room. No new URL. |
| Own tables like OPIL, or the Academy room's? | **The Academy room's.** `ea_rooms` gains a `slug`; HT is the row `ht`. OPIL's session/roster system is not copied — HT has no scheduled sessions or rostered people yet. More HT rooms later = more rows. |
| One room or per office? | **One HT room.** (Same call Nelson made for the Academy: one room, one link.) |
| Who hosts? | **Nelson, plus any HT staffer he adds by email** on the host card. The demo answer to "can our people run it?" is yes. |
| Do guests sign in? | **Yes — same door as OPIL and the Academy** (`/login/`, email + 6-digit code, name once on `/welcome/`). Two-way rooms need identity; the kit needs a participant token per person. |
| Branding | **HT maroon/gold end to end**: the Cloudflare presets (they carry the room's design tokens), the client tokens, the room CSS, the HT wordmark on the join screen and stage, **Ada greeting guests on the waiting screen**. |
| Go live | **One way** — Start class. No camera broadcast, no sample player on the live space any more. Same rule as OPIL (`feedback_opil_one_way_to_go_live`). |

Standing HT-page rules still apply (`ht-academy-partnership-program` §Rules): no prices, no vendor or tool names on the page ("HT's own room", never "RealtimeKit"/"Cloudflare"), never "avatar" (Ada is HT's student ambassador), sample chips on everything that is still sample.

Not in this build: HT staff accounts of their own (they sign in through the Academy `/login/`, which is Academy-branded — a white-label login is a later item), per-office rooms, scheduled sessions with per-session links, a waiting room where the host admits people by hand, the replay in the sample shelf's card style, the store app.

## 2. The experience at `/ht/hub/live/`

The page keeps the HT Hub frame: preview bar, HT head (wordmark × Academy lockup, "Live · The live room"), the space tabs, the two-column grid, the footer. The room replaces the sample player at the top of the main column.

### 2.1 A host (Nelson, or an email on the room's host list)

**The host card** (above the room, hidden while in the room):
- **The link** `https://taylormadeacademy.com/ht/hub/live/?k=<key>` read-only · **Copy link** · **New link** (two-tap confirm; cuts off everyone holding the old link).
- **Title** (default "HT Live"), **Host name** (default "Nelson Taylor" — what guests read: "*Dr. Gray* is live"), **Max people (you included)** default 50. Each saves on blur with a small *Saved*.
- **Hosts** (Nelson only): the email list, one per line, *Save* → anyone on it who signs in with that email gets the host card and the host preset. HT staff never need Nelson to start a session.
- **Start class — everyone on camera** → the join screen (camera check, mic/camera chips, Effects) → **Enter Class** → the room v2 layout exactly as OPIL: grid, chat, People (Pin / Turn off video / Remove), the question queue with **Bring on stage**, Tools (share screen, effects, breakout rooms, poll, camera & mic, save transcript, end class for everyone).
- Status line *Off air* / *Live now · 12 people*; **End session** when a tab died and left the room live.
- **Replays**: newest first — *Replay preparing* / *Replay ready — Review · Publish* / *Published ✓ · Unpublish* / *Replay failed — Retry*. Publishing puts the recording on this page as **Last session** (§2.3).
- **Who joined**: "Last session · 12 people", names under a disclosure.

Leave = end for everyone (two taps). Recording starts when the host is in, never on Start class. Reload or a second device while live: *Class is running* + **End session**, and the page enters the running class as host.

### 2.2 A guest (anyone a host sent the link to)

| State | What they see, in HT's colors |
|---|---|
| Opens the link, signed out | A maroon card with the HT wordmark: *<Host name>'s room* · the title · **Sign in to join** → `/login/?next=/ht/hub/live/?k=…`. Line under it: *Email, then the 6-digit code — no app to install.* |
| Dead or rotated key | *This link isn't active anymore — ask your host for the new one.* No title shown. |
| Signed in, key good, not started | The join screen in **waiting** mode with **Ada's face beside the line**: *<Host name> hasn't started yet — we'll bring you in the moment they do.* The page checks every 20 s. |
| Host starts | A waiting guest is walked straight in — muted, camera off, one tap to turn on. A guest arriving after the start gets the camera check → **Enter**. Strip: *This session is being recorded.* |
| Room full | *The room is full right now.* |
| Host leaves, or removes them | *This session has ended.* + *If you were here, you can rewatch it on this page once your host publishes it.* |
| They press Leave | *You left the room.* + **Rejoin →** |
| Signed in, no key, never joined | *You need your host's link to join this room.* |

### 2.3 Everyone else on the Live page

Signed out, or signed in with no key: the HT card reads the room's state — *Off air* or *Live now* — with **Sign in to join** (signed out) or *You need your host's link* (signed in). **Last session** (the published replay, embedded 16:9) shows to hosts and to **anyone who has been in this room before** (an `ea_room_members` row for their account). The sample replay shelf, calendar and FAQ stay below, still chipped *sample*. The sample room chat block is removed — the real chat lives inside the room.

## 3. Architecture

```
/ht/hub/live/  (generated shell, ht.js renders the space; the `room` block boots ht/hub/room.js)
   │ ea_room_state(p_key, 'ht') → dead_link / landing / not_allowed / host_idle / host_live / waiting / student
   │ mountRoomV2({ target:{ kind:'room', slug:'ht', id, title, host_name, words:HT_WORDS, tokens:HT_TOKENS } })
   ▼
Supabase ── ea-rtk-join   { room:'ht', key? }   ── host → fresh meeting, presets ht-class-host / ht-class-guest
         ── ea-rtk-record { room:'ht', action } ── ea_room_replays rows with the HT room_id
         ◄─ ea-rtk-webhook                      ── room lookup by meeting_id (unchanged: rooms first)
```

Everything after the row lookup is the Academy room's code. The Academy row keeps every behaviour its spec describes (`ea_is_member()` admits Academy members without a key; members see its replay). The HT row admits **only** hosts and key-holders, and shows its replay to hosts and past joiners.

**Division of files.** Shared (owned by the Academy-room build, asked for by cross-session message 9/15 05:14 and 05:19): `slug`/`host_name`/`host_emails`/preset columns in `ea_rooms`, `room` = slug in the three function bodies, host = admin OR listed email, `target.words` and `target.tokens` in `mountRoomV2`. HT-only (this branch): everything under `ht/`, the two preset JSONs, migration 0037, `tests/ht/`. If the Academy session prefers not to carry an item, 0037 and a follow-up commit on the functions take it after their branch merges — nothing here edits their files while they hold them.

## 4. Data — migration `0037_ht_room.sql`

Additive on 0036 as shipped; every statement safe to re-run; `add column if not exists` so it is correct whether or not 0036 already carries an item. Applied by Nelson with `!` after 0036.

### 4.1 `ea_rooms` becomes many rooms
```sql
alter table public.ea_rooms
  add column if not exists slug         text,
  add column if not exists host_name    text not null default 'Nelson Taylor' check (char_length(host_name) <= 80),
  add column if not exists host_emails  text[] not null default '{}',
  add column if not exists host_preset  text not null default 'tma-class-host',
  add column if not exists guest_preset text not null default 'tma-class-guest';
update public.ea_rooms set slug = 'academy' where slug is null;
alter table public.ea_rooms alter column slug set not null;
create unique index if not exists ea_rooms_slug on public.ea_rooms (slug);
drop index if exists ea_rooms_single;
insert into public.ea_rooms (slug, title, host_preset, guest_preset)
  values ('ht', 'HT Live', 'ht-class-host', 'ht-class-guest') on conflict (slug) do nothing;
```
`host_emails` is stored lowercased, trimmed (the RPC below does it). Column grants: `title, is_live, max_participants, live_since, ended_at, updated_at, host_name` updatable by authenticated (RLS decides who); **`host_emails`, `slug`, `*_preset`, `meeting_id`, `link_key` have no update grant** — hosts are set by an admin RPC, presets by migration only.

### 4.2 Who is a host — `ea_room_is_host(p_room uuid) returns boolean`
Security definer, stable, granted to authenticated:
`ea_is_admin() or exists (select 1 from ea_rooms where id = p_room and lower(auth.email()) = any(host_emails))`.
Policies swap `ea_is_admin()` for `ea_room_is_host(id | room_id)` on: `ea_rooms` select/update, `ea_room_members` select, `ea_room_replays` select, `ea_room_hands` update (Bring on stage / Done) and read. Drop + create, same names. The Academy row is unaffected in practice (its `host_emails` is empty, so host = admin as before).

### 4.3 `ea_room_state(p_key text default null, p_slug text default 'academy')`
The one-argument version is dropped (an overload would be ambiguous). Selects by slug; returns the same keys as 0036 plus `slug`, with:
- `host_name` from the row.
- `is_host` = `ea_room_is_host(r.id)`.
- `can_join` = `is_host or (slug = 'academy' and ea_is_member()) or (p_key = link_key)`.
- `bad_link` = `not can_join and p_key is not null and p_key <> link_key` → returns exactly `{bad_link:true}`.
- `recording_url` when `is_host or (slug = 'academy' and ea_is_member()) or (slug <> 'academy' and exists(ea_room_members row for auth.uid()))`.
- `people` when `is_host`.
Never returns `link_key`, `meeting_id`, `host_emails`.

### 4.4 RPCs
- `ea_room_rotate_link(p_room uuid) returns text` — replaces the zero-arg version; requires `ea_room_is_host(p_room)`.
- `ea_room_publish_replay(p_replay uuid, p_publish boolean)` — same signature; the check becomes `ea_room_is_host(r.room_id)`; the room is `r.room_id` (never "the first room").
- **New** `ea_room_set_hosts(p_room uuid, p_emails text[]) returns text[]` — admin only (`42501` otherwise); lowercases, trims, drops blanks and duplicates, caps at 50, writes `host_emails`, returns the stored list.

## 5. Cloudflare presets — `ht-class-host` / `ht-class-guest`

`scripts/rtk-presets/ht-class-host.json` = `tma-class-host.json` with `name` changed and the `ui.design_tokens` block replaced; `ht-class-guest.json` = `tma-class-guest.json` likewise (so guests keep `chat.*.files: false`). HT tokens (preset ramp runs 300 light → 700 dark, as the existing files do):
```
brand:      300 #FFE580 · 400 #FFD940 · 500 #FFCC00 (HT Gold) · 600 #D9AD00 · 700 #B38F00
background: 600 #8F0000 (Brick) · 700 #660100 (HT Maroon) · 800 #4D0000 · 900 #3B0000 (Mahogany) · 1000 #291C14 (Terra)
text #FFFFFF · text_on_brand #3B0000 · video_bg #3B0000 · danger #FA2626 (Crimson) · success #94CCAB (Sage) · warning #F2B00D (Lumen)
logo https://taylormadeacademy.com/ht/img/ht-monogram-gold.png · font_family Inter · theme darkest
```
`#4D0000` is the one step not in the extended palette — the midpoint between Mahogany and Maroon, needed so panels read against the canvas; it is a UI ramp step, not a mark. Created the same way as the Academy pair: `ensurePresets(row.host_preset, row.guest_preset)` from the join function on the first host open, bodies in `_shared/rtk_presets.ts`; `scripts/rtk-presets.sh` still works with a token in the shell. Permissions identical to the Academy pair (host = everything `opil-host` has; guest = camera/mic/share allowed, text chat, vote, no files, no pin/kick/record).

## 6. Edge functions — what changes beyond the Academy room

- `ea-rtk-join` / `ea-rtk-record`: `room` is the **slug** (`'academy' | 'ht'`; `true` → `'academy'`); the row is selected by slug; **host = `academyAdmin || row.host_emails.includes(callerEmail.toLowerCase())`**; preset names from `row.host_preset` / `row.guest_preset`; rate-limit keys unchanged (per user, per IP). Members without a key are admitted only when `slug === 'academy'`.
- `ea-rtk-webhook`: unchanged lookup order (rooms by `meeting_id`, then `ea_room_replays`, then OPIL). Stream copy name: `(slug === 'academy' ? 'Academy' : slug.toUpperCase()) + ' · ' + title + ' · ' + date` → `HT · HT Live · 2026-09-17`.
- Error codes: the Academy set; `not_host` reads *Only a host can do that.* on HT.

## 7. Client

### 7.1 `ht/hub/room-words.js` (pure, tested in `tests/ht/`)
```js
export function htWords(hostName) — { one:'person', many:'people', host:hostName, teaching:'is live', thing:'session',
  waiting: hostName + ' hasn’t started yet — we’ll bring you in the moment they do.',
  replayFor:'the HT Hub', notAllowed:'You need your host’s link to join this room.', notOpen: hostName + ' hasn’t started yet.' }
export const HT_TOKENS — the §5 ramp in provideRtkDesignSystem's shape (300 dark → 700 light, 'text-on-brand', 'video-bg')
export function htErrorText(code, status, words) — the Academy joinErrorText texts with 'Nelson' → 'your host' / 'a host'
export function htLoginHref(k) — '/login/?next=' + encodeURIComponent('/ht/hub/live/' + (k ? '?k=' + k : ''))
```
`roomKey`, `roomBranch`, `statusLine`, `replayLabel`, `iframeUrl` are imported from `js/room-page.js` (stamped `?v=` like every `/js/` asset) — no copies.

### 7.2 `ht/hub/ht.js` — the `room` block
`R.room(b)` renders `card({ id:b.id, title:b.cardTitle, meta:b.meta }, '<div data-room><div class="ht-room-ctl"></div><div id="rtkMount"></div></div>', 'dark')`. In `wire()`: if `[data-room]` exists → `import('/ht/hub/room.js' + V)` where `V` is the `?v=` `ht.js` captured from `document.currentScript.src` at parse time. `ht.js` stays a renderer; the block is inert without the module.

### 7.3 `ht/hub/room.js` (ES module) — the page logic
Boot: inject `<link rel=stylesheet href="/ht/hub/room.css?v=…">` and await it → `k = roomKey(location.search)` → Supabase client from `BM_CONFIG` → `state = rpc('ea_room_state', { p_key:k, p_slug:'ht' })` → `roomBranch(state)`:
- `dead_link` / `landing` / `not_allowed` → the HT cards of §2.2 (wordmark, maroon, `htLoginHref`).
- `host_idle` → host card (§2.1) + **Start class** → `mountRoomV2({ mode:'host', target:{kind:'room', slug:'ht', id, title, host_name, words, tokens}, onOpened: re-read the row and the state — the join function already stamped is_live + live_since with the server clock; the page writes nothing on Start, onState })`; record start on `joined`; Leave → record stop → `is_live=false, ended_at=now()`.
- `host_live` → host card with *Class is running* + **End session**, and `mountRoomV2` host mode without `onOpened`.
- `waiting` → `mountRoomV2({ mode:'waiting', … })`, 20 s poll, reload when `is_live` flips (auto-enter walks them in).
- `student` → `mountRoomV2({ mode:'student', … })`; 20 s state poll → `is_live` false → leave + ended card.
`body.in-room` hides the HT head, tabs, preview bar and host card so the stage gets the viewport; `body.in-room #rtkMount.r2host { height: calc(100dvh - 24px) }`.
Host card writes: `ea_rooms` update (title, host_name, max_participants — on blur), `ea_room_rotate_link(id)`, `ea_room_set_hosts(id, emails)` (shown only when `ea_is_admin`), replays via explicit-column select on `ea_room_replays` + `ea_room_publish_replay`, Retry via `ea-rtk-record { room:'ht', action:'retry_replay', replay_id }`, who-joined via `ea_room_members` + `ea_profiles`. Polls every 20 s while live or a replay is preparing.
**Fallback if `target.tokens` is not merged:** after `mountRoomV2` resolves, `room.js` imports the kit's `dist/index.js` (same URL the module loads, so cached) and calls `provideRtkDesignSystem(mountEl, HT_TOKENS)` itself — the tokens are CSS custom properties on the mount, so a second call wins.

### 7.4 `ht/hub/room.css` — the room in HT colors
A **fork** of `css/rtk-room-v2.css` (same selectors, HT values) plus the host card and the §2.2 cards: canvas Terra `#291C14`, deep Mahogany `#3B0000`, panels Maroon `#660100`, raised Brick `#8F0000`, accent Gold `#FFCC00` with Mahogany text on it, body text `#FFFFFF`, muted Ember `#F7E3B8`, dim Taupe `#C09780`, ok Sage `#94CCAB`, danger Crimson `#FA2626`. Ada on the waiting screen is CSS only: `body.ht .r2-join:not(.has-preview) .r2-line::before` paints `/ht/img/ada-face.jpg` as a 48px round with a gold ring beside the line. Why a fork and not variables in the shared file: OPIL orientation is Wed 9/16 and `rtk-room-v2.css` is OPIL's; converting it to custom properties is a post-Wednesday follow-up (`--r2-*` with Academy defaults), at which point this file shrinks to the overrides. Every text/background pair is contrast-checked (§10).

### 7.5 Content — `ht/hub/data/live.js`
`player` block → `{ type:'room', id:'room', cardTitle:'The HT class room', meta:'Real · this room is live' }`. Intro rewritten for a two-way room (everyone on camera, share screen, chat, questions, replay); "no account needed" goes; steps become *Send the link · Start class · The replay lands here*; FAQ answers updated (account: *yes — email and a 6-digit code, no app*; phone: *yes, camera and all*; private: *only people with the link*). The `chat` block is removed. Stats, calendar, materials, replay shelf stay, chipped sample. `headCta` → *Open the room* `#room`. `stamp` → *The class room is real · the rest is sample*.

### 7.6 Build plumbing
`ht/build.mjs`: `room.js`, `room.css`, `room-words.js` join the sha1 stamp inputs; the `room` block needs no shell change. `build_site.py`: `ht/hub/room.js` is not under `/js/`, so `_ASSET_RX` does not touch it — the HT stamp covers it. `sw.js` `VERSION` bumps to the next number after the Academy room's (`tma-v21-academy-room` → `tma-v22-ht-room`). `/ht/hub/live/?k=…` is an already-cached shell URL — the sw serves shells network-first, so no change.

## 8. Recording and replays
The Academy loop unchanged: start on the host's `joined` → stop on Leave → webhook → Stream copy → `ea_room_replays` (`room_id` = HT's) → the host publishes on the HT live page → `ea_rooms.recording_url` → **Last session** for hosts and past joiners. Draft replays are visible to HT hosts (`ea_room_is_host`), never to guests; `download_url` never reaches a browser (0034 rule, inherited).

## 9. Security invariants (each tested in §10)
1. An Academy membership does **not** open the HT room; only a host or the current key does. A rotated key refuses at the server (`bad_link`).
2. An HT host (listed email) can host, rotate the HT link, publish HT replays, stage HT hands — and cannot read or touch the Academy row, its replays or its members (`ea_room_is_host` is per room).
3. Only an admin edits `host_emails`; hosts cannot add hosts; `slug`, presets, `meeting_id`, `link_key` are not writable from any page.
4. `ea_room_state` never returns `link_key`, `meeting_id`, `host_emails`; a bad key returns only `{bad_link:true}`.
5. The HT replay URL is returned only to hosts and accounts with a members row for the HT room.
6. Everything the Academy spec's §9 lists (fresh meeting per Start, previous INACTIVE, uid as participant id, no Cloudflare credential on a page, OPIL roles refused from room meetings, hands insert columns limited).

## 10. Testing and rollout

**Unit** `node --test tests/ht/*.test.mjs`: `htWords` for a two-word and a "Dr." host name; `htErrorText` every code; `htLoginHref` with and without a key; `HT_TOKENS` keys match the Academy object's keys exactly.
**Migration** (rolled-back transaction, staged for Nelson's `!`): both rows present; `ea_room_state(null,'ht')` as anon → shape, no secrets; as a `zz-test-` authenticated with a members row → `recording_url` present; without → null; as an Academy member (`ea_is_member` true) without a key → `can_join` false on `ht`, true on `academy`; as a listed host email → `is_host` true on `ht`, and `select` on the Academy row returns nothing; `ea_room_set_hosts` as non-admin → `42501`; hands `staged_at` insert → refused; `ea_room_rotate_link(academy id)` as the HT host → `42501`.
**Functions** (`deno test`, stubbed): join with `room:'ht'` as a listed host → `ht-class-host` and a new meeting; as an Academy member without a key → `not_allowed`; with the key → `ht-class-guest`; `room:true` still means academy; webhook Stream name for an HT row.
**Page** (scratchpad Playwright harness, Supabase + kit stubbed, never signs in to prod): every `roomBranch` card in HT colors; host flow Start → joined → recording → Leave → off air; New link confirm; publish/unpublish; Ada appears only in waiting mode; `body.in-room` hides the hub chrome; **contrast**: every text/background pair in `room.css` ≥ 4.5:1 (axe on each card); phone width 390 — no horizontal overflow, the bottom bar reachable.
**Rollout** (after the Academy room's own rollout, in order): 1 · 0037 (Nelson, `!`) + the verify script. 2 · functions redeployed if the shared items changed after their deploy. 3 · pages + sw bump; verify on the bare URL. 4 · **Real run:** Nelson hosts from `/ht/hub/live/`; a second browser signs in as a `zz-test-` guest through the real link → tile, chat, Ask a question → Bring on stage, share screen, cap with `max_participants = 2`, New link kills the old one, Remove → ended card, Leave → replay ready → Publish → the guest sees Last session; add a `zz-test-` email to hosts → that account gets the host card; then delete the test rows, the replay and the Stream asset. 5 · Install on a real iPhone home screen and open the room from there (still never done for the HT Hub).

## 11. Risks and open items
- **Depends on the Academy room landing first.** If that branch stalls, HT stalls with it; nothing here can ship on OPIL's tables.
- **Login is Academy-branded.** HT guests sign in on a Taylormade Academy page. Acceptable for a co-branded partnership (OPIL students do the same); a white-label login is on the later list with the store app.
- **Two copies of the room CSS until the variables follow-up** (after 9/16). Any change to `rtk-room-v2.css` before then must be mirrored by hand.
- **Costs** as the Academy: ~$0.12 per person-hour + $0.60/h recording; the cap is the guard. A university town hall at 200 people ≈ $25/h — say so before the first big one.
- **HT staff have never signed in anywhere.** Host-by-email works the moment they do; until then Nelson hosts the demo. Give Gray `taylormadeacademy.com/login/?next=/ht/hub/live/` when the time comes.
- Untested with a second real person until rollout step 4 — same as every room so far.

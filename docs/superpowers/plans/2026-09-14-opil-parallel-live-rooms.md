# OPIL Parallel Live Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any number of OPIL sessions be in class mode at the same time, each reachable by its own link `taylormadeacademy.com/opil/hub/live/?s=<session no>`.

**Architecture:** One new pure module `opil/hub/live-rooms.js` holds every decision the two pages need (which room a URL names, what to show when 0/1/many rooms are live, how to build a room link, the shared "Live now" list markup) and is unit-tested with `node --test`. The live page and hub home import it. One migration swaps the one-live index for a one-*stream* index so class rooms (`rtk:` ids) are unbounded while the shared Cloudflare camera pipe stays one-at-a-time. `ea-rtk-join` and the chat policies are already per-session and are not touched.

**Tech Stack:** Static HTML/ES modules on GitHub Pages stamped by `build_site.py` · supabase-js v2 from esm.sh · Supabase Postgres (project `pgqdmnmessbbzyszjfvr`, production is the ONLY database — no staging, no local stack) · `node --test` (Node 25) for the pure module · Playwright against system Chrome (`channel: 'chrome'`) with a stubbed `hub.js` for the page harness · `sw.js` cache-first service worker.

**Spec:** `docs/superpowers/specs/2026-09-14-opil-parallel-live-rooms-design.md`

## Global Constraints

- Room URL shape is exactly `/opil/hub/live/?s=<integer session no>`; the absolute link is `location.origin` + that path (the harness runs on localhost, so tests assert the path, never the host).
- `/opil/hub/live/` with no `s` must behave exactly as today when exactly one session is live (old links keep working).
- Never sign in to production from an automated test, never create rows from a test (`gotcha-e2e-hits-prod-supabase`). Page tests run against a stubbed `hub.js`.
- Migration must be safe to re-run (`if exists` / `if not exists`), like every `00xx_opil_*.sql` before it.
- Copy rule for user-facing strings: plain sentences, no jargon ("room", "class", "facilitator", never "RTK"/"meeting id").
- Bump `sw.js` `VERSION` to `tma-v10-parallel-rooms` in the same commit as the page changes (cache-first assets: `gotcha-unversioned-assets-opil-hub`).
- `build_site.py` stamps `?v=` on the hub pages; the new module must be added to BOTH `_asset_ver()`'s hash list and `_HUB_ASSET_RX` or the service worker will pin a stale copy.
- Commit on branch `domain-migration` (it is what `origin/main` tracks — `git rev-parse origin/main` == this branch's HEAD at plan time). **Do not push and do not apply the migration until Nelson says so** (Task 8).
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QGAcr1jjtkTimRBbuss1Po
  ```

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/0032_opil_parallel_live.sql` (create) | drop `ea_opil_sessions_one_live`; create `ea_opil_sessions_one_stream` |
| `opil/hub/live-rooms.js` (create) | pure helpers: `roomFromQuery`, `pickRoom`, `roomPath`, `sessLabel`, `liveListHTML` |
| `tests/opil/live-rooms.test.mjs` (create) | `node --test` for the module |
| `tests/opil/hub-bounce.test.mjs` (create) | `node --test` for `loginBounce` in hub.js |
| `opil/hub/hub.js` (modify `:2-9`) | `boot()` bounce keeps the query string via new exported `loginBounce(loc)` |
| `opil/hub/index.html` (modify `:25`, `:86-93`, `:133`) | banner → list of live rooms; import `sessLabel` |
| `opil/hub/live/index.html` (modify) | `?s=` room selection, list view, per-room chat filter, no blanket clear, link row + Copy, wake poll per room |
| `build_site.py` (modify `:17`, `:236`) | hash + stamp `live-rooms.js` |
| `sw.js` (modify `:6`) | VERSION bump |
| scratchpad `harness/live-page.mjs` (create, not committed) | Playwright page test with stubbed `hub.js` / `broadcast.js` / `rtk-room.js` |

---

### Task 1: Migration 0032 — one *stream* at a time, unlimited class rooms

**Files:**
- Create: `supabase/migrations/0032_opil_parallel_live.sql`

**Interfaces:**
- Produces: index `ea_opil_sessions_one_stream` (partial unique on `is_live` rows whose `stream_url` is not an `rtk:` id). Task 5's `flipLive` relies on `23505` meaning "another *camera/video* broadcast is running", never "another class".

There is no database to run this against locally (see Tech Stack). The test is a read of the file plus the prod apply in Task 8.

- [ ] **Step 1: Write the migration**

```sql
-- 0032: parallel class rooms.
-- 0023 pinned the program to ONE live session (ea_opil_sessions_one_live) because the live
-- page had one room and the one-way broadcast has one Cloudflare Stream input. Class mode
-- (0029 era, ea-rtk-join) opens a separate RealtimeKit meeting per session, so nothing
-- physical stops three facilitators teaching at once — only that index. Replace it with a
-- one-STREAM index: any number of rows may be live with an "rtk:<id>" stream_url (a class
-- room), but at most one may be live with anything else (the shared camera input, a YouTube
-- URL, the rehearsal clip). Chat (0019/0028) and ea-rtk-join were already keyed per session
-- and need nothing. The Academy's own ea_live_one_live is untouched. Safe to re-run.
drop index if exists public.ea_opil_sessions_one_live;
create unique index if not exists ea_opil_sessions_one_stream
  on public.ea_opil_sessions ((is_live))
  where is_live and coalesce(stream_url, '') not like 'rtk:%';
select 'opil parallel live ready' as status;
```

- [ ] **Step 2: Check it parses the way you think**

Run: `grep -n "one_live\|one_stream" supabase/migrations/0023_live_paywall_hardening.sql supabase/migrations/0032_opil_parallel_live.sql`
Expected: 0023 shows the old `create unique index if not exists ea_opil_sessions_one_live`; 0032 shows the `drop` and the new `create`. (0023 stays as-is: it is history, and 0032's `drop if exists` wins on any re-run order because migrations apply in filename order.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0032_opil_parallel_live.sql
git commit -m "db(opil): 0032 — any number of class rooms live, one camera stream at a time"
```

---

### Task 2: `live-rooms.js` — the pure decisions, test-first

**Files:**
- Create: `opil/hub/live-rooms.js`
- Create: `tests/opil/live-rooms.test.mjs`

**Interfaces:**
- Produces (all named exports, no DOM, no supabase):
  - `sessLabel(s)` → `'S3' | 'H1' | '07'` — moved here from the two pages (identical logic).
  - `roomFromQuery(search)` → `number | null`. `'?s=7'` → `7`; `'?s=07'` → `7`; `'?s=abc'`, `'?s='`, `''`, `'?x=1'` → `null`; `'?s=-1'`/`'?s=0'` → `null` (session numbers are ≥ 1).
  - `pickRoom(sessions, wanted)` → one of
    `{ mode: 'room', session }` (a specific session, live or not) ·
    `{ mode: 'list', live }` (2+ live, no valid `wanted`) ·
    `{ mode: 'idle' }` (nothing live, no valid `wanted`).
    Rules: `wanted` found in `sessions` → `room` with that session **whatever its `is_live`**; `wanted` null or not found → by live count: 1 → `room` with it; ≥2 → `list` sorted by `no`; 0 → `idle`.
  - `roomPath(no)` → `'/opil/hub/live/?s=' + no`.
  - `liveListHTML(live, esc)` → a string: one `<a class="live-row" href="/opil/hub/live/?s=N">` per session containing `<span class="no2">LABEL</span><b>TITLE</b><span class="join">Join →</span>`; `esc` is the page's escaper (from `hub.js`). Empty array → `''`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/opil/live-rooms.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessLabel, roomFromQuery, pickRoom, roomPath, liveListHTML } from '../../opil/hub/live-rooms.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (no, kind, extra = {}) => ({ no, kind, title: 'T' + no, is_live: false, stream_url: null, ...extra });

test('sessLabel matches the labels the pages used', () => {
  assert.equal(sessLabel(S(7, 'thread')), '07');
  assert.equal(sessLabel(S(103, 'curriculum')), 'S3');
  assert.equal(sessLabel(S(201, 'hpc')), 'H1');
  assert.equal(sessLabel(S(12, 'milestone')), '12');
});

test('roomFromQuery reads a positive integer s, nothing else', () => {
  assert.equal(roomFromQuery('?s=7'), 7);
  assert.equal(roomFromQuery('?s=07'), 7);
  assert.equal(roomFromQuery('?tour=1&s=103'), 103);
  for (const bad of ['', '?x=1', '?s=', '?s=abc', '?s=0', '?s=-1', '?s=1.5', '?s=7abc']) assert.equal(roomFromQuery(bad), null, bad);
});

test('pickRoom: a named session wins even when it is not live', () => {
  const r = pickRoom([S(7, 'thread'), S(8, 'thread', { is_live: true })], 7);
  assert.equal(r.mode, 'room'); assert.equal(r.session.no, 7);
});

test('pickRoom: an unknown s falls back to the no-s rules', () => {
  const r = pickRoom([S(8, 'thread', { is_live: true })], 999);
  assert.equal(r.mode, 'room'); assert.equal(r.session.no, 8);
});

test('pickRoom: exactly one live and no s enters it (old links keep working)', () => {
  const r = pickRoom([S(7, 'thread'), S(8, 'thread', { is_live: true })], null);
  assert.equal(r.mode, 'room'); assert.equal(r.session.no, 8);
});

test('pickRoom: two or more live and no s lists them by number', () => {
  const r = pickRoom([S(201, 'hpc', { is_live: true }), S(7, 'thread'), S(103, 'curriculum', { is_live: true })], null);
  assert.equal(r.mode, 'list'); assert.deepEqual(r.live.map(s => s.no), [103, 201]);
});

test('pickRoom: nothing live and no s is idle', () => {
  assert.deepEqual(pickRoom([S(7, 'thread')], null), { mode: 'idle' });
  assert.deepEqual(pickRoom([], null), { mode: 'idle' });
});

test('roomPath builds the link the instructor sends', () => {
  assert.equal(roomPath(7), '/opil/hub/live/?s=7');
  assert.equal(roomPath(103), '/opil/hub/live/?s=103');
});

test('liveListHTML renders one Join row per live session, escaped', () => {
  const html = liveListHTML([S(103, 'curriculum', { is_live: true, title: 'Data <b>101</b>' }), S(7, 'thread', { is_live: true })], esc);
  assert.match(html, /href="\/opil\/hub\/live\/\?s=103"/);
  assert.match(html, /href="\/opil\/hub\/live\/\?s=7"/);
  assert.match(html, /<span class="no2">S3<\/span>/);
  assert.match(html, /Data &lt;b&gt;101&lt;\/b&gt;/);
  assert.equal((html.match(/class="live-row"/g) || []).length, 2);
  assert.equal(liveListHTML([], esc), '');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/nelsontaylor/taylormade-academy && node --test tests/opil/live-rooms.test.mjs`
Expected: FAIL — `Cannot find module '.../opil/hub/live-rooms.js'`

- [ ] **Step 3: Write the module**

```js
// opil/hub/live-rooms.js
/* OPIL live rooms — the decisions the live page and hub home share. Pure: no DOM, no supabase,
   so `node --test tests/opil/live-rooms.test.mjs` covers every branch.
   A room is a scheduled session; its link is /opil/hub/live/?s=<no>. Several sessions may be
   live at once (migration 0032), so "which room am I in" is a question, answered here. */

export const sessLabel = (s) => s.kind === 'curriculum' ? 'S' + (s.no % 100) : s.kind === 'hpc' ? 'H' + (s.no % 100) : String(s.no).padStart(2, '0');

/* ?s=7 → 7. Anything that is not a positive integer → null, so a bad link degrades to the
   no-s view instead of a blank page. */
export function roomFromQuery(search) {
  let v; try { v = new URLSearchParams(search || '').get('s'); } catch (e) { return null; }
  if (v == null || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 ? n : null;
}

/* wanted (a session no, or null) + every session the caller can see →
   { mode:'room', session } | { mode:'list', live } | { mode:'idle' }.
   A named session is a room even before it is live: the student who clicked early waits there. */
export function pickRoom(sessions, wanted) {
  const all = sessions || [];
  if (wanted != null) { const s = all.find(x => x.no === wanted); if (s) return { mode: 'room', session: s }; }
  const live = all.filter(x => x.is_live).slice().sort((a, b) => a.no - b.no);
  if (live.length === 1) return { mode: 'room', session: live[0] };
  if (live.length > 1) return { mode: 'list', live };
  return { mode: 'idle' };
}

export const roomPath = (no) => '/opil/hub/live/?s=' + no;

/* The "Live now" list: hub home and the room page's no-s view render the same rows. */
export function liveListHTML(live, esc) {
  return (live || []).map(s => `<a class="live-row" href="${roomPath(s.no)}"><span class="no2">${esc(sessLabel(s))}</span><b>${esc(s.title)}</b><span class="join">Join &rarr;</span></a>`).join('');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/opil/live-rooms.test.mjs`
Expected: `# pass 9`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add opil/hub/live-rooms.js tests/opil/live-rooms.test.mjs
git commit -m "feat(opil): live-rooms.js — which room a link names, tested"
```

---

### Task 3: `hub.js` — the sign-in bounce keeps `?s=`

**Files:**
- Modify: `opil/hub/hub.js:2-9`
- Create: `tests/opil/hub-bounce.test.mjs`

**Interfaces:**
- Produces: `export function loginBounce(loc)` → `'/login/?next=' + encodeURIComponent(loc.pathname + loc.search)`. `boot()` uses it. `hub.js` has no top-level browser references (verified: only function declarations and const tables), so Node can import it.

- [ ] **Step 1: Write the failing test**

```js
// tests/opil/hub-bounce.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginBounce } from '../../opil/hub/hub.js';

test('a room link survives the sign-in wall', () => {
  assert.equal(loginBounce({ pathname: '/opil/hub/live/', search: '?s=7' }), '/login/?next=%2Fopil%2Fhub%2Flive%2F%3Fs%3D7');
});
test('a plain hub page bounces exactly as before', () => {
  assert.equal(loginBounce({ pathname: '/opil/hub/team/', search: '' }), '/login/?next=%2Fopil%2Fhub%2Fteam%2F');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/opil/hub-bounce.test.mjs`
Expected: FAIL — `does not provide an export named 'loginBounce'`

- [ ] **Step 3: Implement**

In `opil/hub/hub.js`, replace lines 1-9:

```js
/* OPIL Lab Hub — shared runtime. Auth gate, team claim, helpers. */
/* Where a signed-out visitor goes, and comes back to. The query string rides along so a room
   link (/opil/hub/live/?s=7) lands in that room after the magic link, not on the bare page. */
export const loginBounce = (loc) => '/login/?next=' + encodeURIComponent(loc.pathname + loc.search);
export async function boot() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const sb = createClient(window.BM_CONFIG.SUPABASE_URL, window.BM_CONFIG.SUPABASE_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace(loginBounce(location));
    return null;
  }
```

- [ ] **Step 4: Run both test files**

Run: `node --test tests/opil/`
Expected: `# pass 11`, `# fail 0`

- [ ] **Step 5: Confirm `/welcome/` accepts the query string (read-only)**

Run: `sed -n 244,246p welcome/index.html`
Expected: the guard is `n.charAt(0) === '/' && n.charAt(1) !== '/' && n.indexOf('\\') === -1` — a `?` passes. No change.

- [ ] **Step 6: Commit**

```bash
git add opil/hub/hub.js tests/opil/hub-bounce.test.mjs
git commit -m "fix(opil): the sign-in bounce keeps the room link's query string"
```

---

### Task 4: Hub home — "Live now" lists every room

**Files:**
- Modify: `opil/hub/index.html:25` (banner markup), `:62` (import), `:86-93` (banner logic), `:133` (drop local `sessLabel`)

**Interfaces:**
- Consumes: `sessLabel`, `liveListHTML`, `roomPath` from `live-rooms.js` (Task 2).

- [ ] **Step 1: Replace the banner markup (line 25)**

Old:
```html
<div class="hub-note" id="liveNote" style="display:none;background:#e8f8f0;border-color:#b7e8d4;color:#067a56"><b id="liveTitle">A session is live right now.</b> <a href="/opil/hub/live/" style="font-weight:700;color:#067a56;text-decoration:underline">Join the live room &rarr;</a></div>
```
New:
```html
<div class="hub-note" id="liveNote" style="display:none;background:#e8f8f0;border-color:#b7e8d4;color:#067a56"><b id="liveTitle">A session is live right now.</b> <a id="liveOne" href="/opil/hub/live/" style="font-weight:700;color:#067a56;text-decoration:underline">Join the live room &rarr;</a><div id="liveList" class="live-list"></div></div>
```

- [ ] **Step 2: Add the row styles**

In the page's `<style>` block (find `</style>` on the hub home and add before it):
```css
.live-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.live-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #b7e8d4;border-radius:10px;background:#fff;color:#067a56;text-decoration:none;min-height:44px}
.live-row .no2{font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;padding:4px 7px;border-radius:6px;background:#e8f8f0}
.live-row b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.live-row .join{font-weight:700;text-decoration:underline}
```

- [ ] **Step 3: Import the module and replace the banner logic (lines 62, 86-93)**

Line 62 becomes:
```js
import { boot, esc, when, nav } from '/opil/hub/hub.js?v=37333ba3d1';
import { sessLabel, liveListHTML, roomPath } from '/opil/hub/live-rooms.js?v=37333ba3d1';
```
Lines 86-93 become:
```js
/* live banner: one room → the same one-line banner as before, pointed at that room;
   several → a list, the student picks */
try {
  const live = (sess || []).filter(s => s.is_live).sort((a, b) => a.no - b.no);
  if (live.length === 1) {
    document.getElementById('liveTitle').textContent = live[0].title + ' is live right now.';
    document.getElementById('liveOne').href = roomPath(live[0].no);
    document.getElementById('liveNote').style.display = '';
  } else if (live.length > 1) {
    document.getElementById('liveTitle').textContent = live.length + ' rooms are live right now. Pick yours.';
    document.getElementById('liveOne').hidden = true;
    document.getElementById('liveList').innerHTML = liveListHTML(live, esc);
    document.getElementById('liveNote').style.display = '';
  }
} catch (e) {}
```
Delete line 133 (`const sessLabel = s => ...`) — the import replaces it; the calendar renderer at `:141` keeps working unchanged.

- [ ] **Step 4: Static check**

Run: `node --check opil/hub/live-rooms.js && grep -c "sessLabel" opil/hub/index.html && grep -n "const sessLabel" opil/hub/index.html`
Expected: the module parses; `sessLabel` still referenced (≥2 lines); the `const sessLabel` grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add opil/hub/index.html
git commit -m "feat(opil): hub home lists every live room"
```

---

### Task 5: The live page — a room per session

**Files:**
- Modify: `opil/hub/live/index.html` — imports (`:77`), room selection (`:84-86`), idle copy (`:63`), `sessLabel`/`metaLine` (`:125-126`), entry (`:222-229`), chat channel (`:255-261`), wake poll (`:263-268`), broadcast control markup (`:314-319`), `flipLive` (`:337-345`), class/demo/go handlers (`:359-388`), picker change (`:427-431`)

**Interfaces:**
- Consumes: `roomFromQuery`, `pickRoom`, `roomPath`, `sessLabel`, `liveListHTML` (Task 2).
- Produces: nothing for later tasks; the harness in Task 7 drives the ids `#bcSess`, `#bcLink`, `#bcCopy`, `#bcClass`, `#bcDemo`, `#bcGo`, `#idle`, `#liveList`, `#lcInput`.

- [ ] **Step 1: Imports and room selection**

Replace lines 77-86:
```js
import { boot, names, esc, when, nav } from '/opil/hub/hub.js?v=37333ba3d1';
import { play, panelHTML, wirePanel } from '/js/broadcast.js?v=37333ba3d1';
import { roomFromQuery, pickRoom, roomPath, sessLabel, liveListHTML } from '/opil/hub/live-rooms.js?v=37333ba3d1';
const ctx = await boot(); if (!ctx) throw new Error('gate');
const { sb, user, isAdmin, facSessions } = ctx;
const staff = isAdmin || (facSessions || []).length > 0;   /* coordinators and facilitators get the Broadcast control */
nav(ctx, 'live');

/* which room: ?s=<no> names one (live or waiting); with no s, the one live session, or a list
   when several are. Milestones are never rooms. */
const wanted = roomFromQuery(location.search);
const { data: allSess } = await sb.from('ea_opil_sessions').select('*').neq('kind', 'milestone').order('no');
const pickedRoom = pickRoom(allSess || [], wanted);
const roomSess = pickedRoom.mode === 'room' ? pickedRoom.session : null;         /* the session this page is bound to */
const liveSess = roomSess && roomSess.is_live ? roomSess : null;                  /* …and only when it is on air */
let sessionNo = roomSess ? roomSess.no : null;
```

- [ ] **Step 2: Drop the page-local `sessLabel` (line 125), keep `metaLine`**

Delete `const sessLabel = s => ...` at line 125 (imported now). Line 126 `metaLine` stays.

- [ ] **Step 3: Entry — room, waiting room, list, idle**

Replace lines 222-229 (`if (liveSess && isRoom(...)) { … } else if (liveSess && liveSess.stream_url) { … }`) with:
```js
const idleEl = document.getElementById('idle');
if (liveSess && isRoom(liveSess.stream_url)) {
  /* students and judges land straight in; a 409 means the facilitator has not opened it yet */
  enterRoom(liveSess.no, liveSess.stream_url.slice(RTK_PREFIX.length), sessLabel(liveSess) + ' · ' + liveSess.title)
    .catch((e) => { idleEl.innerHTML = '<b>' + esc(e.message || 'Could not open the class.') + '</b><span>Reload once your facilitator has started it.</span>'; });
} else if (liveSess && liveSess.stream_url) {
  mountStream(liveSess.stream_url, sessLabel(liveSess) + ' · ' + liveSess.title).catch(() => {});
  document.getElementById('meta').textContent = metaLine(liveSess);
} else if (roomSess) {
  /* a room link opened before the facilitator started: wait here, the poll below reloads when it flips live */
  document.getElementById('ttl').textContent = sessLabel(roomSess) + ' · ' + roomSess.title;
  idleEl.innerHTML = '<b>This room opens when your facilitator starts it.</b><span>Stay on this page &mdash; it joins by itself.</span>';
} else if (pickedRoom.mode === 'list') {
  idleEl.innerHTML = '<b>' + pickedRoom.live.length + ' rooms are live right now.</b><span>Pick yours.</span><div class="live-list" id="liveList">' + liveListHTML(pickedRoom.live, esc) + '</div>';
}
```
Add the list styles to this page's `<style>` (same five rules as Task 4 Step 2, plus `.idle .live-list{width:min(520px,100%);margin:14px auto 0;text-align:left}`).

- [ ] **Step 4: Chat — one channel per room, nothing else re-fetches it**

Replace lines 255-261 (`sb.channel('live-room')…`) with:
```js
  try {
    sb.channel('live-room-' + sessionNo)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ea_opil_live_chat', filter: 'session_no=eq.' + sessionNo }, loadChat)
      .subscribe();
  } catch (e) {}
```

- [ ] **Step 5: Wake poll — watch this room, or any room when none is named**

Replace lines 263-268:
```js
let wakePoll = null;   /* kept so a broadcaster can stop it: a reload under a live camera ends the broadcast */
function armWake() {
  wakePoll = setInterval(async () => {
    let q = sb.from('ea_opil_sessions').select('no').eq('is_live', true);
    if (roomSess) q = q.eq('no', roomSess.no);   /* a named room waits for ITS session, not whichever goes live first */
    const { data } = await q.limit(1);
    if (data && data.length && !selfBroadcast) location.reload();
  }, 30000);
}
```
And the `else` branch at lines 269-277: change the copy to `'Chat opens when this room goes live.'` when `roomSess` is set, else keep `'Chat opens when a session goes live.'`:
```js
if (liveSess) {
  await openChat();
} else {
  scroll.innerHTML = '<div class="empty">' + (roomSess ? 'Chat opens when this room goes live.' : 'Chat opens when a session goes live.') + '</div>';
  input.disabled = true; input.placeholder = 'Room opens with the session';
  document.getElementById('lcSend').disabled = true;
  armWake();
}
```

- [ ] **Step 6: Broadcast control — pick the named room, show its link, Copy**

In the `if (staff)` block, reuse the page's session list instead of a second query — replace lines 302-303 with:
```js
  const sessions = (allSess || []).filter(s => isAdmin || (facSessions || []).includes(s.no));
```
Then the `pick` (lines 309-312) must prefer the room the URL names:
```js
    const pick = (roomSess && sessions.find(s => s.no === roomSess.no))
      || sessions.find(s => s.is_live)
      || sessions.find(s => s.session_date === today)
      || sessions.filter(s => s.session_date && s.session_date > today).sort((a, b) => a.session_date.localeCompare(b.session_date))[0]
      || sessions[0];
```
In the markup (line 316), add a link row directly after the `<select>` row:
```html
<div class="bc-ctl-row"><input id="bcLink" readonly aria-label="Link to this room" value=""><button type="button" class="pillbtn" id="bcCopy">Copy link</button></div>
```
Right after `const sel = …` declarations (line 321), add:
```js
    const linkEl = document.getElementById('bcLink'), copyBtn = document.getElementById('bcCopy');
    /* the link an instructor sends out: absolute, and it works before the class starts */
    const syncLink = () => { linkEl.value = location.origin + roomPath(Number(sel.value)); };
    copyBtn.addEventListener('click', async () => {
      linkEl.select();
      try { await navigator.clipboard.writeText(linkEl.value); copyBtn.textContent = 'Copied'; }
      catch (e) { copyBtn.textContent = 'Press ⌘C'; }   /* clipboard blocked: the text is selected, one keystroke away */
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1600);
    });
    /* bind the host's page to the room it is running, so a reload after End lands back in it */
    const bindUrl = (no) => { try { history.replaceState(null, '', roomPath(no)); } catch (e) {} };
```
Call `syncLink()` wherever `syncCtl()` is called on load and on picker change (Step 8 below), and `bindUrl(s.no)` inside the class handler and the panel's `go` right after `flipLive` succeeds, and inside the demo handler before `location.reload()`.

- [ ] **Step 7: `flipLive` — never clear another room**

Replace lines 337-345:
```js
    /* Rooms are independent (0032): starting one never touches another. The only unique rule
       left is one non-room STREAM at a time (the camera input is shared), so 23505 means exactly
       that — say so instead of going quiet. */
    async function flipLive(no, on, u) {
      const r = await sb.from('ea_opil_sessions').update(on ? { is_live: true, stream_url: u } : { is_live: false }).eq('no', no);
      if (r.error) throw new Error(r.error.code === '23505' ? 'Another camera broadcast is already running. End that one first (ask the coordinator if it isn’t yours).' : r.error.message);
      sessions.forEach(x => { if (x.no === no) { x.is_live = on; if (u) x.stream_url = u; } });
    }
```

- [ ] **Step 8: Handlers**

Class handler (lines 359-374): after `await flipLive(s.no, true, 'rtk:' + r.meetingId);` add `bindUrl(s.no);` and change the note to
`'Class is running. Send students the link above — they join you here. End it from the room’s own Leave button, then End session.'`.
Demo handler (lines 375-381): before `location.reload();` add `bindUrl(s.no);`.
Go/End handler (lines 382-388): unchanged.
Panel `go` (line 404): after `sessionNo = no; syncCtl();` add `bindUrl(no);`.
Picker change (lines 427-431):
```js
    sel.addEventListener('change', () => {
      if (!camIdle()) { sel.value = String(panelNo); bnote.textContent = 'Finish with the camera before switching sessions.'; return; }
      panelNo = Number(sel.value); syncCtl(); syncLink(); renderPanel();
    });
    syncCtl(); syncLink(); renderPanel();
```

- [ ] **Step 9: The catch branch in the class handler re-arms the poll only when this page has no live room**

Line 369 `selfBroadcast = false; if (!liveSess) armWake();` — leave as is; `liveSess` is still the page-load truth for *this* room.

- [ ] **Step 10: Syntax check the inline module**

Run:
```bash
python3 - <<'EOF'
import re,pathlib,subprocess
html=pathlib.Path('opil/hub/live/index.html').read_text()
js=re.search(r'<script type="module">(.*?)</script>',html,re.S).group(1)
pathlib.Path('/private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/live-inline.mjs').write_text(js)
print(subprocess.run(['node','--check','/private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/live-inline.mjs'],capture_output=True,text=True))
EOF
```
Expected: `returncode=0`, empty stderr. (Top-level `await` is legal in a `.mjs` module.)

- [ ] **Step 11: Commit**

```bash
git add opil/hub/live/index.html
git commit -m "feat(opil): a live room per session — ?s=<no>, link row, no blanket clear"
```

---

### Task 6: Stamp the new module, bump the service worker, rebuild

**Files:**
- Modify: `build_site.py:17` (hash list), `:236` (`_HUB_ASSET_RX`)
- Modify: `sw.js:6`

- [ ] **Step 1: Hash and stamp `live-rooms.js`**

`build_site.py:17` — change `"opil/hub/hub.css", "opil/hub/hub.js", "opil/hub/tour.js",` to
`"opil/hub/hub.css", "opil/hub/hub.js", "opil/hub/tour.js", "opil/hub/live-rooms.js",`.
`build_site.py:236` — change
`_HUB_ASSET_RX = re.compile(r'(/opil/hub/hub\.(?:css|js))(?:\?v=[a-z0-9]+)?')` to
`_HUB_ASSET_RX = re.compile(r'(/opil/hub/(?:hub\.(?:css|js)|live-rooms\.js))(?:\?v=[a-z0-9]+)?')`.

- [ ] **Step 2: Bump the service worker**

`sw.js:6` → `const VERSION = 'tma-v10-parallel-rooms';`

- [ ] **Step 3: Rebuild and inspect the diff before committing** (`gotcha-build-site-reverts-hand-edited-generated-pages`)

Run: `python3 build_site.py >/dev/null && git status --short | wc -l && git diff --stat | tail -1 && git diff -- opil/hub/live/index.html opil/hub/index.html | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v '?v=' | head`
Expected: many files changed (every page re-stamps `?v=`); the last grep prints **nothing** — the only diff lines in the two hub pages are `?v=` stamps. If any other line shows, `build_site.py` reverted a hand edit: fix, do not commit.

Run: `grep -o 'live-rooms.js?v=[a-z0-9]*' opil/hub/index.html opil/hub/live/index.html`
Expected: both pages carry the same fresh hash (not `37333ba3d1`).

- [ ] **Step 4: Commit everything the build touched**

```bash
git add -A
git commit -m "build(opil): stamp live-rooms.js, sw v10 for parallel rooms"
```

---

### Task 7: Page harness — click it, change state, reload, click again

**Files:**
- Create (scratchpad, NOT committed): `/private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/harness/live-page.mjs`

This is the `feedback_exercise_every_feature_you_touch` gate. It serves the repo with `python3 -m http.server`, and Playwright routes `hub.js`, `broadcast.js`, `rtk-room.js`, and `config.js` to stubs so the page runs with a fake signed-in admin and an in-memory sessions table. No network to Supabase, no sign-in.

- [ ] **Step 1: Install Playwright into the scratchpad (system Chrome, no browser download)**

Run:
```bash
cd /private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad && mkdir -p harness && cd harness && npm init -y >/dev/null && npm i playwright@1 >/dev/null 2>&1 && node -e "require('playwright'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 2: Write the harness**

```js
// harness/live-page.mjs — run: node live-page.mjs  (from the harness dir)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const ROOT = '/Users/nelsontaylor/taylormade-academy';
const PORT = 8765, BASE = 'http://127.0.0.1:' + PORT;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

/* the fake database: sessions the stub client serves and updates */
const state = { sessions: [
  { no: 7, kind: 'thread', title: 'Agents 101', session_date: null, is_live: false, stream_url: null, outcome: '' },
  { no: 103, kind: 'curriculum', title: 'Data day', session_date: null, is_live: false, stream_url: null, outcome: '' },
  { no: 201, kind: 'hpc', title: 'HPC intro', session_date: null, is_live: false, stream_url: null, outcome: '' },
  { no: 12, kind: 'milestone', title: 'Showcase', session_date: null, is_live: false, stream_url: null, outcome: '' },
] };

const stubHub = (st) => `
export const loginBounce = (loc) => '/login/?next=' + encodeURIComponent(loc.pathname + loc.search);
export const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const when = () => 'now';
export const names = async () => ({});
export function nav() {}
const S = ${JSON.stringify(st.sessions)};
window.__updates = [];
function q(table) {
  const f = { table, filters: [], neq: [], orderKey: null, lim: null, single: false, upd: null };
  const api = {
    select() { return api; }, order(k) { f.orderKey = k; return api; }, limit(n) { f.lim = n; return api; },
    eq(k, v) { f.filters.push([k, v]); return api; }, neq(k, v) { f.neq.push([k, v]); return api; },
    maybeSingle() { f.single = true; return api; },
    update(u) { f.upd = u; return api; }, insert() { return Promise.resolve({ error: null }); },
    then(res) {
      let rows = table === 'ea_opil_sessions' ? S : [];
      rows = rows.filter(r => f.filters.every(([k, v]) => r[k] === v) && f.neq.every(([k, v]) => r[k] !== v));
      if (f.upd) {
        /* the one-stream rule (0032): a second non-rtk live row is a 23505 */
        if (f.upd.is_live && !(String(f.upd.stream_url || '').startsWith('rtk:')) && S.some(r => r.is_live && !String(r.stream_url || '').startsWith('rtk:') && !rows.includes(r)))
          return res({ data: null, error: { code: '23505', message: 'dup' } });
        rows.forEach(r => Object.assign(r, f.upd)); window.__updates.push({ filters: f.filters, upd: f.upd });
        return res({ data: rows, error: null });
      }
      if (f.orderKey) rows = rows.slice().sort((a, b) => a[f.orderKey] > b[f.orderKey] ? 1 : -1);
      if (f.lim != null) rows = rows.slice(0, f.lim);
      return res({ data: f.single ? (rows[0] || null) : rows, error: null });
    },
  };
  return api;
}
const sb = { from: q, channel: () => ({ on() { return this; }, subscribe() {} }), auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } };
export async function boot() { return { sb, user: { id: 'u1' }, isAdmin: true, facSessions: [], teamId: null }; }
export const tabs = nav;
`;
const stubBroadcast = `
export function play() {}
export const panelHTML = (id) => '<div id="' + id + '"><div class="bc-status"><b>Camera off</b></div></div>';
export function wirePanel() {}
`;
const stubRoom = `
export async function mountRoom(o) { window.__room = { sessionNo: o.sessionNo, meetingId: o.meetingId }; return { meetingId: o.meetingId || 'm-' + o.sessionNo, leave: async () => {} }; }
`;
const stubConfig = `window.BM_CONFIG = { SUPABASE_URL: 'http://x', SUPABASE_KEY: 'k', FUNCTIONS_BASE: 'http://x' };`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
await ctx.route(/\/opil\/hub\/hub\.js/, r => r.fulfill({ contentType: 'text/javascript', body: stubHub(state) }));
await ctx.route(/\/js\/broadcast\.js/, r => r.fulfill({ contentType: 'text/javascript', body: stubBroadcast }));
await ctx.route(/\/js\/rtk-room\.js/, r => r.fulfill({ contentType: 'text/javascript', body: stubRoom }));
await ctx.route(/\/js\/config\.js/, r => r.fulfill({ contentType: 'text/javascript', body: stubConfig }));
await ctx.route(/\/opil\/hub\/live-rooms\.js/, r => r.continue());   /* the REAL module under test */
await ctx.route(/esm\.sh|cdn\.jsdelivr|fonts\.g|sw\.js/, r => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });

const text = async (sel) => (await page.locator(sel).first().textContent() || '').trim();
let step = 0; const ok = (m) => console.log('ok ' + (++step) + ' — ' + m);

/* 1. no s, nothing live → idle */
await page.goto(BASE + '/opil/hub/live/'); await page.waitForSelector('#bcSess');
assert.match(await text('#idle'), /Nothing is streaming/); ok('idle with nothing live');

/* 2. the link row tracks the picker */
await page.selectOption('#bcSess', '103');
assert.equal(await page.inputValue('#bcLink'), BASE + '/opil/hub/live/?s=103'); ok('link row follows the picker');
await page.click('#bcCopy'); assert.match(await text('#bcCopy'), /Copied|⌘C/); ok('Copy link responds');

/* 3. start a class on 103 → page binds to ?s=103, room mounted, sessions row is rtk: */
await page.click('#bcClass'); await page.waitForFunction(() => location.search === '?s=103');
const upd1 = await page.evaluate(() => window.__updates);
assert.equal(upd1.length, 1, 'exactly ONE update — no blanket clear'); assert.deepEqual(upd1[0].filters, [['no', 103]]);
assert.match(upd1[0].upd.stream_url, /^rtk:/); ok('Start class flips only its own session');
state.sessions.find(s => s.no === 103).is_live = true; state.sessions.find(s => s.no === 103).stream_url = 'rtk:m-103';

/* 4. RELOAD as a fresh page with ?s=7 while 103 is live → 7 is the room, waiting */
await page.goto(BASE + '/opil/hub/live/?s=7'); await page.waitForSelector('#bcSess');
assert.match(await text('#idle'), /opens when your facilitator/); assert.equal(await text('#ttl'), '07 · Agents 101');
assert.equal(await page.inputValue('#bcSess'), '7'); ok('?s=7 waits in room 7 even though 103 is live');

/* 5. start a class on 7 too → two rooms live, still one update, no clear */
await page.click('#bcClass'); await page.waitForFunction(() => window.__updates.length === 1);
const upd2 = await page.evaluate(() => window.__updates);
assert.deepEqual(upd2[0].filters, [['no', 7]]); ok('second room starts without touching the first');
state.sessions.find(s => s.no === 7).is_live = true; state.sessions.find(s => s.no === 7).stream_url = 'rtk:m-7';

/* 6. no s, two live → list with two Join rows */
await page.goto(BASE + '/opil/hub/live/'); await page.waitForSelector('#liveList');
const hrefs = await page.$$eval('#liveList a', as => as.map(a => a.getAttribute('href')));
assert.deepEqual(hrefs, ['/opil/hub/live/?s=7', '/opil/hub/live/?s=103']); ok('no s + two live → pick a room');

/* 7. ?s=103 while two are live → enters 103, chat bound to 103 */
await page.goto(BASE + '/opil/hub/live/?s=103'); await page.waitForFunction(() => window.__room && window.__room.sessionNo === 103);
assert.equal(await page.getAttribute('#lcInput', 'disabled'), null); ok('?s=103 joins room 103 with its own chat');

/* 8. a THIRD non-room broadcast (rehearsal clip) on 201 is allowed once… */
await page.goto(BASE + '/opil/hub/live/?s=201'); await page.waitForSelector('#bcSess');
await page.click('#bcDemo'); await page.waitForFunction(() => window.__updates && window.__updates.length === 1);
state.sessions.find(s => s.no === 201).is_live = true; state.sessions.find(s => s.no === 201).stream_url = '/assets/live-demo/stream.m3u8';
ok('a camera/video broadcast still starts alongside class rooms');

/* 9. …but a SECOND stream broadcast is refused with the plain message. Pretend room 7 ended, then try the clip on it. */
state.sessions.find(s => s.no === 7).is_live = false; state.sessions.find(s => s.no === 7).stream_url = null;
await page.goto(BASE + '/opil/hub/live/?s=7'); await page.waitForSelector('#bcSess');
await page.click('#bcDemo'); await page.waitForFunction(() => /camera broadcast is already running/.test(document.getElementById('bcNote').textContent));
ok('second stream broadcast → the one-stream message');

/* 10. hub home: one live → single banner to ?s=; two live → list */
state.sessions.find(s => s.no === 201).is_live = false; state.sessions.find(s => s.no === 201).stream_url = null;   /* only 103 live now */
await page.goto(BASE + '/opil/hub/'); await page.waitForSelector('#liveNote');
assert.equal(await page.$$eval('#liveList a', as => as.length), 0);
assert.equal(await page.getAttribute('#liveOne', 'href'), '/opil/hub/live/?s=103'); ok('hub home: one live → banner links to that room');
state.sessions.find(s => s.no === 7).is_live = true; state.sessions.find(s => s.no === 7).stream_url = 'rtk:m-7';
await page.goto(BASE + '/opil/hub/'); await page.waitForSelector('#liveList a');
assert.deepEqual(await page.$$eval('#liveList a', as => as.map(a => a.getAttribute('href'))), ['/opil/hub/live/?s=7', '/opil/hub/live/?s=103']);
assert.equal(await page.getAttribute('#liveOne', 'hidden'), ''); ok('hub home: two live → list, single link hidden');

await browser.close(); server.kill();
console.log(process.exitCode ? 'FAILED' : 'ALL OK');
```
Note for the hub-home steps: the hub home page also calls `sb.from('ea_opil_materials')`, `ea_opil_attendance`, teams, etc. — the stub's `q()` returns `[]` for any table that is not `ea_opil_sessions`, and `boot()` returns `teamId: null`, so those blocks no-op. If the hub home throws on some other missing stub, extend the stub (add the method that is missing) rather than weakening the assertion.

- [ ] **Step 3: Run it**

Run: `cd /private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/harness && node live-page.mjs`
Expected: `ok 1` … `ok 12`, then `ALL OK`, no `PAGE ERROR` lines. Fix the page (not the harness) until it passes; each page fix is a fixup commit on Task 5.

- [ ] **Step 4: Confirm the harness never talked to production**

Run: add `ctx.on('request', r => { if (/supabase\.co|cloudflare/.test(r.url())) { console.error('LEAK ' + r.url()); process.exitCode = 1; } });` right after `const ctx = …` and re-run.
Expected: no `LEAK` lines.

---

### Task 8: Ship — apply 0032, push, verify on the bare URL, then the real two-room test

**Gate: ask Nelson before Step 1 and before Step 2.** Pushing deploys to taylormadeacademy.com and the migration changes production.

- [ ] **Step 1: Apply 0032 on production**

Preferred (no browser): Management API with the keychain token (`supabase-mgmt-api-token-keychain`):
```bash
RAW=$(security find-generic-password -s "Supabase CLI" -w); SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
python3 -c "import json,sys;print(json.dumps({'query':open('supabase/migrations/0032_opil_parallel_live.sql').read()}))" > /private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/q.json
curl -s -X POST "https://api.supabase.com/v1/projects/pgqdmnmessbbzyszjfvr/database/query" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" --data @/private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/q.json
```
Expected: `[{"status":"opil parallel live ready"}]`. If the keychain entry is missing, fall back to the dashboard SQL editor via Claude in Chrome exactly as `opil-coordinator-space` describes.

Verify (read-only):
```bash
python3 -c "import json;print(json.dumps({'query':\"select indexname, indexdef from pg_indexes where tablename='ea_opil_sessions' and indexname like '%one_%'\"}))" > /private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/q2.json
curl -s -X POST "https://api.supabase.com/v1/projects/pgqdmnmessbbzyszjfvr/database/query" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" --data @/private/tmp/claude-501/-Users-nelsontaylor/befaed58-c3f8-47a2-be54-94f544a226fc/scratchpad/q2.json
```
Expected: exactly one row, `ea_opil_sessions_one_stream`, whose `indexdef` contains `WHERE (is_live AND (COALESCE(stream_url, ''::text) !~~ 'rtk:%'::text))`.

- [ ] **Step 2: Push**

```bash
git push origin domain-migration:main
```
Then watch the Pages run: `gh run list --workflow deploy-pages.yml --limit 1` until `completed success`. **Never re-run a failed Pages deploy** (`gotcha-pages-rerun-duplicate-artifact`) — push an empty commit instead.

- [ ] **Step 3: Verify on the bare URL** (`gotcha-verify-deploys-on-the-bare-url`)

Run: `curl -s https://taylormadeacademy.com/opil/hub/live/ | grep -o 'live-rooms.js?v=[a-z0-9]*' ; curl -s https://taylormadeacademy.com/sw.js | grep VERSION`
Expected: the fresh hash from Task 6, and `tma-v10-parallel-rooms`.

- [ ] **Step 4: The real test — Nelson + Jamal**

Send Jamal `https://taylormadeacademy.com/opil/hub/live/?s=<a session Nelson is NOT using>` and have Nelson open a different session's link. Each presses **Start class** and **Join**. Pass = both rooms show LIVE at once, each sees only their own chat, hub home lists two rooms. Then both **End session**.

- [ ] **Step 5: Memory**

Update `~/.claude/projects/-Users-nelsontaylor/memory/opil-class-room-live.md` (parallel rooms, the link shape, the one-stream rule) and its line in `MEMORY.md`.

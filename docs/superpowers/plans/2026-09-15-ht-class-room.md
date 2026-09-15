# HT Class Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The OPIL class room inside the HT Hub at `/ht/hub/live/`, in Huston-Tillotson maroon and gold, as the second row of the Academy room's `ea_rooms` table — one link, sign in first, hosts = Nelson + emails he adds, replays published by the host.

**Architecture:** The HT room is `ea_rooms` row `slug = 'ht'`. Migration 0037 turns the Academy room's one-row table into many rooms (slug, host_name, host_emails, presets per row) and re-keys every policy on a per-room `ea_room_is_host()`. The page is the generated HT hub shell: `ht.js` gains a `room` block that dynamically imports `ht/hub/room.js`, which reads `ea_room_state(k, 'ht')`, shows the HT cards or the host card, and mounts the shared `js/rtk-room-v2.js` with HT words and HT design tokens. The room CSS is a fork of `css/rtk-room-v2.css` in HT colors (OPIL orientation is Wed 9/16 — the shared CSS is not touched before then).

**Tech Stack:** static HTML on GitHub Pages (`taylormadecreative/academy`, Pages serves `main`; deploy = `git push origin domain-migration:main`), vanilla JS (classic `ht.js` + ES modules), Supabase (Postgres + RLS + edge functions on Deno), Cloudflare RealtimeKit (`@cloudflare/realtimekit` 2.0.2 IIFE + `realtimekit-ui` 2.0.2), node:test for pure JS, `deno test` for functions, Playwright (system Chrome) for the page harness.

**Spec:** `docs/superpowers/specs/2026-09-15-ht-class-room-design.md` (this plan argues from it; read it first). Parent specs: `2026-09-14-academy-room-design.md`, `2026-09-14-opil-room-v2-design.md`.

## Global Constraints

- **Work in the worktree `~/taylormade-academy-ht` on branch `ht-class-room`** (off `academy-room`). Another Claude session is building the Academy room in `~/taylormade-academy` on `academy-room` — never edit that directory, never `git stash`. Tasks 8–9 touch files that session owns and run ONLY after `academy-room` has merged into `domain-migration` (rebase this branch first: `git rebase academy-room`).
- **Never sign in to prod from a test.** Every page test stubs Supabase and the kit (memory: `gotcha-e2e-hits-prod-supabase`). Prod DB writes are staged as a script Nelson runs with `!` (memory: `gotcha-prod-deploy-classifier-use-bang-script`).
- **HT brand hex is authoritative:** Maroon `#660100`, Gold `#FFCC00`, Mahogany `#3B0000`, Terra `#291C14`, Brick `#8F0000`, Ember `#F7E3B8`, Taupe `#C09780`, Sage `#94CCAB`, Fresh `#C7EDBF`, Eco Green `#00373E`, Lumen `#F2B00D`, Crimson `#FA2626`, Bloom `#FAA88A`, Cinder `#BA2E2E`, Sand `#FFFAEB`. One off-palette ramp step is allowed: `#4D0000` (background 800).
- **HT page copy rules:** no prices, no vendor/tool names on any page ("HT's own room", never RealtimeKit/Cloudflare/Supabase), never the word "avatar" (Ada = "HT's student ambassador"), sample chips on everything still sample, pronoun for an unknown host = they/them.
- **Never set `display` on a kit element** (`rtk-*`); `[hidden]{display:none!important}` already exists in `ht.css`.
- **One way to go live on the HT live space:** Start class. No camera broadcast, no sample player, no second button.
- Every `?v=` on an `/ht/` asset is the sha1 stamp `ht/build.mjs` computes — run `node ht/build.mjs` after ANY edit under `ht/` and commit the regenerated shells and `all.js`.
- `ea_room_replays` has no select grant for `download_url`/`download_expires_at`: pages select explicit columns, never `*`.
- Commit after every task with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `ht/hub/room-words.js` (new) | HT words for the room, HT client design tokens, HT error text, the login href — pure | 1 |
| `tests/ht/room-words.test.mjs` (new) | node tests for the above | 1 |
| `scripts/rtk-presets/ht-class-host.json`, `ht-class-guest.json` (new) | the two HT presets (HT tokens, HT monogram; guest = no file sharing) | 2 |
| `scripts/gen-ht-presets.mjs` (new), `tests/ht/presets.test.mjs` (new) | generator from the OPIL bodies + the test that pins the diff | 2 |
| `supabase/migrations/0037_ht_room.sql` (new) | slug / host_name / host_emails / presets, `ea_room_is_host`, policy swap, RPCs, the HT row | 3 |
| `scripts/apply-0037.sh`, `scripts/verify-0037.sql` (new) | Nelson's `!` script + the rolled-back proof | 3 |
| `ht/hub/ht.js` | `R.room` block, `V` capture, `[data-room]` → import `room.js`, replay-shelf no-op on the live page | 4 |
| `ht/hub/data/live.js` | the Live space content: `room` block replaces `player`, copy for a two-way room, chat block removed | 4 |
| `ht/build.mjs` | `room.js`, `room.css`, `room-words.js` join the stamp | 4 |
| `ht/hub/room.css` (new) | fork of `css/rtk-room-v2.css` in HT colors + host card + landing/dead/ended cards + `body.in-room` | 5 |
| `tests/ht/contrast.test.mjs` (new) | every text/background pair in `room.css` ≥ 4.5:1 | 5 |
| `ht/hub/room.js` (new) | the page: state → branch → cards / host card / mount the room; recording; replays; who joined | 6 |
| `ht/playbook/index.html`, `ht/index.html` | copy: the live room is a two-way class room, sign in to join | 7 |
| `supabase/functions/ea-rtk-join/handler.ts` + `index.ts` + `handler_test.ts`, `ea-rtk-record/*`, `ea-rtk-webhook/*`, `_shared/rtk_presets.ts` | slug in the body, host by email, presets from the row, Stream name by slug (only what the Academy session did not already carry) | 8 |
| `js/rtk-room-v2.js` | `target.words` / `target.tokens` (only if the Academy session did not carry them) | 9 |
| `scratchpad/harness/ht-room.mjs` (session scratchpad, not committed) | Playwright harness, kit + Supabase stubbed | 10 |
| `sw.js`, memory | version bump, deploy, apply, real run, memory | 11 |

## Spine — names every task shares

- Slug: `'ht'`. Room title default `'HT Live'`. Host name default `'Nelson Taylor'`.
- Presets: `ht-class-host`, `ht-class-guest`. Academy pair: `tma-class-host`, `tma-class-guest`.
- RPCs after 0037: `ea_room_state(p_key text default null, p_slug text default 'academy') → jsonb`; `ea_room_is_host(p_room uuid) → boolean`; `ea_room_rotate_link(p_room uuid) → text` (and the zero-arg Academy overload kept); `ea_room_publish_replay(p_replay uuid, p_publish boolean) → jsonb`; `ea_room_set_hosts(p_room uuid, p_emails text[]) → text[]`; `ea_jwt_email() → text`.
- State object keys: `id, slug, title, is_live, host_name, signed_in, is_host, can_join, bad_link, recording_url, people` — or exactly `{bad_link:true}`.
- Function bodies: `ea-rtk-join { room:'ht', key? }`, `ea-rtk-record { room:'ht', action:'start'|'stop'|'retry_replay', replay_id? }`.
- `mountRoomV2({ mountEl, cfg, token, sb, user, mode:'waiting'|'student'|'host', target:{ kind:'room', slug:'ht', id, title, host_name, words, tokens }, facilitator, onState(st, meeting, reason), onOpened(meetingId) })` → `{ meetingId, leave(), setRecording(bool) }`. `st ∈ 'joined'|'left'|'ended'`.
- Words object keys (must equal `OPIL_WORDS`'s): `one, many, host, teaching, thing, waiting, replayFor, notAllowed, notOpen`.
- Page ids: `#rtkMount` (the mount, inside the `room` block), `.ht-room-ctl` (cards / host card, same block).

---

### Task 1: HT words, tokens, error text, login href (pure JS, node tests)

**Files:**
- Create: `ht/hub/room-words.js`
- Test: `tests/ht/room-words.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `htWords(hostName) → frozen words object`, `HT_TOKENS` (frozen, `provideRtkDesignSystem` shape), `htErrorText(code, status, words) → string`, `htLoginHref(k) → string`.

- [ ] **Step 1: Write the failing test**

```js
// tests/ht/room-words.test.mjs — run: node --test tests/ht/*.test.mjs
// The words and colors that make the Academy room HT's. Pure module, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htWords, HT_TOKENS, htErrorText, htLoginHref } from '../../ht/hub/room-words.js';
import { OPIL_WORDS, nowCopy, joinCopy } from '../../opil/hub/live-rooms.js';

test('htWords carries exactly the OPIL_WORDS keys, frozen, with the host name threaded in', () => {
  const w = htWords('Dr. Gray');
  assert.equal(Object.isFrozen(w), true);
  assert.deepEqual(Object.keys(w).sort(), Object.keys(OPIL_WORDS).sort());
  assert.deepEqual(w, {
    one: 'person', many: 'people', host: 'Dr. Gray', teaching: 'is live', thing: 'session',
    waiting: 'Dr. Gray hasn’t started yet — we’ll bring you in the moment they do.',
    replayFor: 'the HT Hub',
    notAllowed: 'You need your host’s link to join this room.',
    notOpen: 'Dr. Gray hasn’t started yet.',
  });
});

test('htWords falls back to "Your host" for a blank name', () => {
  for (const bad of [undefined, null, '', '   ']) {
    const w = htWords(bad);
    assert.equal(w.host, 'Your host');
    assert.equal(w.waiting, 'Your host hasn’t started yet — we’ll bring you in the moment they do.');
    assert.equal(w.notOpen, 'Your host hasn’t started yet.');
  }
  assert.equal(htWords('  Nelson Taylor ').host, 'Nelson Taylor');
});

test('the shared helpers read HT words: the now strip and the waiting line', () => {
  const w = htWords('Dr. Gray');
  assert.equal(nowCopy({ facilitator: 'Dr. Gray', title: 'Fall town hall', recording: true }, w),
    'Dr. Gray is live: Fall town hall · This session is being recorded');
  assert.equal(nowCopy({ facilitator: null, title: 'Fall town hall', recording: false }, w), 'Session in progress: Fall town hall');
  assert.equal(joinCopy({ live: false, host: false }, w), w.waiting);
});

test('HT_TOKENS has the exact key shape provideRtkDesignSystem gets for the Academy, in HT colors', () => {
  assert.equal(Object.isFrozen(HT_TOKENS), true);
  assert.deepEqual(Object.keys(HT_TOKENS).sort(), ['borderRadius', 'colors', 'spacingBase', 'theme']);
  assert.deepEqual(Object.keys(HT_TOKENS.colors).sort(),
    ['background', 'brand', 'danger', 'success', 'text', 'text-on-brand', 'video-bg', 'warning']);
  assert.deepEqual(Object.keys(HT_TOKENS.colors.brand), ['300', '400', '500', '600', '700']);
  assert.deepEqual(Object.keys(HT_TOKENS.colors.background), ['600', '700', '800', '900', '1000']);
  assert.equal(HT_TOKENS.colors.brand[500], '#FFCC00');           // HT Gold is the accent
  assert.equal(HT_TOKENS.colors.background[1000], '#291C14');     // Terra canvas
  assert.equal(HT_TOKENS.colors.background[700], '#660100');      // HT Maroon panels
  assert.equal(HT_TOKENS.colors['text-on-brand'], '#3B0000');     // Mahogany on gold
  assert.equal(HT_TOKENS.theme, 'dark');
  for (const v of Object.values(HT_TOKENS.colors.brand).concat(Object.values(HT_TOKENS.colors.background)))
    assert.match(v, /^#[0-9A-F]{6}$/);
});

test('htErrorText never says Nelson; every code has a sentence', () => {
  const w = htWords('Dr. Gray');
  const codes = ['sign_in', 'not_allowed', 'bad_link', 'not_open', 'room_full', 'slow_down', 'no_room', 'not_host', 'no_replay', 'nothing_to_retry', 'rtk_not_configured', 'cloudflare_502', 'server_500'];
  for (const c of codes) {
    const t = htErrorText(c, 500, w);
    assert.equal(typeof t, 'string'); assert.ok(t.length > 8, c);
    assert.doesNotMatch(t, /Nelson/, c);
  }
  assert.equal(htErrorText('not_allowed', 403, w), w.notAllowed);
  assert.equal(htErrorText('not_open', 409, w), w.notOpen);
  assert.equal(htErrorText('bad_link', 404, w), 'This link isn’t active anymore — ask your host for the new one.');
  assert.equal(htErrorText('not_host', 403, w), 'Only a host can do that.');
  assert.equal(htErrorText('room_full', 429, w), 'The room is full right now.');
  assert.equal(htErrorText('zzz', 418, w), 'The server said 418.');
});

test('htLoginHref carries the key back through the email code', () => {
  assert.equal(htLoginHref(null), '/login/?next=' + encodeURIComponent('/ht/hub/live/'));
  assert.equal(htLoginHref('AbC123_-xyzXYZ0987ab-_'), '/login/?next=' + encodeURIComponent('/ht/hub/live/?k=AbC123_-xyzXYZ0987ab-_'));
  assert.doesNotMatch(htLoginHref('AbC123_-xyzXYZ0987ab-_'), /[?&]k=/);   // the key is inside `next`, not a top-level param
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ~/taylormade-academy-ht && node --test tests/ht/room-words.test.mjs`
Expected: FAIL — `Cannot find module '.../ht/hub/room-words.js'`.

- [ ] **Step 3: Write the module**

```js
/* ht/hub/room-words.js — the words and colors that make the Academy room HT's. Pure: no DOM,
   no supabase; tests/ht/room-words.test.mjs covers it. Imported by ht/hub/room.js (both ride the
   HT build stamp from ht/build.mjs). The words object has the same keys as OPIL_WORDS /
   ROOM_WORDS in opil/hub/live-rooms.js — the room module reads them through nowCopy/joinCopy. */

/* The host is whoever the room row names (ea_rooms.host_name): Nelson today, an HT staffer once
   Nelson adds their email. Nobody in HT's room is assumed to be Nelson. */
export function htWords(hostName) {
  const host = (hostName && String(hostName).trim()) || 'Your host';
  return Object.freeze({
    one: 'person', many: 'people', host, teaching: 'is live', thing: 'session',
    waiting: host + ' hasn’t started yet — we’ll bring you in the moment they do.',
    replayFor: 'the HT Hub',
    notAllowed: 'You need your host’s link to join this room.',
    notOpen: host + ' hasn’t started yet.',
  });
}

/* provideRtkDesignSystem's shape (js/rtk-room-v2.js passes the Academy navy/gold in exactly this
   form): brand runs 300 dark → 700 light, the OPPOSITE of the preset JSON's 300 light → 700 dark.
   Terra canvas, Mahogany deep, Maroon panels, Brick raised; Gold accent with Mahogany text on it.
   #4D0000 is the one step not in HT's extended palette — the midpoint between Mahogany and Maroon. */
export const HT_TOKENS = Object.freeze({
  theme: 'dark', borderRadius: 'rounded', spacingBase: 4,
  colors: Object.freeze({
    brand: Object.freeze({ 300: '#B38F00', 400: '#D9AD00', 500: '#FFCC00', 600: '#FFD940', 700: '#FFE580' }),
    background: Object.freeze({ 600: '#8F0000', 700: '#660100', 800: '#4D0000', 900: '#3B0000', 1000: '#291C14' }),
    text: '#FFFFFF', 'text-on-brand': '#3B0000', 'video-bg': '#3B0000',
    danger: '#FA2626', success: '#94CCAB', warning: '#F2B00D',
  }),
});

/* what an ea-rtk-join / ea-rtk-record error says on the HT page — js/room-page.js has the same
   list with "Nelson" in it; HT's host is whoever the row names, so these never say a name */
export function htErrorText(code, status, words) {
  switch (code) {
    case 'sign_in': return 'Sign in again and retry.';
    case 'not_allowed': return words.notAllowed;
    case 'bad_link': return 'This link isn’t active anymore — ask your host for the new one.';
    case 'not_open': return words.notOpen;
    case 'room_full': return 'The room is full right now.';
    case 'slow_down': return 'Too many tries — wait a minute and try again.';
    case 'no_room': return 'The room isn’t open yet.';
    case 'not_host': return 'Only a host can do that.';
    case 'no_replay': return 'That replay is gone.';
    case 'nothing_to_retry': return 'Nothing to retry for that replay.';
    case 'rtk_not_configured': return 'The room is not set up yet.';
    default: return 'The server said ' + (status || code || 'nothing') + '.';
  }
}

/* "Sign in to join" → /login/?next=/ht/hub/live/?k=… so the key survives the email code and /welcome/ */
export function htLoginHref(k) {
  return '/login/?next=' + encodeURIComponent('/ht/hub/live/' + (k ? '?k=' + k : ''));
}
```

- [ ] **Step 4: Run the tests**

Run: `cd ~/taylormade-academy-ht && node --test tests/ht/room-words.test.mjs tests/academy/*.test.mjs tests/opil/*.test.mjs`
Expected: all PASS (the OPIL and Academy suites prove nothing shared moved).

- [ ] **Step 5: Commit**

```bash
cd ~/taylormade-academy-ht && git add ht/hub/room-words.js tests/ht/room-words.test.mjs && git commit -m "feat(ht): room words, HT design tokens, error text, login href — pure, node-tested

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The two HT presets (generated, pinned by a test)

**Files:**
- Create: `scripts/gen-ht-presets.mjs`, `scripts/rtk-presets/ht-class-host.json`, `scripts/rtk-presets/ht-class-guest.json`
- Test: `tests/ht/presets.test.mjs`

**Interfaces:**
- Consumes: `scripts/rtk-presets/opil-host.json`, `opil-student.json` (the OPIL bodies; `tma-class-*.json` may not exist on this branch yet — the guest diff is the same one the Academy spec §5 describes: `chat.public.files=false`, `chat.private.files=false`).
- Produces: two JSON bodies `scripts/rtk-presets.sh` and the join function's `ensurePresets` can POST as-is. Names `ht-class-host` / `ht-class-guest`.

- [ ] **Step 1: Write the failing test**

```js
// tests/ht/presets.test.mjs — run: node --test tests/ht/presets.test.mjs
// The HT presets are the OPIL bodies with HT's name, HT's design tokens and (guest) no file sharing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (n) => JSON.parse(fs.readFileSync(new URL('../../scripts/rtk-presets/' + n + '.json', import.meta.url), 'utf8'));

const HT_UI = {
  theme: 'darkest', font_family: 'Inter', border_radius: 'rounded', border_width: 'thin',
  colors: {
    brand: { 300: '#FFE580', 400: '#FFD940', 500: '#FFCC00', 600: '#D9AD00', 700: '#B38F00' },
    background: { 600: '#8F0000', 700: '#660100', 800: '#4D0000', 900: '#3B0000', 1000: '#291C14' },
    text: '#FFFFFF', text_on_brand: '#3B0000', video_bg: '#3B0000',
    danger: '#FA2626', success: '#94CCAB', warning: '#F2B00D',
  },
  logo: 'https://taylormadeacademy.com/ht/img/ht-monogram-gold.png', spacing_base: 4,
};

function stripUiAndName(p) { const c = JSON.parse(JSON.stringify(p)); delete c.name; delete c.ui; return c; }

test('ht-class-host = opil-host with HT name + HT tokens, nothing else changed', () => {
  const ht = read('ht-class-host'), opil = read('opil-host');
  assert.equal(ht.name, 'ht-class-host');
  assert.deepEqual(ht.ui.design_tokens, HT_UI);
  assert.deepEqual(stripUiAndName(ht), stripUiAndName(opil));
  assert.equal(ht.config.view_type, 'GROUP_CALL');
});

test('ht-class-guest = opil-student with HT name + HT tokens + no file sharing, nothing else changed', () => {
  const ht = read('ht-class-guest'), opil = read('opil-student');
  assert.equal(ht.name, 'ht-class-guest');
  assert.deepEqual(ht.ui.design_tokens, HT_UI);
  assert.equal(ht.permissions.chat.public.files, false);
  assert.equal(ht.permissions.chat.private.files, false);
  assert.equal(ht.permissions.chat.public.text, true);          // text chat stays
  const a = stripUiAndName(ht), b = stripUiAndName(opil);
  b.permissions.chat.public.files = false; b.permissions.chat.private.files = false;
  assert.deepEqual(a, b);
});

test('both bodies keep the two fields the API silently requires', () => {
  for (const n of ['ht-class-host', 'ht-class-guest']) {
    const p = read(n);
    assert.equal(typeof p.permissions.plugins.config, 'object');   // 400 without it (memory: realtimekit-live-rooms)
    assert.equal(p.ui.design_tokens.spacing_base, 4);
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ~/taylormade-academy-ht && node --test tests/ht/presets.test.mjs`
Expected: FAIL — `ENOENT … ht-class-host.json`.

- [ ] **Step 3: Write the generator and run it**

```js
// scripts/gen-ht-presets.mjs — write the two HT preset bodies from the OPIL ones.
// Run: node scripts/gen-ht-presets.mjs   (re-runnable; the test pins the result)
import fs from 'node:fs';
const DIR = new URL('./rtk-presets/', import.meta.url);
const read = (n) => JSON.parse(fs.readFileSync(new URL(n + '.json', DIR), 'utf8'));
const write = (n, o) => fs.writeFileSync(new URL(n + '.json', DIR), JSON.stringify(o, null, 2) + '\n');

/* preset JSON ramps run 300 light → 700 dark (the opposite of the client call in js/rtk-room-v2.js) */
const HT_UI = {
  theme: 'darkest', font_family: 'Inter', border_radius: 'rounded', border_width: 'thin',
  colors: {
    brand: { 300: '#FFE580', 400: '#FFD940', 500: '#FFCC00', 600: '#D9AD00', 700: '#B38F00' },
    background: { 600: '#8F0000', 700: '#660100', 800: '#4D0000', 900: '#3B0000', 1000: '#291C14' },
    text: '#FFFFFF', text_on_brand: '#3B0000', video_bg: '#3B0000',
    danger: '#FA2626', success: '#94CCAB', warning: '#F2B00D',
  },
  logo: 'https://taylormadeacademy.com/ht/img/ht-monogram-gold.png', spacing_base: 4,
};

const host = read('opil-host');
host.name = 'ht-class-host'; host.ui = { design_tokens: HT_UI };
write('ht-class-host', host);

const guest = read('opil-student');
guest.name = 'ht-class-guest'; guest.ui = { design_tokens: HT_UI };
/* strangers under HT's name must not push files to each other; text chat stays */
guest.permissions.chat.public.files = false;
guest.permissions.chat.private.files = false;
write('ht-class-guest', guest);
console.log('wrote ht-class-host.json, ht-class-guest.json');
```

Run: `cd ~/taylormade-academy-ht && node scripts/gen-ht-presets.mjs && python3 -c "import json;[json.load(open('scripts/rtk-presets/'+n+'.json')) for n in ('ht-class-host','ht-class-guest')];print('valid json')"`
Expected: `wrote …` then `valid json`.

- [ ] **Step 4: Run the test**

Run: `cd ~/taylormade-academy-ht && node --test tests/ht/presets.test.mjs`
Expected: 3 PASS.

- [ ] **Step 5: Check `scripts/rtk-presets.sh` picks them up without edits**

Run: `cd ~/taylormade-academy-ht && grep -n 'rtk-presets/\*.json' scripts/rtk-presets.sh`
Expected: one line — the script loops every `*.json` in the folder, so the two new files POST on the next run with a token in the shell. No edit needed.

- [ ] **Step 6: Commit**

```bash
cd ~/taylormade-academy-ht && git add scripts/gen-ht-presets.mjs scripts/rtk-presets/ht-class-host.json scripts/rtk-presets/ht-class-guest.json tests/ht/presets.test.mjs && git commit -m "feat(ht): ht-class-host / ht-class-guest presets — HT maroon/gold tokens, HT monogram, guests share no files

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Migration 0037 — many rooms, hosts by email, the HT row — plus Nelson's apply/verify script

**Files:**
- Create: `supabase/migrations/0037_ht_room.sql`, `scripts/apply-0037.sh`, `scripts/verify-0037.sql`

**Interfaces:**
- Consumes: 0036 as shipped (`ea_rooms`, `ea_room_members`, `ea_room_hands`, `ea_room_replays`, `ea_room_in_session`, `ea_room_new_key`, `ea_is_admin`, `ea_is_member`).
- Produces: the spine's RPC signatures; `ea_rooms` columns `slug, host_name, host_emails, host_preset, guest_preset`; policies re-keyed on `ea_room_is_host`; row `slug='ht'`.

- [ ] **Step 1: Write the migration**

```sql
-- 0037: the HT class room — ea_rooms becomes MANY rooms (slug), hosts by email, presets per row.
-- Spec: docs/superpowers/specs/2026-09-15-ht-class-room-design.md §4. Runs AFTER 0036. Safe to
-- re-run: every column is add-if-missing, every policy/function is drop-then-create, the HT row is
-- insert-on-conflict-do-nothing. The Academy row keeps every behaviour 0036 gave it (host = Nelson,
-- Academy members join without a key and see its replay); the HT row admits only hosts and the key.
-- Every revoke runs AFTER its create (the 0023 lesson).

-- ---------- 4.1 columns ----------
alter table public.ea_rooms
  add column if not exists slug         text,
  add column if not exists host_name    text not null default 'Nelson Taylor',
  add column if not exists host_emails  text[] not null default '{}',
  add column if not exists host_preset  text not null default 'tma-class-host',
  add column if not exists guest_preset text not null default 'tma-class-guest';
update public.ea_rooms set slug = 'academy' where slug is null;
alter table public.ea_rooms alter column slug set not null;
alter table public.ea_rooms drop constraint if exists ea_rooms_slug_shape;
alter table public.ea_rooms add constraint ea_rooms_slug_shape check (slug ~ '^[a-z][a-z0-9-]{1,31}$');
alter table public.ea_rooms drop constraint if exists ea_rooms_host_name_len;
alter table public.ea_rooms add constraint ea_rooms_host_name_len check (char_length(host_name) between 1 and 80);
-- uniqueness on slug replaces "exactly one row"; the single-row index must go BEFORE the second row
drop index if exists public.ea_rooms_single;
create unique index if not exists ea_rooms_slug on public.ea_rooms (slug);
insert into public.ea_rooms (slug, title, host_preset, guest_preset)
  values ('ht', 'HT Live', 'ht-class-host', 'ht-class-guest')
  on conflict (slug) do nothing;
-- hosts may rename what guests read; host_emails / slug / presets / meeting_id / link_key keep NO update grant
grant update (host_name) on public.ea_rooms to authenticated;

-- ---------- 4.2 who is a host ----------
-- the email in the caller's JWT, lowercased; both claim spellings so verify's impersonation works
create or replace function public.ea_jwt_email() returns text
language sql stable as
$$ select lower(coalesce(nullif(current_setting('request.jwt.claim.email', true), ''),
                         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')) $$;
revoke all on function public.ea_jwt_email() from public;
grant execute on function public.ea_jwt_email() to anon, authenticated;

-- Nelson (ea_is_admin) hosts every room; a listed email hosts THAT room. Definer so the policies
-- below can ask it without reading ea_rooms through their own RLS (the recursion lesson).
create or replace function public.ea_room_is_host(p_room uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.ea_is_admin()
       or exists (select 1 from public.ea_rooms r
                  where r.id = p_room and public.ea_jwt_email() is not null
                    and public.ea_jwt_email() = any(r.host_emails)) $$;
revoke all on function public.ea_room_is_host(uuid) from public, anon;
grant execute on function public.ea_room_is_host(uuid) to authenticated;

-- ---------- policies: admin-only → host-of-this-room ----------
drop policy if exists rooms_admin_read on public.ea_rooms;
create policy rooms_admin_read on public.ea_rooms for select to authenticated
  using (public.ea_room_is_host(id));
drop policy if exists rooms_admin_update on public.ea_rooms;
create policy rooms_admin_update on public.ea_rooms for update to authenticated
  using (public.ea_room_is_host(id)) with check (public.ea_room_is_host(id));

drop policy if exists room_members_admin_read on public.ea_room_members;
create policy room_members_admin_read on public.ea_room_members for select to authenticated
  using (public.ea_room_is_host(room_id));

drop policy if exists room_replays_admin_read on public.ea_room_replays;
create policy room_replays_admin_read on public.ea_room_replays for select to authenticated
  using (public.ea_room_is_host(room_id));   -- room_id null (room deleted) → ea_is_admin() only

drop policy if exists room_hands_read on public.ea_room_hands;
create policy room_hands_read on public.ea_room_hands for select to authenticated
  using (public.ea_room_is_host(room_id) or public.ea_room_in_session(room_id));
drop policy if exists room_hands_update_host on public.ea_room_hands;
create policy room_hands_update_host on public.ea_room_hands for update to authenticated
  using (public.ea_room_is_host(room_id)) with check (public.ea_room_is_host(room_id));
drop policy if exists room_hands_delete_own on public.ea_room_hands;
create policy room_hands_delete_own on public.ea_room_hands for delete to authenticated
  using (user_id = auth.uid() or public.ea_room_is_host(room_id));

-- ---------- 4.3 ea_room_state(p_key, p_slug) ----------
-- The one-argument version goes: with a defaulted second argument the two would be ambiguous.
-- Pages call rpc('ea_room_state', {p_key}) or {p_key, p_slug} — both resolve here.
drop function if exists public.ea_room_state(text);
create or replace function public.ea_room_state(p_key text default null, p_slug text default 'academy') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.ea_rooms%rowtype;
  v_host boolean; v_member boolean; v_joined boolean; v_can boolean;
begin
  select * into r from public.ea_rooms where slug = p_slug;
  if not found then return null; end if;
  v_host := public.ea_room_is_host(r.id);
  v_member := (r.slug = 'academy') and public.ea_is_member();      -- Academy membership opens the Academy room only
  v_joined := auth.uid() is not null and exists (select 1 from public.ea_room_members m where m.room_id = r.id and m.user_id = auth.uid());
  v_can := v_host or v_member or (p_key is not null and p_key = r.link_key);
  if (not v_can) and p_key is not null and p_key <> r.link_key then
    return jsonb_build_object('bad_link', true);
  end if;
  return jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'is_live', r.is_live, 'host_name', r.host_name,
    'signed_in', auth.uid() is not null,
    'is_host', v_host,
    'can_join', v_can,
    'bad_link', false,
    'recording_url', case when v_host or v_member or v_joined then r.recording_url else null end,
    'people', case when v_host then (select count(*) from public.ea_room_members m
                                      where m.room_id = r.id and m.last_joined_at >= coalesce(r.live_since, 'epoch'::timestamptz))
                   else null end
  );
end $$;
revoke all on function public.ea_room_state(text, text) from public;
grant execute on function public.ea_room_state(text, text) to anon, authenticated;

-- ---------- 4.4 RPCs ----------
create or replace function public.ea_room_rotate_link(p_room uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare k text;
begin
  if not public.ea_room_is_host(p_room) then raise exception 'only a host can do that' using errcode = '42501'; end if;
  update public.ea_rooms set link_key = public.ea_room_new_key(), updated_at = now() where id = p_room returning link_key into k;
  if k is null then raise exception 'no such room' using errcode = 'P0002'; end if;
  return k;
end $$;
revoke all on function public.ea_room_rotate_link(uuid) from public, anon;
grant execute on function public.ea_room_rotate_link(uuid) to authenticated;
-- the Academy page's zero-argument call keeps working: it rotates the Academy room
create or replace function public.ea_room_rotate_link() returns text
language sql volatile security definer set search_path = public as
$$ select public.ea_room_rotate_link((select id from public.ea_rooms where slug = 'academy')) $$;
revoke all on function public.ea_room_rotate_link() from public, anon;
grant execute on function public.ea_room_rotate_link() to authenticated;

-- publish copies watch_url → THAT room's recording_url and unpublishes only THAT room's other
-- replays (0036 unpublished every other row — with two rooms that would clear the Academy's).
create or replace function public.ea_room_publish_replay(p_replay uuid, p_publish boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r public.ea_room_replays%rowtype;
begin
  select * into r from public.ea_room_replays where id = p_replay and status = 'ready' and watch_url is not null;
  if not found then raise exception 'this replay is not ready' using errcode = 'P0002'; end if;
  if r.room_id is null then raise exception 'this replay has no room' using errcode = 'P0002'; end if;
  if not public.ea_room_is_host(r.room_id) then raise exception 'only a host can do that' using errcode = '42501'; end if;
  if p_publish then
    update public.ea_room_replays set published = true, updated_at = now() where id = r.id;
    update public.ea_room_replays set published = false, updated_at = now() where id <> r.id and published and room_id = r.room_id;
    update public.ea_rooms set recording_url = r.watch_url, updated_at = now() where id = r.room_id;
    return jsonb_build_object('ok', true, 'published', true, 'recording_url', r.watch_url);
  else
    update public.ea_room_replays set published = false, updated_at = now() where id = r.id and published;
    update public.ea_rooms set recording_url = null, updated_at = now() where id = r.room_id and recording_url = r.watch_url;
    return jsonb_build_object('ok', true, 'published', false, 'recording_url', null);
  end if;
end $$;
revoke all on function public.ea_room_publish_replay(uuid, boolean) from public, anon;
grant execute on function public.ea_room_publish_replay(uuid, boolean) to authenticated;

-- only Nelson sets who hosts a room: lowercased, trimmed, deduplicated, valid-looking, at most 50
create or replace function public.ea_room_set_hosts(p_room uuid, p_emails text[]) returns text[]
language plpgsql volatile security definer set search_path = public as $$
declare v text[];
begin
  if not public.ea_is_admin() then raise exception 'only Nelson can do that' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct e order by e), '{}'::text[]) into v
    from (select lower(trim(x)) as e from unnest(coalesce(p_emails, '{}'::text[])) as x) s
    where e ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  if coalesce(array_length(v, 1), 0) > 50 then raise exception 'at most 50 hosts' using errcode = '22023'; end if;
  update public.ea_rooms set host_emails = v, updated_at = now() where id = p_room;
  if not found then raise exception 'no such room' using errcode = 'P0002'; end if;
  return v;
end $$;
revoke all on function public.ea_room_set_hosts(uuid, text[]) from public, anon;
grant execute on function public.ea_room_set_hosts(uuid, text[]) to authenticated;

select 'ht room ready' as status;
```

- [ ] **Step 2: Write the verify (rolled back, keeps nothing)**

```sql
-- scripts/verify-0037.sql — proves migration 0037 on prod and KEEPS NOTHING (begin … rollback).
-- Same harness as verify-0036.sql: each check appends OK/FAIL/SKIP/INFO to a temp table, the select
-- before the rollback is what the Management API returns. Impersonation sets request.jwt.claims
-- (json, with email) AND request.jwt.claim.sub / .email (plain) so auth.uid() and ea_jwt_email()
-- both see the fake user. Run by scripts/apply-0037.sh.
begin;
create temp table verify_out (n serial primary key, line text not null) on commit drop;

do $v$
declare
  v_ht uuid; v_ac uuid; v_ht_key text; v_ac_key text;
  v_guest uuid := '00000000-0000-4000-8000-000000000037';
  v_email text := 'zz-test-0037@example.com';
  v_claims text; v_state jsonb; v_n bigint; v_t text; v_arr text[];
  v_rep_ht uuid; v_rep_ac uuid; v_adm uuid; v_adm_claims text;
begin
  -- 0. a throwaway account with an email (the members FK and ea_jwt_email need a real row); if this
  --    project refuses inserts into auth.users, fall back to an existing account that is neither admin
  --    nor member and use ITS email — the same fallback verify-0036 uses (all of it rolled back).
  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values (v_guest, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            v_email, '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into verify_out(line) values ('INFO guest = throwaway auth.users row (rolled back)');
  exception when others then
    v_guest := null;
    for v_adm in select u.id from auth.users u where u.email is not null order by u.created_at limit 50 loop
      perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_adm), true), set_config('request.jwt.claim.sub', v_adm::text, true);
      if not public.ea_is_admin() and not public.ea_is_member() then v_guest := v_adm; exit; end if;
    end loop;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    v_adm := null;
    if v_guest is null then
      insert into verify_out(line) values ('FAIL no guest account to test with (auth.users insert refused: ' || sqlstate || '; no non-admin, non-member account found)');
      return;
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = v_guest;
    insert into verify_out(line) values ('INFO guest = existing account ' || v_guest || ' (auth.users insert refused: ' || sqlstate || ')');
  end;
  v_claims := format('{"sub":"%s","role":"authenticated","email":"%s"}', v_guest, v_email);

  -- 1. two rows, the right slugs and presets, the single-row index gone
  select id, link_key into v_ht, v_ht_key from public.ea_rooms where slug = 'ht';
  select id, link_key into v_ac, v_ac_key from public.ea_rooms where slug = 'academy';
  insert into verify_out(line) values (case when v_ht is not null and v_ac is not null then 'OK ' else 'FAIL ' end || 'rows academy + ht exist');
  if v_ht is null or v_ac is null then return; end if;
  select host_preset || '/' || guest_preset || '/' || title || '/' || host_name into v_t from public.ea_rooms where id = v_ht;
  insert into verify_out(line) values (case when v_t = 'ht-class-host/ht-class-guest/HT Live/Nelson Taylor' then 'OK ' else 'FAIL ' end || 'ht row defaults · ' || v_t);
  select host_preset || '/' || guest_preset into v_t from public.ea_rooms where id = v_ac;
  insert into verify_out(line) values (case when v_t = 'tma-class-host/tma-class-guest' then 'OK ' else 'FAIL ' end || 'academy row keeps the Academy presets · ' || v_t);
  insert into verify_out(line) values (case when not exists (select 1 from pg_indexes where indexname = 'ea_rooms_single') then 'OK ' else 'FAIL ' end || 'ea_rooms_single is gone');
  insert into verify_out(line) values (case when exists (select 1 from pg_indexes where indexname = 'ea_rooms_slug') then 'OK ' else 'FAIL ' end || 'ea_rooms_slug unique index exists');
  begin
    insert into public.ea_rooms (slug) values ('ht');
    insert into verify_out(line) values ('FAIL a second ht row was accepted');
  exception when unique_violation then
    insert into verify_out(line) values ('OK a second ht row is refused (23505)');
  end;

  -- 2. anon: the HT shape, a bad key, the real key
  begin
    set local role anon;
    select public.ea_room_state(null, 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'slug' = 'ht' and v_state->>'signed_in' = 'false' and v_state->>'is_host' = 'false'
        and v_state->>'can_join' = 'false' and v_state->>'bad_link' = 'false' and v_state->>'host_name' = 'Nelson Taylor'
        and not (v_state ? 'link_key') and not (v_state ? 'meeting_id') and not (v_state ? 'host_emails')
        and v_state->'recording_url' = 'null'::jsonb and v_state->'people' = 'null'::jsonb
      then 'OK ' else 'FAIL ' end || 'anon ea_room_state(null, ht) shape, no secrets · ' || coalesce(v_state::text, 'null'));
    set local role anon;
    select public.ea_room_state('nope', 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'anon bad key on ht = {"bad_link":true} · ' || coalesce(v_state::text, 'null'));
    set local role anon;
    select public.ea_room_state(v_ht_key, 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'can_join' = 'true' and v_state->>'signed_in' = 'false' then 'OK ' else 'FAIL ' end || 'anon with the real key: can_join true, signed_in false · ' || coalesce(v_state::text, 'null'));
    set local role anon;
    select public.ea_room_state(null, 'nope') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state is null then 'OK ' else 'FAIL ' end || 'unknown slug → null');
    set local role anon;
    select public.ea_room_state('nope') into v_state;   -- the Academy page's one-arg call still resolves
    reset role;
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'one-argument ea_room_state(key) still resolves (defaults to academy) · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon ea_room_state raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 3. a signed-in stranger: not a host, reads no room, no replay; after joining once, sees the replay
  update public.ea_rooms set recording_url = 'https://example.invalid/r/watch' where id = v_ht;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'ht') into v_state;
    select count(*) into v_n from public.ea_rooms;
    reset role;
    insert into verify_out(line) values (case when v_state->>'is_host' = 'false' and v_state->>'can_join' = 'false' and v_state->'recording_url' = 'null'::jsonb then 'OK ' else 'FAIL ' end || 'stranger: not host, cannot join, no replay · ' || coalesce(v_state::text, 'null'));
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'stranger reads 0 rows of ea_rooms · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL stranger checks raised ' || sqlstate || ' ' || sqlerrm);
  end;
  insert into public.ea_room_members (room_id, user_id) values (v_ht, v_guest);   -- as the join function would (service role)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'recording_url' = 'https://example.invalid/r/watch' and v_state->>'can_join' = 'false' then 'OK ' else 'FAIL ' end || 'someone who joined before sees the replay, still cannot join without the key · ' || coalesce(v_state::text, 'null'));
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'academy') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->'recording_url' = 'null'::jsonb and v_state->>'can_join' = 'false' then 'OK ' else 'FAIL ' end || 'an HT joiner gets nothing on the Academy row · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL joiner checks raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 4. ea_room_set_hosts: refused for the stranger; as postgres it normalises the list
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_set_hosts(v_ht, array[v_email]);
    reset role;
    insert into verify_out(line) values ('FAIL a non-admin could set hosts');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_set_hosts refuses a non-admin (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_set_hosts raised ' || sqlstate || ' ' || sqlerrm);
  end;
  -- (as the migration owner, bypassing the admin check is not possible: call the update directly to stage the host list)
  select coalesce(array_agg(distinct e order by e), '{}'::text[]) into v_arr
    from (select lower(trim(x)) as e from unnest(array['  ZZ-Test-0037@Example.com ', v_email, '', 'not-an-email']) as x) s
    where e ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  insert into verify_out(line) values (case when v_arr = array[v_email] then 'OK ' else 'FAIL ' end || 'host list normalises (lower, trim, dedupe, drop junk) · ' || v_arr::text);
  update public.ea_rooms set host_emails = array[v_email] where id = v_ht;

  -- 5. the listed email is now a host of ht — and of nothing else
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'ht') into v_state;
    select count(*) into v_n from public.ea_rooms;
    reset role;
    insert into verify_out(line) values (case when v_state->>'is_host' = 'true' and v_state->>'can_join' = 'true' and (v_state->>'people')::int = 1 then 'OK ' else 'FAIL ' end || 'listed email: is_host, can_join, people=1 on ht · ' || coalesce(v_state::text, 'null'));
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'listed email reads exactly its own room row (ht, not academy) · ' || v_n);
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'academy') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'is_host' = 'false' then 'OK ' else 'FAIL ' end || 'listed email is NOT a host of academy · ' || coalesce(v_state::text, 'null'));
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    update public.ea_rooms set title = 'zz-test title', host_name = 'Dr. Test' where id = v_ht;
    get diagnostics v_n = row_count;
    reset role;
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'host updates title + host_name on its room · ' || v_n || ' row');
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_rotate_link(v_ht) into v_t;
    reset role;
    insert into verify_out(line) values (case when v_t ~ '^[A-Za-z0-9_-]{22}$' and v_t <> v_ht_key then 'OK ' else 'FAIL ' end || 'host rotates its own link');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL host checks raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_rotate_link(v_ac);
    reset role;
    insert into verify_out(line) values ('FAIL an HT host rotated the Academy link');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK an HT host cannot rotate the Academy link (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL rotate(academy) as HT host raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    update public.ea_rooms set host_emails = '{}' where id = v_ht;
    reset role;
    insert into verify_out(line) values ('FAIL a host could update host_emails (column grant missing)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK host_emails has no update grant for authenticated (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL host_emails update raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 6. publish is scoped to the room: publishing ht's replay leaves academy's published
  insert into public.ea_room_replays (room_id, meeting_id, recording_id, status, watch_url, published)
    values (v_ac, 'zz-meet-ac', 'zz-rec-ac', 'ready', 'https://example.invalid/ac/watch', true) returning id into v_rep_ac;
  insert into public.ea_room_replays (room_id, meeting_id, recording_id, status, watch_url)
    values (v_ht, 'zz-meet-ht', 'zz-rec-ht', 'ready', 'https://example.invalid/ht/watch') returning id into v_rep_ht;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_publish_replay(v_rep_ht, true);
    reset role;
    select count(*) into v_n from public.ea_room_replays where id = v_rep_ac and published;
    select recording_url into v_t from public.ea_rooms where id = v_ht;
    insert into verify_out(line) values (case when v_n = 1 and v_t = 'https://example.invalid/ht/watch' then 'OK ' else 'FAIL ' end || 'publish ht → ht.recording_url set, academy replay still published');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL publish as HT host raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_publish_replay(v_rep_ac, false);
    reset role;
    insert into verify_out(line) values ('FAIL an HT host unpublished an Academy replay');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK an HT host cannot touch an Academy replay (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL unpublish(academy) as HT host raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select count(*) into v_n from public.ea_room_replays;
    reset role;
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'HT host reads only HT replays · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL replay read raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 7. Nelson still hosts both rooms
  select p.id into v_adm from public.profiles p where p.role = 'admin' order by p.id limit 1;
  if v_adm is null then
    insert into verify_out(line) values ('SKIP admin checks — no profiles row with role = admin');
  else
    v_adm_claims := format('{"sub":"%s","role":"authenticated"}', v_adm);
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_adm::text, true), set_config('request.jwt.claim.email', '', true);
      select (public.ea_room_state(null, 'ht')->>'is_host') || '/' || (public.ea_room_state(null, 'academy')->>'is_host') into v_t;
      select count(*) into v_n from public.ea_rooms;
      reset role;
      insert into verify_out(line) values (case when v_t = 'true/true' and v_n = 2 then 'OK ' else 'FAIL ' end || 'admin hosts both rooms and reads both rows · ' || v_t || ' · ' || v_n);
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin checks raised ' || sqlstate || ' ' || sqlerrm);
    end;
  end if;

  -- 8. the hands column grant still holds (inherited from 0036)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    insert into public.ea_room_hands (room_id, user_id, kind, staged_at) values (v_ht, v_guest, 'question', now());
    reset role;
    insert into verify_out(line) values ('FAIL a hand with staged_at was accepted');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK a hand cannot be inserted with staged_at (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('OK a hand with staged_at is refused (' || sqlstate || ')');
  end;
end $v$;

select line from verify_out order by n;
rollback;
```

- [ ] **Step 3: Write the apply script**

Copy `scripts/apply-0036.sh` to `scripts/apply-0037.sh` and change exactly these lines:

```bash
# Apply migration 0037 (the HT class room: many rooms, hosts by email) to the ONE database and
# prove it, keeping nothing from the proof. Runs AFTER apply-0036.sh. Nelson runs it from the repo root:
#
#     ! bash scripts/apply-0037.sh                 # apply, then verify
#     ! bash scripts/apply-0037.sh --verify-only   # verify again without re-applying
```
```bash
MIG="$ROOT/supabase/migrations/0037_ht_room.sql"
VERIFY="$ROOT/scripts/verify-0037.sql"
```
```bash
  echo "== apply supabase/migrations/0037_ht_room.sql → $REF"
```
```bash
  jq -e '.[0].status == "ht room ready"' "$TMP/out.json" >/dev/null \
    || { echo "APPLY FAILED — the last statement did not return 'ht room ready'"; exit 1; }
```
```bash
echo "0037 is on prod and verified. Nothing from the verify was kept."
```
Then `chmod +x scripts/apply-0037.sh`.

- [ ] **Step 4: Static checks (no database on this Mac)**

Run: `cd ~/taylormade-academy-ht && bash -n scripts/apply-0037.sh && diff <(sed -n '/^set -euo/,$p' scripts/apply-0036.sh | sed 's/0036/00XX/g; s/academy room ready/READY/; s/academy_room/MIG/') <(sed -n '/^set -euo/,$p' scripts/apply-0037.sh | sed 's/0037/00XX/g; s/ht room ready/READY/; s/ht_room/MIG/') && echo "apply script = 0036's modulo names"`
Expected: `apply script = 0036's modulo names` (an empty diff).

Run: `cd ~/taylormade-academy-ht && grep -c "insert into verify_out" scripts/verify-0037.sql && grep -n "^rollback;$" scripts/verify-0037.sql && for f in supabase/migrations/0037_ht_room.sql scripts/verify-0037.sql; do python3 - "$f" <<'EOF'
import sys,re
t=open(sys.argv[1]).read()
# every $$ / $v$ block is balanced, every begin has an end, no stray tab
assert t.count('$$')%2==0, 'unbalanced $$'
assert t.count('$v$')%2==0, 'unbalanced $v$'
assert '\t' not in t
print(sys.argv[1], 'ok')
EOF
done`
Expected: a count ≥ 28, the `rollback;` line, and `ok` for both files.

- [ ] **Step 5: Commit**

```bash
cd ~/taylormade-academy-ht && git add supabase/migrations/0037_ht_room.sql scripts/apply-0037.sh scripts/verify-0037.sql && git commit -m "db(ht): 0037 — ea_rooms becomes many rooms (slug), hosts by email, presets per row, the ht row; publish scoped per room

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The `room` block — `ht.js`, the Live space content, the build stamp

**Files:**
- Modify: `ht/hub/ht.js` (top of the IIFE, `R.player` neighbourhood ~L161, `wire()` ~L272 and the `[data-replay]` handler ~L400)
- Modify: `ht/hub/data/live.js` (rewrite)
- Modify: `ht/build.mjs` (the sha1 inputs ~L24-29)
- Regenerated by the build: `ht/hub/data/all.js`, `ht/hub/*/index.html`, `ht/index.html`, `ht/fund/index.html`, `ht/playbook/index.html` (stamp only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `R.room(b)` → a dark card containing `<div data-room><div class="ht-room-ctl"></div><div id="rtkMount"></div></div>`; `wire()` imports `/ht/hub/room.js<V>` when `[data-room]` exists, where `V` is `ht.js`'s own `?v=…` (or `''`); the live space data has a `room` block with `id:'room'`.

- [ ] **Step 1: Capture the stamp at parse time (top of `ht.js`)**

After `var LS = function (k) { return 'ht:' + k; };` add:

```js
  /* our own ?v= — read while this script is still the current one (null after DOMContentLoaded).
     The room module and its CSS load with the same stamp, so a cache-first service worker frees
     them whenever ht/build.mjs rewrites it. */
  var V = (function () { try { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([A-Za-z0-9]+)/.exec(s); return m ? '?v=' + m[1] : ''; } catch (e) { return ''; } })();
```

- [ ] **Step 2: Replace `R.player` with `R.room` (keep `R.player` — other spaces may still use it; add `R.room` right after it)**

```js
  /* the HT class room: the mount the room module fills, and the cards/host card above it.
     Inert until ht/hub/room.js loads (wire() imports it when this block is on the page). */
  R.room = function (b) {
    var inner = '<div data-room><div class="ht-room-ctl"><p class="ht-room-loading">Opening the room&hellip;</p></div><div id="rtkMount"></div></div>';
    var s = card({ id: b.id, title: b.cardTitle, meta: b.meta }, inner, 'dark'); return s.replace('<div class="bd">', '<div class="bd" style="padding:0">');
  };
```

- [ ] **Step 3: Import the module from `wire()` and keep the sample replay tiles harmless on the live page**

At the END of `wire(root, space)` (just before its closing `}` — after the `[data-player]` loop) add:

```js
    /* the class room: one module, loaded only where the block is */
    if (root.querySelector('[data-room]')) {
      import('/ht/hub/room.js' + V).catch(function (e) {
        var c = root.querySelector('.ht-room-ctl');
        if (c) c.innerHTML = '<p class="ht-room-loading">The room could not load. Reload to try again.</p>';
        try { console.error('ht room', e); } catch (x) {}
      });
    }
```

In the `[data-replay]` click handler, change the no-player branch so a sample tile on the live page scrolls to the room instead of reloading the page:

```js
        if (!p) {
          var rm = root.querySelector('[data-room]');
          if (rm) { var hc = rm.closest('.hc') || rm; if (hc.scrollIntoView) hc.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
          var live = root.querySelector('a[href$="/live/"]'); if (live) location.href = live.getAttribute('href'); return;
        }
```

- [ ] **Step 4: Rewrite the Live space content**

Replace `ht/hub/data/live.js` entirely:

```js
/* The HT Hub — The live room. The class room block is REAL (ht/hub/room.js); every other block
   here is SAMPLE content and says so. No tool or vendor names on this page. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.live = {
  key: 'live', title: 'Live', office: 'The live room', icon: 'play',
  blurb: 'HT\'s own class room: everyone on camera, share a screen, ask a question, and the replay lands here.',
  sub: 'Seminars, town halls, briefings and classes in HT\'s own room, with everyone on camera, a screen to share, questions in a queue, and the replay on this page after.',
  stamp: 'The class room is real · the rest is sample', headCta: { label: 'Open the room', href: '#room', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'The live room', title: 'One room for everything the campus does live.',
      text: 'A seminar, a town hall, a donor briefing, a guest lecture, a class. The host sends one link. People sign in with their email and a six-digit code, walk in muted with the camera off, and turn either on with one tap. The host shares a screen, brings a question onto the stage, and ends the session for everyone with one button. The recording lands on this page for the host to review and publish.',
      ctas: [{ label: 'Open the room', href: '#room', style: 'ht' }, { label: 'How a session runs', href: '#how', style: 'ht-line' }],
      image: '/ht/img/cover-dais.jpg', imageAlt: 'The dais in the auditorium at Huston-Tillotson',
      ada: { text: 'When your host starts, you\'ll walk straight in. Until then this page checks every few seconds, so there\'s nothing to refresh.', when: 'Ada · HT student ambassador' } },
    { type: 'room', id: 'room', cardTitle: 'The HT class room', meta: 'Real · this room is live' },
    { type: 'stats', items: [{ n: '1 link', label: 'Is all a guest needs, plus their email' }, { n: '1 tap', label: 'Turns a camera or mic on' }, { n: 'Same day', label: 'The replay is ready to review' }, { n: '5', label: 'Offices with a session on the calendar (sample)' }] },
    { type: 'steps', id: 'how', title: 'How a session runs', meta: 'Three steps, one afternoon', items: [
      { em: 'Step one', h: 'Send the link', p: 'The host copies the room link from this page and sends it by text or email. It works before the session starts; people who open it early wait in the room and are brought in the moment it begins.' },
      { em: 'Step two', h: 'Start class', p: 'The host presses Start class, checks the camera, and enters. Everyone is on camera if they choose to be. Share a screen, take questions from the queue, put someone on the stage, split into small groups.' },
      { em: 'Step three', h: 'The replay lands here', p: 'Every session records itself. The host reviews it, presses Publish, and it appears on this page as the last session for the people who were in the room.' } ] },
    { type: 'replays', id: 'replays', title: 'The replay shelf', meta: 'Sample recordings', items: [
      { title: 'Fall Convocation address', date: 'Aug 2026', len: '38:12', poster: '/ht/img/fall-convocation.jpg', tag: 'Office of the President · sample' },
      { title: 'Faculty development · session one', date: 'Aug 2026', len: '52:18', poster: '/ht/img/students-library.jpg', tag: 'Academic Affairs · sample' },
      { title: 'A live visit for families', date: 'Jul 2026', len: '44:30', poster: '/ht/img/campus-hero.jpg', tag: 'Admissions · sample' },
      { title: 'Commencement 2026', date: 'May 2026', len: '1:52:40', poster: '/ht/img/commencement.jpg', tag: 'Office of the President · sample' },
      { title: 'Spring donor briefing', date: 'Apr 2026', len: '41:05', poster: '/ht/img/wallace-students.jpg', tag: 'Institutional Advancement · sample' },
      { title: 'Guest lecture · building a business in Austin', date: 'Mar 2026', len: '58:47', poster: '/ht/img/student-laptop.jpg', tag: 'Career Services · sample' } ] },
    { type: 'calendar', side: true, id: 'calendar', title: 'Coming up live', meta: 'Sample · every office', items: [
      { date: '2026-09-17', title: 'Fall town hall', where: 'Office of the President · 12:00 PM CT', tag: 'Live', tagCls: 'live' },
      { date: '2026-09-24', title: 'Faculty development · teaching with the hub', where: 'Academic Affairs · 3:00 PM CT' },
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Institutional Advancement · 12:00 PM CT' },
      { date: '2026-10-22', title: 'Guest lecture · Business program', where: 'Academic Affairs · 6:00 PM CT' },
      { date: '2026-11-07', title: 'Donor Appreciation Weekend luncheon', where: 'Institutional Advancement · 12:00 PM CT' },
      { date: '2026-11-19', title: 'A live visit for families', where: 'Admissions · 6:30 PM CT' },
      { date: '2027-01-21', title: 'Spring town hall', where: 'Office of the President · 12:00 PM CT' },
      { date: '2027-03-11', title: 'Faculty development · spring session', where: 'Academic Affairs · 3:00 PM CT' } ] },
    { type: 'faq', side: true, id: 'faq', title: 'What donors and faculty ask', meta: 'Four questions', items: [
      { q: 'Do I need an account to join?', a: 'Yes, and it takes a minute: your email, then a six-digit code we send you. The first time, you type your name once. Nothing to download.' },
      { q: 'Does it work on a phone?', a: 'Yes. Camera, mic, chat and the question queue all work in the phone\'s browser. Add the hub to your home screen and it opens like an app.' },
      { q: 'Who can watch the recording?', a: 'The host reviews each recording first and decides whether to publish it. Once published, it appears on this page for the people who were in the room.' },
      { q: 'Can a session be private to one group?', a: 'Yes. Only people with the current link can enter. The host can issue a new link at any time, which closes the door on the old one.' } ] },
    { type: 'materials', side: true, title: 'For hosts', meta: 'Sample', items: [
      { kind: 'DOC', title: 'Host checklist · before you start', sub: 'Camera, light, the link sent, one page', restricted: true },
      { kind: 'DOC', title: 'Running the question queue', sub: 'Bring someone on stage, then hand it back', restricted: true },
      { kind: 'DECK', title: 'President\'s Fall Briefing · slides', sub: 'Share from the room on Oct 8', restricted: true } ] },
    { type: 'cta', title: 'The next session is Thursday at noon.', text: 'The fall town hall, live from the auditorium. Open the room a few minutes early; your host will bring you in.',
      primary: { label: 'Open the room', href: '#room', style: 'ht-gold' }, secondary: { label: 'See every session', href: '#calendar', style: 'ht-line' } }
  ]
};
```

- [ ] **Step 5: Add the room files to the build stamp**

In `ht/build.mjs`, the `V` computation becomes (three new inputs; the files exist from Tasks 1, 5 and 6 — until then `existsSync` guards them):

```js
const stampIn = (p) => (fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0));
const V = createHash('sha1')
  .update(fs.readFileSync(path.join(ROOT, 'ht.css')))
  .update(fs.readFileSync(path.join(HUB, 'ht.js')))
  .update(fs.readFileSync(path.join(HUB, 'data.js')))
  .update(fs.readFileSync(path.join(HUB, 'data', 'all.js')))
  .update(stampIn(path.join(HUB, 'room.js')))
  .update(stampIn(path.join(HUB, 'room.css')))
  .update(stampIn(path.join(HUB, 'room-words.js')))
  .digest('hex').slice(0, 8);
```

- [ ] **Step 6: Build, check the generated page, and smoke it in a browser**

Run: `cd ~/taylormade-academy-ht && node --check ht/hub/ht.js && node ht/build.mjs && grep -c 'type: .room.' ht/hub/data/all.js && grep -o 'ht.js?v=[a-f0-9]*' ht/hub/live/index.html | head -1 && git status --short | head -20`
Expected: no syntax error; `all.js: … | stamp: <8 hex> | spaces: …`; `1`; the new stamp; the regenerated shells listed as modified (every space, because the stamp changed).

Smoke (system Chrome, no sign-in — the page renders for anyone): start `python3 -m http.server 8790 --bind 127.0.0.1` from the worktree root in the background, then:

```bash
cd ~/taylormade-academy-ht && node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.route("https://esm.sh/**", r => r.fulfill({ status: 200, contentType: "application/javascript", body: "export const createClient = () => ({ auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: null, error: { message: \"stub\" } }), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) });" }));
  await p.goto("http://127.0.0.1:8790/ht/hub/live/");
  await p.waitForSelector("[data-room] #rtkMount");
  const ctl = await p.textContent(".ht-room-ctl");
  const hasPlayer = await p.$("[data-player]");
  console.log(JSON.stringify({ ctl: ctl.trim().slice(0, 60), hasPlayer: !!hasPlayer, errs }));
  await b.close();
})();'
```
Expected: `hasPlayer:false`, `errs:[]`, and `ctl` is either `Opening the room…` (room.js not written yet → the import 404s → the catch text `The room could not load…`) — both acceptable at this task; Task 6 makes it real.

- [ ] **Step 7: Commit (the regenerated shells too)**

```bash
cd ~/taylormade-academy-ht && git add ht/hub/ht.js ht/hub/data/live.js ht/build.mjs ht/hub/data/all.js ht/hub/*/index.html ht/hub/index.html ht/index.html ht/fund/index.html ht/playbook/index.html && git commit -m "feat(ht): the Live space becomes the class room — room block in ht.js, live.js rewritten for a two-way room, build stamps room.js/css

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `ht/hub/room.css` — the room in HT colors, the cards, the host card

**Files:**
- Create: `ht/hub/room.css`
- Test: `tests/ht/contrast.test.mjs`

**Interfaces:**
- Consumes: the class names `js/rtk-room-v2.js` renders (`.r2-*`, `#rtkMount.r2host`, `body.in-room`).
- Produces: the same selectors as `css/rtk-room-v2.css` with HT values; plus `.ht-room-card`, `.ht-room-host`, `.ht-room-last`, `.ht-room-rep`, `.ht-room-loading`, `.ht-room-wm`, and the `body.in-room` rules that hide the hub chrome.

- [ ] **Step 1: Write the failing contrast test**

```js
// tests/ht/contrast.test.mjs — run: node --test tests/ht/contrast.test.mjs
// Every text/background pair the HT room paints is ≥ 4.5:1 (WCAG AA). The pairs are listed here
// on purpose — a stylesheet parser would miss inherited colors; a human reads this table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../ht/hub/room.css', import.meta.url), 'utf8');
const lum = (hex) => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const PAIRS = [
  ['#FFFFFF', '#291C14', 'body text on the Terra canvas'],
  ['#FFFFFF', '#3B0000', 'body text on Mahogany (strip, panel, bar, preview)'],
  ['#FFFFFF', '#660100', 'button text on Maroon (r2-btn, fx tray, sheet card)'],
  ['#FFFFFF', '#8F0000', 'text on Brick'],
  ['#F7E3B8', '#291C14', 'Ember secondary text on canvas (r2-line, r2-wait ol)'],
  ['#F7E3B8', '#3B0000', 'Ember on Mahogany'],
  ['#C09780', '#291C14', 'Taupe muted text on canvas (r2-title, r2-under, r2-fine)'],
  ['#C09780', '#3B0000', 'Taupe on Mahogany (tabs off, r2-who span, r2-empty)'],
  ['#C09780', '#660100', 'Taupe on Maroon (tool hints, disabled cta)'],
  ['#3B0000', '#FFCC00', 'Mahogany on Gold (Enter, Bring, cta, fx on, queue number)'],
  ['#FFCC00', '#3B0000', 'Gold on Mahogany (recording chip, active tab, counts)'],
  ['#94CCAB', '#3B0000', 'Sage on Mahogany (live dot text)'],
  ['#00373E', '#C7EDBF', 'Eco Green on Fresh (cta.on)'],
  ['#FAA88A', '#660100', 'Bloom danger text on Maroon (end class)'],
  ['#FFFFFF', '#BA2E2E', 'white on Cinder (Leave)'],
  ['#3B0000', '#F7E3B8', 'Mahogany on Ember (toast)'],
  ['#3B0000', '#FFFAEB', 'Mahogany on Sand (host card fields)'],
  ['#660100', '#FFFAEB', 'Maroon on Sand (host card labels)'],
];

test('every pair the room paints is at least 4.5:1', () => {
  for (const [fg, bg, what] of PAIRS) {
    const r = ratio(fg, bg);
    assert.ok(r >= 4.5, `${what}: ${fg} on ${bg} = ${r.toFixed(2)}`);
  }
});

test('room.css uses HT colors and none of the Academy navy/gold', () => {
  for (const navy of ['#04123a', '#0a1733', '#0f1d44', '#162650', '#22345f', '#fdc921', '#9fb0d4', '#c9d4ee', '#6f80a8', '#3ddc97'])
    assert.doesNotMatch(css.toLowerCase(), new RegExp(navy), navy + ' is an Academy color');
  for (const ht of ['#291c14', '#3b0000', '#660100', '#ffcc00', '#c09780', '#f7e3b8'])
    assert.match(css.toLowerCase(), new RegExp(ht), ht + ' missing');
});

test('room.css never sets display on a kit element and keeps the [hidden] guards', () => {
  assert.doesNotMatch(css, /rtk-[a-z-]+\s*\{[^}]*display\s*:/);
  assert.match(css, /\.r2-pane\[hidden\]\{display:none\}/);
  assert.match(css, /\.r2-sheet\[hidden\]\{display:none\}/);
});

test('room.css hides the hub chrome while in the room and paints Ada on the waiting screen', () => {
  assert.match(css, /body\.in-room[^{]*\.ht-tabs/);
  assert.match(css, /body\.in-room[^{]*\.ht-head/);
  assert.match(css, /body\.in-room[^{]*\.ht-room-ctl/);
  assert.match(css, /ada-face\.jpg/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ~/taylormade-academy-ht && node --test tests/ht/contrast.test.mjs`
Expected: FAIL — `ENOENT … ht/hub/room.css`.

- [ ] **Step 3: Write the stylesheet**

The first half is `css/rtk-room-v2.css` selector-for-selector with the HT values (canvas Terra, deep Mahogany, panel Maroon, raised Brick, accent Gold, muted Taupe, secondary Ember); the second half is HT-only.

```css
/* ht/hub/room.css — the class room in Huston-Tillotson's colors. A fork of css/rtk-room-v2.css
   (same selectors, HT values) because that file is OPIL's and orientation is Wed 9/16; after that
   the shared file moves to --r2-* variables and this shrinks to overrides. Loaded by ht/hub/room.js.
   Terra #291C14 canvas · Mahogany #3B0000 deep · Maroon #660100 panels · Brick #8F0000 raised ·
   Gold #FFCC00 accent (Mahogany text on it) · Ember #F7E3B8 secondary · Taupe #C09780 muted.
   We never set `display` on a kit element (rtk-*). */
#rtkMount.r2host:not(:empty){display:block;height:calc(100dvh - 150px);min-height:560px;border-radius:16px;overflow:hidden;border:1px solid #5a1a12;background:#291C14;color:#FFFFFF;font-family:Inter,system-ui,sans-serif}
.r2,.r2-join{height:100%}

/* ---- getting in ---- */
.r2-join{display:grid;grid-template-columns:1.25fr 1fr;gap:32px;padding:32px 36px;box-sizing:border-box;align-items:center}
.r2-kicker{font-family:'Space Grotesk',Inter,sans-serif;font-weight:700;font-size:clamp(26px,3vw,38px);letter-spacing:-.01em;line-height:1.1}
.r2-title{font-family:'Space Grotesk',Inter,sans-serif;font-weight:600;font-size:clamp(18px,2vw,24px);color:#C09780;margin:10px 0 6px}
.r2-line{font-size:15px;color:#F7E3B8;margin:0 0 18px;line-height:1.5}
.r2-preview{position:relative;border-radius:16px;overflow:hidden;background:#3B0000;aspect-ratio:16/9;max-height:46vh}
.r2-preview video{width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)}
.r2-preview .r2-ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#C09780;font-size:14px;text-align:center;padding:20px 20px 80px;pointer-events:none}
.r2-preview .r2-ph b{color:#FFFFFF;font-size:16px}
.r2-preview.has-video .r2-ph{display:none}
.r2-chips{display:flex;gap:10px;flex-wrap:wrap}
.r2-preview .r2-chips{position:absolute;left:12px;right:12px;bottom:12px}
.r2-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:52px;padding:8px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(59,0,0,.82);backdrop-filter:blur(8px);color:#FFFFFF;font:inherit;text-align:left;cursor:pointer;flex:1;min-width:150px}
.r2-chip b{font-size:14px;font-weight:700}
.r2-chip span{font-size:12px;color:#F7E3B8}
.r2-chip.on{border-color:rgba(148,204,171,.7)}
.r2-chip.on b::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#94CCAB;margin-right:7px;vertical-align:1px}
.r2-chip.r2-fx{flex:0 0 auto}
.r2-fxtray{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.r2-fxtray button{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:#660100;color:#FFFFFF;font:600 13.5px Inter,sans-serif;cursor:pointer}
.r2-fxtray button.on{background:#FFCC00;color:#3B0000;border-color:#FFCC00}
.r2-join-right{display:flex;flex-direction:column;justify-content:center;gap:10px}
.r2-enter{font:700 20px 'Space Grotesk',Inter,sans-serif;color:#3B0000;background:#FFCC00;border:0;border-radius:999px;min-height:64px;padding:0 28px;cursor:pointer;width:100%}
.r2-enter:disabled{opacity:.6;cursor:wait}
.r2-under{font-size:13.5px;color:#C09780;margin:0;text-align:center}
.r2-fine{font-size:12.5px;color:#C09780;margin:18px 0 0;text-align:center}
.r2-wait{border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 20px;background:#3B0000}
.r2-wait b{display:block;font-size:17px;margin-bottom:2px}.r2-wait>span{color:#C09780;font-size:14px}
.r2-wait ol{margin:14px 0 0;padding-left:20px;color:#F7E3B8;font-size:14px;line-height:1.7}
/* Ada greets a guest who is waiting: her face beside the line, gold ring — CSS only, no kit change */
.r2-join:has(.r2-wait) .r2-line{display:flex;align-items:center;gap:12px}
.r2-join:has(.r2-wait) .r2-line::before{content:'';flex:0 0 auto;width:48px;height:48px;border-radius:50%;border:2px solid #FFCC00;background:url(/ht/img/ada-face.jpg) center/cover}

/* ---- in class ---- */
.r2{display:grid;grid-template-rows:auto 1fr auto;position:relative}
.r2-now{display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:14px;border-bottom:1px solid rgba(255,255,255,.1);background:#3B0000}
.r2-dot{width:8px;height:8px;border-radius:50%;background:#94CCAB;animation:r2pulse 1.6s ease-in-out infinite}
.r2-nowtxt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r2-rec{font-size:12.5px;font-weight:700;color:#FFCC00}
.r2-rec::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#FA2626;margin-right:6px;animation:r2pulse 1.6s ease-in-out infinite}
.r2-main{display:grid;grid-template-columns:1fr 0;min-height:0;transition:grid-template-columns .2s ease}
.r2.panel-open .r2-main{grid-template-columns:1fr 340px}
.r2-stage{min-height:0;position:relative;padding:12px;overflow:hidden}
.r2-stage rtk-ui-provider{height:100%}
.r2-grid{height:100%}
.r2-panel{border-left:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;min-height:0;overflow:hidden;background:#3B0000}
.r2-tabs{display:flex;gap:4px;padding:10px 10px 0}
.r2-tab{flex:1;min-height:44px;border:0;border-bottom:2px solid transparent;background:none;color:#C09780;font:600 13.5px Inter,sans-serif;cursor:pointer;white-space:nowrap;padding:0 6px}
.r2-tab.on{color:#FFFFFF;border-bottom-color:#FFCC00}
.r2-tab em{font-style:normal;color:#FFCC00;margin-left:4px}
.r2-pane{flex:1;min-height:0;display:flex;flex-direction:column}
.r2-pane[hidden]{display:none}
.r2-pane rtk-chat,.r2-pane rtk-participants{flex:1;min-height:0;width:100%}
.r2-close{margin:8px 10px 10px;min-height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:none;color:#FFFFFF;font:600 14px Inter,sans-serif;cursor:pointer}
.r2-queue{padding:10px;overflow:auto}
.r2-queue-head{font:700 15px 'Space Grotesk',Inter,sans-serif;padding:6px 4px 10px}
.r2-hand{display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:12px;margin-bottom:8px}
.r2-hand.staged{border-color:rgba(255,204,0,.7)}
.r2-n{width:30px;height:30px;border-radius:8px;background:#FFCC00;color:#3B0000;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.r2-who b{display:block;font-size:14px}.r2-who span{font-size:12px;color:#C09780}
.r2-mini{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:none;color:#FFFFFF;font:600 12.5px Inter,sans-serif;cursor:pointer}
.r2-mini.r2-bring{background:#FFCC00;color:#3B0000;border-color:#FFCC00}
.r2-empty{color:#C09780;font-size:13.5px;padding:14px;line-height:1.5}

/* the bar */
.r2-bar{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);background:#3B0000}
.r2-bar .r2-chip{min-width:170px}
.r2-primary{display:flex;justify-content:center}
.r2-cta{display:flex;flex-direction:column;align-items:center;gap:2px;min-height:56px;min-width:260px;padding:8px 28px;border-radius:999px;border:0;background:#FFCC00;color:#3B0000;font:inherit;cursor:pointer}
.r2-cta b{font:700 17px 'Space Grotesk',Inter,sans-serif}.r2-cta span{font-size:12px;opacity:.8}
.r2-cta.on{background:#C7EDBF;color:#00373E}
.r2-cta:disabled{background:#660100;color:#C09780;cursor:default}
.r2-right{display:flex;gap:10px;align-items:center}
.r2-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:#660100;color:#FFFFFF;font:600 14px Inter,sans-serif;cursor:pointer}
.r2-leave{min-height:48px;padding:0 18px;border-radius:999px;border:0;background:#BA2E2E;color:#FFFFFF;font:700 14px Inter,sans-serif;cursor:pointer}
.r2-leave em{font-style:normal;font-weight:400;opacity:.85}

/* the sheet */
.r2-sheet{position:absolute;inset:0;background:rgba(41,28,20,.72);display:flex;align-items:flex-end;justify-content:center;z-index:20}
.r2-sheet[hidden]{display:none}
.r2-sheet-card{width:min(560px,100%);max-height:88%;background:#3B0000;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden}
.r2-sheet-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1)}
.r2-sheet-head b{font:700 17px 'Space Grotesk',Inter,sans-serif}
.r2-sheet-close{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:none;color:#FFFFFF;font:600 13px Inter,sans-serif;cursor:pointer}
.r2-sheet-body{padding:14px;overflow:auto;min-height:0;flex:1}
.r2-tools,.r2-fxpane{display:grid;gap:10px}
.r2-tools .r2-btn,.r2-fxpane .r2-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:60px;padding:10px 16px;border-radius:14px;text-align:left}
.r2-tools .r2-btn b{font-size:15px}.r2-tools .r2-btn span{font-size:12.5px;color:#C09780;font-weight:400}
.r2-tools .r2-btn.danger{border-color:rgba(186,46,46,.8)}.r2-tools .r2-btn.danger b{color:#FAA88A}
.r2-kit{display:block;height:min(60vh,520px);width:100%}
.r2-toast{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);background:#F7E3B8;color:#3B0000;font:600 13.5px Inter,sans-serif;padding:10px 16px;border-radius:999px;z-index:30;max-width:90%}
@keyframes r2pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* ---- phone ---- */
@media(max-width:720px){
  #rtkMount.r2host:not(:empty){height:calc(100dvh - 64px);min-height:0;border-radius:12px}
  .r2-join{grid-template-columns:1fr;padding:18px 16px 110px;align-content:start;gap:16px;overflow:auto}
  .r2-kicker{font-size:26px}
  .r2-preview{max-height:40vh;aspect-ratio:4/3}
  .r2-preview .r2-chips{left:8px;right:8px;bottom:8px;gap:6px}
  .r2-chip{min-width:0;padding:6px 10px;min-height:48px}
  .r2-chip b{font-size:13px}.r2-chip span{font-size:11px}
  .r2-join-right{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:15}
  .r2-enter{min-height:60px;font-size:19px}
  .r2-fine{display:none}
  .r2-main{grid-template-columns:1fr}
  .r2.panel-open .r2-main{grid-template-columns:1fr}
  .r2-panel{position:absolute;left:0;right:0;bottom:0;top:38%;border-left:0;border-top:1px solid rgba(255,255,255,.16);border-radius:18px 18px 0 0;transform:translateY(100%);transition:transform .22s ease;z-index:12}
  .r2.panel-open .r2-panel{transform:none}
  .r2-bar{grid-template-columns:1fr;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
  .r2-bar .r2-chips{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .r2-bar .r2-chip{min-width:0}
  .r2-cta{width:100%;min-width:0}
  .r2-right{display:grid;grid-template-columns:1fr 1fr auto;gap:8px}
  .r2-sheet-card{max-height:92%}
}

/* ================= HT-only: the cards above the room, the host card, in-room chrome ================= */
.ht-room-loading{padding:22px 20px;color:#F7E3B8;font-size:14.5px;margin:0}
.ht-room-wm{height:22px;width:auto;display:block;margin-bottom:14px}
/* landing / dead link / not allowed / ended / left — one maroon card on the Mahogany block */
.ht-room-card{padding:26px 22px;background:#3B0000;color:#FFFFFF}
.ht-room-card h3{font-family:'Space Grotesk',Inter,sans-serif;font-size:clamp(20px,2.4vw,26px);letter-spacing:-.01em;margin:0 0 6px;color:#FFFFFF}
.ht-room-card p{font-size:15px;color:#F7E3B8;margin:0 0 12px;max-width:60ch;line-height:1.55}
.ht-room-card p.t{font-family:'Space Grotesk',Inter,sans-serif;font-size:17px;color:#FFFFFF;margin-bottom:4px}
.ht-room-card p.s{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:#FFCC00;font-weight:700}
.ht-room-card p.fine{font-size:13px;color:#C09780;margin-top:10px}
.ht-room-card .btn{margin-top:4px}
/* the published replay, for hosts and people who were in the room */
.ht-room-last{padding:18px 22px 22px;background:#291C14;border-top:1px solid rgba(255,255,255,.1)}
.ht-room-last b{display:block;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:#FFCC00;margin-bottom:10px}
.ht-room-last .frame{position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#3B0000}
.ht-room-last iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.ht-room-last a{display:inline-block;margin-top:10px;color:#F7E3B8;font-size:13.5px;text-decoration:underline;text-underline-offset:3px}
/* the host card: Sand fields on the Mahogany block, so it reads as a form, not a stage */
.ht-room-host{padding:20px 22px;background:#3B0000;color:#FFFFFF;display:grid;gap:14px}
.ht-room-host .hd2{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ht-room-host .hd2 h3{font-family:'Space Grotesk',Inter,sans-serif;font-size:18px;margin:0;color:#FFFFFF}
.ht-room-host .hd2 .mono{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#FFCC00;font-weight:700}
.ht-room-host .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ht-room-host .row.two{display:grid;grid-template-columns:1.4fr 1fr .8fr;gap:10px}
@media(max-width:720px){.ht-room-host .row.two{grid-template-columns:1fr}}
.ht-room-host label{display:grid;gap:5px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#F7E3B8}
.ht-room-host input,.ht-room-host textarea{font:inherit;font-size:14.5px;color:#3B0000;background:#FFFAEB;border:1px solid #ead9c9;border-radius:10px;padding:10px 12px;min-height:44px;width:100%;box-sizing:border-box;text-transform:none;letter-spacing:0;font-weight:500}
.ht-room-host input[readonly]{color:#660100}
.ht-room-host textarea{min-height:88px;resize:vertical}
.ht-room-host .row>input{flex:1;min-width:200px}
.ht-room-host .pill{min-height:44px;padding:0 16px}
.ht-room-host .pill.ghost{background:#660100;color:#FFFFFF;border-color:#8F0000}
.ht-room-host .btn{min-height:52px}
.ht-room-host #rmEnd{background:#BA2E2E;color:#FFFFFF}
.ht-room-host .status{font-size:13px;color:#F7E3B8}
.ht-room-host .status.live{color:#94CCAB;font-weight:700}
.ht-room-host #rmRec{font-size:12.5px;font-weight:700;color:#FFCC00}
.ht-room-host #rmRec i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#FA2626;margin-right:6px;animation:r2pulse 1.6s ease-in-out infinite}
.ht-room-host .saved{font-size:12px;color:#94CCAB;font-weight:600;text-transform:none;letter-spacing:0}
.ht-room-host p.note{font-size:14px;color:#F7E3B8;margin:0;line-height:1.55}
.ht-room-host h4{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:#FFCC00;margin:6px 0 0}
.ht-room-rep{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0;border-top:1px solid rgba(255,255,255,.1);font-size:14px}
.ht-room-rep .acts{display:flex;gap:8px}
.ht-room-rep .pill{min-height:36px;padding:0 12px;font-size:12px}
.ht-room-host details summary{cursor:pointer;font-size:14px;color:#F7E3B8;font-weight:600}
.ht-room-host details ul{margin:8px 0 0;padding-left:18px;font-size:14px;color:#FFFFFF;line-height:1.7}
.ht-room-host p.fine{font-size:13px;color:#C09780;margin:0}
/* in the room the stage gets the viewport: the preview bar, HT head, tabs, sidebar and the other blocks step aside */
body.in-room .ht-bar,body.in-room .ht-head,body.in-room .ht-tabs,body.in-room .site-header,body.in-room .site-footer,body.in-room .ht-room-ctl{display:none}
body.in-room .ht-main .hub-wrap{max-width:none;padding-inline:8px}
body.in-room .ht-grid{grid-template-columns:minmax(0,1fr)!important}
body.in-room .ht-col:nth-child(2){display:none}
body.in-room .ht-col:first-child>*:not(#room){display:none}
body.in-room #room{border-radius:0;border:0;box-shadow:none;margin:0}
body.in-room #room .hd{display:none}
body.in-room #rtkMount.r2host:not(:empty){height:calc(100dvh - 16px);min-height:0;border-radius:12px}
```

- [ ] **Step 4: Run the tests**

Run: `cd ~/taylormade-academy-ht && node --test tests/ht/contrast.test.mjs`
Expected: 4 PASS.

- [ ] **Step 5: Rebuild the stamp and commit**

Run: `cd ~/taylormade-academy-ht && node ht/build.mjs`
```bash
cd ~/taylormade-academy-ht && git add ht/hub/room.css tests/ht/contrast.test.mjs ht/hub/data/all.js ht/hub/*/index.html ht/hub/index.html ht/index.html ht/fund/index.html ht/playbook/index.html && git commit -m "feat(ht): room.css — the class room in HT maroon/gold, the host card and cards, Ada on the waiting screen; contrast-tested

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `ht/hub/room.js` — the page: cards, the host card, the room

**Files:**
- Create: `ht/hub/room.js`

**Interfaces:**
- Consumes: `js/room-page.js` (`roomKey, roomBranch, statusLine, replayLabel, iframeUrl`), `ht/hub/room-words.js` (Task 1), `js/rtk-room-v2.js` `mountRoomV2` with `target` (spine), `ea_room_state(p_key, p_slug)` and the 0037 RPCs (Task 3), edge functions `ea-rtk-record { room:'ht', … }` (Task 8), `BM_CONFIG` (`SUPABASE_URL`, `SUPABASE_KEY`, `FUNCTIONS_BASE`).
- Produces: the page behaviour of spec §2 and §7.3. Exposes nothing.

- [ ] **Step 1: Write the module**

```js
/* ht/hub/room.js — the HT class room on /ht/hub/live/. Loaded by ht.js when the space has a `room`
   block. The page decides everything from ea_room_state(k, 'ht'); the room itself is the Academy's
   js/rtk-room-v2.js with HT words and HT design tokens (ht/hub/room-words.js). Hosts read the
   ea_rooms row directly (RLS: ea_room_is_host). We never set `display` on a kit element.
   Spec: docs/superpowers/specs/2026-09-15-ht-class-room-design.md §2, §7.3 */
const SLUG = 'ht';
const V = new URL(import.meta.url).search;   /* our own ?v= — the HT build stamp from ht/build.mjs */
const POLL_MS = 20000;

/* the stylesheet first, so the cards never paint unstyled */
await new Promise((res) => {
  if (document.querySelector('link[href^="/ht/hub/room.css"]')) return res();
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/ht/hub/room.css' + V;
  l.onload = res; l.onerror = res; document.head.appendChild(l);
});
const [{ roomKey, roomBranch, statusLine, replayLabel, iframeUrl }, { htWords, HT_TOKENS, htErrorText, htLoginHref }, { createClient }] = await Promise.all([
  import('/js/room-page.js' + V),
  import('/ht/hub/room-words.js' + V),
  import('https://esm.sh/@supabase/supabase-js@2'),
]);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mount = document.getElementById('rtkMount');
const ctl = document.querySelector('.ht-room-ctl');
if (!mount || !ctl || !window.BM_CONFIG) throw new Error('room block or config missing');

const k = roomKey(location.search);
const sb = createClient(window.BM_CONFIG.SUPABASE_URL, window.BM_CONFIG.SUPABASE_KEY);
const user = (await sb.auth.getSession()).data.session?.user || null;
/* the header's Sign in must carry the key back through the email code and /welcome/ */
if (k) document.querySelectorAll('.site-header a[href^="/login/"]').forEach((a) => a.setAttribute('href', htLoginHref(k)));

async function getState() {
  const { data, error } = await sb.rpc('ea_room_state', { p_key: k, p_slug: SLUG });
  if (error) throw error;
  return data;
}
const token = async () => (await sb.auth.getSession()).data.session?.access_token || '';

/* ---------- the cards ---------- */
const WM = '<img class="ht-room-wm" src="/ht/img/ht-wordmark-gold.png" alt="Huston-Tillotson University">';
const onAirLine = (st) => '<p class="s">' + (st.is_live ? 'Live now' : 'Off air') + '</p>';
function card(inner, after) { ctl.innerHTML = '<div class="ht-room-card">' + WM + inner + '</div>' + (after || ''); mount.innerHTML = ''; mount.classList.remove('r2host'); }
function lastSession(st) {
  const u = iframeUrl(st && st.recording_url); if (!u) return '';
  return '<div class="ht-room-last"><b>Last session</b><div class="frame"><iframe src="' + esc(u) + '" title="Last session replay" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div><a href="' + esc(st.recording_url) + '" target="_blank" rel="noopener">Open in a new tab</a></div>';
}
function endedCard() { document.body.classList.remove('in-room', 'in-room-v2'); card('<h3>This session has ended.</h3><p>If you were here, you can rewatch it on this page once your host publishes it.</p>'); }
function leftCard() { document.body.classList.remove('in-room', 'in-room-v2'); card('<h3>You left the room.</h3><a class="btn ht-gold" href="' + esc(location.pathname + location.search) + '">Rejoin →</a>'); }

/* ---------- state → branch ---------- */
let state = null, stateErr = null;
try { state = await getState(); } catch (e) { stateErr = e; }   /* null state → roomBranch → 'error' → the card below; never throw (ht.js would overwrite the card) */
const branch = roomBranch(state);
const words = htWords(state && state.host_name);
const target = () => ({ kind: 'room', slug: SLUG, id: state.id, title: state.title, host_name: state.host_name, words, tokens: HT_TOKENS });

let r2 = null;            /* the mounted room, when there is one */
let poll = null;          /* the guest's 20 s state check */
let hosting = false;      /* this page started (or re-entered) the class as host */
let pendingRecord = false;/* start the recording on the host's 'joined' — never on Start class */

async function mountRoom(mode, extra) {
  const { mountRoomV2 } = await import('/js/rtk-room-v2.js' + V);
  const top = mount.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  r2 = await mountRoomV2(Object.assign({
    mountEl: mount, cfg: window.BM_CONFIG, token: await token(), sb, user, mode,
    target: target(), facilitator: state.host_name, onState,
  }, extra || {}));
  return r2;
}
function onState(st) {
  if (st === 'joined' && pendingRecord) {
    pendingRecord = false;
    record('start').then(() => { host.rec(true); if (r2 && r2.setRecording) r2.setRecording(true); })
      .catch((e) => host.note('You’re in, but the replay could not start recording (' + (e.message || e) + '). The session itself is fine.'));
  }
  if (st === 'left' || st === 'ended') {
    document.body.classList.remove('in-room', 'in-room-v2');
    if (hosting) host.endSession();
    else if (st === 'left') leftCard();
    else endedCard();
  }
}
async function record(action, extra) {
  const r = await fetch(window.BM_CONFIG.FUNCTIONS_BASE + '/ea-rtk-record', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
    body: JSON.stringify(Object.assign({ room: SLUG, action }, extra || {})),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(htErrorText(d.error || ('server_' + r.status), r.status, words)); e.code = d.error; throw e; }
  return d;
}

/* ---------- guests ---------- */
async function guestWait() {
  ctl.innerHTML = lastSession(state);
  await mountRoom('waiting');
  poll = setInterval(async () => { try { const s = await getState(); if (s && s.is_live) location.reload(); } catch (e) {} }, POLL_MS);
}
async function guestEnter() {
  ctl.innerHTML = '';
  try { await mountRoom('student'); }
  catch (e) { card('<h3>' + esc(htErrorText(e.code, e.status, words)) + '</h3><p>Reload to try again.</p>'); return; }
  poll = setInterval(async () => {
    try { const s = await getState(); if (s && !s.is_live) { clearInterval(poll); try { await r2.leave(); } catch (x) {} endedCard(); } } catch (e) {}
  }, POLL_MS);
}

/* ---------- the host card ---------- */
const START = 'Start class — everyone on camera';
const host = {
  room: null, admin: false, tick: null, els: {},
  note(t) { if (this.els.note) this.els.note.textContent = t; },
  rec(on) { if (this.els.rec) this.els.rec.hidden = !on; },
  async load() {
    const { data, error } = await sb.from('ea_rooms')
      .select('id,slug,title,host_name,host_emails,link_key,is_live,live_since,max_participants,recording_url')
      .eq('slug', SLUG).maybeSingle();
    if (error || !data) throw new Error(error ? error.message : 'no room row');
    this.room = data; return data;
  },
  link() { return location.origin + '/ht/hub/live/?k=' + this.room.link_key; },
  render() {
    const r = this.room;
    ctl.innerHTML = `<div class="ht-room-host">
  <div class="hd2"><h3>Your room</h3><span class="mono">Hosts only</span></div>
  <div class="row"><label style="flex:1"><span>The link to send</span><input id="rmLink" readonly aria-label="Link to this room" value="${esc(this.link())}"></label><button type="button" class="pill" id="rmCopy" aria-live="polite">Copy link</button><button type="button" class="pill ghost" id="rmNew">New link</button></div>
  <div class="row two"><label>Title <span class="saved" id="rmTitleSaved"></span><input id="rmTitle" maxlength="120" value="${esc(r.title)}"></label><label>Host name <span class="saved" id="rmHostSaved"></span><input id="rmHost" maxlength="80" value="${esc(r.host_name)}"></label><label>Max people (you included) <span class="saved" id="rmMaxSaved"></span><input id="rmMax" type="number" min="2" max="500" value="${esc(r.max_participants)}"></label></div>
  ${this.admin ? `<label>Hosts — one email per line <span class="saved" id="rmHostsSaved"></span><textarea id="rmHosts" spellcheck="false">${esc((r.host_emails || []).join('\n'))}</textarea></label><div class="row"><button type="button" class="pill" id="rmHostsSave">Save hosts</button><p class="fine" style="margin:0">Anyone on this list who signs in with that email gets this card and can start a session.</p></div>` : ''}
  <div class="row"><button type="button" class="btn ht-gold" id="rmStart">${START}</button><button type="button" class="pill" id="rmEnd" hidden title="For a session left running from another device. Leaving the room from the device that started it ends the session on its own.">End session</button><span id="rmRec" hidden><i></i>Recording</span><span class="status" id="rmStatus"></span></div>
  <p class="note" id="rmNote">1. Copy the link and send it. It works before you start — people wait in the room. &nbsp;2. Start class, check your camera, press Enter Class. &nbsp;3. Leave ends the session for everyone; the replay lands below to review and publish.</p>
  <h4>Replays</h4><div id="rmReplays"><p class="fine">Loading…</p></div>
  <details id="rmWho"><summary>Who joined</summary><div></div></details>
</div>` + '<div id="rmLast">' + lastSession(state) + '</div>';
    const $ = (id) => document.getElementById(id);
    this.els = { link: $('rmLink'), copy: $('rmCopy'), neu: $('rmNew'), title: $('rmTitle'), hostName: $('rmHost'), max: $('rmMax'), hosts: $('rmHosts'), hostsSave: $('rmHostsSave'),
      start: $('rmStart'), end: $('rmEnd'), rec: $('rmRec'), status: $('rmStatus'), note: $('rmNote'), reps: $('rmReplays'), who: $('rmWho'), last: $('rmLast') };
    this.wire(); this.syncCtl(); this.loadReplays(); this.loadWho();
  },
  wire() {
    const e = this.els;
    e.copy.addEventListener('click', async () => {
      e.link.select(); let done = false;
      try { await navigator.clipboard.writeText(e.link.value); done = true; } catch (x) {}
      if (!done) { try { done = document.execCommand('copy'); } catch (x) {} }
      e.copy.textContent = done ? 'Copied' : (/Mac|iPhone|iPad/.test(navigator.platform) ? 'Press ⌘C' : 'Press Ctrl+C');
      setTimeout(() => { e.copy.textContent = 'Copy link'; }, 1600);
    });
    /* New link: two taps within 4 s — the old link stops working for everyone holding it */
    let armed = null;
    e.neu.addEventListener('click', async () => {
      if (!armed) { armed = setTimeout(() => { armed = null; e.neu.textContent = 'New link'; }, 4000); e.neu.textContent = 'Tap again to cut off the old link'; return; }
      clearTimeout(armed); armed = null; e.neu.disabled = true;
      const { data, error } = await sb.rpc('ea_room_rotate_link', { p_room: this.room.id });
      e.neu.disabled = false; e.neu.textContent = 'New link';
      if (error || !data) { this.note('Could not make a new link — ' + (error ? error.message : 'try again.')); return; }
      this.room.link_key = data; e.link.value = this.link(); this.note('New link made. The old one no longer opens the room. Send the new one.');
    });
    const saveField = (input, savedEl, col, parse) => {
      input.addEventListener('change', async () => {
        const v = parse ? parse(input.value) : input.value.trim();
        if (v == null || v === '') { input.value = this.room[col]; return; }
        const { error } = await sb.from('ea_rooms').update({ [col]: v }).eq('id', this.room.id);
        if (error) { savedEl.textContent = 'not saved'; return; }
        this.room[col] = v; input.value = v; savedEl.textContent = 'Saved'; setTimeout(() => { savedEl.textContent = ''; }, 1800);
        if (col === 'host_name') state.host_name = v;
      });
    };
    saveField(e.title, document.getElementById('rmTitleSaved'), 'title');
    saveField(e.hostName, document.getElementById('rmHostSaved'), 'host_name');
    saveField(e.max, document.getElementById('rmMaxSaved'), 'max_participants', (s) => { const n = parseInt(s, 10); return Number.isInteger(n) && n >= 2 && n <= 500 ? n : null; });
    if (e.hostsSave) e.hostsSave.addEventListener('click', async () => {
      const lines = e.hosts.value.split(/\n/).map((s) => s.trim()).filter(Boolean);
      e.hostsSave.disabled = true;
      const { data, error } = await sb.rpc('ea_room_set_hosts', { p_room: this.room.id, p_emails: lines });
      e.hostsSave.disabled = false;
      const s = document.getElementById('rmHostsSaved');
      if (error) { s.textContent = 'not saved'; this.note('Could not save hosts — ' + error.message); return; }
      this.room.host_emails = data || []; e.hosts.value = this.room.host_emails.join('\n'); s.textContent = 'Saved'; setTimeout(() => { s.textContent = ''; }, 1800);
    });
    e.start.addEventListener('click', () => this.start());
    e.end.addEventListener('click', () => { if (r2) { r2.leave(); } else { this.endSession(); } });
  },
  syncCtl() {
    const e = this.els, live = !!this.room.is_live;
    e.start.disabled = live; e.start.textContent = live ? 'Class is running' : START;
    e.end.hidden = !live;
    e.status.textContent = statusLine(Object.assign({}, state, { is_live: live }));
    e.status.classList.toggle('live', live);
    if (live && !this.tick) this.tick = setInterval(() => this.onTick(), POLL_MS);
  },
  async onTick() {
    try { state = await getState(); } catch (e) { return; }
    this.els.status.textContent = statusLine(state);
    await this.loadReplays();
    if (!this.room.is_live && !this.busy) { clearInterval(this.tick); this.tick = null; }
  },
  async flip(on) {
    const patch = on ? { is_live: true, live_since: new Date().toISOString() } : { is_live: false, ended_at: new Date().toISOString() };
    const { error } = await sb.from('ea_rooms').update(patch).eq('id', this.room.id);
    if (error) throw new Error(error.message);
    Object.assign(this.room, patch); state.is_live = on;
  },
  /* Start class: the server opens a fresh meeting and hands this host a token; onOpened fires the
     moment the meeting exists (before Enter) — that is when the room flips live. No reload: it
     would drop the camera we are about to use. */
  async start() {
    const e = this.els;
    e.start.disabled = true; e.start.textContent = 'Opening the room…';
    try {
      hosting = true; if (poll) { clearInterval(poll); poll = null; }
      await mountRoom('host', { onOpened: async () => {
        await this.flip(true); pendingRecord = true; this.syncCtl();
        this.note('Your room is open. Check your camera below and press Enter Class — the recording starts when you’re in. When you’re done, press Leave and the session ends for everyone.');
      } });
    } catch (x) {
      hosting = false; e.start.disabled = false; e.start.textContent = START;
      this.note('Could not open the room — ' + (x.code ? htErrorText(x.code, x.status, words) : (x.message || x)));
    }
  },
  /* re-entry: a reload or a second device while the class runs — same meeting, no new recording
     (start is idempotent server-side) */
  async reenter() {
    hosting = true; pendingRecord = true;
    try { await mountRoom('host'); }
    catch (x) { hosting = false; this.note('The class is running but this device could not enter it — ' + (x.code ? htErrorText(x.code, x.status, words) : (x.message || x)) + '. Press End session to close it.'); }
  },
  /* the host leaving IS the end of the session — one action */
  async endSession() {
    hosting = false; let recorded = false;
    try { recorded = !!(await record('stop')).stopped; } catch (x) {}
    this.rec(false);
    try { await this.flip(false); }
    catch (x) { this.syncCtl(); this.note('You left, but the session could not be closed (' + x.message + '). Press End session.'); return; }
    this.syncCtl();
    this.note(recorded ? 'Session ended — the replay is being prepared. It shows below when it is ready to review; the people who were here see it once you publish it.'
                       : 'Session ended — the room is closed for everyone. Start class to open it again.');
    this.loadReplays(); this.loadWho();
  },
  busy: false,
  async loadReplays() {
    const e = this.els;
    const { data } = await sb.from('ea_room_replays').select('id,status,watch_url,duration_s,published,error,created_at')
      .eq('room_id', this.room.id).order('created_at', { ascending: false }).limit(8);
    const rows = data || [];
    this.busy = rows.some((r) => ['invoked', 'recording', 'uploading', 'uploaded'].includes(r.status));
    if (this.busy && !this.tick) this.tick = setInterval(() => this.onTick(), POLL_MS);
    this.rec(rows.some((r) => r.status === 'invoked' || r.status === 'recording') && !!this.room.is_live);
    e.reps.innerHTML = rows.length ? rows.map((r) => {
      const d = new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const mins = r.duration_s ? ' · ' + Math.max(1, Math.round(r.duration_s / 60)) + ' min' : '';
      const acts = r.status === 'ready'
        ? `<a class="pill ghost" href="${esc(r.watch_url)}" target="_blank" rel="noopener">Review</a><button type="button" class="pill" data-pub="${esc(r.id)}" data-on="${r.published ? '0' : '1'}">${r.published ? 'Unpublish' : 'Publish'}</button>`
        : r.status === 'error' ? `<button type="button" class="pill" data-retry="${esc(r.id)}">Retry</button>` : '';
      return `<div class="ht-room-rep"><span><b>${esc(d)}</b> · ${esc(replayLabel(r))}${mins}</span><span class="acts">${acts}</span></div>`;
    }).join('') : '<p class="fine">No replays yet. Each session records itself and lands here to review.</p>';
    e.reps.querySelectorAll('[data-pub]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await sb.rpc('ea_room_publish_replay', { p_replay: b.getAttribute('data-pub'), p_publish: b.getAttribute('data-on') === '1' });
      if (error) this.note('Could not change the replay — ' + error.message);
      try { state = await getState(); } catch (x) {}
      e.last.innerHTML = lastSession(state);
      await this.loadReplays();
    }));
    e.reps.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await record('retry_replay', { replay_id: b.getAttribute('data-retry') }); } catch (x) { this.note(x.message); }
      await this.loadReplays();
    }));
  },
  async loadWho() {
    const e = this.els;
    const { data: mem } = await sb.from('ea_room_members').select('user_id,last_joined_at').eq('room_id', this.room.id).order('last_joined_at', { ascending: false }).limit(200);
    const since = this.room.live_since ? new Date(this.room.live_since).getTime() : 0;
    const cur = (mem || []).filter((m) => new Date(m.last_joined_at).getTime() >= since);
    const names = {};
    if (cur.length) {
      const { data: pr } = await sb.from('ea_profiles').select('user_id,display_name').in('user_id', cur.map((m) => m.user_id));
      (pr || []).forEach((p) => { names[p.user_id] = p.display_name; });
    }
    e.who.querySelector('summary').textContent = (this.room.is_live ? 'In this session' : 'Last session') + ' · ' + cur.length + (cur.length === 1 ? ' person' : ' people');
    e.who.querySelector('div').innerHTML = cur.length ? '<ul>' + cur.map((m) => '<li>' + esc(names[m.user_id] || 'Someone who joined') + '</li>').join('') + '</ul>' : '<p class="fine">Nobody yet.</p>';
  },
};

/* ---------- go ---------- */
switch (branch) {
  case 'dead_link':
    card('<h3>This link isn’t active anymore.</h3><p>Ask your host for the new one.</p>'); break;
  case 'landing':
    card(`<h3>${esc(state.host_name)}’s room</h3><p class="t">${esc(state.title)}</p>` + onAirLine(state) +
         `<a class="btn ht-gold" href="${esc(htLoginHref(k))}">Sign in to join</a><p class="fine">Email, then the 6-digit code — no app to install.</p>`, lastSession(state)); break;
  case 'not_allowed':
    card(`<h3>${esc(state.host_name)}’s room</h3>` + onAirLine(state) + `<p>${esc(words.notAllowed)}</p>`, lastSession(state)); break;
  case 'host_idle':
  case 'host_live':
    try {
      await host.load();
      try { host.admin = (await sb.rpc('ea_is_admin')).data === true; } catch (e) { host.admin = false; }
      host.render();
      if (branch === 'host_live') { host.note('Class is running. This device is entering it — Leave here ends the session for everyone, or press End session.'); await host.reenter(); }
    } catch (e) { card('<h3>The host card could not load.</h3><p>' + esc(e.message || e) + '</p>'); }
    break;
  case 'waiting': await guestWait(); break;
  case 'student': await guestEnter(); break;
  default:
    card('<h3>The room could not load.</h3><p>' + esc(stateErr && stateErr.message ? stateErr.message : 'Reload to try again.') + '</p>');
}
```

- [ ] **Step 2: Syntax and import check**

Run:
```bash
cd ~/taylormade-academy-ht && node --check ht/hub/room.js && node - <<'EOF'
const s = require('fs').readFileSync('ht/hub/room.js', 'utf8');
const must = ['ea_room_state', 'ea_room_rotate_link', 'ea_room_set_hosts', 'ea_room_publish_replay', 'ea_room_replays', 'ea_room_members',
  '/ea-rtk-record', 'room: SLUG', 'p_slug: SLUG', 'htLoginHref(k)', "mountRoom('waiting')", "mountRoom('student')", "mountRoom('host'", 'HT_TOKENS', 'in-room'];
for (const m of must) if (!s.includes(m)) throw new Error('missing ' + m);
if (/select\(['"]\*['"]\)/.test(s)) throw new Error('select(*) is forbidden on room tables');
if (/Nelson/.test(s)) throw new Error('the HT page never assumes Nelson is the host');
if (/\.style\.display|display\s*=/.test(s)) throw new Error('never set display from the page');
console.log('room.js ok');
EOF
```
Expected: `room.js ok`.

- [ ] **Step 3: Rebuild the stamp, smoke the landing card in a browser (stubbed Supabase)**

Run: `cd ~/taylormade-academy-ht && node ht/build.mjs` — then, with `python3 -m http.server 8790 --bind 127.0.0.1` running from the worktree root:

```bash
cd ~/taylormade-academy-ht && node -e '
const { chromium } = require("playwright");
const STATE = { id: "11111111-1111-4111-8111-111111111111", slug: "ht", title: "HT Live", is_live: false, host_name: "Dr. Gray", signed_in: false, is_host: false, can_join: true, bad_link: false, recording_url: null, people: null };
const stub = `export const createClient = () => ({
  auth: { getSession: async () => ({ data: { session: null } }) },
  rpc: async (name, args) => name === "ea_room_state" ? { data: ${JSON.stringify(STATE)}, error: null } : { data: null, error: null },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
});`;
(async () => {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.route("https://esm.sh/**", r => r.fulfill({ status: 200, contentType: "application/javascript", body: stub }));
  await p.goto("http://127.0.0.1:8790/ht/hub/live/?k=AbC123_-xyzXYZ0987ab-_");
  await p.waitForSelector(".ht-room-card h3");
  const h3 = await p.textContent(".ht-room-card h3");
  const signin = await p.getAttribute(".ht-room-card a.btn", "href");
  const hdr = await p.getAttribute(".site-header a[href^=\"/login/\"]", "href");
  const bg = await p.evaluate(() => getComputedStyle(document.querySelector(".ht-room-card")).backgroundColor);
  console.log(JSON.stringify({ h3, signin, hdr, bg, errs }));
  await b.close();
})();'
```
Expected: `h3:"Dr. Gray’s room"`, `signin` and `hdr` both `/login/?next=%2Fht%2Fhub%2Flive%2F%3Fk%3DAbC123_-xyzXYZ0987ab-_`, `bg:"rgb(59, 0, 0)"` (Mahogany — the stylesheet loaded), `errs:[]`.

- [ ] **Step 4: Commit**

```bash
cd ~/taylormade-academy-ht && git add ht/hub/room.js ht/hub/data/all.js ht/hub/*/index.html ht/hub/index.html ht/index.html ht/fund/index.html ht/playbook/index.html && git commit -m "feat(ht): room.js — the class room page: HT cards, the host card (link, hosts, replays, who joined), waiting/enter/host flows

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Copy — the playbook and the program page describe the class room

**Files:**
- Modify: `ht/playbook/index.html` (the "Hold a live session" job ~L217-229; rows ~L283, ~L358, ~L404)
- Modify: `ht/index.html` (the comparison row ~L170; the portfolio card ~L200)

**Interfaces:** none (copy only). Rules: no vendor names, no prices, "HT's own room", sign in = email + six-digit code.

- [ ] **Step 1: Playbook — the job**

Replace the `<ol>` items of the **Hold a live session** job (the `<li>` lines between `<h3>Hold a live session</h3></div><div class="jb"><ol>` and its `</ol>`) with:

```html
<li>Open the Live space. Your room link is at the top of the host card. Copy it and send it by text or email. It works before you start; people who open it early wait in the room.</li>
<li>Press <b>Start class</b>, check your camera and mic on the join screen, then <b>Enter Class</b>. You arrive with both on; everyone else arrives muted with the camera off and turns either on with one tap.</li>
<li>Share your screen from Tools. Questions land in the queue on the right; <b>Bring on stage</b> puts that person's picture in front of everyone until you hand it back.</li>
<li>When you are done, press <b>Leave</b> twice. That ends the session for everyone and stops the recording.</li>
<li>The replay appears on the host card within the hour. Review it, then press <b>Publish</b>. The people who were in the room see it on the Live page; nobody else does.</li>
```

- [ ] **Step 2: Playbook — the three table rows**

Line ~283 `Watch a live session or a replay` row → `<tr><td>Join a live session</td><td>Anyone with the host's link</td><td><span class="tag self">In the hub</span> Sign in with your email and a six-digit code</td></tr>`

Line ~358 `The live room` row → `<tr><td>The live room</td><td>HT's own class room: everyone on camera, a screen to share, a question queue, small groups, and the recording lands with the host to review and publish.</td><td>Host starts it <span class="tag self">In the hub</span></td></tr>`

Line ~404 `No account needed` row → `<tr><td>One sign-in</td><td>Email and a six-digit code, once per device. The same account opens every space, the live room, and a donor's own page.</td><td>Built in</td></tr>`

- [ ] **Step 3: Program page**

Line ~170 row → `<tr><td>Live seminars, town halls, donor briefings and classes, everyone on camera, with chat, a question queue, and replays</td><td>A video-meeting tool plus a webinar tool plus a video host</td><td>HT&rsquo;s own class room, inside the hub <span class="st b">Built</span></td></tr>`

Line ~200 portfolio card `<p>` → `<p>The class room the HT Hub uses: everyone on camera, share a screen, a question queue with a stage, small groups, and a recording the host reviews and publishes. Sign in with an email and a six-digit code; nothing to install.</p>` and its link text → `Step into the HT class room &rarr;`.

- [ ] **Step 4: Check and rebuild**

Run: `cd ~/taylormade-academy-ht && grep -n -i "no account needed\|test picture\|whatever camera\|realtimekit\|cloudflare\|supabase\|\\$[0-9]" ht/playbook/index.html ht/index.html ht/hub/data/live.js | grep -v "og:\|http" ; echo "--- (nothing above = clean) ---" && node ht/build.mjs`
Expected: no matches, then the build line.

- [ ] **Step 5: Commit**

```bash
cd ~/taylormade-academy-ht && git add ht/playbook/index.html ht/index.html ht/hub/*/index.html ht/hub/index.html ht/fund/index.html ht/hub/data/all.js && git commit -m "copy(ht): playbook + program page describe the class room (sign in, start class, publish the replay)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Edge functions — the room is a slug, hosts by email, presets from the row

> **Gate:** run this task only after `academy-room` has merged into `domain-migration` and this branch is rebased on it (`git rebase academy-room` or `domain-migration`). The Academy-room session was asked on 9/15 05:14 to carry items 1–3 below; **first check what landed** — every step starts with a grep and is skipped when the grep already matches. Never edit `~/taylormade-academy`.

**Files:**
- Modify: `supabase/functions/ea-rtk-join/handler.ts`, `index.ts`, `handler_test.ts`
- Modify: `supabase/functions/ea-rtk-record/handler.ts` (or `index.ts` if not split), its test
- Modify: `supabase/functions/ea-rtk-webhook/index.ts` (or handler), its test
- Modify: `supabase/functions/_shared/rtk_presets.ts` (the preset bodies the join function creates)

**Interfaces:**
- Consumes: the Academy room branch as merged (`deps.getRoom`, `deps.ensurePresets`, `RoomRow`, `JoinBody`), `scripts/rtk-presets/ht-class-*.json` (Task 2), 0037 columns (Task 3).
- Produces: bodies `{ room: 'ht' | 'academy' | true, key? }` on join, `{ room, action, replay_id? }` on record; host = `academyAdmin || email ∈ row.host_emails`; presets `row.host_preset` / `row.guest_preset`; Stream copy name `HT · <title> · <date>`.

- [ ] **Step 1: Find out what the Academy session already carried**

Run: `cd ~/taylormade-academy-ht && grep -n "slug\|host_emails\|host_preset\|guest_preset" supabase/functions/ea-rtk-join/handler.ts supabase/functions/ea-rtk-join/index.ts supabase/functions/ea-rtk-record/*.ts supabase/functions/ea-rtk-webhook/*.ts supabase/functions/_shared/rtk_presets.ts 2>/dev/null; echo "--- room body type ---"; grep -n "room?:" supabase/functions/ea-rtk-join/handler.ts supabase/functions/ea-rtk-record/*.ts`
Expected: if every file already mentions `slug` and `host_emails`, skip to Step 6 (tests only). Otherwise apply Steps 2–5 to whatever is missing.

- [ ] **Step 2: `ea-rtk-join` — types and the slug**

In `handler.ts`:
- `JoinBody.room` becomes `room?: boolean | string;`
- `RoomRow` gains `slug: string; host_name: string; host_emails: string[]; host_preset: string; guest_preset: string;`
- `JoinDeps.getRoom` becomes `getRoom: (slug: string) => Promise<RoomRow | null>;` and `ensurePresets: (hostPreset: string, guestPreset: string) => Promise<void>;`
- `PRESETS` gains `"ht-class-host", "ht-class-guest"`.
- At the top of `handleJoin`:

```ts
const slug = body.room === true ? "academy" : (typeof body.room === "string" && /^[a-z][a-z0-9-]{1,31}$/.test(body.room) ? body.room : null);
if (slug) return joinRoom(slug, body, ctx, deps);
if (body.room != null) return { status: 400, body: { error: "bad_room" } };
return joinOpil(body, ctx, deps);
```
- In the room branch (`joinRoom`), after the rate limit: `const row = await deps.getRoom(slug); if (!row) return { status: 404, body: { error: "no_room" } };`
- Role:

```ts
const email = (ctx.user.email || "").trim().toLowerCase();
const isHost = ctx.academyAdmin || (email !== "" && (row.host_emails || []).includes(email));
const key = typeof body.key === "string" && body.key ? body.key : null;
/* an Academy membership opens the Academy room only; every other room is hosts + the current key */
const allowed = isHost || (slug === "academy" && (await deps.isMember())) || (key !== null && key === row.link_key);
if (!allowed) return { status: key ? 404 : 403, body: { error: key ? "bad_link" : "not_allowed" } };
```
- Presets: `if (isHost) await deps.ensurePresets(row.host_preset, row.guest_preset);` and the participant POST uses `preset_name: isHost ? row.host_preset : row.guest_preset`.
- Meeting title on create: `` `${slug === "academy" ? "Academy" : slug.toUpperCase()} · ${row.title} · ${date}` ``.

In `index.ts`: `getRoom: async (slug) => { const { data } = await admin.from("ea_rooms").select("id,slug,title,host_name,host_emails,host_preset,guest_preset,link_key,is_live,live_since,meeting_id,max_participants").eq("slug", slug).maybeSingle(); return (data as RoomRow) ?? null; }` and `ensurePresets: (h, g) => ensurePresets(cf, [h, g])`.

- [ ] **Step 3: `_shared/rtk_presets.ts` — the HT bodies**

If the file is generated from `scripts/rtk-presets/*.json` by a script the Academy session wrote (look for `scripts/gen-rtk-presets-ts.mjs` or a header comment naming its generator), re-run that generator — the two HT JSONs are picked up. Otherwise add the two bodies by hand in the same shape the file uses for `tma-class-host` / `tma-class-guest` (paste the JSON from `scripts/rtk-presets/ht-class-host.json` and `ht-class-guest.json` verbatim), and make `ensurePresets(cf, names: string[])` create any name in `names` that `GET /presets` does not list, from the body table — one `POST /presets` per missing name, idempotent, cached per isolate.

- [ ] **Step 4: `ea-rtk-record` and `ea-rtk-webhook`**

`ea-rtk-record`: the same `slug` resolution as Step 2 (`body.room === true → 'academy'`); the row by slug; `not_host` unless `academyAdmin || email ∈ row.host_emails`; the meeting is `row.meeting_id` (409 `no_room` when null); everything else unchanged.
`ea-rtk-webhook`: where `targetByMeeting` returns a room, include `slug` from the row; the Stream copy name becomes `` `${t.slug === "academy" ? "Academy" : t.slug.toUpperCase()} · ${t.title} · ${date}` ``.

- [ ] **Step 5: Tests (Deno, stubbed) — add to the existing `handler_test.ts` files**

```ts
// ea-rtk-join/handler_test.ts — HT cases
const htRow = (over: Partial<RoomRow> = {}): RoomRow => ({ id: "r-ht", slug: "ht", title: "HT Live", host_name: "Dr. Gray", host_emails: ["dgray@htu.edu"], host_preset: "ht-class-host", guest_preset: "ht-class-guest", link_key: "AbC123_-xyzXYZ0987ab-_", is_live: true, live_since: new Date().toISOString(), meeting_id: "m-ht", max_participants: 50, ...over });

Deno.test("room:'ht' — a listed email is the host and gets ht-class-host", async () => {
  const calls: string[] = [];
  const deps = fakeDeps({ getRoom: async (s) => (s === "ht" ? htRow({ is_live: false, meeting_id: null }) : null),
    ensurePresets: async (h, g) => { calls.push("presets:" + h + "," + g); }, isMember: async () => false });
  const r = await handleJoin({ room: "ht" }, caller({ email: "DGray@HTU.edu", academyAdmin: false }), deps);
  assertEquals(r.status, 200);
  assertEquals((r.body as any).preset, "ht-class-host");
  assertEquals((r.body as any).host, true);
  assertEquals(calls, ["presets:ht-class-host,ht-class-guest"]);
});

Deno.test("room:'ht' — an Academy member without the key is refused (membership opens the Academy room only)", async () => {
  const deps = fakeDeps({ getRoom: async () => htRow(), isMember: async () => true });
  const r = await handleJoin({ room: "ht" }, caller({ email: "member@example.com", academyAdmin: false }), deps);
  assertEquals(r.status, 403);
  assertEquals((r.body as any).error, "not_allowed");
});

Deno.test("room:'ht' — the key admits a guest with ht-class-guest and no meeting id", async () => {
  const deps = fakeDeps({ getRoom: async () => htRow(), isMember: async () => false });
  const r = await handleJoin({ room: "ht", key: "AbC123_-xyzXYZ0987ab-_" }, caller({ email: "guest@example.com", academyAdmin: false }), deps);
  assertEquals(r.status, 200);
  assertEquals((r.body as any).preset, "ht-class-guest");
  assertEquals((r.body as any).meeting_id, undefined);
});

Deno.test("room:true still means the Academy room", async () => {
  const seen: string[] = [];
  const deps = fakeDeps({ getRoom: async (s) => { seen.push(s); return null; } });
  await handleJoin({ room: true }, caller({ academyAdmin: true }), deps);
  assertEquals(seen, ["academy"]);
});

Deno.test("room:'Bad Slug!' is a 400", async () => {
  const r = await handleJoin({ room: "Bad Slug!" }, caller({ academyAdmin: true }), fakeDeps({}));
  assertEquals(r.status, 400);
});
```
(`fakeDeps` and `caller` are the helpers the Academy tests already define; if their names differ, use theirs.) Add the mirror cases to the record test (`room:'ht'` + listed email → allowed; unlisted → 403 `not_host`) and one webhook test asserting the Stream name `HT · HT Live · 2026-09-17` for an `ht` row.

- [ ] **Step 6: Run every function test**

Run: `cd ~/taylormade-academy-ht/supabase/functions && deno test --allow-env --allow-read ea-rtk-join ea-rtk-record ea-rtk-webhook _shared 2>&1 | tail -15`
Expected: all pass, including the Academy suites untouched.

- [ ] **Step 7: Commit**

```bash
cd ~/taylormade-academy-ht && git add supabase/functions && git commit -m "feat(rtk): rooms by slug — hosts by email, presets from the row, HT preset bodies, Stream name by slug

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `js/rtk-room-v2.js` — `target.words` and `target.tokens` (only if not already there)

> **Gate:** same as Task 8 — after the merge and the rebase. The Academy session was asked to carry both; check first.

**Files:**
- Modify: `js/rtk-room-v2.js` (the `mountRoomV2` head, where `target` is derived; the `provideRtkDesignSystem` call ~L109)
- Test: `tests/opil/room-v2.test.mjs` stays green (byte-for-byte OPIL defaults); add one case to `tests/ht/room-words.test.mjs` if a pure hook is exposed.

- [ ] **Step 1: Check**

Run: `cd ~/taylormade-academy-ht && grep -n "target.words\|target.tokens\|o.target" js/rtk-room-v2.js`
Expected: if both `target.words` and `target.tokens` appear, this task is done — skip to Step 4.

- [ ] **Step 2: Words**

Where the module picks its words (after the merge it reads `ROOM_WORDS` for `target.kind === 'room'` and `OPIL_WORDS` otherwise), make it:

```js
const words = (target && target.words) || (target && target.kind === 'room' ? ROOM_WORDS : OPIL_WORDS);
```

- [ ] **Step 3: Tokens**

Lift the literal passed to `provideRtkDesignSystem` into a constant and read the override:

```js
const ACADEMY_TOKENS = {
  theme: 'dark', borderRadius: 'rounded', spacingBase: 4,
  colors: {
    brand: { 300: '#b28a0a', 400: '#d9a90f', 500: '#fdc921', 600: '#fed45a', 700: '#fee38a' },
    background: { 600: '#22345f', 700: '#162650', 800: '#0f1d44', 900: '#0a1733', 1000: '#04123a' },
    text: '#ffffff', 'text-on-brand': '#04123a', 'video-bg': '#0a1733',
    danger: '#ff5c5c', success: '#3ddc97', warning: '#fdc921',
  },
};
…
if (ui.provideRtkDesignSystem) ui.provideRtkDesignSystem(mountEl, (target && target.tokens) || ACADEMY_TOKENS);
```
The values are exactly the ones in the file today — copy them from there, do not retype from this plan.

- [ ] **Step 4: Prove OPIL did not move, then commit**

Run: `cd ~/taylormade-academy-ht && node --check js/rtk-room-v2.js && node --test tests/opil/*.test.mjs tests/academy/*.test.mjs tests/ht/*.test.mjs 2>&1 | tail -5 && git diff --stat js/rtk-room-v2.js`
Expected: all pass; the diff is ≤ 20 lines.

```bash
cd ~/taylormade-academy-ht && git add js/rtk-room-v2.js && git commit -m "feat(room): target.words and target.tokens on mountRoomV2 — OPIL and Academy defaults unchanged

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The page harness — every branch, the host flow, the phone, the colors (kit + Supabase stubbed)

**Files:**
- Create (session scratchpad, NOT committed): `<scratchpad>/harness/ht-room.mjs`, `<scratchpad>/harness/stub-supabase.js`, `<scratchpad>/harness/stub-room-v2.js`

**Interfaces:**
- Consumes: the built pages served from the worktree root (`python3 -m http.server 8790 --bind 127.0.0.1`), system Chrome via Playwright (`require('playwright')` from `~/taylormade-academy-ht` — install with `npm i -D playwright` there if missing; `channel: 'chrome'` uses the installed browser, no download).
- Produces: a pass/fail list; nothing on prod is touched (esm.sh, the kit module and `FUNCTIONS_BASE` are all intercepted).

- [ ] **Step 1: The Supabase stub (served in place of esm.sh)**

```js
// stub-supabase.js — createClient() driven by window.__db, which the harness sets per scenario.
export const createClient = () => ({
  auth: { getSession: async () => ({ data: { session: window.__db.session || null } }) },
  rpc: async (name, args) => {
    window.__calls.push(['rpc', name, args]);
    if (name === 'ea_room_state') return { data: window.__db.state, error: null };
    if (name === 'ea_is_admin') return { data: !!window.__db.admin, error: null };
    if (name === 'ea_room_rotate_link') { window.__db.room.link_key = 'NEWKEY_NEWKEY_NEWKEY_1'; return { data: window.__db.room.link_key, error: null }; }
    if (name === 'ea_room_set_hosts') { window.__db.room.host_emails = args.p_emails.map(s => s.toLowerCase()); return { data: window.__db.room.host_emails, error: null }; }
    if (name === 'ea_room_publish_replay') { const r = window.__db.replays.find(x => x.id === args.p_replay); r.published = args.p_publish; window.__db.state.recording_url = args.p_publish ? r.watch_url : null; return { data: { ok: true }, error: null }; }
    return { data: null, error: null };
  },
  from: (table) => {
    const q = { _t: table, _f: [], _patch: null };
    const chain = {
      select: () => chain, eq: (c, v) => { q._f.push([c, v]); return chain; }, in: () => chain, order: () => chain, limit: () => chain,
      update: (p) => { q._patch = p; return chain; },
      maybeSingle: async () => ({ data: table === 'ea_rooms' ? window.__db.room : null, error: null }),
      then: (res) => {
        window.__calls.push(['from', table, q._patch ? 'update' : 'select', q._f, q._patch]);
        if (q._patch && table === 'ea_rooms') { Object.assign(window.__db.room, q._patch); Object.assign(window.__db.state, { is_live: window.__db.room.is_live }); return res({ data: null, error: null }); }
        const rows = table === 'ea_room_replays' ? window.__db.replays : table === 'ea_room_members' ? window.__db.members : table === 'ea_profiles' ? window.__db.profiles : [];
        return res({ data: rows, error: null });
      },
    };
    return chain;
  },
});
```

- [ ] **Step 2: The room stub (served in place of `/js/rtk-room-v2.js`)**

```js
// stub-room-v2.js — records the call, paints a marker, and lets the harness fire onOpened / onState.
export async function mountRoomV2(o) {
  window.__mount = { mode: o.mode, target: o.target, facilitator: o.facilitator };
  o.mountEl.classList.add('r2host');
  o.mountEl.innerHTML = '<section class="r2-join"><div class="r2-join-left"><div class="r2-kicker">You’re in the right place.</div><h2 class="r2-title">' + o.target.title + '</h2><p class="r2-line">' + (o.mode === 'waiting' ? o.target.words.waiting : 'preview') + '</p>' + (o.mode === 'waiting' ? '<div class="r2-wait"><b>x</b></div>' : '<div class="r2-preview"></div>') + '</div></section>';
  document.body.classList.add('in-room', 'in-room-v2');
  if (o.mode === 'waiting') document.body.classList.remove('in-room', 'in-room-v2');
  window.__room = {
    open: async (id) => { if (o.onOpened) await o.onOpened(id); },
    state: (s) => o.onState(s),
    leave: () => o.onState('left'),
  };
  if (o.mode === 'host' && o.onOpened) await o.onOpened('m-new');
  return { meetingId: 'm-new', leave: async () => o.onState('left'), setRecording: (on) => { window.__rec = on; } };
}
```

- [ ] **Step 3: The harness**

```js
// ht-room.mjs — run: node <scratchpad>/harness/ht-room.mjs   (server on :8790 from the worktree root)
import { chromium } from 'playwright';
import fs from 'node:fs';
const H = new URL('./', import.meta.url);
const SB = fs.readFileSync(new URL('stub-supabase.js', H), 'utf8'), R2 = fs.readFileSync(new URL('stub-room-v2.js', H), 'utf8');
const KEY = 'AbC123_-xyzXYZ0987ab-_';
const base = { id: 'r-ht', slug: 'ht', title: 'HT Live', is_live: false, host_name: 'Dr. Gray', signed_in: true, is_host: false, can_join: true, bad_link: false, recording_url: null, people: null };
const room = { id: 'r-ht', slug: 'ht', title: 'HT Live', host_name: 'Dr. Gray', host_emails: [], link_key: KEY, is_live: false, live_since: null, max_participants: 50, recording_url: null };
const sess = { user: { id: 'u1', email: 'x@y.z' }, access_token: 't' };
const out = []; const ok = (n, c, d = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' · ' + d));

const b = await chromium.launch({ channel: 'chrome', headless: true });
async function page(db, { width = 1280, url = '/ht/hub/live/?k=' + KEY } = {}) {
  const p = await b.newPage({ viewport: { width, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const rec = [];
  await p.addInitScript((d) => { window.__db = d; window.__calls = []; }, db);
  await p.route('https://esm.sh/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SB }));
  await p.route('**/js/rtk-room-v2.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: R2 }));
  await p.route('**/ea-rtk-record', async r => { rec.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, stopped: true }) }); });
  await p.goto('http://127.0.0.1:8790' + url);
  await p.waitForFunction(() => !document.querySelector('.ht-room-loading') || /could not/.test(document.querySelector('.ht-room-loading').textContent));
  return { p, errs, rec };
}
const text = (p, s) => p.locator(s).first().textContent().then(t => (t || '').trim());

/* 1 signed out → landing card in HT colors, sign-in carries the key */
{ const { p, errs } = await page({ state: { ...base, signed_in: false }, session: null, room, replays: [], members: [], profiles: [] });
  ok('landing: host’s room', (await text(p, '.ht-room-card h3')) === 'Dr. Gray’s room');
  ok('landing: sign-in keeps the key', (await p.getAttribute('.ht-room-card a.btn', 'href')).includes(encodeURIComponent('?k=' + KEY)));
  ok('landing: Mahogany card', (await p.evaluate(() => getComputedStyle(document.querySelector('.ht-room-card')).backgroundColor)) === 'rgb(59, 0, 0)');
  ok('landing: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 2 dead link */
{ const { p } = await page({ state: { bad_link: true }, session: sess, room, replays: [], members: [], profiles: [] });
  ok('dead link card', /isn’t active anymore/.test(await text(p, '.ht-room-card h3'))); await p.close(); }
/* 3 signed in, no key, never joined */
{ const { p } = await page({ state: { ...base, can_join: false }, session: sess, room, replays: [], members: [], profiles: [] }, { url: '/ht/hub/live/' });
  ok('not allowed: host’s link line', /host’s link/.test(await text(p, '.ht-room-card p:not(.s)'))); await p.close(); }
/* 4 waiting → Ada + the host’s name; flips live → reload */
{ const { p } = await page({ state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] });
  await p.waitForSelector('.r2-join');
  ok('waiting: mode', await p.evaluate(() => window.__mount.mode === 'waiting'));
  ok('waiting: HT words + tokens reached the room', await p.evaluate(() => window.__mount.target.words.host === 'Dr. Gray' && window.__mount.target.tokens.colors.brand[500] === '#FFCC00' && window.__mount.target.slug === 'ht'));
  ok('waiting: the line names the host', /Dr\. Gray hasn’t started yet/.test(await text(p, '.r2-line')));
  ok('waiting: Ada beside the line', /ada-face\.jpg/.test(await p.evaluate(() => getComputedStyle(document.querySelector('.r2-line'), '::before').backgroundImage)));
  await p.close(); }
/* 5 the host: idle → Start → opened → live → joined → recording → Leave → stop → off air */
{ const { p, errs, rec } = await page({ state: { ...base, is_host: true, people: 0 }, session: sess, admin: true, room: { ...room }, replays: [], members: [], profiles: [] });
  await p.waitForSelector('#rmStart');
  ok('host: link field', (await p.inputValue('#rmLink')).endsWith('?k=' + KEY));
  ok('host: hosts textarea for the admin', !!(await p.$('#rmHosts')));
  ok('host: off air', (await text(p, '#rmStatus')) === 'Off air');
  await p.click('#rmNew'); ok('new link: armed', /Tap again/.test(await text(p, '#rmNew')));
  await p.click('#rmNew'); await p.waitForFunction(() => document.getElementById('rmLink').value.includes('NEWKEY'));
  ok('new link: rotated', true);
  await p.fill('#rmTitle', 'Fall town hall'); await p.press('#rmTitle', 'Tab');
  await p.waitForFunction(() => document.getElementById('rmTitleSaved').textContent === 'Saved');
  ok('title saves on blur', await p.evaluate(() => window.__db.room.title === 'Fall town hall'));
  await p.click('#rmStart');
  await p.waitForFunction(() => window.__db.room.is_live === true);
  ok('start: room flipped live via onOpened', true);
  ok('start: button reads running', (await text(p, '#rmStart')) === 'Class is running');
  ok('start: recording NOT started before joined', rec.length === 0);
  await p.evaluate(() => window.__room.state('joined'));
  await p.waitForFunction(() => window.__rec === true);
  ok('joined: recording started with room:ht', rec.length === 1 && rec[0].room === 'ht' && rec[0].action === 'start');
  ok('joined: chrome hidden in room', await p.evaluate(() => getComputedStyle(document.querySelector('.ht-tabs')).display === 'none'));
  await p.evaluate(() => window.__room.leave());
  await p.waitForFunction(() => window.__db.room.is_live === false);
  ok('leave: stop sent, room off air', rec.length === 2 && rec[1].action === 'stop');
  ok('leave: note says the replay is being prepared', /replay is being prepared/.test(await text(p, '#rmNote')));
  ok('host: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 6 replays: publish → Last session iframe */
{ const reps = [{ id: 'rep1', status: 'ready', watch_url: 'https://customer-x.cloudflarestream.com/abc/watch', duration_s: 1830, published: false, error: null, created_at: '2026-09-17T18:00:00Z' }];
  const { p } = await page({ state: { ...base, is_host: true }, session: sess, admin: true, room: { ...room }, replays: reps, members: [], profiles: [] });
  await p.waitForSelector('[data-pub]');
  ok('replay row: label + minutes', /ready — review, then publish · 31 min/.test(await text(p, '.ht-room-rep')));
  await p.click('[data-pub]'); await p.waitForSelector('#rmLast iframe');
  ok('publish: iframe uses /iframe', (await p.getAttribute('#rmLast iframe', 'src')).endsWith('/abc/iframe'));
  ok('publish: button flips', (await text(p, '[data-pub]')) === 'Unpublish'); await p.close(); }
/* 7 a guest who joined before sees Last session on the landing card */
{ const { p } = await page({ state: { ...base, can_join: false, recording_url: 'https://customer-x.cloudflarestream.com/abc/watch' }, session: sess, room, replays: [], members: [], profiles: [] }, { url: '/ht/hub/live/' });
  ok('past joiner: Last session', !!(await p.$('.ht-room-last iframe'))); await p.close(); }
/* 8 phone: no horizontal overflow on the host card and the waiting screen */
for (const [name, db] of [['host', { state: { ...base, is_host: true }, session: sess, admin: false, room: { ...room }, replays: [], members: [], profiles: [] }], ['waiting', { state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] }]]) {
  const { p } = await page(db, { width: 390 });
  await p.waitForTimeout(400);
  ok('phone ' + name + ': no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth <= 390 + 1)); await p.close(); }
await b.close();
console.log(out.join('\n')); console.log(out.filter(l => l.startsWith('OK')).length + ' OK · ' + out.filter(l => l.startsWith('FAIL')).length + ' FAIL');
process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
```

- [ ] **Step 4: Run it and fix until green**

Run (server already up): `cd ~/taylormade-academy-ht && node <scratchpad>/harness/ht-room.mjs`
Expected: `… OK · 0 FAIL`. A FAIL is a bug in `room.js`, `room.css` or `ht.js` — fix it in the worktree, `node ht/build.mjs`, rerun. Commit fixes with `fix(ht): …`.

- [ ] **Step 5: Keep the harness reachable**

Copy the three files to `~/Downloads/ht-room-harness/` (memory rule: pickup files in Downloads) and note the path in the Task 11 memory entry. They are not committed (they stub prod names).

---

### Task 11: Rollout — order, deploy, apply, presets, the real run, cleanup, memory

**Files:**
- Modify: `sw.js` (`VERSION`)
- Memory: `~/.claude/projects/-Users-nelsontaylor/memory/ht-class-room.md` (new) + a line in `MEMORY.md`; update `ht-academy-partnership-program.md` (the 9/11 "same room" section → built)

- [ ] **Step 1: Sequence**

1. `academy-room` merges into `domain-migration` (the other session's rollout, including its own OPIL guard before Wed 9/16). Then here: `git rebase domain-migration`, run Tasks 8–9 if needed, `node --test tests/opil/*.test.mjs tests/academy/*.test.mjs tests/ht/*.test.mjs`, `node ht/build.mjs`, the Task 10 harness.
2. `sw.js`: `VERSION` → the next number after the Academy room's (`tma-v21-academy-room` → `tma-v22-ht-room`). Commit `chore(sw): tma-v22-ht-room`.
3. **0037** — stage for Nelson and tell him in chat: `! bash scripts/apply-0037.sh` (runs after his `apply-0036.sh`). Read every `FAIL` line back before going on. Expected tail: `0037 is on prod and verified. Nothing from the verify was kept.`
4. **Functions** — `supabase functions deploy ea-rtk-join ea-rtk-record ea-rtk-webhook --no-verify-jwt` (function deploys were not classifier-blocked on 9/14). Then create the HT presets: either open `/ht/hub/live/` as Nelson and press Start class once (the join function's `ensurePresets` POSTs `ht-class-host` / `ht-class-guest` on first host open — then Leave; delete the draft replay row that creates) or run `scripts/rtk-presets.sh` with the token in the shell. Confirm both presets exist on the Cloudflare dashboard (Realtime → RealtimeKit → `taylormade-academy-production` → Presets) and that the guest preset's chat shows files off.
5. **Pages** — merge `ht-class-room` into `domain-migration` (fast-forward or merge commit), `git push origin domain-migration:main`. Verify on the **bare** URL (memory: `gotcha-verify-deploys-on-the-bare-url`): `curl -s https://taylormadeacademy.com/ht/hub/live/ | grep -o 'room.js?v=[a-f0-9]*\|type: .room.' | head`, and `curl -sI https://taylormadeacademy.com/ht/hub/room.css | head -1` → 200.
6. **Real run** (Nelson + one second person on the real link, never a test account on prod tables beyond `zz-test-`): Nelson opens `/ht/hub/live/` signed in → host card → Copy link → sends it → Start class → Enter; the guest signs in through the link → tile appears on both sides → Ask a question → Bring on stage → share screen from the guest → `Max people` = 2 then a third device gets *The room is full right now* → New link → the old link shows *isn't active anymore* → Remove from People → the guest sees *This session has ended* → Leave twice → *Session ended — the replay is being prepared* → within the hour *Replay ready* → Review → Publish → the guest reloads and sees **Last session** → add a `zz-test-` email to Hosts → sign in as it → the host card appears. Then: Unpublish, delete the `zz-test-` rows (`ea_room_members`, `ea_room_hands`, the replay row) and the Stream asset, set `host_emails` back.
7. **iPhone**: add the hub to a real home screen, open `/ht/hub/live/?k=…` from there, join. Still the one thing never done for the HT Hub.

- [ ] **Step 2: Memory**

Write `ht-class-room.md` (type: project) with: what shipped, the URLs, the slug design, `ea_room_is_host`, the presets, what was verified in the real run and what was not, the harness path in Downloads, the CSS-fork follow-up (variables after 9/16), the Academy-branded login caveat, and the cost line. Add it to `MEMORY.md` under *Active Projects — Clients* next to the HT Hub line; update `ht-academy-partnership-program.md`'s "same live class room" section to point at it.

- [ ] **Step 3: Tell Nelson**

In chat: the link pattern, that he hosts today and adds HT staff by email on the card, that the sign-in page still says Taylormade Academy, what the real run proved, and the two things left (iPhone home-screen run; the shared CSS variables after orientation).

---

## Self-review (done while writing)

- **Spec coverage:** §1 decisions → Tasks 3, 6; §2.1 host card → Task 6 (`host.render/wire`), §2.2 guest states → Task 6 (`card/guestWait/guestEnter/endedCard/leftCard`), §2.3 visitors + Last session → Task 6 (`lastSession`); §3 division of files → Global Constraints + Tasks 8–9 gates; §4.1–4.4 → Task 3 (0037 + verify); §5 presets → Task 2 (+ Task 8 Step 3 for the function's bodies); §6 → Task 8; §7.1 → Task 1; §7.2 → Task 4; §7.3 → Task 6; §7.4 → Task 5; §7.5 → Task 4; §7.6 → Tasks 4, 11; §8 → Tasks 6, 11; §9 invariants → Task 3 verify (1–5), Task 8 tests (1–2), inherited 0036 (6); §10 → Tasks 1, 2, 3, 5, 8, 10, 11; §11 → Task 11 Step 3. The playbook/program copy (Task 7) was not in the spec — added because the pages still described the one-way player.
- **Placeholders:** none — every code step carries the code; Tasks 8–9 are gated on files that will exist only after the merge and say exactly which greps decide whether a step applies.
- **Type consistency:** `htWords(hostName)`, `HT_TOKENS`, `htErrorText(code, status, words)`, `htLoginHref(k)` are the same in Tasks 1, 6, 10; RPC names/arguments in Task 3 match the calls in Task 6 and the stub in Task 10; `record()` sends `{ room: 'ht', action, replay_id? }` (Tasks 6, 8, 10); `mountRoomV2`'s `target` shape is the spine's in Tasks 6, 9, 10; `onState` uses only `'joined' | 'left' | 'ended'`.

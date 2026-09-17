# HT Hub demo-ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The HT Hub, as it exists, made demo-ready for Dr. Wallace: the OPIL class features that fit a standing room (Files, the replay page, a per-room warm-up question, Next session + Add to calendar) working in HT's room, every hub page current on any day, the dot-pills gone, one HT line on `/login/`, and a two-browser verification list.

**Architecture:** HT's room is `ea_rooms` row `ht`, mounted by `ht/hub/room.js` through the shared `js/rtk-room-v2.js`, whose plugin host already runs the class plugins for `target.kind === 'room'` under the class key `room:<uuid>`. The work opens the three room gates that are still OPIL-only (Files, Whiteboard save, warm-up question), adds two columns + one state field for Next session, and ports the OPIL replay page onto the HT frame reading the same `ea_class_*` tables by room key. Content is data in `ht/hub/data/*.js`; `ht/build.mjs` bundles it and stamps every `/ht/` asset.

**Tech Stack:** static HTML on GitHub Pages (repo `taylormadecreative/academy`, Pages serves `main`; local branch `academy-room`, deploy = `git push origin academy-room:main`), vanilla JS (classic `ht.js` + ES modules), Supabase (Postgres + RLS + Deno edge functions), Cloudflare RealtimeKit 2.0.2, node:test for pure JS, Playwright (system Chrome) for `tests/ht/harness/`, Nelson runs prod migrations with `! bash scripts/apply-00NN.sh`.

**Spec:** `docs/superpowers/specs/2026-09-17-ht-hub-demo-ready-design.md`

## Global Constraints

- HT pages: no prices, no vendor or tool names (never "RealtimeKit", "Cloudflare", "Supabase" in page copy), never "avatar" (Ada is "HT's student ambassador"), real people named only Linda Y. Jackson and Dr. Wallace, students first name + last initial, sample chips stay on sample content.
- Brand: HT Maroon `#660100`, HT Gold `#FFCC00`; the `ht/ht.css` tokens already carry them.
- No status pill with a colored dot anywhere (`feedback_avoid_ai_tell_elements`); no gradient washes on photos.
- Every sample date ≥ `2026-10-06` and never on a published HT `ceremony`, `closed` or `exam` date/span in `ht/hub/data/events.js`; no relative weekday words ("Thursday", "on the 14th") in copy.
- The page writes NOTHING on Start class (the join function stamps `is_live`); Leave only leaves; End is two taps.
- Run `node ht/build.mjs` after ANY edit under `ht/` or to `js/rtk-room-v2.js`, `js/room-page.js`, `opil/hub/live-rooms.js`, or a plugin the HT room loads; commit the regenerated shells and `all.js` with the change.
- Never `git push` a task on its own; the deploy is Task 8, after Nelson has run `apply-0054.sh`.
- Prod DB writes and `supabase functions deploy` are Nelson's (`!` scripts). Nothing here signs in to prod or writes to it.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Ground truth — the current shared module in the HT room, every suite green

**Files:**
- Modify (generated): `ht/hub/*/index.html`, `ht/index.html`, `ht/fund/index.html`, `ht/playbook/index.html` (stamp only)
- Test: `tests/ht/harness/ht-room.mjs` (existing), `tests/ht/*.test.mjs`, `tests/opil/*.test.mjs`, `tests/academy/*.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: a known-good baseline commit; the list of any pre-existing failures (there should be none).

- [ ] **Step 1: Rebuild the HT stamp**

Run: `cd ~/taylormade-academy && node ht/build.mjs`
Expected: `all.js: … | stamp: <8 hex> | spaces: advancement, president, …` and `git status --short` shows `ht/hub/*/index.html` changed (the stamp moved because `js/rtk-room-v2.js` changed after 9/15).

- [ ] **Step 2: Run the node suites**

Run: `cd ~/taylormade-academy && node --test tests/ht/*.test.mjs tests/opil/*.test.mjs tests/academy/*.test.mjs 2>&1 | tail -8`
Expected: `# fail 0`.

- [ ] **Step 3: Run the HT harness against the local server**

Run (two shells, or `&`):
```bash
cd ~/taylormade-academy && (python3 -m http.server 8790 --bind 127.0.0.1 >/dev/null 2>&1 &) && sleep 1 && node tests/ht/harness/ht-room.mjs 2>&1 | tail -60
```
Expected: every line `OK   …`, none `FAIL`. Note the count (it was 54 on 9/15); it is the baseline for Task 3/4/5 additions.

- [ ] **Step 4: Commit the rebuilt stamp**

```bash
git add ht/hub ht/index.html ht/fund/index.html ht/playbook/index.html
git commit -m "chore(ht): rebuild the HT stamp so the room loads the current shared module (batches A–D)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration 0054 — materials for `room:` keys, storage room prefix, `warmup_q` / `next_title` / `next_at`, `ea_room_state` returns them

**Files:**
- Create: `supabase/migrations/0054_ht_room_features.sql`
- Create: `scripts/apply-0054.sh`
- Test: `tests/ht/migration-0054.test.mjs` (the SQL's contract, checked as text — the only DB is prod)

**Interfaces:**
- Produces: columns `ea_rooms.warmup_q text`, `ea_rooms.next_title text`, `ea_rooms.next_at timestamptz`; `ea_room_state(...)` JSON gains `warmup_q`, `next_title`, `next_at`; materials rows with `room_key like 'room:%'` readable by `ea_class_can(room_key)`, written by `ea_class_is_host(room_key)`; storage objects under `materials/<uid>/room/<room uuid>/…` readable by anyone `ea_class_can('room:<uuid>')`, written by a host of that room.

- [ ] **Step 1: Write the contract test**

```js
// tests/ht/migration-0054.test.mjs — run: node --test tests/ht/migration-0054.test.mjs
// The migration's contract as text: the statements the client code (Tasks 3–5) relies on must be there.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync(new URL('../../supabase/migrations/0054_ht_room_features.sql', import.meta.url), 'utf8');
const has = (re, why) => assert.match(sql, re, why);
test('0054 adds the three room columns', () => {
  has(/alter table public\.ea_rooms add column if not exists warmup_q text/i, 'warmup_q');
  has(/alter table public\.ea_rooms add column if not exists next_title text/i, 'next_title');
  has(/alter table public\.ea_rooms add column if not exists next_at timestamptz/i, 'next_at');
});
test('0054 returns them from ea_room_state', () => {
  has(/create or replace function public\.ea_room_state\(p_key text default null, p_slug text default 'academy'\)/, 'same signature as 0038');
  has(/'warmup_q', r\.warmup_q/, 'warmup_q in the json');
  has(/'next_title', r\.next_title/, 'next_title in the json');
  has(/'next_at', r\.next_at/, 'next_at in the json');
  has(/grant execute on function public\.ea_room_state\(text, text\) to anon, authenticated/, 'anon may still call it');
});
test('0054 opens materials to room keys through the class functions', () => {
  has(/create policy mat_room_read on public\.ea_opil_materials for select to authenticated\s+using \(room_key like 'room:%' and public\.ea_class_can\(room_key\)\)/, 'read');
  has(/create policy mat_room_insert on public\.ea_opil_materials for insert to authenticated/, 'insert');
  has(/public\.ea_class_is_host\(room_key\)/, 'hosts write');
  has(/create policy mat_read on public\.ea_opil_materials[\s\S]*?room_key not like 'room:%'/, 'the cohort read no longer covers room rows');
});
test('0054 scopes storage by the room prefix', () => {
  has(/create policy "opil files room read" on storage\.objects for select to authenticated/, 'room read');
  has(/\(storage\.foldername\(name\)\)\[3\] = 'room'/, 'the room folder');
  has(/public\.ea_class_can\('room:' \|\| \(storage\.foldername\(name\)\)\[4\]\)/, 'read = in the room');
  has(/create policy "opil files room write" on storage\.objects for insert to authenticated/, 'room write');
  has(/public\.ea_class_is_host\('room:' \|\| \(storage\.foldername\(name\)\)\[4\]\)/, 'write = a host');
});
test('0054 ends with its status row', () => { has(/select 'ht room features ready' as status;\s*$/, 'status'); });
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd ~/taylormade-academy && node --test tests/ht/migration-0054.test.mjs 2>&1 | tail -5`
Expected: FAIL — `ENOENT … 0054_ht_room_features.sql`.

- [ ] **Step 3: Write the migration**

```sql
-- 0054 — the HT room gets the class features that fit a standing room (spec 2026-09-17-ht-hub-demo-ready-design.md §2).
-- 1 Files in a room: materials rows filed under room_key 'room:<uuid>' — read by anyone in the room
--   (ea_class_can: signed in = in), written by a host of that room (ea_class_is_host: Nelson + host_emails).
--   The bytes get their own prefix, materials/<uid>/room/<room uuid>/…, with storage policies on it —
--   the scoping 0045 named as "a later change" — so a room's files are never readable through the
--   cohort's materials/ read (0016), which an HT guest does not have anyway.
-- 2 A warm-up question per room and a Next session (title + time) on the row; ea_room_state returns
--   them so a guest's waiting screen and the Live space can read them without a select on ea_rooms.
-- Additive and idempotent. Undo notes at the end.

/* 1 — materials for room keys */
drop policy if exists mat_read on public.ea_opil_materials;
create policy mat_read on public.ea_opil_materials for select to authenticated
  using ((room_key is null or (room_key not like 'team:%' and room_key not like 'room:%'))
         and (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())));
drop policy if exists mat_room_read on public.ea_opil_materials;
create policy mat_room_read on public.ea_opil_materials for select to authenticated
  using (room_key like 'room:%' and public.ea_class_can(room_key));
drop policy if exists mat_cohort_insert on public.ea_opil_materials;
create policy mat_cohort_insert on public.ea_opil_materials for insert to authenticated
  with check (uploaded_by = auth.uid() and kind = 'resource' and link_url is null
              and file_path like 'materials/' || auth.uid()::text || '/%'
              and (room_key is null or (room_key not like 'team:%' and room_key not like 'room:%'))
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid())));
drop policy if exists mat_room_insert on public.ea_opil_materials;
create policy mat_room_insert on public.ea_opil_materials for insert to authenticated
  with check (uploaded_by = auth.uid() and kind = 'resource' and link_url is null
              and file_path like 'materials/' || auth.uid()::text || '/room/' || public.ea_class_key_id(room_key) || '/%'
              and room_key like 'room:%' and public.ea_class_is_host(room_key));
/* delete: mat_own_delete (0041) — the uploader removes their own row; a host removes their own file. */

/* 2 — the bytes: a room prefix inside the uploader's folder */
drop policy if exists "opil files room read" on storage.objects;
create policy "opil files room read" on storage.objects for select to authenticated
  using (bucket_id = 'opil-files'
         and (storage.foldername(name))[1] = 'materials'
         and (storage.foldername(name))[3] = 'room'
         and public.ea_class_can('room:' || (storage.foldername(name))[4]));
drop policy if exists "opil files room write" on storage.objects;
create policy "opil files room write" on storage.objects for insert to authenticated
  with check (bucket_id = 'opil-files'
              and (storage.foldername(name))[1] = 'materials'
              and (storage.foldername(name))[2] = auth.uid()::text
              and (storage.foldername(name))[3] = 'room'
              and public.ea_class_is_host('room:' || (storage.foldername(name))[4]));

/* 3 — the room row: a warm-up question, a next session */
alter table public.ea_rooms add column if not exists warmup_q text check (warmup_q is null or char_length(warmup_q) <= 160);
alter table public.ea_rooms add column if not exists next_title text check (next_title is null or char_length(next_title) <= 120);
alter table public.ea_rooms add column if not exists next_at timestamptz;

/* 4 — ea_room_state carries them (same body as 0038 plus three fields) */
create or replace function public.ea_room_state(p_key text default null, p_slug text default 'academy') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.ea_rooms%rowtype;
  v_host boolean; v_member boolean; v_joined boolean; v_can boolean; v_signed boolean;
begin
  select * into r from public.ea_rooms where slug = p_slug;
  if not found then return null; end if;
  v_signed := auth.uid() is not null;
  v_host := public.ea_room_is_host(r.id);
  v_member := (r.slug = 'academy') and public.ea_is_member();
  v_joined := v_signed and exists (select 1 from public.ea_room_members m where m.room_id = r.id and m.user_id = auth.uid());
  v_can := v_host or v_member or (r.open_door and v_signed) or (p_key is not null and p_key = r.link_key);
  if (not v_can) and p_key is not null and p_key <> r.link_key then
    return jsonb_build_object('bad_link', true);
  end if;
  return jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'is_live', r.is_live, 'host_name', r.host_name,
    'signed_in', v_signed,
    'is_host', v_host,
    'can_join', v_can,
    'open_door', r.open_door,
    'bad_link', false,
    'warmup_q', r.warmup_q,
    'next_title', r.next_title,
    'next_at', r.next_at,
    'recording_url', case when v_host or v_member or (r.slug <> 'academy' and v_joined) then r.recording_url else null end,
    'people', case when v_host then (select count(*) from public.ea_room_members m
                                      where m.room_id = r.id and m.last_joined_at >= coalesce(r.live_since, 'epoch'::timestamptz))
                   else null end
  );
end $$;
revoke all on function public.ea_room_state(text, text) from public;
grant execute on function public.ea_room_state(text, text) to anon, authenticated;

/* undo: drop policy mat_room_read / mat_room_insert / "opil files room read" / "opil files room write";
   re-create mat_read and mat_cohort_insert from 0045; alter table public.ea_rooms drop column warmup_q,
   next_title, next_at; re-run 0038's ea_room_state. */
select 'ht room features ready' as status;
```

- [ ] **Step 4: Run the contract test**

Run: `node --test tests/ht/migration-0054.test.mjs 2>&1 | tail -5`
Expected: `# pass 5`, `# fail 0`. (If the fourth test's regex on `mat_read` does not match, the policy text drifted — fix the SQL, not the test.)

- [ ] **Step 5: Write the apply script (the 0052 shape)**

```bash
#!/usr/bin/env bash
# Apply migration 0054 (HT room features: Files for room keys + the storage room prefix, ea_rooms.warmup_q /
# next_title / next_at, ea_room_state returns them). Run BEFORE the client that uses them goes out.
# Nelson runs it from the repo root:   ! bash scripts/apply-0054.sh
# Safe to re-run. Token: the Supabase CLI login in the macOS keychain. curl only. Prints no secrets.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0054_ht_room_features.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
jq -Rs '{query: .}' < "$MIG" > "$TMP/body.json"
echo "== apply supabase/migrations/0054_ht_room_features.sql → $REF"
code=$(curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/body.json")
echo "HTTP $code"; cat "$TMP/out.json"; echo
case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code)"; exit 1;; esac
jq -e '.[0].status == "ht room features ready"' "$TMP/out.json" >/dev/null || { echo "APPLY FAILED — the last statement did not return 'ht room features ready'"; exit 1; }
echo "== check: columns, policies, and the state function"
jq -Rs '{query: .}' <<< "select (select count(*) from information_schema.columns where table_schema='public' and table_name='ea_rooms' and column_name in ('warmup_q','next_title','next_at')) as room_columns, (select count(*) from pg_policies where tablename='ea_opil_materials' and policyname in ('mat_room_read','mat_room_insert')) as material_policies, (select count(*) from pg_policies where tablename='objects' and policyname in ('opil files room read','opil files room write')) as storage_policies, (select public.ea_room_state(null, 'ht') ? 'next_at') as state_has_next;" > "$TMP/chk.json"
curl -sS -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/chk.json"; echo
echo "Expect room_columns 3, material_policies 2, storage_policies 2, state_has_next true. 0054 applied."
```

Then: `chmod +x scripts/apply-0054.sh && cp scripts/apply-0054.sh ~/Downloads/apply-0054.sh` (a copy in Downloads survives a reboot; the repo copy is the one he runs: `! bash scripts/apply-0054.sh`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0054_ht_room_features.sql scripts/apply-0054.sh tests/ht/migration-0054.test.mjs
git commit -m "feat(ht): 0054 — Files for room keys (materials + a storage room prefix), ea_rooms.warmup_q / next_title / next_at, ea_room_state returns them; apply script with a verify block

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Files in a room — the tab, the button, the stage overlay, Whiteboard → Save to Files

**Files:**
- Modify: `opil/hub/live-rooms.js:347-351` (`storagePath` gains a room prefix)
- Modify: `js/rtk-room-v2.js:672,679,691,942-946` (the four `isRoom` gates + `createResources` for rooms)
- Modify: `js/rtk-resources.js:16-20,96` (room keys: "everyone in the room", the path with the prefix)
- Modify: `js/rtk-board.js:594-606` (save into the room's key)
- Test: `tests/opil/live-rooms.test.mjs`, `tests/ht/harness/room-v2-real.mjs` (new scenario R4)

**Interfaces:**
- Consumes: 0054's policies (Task 2) at runtime; `ctx.target` (`{ kind:'room', id, … }`) and `ctx.isRoom` from the plugin host (already passed).
- Produces: `storagePath(uid, name, stamp, roomKey?)` → `materials/<uid>/room/<uuid>/<stamp>-<clean>` when `roomKey` starts with `room:`; unchanged otherwise.

- [ ] **Step 1: Write the failing test for `storagePath`**

Append to `tests/opil/live-rooms.test.mjs` (it already imports from `../../opil/hub/live-rooms.js`; add `storagePath` to that import if it is not there):

```js
test('storagePath: a room key files the bytes under the room prefix, everything else as before', () => {
  assert.equal(storagePath('u1', 'Deck.pdf', 'abc'), 'materials/u1/abc-Deck.pdf');
  assert.equal(storagePath('u1', 'Deck.pdf', 'abc', 'team:t9'), 'materials/u1/abc-Deck.pdf');   /* teams keep the flat path (0045's honest limit, unchanged) */
  assert.equal(storagePath('u1', 'Deck.pdf', 'abc', 'room:5d2f'), 'materials/u1/room/5d2f/abc-Deck.pdf');
  assert.equal(storagePath('u1', 'Deck.pdf', 'abc', 'room:../x'), 'materials/u1/abc-Deck.pdf', 'a key that is not a uuid-ish id never makes a path');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/opil/live-rooms.test.mjs 2>&1 | grep -A3 "storagePath: a room"`
Expected: FAIL — `'materials/u1/abc-Deck.pdf' !== 'materials/u1/room/5d2f/abc-Deck.pdf'`.

- [ ] **Step 3: Implement `storagePath`**

Replace lines 347–351 of `opil/hub/live-rooms.js`:

```js
/* the storage path: materials/<uploader>/<stamp>-<clean name> — inside the folder the cohort may read.
   A room's file (key 'room:<uuid>') goes under materials/<uploader>/room/<uuid>/ — the prefix 0054's storage
   policies scope to that room (read = in the room, write = a host), because an HT guest is not in any cohort. */
export function storagePath(uid, name, stamp, roomKey) {
  const clean = String(name || 'file').normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
  const m = /^room:([A-Za-z0-9-]{4,64})$/.exec(String(roomKey || ''));
  return 'materials/' + uid + '/' + (m ? 'room/' + m[1] + '/' : '') + stamp + '-' + clean;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `node --test tests/opil/live-rooms.test.mjs 2>&1 | tail -4`
Expected: `# fail 0`.

- [ ] **Step 5: Open the room gates in `js/rtk-room-v2.js`**

Line 672: `${isRoom ? '' : '<button type="button" class="r2-tab" data-tab="files">Files <em></em></button>'}` → `<button type="button" class="r2-tab" data-tab="files">Files <em></em></button>`
Line 679: `${isRoom ? '' : '<div class="r2-pane" data-pane="files" hidden><div class="r2-files"></div></div>'}` → `<div class="r2-pane" data-pane="files" hidden><div class="r2-files"></div></div>`
Line 691: `${isRoom ? '' : '<button type="button" class="r2-btn r2-files-btn">Files</button>'}` → `<button type="button" class="r2-btn r2-files-btn">Files</button>`
Lines 941–946 become:

```js
  /* Files for the class: the Files tab and the stage overlay. OPIL sessions scope by session number, a team
     room and an ea_rooms room (HT, the Academy) by their class key — 0045 for teams, 0054 for rooms. */
  if (resMod && q('.r2-files')) {
    try {
      const filesKey = isRoom ? 'room:' + handsAt.val : handsAt.off ? 'team:' + handsAt.team : null;
      res = resMod.createResources({ sb, copy, el, esc, sessionNo: handsAt.val, roomKey: filesKey, uid, host, getMeeting: () => m, toast, paneEl: q('.r2-files'), stageEl: q('.r2-show'), countEl: q('.r2-tab[data-tab="files"] em'), onShow: (title) => { try { hooks.emit('file', title); } catch (e) {} }, getPlugins: () => hooks.plugins || [] });
    } catch (e) { res = null; }
  }
```

Check what `handsAt.val` is for a room: `grep -n "const hands = isRoom" -A 4 js/rtk-room-v2.js` — it must be the room's uuid (`target.id`). If it is, `filesKey` above is right; if `hands` carries something else for rooms, use `'room:' + target.id` (the `target` const is in scope in `mountRoomV2`; `classRoom` receives `hands` — pass `filesKey` in as a new option `filesKey` from `mountRoomV2` instead: add `filesKey: isRoom ? 'room:' + target.id : null` to the `classRoom({...})` call at line 336 and to its parameter list at 636, then use `filesKey || (handsAt.off ? 'team:' + handsAt.team : null)`).

- [ ] **Step 6: Room keys in `js/rtk-resources.js`**

Line 20: `const forWhom = roomKey && roomKey.startsWith('team:') ? 'your team' : 'everyone in the class';` → `const forWhom = roomKey && roomKey.startsWith('team:') ? 'your team' : roomKey && roomKey.startsWith('room:') ? 'everyone in the room' : 'everyone in the class';`
Line 91: `const path = copy.storagePath(uid, file.name, Date.now().toString(36));` → `const path = copy.storagePath(uid, file.name, Date.now().toString(36), roomKey);`

- [ ] **Step 7: Whiteboard → Save to Files in a room (`js/rtk-board.js`)**

Replace the guard at line 596 and the path/insert at 603–605:

```js
    const roomKey = ctx.isRoom && ctx.target && ctx.target.id ? 'room:' + ctx.target.id : null;
    if (!roomKey && (!ctx.session || ctx.session.no == null)) { toast('Saving to Files needs a class session — this room has none. Take a screenshot to keep it.', 7000); return; }
```
and
```js
      const path = roomKey ? 'materials/' + uid + '/room/' + ctx.target.id + '/' + now().toString(36) + '-Whiteboard.png' : 'materials/' + uid + '/' + now().toString(36) + '-Whiteboard.png';
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false });
      if (up.error) throw up.error;
      const ins = await sb.from('ea_opil_materials').insert(roomKey ? { room_key: roomKey, kind: 'resource', title, file_path: path, uploaded_by: uid } : { session_no: ctx.session.no, kind: 'resource', title, file_path: path, uploaded_by: uid });
```
Also the toast line 607: `'Saved to Files as “' + title + '” — everyone in the class can download it.'` → `'Saved to Files as “' + title + '” — everyone in the ' + (roomKey ? 'room' : 'class') + ' can download it.'`

- [ ] **Step 8: Harness scenario R4 — the Files button exists in a room-kind mount**

In `tests/ht/harness/room-v2-real.mjs`, find the scenario that mounts the real module with `target: { kind: 'room', … }` (R1) and add, after its mount resolves as joined:

```js
  /* R4 the room has Files (0054): the tab, the pane, the bar button — for a room-kind target, host or guest */
  {
    const p = await mountReal({ host: false });   /* reuse R1's mount helper name — read the file; it is the function that builds the page and awaits mountRoomV2 */
    const files = await p.evaluate(() => ({ tab: !!document.querySelector('.r2-tab[data-tab="files"]'), pane: !!document.querySelector('.r2-pane[data-pane="files"] .r2-files'), btn: !!document.querySelector('.r2-files-btn') }));
    ok('R4 a room shows Files (tab, pane, bar button)', files.tab && files.pane && files.btn, JSON.stringify(files));
    await p.close();
  }
```
If R1's helper has a different name, use it; the assertion is the deliverable.

- [ ] **Step 9: Run the harness + suites**

Run: `node ht/build.mjs && node --test tests/ht/*.test.mjs tests/opil/*.test.mjs 2>&1 | tail -4 && node tests/ht/harness/ht-room.mjs 2>&1 | grep -E "^FAIL|R4"`
Expected: `# fail 0`; `OK   R4 …`; no `FAIL` lines.

- [ ] **Step 10: Commit**

```bash
git add opil/hub/live-rooms.js js/rtk-room-v2.js js/rtk-resources.js js/rtk-board.js tests/opil/live-rooms.test.mjs tests/ht/harness/room-v2-real.mjs ht/hub
git commit -m "feat(room): Files in an ea_rooms room — the tab, the button, the stage overlay and Whiteboard → Save to Files work in HT's room under its class key (room prefix in storage, 0054)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Warm-up question per room + Next session with Add to calendar

**Files:**
- Modify: `js/rtk-warmup.js:195-270,300-360` (read the question from a room; a host changes it on `ea_rooms`)
- Modify: `js/rtk-room-v2.js:219` (`mountWaiting` gets `room`)
- Modify: `ht/hub/room-words.js` (pure: `nextSessionLine`, `calendarLinks`)
- Modify: `ht/hub/room.js:113,190-210,232-238` (state → target; host card fields; the Next session line for everyone)
- Modify: `ht/hub/room.css` (the `.ht-room-next` line)
- Test: `tests/ht/room-words.test.mjs`, `tests/ht/harness/ht-room.mjs` (scenarios 9a–9c), `tests/opil/warmup.test.mjs`

**Interfaces:**
- Consumes: `state.warmup_q`, `state.next_title`, `state.next_at` (Task 2); `ctx.target` in plugins.
- Produces: `nextSessionLine(state, nowMs)` → `{ title, when, iso } | null`; `calendarLinks({ title, startIso, roomUrl, minutes = 60 })` → `{ google, outlook, ics }` (ics = a `data:text/calendar` URL); `target.warmup_q` on the HT target.

- [ ] **Step 1: Failing tests for the pure helpers**

Append to `tests/ht/room-words.test.mjs` (extend its import from `../../ht/hub/room-words.js` with `nextSessionLine, calendarLinks`):

```js
test('nextSessionLine: nothing, past, and a session ahead', () => {
  const now = Date.parse('2026-10-01T12:00:00-05:00');
  assert.equal(nextSessionLine({}, now), null);
  assert.equal(nextSessionLine({ next_title: 'Fall Briefing', next_at: '2026-09-01T17:00:00+00:00' }, now), null, 'a past session is not next');
  const n = nextSessionLine({ next_title: 'Fall Briefing', next_at: '2026-10-08T17:00:00+00:00' }, now);
  assert.equal(n.title, 'Fall Briefing');
  assert.equal(n.iso, '2026-10-08T17:00:00.000Z');
  assert.match(n.when, /^Thu, Oct 8 · 12:00 PM CT$/);
  assert.equal(nextSessionLine({ next_title: '', next_at: '2026-10-08T17:00:00+00:00' }, now).title, 'HT Live', 'no title → the room name');
});
test('calendarLinks: Google, Outlook and an .ics carry the title, the hour and the room link', () => {
  const l = calendarLinks({ title: 'Fall Briefing', startIso: '2026-10-08T17:00:00.000Z', roomUrl: 'https://taylormadeacademy.com/ht/hub/live/' });
  assert.match(l.google, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=Fall%20Briefing&dates=20261008T170000Z%2F20261008T180000Z&details=.*ht%2Fhub%2Flive/);
  assert.match(l.outlook, /^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose\?.*startdt=2026-10-08T17%3A00%3A00\.000Z.*enddt=2026-10-08T18%3A00%3A00\.000Z/);
  assert.match(l.ics, /^data:text\/calendar;charset=utf-8,/);
  const ics = decodeURIComponent(l.ics.split(',')[1]);
  assert.match(ics, /BEGIN:VEVENT\r\nDTSTART:20261008T170000Z\r\nDTEND:20261008T180000Z\r\nSUMMARY:Fall Briefing\r\nDESCRIPTION:Join at https:\/\/taylormadeacademy\.com\/ht\/hub\/live\/\r\nURL:https:\/\/taylormadeacademy\.com\/ht\/hub\/live\/\r\nEND:VEVENT/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/ht/room-words.test.mjs 2>&1 | grep -E "not ok|fail"`
Expected: both new tests `not ok` (`nextSessionLine is not a function`).

- [ ] **Step 3: Implement the helpers in `ht/hub/room-words.js`**

Append:

```js
/* ---------- Next session (spec 2026-09-17 §2.4) ---------- */
/* what the Live space says above the room: the host's next session when it is ahead of now; null otherwise */
export function nextSessionLine(state, nowMs) {
  const at = state && state.next_at ? Date.parse(state.next_at) : NaN;
  if (!Number.isFinite(at) || at <= nowMs) return null;
  const d = new Date(at);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
  return { title: (state.next_title || '').trim() || (state.title || 'HT Live'), when: day + ' · ' + time + ' CT', iso: d.toISOString() };
}
const icsStamp = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/* three ways onto a calendar; nothing here emails anyone */
export function calendarLinks({ title, startIso, roomUrl, minutes = 60 }) {
  const start = new Date(startIso), end = new Date(start.getTime() + minutes * 60000);
  const s = start.toISOString(), e = end.toISOString();
  const details = 'Join at ' + roomUrl;
  const google = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + encodeURIComponent(icsStamp(s) + '/' + icsStamp(e)) + '&details=' + encodeURIComponent(details) + '&location=' + encodeURIComponent(roomUrl);
  const outlook = 'https://outlook.live.com/calendar/0/deeplink/compose?subject=' + encodeURIComponent(title) + '&startdt=' + encodeURIComponent(s) + '&enddt=' + encodeURIComponent(e) + '&body=' + encodeURIComponent(details) + '&location=' + encodeURIComponent(roomUrl) + '&path=%2Fcalendar%2Faction%2Fcompose&rru=addevent';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Taylormade Academy//HT Hub//EN', 'BEGIN:VEVENT', 'UID:' + icsStamp(s) + '@taylormadeacademy.com', 'DTSTAMP:' + icsStamp(new Date().toISOString()), 'DTSTART:' + icsStamp(s), 'DTEND:' + icsStamp(e), 'SUMMARY:' + icsText(title), 'DESCRIPTION:' + icsText(details), 'URL:' + roomUrl, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return { google, outlook, ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
}
```
(`DTSTAMP` varies — the test matches only from `BEGIN:VEVENT`'s `DTSTART` on, which is why UID/DTSTAMP come first.)

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/ht/room-words.test.mjs 2>&1 | tail -4`
Expected: `# fail 0`.

- [ ] **Step 5: The warm-up question from a room (`js/rtk-warmup.js`)**

`mountWaiting({ …, session, room, container, now })` — add `room` to the destructured options at line 195 and:
- line 199: `let question = questionOf(session || room), …`
- the refresh block at 260–266 becomes:
```js
    if (session && session.no != null) {
      try {
        const { data } = await sb.from('ea_opil_sessions').select('warmup_q').eq('no', session.no).limit(1);
        const fresh = questionOf(data && data[0]);
        if (fresh !== question) { question = fresh; q('.r2-warm-q').textContent = question; }
      } catch (e) {}
    } else if (room && room.slug) {
      /* a room's question rides on ea_room_state (a guest cannot select ea_rooms) */
      try {
        const { data } = await sb.rpc('ea_room_state', { p_key: room.key || null, p_slug: room.slug });
        const fresh = questionOf(data);
        if (fresh !== question) { question = fresh; q('.r2-warm-q').textContent = question; }
      } catch (e) {}
    }
```
In `create(ctx)` (line 304): `const { sb, el, esc, host, roomKey, session } = ctx;` → `const { sb, el, esc, host, roomKey, session, target } = ctx; const room = !session && target && target.kind === 'room' ? target : null;` and `question = questionOf(session || room)`.
Line 331: the "Change the question" button shows for `host && (session || room)`.
The save at 348–350 becomes:
```js
        const { data, error } = room
          ? await sb.from('ea_rooms').update({ warmup_q: v || null }).eq('id', room.id).select('id')
          : await sb.from('ea_opil_sessions').update({ warmup_q: v || null }).eq('no', session.no).select('no');
```
(the `changedRows` guard stays: `ea_rooms`' update policy filters to zero rows for a non-host).
The not-host toast copy (356): for a room say `'The question didn’t save — you’re no longer a host of this room.'` (no coordinator, no sessions page).

- [ ] **Step 6: Pass `room` from the room module (`js/rtk-room-v2.js:219`)**

`session: isRoom ? null : session,` → `session: isRoom ? null : session, room: isRoom ? target : null,` — `target` for HT carries `slug`, `key`, `id`, `warmup_q` (next step).

- [ ] **Step 7: The HT target and host card (`ht/hub/room.js`)**

Line 113, add `warmup_q: state.warmup_q` to the target object.

Host card (`render()`): after the Title / Host name row add a second row:
```js
  <div class="row two"><label>Warm-up question <span class="saved" id="rmWarmSaved"></span><input id="rmWarm" maxlength="160" placeholder="Where are you joining from today?" value="${esc(r.warmup_q || '')}"></label><label>Next session <span class="saved" id="rmNextSaved"></span><span class="row" style="gap:6px"><input id="rmNextTitle" maxlength="120" placeholder="Title" value="${esc(r.next_title || '')}"><input id="rmNextAt" type="datetime-local" value="${esc(localInput(r.next_at))}"></span></label></div>
```
with a module-level helper: `const localInput = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };`
`load()` selects `…,recording_url,warmup_q,next_title,next_at`. Register the elements (`warm`, `nextTitle`, `nextAt`) in `this.els`.
Wiring: the existing `saveField` returns the input's old value on empty — these three may be cleared, so add beside it:
```js
    const saveNullable = (input, savedEl, col, toValue) => input.addEventListener('change', async () => {
      const v = toValue ? toValue(input.value) : (input.value.trim() || null);
      if (v === undefined) { savedEl.textContent = 'not saved'; return; }
      const { error } = await sb.from('ea_rooms').update({ [col]: v }).eq('id', this.room.id);
      if (error) { savedEl.textContent = 'not saved'; return; }
      this.room[col] = v; state[col] = v; savedEl.textContent = 'Saved'; setTimeout(() => { savedEl.textContent = ''; }, 1800);
      paintNext();
    });
    saveNullable(e.warm, document.getElementById('rmWarmSaved'), 'warmup_q');
    saveNullable(e.nextTitle, document.getElementById('rmNextSaved'), 'next_title');
    saveNullable(e.nextAt, document.getElementById('rmNextSaved'), 'next_at', (s) => { if (!s) return null; const t = Date.parse(s); return Number.isFinite(t) ? new Date(t).toISOString() : undefined; });
```

The line everyone sees — a module-level function, called after every card render (host and guest) and by `saveNullable`:
```js
/* Next session, above whichever card is showing: the host's title and time, and three ways onto a calendar */
function paintNext() {
  let el = document.querySelector('.ht-room-next');
  const n = nextSessionLine(state, Date.now());
  if (!n) { if (el) el.remove(); return; }
  const l = calendarLinks({ title: n.title, startIso: n.iso, roomUrl: location.origin + '/ht/hub/live/' });
  if (!el) { el = document.createElement('div'); el.className = 'ht-room-next'; ctl.parentElement.insertBefore(el, ctl); }
  el.innerHTML = '<span class="k">Next session</span><b>' + esc(n.title) + '</b><span>' + esc(n.when) + '</span><span class="add">Add to calendar: <a href="' + esc(l.ics) + '" download="' + esc(n.title.replace(/[^\w\- ]+/g, '').trim() || 'HT Live') + '.ics">Apple</a> · <a href="' + esc(l.google) + '" target="_blank" rel="noopener">Google</a> · <a href="' + esc(l.outlook) + '" target="_blank" rel="noopener">Outlook</a></span>';
}
```
Import `nextSessionLine, calendarLinks` from `room-words.js` in the destructured import at the top. Call `paintNext()` once after the `switch (branch)` block runs its first card (end of the module) and inside `hostCard.render()` after `this.wire()`. It sits outside the room: `body.in-room .ht-room-next{display:none}` in `room.css`, plus:
```css
.ht-room-next{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:0 0 12px;padding:12px 16px;border:1px solid var(--ht-ember);border-radius:14px;background:#fff;font-size:14.5px}
.ht-room-next .k{font:700 11.5px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--ht-brick)}
.ht-room-next b{color:var(--ht-mahogany)}
.ht-room-next .add a{color:var(--ht-maroon);font-weight:600}
```
(Check `ht/hub/room.css` for the variable names it uses — `--ht-ember`, `--ht-brick`, `--ht-mahogany` are defined in `ht/ht.css`; if room.css uses its own names, use those.)

- [ ] **Step 8: Harness scenarios (stubbed, `tests/ht/harness/ht-room.mjs`)**

Extend `base` with `warmup_q: null, next_title: null, next_at: null` and `room` with the same three. Add:

```js
/* 9a the host card carries the warm-up question and Next session; a save writes the column (and only it) */
{
  const { p, errs } = await page({ state: { ...base, is_host: true }, room: { ...room }, session: sess, admin: true, replays: [], members: [], profiles: [] });
  await p.fill('#rmWarm', 'What brought you to the Hill?'); await p.dispatchEvent('#rmWarm', 'change');
  await p.fill('#rmNextTitle', 'Fall Briefing'); await p.dispatchEvent('#rmNextTitle', 'change');
  await p.fill('#rmNextAt', '2099-10-08T12:00'); await p.dispatchEvent('#rmNextAt', 'change');
  await p.waitForTimeout(150);
  const ups = await p.evaluate(() => window.__calls.filter(c => c[0] === 'from' && c[1] === 'ea_rooms' && c[2] === 'update').map(c => c[4]));
  ok('9a warm-up question saved as warmup_q', ups.some(u => u.warmup_q === 'What brought you to the Hill?'), JSON.stringify(ups));
  ok('9a next_title saved', ups.some(u => u.next_title === 'Fall Briefing'), JSON.stringify(ups));
  ok('9a next_at saved as an ISO instant', ups.some(u => typeof u.next_at === 'string' && /^2099-10-08T\d\d:00:00\.000Z$/.test(u.next_at)), JSON.stringify(ups));
  ok('9a the Next session line appears with three calendar links', await p.locator('.ht-room-next a').count() === 3, String(await p.locator('.ht-room-next a').count()));
  ok('9a no page errors', errs.length === 0, errs.join(' | '));
  await p.close();
}
/* 9b a guest sees the Next session line from the state, never a past one */
{
  const { p } = await page({ state: { ...base, next_title: 'Fall Briefing', next_at: '2099-10-08T17:00:00Z' }, room, session: sess, replays: [], members: [], profiles: [] });
  ok('9b guest: the line shows title and time', /Fall Briefing/.test(await text(p, '.ht-room-next')) && /Oct 8/.test(await text(p, '.ht-room-next')), await text(p, '.ht-room-next'));
  await p.close();
  const { p: p2 } = await page({ state: { ...base, next_title: 'Old', next_at: '2000-01-01T17:00:00Z' }, room, session: sess, replays: [], members: [], profiles: [] });
  ok('9b guest: a past next session is not shown', (await p2.locator('.ht-room-next').count()) === 0);
  await p2.close();
}
```
(The stub's `from().update().eq()` already records `['from','ea_rooms','update',filters,patch]`; `datetime-local` `fill` needs the `YYYY-MM-DDTHH:MM` form.)

- [ ] **Step 9: Run suites + harness**

Run: `node ht/build.mjs && node --test tests/ht/*.test.mjs tests/opil/*.test.mjs 2>&1 | tail -4 && node tests/ht/harness/ht-room.mjs 2>&1 | grep -E "^FAIL|9a|9b"`
Expected: `# fail 0`; all `9a`/`9b` lines `OK`; no `FAIL`.

- [ ] **Step 10: Commit**

```bash
git add js/rtk-warmup.js js/rtk-room-v2.js ht/hub/room-words.js ht/hub/room.js ht/hub/room.css tests/ht/room-words.test.mjs tests/ht/harness/ht-room.mjs ht/hub
git commit -m "feat(ht): a warm-up question per room (host sets it on the card or in the room; the waiting screen follows) and Next session with Add to calendar (Apple / Google / Outlook) above HT's room; ea_room_state carries both (0054)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The replay page — `/ht/hub/replay/` (chapters, summary, assigned, files, transcript), Publish makes the summary

**Files:**
- Modify: `ht/hub/data.js` (`HT.pages = ['replay']`)
- Create: `ht/hub/data/replay.js` (the page's space: `tab: 'live'`, one `replay` block)
- Modify: `ht/hub/ht.js` (`R.replay`, `tabsHtml` honours `space.tab`, `wire()` imports `replay.js`, `render()` head uses `space.tab`)
- Modify: `ht/build.mjs` (shells for `HT.pages`; stamp inputs gain `replay.js`, `js/rtk-chapters.js`, `css/rtk-chapters.css`)
- Create: `ht/hub/replay.js` (the port)
- Modify: `ht/hub/room.js` (`lastSession()` links to the page; Publish → `ea-class-summary`)
- Test: `tests/ht/harness/ht-room.mjs` (scenario 10), `tests/ht/harness/stub-supabase.js` (class tables)

**Interfaces:**
- Consumes: `ea_room_state(null,'ht')` → `{ id, title, is_host, recording_url }`; hosts: `ea_room_replays` rows (`room_replays_admin_read`); `ea_class_events` / `ea_class_summaries` / `ea_class_transcripts` / `ea_opil_materials` by `room_key = 'room:' + id`; the pure helpers of `js/rtk-chapters.js`; `iframeUrl` from `js/room-page.js`.
- Produces: the page at `/ht/hub/replay/`; the summary request on Publish.

- [ ] **Step 1: The page's data and the block renderer**

`ht/hub/data.js`, after `HT.order = […];` add: `HT.pages = ['replay'];   /* shells that exist but are not tabs */`

`ht/hub/data/replay.js`:
```js
/* The HT Hub — the replay page for the live room (REAL: ht/hub/replay.js reads the last session's chapters,
   summary, files and transcript). Not a tab: HT.pages lists it; the Live tab stays current here. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.replay = {
  key: 'replay', tab: 'live', title: 'Replay', office: 'The live room · the last session', icon: 'play',
  sub: 'The recording, with clickable chapters, a five-line summary, what was assigned, the files shown, and a searchable transcript.',
  stamp: 'Real · from the last session', headCta: { label: 'Back to the room', href: '/ht/hub/live/', style: 'ht-line' },
  blocks: [ { type: 'replay', id: 'replay' } ]
};
```

`ht/hub/ht.js`:
- `R.replay = function (b) { return '<div class="ht-replay" id="htReplay"><p class="ht-room-loading">Finding the replay&hellip;</p></div>'; };`
- `tabsHtml(active)` and `render(key)`: compute `var tabKey = space.tab || key;` in `render` and pass `tabsHtml(tabKey)` (the `home` check stays on `key`).
- in `wire(root, space)`, beside the `room` import (line ~430): `if (root.querySelector('#htReplay')) import('/ht/hub/replay.js' + V).catch(function (e) { var n = root.querySelector('#htReplay .ht-room-loading'); if (n) n.textContent = 'The replay page could not load. Reload to try again.'; console.warn('[ht] replay', e); });`

`ht/build.mjs`: after the `for (const k of order)` loop add the same loop over `global.HT.pages || []` (no `advancement` special case) so `data/replay.js` is bundled and `shell('replay', …)` is generated; add to the stamp `stampIn(path.join(HUB, 'replay.js'))`, `stampIn(path.join(ROOT, '..', 'css', 'rtk-chapters.css'))`, and every plugin module the room loads for HT (spec §2.5) — `for (const n of ['presence','reactions','warmup','roster','help','chapters','board','resources','small-groups']) h.update(stampIn(path.join(ROOT, '..', 'js', 'rtk-' + n + '.js')));` plus `css/rtk-{reactions,warmup,roster,board,help}.css` the same way (restructure the `createHash` chain into `const h = createHash('sha1'); h.update(…); … const V = h.digest('hex').slice(0, 8);`).

- [ ] **Step 2: The port — `ht/hub/replay.js`**

```js
/* ht/hub/replay.js — the HT replay page: the last session of HT's room with chapters, the summary, what was
   assigned, the files shown, and the transcript. A port of /opil/hub/replay/ onto the HT frame reading the
   same ea_class_* tables under the room's class key 'room:<id>' (spec 2026-09-17 §2.2). Hosts see the newest
   ready replay (a draft); everyone else the published one, and only if they were in the room (ea_room_state
   hands recording_url to hosts and past joiners only). */
const SLUG = 'ht';
const V = new URL(import.meta.url).search;
await new Promise((res) => { if (document.querySelector('link[href^="/css/rtk-chapters.css"]')) return res(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/rtk-chapters.css' + V; l.onload = res; l.onerror = res; document.head.appendChild(l); });
const [{ chapterOffsets, chapterAt, durationWord, transcriptOffsets, transcriptSearch, searchCopy, transcriptText, transcriptGateCopy, markText, loadAllRows, summaryLines, assignmentList, summaryErrorCopy, summaryStateCopy, pickReplay, replayPlayerSrc, STREAM_SDK, STREAM_SDK_WAIT_MS }, { iframeUrl }, { createClient }] = await Promise.all([
  import('/js/rtk-chapters.js' + V), import('/js/room-page.js' + V), import('https://esm.sh/@supabase/supabase-js@2'),
]);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const root = document.getElementById('htReplay'); if (!root || !window.BM_CONFIG) throw new Error('replay block or config missing');
const sb = createClient(window.BM_CONFIG.SUPABASE_URL, window.BM_CONFIG.SUPABASE_KEY);
const user = (await sb.auth.getSession()).data.session?.user || null;
const { data: state } = await sb.rpc('ea_room_state', { p_key: null, p_slug: SLUG });

root.innerHTML = `<div class="rp-grid">
  <div><div class="rp-player" id="player"><div class="rp-idle" id="idle"><b>Finding the replay&hellip;</b><span>One moment.</span></div></div><p class="rp-now" id="now"></p><p class="rp-fine" id="msg" role="status" hidden></p></div>
  <div class="hc" id="lesson"><div class="rp-tabs" role="tablist">
    <button type="button" class="rp-tab on" data-tab="chapters" role="tab">Chapters <em id="nChap"></em></button>
    <button type="button" class="rp-tab" data-tab="summary" role="tab">Summary</button>
    <button type="button" class="rp-tab" data-tab="assigned" role="tab">Assigned <em id="nAsg"></em></button>
    <button type="button" class="rp-tab" data-tab="files" role="tab">Files <em id="nFiles"></em></button>
    <button type="button" class="rp-tab" data-tab="transcript" role="tab">Transcript <em id="nLines"></em></button>
  </div>
  <div class="rp-pane" data-pane="chapters"><div class="rp-empty">Loading the chapters&hellip;</div></div>
  <div class="rp-pane" data-pane="summary" hidden><div class="rp-empty">Loading the summary&hellip;</div></div>
  <div class="rp-pane" data-pane="assigned" hidden><div class="rp-empty">Loading&hellip;</div></div>
  <div class="rp-pane" data-pane="files" hidden><div class="rp-empty">Loading the files&hellip;</div></div>
  <div class="rp-pane" data-pane="transcript" hidden><div class="rp-empty">Loading the transcript&hellip;</div></div>
</div></div>`;
const q = (s) => root.querySelector(s), $ = (id) => document.getElementById(id), pane = (n) => q(`.rp-pane[data-pane="${n}"]`);
const toast = (m, ms = 6000) => { const e = $('msg'); e.textContent = m; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, ms); };
root.querySelectorAll('.rp-tab').forEach((t) => t.addEventListener('click', () => showPane(t.dataset.tab)));
function showPane(name) { root.querySelectorAll('.rp-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name)); root.querySelectorAll('.rp-pane').forEach((p) => { p.hidden = p.dataset.pane !== name; }); }

/* who may see what */
if (!state || !state.id) { $('idle').innerHTML = '<b>No room</b><span>The HT room is not set up on this site.</span>'; throw new Error('no room');
}
if (!user) { $('idle').innerHTML = `<b>Sign in to watch the replay</b><span>Use the email you joined with — a six-digit code, no password.</span><a class="btn ht-gold" style="margin-top:14px" href="/login/?next=${encodeURIComponent('/ht/hub/replay/')}">Sign in</a>`; throw new Error('signed out'); }
const key = 'room:' + state.id, staff = !!state.is_host;
let replay = null;
if (staff) {
  const { data } = await sb.from('ea_room_replays').select('id, status, stream_uid, watch_url, duration_s, published, created_at').eq('room_id', state.id).order('created_at', { ascending: false });
  replay = pickReplay(data || []);
} else if (state.recording_url) {
  replay = { watch_url: state.recording_url, published: true, created_at: null, duration_s: null };   /* a past joiner: the published one, through the state */
}
if (!replay) {
  $('idle').innerHTML = `<b>${staff ? 'No replay yet' : 'Nothing published yet'}</b><span>${staff ? 'A session records itself; its replay lands on the Live space to review and publish, and here with its chapters.' : 'When your host publishes the last session it shows here, with its chapters and summary.'}</span>`;
}

/* the lesson rows, loading while the player sets up. A guest's replay has no created_at; the summary row's
   chapters carry the offsets in that case (ea-class-summary stores them), else the events line up from the
   newest replay's start — which the transcript_can rule lets a past joiner read. */
const startedAt = replay && replay.created_at ? replay.created_at : null;
const lessonLoad = Promise.all([
  sb.from('ea_class_events').select('id, at, kind, label, data').eq('room_key', key).order('at').order('id').limit(1000),
  sb.from('ea_class_summaries').select('summary, assignments, chapters, updated_at').eq('room_key', key).maybeSingle(),
  loadAllRows((from, to) => sb.from('ea_class_transcripts').select('id, at, speaker_name, text').eq('room_key', key).order('at').order('id').range(from, to)),
  sb.from('ea_opil_materials').select('id, title, kind, link_url, file_path, created_at').eq('room_key', key).order('created_at'),
  staff ? Promise.resolve({ data: null }) : sb.from('ea_room_replays').select('created_at, duration_s').eq('room_id', state.id).eq('published', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
]);

/* the player */
let player = null, iframe = null, seekReady = false;
const playerSrc = replay ? (replayPlayerSrc(replay) || iframeUrl(replay.watch_url)) : null;
if (playerSrc) {
  iframe = document.createElement('iframe'); iframe.src = playerSrc + '?preload=metadata'; iframe.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;'; iframe.allowFullscreen = true; iframe.title = 'Replay of the last session';
  $('player').innerHTML = ''; $('player').appendChild(iframe);
  $('now').innerHTML = `<b>${esc(state.title || 'HT Live')}</b>${replay.duration_s ? ' · ' + esc(durationWord(replay.duration_s)) + ' long' : ''}${replay.published ? '' : ' <span class="rp-chip draft">Draft — only hosts see this until it is published</span>'}`;
  try {
    await new Promise((resolve, reject) => { const sc = document.createElement('script'); sc.src = STREAM_SDK; sc.onload = resolve; sc.onerror = () => reject(new Error('sdk failed to load')); setTimeout(() => reject(new Error('sdk took too long')), STREAM_SDK_WAIT_MS); document.head.appendChild(sc); });
    player = window.Stream(iframe); seekReady = true;
    player.addEventListener('timeupdate', () => { try { markPlaying(player.currentTime || 0); } catch (e) {} });
  } catch (e) { console.warn('[replay] player sdk', e); }
}
function seek(s) { s = Math.max(0, Math.floor(Number(s) || 0)); if (!iframe) return; if (seekReady && player) { try { player.currentTime = s; const p = player.play(); if (p && p.catch) p.catch(() => {}); return; } catch (e) {} } iframe.src = playerSrc + '?startTime=' + s + 's&autoplay=true'; }

const [ev, sm, tr, mt, pub] = await lessonLoad;
[ev, sm, tr, mt].forEach((r) => { if (r.error) console.warn('[replay] load', r.error.message || r.error); });
let summaryRow = sm.data || null;
const events = ev.data || [], transcriptRows = tr.rows || [], materials = mt.data || [];
const started = startedAt || (pub && pub.data && pub.data.created_at) || null;
if (replay && pub && pub.data && pub.data.duration_s && !replay.duration_s) $('now').innerHTML += ' · ' + esc(durationWord(pub.data.duration_s)) + ' long';

/* chapters */
const chapters = chapterOffsets(events, started, { duration: replay && replay.duration_s });
$('nChap').textContent = chapters.length || '';
function paintChapters() {
  const p = pane('chapters');
  if (!chapters.length) { p.innerHTML = `<div class="rp-empty">${started ? 'No chapters were logged for this session — the timeline fills in when someone is brought on stage, a file is shown, small groups open, or a poll runs.' : 'The chapters line up once a replay is ready.'}</div>`; return; }
  p.innerHTML = chapters.map((c, i) => `<button type="button" class="rp-chapter" data-i="${i}" data-off="${c.offset}"><span class="rp-clock">${esc(c.clock)}</span><span><b>${esc(c.label)}</b></span></button>`).join('');
  p.querySelectorAll('.rp-chapter').forEach((b) => b.addEventListener('click', () => { seek(b.dataset.off); p.querySelectorAll('.rp-chapter').forEach((x) => x.classList.toggle('on', x === b)); }));
}
function markPlaying(t) { const i = chapterAt(chapters, t); pane('chapters').querySelectorAll('.rp-chapter').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i)); }
paintChapters();

/* summary + assigned (hosts may make it; the function answers room keys) */
let busy = false;
function paintSummary() {
  const p = pane('summary'), a = pane('assigned');
  const lines = summaryRow ? summaryLines(summaryRow.summary) : [];
  const todo = summaryRow ? assignmentList(summaryRow.assignments) : [];
  $('nAsg').textContent = todo.length || '';
  const madeOn = summaryRow && summaryRow.updated_at ? new Date(summaryRow.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  const st = summaryStateCopy({ row: summaryRow, staff, busy });
  p.innerHTML = (lines.length ? `<ul class="rp-lines">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p class="rp-fine">Written from the transcript and the chapters${madeOn ? ' on ' + esc(madeOn) : ''}. Read it as notes, not as the record.</p>` : `<div class="rp-empty">${esc(st)}</div>`)
    + (staff ? `<button type="button" class="rp-make${lines.length ? ' quiet' : ''}" id="make"${busy ? ' disabled' : ''}>${busy ? 'Writing the summary…' : (lines.length ? 'Make it again' : 'Make summary')}</button><p class="rp-fine" id="mkErr" hidden></p>` : '');
  a.innerHTML = todo.length ? `<ul class="rp-lines rp-todo">${todo.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : `<div class="rp-empty">${summaryRow ? 'Nothing was assigned in this session.' : 'What was assigned shows up here with the summary.'}</div>`;
  const mk = $('make'); if (mk) mk.addEventListener('click', makeSummary);
}
async function makeSummary() {
  if (busy) return; busy = true; paintSummary();
  try {
    const tok = (await sb.auth.getSession()).data.session?.access_token || '';
    const r = await fetch(window.BM_CONFIG.FUNCTIONS_BASE + '/ea-class-summary', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ room_key: key }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(summaryErrorCopy(d.error || (r.status === 401 ? 'sign_in' : '')));
    summaryRow = { summary: d.summary, assignments: d.assignments, chapters: d.chapters, updated_at: new Date().toISOString() };
    busy = false; paintSummary(); showPane('summary');
  } catch (e) { busy = false; paintSummary(); const err = $('mkErr'); if (err) { err.textContent = e.message || summaryErrorCopy(''); err.hidden = false; } }
}
paintSummary();

/* files: the room's materials, a short signed link each */
function paintFiles() {
  const p = pane('files'); $('nFiles').textContent = materials.length || '';
  if (!materials.length) { p.innerHTML = '<div class="rp-empty">No files were shown in this session. Files a host adds in the room land here.</div>'; return; }
  p.innerHTML = materials.map((m) => `<div class="rp-file"><span class="rp-kindtag">${esc(m.kind || 'file')}</span>${m.link_url ? `<a href="${esc(m.link_url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : `<a href="#" data-matfile="${esc(m.file_path)}">${esc(m.title)}</a>`}</div>`).join('');
  p.querySelectorAll('[data-matfile]').forEach((a) => a.addEventListener('click', async (ev2) => { ev2.preventDefault(); const { data, error } = await sb.storage.from('opil-files').createSignedUrl(a.dataset.matfile, 300); if (error || !data || !data.signedUrl) { toast('That file could not be opened right now. Try again in a moment.'); return; } window.open(data.signedUrl, '_blank'); }));
}
paintFiles();

/* transcript: search, tap to jump, download */
const lines = transcriptOffsets(transcriptRows, started);
$('nLines').textContent = lines.length || '';
function paintTranscript() {
  const p = pane('transcript');
  const gate = transcriptGateCopy({ open: true, lines: lines.length, failed: !!tr.error });
  if (gate) { p.innerHTML = `<div class="rp-empty">${esc(gate)}</div>`; return; }
  p.innerHTML = `<div class="rp-search"><input type="search" id="tq" placeholder="Search what was said" autocomplete="off" aria-label="Search the transcript"><button type="button" id="tdl">Download</button></div><p class="rp-count" id="tcount"></p><div id="tlist"></div>`;
  const input = $('tq'), list = $('tlist'), count = $('tcount');
  const draw = () => {
    const needle = input.value.trim(); const hits = transcriptSearch(lines, needle); count.textContent = searchCopy(hits.length, needle, lines.length);
    const mark = (s) => markText(s, needle).map((x) => x.hit ? '<mark>' + esc(x.text) + '</mark>' : esc(x.text)).join('');
    list.innerHTML = hits.slice(0, 600).map((l) => `<button type="button" class="rp-tline" data-off="${l.offset == null ? '' : l.offset}"><span class="rp-clock">${esc(l.clock)}</span><b>${esc(l.speaker)}</b><span class="rp-text">${mark(l.text)}</span></button>`).join('') + (hits.length > 600 ? '<div class="rp-empty">Showing the first 600 lines — search to narrow it.</div>' : '');
    list.querySelectorAll('.rp-tline').forEach((b) => b.addEventListener('click', () => { if (b.dataset.off !== '') seek(b.dataset.off); list.querySelectorAll('.rp-tline').forEach((x) => x.classList.toggle('on', x === b)); }));
  };
  let t = null; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 120); });
  $('tdl').addEventListener('click', () => { const title = (state.title || 'HT Live') + ' · last session'; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([transcriptText(lines, title)], { type: 'text/plain' })); a.download = ((state.title || 'HT Live').replace(/[^\w\- ]+/g, '').trim() || 'transcript') + ' transcript.txt'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); });
  draw();
}
paintTranscript();
```
Compare every helper name against `js/rtk-chapters.js`'s export list before running (they are the OPIL page's imports minus `replayMissingCopy`).

- [ ] **Step 3: Last session → the page, and Publish → the summary (`ht/hub/room.js`)**

`lastSession(st)`: append inside `.ht-room-last`, after the iframe's frame div: `'<p class="fine"><a href="/ht/hub/replay/">Chapters, summary and transcript &rarr;</a></p>'`.
In the Publish handler (line ~401), after a successful `ea_room_publish_replay` with `data-on === '1'`:
```js
        if (b.getAttribute('data-on') === '1') { try { fetch(window.BM_CONFIG.FUNCTIONS_BASE + '/ea-class-summary', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() }, body: JSON.stringify({ room_key: 'room:' + this.room.id }) }).catch(() => {}); } catch (e) {} }   /* Publish also writes the summary the replay page shows; its Make summary retries */
```

- [ ] **Step 4: Harness scenario 10 + stub tables**

`tests/ht/harness/stub-supabase.js`: in `from()`'s `then`, extend the rows map: `table === 'ea_class_events' ? window.__db.events || [] : table === 'ea_class_transcripts' ? window.__db.transcripts || [] : table === 'ea_opil_materials' ? window.__db.materials || [] : …`; add `range: () => chain` to the chain; `maybeSingle` returns `window.__db.summary || null` for `ea_class_summaries` and the newest `window.__db.replays` row for `ea_room_replays` when `q._f` carries `['published', true]`.
Scenario (page url `/ht/hub/replay/`, the shell exists after `node ht/build.mjs`):
```js
/* 10 the replay page: a host sees the draft with chapters, summary and transcript from the class tables */
{
  const t0 = '2026-09-16T18:00:00.000Z';
  const { p, errs } = await page({ state: { ...base, is_host: true, recording_url: null }, room, session: sess, admin: true, profiles: [], members: [],
    replays: [{ id: 'rp1', status: 'ready', watch_url: 'https://customer-x.cloudflarestream.com/abc123/watch', duration_s: 1800, published: false, created_at: t0 }],
    events: [{ id: 1, at: '2026-09-16T18:05:00.000Z', kind: 'stage', label: 'Imani on stage', data: null }, { id: 2, at: '2026-09-16T18:20:00.000Z', kind: 'file', label: 'Deck shown', data: null }],
    summary: { summary: 'One.\nTwo.\nThree.', assignments: ['Read chapter 2'], chapters: null, updated_at: t0 },
    transcripts: [{ id: 1, at: '2026-09-16T18:01:00.000Z', speaker_name: 'Dr. Gray', text: 'Welcome to the Hill.' }],
    materials: [{ id: 'm1', title: 'Deck.pdf', kind: 'resource', link_url: null, file_path: 'materials/u1/room/r-ht/x-Deck.pdf', created_at: t0 }] },
    { url: '/ht/hub/replay/' });
  await p.waitForSelector('.rp-chapter');
  ok('10 chapters from the events', (await p.locator('.rp-chapter').count()) === 2);
  ok('10 the Live tab stays current on the replay page', (await p.locator('.ht-tab.on').textContent()).trim() === 'Live');
  await p.click('.rp-tab[data-tab="summary"]'); ok('10 summary lines', (await p.locator('.rp-lines li').count()) === 3);
  await p.click('.rp-tab[data-tab="transcript"]'); ok('10 transcript line', /Welcome to the Hill/.test(await text(p, '#tlist')));
  await p.click('.rp-tab[data-tab="files"]'); ok('10 the file', /Deck\.pdf/.test(await text(p, '.rp-pane[data-pane="files"]')));
  ok('10 draft chip for the host', /Draft/.test(await text(p, '#now')));
  ok('10 no page errors', errs.length === 0, errs.join(' | '));
  await p.close();
}
```
(`page()` routes `esm.sh` to the stub for any URL under the site, so the replay page's `createClient` is the stub too; the Stream SDK script will fail to load offline — the page goes on after `STREAM_SDK_WAIT_MS`, so allow `p.waitForSelector('.rp-chapter', { timeout: 15000 })`.)

- [ ] **Step 5: Build, run, commit**

Run: `node ht/build.mjs && ls ht/hub/replay/index.html && node --test tests/ht/*.test.mjs 2>&1 | tail -3 && node tests/ht/harness/ht-room.mjs 2>&1 | grep -E "^FAIL|^OK   10"`
Expected: the shell exists; `# fail 0`; every `10 …` line `OK`; no `FAIL`.

```bash
git add ht/hub/data.js ht/hub/data/replay.js ht/hub/ht.js ht/build.mjs ht/hub/replay.js ht/hub/room.js ht/hub tests/ht/harness
git commit -m "feat(ht): the replay page at /ht/hub/replay/ — chapters, summary and what was assigned, files, searchable transcript for HT's last session (the OPIL lesson page on the HT frame, by room key); Publish writes the summary; Last session links to it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The hub made current — dates, weekday words, the dot-pills, the Live copy, the login line, the playbook rows

**Files:**
- Create: `scripts/ht-dates.mjs` (the sweep: fails on any sample date < 2026-10-06 or on a `ceremony`/`closed`/`exam` published date, or a weekday word in copy)
- Modify: `ht/hub/data.js`, `ht/hub/data/{president,live,students,career,alumni,outreach,learn,community,board,showcase,admissions}.js` (whatever the sweep names)
- Modify: `ht/hub/ht.js:166,168,203,218` (flags as typography), `ht/ht.css:72-73,304` (`.chip.live` → `.flag`)
- Modify: `login/index.html` (one HT line when `NEXT` starts with `/ht/`)
- Modify: `ht/playbook/index.html` (§07 rows)
- Test: `scripts/ht-dates.mjs` itself (exit 0 = clean), `tests/ht/harness/ht-room.mjs` unchanged

- [ ] **Step 1: Write the sweep**

```js
// scripts/ht-dates.mjs — run: node scripts/ht-dates.mjs   (exit 1 with a list when the hub carries a stale date or a weekday word)
// Rule (spec 2026-09-17 §3): a sample event is never in the past and never on a published ceremony / closed / exam
// date; copy never says "Thursday" or "on the 14th" — dates are written out or it says "the next session".
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ht', 'hub');
global.window = global;
new Function(fs.readFileSync(path.join(HUB, 'data.js'), 'utf8'))();
for (const f of fs.readdirSync(path.join(HUB, 'data'))) if (f.endsWith('.js') && f !== 'all.js') new Function(fs.readFileSync(path.join(HUB, 'data', f), 'utf8'))();
const FLOOR = process.argv[2] || '2026-10-06';
const num = (d) => +String(d).replace(/-/g, '');
const year = (global.HT.spaces.events.blocks.find((b) => b.type === 'year') || { items: [] }).items;
const blocked = year.filter((r) => ['ceremony', 'closed', 'exam'].includes(r.kind)).map((r) => ({ a: num(r.d), b: num(r.end || r.d), t: r.t }));
const bad = [];
const walk = (v, where) => {
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, where + '[' + i + ']'));
  if (v && typeof v === 'object') {
    if (typeof v.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(v.date)) {
      const n = num(v.date);
      if (n < num(FLOOR)) bad.push(where + ' · ' + v.date + ' "' + (v.title || '') + '" is before ' + FLOOR);
      const hit = blocked.find((b) => n >= b.a && n <= b.b); if (hit && !/deadline/i.test(v.tag || '')) bad.push(where + ' · ' + v.date + ' "' + (v.title || '') + '" collides with HT\'s "' + hit.t + '"');
    }
    for (const k of Object.keys(v)) { if (k === 'items' && where.endsWith('.events.blocks[year]')) continue; walk(v[k], where + '.' + k); }
    return;
  }
  if (typeof v === 'string' && /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b|\bon the \d{1,2}(st|nd|rd|th)\b|\b(Sep|September) \d{1,2}\b/.test(v)) bad.push(where + ' · weekday or September wording: "' + v.slice(0, 90) + '"');
};
walk(global.HT.home, 'home');
for (const [k, s] of Object.entries(global.HT.spaces)) { if (k === 'events') { walk({ ...s, blocks: s.blocks.filter((b) => b.type !== 'year') }, 'spaces.events'); continue; } walk(s, 'spaces.' + k); }
if (bad.length) { console.log(bad.join('\n')); console.log('\n' + bad.length + ' problem(s)'); process.exit(1); }
console.log('hub dates clean (floor ' + FLOOR + ', ' + blocked.length + ' blocked spans)');
```
(The published calendar's own rows are skipped — they are HT's dates and may be past. `Sep 10` in the Learn space's "Opening Convocation" mention, if any, is exempt only if it is HT's real event — say "the Opening Convocation" instead of the date.)

- [ ] **Step 2: Run it and read the list**

Run: `node scripts/ht-dates.mjs`
Expected: exit 1 with roughly these (the 9/17 grep found them): home calendar Sep 8/10/14, home Ada line ("Tuesday", "Thursday", "on the 14th"), home announcements ("Thursday, Sep 10", "Monday"), president (town hall "Thursday" ×3), live (calendar Sep 17/24, cta "Thursday at noon"), students (Sep 15/16/17/22/23/26), career (Sep 14/30), alumni (Sep 17/22), outreach Oct 6 (midterm exams span).

- [ ] **Step 3: Make the edits (the content decisions, so the executor does not invent dates)**

All Central time; every one of these is a sample event and keeps its sample chip/meta.
- **Home** (`data.js`): calendar → `2026-10-08 President's Fall Briefing for donors · Advancement · Live room (tag Live)`, `2026-10-13 AI Literacy · Session 01 · Learn · Track one`, `2026-10-23 152nd Charter Day Observance · HT's calendar · Campus`, `2026-11-06 Donor Appreciation Weekend, day one · Advancement`. Ada: *"Welcome to the Hill. Three things are coming up: the President's Fall Briefing for donors on October 8, the first AI Literacy session on October 13, and Charter Day on October 23. Pick a space below and I'll walk you in."* Announcements: `Office of the President · This week` *"The President's Fall Briefing for donors streams live in the hub on October 8 at noon. The replay lands the same afternoon."*; `Institutional Advancement · This week` (unchanged text); `Student Affairs · Last week` *"Check-in codes are shown on the screen at each session. One tap marks you present."*
- **President**: town hall → **October 15 at noon** everywhere ("The fall town hall streams here on October 15 at noon…", Ada "The town hall is October 15 at noon…", announcements "The fall town hall is October 15 at noon in the auditorium. Doors at 11:40. The stream opens here at 11:55." / "Questions for the President go in the town hall room on this page until the morning of October 15."); `when` stamps → "This week" / "Last week".
- **Live**: calendar `2026-10-08 President's Fall Briefing for donors`, `2026-10-15 Fall town hall (tag Live)`, `2026-10-22 Guest lecture · Business program`, `2026-10-29 Faculty development · teaching with the hub · 3:00 PM CT`, then the existing Nov/Jan/Mar rows; cta title *"The next session is October 8 at noon."*, text *"The President's Fall Briefing for donors, live from the auditorium. Open the room a few minutes early; your host will bring you in."* Intro text: *"…The host shares a screen, brings a question onto the stage, and can end the session for everyone when it is done — leaving the room never ends it. Anyone who is signed in can walk in while a session runs…"* (replace the "ends the session for everyone with one button" sentence).
- **Students**: drop the Welcome Week rows (past); `2026-10-13 Emerging Leaders · Session 01`, `2026-10-14 Wellness Wednesday`, `2026-10-15 Fall town hall, live`, `2026-10-17 Service Saturday`. Keep the `#orientation` anchor block if one exists (Admissions links to it) but its copy says "Welcome Week is behind us; the next Student Affairs sessions are below."
- **Career**: `2026-10-14 Mock interviews, round one`, `2026-10-21 Resume clinic`, Oct 22 / Nov 5 unchanged.
- **Alumni**: `2026-10-20 Austin chapter meetup`, `2026-10-27 AI for alumni professionals · Session 02`, Oct 15 / Nov 17 unchanged.
- **Outreach**: `2026-10-13 AI for small business owners · evening one` (Oct 6 sat in midterm exams).
- Anything else the sweep names: same rules — forward, off blocked spans, dates written out.

- [ ] **Step 4: Run the sweep until it is clean**

Run: `node scripts/ht-dates.mjs`
Expected: `hub dates clean (floor 2026-10-06, N blocked spans)`.

- [ ] **Step 5: The flags as typography**

`ht/ht.css`: replace lines 72–73 (`.chip.live{…}` and `.chip.live i{…}`) with
```css
.chip.live{background:#ffe1dd;color:#8f0000}
.flag{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8f0000}
```
and in the reduced-motion rule at 304 drop `.chip.live i{animation:none}`.
`ht/hub/ht.js`: line 166 `'<span class="chip live"><i></i>Live</span>'` → `'<span class="flag">Live</span>'`; line 168 the same; line 203 `'<span class="chip live"><i></i>Today</span>'` → `'<span class="flag">Today</span>'`; line 218 `'<span class="chip live"><i></i>' + (span ? 'On now' : 'Today') + '</span>'` → `'<span class="flag">' + (span ? 'On now' : 'Today') + '</span>'`. Data items with `tagCls: 'live'` keep rendering as a plain chip with no dot (the `<i>` is gone everywhere: `grep -c '<i></i>' ht/hub/ht.js` → 0).

- [ ] **Step 6: One HT line on `/login/`**

In `login/index.html`, after `const WELCOME_URL = …` (line 269) add:
```js
// The HT Hub sends its people here (Huston-Tillotson × Taylormade Academy); say so, and nothing else changes.
if (NEXT.indexOf("/ht/") === 0) {
  $("kick").textContent = "Signing in to the HT Hub";
  $("head").textContent = "Your email, then a six-digit code.";
  $("sub").textContent = "Huston-Tillotson × Taylormade Academy. No password to remember; the first time, you type your name once.";
}
```
(`$` is the page's `document.getElementById` helper — check it is defined above this point; if it is defined later, use `document.getElementById`.)

- [ ] **Step 7: Playbook §07 rows**

In `ht/playbook/index.html` §07 "live and after" table (class `pt ft`), add rows in the existing markup pattern: `Files in the room — a host adds a file, everyone downloads it or sees it on the stage · In the hub`, `Whiteboard — pen, text, sticky notes, save it to Files · In the hub`, `Reactions — Got it / Confused / Slower / Faster; the host sees the pulse · In the hub`, `Warm-up question — set on the room card; people answer while they wait · In the hub`, `The replay page — chapters, a five-line summary, what was assigned, files, a searchable transcript, after Publish · In the hub`, `Next session — title and time on the room card; Add to calendar on the Live space · In the hub`. Tags use `.tag.self`.

- [ ] **Step 8: Build, check, commit**

Run: `node ht/build.mjs && node scripts/ht-dates.mjs && grep -c '<i></i>' ht/hub/ht.js; node --test tests/ht/*.test.mjs 2>&1 | tail -3`
Expected: clean sweep; `0`; `# fail 0`.

```bash
git add scripts/ht-dates.mjs ht login/index.html
git commit -m "fix(ht): the hub reads current on any day — every sample date rolled forward and checked against HT's calendar (scripts/ht-dates.mjs), no weekday words, Today/On now/Live as typography (no dot-pills), Live copy matches the room (Leave only leaves), one HT line on /login/, playbook rows for the room's features

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Every page, two widths — static sweep + the run-of-show

**Files:**
- Create: `scripts/ht-pages.mjs` (Playwright: 18 pages × 1440/390 — 0 console errors, 0 horizontal overflow, 1 h1, no `.chip.live i`, no past `.cal` rows)
- Create: `~/Downloads/HT-Hub-demo-runofshow.md`

- [ ] **Step 1: Write the sweep**

```js
// scripts/ht-pages.mjs — run: python3 -m http.server 8790 --bind 127.0.0.1 (repo root) then node scripts/ht-pages.mjs [base]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://127.0.0.1:8790';
const PAGES = ['/ht/', '/ht/fund/', '/ht/playbook/', '/ht/hub/', ...['advancement', 'president', 'events', 'live', 'learn', 'community', 'showcase', 'students', 'career', 'alumni', 'admissions', 'outreach', 'board', 'replay'].map((k) => '/ht/hub/' + k + '/')];
const b = await chromium.launch({ channel: 'chrome', headless: true }); let bad = 0;
for (const width of [1440, 390]) for (const u of PAGES) {
  const p = await b.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/esm\.sh|supabase|cloudflarestream|embed\.cloudflarestream|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(BASE + u, { waitUntil: 'networkidle' }).catch((e) => errs.push('goto ' + e.message));
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ h1: document.querySelectorAll('h1').length, wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, dots: document.querySelectorAll('.chip.live i').length, past: [...document.querySelectorAll('.cal.is-past')].map((n) => n.textContent.trim().slice(0, 60)) }));
  const probs = [...errs.map((e) => 'error: ' + e), r.h1 !== 1 ? 'h1 count ' + r.h1 : '', r.wide ? 'horizontal overflow' : '', r.dots ? 'dot pills ' + r.dots : '', ...r.past.map((t) => 'past sample row: ' + t)].filter(Boolean);
  if (probs.length) { bad++; console.log('FAIL ' + width + ' ' + u + '\n  ' + probs.join('\n  ')); } else console.log('OK   ' + width + ' ' + u);
  await p.close();
}
await b.close(); process.exit(bad ? 1 : 0);
```

- [ ] **Step 2: Run it locally**

Run: `node scripts/ht-pages.mjs`
Expected: every line `OK`. Fix anything it names (an `is-past` sample row means Task 6 missed a `.cal` item — never silence the check).

- [ ] **Step 3: The run-of-show**

Write `~/Downloads/HT-Hub-demo-runofshow.md` with these sections, plain language, no prices, no vendor names:
1. **Before the call** (the day before): run `! bash scripts/apply-0054.sh` if not yet; open `taylormadeacademy.com/ht/hub/live/` signed in, set Title "HT Live", Host name "Nelson Taylor", Warm-up question, Next session (the date of the demo itself, so the line shows); Start class once with a second device, End it, Publish the replay, open `/ht/hub/replay/`; install the hub on your iPhone (Safari → Share → Add to Home Screen → "HT Hub") and launch it.
2. **The order** — home (greeted by name) → Events (HT's own calendar knows today; check-in) → Live: Start class → *she* joins from a text (`/ht/hub/live/?k=…`; sign in, code, in) → Files: add a PDF, Show it → Whiteboard → a question in the queue → Bring on stage → captions on → Leave (still running) → End (two taps) → Publish → the replay page → the President space → the playbook.
3. **What to say** — "one sign-in for everything the campus does live"; "no app store"; "it plugs into what Marketing builds"; never a vendor name, never a price on the call.
4. **If something goes wrong** — she can't get in: any signed-in account walks in while the class runs; the link is only how she finds the page. Camera black: Tools → Camera & mic. Recording: starts when the host is in, never on Start.
5. **After the demo** — add her email under Hosts on the room card; New link.

- [ ] **Step 4: Commit the sweep**

```bash
git add scripts/ht-pages.mjs
git commit -m "test(ht): scripts/ht-pages.mjs — every HT page at 1440 and 390: no errors, no overflow, one h1, no dot-pills, no past sample rows

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Deploy (after Nelson runs `apply-0054.sh`), verify on the bare URL, the two-browser rehearsal

- [ ] **Step 1: Confirm 0054 is on prod** — Nelson's `! bash scripts/apply-0054.sh` output shows `room_columns 3, material_policies 2, storage_policies 2, state_has_next true`. Do not push before this.

- [ ] **Step 2: Bump the service worker** — in `sw.js` set `VERSION` to `tma-v55-ht-demo` (read the current value first; keep the pattern).

- [ ] **Step 3: Rebuild, final suites, push**

```bash
node ht/build.mjs && node --test tests/ht/*.test.mjs tests/opil/*.test.mjs tests/academy/*.test.mjs 2>&1 | tail -3 && node scripts/ht-dates.mjs && git add -A ht sw.js && git commit -m "chore(ht): sw tma-v55-ht-demo; stamp

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" && git push origin academy-room:main
```

- [ ] **Step 4: Verify on the bare URL (never `?cb=`)**

Run: `bash ~/Downloads/HT-Hub-livecheck.sh` (add `/ht/hub/replay/` to its list) and `node scripts/ht-pages.mjs https://taylormadeacademy.com`; `curl -s https://taylormadeacademy.com/sw.js | grep -o "tma-v55-ht-demo"`; `curl -s https://taylormadeacademy.com/ht/hub/live/ | grep -o 'ht.js?v=[a-f0-9]*'` equals the local stamp.

- [ ] **Step 5: The rehearsal (with Nelson, on prod)** — host = Nelson in his own browser; guest = a second browser signed in as `appreview@taylormadecreative.net` (code `424242`, the App Review demo login) opened on the room link. Tick each: sign in from the link → in · warm-up answer → host sees it under Ready to speak · reactions → Pulse · Files: host adds a PDF → guest downloads it, host Shows it → guest sees it on stage · Whiteboard draw → Save to Files → it lists · question → queue → Bring on stage · captions on · Leave (guest) → rejoin · host Leave → still running → Rejoin · End (two taps) → replay preparing → ready → Publish → `/ht/hub/replay/` shows chapters (stage, file, board), Make summary works, transcript lines, the PDF · the Live space shows Last session with the link · `select is_live from ea_rooms where slug='ht'` is false (Nelson: `! bash` a one-line check, or the room card reads Off air).
- [ ] **Step 6: Record what passed and what did not in the memory file `ht-class-room` (verified / not verified), and hand Nelson the run-of-show.**

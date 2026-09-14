# OPIL Automatic Replays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every OPIL class records itself from Start class to the host leaving; the replay lands on the session as a draft and the coordinator publishes it to students with one switch.

**Architecture:** Two Deno edge functions — `ea-rtk-record` (start/stop a RealtimeKit recording as the host; admin-only webhook registration) and `ea-rtk-webhook` (signature-verified, deduped; on UPLOADED copies the file into Cloudflare Stream and marks the replay `ready`). One table `ea_opil_replays` (program team reads; only the service role writes) plus a `publish` RPC that copies the watch URL into the column students already see. Both functions are written as a pure `handler.ts` (deps injected) + a thin `index.ts` so `deno test` covers them without network.

**Tech Stack:** Supabase edge functions (Deno 2.7, `verify_jwt` off, deploy flag `--no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr`), supabase-js v2, Postgres RLS, Cloudflare RealtimeKit REST (`/accounts/{acct}/realtime/kit/{app}`), Cloudflare Stream `POST /stream/copy` (token `CF_API_TOKEN`, subdomain `CF_STREAM_SUBDOMAIN`), static pages stamped by `build_site.py`, `node --test` + the Playwright harness in the scratchpad.

**Spec:** `docs/superpowers/specs/2026-09-14-opil-auto-replays-design.md`

## Global Constraints

- Production is the only database. Migration `0033` is additive (one table, one events table, one RPC, policies) and safe to re-run. Apply via Nelson's `!` script (`gotcha-prod-deploy-classifier-use-bang-script`).
- Edge function auth pattern is copied from `ea-rtk-join/index.ts`: bearer → `admin.auth.getUser` → role RPCs **as the caller** through an anon client carrying the bearer. Cloudflare tokens never leave the function; responses never include them.
- The meeting id for a session is `ea_opil_sessions.stream_url` minus the `rtk:` prefix (no new column).
- Students see a replay only through `ea_opil_sessions.recording_url`; `ea_opil_replays` has no student read path.
- Copy rule: "replay", "recording", "publish" — never "artifact", "webhook", "Stream uid" in UI text.
- `sw.js` VERSION bump with the page changes; `build_site.py` restamps.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QGAcr1jjtkTimRBbuss1Po
  ```

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/0033_opil_replays.sql` (create) | `ea_opil_replays`, `ea_rtk_events`, RLS, `ea_opil_publish_replay` |
| `supabase/functions/_shared/rtk_auth.ts` (create) | `resolveCaller(req, deps)` → `{ user, role }` or an error response; shared by both functions |
| `supabase/functions/ea-rtk-record/handler.ts` (create) | pure `handleRecord(body, ctx, deps)` |
| `supabase/functions/ea-rtk-record/index.ts` (create) | Deno.serve wrapper: env, auth, CORS |
| `supabase/functions/ea-rtk-record/handler_test.ts` (create) | `deno test` |
| `supabase/functions/ea-rtk-webhook/handler.ts` (create) | `verify`, `handleEvent(payload, deps)` |
| `supabase/functions/ea-rtk-webhook/index.ts` (create) | Deno.serve wrapper |
| `supabase/functions/ea-rtk-webhook/handler_test.ts` (create) | `deno test` |
| `opil/hub/live/index.html` (modify) | `record('start'|'stop')` calls, recording chip |
| `opil/hub/admin/index.html` (modify) | replay line per session, Publish switch, 20 s poll |
| `opil/hub/tour.js` (modify) | one line about replays |
| scratchpad `harness/live-page.mjs` (modify) | stub `fetch` to FUNCTIONS_BASE; new steps |
| scratchpad `deploy-replays.sh` (create) | Nelson runs with `!`: migration + function deploy |

---

### Task 1: Migration 0033

**Files:** Create `supabase/migrations/0033_opil_replays.sql`

**Produces:** tables + RPC exactly as the spec's Data section. RPC signature `ea_opil_publish_replay(p_session int, p_publish boolean) returns jsonb` → `{ ok: true, published: bool, recording_url: text|null }` or raises `42501` for non-hosts / `P0002` when no ready replay exists.

- [ ] **Step 1: Write it**

```sql
-- 0033: automatic replays. Start class records the RealtimeKit meeting; the webhook copies the
-- upload into Cloudflare Stream and parks it here as a DRAFT the program team can review.
-- Publishing copies the watch URL into ea_opil_sessions.recording_url — the one column students
-- already see — so nothing reaches a student until a coordinator or that session's facilitator
-- flips it (Jamal, 9/14: "I'd rather us be able to go in, view it a little bit, trim it if need be
-- before they can access it"). Only the service role writes these tables. Safe to re-run.
create table if not exists public.ea_opil_replays (
  id uuid primary key default gen_random_uuid(),
  session_no int references public.ea_opil_sessions(no) on delete set null,
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
create index if not exists ea_opil_replays_session_idx on public.ea_opil_replays (session_no, created_at desc);
create index if not exists ea_opil_replays_meeting_idx on public.ea_opil_replays (meeting_id, created_at desc);
alter table public.ea_opil_replays enable row level security;
drop policy if exists replays_program_read on public.ea_opil_replays;
create policy replays_program_read on public.ea_opil_replays for select to authenticated
  using (public.ea_opil_is_program_team(auth.uid()));
-- no insert/update/delete policies: browsers never write here

create table if not exists public.ea_rtk_events (
  id text primary key,
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.ea_rtk_events enable row level security;
-- no policies at all: service role only

create or replace function public.ea_opil_publish_replay(p_session int, p_publish boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.ea_opil_replays%rowtype; allowed boolean;
begin
  allowed := public.ea_opil_is_admin(auth.uid()) or p_session = any(public.ea_opil_fac_sessions(auth.uid()));
  if not allowed then raise exception 'not your session' using errcode = '42501'; end if;
  select * into r from public.ea_opil_replays
    where session_no = p_session and status = 'ready' and watch_url is not null
    order by created_at desc limit 1;
  if not found then raise exception 'no replay is ready for this session' using errcode = 'P0002'; end if;
  if p_publish then
    update public.ea_opil_replays set published = true, updated_at = now() where id = r.id;
    update public.ea_opil_replays set published = false, updated_at = now() where session_no = p_session and id <> r.id and published;
    update public.ea_opil_sessions set recording_url = r.watch_url where no = p_session;
    return jsonb_build_object('ok', true, 'published', true, 'recording_url', r.watch_url);
  else
    update public.ea_opil_replays set published = false, updated_at = now() where session_no = p_session and published;
    update public.ea_opil_sessions set recording_url = null where no = p_session and recording_url = r.watch_url;
    return jsonb_build_object('ok', true, 'published', false, 'recording_url', null);
  end if;
end $$;
revoke all on function public.ea_opil_publish_replay(int, boolean) from public, anon;
grant execute on function public.ea_opil_publish_replay(int, boolean) to authenticated;
select 'opil replays ready' as status;
```

- [ ] **Step 2: Commit** — `db(opil): 0033 — replays table, events dedupe, publish RPC`

---

### Task 2: `_shared/rtk_auth.ts` + `ea-rtk-record` (handler, index, tests)

**Interfaces:**
- `resolveCaller({ token, admin, anonClient })` → `{ user: {id,email}, role: { admin: bool, judge: bool, facilitator_sessions: number[] } }` or `{ error, status }`.
- `handleRecord(body, ctx, deps)`:
  - `body`: `{ session_no?: number, action: 'start'|'stop'|'register_webhook'|'list_webhooks' }`
  - `ctx`: `{ user, role, functionsBase: string }`
  - `deps`: `{ getSession(no) → {no,title,stream_url,is_live}|null, latestActive(meetingId) → replay|null, insertReplay(row), cf(method, path, body) → {ok,status,data} }`
  - returns `{ status: number, body: object }`.
- Rules: `start`/`stop` need `role.admin || facilitator_sessions.includes(no)` else 403 `not_host`; session must have `rtk:` stream_url else 409 `no_room`; `start` returns the existing active row if any (`{ recording_id, status, reused: true }`); `register_webhook`/`list_webhooks` need `role.admin` else 403.

- [ ] **Step 1: Write `handler_test.ts` first** (Deno.test, stubbed deps): start as host creates (`POST /recordings` called once, insert called with status `invoked`); start again with an active row → reused, no CF call; start as student → 403; start on a session without a room → 409; stop with an active row → `PUT /recordings/<id>` `{action:'stop'}`; stop with none → `{stopped:false}` 200; register_webhook as non-admin → 403; as admin → `POST /webhooks` with the two events and `<functionsBase>/ea-rtk-webhook`.
- [ ] **Step 2: Run** `deno test supabase/functions/ea-rtk-record/` → fails (module missing)
- [ ] **Step 3: Write `handler.ts`, `_shared/rtk_auth.ts`, `index.ts`** (index: CORS as `ea-rtk-join`, env check, `resolveCaller`, `handleRecord` with real deps over the service-role client and `cf()`).
- [ ] **Step 4: Run tests → pass. `deno check` both index files.**
- [ ] **Step 5: Commit** — `feat(opil): ea-rtk-record — start/stop the class recording, webhook registration`

---

### Task 3: `ea-rtk-webhook` (handler, index, tests)

**Interfaces:**
- `verifySignature(publicKeyPem, signatureB64, bodyBytes) → boolean` (WebCrypto RSASSA-PKCS1-v1_5/SHA-256, per Cloudflare's sample).
- `handleEvent(payload, deps)` with `deps: { dedupe(id, event, payload) → boolean(fresh), sessionByMeeting(meetingId) → {no,title}|null, upsertReplay(row) , streamCopy(url, name) → {uid}|throws, subdomain }` → `{ status: 200, body }` always after verification.
- Status map as the spec; on UPLOADED → streamCopy → `ready` + `watch_url`; streamCopy throws → `error` with message, keep `download_url`.

- [ ] **Step 1: `handler_test.ts` first**: generate an RSA keypair in the test, sign a body, verify true; tampered body → false; duplicate event id → no-op; RECORDING → row `recording`; UPLOADED + copy ok → `ready` with `watch_url = https://<sub>.cloudflarestream.com/<uid>/watch`; UPLOADED + copy throws → `error`; unknown meeting → 200 and no upsert; `meeting.ended` → dedupe only.
- [ ] **Step 2: Run → fail. Step 3: implement `handler.ts` + `index.ts`** (index: read `rtk-signature`, fetch + cache the public key from `https://api.realtime.cloudflare.com/.well-known/webhooks.json`, 401 on failure, then `handleEvent` with service-role deps; Stream copy = `POST https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/copy` with `CF_API_TOKEN`, body `{ url, meta: { name } }`, uid = `result.uid`).
- [ ] **Step 4: tests pass; `deno check`. Step 5: Commit** — `feat(opil): ea-rtk-webhook — verified recording events → Stream → draft replay`

---

### Task 4: Live page — start on Start class, stop on leave

- [ ] **Step 1:** in `opil/hub/live/index.html` staff block add
```js
    const FN = window.BM_CONFIG.FUNCTIONS_BASE + '/ea-rtk-record';
    async function record(action, no) {
      const tok = (await sb.auth.getSession()).data.session?.access_token || '';
      const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ session_no: no, action }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || ('the server said ' + r.status));
      return d;
    }
```
  Start class: after `await flipLive(s.no, true, 'rtk:' + r.meetingId);` → `try { await record('start', s.no); recChip(true); } catch (e) { bnote.textContent = 'The class is on, but the replay could not start recording (' + e.message + ').'; }` — keep the existing success note otherwise, prefixed with "Recording. ".
  `onLeft` (hosting): `try { await record('stop', no); } catch (e) {}` before `flipLive(no, false)`; note becomes "Class ended — the replay is being prepared. The coordinator page shows it when it's ready to review."
  A small `#bcRec` chip ("● Recording") next to the buttons, shown via `recChip(on)`.
- [ ] **Step 2: harness** — route `**/ea-rtk-record` to a stub that records calls (`window.__rec`), assert start after Start class and stop on host leave (before the is_live:false update).
- [ ] **Step 3: commit** — `feat(opil): the class records itself from Start class to Leave`

---

### Task 5: Coordinator page — replay line + Publish switch

- [ ] **Step 1:** load `ea_opil_replays` (`select('*').order('created_at', { ascending: false })`) alongside sessions; `latestReplay(no)`; in `sessRow(s)` after the Open room line:
```
  invoked/recording → "● Recording this session…"
  uploading/uploaded → "Replay is being prepared…"
  ready & !published → "Replay ready — <a Review> · <button Publish to students>"
  ready & published → "Replay published ✓ — <a Watch> · <button Unpublish>"
  error → "Replay failed: <error> (the recording is kept for 7 days — tell Nelson)"
```
  Click handlers call `sb.rpc('ea_opil_publish_replay', { p_session: no, p_publish: true|false })`, then reload sessions + replays. Poll every 20 s while any replay is in a non-final state.
- [ ] **Step 2: tour.js** — one step on the replay line for admin + facilitator.
- [ ] **Step 3: harness** — stub `ea_opil_replays` rows for the four states; assert the labels; Publish calls the rpc (stub records `window.__rpc`).
- [ ] **Step 4: sw bump `tma-v17-auto-replays`, build, commit** — `feat(opil): coordinator reviews and publishes replays`

---

### Task 6: Ship (gates: Nelson runs the `!` script; the function deploy may be classifier-blocked)

- [ ] **Step 1:** `deploy-replays.sh` in the scratchpad: applies 0033 via the Management API (keychain token), then `supabase functions deploy ea-rtk-record --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr` and the same for `ea-rtk-webhook`. Try the deploy from here first; if denied, hand Nelson the one-liner.
- [ ] **Step 2:** push pages to main; verify on the bare URL.
- [ ] **Step 3:** register the webhook from Nelson's signed-in Chrome tab: `fetch(FUNCTIONS_BASE + '/ea-rtk-record', { action: 'register_webhook' })`; `list_webhooks` to confirm.
- [ ] **Step 4:** real run on session 02: Start class → Join → wait 60 s → Leave → watch `ea_opil_replays` go invoked → recording → uploading → ready (poll the coordinator page) → Review → Publish → hub home shows Recording → Unpublish → delete the Stream asset (dashboard or `DELETE /stream/{uid}` via a one-off).
- [ ] **Step 5:** memory: `opil-class-room-live.md` + a new `opil-auto-replays.md`; MEMORY.md line.

// deno test supabase/functions/ea-rtk-record/
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRecord, type RecordDeps } from "./handler.ts";

const HOST = { user: { id: "u-host", email: "host@x" }, role: { admin: false, judge: false, facilitator_sessions: [7] }, functionsBase: "https://p.supabase.co/functions/v1" };
const ADMIN = { ...HOST, role: { admin: true, judge: false, facilitator_sessions: [] } };
const STUDENT = { ...HOST, role: { admin: false, judge: false, facilitator_sessions: [] } };

function deps(over: Partial<RecordDeps> = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const inserted: unknown[] = [];
  const d: RecordDeps & { calls: typeof calls; inserted: typeof inserted } = {
    calls, inserted,
    getSession: async (no) => (no === 7 ? { no: 7, title: "Agents 101", stream_url: "rtk:meet-7", is_live: true } : no === 8 ? { no: 8, title: "No room", stream_url: null, is_live: false } : null),
    latestActive: async () => null,
    insertReplay: async (row) => { inserted.push(row); },
    cf: async (method, path, body) => { calls.push({ method, path, body }); return { ok: true, status: 200, data: { id: "rec-1", status: "INVOKED" } }; },
    ...over,
  };
  return d;
}

Deno.test("start as the session's host creates a recording and a draft row", async () => {
  const d = deps();
  const r = await handleRecord({ session_no: 7, action: "start" }, HOST, d);
  assertEquals(r.status, 200);
  assertEquals(d.calls, [{ method: "POST", path: "/recordings", body: { meeting_id: "meet-7" } }]);
  assertEquals(d.inserted.length, 1);
  const row = d.inserted[0] as Record<string, unknown>;
  assertEquals(row.session_no, 7); assertEquals(row.meeting_id, "meet-7"); assertEquals(row.recording_id, "rec-1"); assertEquals(row.status, "invoked");
  assertEquals(r.body, { recording_id: "rec-1", status: "invoked", reused: false });
});

Deno.test("start twice (a reload) reuses the active recording — no second Cloudflare call", async () => {
  const d = deps({ latestActive: async () => ({ recording_id: "rec-9", status: "recording" }) });
  const r = await handleRecord({ session_no: 7, action: "start" }, HOST, d);
  assertEquals(r.status, 200); assertEquals(r.body, { recording_id: "rec-9", status: "recording", reused: true });
  assertEquals(d.calls.length, 0); assertEquals(d.inserted.length, 0);
});

Deno.test("a student cannot start or stop", async () => {
  const d = deps();
  assertEquals((await handleRecord({ session_no: 7, action: "start" }, STUDENT, d)).status, 403);
  assertEquals((await handleRecord({ session_no: 7, action: "stop" }, STUDENT, d)).status, 403);
  assertEquals(d.calls.length, 0);
});

Deno.test("an admin is a host of every session", async () => {
  const d = deps();
  assertEquals((await handleRecord({ session_no: 7, action: "start" }, ADMIN, d)).status, 200);
});

Deno.test("a session with no room cannot record", async () => {
  const d = deps();
  const r = await handleRecord({ session_no: 8, action: "start" }, ADMIN, d);
  assertEquals(r.status, 409); assertEquals((r.body as { error: string }).error, "no_room");
});

Deno.test("unknown session → 404; bad body → 400", async () => {
  const d = deps();
  assertEquals((await handleRecord({ session_no: 99, action: "start" }, ADMIN, d)).status, 404);
  assertEquals((await handleRecord({ action: "start" }, ADMIN, d)).status, 400);
  assertEquals((await handleRecord({ session_no: 7, action: "dance" as never }, ADMIN, d)).status, 400);
});

Deno.test("stop with an active recording sends the stop action", async () => {
  const d = deps({ latestActive: async () => ({ recording_id: "rec-9", status: "recording" }) });
  const r = await handleRecord({ session_no: 7, action: "stop" }, HOST, d);
  assertEquals(r.status, 200); assertEquals(r.body, { stopped: true, recording_id: "rec-9" });
  assertEquals(d.calls, [{ method: "PUT", path: "/recordings/rec-9", body: { action: "stop" } }]);
});

Deno.test("stop with nothing recording is a calm 200", async () => {
  const d = deps();
  const r = await handleRecord({ session_no: 7, action: "stop" }, HOST, d);
  assertEquals(r.status, 200); assertEquals(r.body, { stopped: false }); assertEquals(d.calls.length, 0);
});

Deno.test("Cloudflare failure on start surfaces as 502 and inserts nothing", async () => {
  const d = deps({ cf: async () => ({ ok: false, status: 500, data: {} }) });
  const r = await handleRecord({ session_no: 7, action: "start" }, HOST, d);
  assertEquals(r.status, 502); assertEquals(d.inserted.length, 0);
});

Deno.test("register_webhook is admin-only and points at ea-rtk-webhook", async () => {
  const d = deps();
  assertEquals((await handleRecord({ action: "register_webhook" }, HOST, d)).status, 403);
  const r = await handleRecord({ action: "register_webhook" }, ADMIN, d);
  assertEquals(r.status, 200);
  assertEquals(d.calls, [{ method: "POST", path: "/webhooks", body: { name: "taylormade-academy replays", url: "https://p.supabase.co/functions/v1/ea-rtk-webhook", events: ["recording.statusUpdate", "meeting.ended"], enabled: true } }]);
});

Deno.test("list_webhooks is admin-only and never leaks tokens", async () => {
  const d = deps({ cf: async (method, path) => ({ ok: true, status: 200, data: [{ id: "w1", url: "https://x", events: ["recording.statusUpdate"], enabled: true, secret: "SHOULD-NOT-LEAK" }] }) });
  assertEquals((await handleRecord({ action: "list_webhooks" }, STUDENT, d)).status, 403);
  const r = await handleRecord({ action: "list_webhooks" }, ADMIN, d);
  assertEquals(r.status, 200);
  assertEquals(JSON.stringify(r.body).includes("SHOULD-NOT-LEAK"), false);
});

// deno test supabase/functions/ea-rtk-record/
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRecord, type RecordDeps } from "./handler.ts";

const HOST = { user: { id: "u-host", email: "host@x" }, role: { admin: false, judge: false, facilitator_sessions: [7] }, academyAdmin: false, functionsBase: "https://p.supabase.co/functions/v1" };
const ADMIN = { ...HOST, role: { admin: true, judge: false, facilitator_sessions: [] } };
const STUDENT = { ...HOST, role: { admin: false, judge: false, facilitator_sessions: [] } };
/* Nelson: the Academy admin (ea_is_admin). No OPIL role at all — the room branch keys on academyAdmin alone. */
const NELSON = { user: { id: "u-nelson", email: "nelson@x" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: true, functionsBase: "https://p.supabase.co/functions/v1" };
const ROOM = { id: "room-1", meeting_id: "meet-room", host_emails: [] as string[] };
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

Deno.test("start as the session's host creates a recording and a draft row", async () => {
  const d = deps();
  const r = await handleRecord({ session_no: 7, action: "start" }, HOST, d);
  assertEquals(r.status, 200);
  assertEquals(d.calls, [{ method: "POST", path: "/recordings", body: { meeting_id: "meet-7", max_seconds: 14400 } }]);
  assertEquals(d.inserted.length, 1);
  const row = d.inserted[0] as Record<string, unknown>;
  assertEquals(row.session_no, 7); assertEquals(row.meeting_id, "meet-7"); assertEquals(row.recording_id, "rec-1"); assertEquals(row.status, "invoked");
  assertEquals(r.body, { recording_id: "rec-1", status: "invoked", reused: false });
});

Deno.test("start twice (a reload) reuses the active recording once Cloudflare confirms it is still going", async () => {
  const d = deps({ latestActive: async () => ({ recording_id: "rec-9", status: "recording" }), cf: async (method, path) => ({ ok: true, status: 200, data: { id: "rec-9", status: "RECORDING" } }) });
  const r = await handleRecord({ session_no: 7, action: "start" }, HOST, d);
  assertEquals(r.status, 200); assertEquals(r.body, { recording_id: "rec-9", status: "recording", reused: true });
  assertEquals(d.inserted.length, 0);
});

Deno.test("a stale 'recording' row (lost webhook) is corrected and a fresh recording starts", async () => {
  const calls: string[] = [];
  const d = deps({
    latestActive: async () => ({ recording_id: "rec-old", status: "recording" }),
    cf: async (method, path) => { calls.push(method + " " + path); return method === "GET" ? { ok: true, status: 200, data: { id: "rec-old", status: "UPLOADED" } } : { ok: true, status: 200, data: { id: "rec-new", status: "INVOKED" } }; },
  });
  const r = await handleRecord({ session_no: 7, action: "start" }, HOST, d);
  assertEquals(r.status, 200); assertEquals((r.body as { recording_id: string }).recording_id, "rec-new");
  assertEquals(d.updated, [["rec-old", "uploaded"]]);
  assertEquals(calls, ["GET /recordings/rec-old", "POST /recordings"]);
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

Deno.test("stop with an active recording sends the stop action and leaves the class's meeting open (a session reuses its meeting)", async () => {
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

Deno.test("register_webhook is admin-only, points at ea-rtk-webhook, and is idempotent", async () => {
  const d = deps({ cf: async (method, path, body) => { d.calls.push({ method, path, body }); return method === "GET" ? { ok: false, status: 404, data: {} } : { ok: true, status: 200, data: { id: "w-new" } }; } });
  assertEquals((await handleRecord({ action: "register_webhook" }, HOST, d)).status, 403);
  const r = await handleRecord({ action: "register_webhook" }, ADMIN, d);
  assertEquals(r.status, 200); assertEquals(r.body, { ok: true, id: "w-new", existing: false });
  assertEquals(d.calls, [{ method: "GET", path: "/webhooks", body: undefined }, { method: "POST", path: "/webhooks", body: { name: "taylormade-academy replays", url: "https://p.supabase.co/functions/v1/ea-rtk-webhook", events: ["recording.statusUpdate", "meeting.ended"], enabled: true } }]);
  const d2 = deps({ cf: async (method, path, body) => { d2.calls.push({ method, path, body }); return { ok: true, status: 200, data: [{ id: "w-have", url: "https://p.supabase.co/functions/v1/ea-rtk-webhook" }] }; } });
  const r2 = await handleRecord({ action: "register_webhook" }, ADMIN, d2);
  assertEquals(r2.body, { ok: true, id: "w-have", existing: true }); assertEquals(d2.calls.length, 1);
});

Deno.test("list_webhooks is admin-only and never leaks tokens", async () => {
  const d = deps({ cf: async (method, path) => ({ ok: true, status: 200, data: [{ id: "w1", url: "https://x", events: ["recording.statusUpdate"], enabled: true, secret: "SHOULD-NOT-LEAK" }] }) });
  assertEquals((await handleRecord({ action: "list_webhooks" }, STUDENT, d)).status, 403);
  const r = await handleRecord({ action: "list_webhooks" }, ADMIN, d);
  assertEquals(r.status, 200);
  assertEquals(JSON.stringify(r.body).includes("SHOULD-NOT-LEAK"), false);
});

Deno.test("retry_replay re-runs the stored UPLOADED event for the latest replay", async () => {
  const seen: unknown[] = [];
  const d = deps({ latestAny: async () => ({ recording_id: "rec-9", status: "error" }), uploadedEvent: async (id) => (id === "rec-9" ? { event: "recording.statusUpdate", recording: { id: "rec-9" } } : null), reprocess: async (p) => { seen.push(p); return { status: "ready" }; } });
  const r = await handleRecord({ session_no: 7, action: "retry_replay" }, HOST, d);
  assertEquals(r.status, 200); assertEquals(r.body, { recording_id: "rec-9", status: "ready" }); assertEquals(seen.length, 1);
});

Deno.test("retry_replay: nothing recorded → 404; not failed → 409 nothing_to_retry; failed with no upload → 409 no_upload; students → 403", async () => {
  assertEquals((await handleRecord({ session_no: 7, action: "retry_replay" }, HOST, deps())).status, 404);
  const ready = await handleRecord({ session_no: 7, action: "retry_replay" }, HOST, deps({ latestAny: async () => ({ recording_id: "rec-9", status: "ready" }) }));
  assertEquals(ready.status, 409); assertEquals((ready.body as { error: string }).error, "nothing_to_retry");
  const noUp = await handleRecord({ session_no: 7, action: "retry_replay" }, HOST, deps({ latestAny: async () => ({ recording_id: "rec-9", status: "error" }) }));
  assertEquals(noUp.status, 409); assertEquals((noUp.body as { error: string }).error, "no_upload");
  assertEquals((await handleRecord({ session_no: 7, action: "retry_replay" }, STUDENT, deps())).status, 403);
});

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
  const noMeeting = deps({ getRoom: async () => ({ id: "room-1", meeting_id: null, host_emails: [] }) });
  const r = await handleRecord({ room: true, action: "start" }, NELSON, noMeeting);
  assertEquals(r.status, 409); assertEquals((r.body as { error: string }).error, "no_room");
  const noRow = deps();
  const r2 = await handleRecord({ room: true, action: "stop" }, NELSON, noRow);
  assertEquals(r2.status, 404); assertEquals((r2.body as { error: string }).error, "not_found");
  assertEquals(noMeeting.calls.length, 0); assertEquals(noRow.calls.length, 0);
});

Deno.test("room: stop sends the stop action for the room's active recording, then closes the meeting (PATCH INACTIVE)", async () => {
  const d = deps({ getRoom: async () => ROOM, room: { latestActive: async (m) => (m === "meet-room" ? { recording_id: "rec-r9", status: "recording" } : null) } });
  const r = await handleRecord({ room: true, action: "stop" }, NELSON, d);
  assertEquals(r.status, 200); assertEquals(r.body, { stopped: true, recording_id: "rec-r9" });
  assertEquals(d.calls, [
    { method: "PUT", path: "/recordings/rec-r9", body: { action: "stop" } },
    { method: "PATCH", path: "/meetings/meet-room", body: { status: "INACTIVE" } },
  ]);
});

Deno.test("room: stop with nothing recording still closes the meeting; a failed PATCH is logged and never changes the answer; a failed stop closes nothing", async () => {
  const orig = console.warn, warned: string[] = [];
  console.warn = (...a: unknown[]) => { warned.push(a.map(String).join(" ")); };
  try {
    const none = deps({ getRoom: async () => ROOM });
    const r = await handleRecord({ room: true, action: "stop" }, NELSON, none);
    assertEquals(r.status, 200); assertEquals(r.body, { stopped: false });
    assertEquals(none.calls, [{ method: "PATCH", path: "/meetings/meet-room", body: { status: "INACTIVE" } }]);
    assertEquals(warned, []);
    const bad = deps({ getRoom: async () => ROOM, cf: async (method, path, body) => { bad.calls.push({ method, path, body }); return method === "PATCH" ? { ok: false, status: 500, data: {} } : { ok: true, status: 200, data: {} }; }, room: { latestActive: async () => ({ recording_id: "rec-r9", status: "recording" }) } });
    const r2 = await handleRecord({ room: true, action: "stop" }, NELSON, bad);
    assertEquals(r2.status, 200); assertEquals(r2.body, { stopped: true, recording_id: "rec-r9" });
    assertEquals(warned, ["[ea-rtk-record] room meeting not inactivated meet-room 500"]);
    const failStop = deps({ getRoom: async () => ROOM, cf: async (method, path, body) => { failStop.calls.push({ method, path, body }); return { ok: false, status: 502, data: {} }; }, room: { latestActive: async () => ({ recording_id: "rec-r9", status: "recording" }) } });
    const r3 = await handleRecord({ room: true, action: "stop" }, NELSON, failStop);
    assertEquals(r3.status, 502);
    assertEquals(failStop.calls.map((c) => c.method), ["PUT"]);   /* the recording is still going: the meeting stays open */
    /* OPIL stop never touches the meeting: the session reuses it for the next class (INACTIVE = ERR0004 on every later join) */
    const opil = deps({ latestActive: async () => ({ recording_id: "rec-9", status: "recording" }) });
    await handleRecord({ session_no: 7, action: "stop" }, HOST, opil);
    assertEquals(opil.calls.map((c) => c.method), ["PUT"]);
  } finally { console.warn = orig; }
});

Deno.test("room: retry_replay by replay_id re-runs that replay's stored UPLOADED event, even after a newer Start class moved the room's meeting on", async () => {
  const seen: unknown[] = [];
  const d = deps({
    getRoom: async () => ({ id: "room-1", meeting_id: "meet-newer", host_emails: [] }),
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

/* ── another institution's room, by slug (Task 8) — HT ── */

const HT_ROOM = { id: "room-ht", meeting_id: "meet-ht", host_emails: ["dgray@htu.edu"] };
const GRAY = { user: { id: "u-gray", email: "DGray@HTU.edu" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: false, functionsBase: "https://p.supabase.co/functions/v1" };

Deno.test("room:'ht' — a listed email is the host and can start; an unlisted one is not_host", async () => {
  const d = deps({ getRoom: async () => HT_ROOM });
  const r = await handleRecord({ room: "ht", action: "start" }, GRAY, d);
  assertEquals(r.status, 200);
  assertEquals(d.calls, [{ method: "POST", path: "/recordings", body: { meeting_id: "meet-ht", max_seconds: 14400 } }]);
  const d2 = deps({ getRoom: async () => HT_ROOM });
  const r2 = await handleRecord({ room: "ht", action: "start" }, STUDENT, d2);
  assertEquals(r2.status, 403); assertEquals((r2.body as { error: string }).error, "not_host");
  assertEquals(d2.calls.length, 0);
});

Deno.test("room:'ht' — an OPIL coordinator is not a host of 'ht'", async () => {
  const d = deps({ getRoom: async () => HT_ROOM });
  const r = await handleRecord({ room: "ht", action: "start" }, ADMIN, d);
  assertEquals(r.status, 403); assertEquals((r.body as { error: string }).error, "not_host");
});

Deno.test("room:'Bad Slug!' is a 400", async () => {
  const r = await handleRecord({ room: "Bad Slug!", action: "start" }, ADMIN, deps());
  assertEquals(r.status, 400);
});

Deno.test("room:'ht' — a listed HT host retrying a replay that belongs to the Academy room gets 403 not_host, never reprocessed", async () => {
  const seen: unknown[] = [];
  const d = deps({
    getRoom: async () => HT_ROOM,
    reprocess: async (p) => { seen.push(p); return { status: "ready" }; },
    room: { replayById: async (id) => (id === REPLAY_ID ? { id: REPLAY_ID, room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-old", status: "error" } : null) },
  });
  const r = await handleRecord({ room: "ht", action: "retry_replay", replay_id: REPLAY_ID }, GRAY, d);
  assertEquals(r.status, 403); assertEquals((r.body as { error: string }).error, "not_host");
  assertEquals(seen.length, 0);
});

Deno.test("room:'ht' — the Academy admin retrying that same cross-room replay proceeds as before (unrestricted reach)", async () => {
  const seen: unknown[] = [];
  const d = deps({
    getRoom: async () => HT_ROOM,
    uploadedEvent: async (id) => (id === "rec-old" ? { event: "recording.statusUpdate", recording: { id: "rec-old" } } : null),
    reprocess: async (p) => { seen.push(p); return { status: "ready" }; },
    room: { replayById: async (id) => (id === REPLAY_ID ? { id: REPLAY_ID, room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-old", status: "error" } : null) },
  });
  const r = await handleRecord({ room: "ht", action: "retry_replay", replay_id: REPLAY_ID }, NELSON, d);
  assertEquals(r.status, 200); assertEquals(r.body, { recording_id: "rec-old", status: "ready" });
  assertEquals(seen, [{ event: "recording.statusUpdate", recording: { id: "rec-old" } }]);
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

// deno test supabase/functions/ea-rtk-webhook/
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifySignature, handleEvent, type WebhookDeps, type Target } from "./handler.ts";

/* a throwaway RSA pair, the way RealtimeKit signs: RSASSA-PKCS1-v1_5 over the raw body */
async function keypair() {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
  const pem = "-----BEGIN PUBLIC KEY-----\n" + btoa(String.fromCharCode(...spki)) + "\n-----END PUBLIC KEY-----";
  return { kp, pem };
}
async function sign(kp: CryptoKeyPair, body: string) {
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(body)));
  return btoa(String.fromCharCode(...sig));
}

Deno.test("a body signed with the key verifies; a tampered body does not", async () => {
  const { kp, pem } = await keypair();
  const body = JSON.stringify({ event: "meeting.ended" });
  const sig = await sign(kp, body);
  assertEquals(await verifySignature(pem, sig, new TextEncoder().encode(body)), true);
  assertEquals(await verifySignature(pem, sig, new TextEncoder().encode(body + " ")), false);
  assertEquals(await verifySignature(pem, "bm90LWEtc2ln", new TextEncoder().encode(body)), false);
});

const REC = (status: string, extra: Record<string, unknown> = {}) => ({
  event: "recording.statusUpdate",
  recording: { id: "rec-1", recordingId: "rec-1", status, meetingId: "meet-7", downloadUrl: "https://dl/rec-1.mp4", downloadUrlExpiry: "2026-09-21T00:00:00.000Z", recordingDuration: 1800, fileSize: "2044680", outputFileName: "x.mp4", ...extra },
  meeting: { id: "meet-7", sessionId: "sess-1", title: "OPIL 7" },
});

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

Deno.test("a fractional duration (Cloudflare sends 102.783) is stored as whole seconds", async () => {
  const d = deps();
  await handleEvent(REC("UPLOADED", { recordingDuration: 102.783, fileSize: "7800108" }), d);
  const row = d.upserts[d.upserts.length - 1];
  assertEquals(row.duration_s, 103); assertEquals(row.file_size, 7800108);
});

Deno.test("UPLOADED but Stream fails → row error, download URL kept, still 200", async () => {
  const d = deps({ streamCopy: async () => { throw new Error("stream 403"); } });
  const r = await handleEvent(REC("UPLOADED"), d);
  assertEquals(r.status, 200);
  const row = d.upserts[d.upserts.length - 1];
  assertEquals(row.status, "error"); assertEquals(row.download_url, "https://dl/rec-1.mp4"); assert(String(row.error).includes("stream 403"));
});

Deno.test("ERRORED → row error with the reason", async () => {
  const d = deps();
  await handleEvent(REC("ERRORED", { error: "recorder crashed" }), d);
  const row = d.upserts[d.upserts.length - 1];
  assertEquals(row.status, "error"); assertEquals(row.error, "recorder crashed");
});

Deno.test("the same event twice is handled once", async () => {
  const d = deps();
  await handleEvent(REC("UPLOADED"), d);
  await handleEvent(REC("UPLOADED"), d);
  assertEquals(d.copies.length, 1); assertEquals(d.upserts.length, 1);
});

Deno.test("a recording for a meeting we do not know is ignored (200)", async () => {
  const d = deps();
  const r = await handleEvent(REC("UPLOADED", { meetingId: "meet-x" }), d);
  assertEquals(r.status, 200); assertEquals(d.upserts.length, 0); assertEquals(d.copies.length, 0);
});

Deno.test("meeting.ended is recorded and nothing else happens", async () => {
  const d = deps();
  const r = await handleEvent({ event: "meeting.ended", meeting: { id: "meet-7", sessionId: "s", endedAt: "2026-09-14T20:00:00Z" }, reason: "ALL_PARTICIPANTS_LEFT" }, d);
  assertEquals(r.status, 200); assertEquals(d.upserts.length, 0);
});

Deno.test("an event without a recognisable shape is a 200 no-op", async () => {
  const d = deps();
  const r = await handleEvent({ event: "recording.statusUpdate" }, d);
  assertEquals(r.status, 200); assertEquals(d.upserts.length, 0);
});

Deno.test("a late RECORDING after ready is ignored — the row never moves backwards", async () => {
  const d = deps();
  await handleEvent(REC("UPLOADED"), d);
  const r = await handleEvent(REC("RECORDING"), d);
  assertEquals((r.body as { ignored?: string }).ignored, "stale");
  assertEquals(d.upserts.length, 1); assertEquals(d.upserts[0].status, "ready");
});

Deno.test("a failed row can still be healed by a later successful upload", async () => {
  const d = deps({ streamCopy: async () => { throw new Error("stream down"); } });
  await handleEvent(REC("UPLOADED"), d);
  assertEquals(d.upserts[0].status, "error");
  d.streamCopy = async () => ({ uid: "uid-2" });
  d.dedupe = async () => true;   /* a Retry bypasses dedupe */
  await handleEvent(REC("UPLOADED"), d);
  assertEquals(d.upserts[1].status, "ready");
});

Deno.test("an ERRORED event after ready does not un-ready a replay", async () => {
  const d = deps();
  await handleEvent(REC("UPLOADED"), d);
  await handleEvent(REC("ERRORED", { error: "late noise" }), d);
  assertEquals(d.upserts.length, 1); assertEquals(d.upserts[0].status, "ready");
});

Deno.test("a stranger's validly-signed event leaves no trace: target lookup runs before the dedupe write", async () => {
  const ids: string[] = [];
  const d = deps({ dedupe: async (id) => { ids.push(id); return true; } });
  await handleEvent(REC("UPLOADED", { meetingId: "meet-x" }), d);
  assertEquals(ids.length, 0); assertEquals(d.upserts.length, 0);
});

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

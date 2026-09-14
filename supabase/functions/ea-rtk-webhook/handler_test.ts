// deno test supabase/functions/ea-rtk-webhook/
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifySignature, handleEvent, type WebhookDeps } from "./handler.ts";

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

Deno.test("RECORDING → the row is recording, no Stream copy", async () => {
  const d = deps();
  const r = await handleEvent(REC("RECORDING"), d);
  assertEquals(r.status, 200);
  assertEquals(d.upserts.length, 1);
  assertEquals(d.upserts[0].recording_id, "rec-1"); assertEquals(d.upserts[0].status, "recording"); assertEquals(d.upserts[0].session_no, 7);
  assertEquals(d.copies.length, 0);
});

Deno.test("UPLOADED → copied into Stream, row ready with the watch URL", async () => {
  const d = deps();
  await handleEvent(REC("UPLOADED"), d);
  assertEquals(d.copies, [{ url: "https://dl/rec-1.mp4", name: "OPIL 07 · Agents 101" }]);
  const row = d.upserts[d.upserts.length - 1];
  assertEquals(row.status, "ready"); assertEquals(row.stream_uid, "uid-abc");
  assertEquals(row.watch_url, "https://customer-xyz.cloudflarestream.com/uid-abc/watch");
  assertEquals(row.download_url, "https://dl/rec-1.mp4"); assertEquals(row.duration_s, 1800); assertEquals(row.file_size, 2044680);
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

Deno.test("a stranger's validly-signed event leaves no trace: session lookup runs before the dedupe write", async () => {
  const ids: string[] = [];
  const d = deps({ dedupe: async (id) => { ids.push(id); return true; } });
  await handleEvent(REC("UPLOADED", { meetingId: "meet-x" }), d);
  assertEquals(ids.length, 0); assertEquals(d.upserts.length, 0);
});

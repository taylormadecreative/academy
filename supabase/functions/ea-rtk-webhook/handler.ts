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
  | { kind: "room"; room: { id: string; slug: string; title: string | null; startedAt: string | null } }
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
export type Reply = { status: number; body: unknown };

const STATUS: Record<string, string> = { INVOKED: "invoked", RECORDING: "recording", UPLOADING: "uploading", UPLOADED: "uploaded", ERRORED: "error" };
/* Events can arrive late or twice. A row only ever moves forward: a straggling RECORDING after
   ready must not un-ready a published replay. error sits just under ready so a retry can heal it. */
const RANK: Record<string, number> = { invoked: 1, recording: 2, uploading: 3, uploaded: 4, error: 4.5, ready: 5 };

/* RSASSA-PKCS1-v1_5 / SHA-256 over the raw body, the way Cloudflare's own sample does it. */
export async function verifySignature(publicKeyPem: string, signatureB64: string, body: Uint8Array<ArrayBuffer>): Promise<boolean> {
  try {
    const clean = publicKeyPem.replace(/\\n/g, "").replace(/-----BEGIN PUBLIC KEY-----/, "").replace(/-----END PUBLIC KEY-----/, "").replace(/\s+/g, "");
    const key = await crypto.subtle.importKey("spki", Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, body);
  } catch (_) { return false; }
}

const sessLabel = (s: { no: number; kind: string | null }) =>
  s.kind === "curriculum" ? "S" + (s.no % 100) : s.kind === "hpc" ? "H" + (s.no % 100) : String(s.no).padStart(2, "0");

/* The name the file gets in Cloudflare Stream. OPIL: unchanged. Room: '<Prefix> · <title> · YYYY-MM-DD',
   the date being the day that session started in Chicago (an 8 pm class that uploads after midnight
   UTC still says the evening's date); no startedAt → today. Prefix is "Academy" for the Academy
   room (slug "academy") and the slug itself, uppercased, for any other room (e.g. "HT"). */
const CHICAGO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" });
const streamName = (t: Target): string => {
  if (t.kind === "opil") return `OPIL ${sessLabel(t.session)} · ${t.session.title || "session"}`;
  const started = t.room.startedAt ? new Date(t.room.startedAt) : new Date();
  const day = CHICAGO_DAY.format(Number.isNaN(started.getTime()) ? new Date() : started);
  const prefix = t.room.slug === "academy" ? "Academy" : t.room.slug.toUpperCase();
  return `${prefix} · ${t.room.title || "session"} · ${day}`;
};

export async function handleEvent(payload: Record<string, unknown>, deps: WebhookDeps): Promise<Reply> {
  const event = String(payload.event || "");
  const rec = (payload.recording || {}) as Record<string, unknown>;
  const mtg = (payload.meeting || {}) as Record<string, unknown>;

  if (event === "meeting.ended") {
    const id = `meeting.ended:${mtg.id ?? ""}:${mtg.endedAt ?? ""}`;
    await deps.dedupe(id, event, payload);
    return { status: 200, body: { ok: true, noted: true } };
  }
  if (event !== "recording.statusUpdate") return { status: 200, body: { ok: true, ignored: event } };

  const recordingId = typeof rec.id === "string" ? rec.id : typeof rec.recordingId === "string" ? rec.recordingId : "";
  const meetingId = typeof rec.meetingId === "string" ? rec.meetingId : typeof mtg.id === "string" ? mtg.id : "";
  const raw = String(rec.status || "");
  const status = STATUS[raw];
  if (!recordingId || !meetingId || !status) return { status: 200, body: { ok: true, ignored: "shape" } };

  /* a valid signature only proves Cloudflare sent it — the key is global to RealtimeKit, so look
     the meeting up BEFORE writing anything: a stranger's event never leaves a row behind */
  const target = await deps.targetByMeeting(meetingId);
  if (!target) return { status: 200, body: { ok: true, ignored: "unknown_meeting" } };

  if (!(await deps.dedupe(`${recordingId}:${raw}`, event, payload))) return { status: 200, body: { ok: true, duplicate: true } };

  const have = await deps.currentStatus(recordingId, target);
  const incoming = status === "uploaded" && typeof rec.downloadUrl === "string" ? "ready" : status;   /* what this event will land as */
  if (have && (RANK[incoming] ?? 0) <= (RANK[have] ?? 0) && !(have === "error" && incoming === "ready")) {
    return { status: 200, body: { ok: true, ignored: "stale", have, incoming } };
  }

  /* the owner column comes first so an OPIL row is the exact object it was before rooms existed */
  const row: ReplayRow = {
    ...(target.kind === "room" ? { room_id: target.room.id } : { session_no: target.session.no }),
    meeting_id: meetingId, recording_id: recordingId, status,
    download_url: typeof rec.downloadUrl === "string" ? rec.downloadUrl : null,
    download_expires_at: typeof rec.downloadUrlExpiry === "string" ? rec.downloadUrlExpiry : null,
    duration_s: Number.isFinite(Number(rec.recordingDuration)) ? Math.round(Number(rec.recordingDuration)) : null,   /* Cloudflare sends 102.783; the column is whole seconds */
    file_size: Number.isFinite(Number(rec.fileSize)) ? Math.round(Number(rec.fileSize)) : null,
    error: status === "error" ? String(rec.error || rec.errorMessage || "recording failed").slice(0, 500) : null,
  };

  if (status === "uploaded" && row.download_url) {
    const name = streamName(target).slice(0, 120);
    try {
      const { uid } = await deps.streamCopy(row.download_url, name);
      row.stream_uid = uid;
      row.watch_url = `https://${deps.subdomain}.cloudflarestream.com/${uid}/watch`;
      row.status = "ready";
    } catch (e) {
      row.status = "error";
      row.error = ("Stream copy failed: " + String((e as Error)?.message || e)).slice(0, 500);
    }
  }

  await deps.upsertReplay(row, target);
  return { status: 200, body: { ok: true, status: row.status } };
}

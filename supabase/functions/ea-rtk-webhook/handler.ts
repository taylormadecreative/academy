// ea-rtk-webhook — what RealtimeKit tells us about a recording becomes a draft replay.
//   RECORDING / UPLOADING / UPLOADED / ERRORED → ea_opil_replays.status
//   UPLOADED → copy the file into Cloudflare Stream → status ready + the watch URL
// Pure: index.ts injects `deps` (database + Stream); handler_test.ts stubs them. Every
// verified event answers 200 — RealtimeKit retries anything else and a bad row is ours to fix.

export type ReplayRow = {
  session_no: number | null; meeting_id: string; recording_id: string; status: string;
  download_url?: string | null; download_expires_at?: string | null; stream_uid?: string | null;
  watch_url?: string | null; duration_s?: number | null; file_size?: number | null; error?: string | null;
};
export type WebhookDeps = {
  dedupe: (id: string, event: string, payload: unknown) => Promise<boolean>;   // true = first time we see it
  sessionByMeeting: (meetingId: string) => Promise<{ no: number; title: string | null; kind: string | null } | null>;
  upsertReplay: (row: ReplayRow) => Promise<void>;
  streamCopy: (url: string, name: string) => Promise<{ uid: string }>;
  subdomain: string;   // customer-xxxx
};
export type Reply = { status: number; body: unknown };

const STATUS: Record<string, string> = { INVOKED: "invoked", RECORDING: "recording", UPLOADING: "uploading", UPLOADED: "uploaded", ERRORED: "error" };

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

  if (!(await deps.dedupe(`${recordingId}:${raw}`, event, payload))) return { status: 200, body: { ok: true, duplicate: true } };

  const session = await deps.sessionByMeeting(meetingId);
  if (!session) return { status: 200, body: { ok: true, ignored: "unknown_meeting" } };

  const row: ReplayRow = {
    session_no: session.no, meeting_id: meetingId, recording_id: recordingId, status,
    download_url: typeof rec.downloadUrl === "string" ? rec.downloadUrl : null,
    download_expires_at: typeof rec.downloadUrlExpiry === "string" ? rec.downloadUrlExpiry : null,
    duration_s: Number.isFinite(Number(rec.recordingDuration)) ? Math.round(Number(rec.recordingDuration)) : null,   /* Cloudflare sends 102.783; the column is whole seconds */
    file_size: Number.isFinite(Number(rec.fileSize)) ? Math.round(Number(rec.fileSize)) : null,
    error: status === "error" ? String(rec.error || rec.errorMessage || "recording failed").slice(0, 500) : null,
  };

  if (status === "uploaded" && row.download_url) {
    const name = `OPIL ${sessLabel(session)} · ${session.title || "session"}`.slice(0, 120);
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

  await deps.upsertReplay(row);
  return { status: 200, body: { ok: true, status: row.status } };
}

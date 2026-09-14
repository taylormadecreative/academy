// ea-rtk-record — the pure decisions behind "the class records itself".
//   start  (host)  : begin a RealtimeKit recording of the session's meeting; idempotent
//   stop   (host)  : stop the active recording (the webhook reports what happens next)
//   register_webhook / list_webhooks (admin) : one-time wiring of ea-rtk-webhook
// No network, no env, no supabase here: index.ts injects `deps`, handler_test.ts stubs them.

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type Caller = { user: { id: string; email?: string | null }; role: Role; functionsBase: string };
export type RecordBody = { session_no?: number; action?: "start" | "stop" | "retry_replay" | "register_webhook" | "list_webhooks" };
export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
export type ActiveReplay = { recording_id: string; status: string };
export type CfResult = { ok: boolean; status: number; data: unknown };
export type RecordDeps = {
  getSession: (no: number) => Promise<SessionRow | null>;
  latestActive: (meetingId: string) => Promise<ActiveReplay | null>;
  insertReplay: (row: { session_no: number; meeting_id: string; recording_id: string; status: string }) => Promise<void>;
  cf: (method: "GET" | "POST" | "PUT", path: string, body?: unknown) => Promise<CfResult>;
  /* Retry: the latest replay for a meeting (any status), the stored UPLOADED event for it, and
     the same processing the webhook does — dedupe bypassed on purpose. */
  latestAny: (meetingId: string) => Promise<{ recording_id: string; status: string } | null>;
  uploadedEvent: (recordingId: string) => Promise<Record<string, unknown> | null>;
  reprocess: (payload: Record<string, unknown>) => Promise<{ status: string }>;
};
export type Reply = { status: number; body: unknown };

const RTK_PREFIX = "rtk:";
const ACTIONS = ["start", "stop", "retry_replay", "register_webhook", "list_webhooks"] as const;

export async function handleRecord(body: RecordBody, ctx: Caller, deps: RecordDeps): Promise<Reply> {
  const action = body.action;
  if (!action || !(ACTIONS as readonly string[]).includes(action)) return { status: 400, body: { error: "bad_action" } };

  if (action === "register_webhook" || action === "list_webhooks") {
    if (!ctx.role.admin) return { status: 403, body: { error: "not_admin" } };
    if (action === "register_webhook") {
      const r = await deps.cf("POST", "/webhooks", {
        name: "taylormade-academy replays",
        url: ctx.functionsBase + "/ea-rtk-webhook",
        events: ["recording.statusUpdate", "meeting.ended"],
        enabled: true,
      });
      if (!r.ok) return { status: 502, body: { error: "cloudflare_" + r.status } };
      const d = (r.data || {}) as Record<string, unknown>;
      return { status: 200, body: { ok: true, id: d.id ?? null } };
    }
    const r = await deps.cf("GET", "/webhooks");
    if (!r.ok) return { status: 502, body: { error: "cloudflare_" + r.status } };
    // only the fields a coordinator needs to see; never echo a secret back to a browser
    const list = Array.isArray(r.data) ? r.data : [];
    return { status: 200, body: { webhooks: list.map((w) => { const x = w as Record<string, unknown>; return { id: x.id, url: x.url, events: x.events, enabled: x.enabled }; }) } };
  }

  const no = Number(body.session_no);
  if (!Number.isInteger(no)) return { status: 400, body: { error: "bad_session" } };
  const isHost = ctx.role.admin || ctx.role.facilitator_sessions.includes(no);
  if (!isHost) return { status: 403, body: { error: "not_host" } };
  const s = await deps.getSession(no);
  if (!s) return { status: 404, body: { error: "not_found" } };
  const meetingId = typeof s.stream_url === "string" && s.stream_url.startsWith(RTK_PREFIX) ? s.stream_url.slice(RTK_PREFIX.length) : null;
  if (!meetingId) return { status: 409, body: { error: "no_room" } };

  if (action === "retry_replay") {
    const last = await deps.latestAny(meetingId);
    if (!last) return { status: 404, body: { error: "no_replay" } };
    const payload = await deps.uploadedEvent(last.recording_id);
    if (!payload) return { status: 409, body: { error: "not_uploaded_yet" } };
    const out = await deps.reprocess(payload);
    return { status: 200, body: { recording_id: last.recording_id, status: out.status } };
  }

  const active = await deps.latestActive(meetingId);
  if (action === "start") {
    if (active) return { status: 200, body: { recording_id: active.recording_id, status: active.status, reused: true } };
    const r = await deps.cf("POST", "/recordings", { meeting_id: meetingId });
    const d = (r.data || {}) as Record<string, unknown>;
    const recordingId = typeof d.id === "string" ? d.id : "";
    if (!r.ok || !recordingId) return { status: 502, body: { error: "cloudflare_" + r.status } };
    await deps.insertReplay({ session_no: no, meeting_id: meetingId, recording_id: recordingId, status: "invoked" });
    return { status: 200, body: { recording_id: recordingId, status: "invoked", reused: false } };
  }
  // stop
  if (!active) return { status: 200, body: { stopped: false } };
  const r = await deps.cf("PUT", `/recordings/${active.recording_id}`, { action: "stop" });
  if (!r.ok) return { status: 502, body: { error: "cloudflare_" + r.status } };
  return { status: 200, body: { stopped: true, recording_id: active.recording_id } };
}

// ea-rtk-record — the pure decisions behind "the class records itself".
//   start  (host)  : begin a RealtimeKit recording of the meeting; idempotent
//   stop   (host)  : stop the active recording (the webhook reports what happens next)
//   retry_replay   : re-run a failed replay's stored UPLOADED event
//   register_webhook / list_webhooks (admin) : one-time wiring of ea-rtk-webhook
// Two branches share the start/stop rules: { session_no } is an OPIL class (ea_opil_replays,
// host = coordinator or that session's facilitator); { room: true } is Nelson's Academy room
// (ea_room_replays, host = the Academy admin, retry by replay_id).
// No network, no env, no supabase here: index.ts injects `deps`, handler_test.ts stubs them.

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type Caller = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; functionsBase: string };
export type RecordBody = { room?: boolean; replay_id?: string; session_no?: number; action?: "start" | "stop" | "retry_replay" | "register_webhook" | "list_webhooks" };
export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
export type ActiveReplay = { recording_id: string; status: string };
export type CfResult = { ok: boolean; status: number; data: unknown };
/* One store per replay table. The OPIL store is the top level of RecordDeps (ea_opil_replays,
   today's names); the room store is deps.room (ea_room_replays). Same calls, different table. */
export type ReplayStore = {
  latestActive: (meetingId: string) => Promise<ActiveReplay | null>;
  latestAny: (meetingId: string) => Promise<{ recording_id: string; status: string } | null>;
  insertReplay: (row: { session_no?: number; room_id?: string; meeting_id: string; recording_id: string; status: string }) => Promise<void>;
  /* a row we believed active turned out not to be (Cloudflare says so): record the truth */
  updateReplayStatus: (recordingId: string, status: string) => Promise<void>;
};
export type RecordDeps = ReplayStore & {
  getSession: (no: number) => Promise<SessionRow | null>;
  cf: (method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) => Promise<CfResult>;
  /* Retry: the stored UPLOADED event for a recording, and the same processing the webhook
     does — dedupe bypassed on purpose. */
  uploadedEvent: (recordingId: string) => Promise<Record<string, unknown> | null>;
  reprocess: (payload: Record<string, unknown>) => Promise<{ status: string }>;
  /* the Academy room — one row, read with the service role */
  getRoom: () => Promise<{ id: string; meeting_id: string | null } | null>;
  /* every meeting that is or was the room's: ea_rooms.meeting_id ∪ ea_room_replays.meeting_id */
  roomMeetingIds: () => Promise<Set<string>>;
  room: ReplayStore & { replayById: (id: string) => Promise<{ id: string; room_id: string | null; meeting_id: string; recording_id: string; status: string } | null> };
};
export type Reply = { status: number; body: unknown };

const RTK_PREFIX = "rtk:";
const ACTIONS = ["start", "stop", "retry_replay", "register_webhook", "list_webhooks"] as const;
const MAX_SECONDS = 4 * 3600;   /* a tab left open cannot record for a day */
const CF_STATUS: Record<string, string> = { INVOKED: "invoked", RECORDING: "recording", UPLOADING: "uploading", UPLOADED: "uploaded", ERRORED: "error" };
const WEBHOOK_EVENTS = ["recording.statusUpdate", "meeting.ended"];
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;   /* ea_room_replays.id */

export async function handleRecord(body: RecordBody, ctx: Caller, deps: RecordDeps): Promise<Reply> {
  const action = body.action;
  if (!action || !(ACTIONS as readonly string[]).includes(action)) return { status: 400, body: { error: "bad_action" } };

  if (action === "register_webhook" || action === "list_webhooks") {
    if (!ctx.role.admin) return { status: 403, body: { error: "not_admin" } };
    const target = ctx.functionsBase + "/ea-rtk-webhook";
    const listed = await deps.cf("GET", "/webhooks");
    // Cloudflare answers 404 for "no webhooks yet"; anything else that is not ok is a real failure
    if (!listed.ok && listed.status !== 404) return { status: 502, body: { error: "cloudflare_" + listed.status } };
    const list = (Array.isArray(listed.data) ? listed.data : []).map((w) => w as Record<string, unknown>);
    if (action === "register_webhook") {
      const have = list.find((w) => w.url === target);
      if (have) return { status: 200, body: { ok: true, id: have.id ?? null, existing: true } };   /* idempotent */
      const r = await deps.cf("POST", "/webhooks", { name: "taylormade-academy replays", url: target, events: WEBHOOK_EVENTS, enabled: true });
      if (!r.ok) return { status: 502, body: { error: "cloudflare_" + r.status } };
      const d = (r.data || {}) as Record<string, unknown>;
      return { status: 200, body: { ok: true, id: d.id ?? null, existing: false } };
    }
    // only the fields a coordinator needs to see; never echo a secret back to a browser
    return { status: 200, body: { webhooks: list.map((x) => ({ id: x.id, url: x.url, events: x.events, enabled: x.enabled })) } };
  }

  if (body.room === true) return handleRoom(action, body, ctx, deps);

  // ── OPIL branch: exactly the rules the cohort has today ──
  const no = Number(body.session_no);
  if (!Number.isInteger(no)) return { status: 400, body: { error: "bad_session" } };
  const isHost = ctx.role.admin || ctx.role.facilitator_sessions.includes(no);
  if (!isHost) return { status: 403, body: { error: "not_host" } };
  const s = await deps.getSession(no);
  if (!s) return { status: 404, body: { error: "not_found" } };
  const meetingId = typeof s.stream_url === "string" && s.stream_url.startsWith(RTK_PREFIX) ? s.stream_url.slice(RTK_PREFIX.length) : null;
  if (!meetingId) return { status: 409, body: { error: "no_room" } };
  /* A session whose stream_url points at Nelson's Academy room meeting records nothing:
     no OPIL role can record or file a replay of the room (room spec §6.2, §9.11). */
  if ((await deps.roomMeetingIds()).has(meetingId)) return { status: 403, body: { error: "not_allowed" } };

  if (action === "retry_replay") {
    const last = await deps.latestAny(meetingId);
    if (!last) return { status: 404, body: { error: "no_replay" } };
    /* only a FAILED replay is retried: a second run on a ready one would mint another Stream copy */
    if (last.status !== "error") return { status: 409, body: { error: "nothing_to_retry" } };
    const payload = await deps.uploadedEvent(last.recording_id);
    if (!payload) return { status: 409, body: { error: "no_upload" } };   /* it errored before ever uploading */
    const out = await deps.reprocess(payload);
    return { status: 200, body: { recording_id: last.recording_id, status: out.status } };
  }
  const out = await startOrStop(action, meetingId, { session_no: no }, deps, deps.cf);
  /* Leave = end of the class for everyone (Nelson, 9/14): once the host's recording is stopped, close the
     meeting so students are not left in an empty room, and a kept token cannot re-enter it. The page that
     started the class also removes everyone before it leaves; this is the server-side backstop. */
  if (action === "stop" && out.status === 200) await inactivate(meetingId, deps.cf, "class");
  return out;
}

/* Close a Cloudflare meeting. Best effort, never silent, never the answer. */
async function inactivate(meetingId: string, cf: RecordDeps["cf"], what: "room" | "class"): Promise<void> {
  const off = await cf("PATCH", `/meetings/${meetingId}`, { status: "INACTIVE" }).catch((e) => ({ ok: false, status: 0, data: String(e) }));
  if (!off.ok) console.warn(`[ea-rtk-record] ${what} meeting not inactivated`, meetingId, off.status);
}

/* ── Room branch: Nelson's Academy room. Only the Academy admin is its host. ── */
async function handleRoom(action: "start" | "stop" | "retry_replay", body: RecordBody, ctx: Caller, deps: RecordDeps): Promise<Reply> {
  if (!ctx.academyAdmin) return { status: 403, body: { error: "not_host" } };

  if (action === "retry_replay") {
    /* Every Start class is a NEW meeting, so "latest replay of the current meeting" is the wrong
       row the morning after. The page names the replay it wants retried. */
    const replayId = typeof body.replay_id === "string" ? body.replay_id.trim() : "";
    if (!UUID_RX.test(replayId)) return { status: 400, body: { error: "bad_replay" } };
    const row = await deps.room.replayById(replayId);
    if (!row) return { status: 404, body: { error: "no_replay" } };
    if (row.status !== "error") return { status: 409, body: { error: "nothing_to_retry" } };
    const payload = await deps.uploadedEvent(row.recording_id);
    if (!payload) return { status: 409, body: { error: "no_upload" } };
    const out = await deps.reprocess(payload);
    return { status: 200, body: { recording_id: row.recording_id, status: out.status } };
  }

  const room = await deps.getRoom();
  if (!room) return { status: 404, body: { error: "not_found" } };
  if (!room.meeting_id) return { status: 409, body: { error: "no_room" } };   /* Start class has not run yet */
  const out = await startOrStop(action, room.meeting_id, { room_id: room.id }, deps.room, deps.cf);
  /* stop = the session is over (Leave, or End session from /live/): close the Cloudflare meeting too, so a
     guest's kept token cannot re-enter the empty meeting and bill minutes until the next Start class (which
     always mints a fresh meeting — nothing reuses this one). Best effort, never silent, never the answer. */
  if (action === "stop" && out.status === 200) await inactivate(room.meeting_id, deps.cf, "room");
  return out;
}

/* ── start / stop, the same for both tables. `ref` is the column that files the row:
   { session_no } for OPIL, { room_id } for the room. ── */
async function startOrStop(action: "start" | "stop", meetingId: string, ref: { session_no?: number; room_id?: string }, store: ReplayStore, cf: RecordDeps["cf"]): Promise<Reply> {
  let active = await store.latestActive(meetingId);
  if (action === "start") {
    if (active) {
      /* Trust but verify: a lost webhook would leave this row "recording" forever and block every
         later class of this session. Ask Cloudflare; if it is over, record that and start fresh. */
      const chk = await cf("GET", `/recordings/${active.recording_id}`);
      const raw = String(((chk.data || {}) as Record<string, unknown>).status || "");
      if (chk.ok && raw && raw !== "INVOKED" && raw !== "RECORDING") {
        await store.updateReplayStatus(active.recording_id, CF_STATUS[raw] || "error");
        active = null;
      } else {
        return { status: 200, body: { recording_id: active.recording_id, status: active.status, reused: true } };
      }
    }
    const r = await cf("POST", "/recordings", { meeting_id: meetingId, max_seconds: MAX_SECONDS });
    const d = (r.data || {}) as Record<string, unknown>;
    const recordingId = typeof d.id === "string" ? d.id : "";
    if (!r.ok || !recordingId) return { status: 502, body: { error: "cloudflare_" + r.status } };
    await store.insertReplay({ ...ref, meeting_id: meetingId, recording_id: recordingId, status: "invoked" });
    return { status: 200, body: { recording_id: recordingId, status: "invoked", reused: false } };
  }
  // stop
  if (!active) return { status: 200, body: { stopped: false } };
  const r = await cf("PUT", `/recordings/${active.recording_id}`, { action: "stop" });
  if (!r.ok) return { status: 502, body: { error: "cloudflare_" + r.status } };
  return { status: 200, body: { stopped: true, recording_id: active.recording_id } };
}

// ea-rtk-join — the pure decisions behind "hand this signed-in person a token for the meeting".
// No network, no env, no supabase here: index.ts injects `deps`, handler_test.ts stubs them.
//
// OPIL branch (body.room !== true) — the one-file function of 9/11–9/14, ported line for line,
// with two hardenings the critique of the Academy room asked for:
//   · a client-supplied meeting_id is IGNORED. The meeting is the session's stored "rtk:" id or
//     one a host creates here; a student on a session with no stored id gets 409 not_open.
//   · a session whose meeting is the Academy room's (ea_rooms.meeting_id, or any
//     ea_room_replays.meeting_id) is refused with 403 not_allowed before a participant is minted.
//   coordinator (role.admin) or facilitator of this session  -> opil-host
//   judge (role.judge)                                       -> opil-judge   (watch + chat, no media)
//   cohort member (ea_opil_in_cohort)                        -> opil-student
//   anyone else                                              -> 403 not_allowed
//
// Room branch (body.room === true): the Academy room — handleRoomJoin at the end of this file.
// Nothing on the OPIL path runs for a room body.

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type JoinBody = { room?: boolean; key?: string | null; session_no?: number; meeting_id?: string };
export type Caller = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; ip: string };
export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
export type RoomRow = { id: string; title: string; link_key: string; is_live: boolean; live_since: string | null; meeting_id: string | null; max_participants: number };
export type CfResult = { ok: boolean; status: number; data: unknown };
export type JoinDeps = {
  cf: (method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) => Promise<CfResult>;
  rateCheck: (key: string, max: number, windowSecs: number) => Promise<boolean | null>;   /* null = limiter unavailable → treat as allowed */
  getSession: (no: number) => Promise<SessionRow | null>;      /* OPIL row, service role */
  inCohort: () => Promise<boolean>;                             /* rpc ea_opil_in_cohort AS CALLER */
  isMember: () => Promise<boolean>;                             /* rpc ea_is_member AS CALLER */
  getRoom: () => Promise<RoomRow | null>;                       /* order by created_at limit 1, service role */
  setRoomMeeting: (roomId: string, meetingId: string) => Promise<void>;   /* service role update */
  roomMeetingIds: () => Promise<Set<string>>;                   /* ea_rooms.meeting_id ∪ ea_room_replays.meeting_id (non-null) */
  upsertMember: (roomId: string, userId: string) => Promise<void>;
  displayName: (userId: string) => Promise<string | null>;      /* ea_profiles.display_name */
  ensurePresets: () => Promise<void>;
  now: () => Date;
};
export type Reply = { status: number; body: unknown };
export const PRESETS = ["opil-host", "opil-student", "opil-judge", "tma-class-host", "tma-class-guest"] as const;
export const OPEN_WINDOW_MS = 4 * 3600 * 1000;   /* a room left live by a dead tab admits guests for this long */

const RTK_PREFIX = "rtk:";

export async function handleJoin(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  if (body.room === true) return handleRoomJoin(body, ctx, deps);
  return joinOpil(body, ctx, deps);
}

async function joinOpil(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  const no = Number(body.session_no);
  if (!Number.isInteger(no)) return { status: 400, body: { error: "bad_session" } };

  // Role check ran AS THE CALLER in resolveCaller (ea_opil_my_role); the cohort check runs here,
  // only when the cheaper answers said no — exactly the order the one-file function used.
  const isHost = ctx.role.admin === true || ctx.role.facilitator_sessions.includes(no);
  let preset: typeof PRESETS[number] | null = null;
  if (isHost) preset = "opil-host";
  else if (ctx.role.judge === true) preset = "opil-judge";
  else if (await deps.inCohort()) preset = "opil-student";
  if (!preset || !PRESETS.includes(preset)) return { status: 403, body: { error: "not_allowed" } };

  // The session row is the shared source of truth for which meeting this is. Read with the
  // service role so a student who cannot yet see the row still gets the right meeting.
  const row = await deps.getSession(no);
  if (!row) return { status: 404, body: { error: "not_found" } };
  const stored = typeof row.stream_url === "string" && row.stream_url.startsWith(RTK_PREFIX) ? row.stream_url.slice(RTK_PREFIX.length) : null;

  let meetingId = stored;
  if (!meetingId) {
    // Only a host opens a room. A student arriving before the facilitator gets a plain 409 so the
    // page can say "the room opens when your facilitator starts it" instead of spending minutes.
    if (!isHost) return { status: 409, body: { error: "not_open" } };
    const made = await deps.cf("POST", "/meetings", { title: `OPIL ${no} — ${String(row.title || "session").slice(0, 80)}`, persist_chat: false });
    if (!made.ok) return { status: 502, body: { error: "cloudflare_" + made.status } };
    meetingId = String(((made.data || {}) as Record<string, unknown>).id || "");
    if (!meetingId) return { status: 502, body: { error: "cloudflare_no_id" } };
  }

  // The Academy room's meeting is never an OPIL class: a facilitator who points a session's
  // stream_url at it gets nothing, whatever their OPIL role.
  if ((await deps.roomMeetingIds()).has(meetingId)) return { status: 403, body: { error: "not_allowed" } };

  // One participant per person per meeting. custom_participant_id is the Supabase uid — never an email.
  const name = String((await deps.displayName(ctx.user.id)) || (ctx.user.email || "Member").split("@")[0]).slice(0, 60);
  const added = await deps.cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: ctx.user.id, preset_name: preset, name });
  if (!added.ok) return { status: 502, body: { error: "cloudflare_" + added.status } };
  const token = ((added.data || {}) as Record<string, unknown>).token;

  return { status: 200, body: { token, meeting_id: meetingId, preset, host: isHost, name } };
}

/* ───────────── the Academy room (body.room === true) ─────────────
   One room, one link. Nelson (ea_is_admin) is the host; a person gets in with the current link key
   or an Academy membership, only while Nelson is live (and for at most 4 h after he started, the
   recording cap — a tab that died leaves is_live true). Every Start class is a fresh Cloudflare
   meeting and the previous one is set INACTIVE, so a token from last time opens nothing. People are
   never told the meeting id; a client-supplied meeting_id is never read. */

const KEY_RX = /^[A-Za-z0-9_-]{22}$/;
/* YYYY-MM-DD in America/Chicago (en-CA prints ISO order) — the meeting title people see in the dashboard */
const CHICAGO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });

async function handleRoomJoin(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  const uid = ctx.user.id;
  /* 1 — rate limit, fail-open (null = the limiter is down → allowed), before any Cloudflare call */
  if ((await deps.rateCheck("rtk-join:u:" + uid, 30, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  if ((await deps.rateCheck("rtk-join:ip:" + ctx.ip, 90, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  /* 2 — the room */
  const room = await deps.getRoom();
  if (!room) return { status: 503, body: { error: "rtk_not_configured" } };
  /* 3 — who is this: Nelson, a member, or someone holding the current link */
  const isHost = ctx.academyAdmin;
  const key = typeof body.key === "string" && KEY_RX.test(body.key) ? body.key : null;
  if (!isHost) {
    const allowed = (await deps.isMember()) || (key !== null && key === room.link_key);
    if (!allowed) return key ? { status: 404, body: { error: "bad_link" } } : { status: 403, body: { error: "not_allowed" } };
  }
  /* 4 — is the room open: live, and started less than 4 h ago */
  const open = room.is_live && !!room.live_since && (deps.now().getTime() - Date.parse(room.live_since)) < OPEN_WINDOW_MS;
  if (!isHost && !open) return { status: 409, body: { error: "not_open" } };
  /* 5 — the meeting: Nelson starting (or re-starting a stale room) gets a fresh one; a live Nelson and people reuse it */
  let meetingId: string | null = room.meeting_id;
  if (isHost && (!open || !meetingId)) {
    const title = ("Academy · " + room.title + " · " + CHICAGO_DAY.format(deps.now())).slice(0, 80);
    const made = await deps.cf("POST", "/meetings", { title, persist_chat: false });
    if (!made.ok) return { status: 502, body: { error: "cloudflare_" + made.status } };
    const id = String(((made.data || {}) as Record<string, unknown>).id || "");
    if (!id) return { status: 502, body: { error: "cloudflare_no_id" } };
    await deps.setRoomMeeting(room.id, id);
    if (room.meeting_id) {
      /* best effort: the previous meeting closes so an old token opens nothing, not even an empty billable session */
      try { await deps.cf("PATCH", `/meetings/${room.meeting_id}`, { status: "INACTIVE" }); } catch (_) { /* ignored */ }
    }
    meetingId = id;
  }
  if (!meetingId) return { status: 409, body: { error: "not_open" } };
  /* 6 — Nelson makes sure the two presets exist on Cloudflare (cached; never throws) */
  if (isHost) await deps.ensurePresets();
  /* 7 — the cap, people only; Cloudflare counts Nelson too ("Max people (you included)"); 404 = no session yet */
  if (!isHost) {
    const r = await deps.cf("GET", `/meetings/${meetingId}/active-session`);
    const live = r.status === 404 ? 0 : Number(((r.data || {}) as Record<string, unknown>).live_participants ?? 0);
    if (live >= room.max_participants) return { status: 429, body: { error: "room_full" } };
  }
  /* 8 — one participant per person; custom_participant_id is the Supabase uid, never an email */
  const name = String((await deps.displayName(uid)) || (ctx.user.email || "Member").split("@")[0]).slice(0, 60);
  const preset = isHost ? "tma-class-host" : "tma-class-guest";
  const added = await deps.cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: uid, preset_name: preset, name });
  if (!added.ok) return { status: 502, body: { error: "cloudflare_" + added.status } };
  const token = ((added.data || {}) as Record<string, unknown>).token;
  /* 9 — who joined (the Your room card on /live/ reads it) */
  await deps.upsertMember(room.id, uid);
  /* 10 — only Nelson learns the meeting id */
  return { status: 200, body: isHost ? { token, meeting_id: meetingId, preset, host: true, name } : { token, preset, host: false, name } };
}

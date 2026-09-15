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
// Room branch (body.room === true): the Academy room. Until it is built, a room body answers
// 404 not_found — nothing on the OPIL path runs for it.

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
  if (body.room === true) return { status: 404, body: { error: "not_found" } };
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

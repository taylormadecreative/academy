// ea-opil-pass — the rules. An approved OPIL student types the email they applied with and is
// signed in on the spot: no code, no inbox (Nelson, 9/16, the first class ever: "make it to
// where the students do not need codes to get into the classroom … they've already been approved").
// The email is the whole proof, so the list is the gate: only a row in ea_opil_registrations with
// approved = true passes. Everyone else (facilitators, the coordinator, strangers) gets not_on_list
// and the normal code sign-in. Rate limited per network and per email so nobody can walk the list.
export type PassBody = { email?: unknown };
export type PassDeps = {
  /* fail-open like every ea_rate_check caller: only an explicit false refuses */
  rateCheck: (key: string, max: number, windowSecs: number) => Promise<boolean | null>;
  /* the approved registration for this email (case-insensitive), or null */
  findApproved: (email: string) => Promise<{ full_name: string | null } | null>;
  /* a one-time sign-in token for this account (created if it does not exist yet); null when Supabase refuses */
  mintToken: (email: string, fullName: string | null) => Promise<string | null>;
};
export type PassReply = { status: number; body: Record<string, unknown> };

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* the email as typed → the email as stored: trimmed, lower-case; null when it is not an email */
export function cleanEmail(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return EMAIL_RX.test(s) && s.length <= 254 ? s : null;
}

export async function handlePass(body: PassBody, ctx: { ip: string }, deps: PassDeps): Promise<PassReply> {
  const email = cleanEmail(body?.email);
  if (!email) return { status: 400, body: { error: "bad_email" } };
  /* 30 tries per network per 10 minutes (a campus shares one address: 10 FAMU students on one wifi
     is 10 tries), 6 per email per 10 minutes */
  if ((await deps.rateCheck(`opil_pass_ip:${ctx.ip}`, 30, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  if ((await deps.rateCheck(`opil_pass_email:${email}`, 6, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  const reg = await deps.findApproved(email);
  if (!reg) return { status: 403, body: { error: "not_on_list" } };
  const token_hash = await deps.mintToken(email, reg.full_name);
  if (!token_hash) return { status: 503, body: { error: "sign_in_unavailable" } };
  return { status: 200, body: { token_hash, email } };
}

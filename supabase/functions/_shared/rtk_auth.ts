// Who is calling, and what may they do — the pattern every OPIL room function shares.
// verify_jwt is OFF on these functions: the browser sends its own access token, we resolve the
// user with the SERVICE ROLE client, then ask the database AS THAT USER for the OPIL role through
// the same RPC the hub pages use, and whether they are the Academy admin (ea_is_admin — Nelson,
// the only host of the Academy room). Tokens never leave the function.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type Resolved = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; asUser: SupabaseClient };
export type ResolveFail = { error: string; status: number };

export async function resolveCaller(req: Request, admin: SupabaseClient, url: string, anonKey: string): Promise<Resolved | ResolveFail> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "sign_in", status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: "sign_in", status: 401 };
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: role } = await asUser.rpc("ea_opil_my_role");
  const { data: isAdmin } = await asUser.rpc("ea_is_admin");
  const r = (role || {}) as Record<string, unknown>;
  return {
    user: { id: user.id, email: user.email },
    role: {
      admin: r.admin === true,
      judge: r.judge === true,
      facilitator_sessions: Array.isArray(r.facilitator_sessions) ? (r.facilitator_sessions as unknown[]).map(Number).filter(Number.isInteger) : [],
    },
    academyAdmin: isAdmin === true,
    asUser,
  };
}

/* The caller's IP for rate limiting. Cloudflare's header when present; otherwise the LAST entry
   of x-forwarded-for — the first entry is whatever the caller wrote, the last is what the edge saw. */
export function clientIp(req: Request): string {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const hops = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : "unknown";
}

/* The Cloudflare RealtimeKit REST client, scoped to this app. */
export function rtkClient(acct: string, app: string, token: string) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${acct}/realtime/kit/${app}`;
  return async (method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) => {
    const r = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    const data = j && typeof j === "object" ? ((j as Record<string, unknown>).data ?? (j as Record<string, unknown>).result ?? j) : j;
    return { ok: r.ok && (j as Record<string, unknown>)?.success !== false, status: r.status, data };
  };
}

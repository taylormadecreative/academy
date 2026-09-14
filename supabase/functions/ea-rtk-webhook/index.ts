// ea-rtk-webhook — RealtimeKit calls this when a recording changes state (and when a meeting
// ends). Signature-verified against Cloudflare's published key, deduped in ea_rtk_events, and
// on UPLOADED the file is copied into Cloudflare Stream so it never expires. The result is a
// DRAFT replay row the coordinator publishes from /opil/hub/admin/. See handler.ts.
//
// Registered by ea-rtk-record { action: "register_webhook" } (admin). No browser calls this.
// Secrets: CF_ACCOUNT_ID, CF_API_TOKEN (Stream:Edit), CF_STREAM_SUBDOMAIN, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Deploy: --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySignature, handleEvent } from "./handler.ts";

const KEY_URL = "https://api.realtime.cloudflare.com/.well-known/webhooks.json";
let cachedKey: { pem: string; at: number } | null = null;

async function publicKey(): Promise<string | null> {
  if (cachedKey && Date.now() - cachedKey.at < 6 * 3600e3) return cachedKey.pem;
  try {
    const r = await fetch(KEY_URL);
    if (!r.ok) return null;
    const j = await r.json() as { data?: { publicKey?: string } };
    const pem = j?.data?.publicKey;
    if (!pem) return null;
    cachedKey = { pem, at: Date.now() };
    return pem;
  } catch (_) { return null; }
}

const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return text("method not allowed", 405);
  const signature = req.headers.get("rtk-signature");
  if (!signature) return text("missing signature", 400);
  const body = new Uint8Array(await req.arrayBuffer());
  const pem = await publicKey();
  if (!pem) return text("no public key", 503);
  if (!(await verifySignature(pem, signature, body))) return text("invalid signature", 401);

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(new TextDecoder().decode(body)); } catch (_) { return text("bad json", 400); }

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const acct = Deno.env.get("CF_ACCOUNT_ID") || "", streamToken = Deno.env.get("CF_API_TOKEN") || "", sub = Deno.env.get("CF_STREAM_SUBDOMAIN") || "";

  const reply = await handleEvent(payload, {
    dedupe: async (id, event, p) => {
      const { error } = await admin.from("ea_rtk_events").insert({ id, event, payload: p });
      if (!error) return true;
      if (error.code === "23505") return false;   // seen before
      throw new Error(error.message);
    },
    sessionByMeeting: async (meetingId) => {
      const { data } = await admin.from("ea_opil_sessions").select("no, title, kind").eq("stream_url", "rtk:" + meetingId).limit(1).maybeSingle();
      return data ?? null;
    },
    upsertReplay: async (row) => {
      const { error } = await admin.from("ea_opil_replays").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "recording_id" });
      if (error) throw new Error(error.message);
    },
    streamCopy: async (dl, name) => {
      if (!acct || !streamToken) throw new Error("Stream is not configured");
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/stream/copy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${streamToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: dl, meta: { name } }),
      });
      const j = await r.json().catch(() => ({})) as { success?: boolean; result?: { uid?: string }; errors?: unknown };
      const uid = j?.result?.uid;
      if (!r.ok || !j?.success || !uid) throw new Error(`Stream copy ${r.status}: ${JSON.stringify(j?.errors || {}).slice(0, 200)}`);
      return { uid };
    },
    subdomain: sub,
  }).catch((e) => ({ status: 200, body: { ok: false, error: String(e && e.message || e).slice(0, 300) } }));

  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
});

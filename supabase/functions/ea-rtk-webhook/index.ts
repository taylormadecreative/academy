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
import { replayDeps, markFailed } from "../_shared/replay_deps.ts";

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

  const reply = await handleEvent(payload, replayDeps(admin, { dedupe: true }))
    .catch(async (e) => {
      const message = String(e && e.message || e).slice(0, 300);
      await markFailed(admin, payload, message);
      return { status: 200, body: { ok: false, error: message } };
    });

  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
});

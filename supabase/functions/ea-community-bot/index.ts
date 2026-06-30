// ea-community-bot — server-side helper for the scheduled community manager that runs
// as Nelson Taylor (founder). NOT called from the browser; called only by the cloud
// routine via curl with the x-bot-secret header. Lets the agent read recent community
// activity and post/comment as Nelson without ever holding Supabase credentials.
//
// Auth: a baked shared secret (x-bot-secret header). Rotate by editing BOT_SECRET and
// redeploying. verify_jwt MUST be false (the caller sends a secret header, not a JWT).
// Deployed to Supabase project pgqdmnmessbbzyszjfvr. Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_SECRET = "81b875c17b7727fd33501729f3180d4f6d33be24e6ee3ab8bec11b2c69191cf4";
const NELSON_ID = "63de62de-01c2-4348-bf98-8ffacf7f0703";

function json(b: unknown, s = 200): Response {
  return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if ((req.headers.get("x-bot-secret") ?? "") !== BOT_SECRET) return json({ error: "unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* ignore */ }
  const action = String(body.action ?? "");

  try {
    if (action === "recent") {
      const sinceHours = Number(body.since_hours ?? 36);
      const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();

      const { data: memberPosts } = await sb.from("ea_posts")
        .select("id, channel, body, created_at, author_id")
        .neq("author_id", NELSON_ID).eq("hidden", false).gte("created_at", sinceIso)
        .order("created_at", { ascending: false }).limit(50);

      const { data: newComments } = await sb.from("ea_comments")
        .select("id, post_id, body, created_at, author_id")
        .neq("author_id", NELSON_ID).gte("created_at", sinceIso)
        .order("created_at", { ascending: false }).limit(50);

      const { data: nelsonPosts } = await sb.from("ea_posts")
        .select("body, created_at").eq("author_id", NELSON_ID)
        .order("created_at", { ascending: false }).limit(7);

      // Dedup so consecutive runs never double-reply: drop member posts Nelson has
      // already commented on, and member comments Nelson has already responded to
      // (a later Nelson comment exists on that post).
      const relevantPosts = new Set<string>();
      (memberPosts ?? []).forEach((p) => relevantPosts.add(p.id as string));
      (newComments ?? []).forEach((c) => relevantPosts.add(c.post_id as string));
      const nelsonLatestOnPost: Record<string, string> = {};
      if (relevantPosts.size) {
        const { data: nel } = await sb.from("ea_comments")
          .select("post_id, created_at").eq("author_id", NELSON_ID).in("post_id", [...relevantPosts]);
        (nel ?? []).forEach((c) => {
          const pid = c.post_id as string, ts = c.created_at as string;
          if (!nelsonLatestOnPost[pid] || ts > nelsonLatestOnPost[pid]) nelsonLatestOnPost[pid] = ts;
        });
      }
      const freshPosts = (memberPosts ?? []).filter((p) => !nelsonLatestOnPost[p.id as string]);
      const freshComments = (newComments ?? []).filter((c) => {
        const seen = nelsonLatestOnPost[c.post_id as string];
        return !seen || (c.created_at as string) > seen;
      });

      const ids = new Set<string>();
      freshPosts.forEach((p) => ids.add(p.author_id as string));
      freshComments.forEach((c) => ids.add(c.author_id as string));
      const nameOf: Record<string, string> = {};
      if (ids.size) {
        const { data: profs } = await sb.from("ea_profiles")
          .select("user_id, display_name").in("user_id", [...ids]);
        (profs ?? []).forEach((p) => { nameOf[p.user_id as string] = (p.display_name as string) ?? "member"; });
      }

      return json({
        ok: true,
        since: sinceIso,
        new_member_posts: freshPosts.map((p) => ({
          id: p.id, channel: p.channel, author: nameOf[p.author_id as string] ?? "member",
          body: p.body, created_at: p.created_at,
        })),
        new_comments: freshComments.map((c) => ({
          id: c.id, post_id: c.post_id, author: nameOf[c.author_id as string] ?? "member",
          body: c.body, created_at: c.created_at,
        })),
        nelson_recent_posts: (nelsonPosts ?? []).map((p) => ({ created_at: p.created_at, body: p.body })),
      });
    }

    // signed upload URL so the daily render pipeline (CI) can push an mp4 without
    // ever holding Supabase credentials — only the anon key + the returned token.
    if (action === "media_upload_url") {
      const safe = String(body.filename ?? "potd.mp4").replace(/[^a-zA-Z0-9._-]/g, "");
      const path = `potd/${Date.now()}-${safe}`;
      const { data, error } = await sb.storage.from("community-media").createSignedUploadUrl(path);
      if (error) return json({ error: error.message }, 500);
      const pub = sb.storage.from("community-media").getPublicUrl(path).data.publicUrl;
      return json({ ok: true, path, token: data.token, public_url: pub });
    }

    if (action === "post") {
      const channel = String(body.channel ?? "general");
      const text = String(body.body ?? "").trim();
      if (!text) return json({ error: "empty_body" }, 400);
      const row: Record<string, unknown> = { author_id: NELSON_ID, channel, body: text, pinned: !!body.pinned };
      if (body.media_url) {
        row.media_url = String(body.media_url);
        row.media_type = String(body.media_type ?? "video");
      }
      if (body.hidden) row.hidden = true; // staged for Nelson's approval
      const { data, error } = await sb.from("ea_posts").insert(row).select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id: data.id });
    }

    if (action === "comment") {
      const postId = String(body.post_id ?? "");
      const text = String(body.body ?? "").trim();
      if (!postId || !text) return json({ error: "missing_fields" }, 400);
      const { error } = await sb.from("ea_comments")
        .insert({ post_id: postId, author_id: NELSON_ID, body: text });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "bad_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

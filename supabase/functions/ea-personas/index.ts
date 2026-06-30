// ea-personas — engine for the Academy's AI "regulars": 5 standing community
// members (is_bot=true, kept off the leaderboard, never win anything) that keep the
// room from feeling like a ghost town. Called only by the scheduled cloud routine via
// curl with the x-bot-secret header — never from the browser.
//
// Guardrails baked into the routine prompt (not here): they talk AI/creative, react and
// post in character, but NEVER post fake testimonials about the paid membership.
//
// verify_jwt MUST be false. Deployed to project pgqdmnmessbbzyszjfvr. Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_SECRET = "81b875c17b7727fd33501729f3180d4f6d33be24e6ee3ab8bec11b2c69191cf4";

const PERSONAS = [
  { email: "persona.marcus@taylormadecreative.net", name: "Marcus Vance",
    bio: "Ex-ops manager. I automate the boring stuff with AI so I can do the fun stuff. Dallas.", open_to: ["ai"] },
  { email: "persona.lena@taylormadecreative.net", name: "Lena Ortiz",
    bio: "Designer using AI to move 3x faster on brand work. I'll hype your stuff in the comments.", open_to: ["ai", "design"] },
  { email: "persona.dre@taylormadecreative.net", name: "Dre Coleman",
    bio: "Content + video. AI scripts, AI b-roll, real cuts. Always testing something new.", open_to: ["ai", "video"] },
  { email: "persona.priya@taylormadecreative.net", name: "Priya Raman",
    bio: "Learning AI out loud. I ask the questions so you don't have to. Sharing what works.", open_to: ["ai"] },
  { email: "persona.sam@taylormadecreative.net", name: "Sam Whitfield",
    bio: "Recovering AI skeptic. I poke holes, then build the thing anyway. Thoughtful > hype.", open_to: ["ai"] },
];

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

  const isPersona = async (id: string): Promise<boolean> => {
    if (!id) return false;
    const { data } = await sb.from("ea_profiles").select("is_bot").eq("user_id", id).maybeSingle();
    return !!data?.is_bot;
  };

  try {
    if (action === "provision") {
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      const byEmail: Record<string, string> = {};
      (list?.users ?? []).forEach((u) => { if (u.email) byEmail[u.email.toLowerCase()] = u.id; });
      const now = new Date().toISOString();
      const roster: { id: string; name: string }[] = [];
      for (const p of PERSONAS) {
        let id = byEmail[p.email];
        if (!id) {
          const { data: created } = await sb.auth.admin.createUser({ email: p.email, email_confirm: true });
          id = created?.user?.id ?? "";
        }
        if (!id) continue;
        await sb.from("ea_profiles").upsert(
          { user_id: id, display_name: p.name, bio: p.bio, open_to: p.open_to, is_bot: true, onboarded_at: now, updated_at: now },
          { onConflict: "user_id" },
        );
        roster.push({ id, name: p.name });
      }
      return json({ ok: true, roster });
    }

    if (action === "state") {
      const sinceHours = Number(body.since_hours ?? 30);
      const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();

      const { data: bots } = await sb.from("ea_profiles").select("user_id, display_name").eq("is_bot", true);
      const botIds = new Set((bots ?? []).map((b) => b.user_id as string));
      const roster = (bots ?? []).map((b) => ({ id: b.user_id, name: b.display_name }));

      const { data: posts } = await sb.from("ea_posts")
        .select("id, author_id, channel, body, created_at")
        .eq("hidden", false).gte("created_at", sinceIso)
        .order("created_at", { ascending: false }).limit(40);

      const authorIds = [...new Set((posts ?? []).map((p) => p.author_id as string))];
      const nameOf: Record<string, string> = {};
      if (authorIds.length) {
        const { data: pr } = await sb.from("ea_profiles").select("user_id, display_name").in("user_id", authorIds);
        (pr ?? []).forEach((x) => { nameOf[x.user_id as string] = (x.display_name as string) ?? "Member"; });
      }

      const postIds = (posts ?? []).map((p) => p.id as string);
      const botCommentersByPost: Record<string, string[]> = {};
      if (postIds.length) {
        const { data: cs } = await sb.from("ea_comments").select("post_id, author_id").in("post_id", postIds);
        (cs ?? []).forEach((c) => {
          if (botIds.has(c.author_id as string)) {
            (botCommentersByPost[c.post_id as string] ??= []).push(c.author_id as string);
          }
        });
      }

      const out = (posts ?? []).map((p) => ({
        id: p.id, author_id: p.author_id, author: nameOf[p.author_id as string] ?? "Member",
        is_bot: botIds.has(p.author_id as string), channel: p.channel, body: p.body, created_at: p.created_at,
        bot_commenter_ids: botCommentersByPost[p.id as string] ?? [],
      }));

      return json({ ok: true, since: sinceIso, roster, posts: out });
    }

    if (action === "post") {
      const asId = String(body.as ?? "");
      if (!(await isPersona(asId))) return json({ error: "not_a_persona" }, 403);
      const text = String(body.body ?? "").trim();
      if (!text) return json({ error: "empty_body" }, 400);
      const { data, error } = await sb.from("ea_posts")
        .insert({ author_id: asId, channel: String(body.channel ?? "ai"), body: text })
        .select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id: data.id });
    }

    if (action === "comment") {
      const asId = String(body.as ?? "");
      if (!(await isPersona(asId))) return json({ error: "not_a_persona" }, 403);
      const postId = String(body.post_id ?? "");
      const text = String(body.body ?? "").trim();
      if (!postId || !text) return json({ error: "missing_fields" }, 400);
      const { error } = await sb.from("ea_comments").insert({ post_id: postId, author_id: asId, body: text });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "like") {
      const asId = String(body.as ?? "");
      if (!(await isPersona(asId))) return json({ error: "not_a_persona" }, 403);
      const postId = String(body.post_id ?? "");
      if (!postId) return json({ error: "missing_fields" }, 400);
      await sb.from("ea_post_likes").upsert({ post_id: postId, user_id: asId }, { onConflict: "post_id,user_id" });
      return json({ ok: true });
    }

    return json({ error: "bad_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

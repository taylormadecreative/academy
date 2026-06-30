// Daily Prompt-of-the-Day pipeline. Run by GitHub Actions (and runnable locally with
// BOT_SECRET set). Picks the day's task, renders the Cowork video, uploads it, and
// stages it as a HIDDEN community post for Nelson to approve at /review/.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pgqdmnmessbbzyszjfvr.supabase.co";
const ANON = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz"; // publishable (public) key
const BOT = "https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-community-bot";
const SECRET = process.env.BOT_SECRET;
if (!SECRET) { console.error("BOT_SECRET env var is required."); process.exit(1); }

// Deterministic daily rotation through the task bank (override with --index=N).
const tasks = JSON.parse(readFileSync(new URL("./tasks.json", import.meta.url), "utf8"));
const argIdx = (process.argv.find((a) => a.startsWith("--index=")) || "").split("=")[1];
const now = new Date();
const doy = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000);
const task = tasks[(argIdx !== undefined ? Number(argIdx) : doy) % tasks.length];
console.log("📋 Task:", task.task);

writeFileSync("props.json", JSON.stringify(task));

console.log("🎬 Rendering…");
execFileSync("npx", [
  "remotion", "render", "src/index.ts", "PromptOfTheDay", "out/potd.mp4",
  "--props=./props.json", "--codec=h264", "--crf=18", "--pixel-format=yuv420p",
], { stdio: "inherit" });

const mp4 = readFileSync("out/potd.mp4");
console.log(`📦 Rendered ${(mp4.length / 1024 / 1024).toFixed(1)} MB`);

async function bot(payload) {
  const r = await fetch(BOT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bot-secret": SECRET },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`bot ${payload.action} → ${r.status} ${text}`);
  return JSON.parse(text);
}

const up = await bot({ action: "media_upload_url", filename: "potd.mp4" });
const supa = createClient(SUPABASE_URL, ANON);
const { error: upErr } = await supa.storage
  .from("community-media")
  .uploadToSignedUrl(up.path, up.token, mp4, { contentType: "video/mp4" });
if (upErr) throw upErr;
console.log("☁️  Uploaded:", up.public_url);

const caption =
  `Prompt of the Day 🤖\n\nToday: ${task.task}\n\n` +
  `Drop it into Claude Cowork and let it do the work — then try it and share your result below.`;

const staged = await bot({
  action: "post", hidden: true, channel: "general",
  media_type: "video", media_url: up.public_url, body: caption,
});

console.log("✅ Staged hidden post:", staged.id);
console.log("👉 Review + approve: https://academy.taylormadecreative.net/review/");

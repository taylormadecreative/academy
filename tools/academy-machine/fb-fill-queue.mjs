#!/usr/bin/env node
// fb-fill-queue.mjs — generate Academy posts LOCALLY (full quality, your face + logo,
// nothing fragile) and append them to the Facebook posting queue.
//
//   node fb-fill-queue.mjs            # generate every topic in fb-topics.json
//                                     # that isn't already in fb/queue.json
//   node fb-fill-queue.mjs --redo 003 # force-regenerate one id
//
// Each topic in fb-topics.json:
//   { "id":"001", "recipe":"quote-card", "topic":"Start before you feel ready",
//     "stat":"10x"?, "note":"..."?, "outfit":"..."?, "format":"post|square"?,
//     "caption":"full Facebook caption..." }
//
// It calls the proven make.mjs (engine = ChatGPT, logo smart-placed, no blue blob),
// picks the cleanest variant, writes a compressed JPG into fb/queue/<id>-<slug>.jpg
// (served publicly by GitHub Pages), and adds it to fb/queue.json as posted:false.
// Refill whenever the queue runs low — the daily Facebook poster drains it one/day.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const MAKE = path.join(HERE, "make.mjs");
const TOPICS = path.join(HERE, "fb-topics.json");
const QUEUE_DIR = path.join(REPO, "fb", "queue");
const QUEUE_JSON = path.join(REPO, "fb", "queue.json");
const DOMAIN = "https://academy.taylormadecreative.net";

const argv = process.argv.slice(2);
const redo = argv.includes("--redo") ? argv[argv.indexOf("--redo") + 1] : null;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
const convert = ["/opt/ImageMagick/bin/convert", "convert"].find((b) =>
  b === "convert" || fs.existsSync(b)) || "convert";

if (!fs.existsSync(TOPICS)) {
  console.error(`No ${TOPICS}. Create it: an array of { id, recipe, topic, caption }.`);
  process.exit(1);
}
fs.mkdirSync(QUEUE_DIR, { recursive: true });

const topics = JSON.parse(fs.readFileSync(TOPICS, "utf8"));
const queue = fs.existsSync(QUEUE_JSON)
  ? JSON.parse(fs.readFileSync(QUEUE_JSON, "utf8"))
  : { domain: DOMAIN, posts: [] };
const have = new Set(queue.posts.map((p) => p.id));

// Run make.mjs --json for one topic, return the chosen full-res PNG path (or null).
function generate(t) {
  return new Promise((resolve) => {
    const args = [t.recipe, t.topic, "--n", "1", "--engine", "openai",
      "--format", t.format || "post", "--label", `fb-${t.id}`];
    if (t.stat) args.push("--stat", t.stat);
    if (t.note) args.push("--note", t.note);
    if (t.outfit) args.push("--outfit", t.outfit);
    const child = spawn(process.execPath, [MAKE, ...args, "--json"], { cwd: HERE, env: process.env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => process.stderr.write(d)); // live progress
    child.on("close", () => {
      const line = out.trim().split("\n").filter(Boolean).pop() || "";
      let m = null; try { m = JSON.parse(line); } catch { /* */ }
      resolve(m?.images?.[0]?.path || null);
    });
    child.on("error", () => resolve(null));
  });
}

let added = 0;
for (const t of topics) {
  if (!t.id || !t.recipe || !t.topic) { console.log(`skip (missing id/recipe/topic):`, t); continue; }
  if (have.has(t.id) && t.id !== redo) continue;
  if (!t.caption) { console.log(`skip ${t.id} — no caption (write one in fb-topics.json)`); continue; }

  console.log(`\n▸ generating ${t.id} (${t.recipe}) — "${t.topic}"`);
  const png = await generate(t);
  if (!png || !fs.existsSync(png)) { console.log(`  ✗ generation failed for ${t.id}`); continue; }

  const file = `${t.id}-${slug(t.topic)}.jpg`;
  const dest = path.join(QUEUE_DIR, file);
  const r = spawnSync(convert, [png, "-strip", "-quality", "86", dest], { stdio: "ignore" });
  if (r.status !== 0 || !fs.existsSync(dest)) { console.log(`  ✗ jpg convert failed for ${t.id}`); continue; }
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`  ✓ ${file} (${kb}kb) -> ${DOMAIN}/fb/queue/${file}`);

  const entry = { id: t.id, file, caption: t.caption, posted: false, postedAt: null, blotatoUrl: null, fbUrl: null };
  if (t.id === redo) {
    const i = queue.posts.findIndex((p) => p.id === t.id);
    if (i >= 0) queue.posts[i] = { ...queue.posts[i], file, caption: t.caption, posted: false }; else queue.posts.push(entry);
  } else {
    queue.posts.push(entry);
  }
  have.add(t.id);
  added++;
}

queue.domain = queue.domain || DOMAIN;
fs.writeFileSync(QUEUE_JSON, JSON.stringify(queue, null, 2) + "\n");
const pending = queue.posts.filter((p) => !p.posted).length;
console.log(`\n✓ added ${added} post(s). Queue now holds ${pending} unposted of ${queue.posts.length} total.`);
console.log(`  Commit fb/queue/ + fb/queue.json so GitHub Pages serves the images.`);

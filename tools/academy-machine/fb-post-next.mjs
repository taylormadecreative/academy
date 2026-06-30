#!/usr/bin/env node
// fb-post-next.mjs — post the next queued Academy image to the Taylormade Academy
// Facebook PAGE via Blotato, fully automated (no human in the loop).
//
// How it works (runs daily in GitHub Actions — see .github/workflows/fb-daily.yml):
//   1. Read fb/queue.json (repo-relative), find the first entry with posted=false.
//   2. Its image already lives at a PUBLIC GitHub Pages URL
//      (https://academy.taylormadecreative.net/fb/queue/<file>) because Pages serves
//      the whole repo. Blotato's REST API can only take a media URL (no byte upload),
//      so public hosting is exactly what we need.
//   3. Re-host that URL on Blotato's CDN (POST /v2/media) for reliability.
//   4. Publish to the Facebook Page (POST /v2/posts, targetType=facebook + pageId).
//   5. Mark the entry posted and save fb/queue.json (the workflow commits it back).
//
// Env (GitHub repo secrets):
//   BLOTATO_API_KEY   your Blotato API key
//   FB_ACCOUNT_ID     the Blotato account id for the Facebook page (from list_accounts)
//   FB_PAGE_ID        the Facebook Page id (Blotato "subaccount" id)
//   DRY_RUN=1         optional — log what WOULD post, don't actually publish
//
// Why a pre-generated queue instead of generating in CI: quality stays human-checked
// before anything goes live (Nelson's bar), no fragile image-gen in CI, no daily API
// spend, and dupes are impossible (explicit posted flags). Refill with fb-fill-queue.mjs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");           // tools/academy-machine -> repo root
const QUEUE = path.join(REPO, "fb", "queue.json");
const API = "https://backend.blotato.com/v2";

const KEY = process.env.BLOTATO_API_KEY;
const ACCOUNT_ID = process.env.FB_ACCOUNT_ID;
const PAGE_ID = process.env.FB_PAGE_ID;
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function die(msg) { console.error("✗ " + msg); process.exit(1); }

if (!fs.existsSync(QUEUE)) die(`no queue at ${QUEUE} — add posts with fb-fill-queue.mjs first`);
const queue = JSON.parse(fs.readFileSync(QUEUE, "utf8"));
const DOMAIN = (queue.domain || "https://academy.taylormadecreative.net").replace(/\/$/, "");
const posts = Array.isArray(queue.posts) ? queue.posts : [];

const next = posts.find((p) => !p.posted);
if (!next) {
  console.log("✓ queue is empty (all posts published). Refill with: node fb-fill-queue.mjs");
  process.exit(0); // not an error — just nothing to do today
}

const publicUrl = `${DOMAIN}/fb/queue/${next.file}`;
console.log(`▸ next post: ${next.id} — ${next.file}`);
console.log(`  public image: ${publicUrl}`);
console.log(`  caption: ${next.caption.split("\n")[0]}…`);

if (DRY) {
  console.log("\n[DRY_RUN] would re-host the image on Blotato, then publish to the Facebook page.");
  console.log("[DRY_RUN] caption:\n" + next.caption);
  process.exit(0);
}

if (!KEY) die("BLOTATO_API_KEY is not set");
if (!ACCOUNT_ID) die("FB_ACCOUNT_ID is not set (Blotato account id for the FB page)");
if (!PAGE_ID) die("FB_PAGE_ID is not set (the Facebook Page id)");

async function api(pathname, body) {
  const res = await fetch(API + pathname, {
    method: "POST",
    headers: { "blotato-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { ok: res.ok, status: res.status, json, text };
}

// 1) Re-host the public image on Blotato's CDN (more reliable than hotlinking Pages).
let mediaUrl = publicUrl;
const media = await api("/media", { url: publicUrl });
if (media.ok && media.json?.url) {
  mediaUrl = media.json.url;
  console.log(`  re-hosted on Blotato: ${mediaUrl}`);
} else {
  console.log(`  ⚠ /media re-host failed (HTTP ${media.status}) — posting the Pages URL directly`);
}

// 2) Publish to the Facebook Page.
const post = await api("/posts", {
  post: {
    accountId: String(ACCOUNT_ID),
    target: { targetType: "facebook", pageId: String(PAGE_ID) },
    content: { text: next.caption, platform: "facebook", mediaUrls: [mediaUrl] },
  },
});

if (!post.ok) {
  die(`Facebook publish failed (HTTP ${post.status}): ${post.text}`);
}

const submissionId = post.json?.postSubmissionId || post.json?.id || null;
const liveUrl = post.json?.publicUrl || post.json?.url || null;
console.log(`✓ published to Facebook${liveUrl ? " — " + liveUrl : ""}${submissionId ? ` (submission ${submissionId})` : ""}`);

// 3) Mark posted and persist.
next.posted = true;
next.postedAt = new Date().toISOString();
next.blotatoUrl = mediaUrl;
if (liveUrl) next.fbUrl = liveUrl;
if (submissionId) next.submissionId = submissionId;
fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2) + "\n");

const remaining = posts.filter((p) => !p.posted).length;
console.log(`▸ ${remaining} post(s) left in the queue.` + (remaining <= 3 ? "  ⚠ running low — refill soon." : ""));

#!/usr/bin/env node
// mcp-server.mjs — exposes the Academy Content Machine to ANY Claude Desktop chat
// as MCP tools. Wraps the proven make.mjs CLI (via --json) and returns the
// generated images inline so they show up right in the conversation.
import "./env.mjs"; // load API keys from .env before anything reads them
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { recipeNames } from "./recipes.mjs";
import { FORMATS, OUTFITS } from "./style.mjs";
import { availableBrands } from "./brand.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAKE = path.join(HERE, "make.mjs");
const MAX_INLINE = 2; // inline thumbnails only — full-res lives on disk + opens on screen

// Compress a full-res PNG to a small JPEG thumbnail (sips, built into macOS) so the
// inline payload stays well under Claude Desktop's MCP response size limit (~80kb).
function makeThumb(src) {
  const dest = src.replace(/\.png$/i, "") + ".thumb.jpg";
  const r = spawnSync("/usr/bin/sips",
    ["-Z", "720", "-s", "format", "jpeg", "-s", "formatOptions", "60", src, "--out", dest],
    { stdio: "ignore" });
  return r.status === 0 && fs.existsSync(dest) ? dest : null;
}

// Open a file in the user's GUI (Preview/browser). This is how a plain chat "sees"
// the full-res result — it can't read arbitrary disk paths itself.
function openOnScreen(file) {
  try { spawnSync("/usr/bin/open", [file], { stdio: "ignore" }); return true; } catch { return false; }
}

// Run make.mjs --json and resolve its parsed manifest.
function runMachine(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [MAKE, ...args, "--json"], { cwd: HERE, env: process.env });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      const line = out.trim().split("\n").filter(Boolean).pop() || "";
      let manifest = null;
      try { manifest = JSON.parse(line); } catch { /* not json */ }
      resolve({ code, manifest, err: err.trim() });
    });
    child.on("error", (e) => resolve({ code: -1, manifest: null, err: String(e?.message || e) }));
  });
}

const server = new McpServer({ name: "academy-content-machine", version: "1.0.0" });

server.registerTool(
  "generate_academy_content",
  {
    title: "Generate Taylormade Academy social content",
    description:
      "THE required tool for ANY Taylormade Academy image, post, carousel, quote card, story, " +
      "hero graphic, or visual. ALWAYS use this — do NOT hand-render SVG/HTML/PNG or write " +
      "rendering code yourself; that produces flat, off-brand results. This generates real AI " +
      "imagery (Nano Banana 2 + ChatGPT) with Nelson's REAL reference photos and the REAL " +
      "academy logo auto-applied. If the post should feature Nelson/the founder, use recipe " +
      "'hero-post' (his face auto-locks from real photos; outfit varies per post). For a pure " +
      "text/value post use 'quote-card'; for multi-point lists use 'carousel'. Returns image " +
      "previews inline AND opens a full-res contact sheet on screen. Default to 2-3 variants.",
    inputSchema: {
      recipe: z.enum(recipeNames).describe(
        "web-hero (WIDE website-hero banner w/ Claude+TikTok app icons, chips, CTAs) | " +
        "hero-post (founder motivational) | lifestyle (founder in a real-world scene) | " +
        "quote-card | lesson-card | stat-flex | behind-the-build (founder BTS) | launch | " +
        "story-frame | carousel (topic = 'Title | point 1 | point 2 | ...')"
      ),
      topic: z.string().describe("The headline/idea. Just the hook — do NOT append 'Let me put you on' or any CTA unless the user explicitly asks. For carousels, pipe-separate: 'Title | point 1 | point 2'."),
      notes: z.string().optional().describe("Freeform art direction passed straight to the image: pose, setting, action, mood. E.g. 'Nelson pointing toward the headline', 'lifestyle coffee-shop setting', 'walking outdoors, laughing', 'sitting at a laptop'."),
      format: z.enum(Object.keys(FORMATS)).optional().describe("post 4:5 (default) | reel/story 9:16 | square | wide"),
      size: z.string().optional().describe("Exact custom output size in pixels, e.g. '1080x1080', '1200x628', '1080x1920'. ANY size; overrides format."),
      variants: z.number().int().min(1).max(4).optional().describe("Variants per engine (default 2)."),
      engine: z.enum(["both", "gemini", "openai"]).optional().describe("Default is ChatGPT (openai, gpt-image-2) — Nelson prefers that look. Any post that FEATURES NELSON is always forced to ChatGPT regardless. Use 'gemini' only for non-person graphics if asked."),
      logo: z.boolean().optional().describe("Add the academy logo to the post. OFF by default — Nelson does NOT want the logo on every post. Only set true when he explicitly asks for the logo."),
      outfit: z.string().optional().describe("Override the founder's outfit, e.g. 'a royal-blue bomber over a white tee'. On-brand navy/gold/royal-blue/cream that POPS; changes every post; never dull gray/black, never the ref's white tank."),
      brands: z.array(z.string()).optional().describe(`Real third-party logos to stamp on the post (REAL files — the AI cannot render these without garbling them). Available: ${availableBrands().join(", ") || "none"}. Use when the post is about those platforms, e.g. ["tiktok","claude"].`),
      slides: z.number().int().min(2).max(8).optional().describe("Slide count for the carousel recipe."),
    },
  },
  async ({ recipe, topic, notes, format, size, variants, engine, outfit, brands, logo, slides }) => {
    const args = [recipe, topic];
    if (format) args.push("--format", format);
    if (size) args.push("--size", size);
    if (variants) args.push("--n", String(variants));
    if (engine) args.push("--engine", engine);
    if (outfit) args.push("--outfit", outfit);
    if (notes) args.push("--note", notes);
    if (brands?.length) args.push("--brands", brands.join(","));
    if (logo) args.push("--logo");
    if (slides) args.push("--slides", String(slides));

    const { manifest, err } = await runMachine(args);
    if (!manifest || !manifest.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: `Generation failed.\n${err || "no images produced"}` }],
      };
    }

    const content = [];
    const shown = manifest.images.slice(0, MAX_INLINE);

    // Open the full-res contact sheet on screen so the user sees every variant at
    // full quality (the inline thumbnails below are just a small in-chat preview).
    const opened = manifest.contactSheet ? openOnScreen(manifest.contactSheet) : false;

    const lines = [
      `✅ ${manifest.images.length} full-res image(s) generated — recipe "${manifest.recipe}", ${manifest.format}` +
        (manifest.outfit ? `, outfit: ${manifest.outfit}` : ""),
      `Saved on disk: ${manifest.outDir}`,
    ];
    if (opened) lines.push(`Opened the full-res contact sheet on your screen — compare all variants there and pick the cleanest.`);
    else lines.push(`Contact sheet: ${manifest.contactSheet}`);
    if (manifest.images.length > shown.length) lines.push(`(${shown.length} small previews below; all ${manifest.images.length} are full-res on disk + on screen.)`);
    if (manifest.failures?.length) lines.push(`Note: ${manifest.failures.length} render(s) failed.`);
    content.push({ type: "text", text: lines.join("\n") });

    // Small JPEG thumbnails inline so the chat shows something without blowing the limit.
    for (const img of shown) {
      const thumb = makeThumb(img.path);
      if (!thumb) continue;
      try {
        const data = fs.readFileSync(thumb).toString("base64");
        content.push({ type: "image", data, mimeType: "image/jpeg" });
      } catch { /* skip unreadable */ }
    }
    return { content };
  }
);

server.registerTool(
  "list_academy_recipes",
  {
    title: "List Academy content recipes",
    description: "List the available Taylormade Academy recipes, formats, and outfit options.",
    inputSchema: {},
  },
  async () => ({
    content: [{
      type: "text",
      text:
        `Recipes: ${recipeNames.join(", ")}\n` +
        `Formats: ${Object.keys(FORMATS).join(", ")}\n` +
        `Outfit rotation (founder posts, varies per post): ${OUTFITS.join(" · ")}`,
    }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("academy-content-machine MCP server ready\n");

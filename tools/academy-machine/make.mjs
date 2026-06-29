#!/usr/bin/env node
// make.mjs — the Academy Content Machine.
// Generate on-brand social content from a recipe + topic, fan out across
// Nano Banana 2 (Gemini) and ChatGPT image, save variants, build a contact sheet.
//
//   node make.mjs <recipe> "<topic>" [options]
//
// Options:
//   --format post|reel|story|square|wide   (default post)
//   --size <WxH>       exact custom output size in px (e.g. 1200x628); any size
//   --engine both|gemini|openai            (default both)
//   --n <k>            variants per engine per frame (default 2)
//   --slides <n>       slides for the carousel recipe (default 4)
//   --ref <path>       real reference photo (repeatable) -> "fresh from refs"
//                      (person recipes auto-use refs/nelson-*.jpg if none given)
//   --no-ref           force text-to-image (don't use the reference photos)
//   --no-logo          skip stamping the academy logo (on by default)
//   --logo-pos <p>     logo position: south (default) | southeast | southwest
//   --outfit "<desc>"  override the per-post outfit (default rotates by topic)
//   --note "<desc>"    freeform art direction: pose/setting/action/mood
//                      (e.g. "pointing at the headline", "lifestyle coffee-shop")
//   --brands a,b       stamp real logos from assets/brands/ (e.g. tiktok,claude)
//   --stat <value>     for the stat-flex recipe (e.g. "82K")
//   --label <slug>     output folder name
//   --out <dir>        explicit output dir (overrides --label)
//   --dry-run          compose prompts only, no API calls
//   --list             list recipes and formats and exit
//
// Env: GOOGLE_API_KEY, OPENAI_API_KEY (both already in your shell).
import "./env.mjs"; // load .env first so keys exist even in a bare shell
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recipes, recipeNames } from "./recipes.mjs";
import { resolveFormat, composePrompt, pickOutfit, parseSize, customFormat, FORMATS } from "./style.mjs";
import { genGemini, genOpenAI, editOpenAI, haveKeys } from "./engines.mjs";
import { writeContactSheet } from "./contact-sheet.mjs";
import { brandImage, brandStickers, fitTo, haveBrand } from "./brand.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- tiny arg parser ----
const argv = process.argv.slice(2);
const opts = { format: "post", engine: "both", n: 2, slides: 4, refs: [], vars: {} };
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") opts.dry = true;
  else if (a === "--json") opts.json = true;
  else if (a === "--list") opts.list = true;
  else if (a === "--ref") opts.refs.push(argv[++i]);
  else if (a === "--no-ref") opts.noRef = true;
  else if (a === "--keep-outfit") opts.keepOutfit = true;
  else if (a === "--no-logo") opts.noLogo = true;
  else if (a === "--logo-pos") opts.logoPos = argv[++i];
  else if (a === "--outfit") opts.outfit = argv[++i];
  else if (a === "--note") opts.note = argv[++i];
  else if (a === "--brands") opts.brands = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
  else if (a === "--format") { opts.format = argv[++i]; opts.formatSet = true; }
  else if (a === "--size") opts.size = parseSize(argv[++i]);
  else if (a === "--engine") { opts.engine = argv[++i]; opts.engineSet = true; }
  else if (a === "--n") opts.n = Math.max(1, parseInt(argv[++i], 10) || 1);
  else if (a === "--slides") opts.slides = Math.max(1, parseInt(argv[++i], 10) || 1);
  else if (a === "--label") opts.label = argv[++i];
  else if (a === "--out") opts.out = argv[++i];
  else if (a === "--stat") opts.vars.stat = argv[++i];
  else if (a.startsWith("--")) opts.vars[a.slice(2)] = argv[++i];
  else pos.push(a);
}

// In --json mode, send all human progress to stderr so stdout carries ONLY the
// final JSON manifest (the MCP server parses stdout).
if (opts.json) {
  const err = (...a) => process.stderr.write(a.join(" ") + "\n");
  console.log = err;
}
// progress writes go to stderr in --json mode so stdout stays a clean JSON line
const progress = (s) => (opts.json ? process.stderr.write(s) : process.stdout.write(s));

if (opts.list) {
  if (opts.json) {
    process.stdout.write(JSON.stringify({ recipes: recipeNames, formats: Object.keys(FORMATS) }) + "\n");
  } else {
    console.log("recipes:", recipeNames.join(", "));
    console.log("formats:", Object.keys(FORMATS).join(", "));
  }
  process.exit(0);
}

const recipeName = pos[0];
const topic = pos[1];
if (!recipeName || !topic || !recipes[recipeName]) {
  console.error("usage: node make.mjs <recipe> \"<topic>\" [options]   (--list to see recipes)");
  if (recipeName && !recipes[recipeName]) console.error("unknown recipe:", recipeName);
  process.exit(1);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const today = new Date().toISOString().slice(0, 10);
const label = opts.label || `${recipeName}-${slug(topic)}`;
const outDir = opts.out || path.join(HERE, "out", `${today}-${label}`);
fs.mkdirSync(outDir, { recursive: true });

// ---- build the frames (single image, or a carousel of slides) ----
const spec = recipes[recipeName]({ topic, format: opts.format, slides: opts.slides, vars: opts.vars });
const frames = spec.slides
  ? spec.slides.map((direction, i) => ({ direction, slide: i, tag: i === 0 ? "cover" : `s${i}` }))
  : [{ direction: spec.direction, slide: null, tag: "" }];

// Let a recipe set its own default format / engine / keep-outfit (user flags win).
if (!opts.formatSet && spec.format) opts.format = spec.format;
if (!opts.engineSet && spec.engine) opts.engine = spec.engine;
if (spec.keepOutfit) opts.keepOutfit = true;

// For person-featuring recipes, auto-lock Nelson from the reference photos.
// DEFAULT = his real navy/gold "Taylormade Creative" letterman shot, outfit kept as-is.
// If an outfit is explicitly requested (--outfit), switch to the portrait refs and
// swap the outfit instead. --keep-outfit forces keeping the ref's outfit.
const letterman = path.join(HERE, "refs/nelson-letterman.jpg");
if (spec.person && !opts.noRef && opts.refs.length === 0) {
  if (!opts.outfit && fs.existsSync(letterman)) {
    opts.refs = [letterman];
    opts.keepOutfit = true;
  } else {
    opts.refs = ["refs/nelson-front.jpg", "refs/nelson-profile-r.jpg"]
      .map((p) => path.join(HERE, p))
      .filter((p) => fs.existsSync(p));
  }
}
const outfit = spec.person && !opts.keepOutfit ? pickOutfit(topic, opts.outfit) : null;

// Person + ref shots come out best on Nano Banana 2 (keeps the face, changes the
// outfit from the prompt). Default person recipes to gemini unless --engine was set.
if (spec.person && !opts.engineSet && opts.engine === "both") opts.engine = "gemini";

// --size <WxH> wins over named formats and snaps to the nearest engine ratio,
// then each image is cropped to the exact pixels after generation.
const f = opts.size ? customFormat(opts.size) : resolveFormat(opts.format);
const engines = opts.engine === "both" ? ["gemini", "openai"] : [opts.engine];

console.log(`\n▸ Academy Machine — ${recipeName} · ${f.label} · ${frames.length} frame(s) · ${opts.n} variant(s)/engine`);
console.log(`  out: ${outDir}`);
if (outfit) console.log(`  outfit (this post): ${outfit}`);
else if (opts.keepOutfit) console.log(`  outfit: keeping the real letterman jacket from the reference`);
if (opts.refs.length) console.log(`  refs (face locked, fresh-from-photo): ${opts.refs.map((p) => path.basename(p)).join(", ")}`);
if (!haveKeys.gemini) console.log("  ⚠ no GOOGLE_API_KEY — gemini will be skipped");
if (!haveKeys.openai) console.log("  ⚠ no OPENAI_API_KEY — openai will be skipped");

const results = [];

for (const frame of frames) {
  const prompt = composePrompt({
    direction: frame.direction, format: opts.format, withText: spec.withText,
    person: spec.person, outfit, hasRefs: opts.refs.length > 0, keepOutfit: opts.keepOutfit,
    note: opts.note, brandCorner: opts.brands?.length > 0,
  });

  if (opts.dry) {
    const file = `prompt-${frame.tag || "main"}.txt`;
    fs.writeFileSync(path.join(outDir, file), prompt);
    console.log(`\n--- ${frame.tag || "main"} ---\n${prompt}\n`);
    results.push({ engine: "dry", variant: 1, slide: frame.slide, ok: false, error: "dry-run (prompt only)", prompt, file });
    continue;
  }

  for (const engine of engines) {
    if (engine === "gemini" && !haveKeys.gemini) continue;
    if (engine === "openai" && !haveKeys.openai) continue;
    for (let v = 1; v <= opts.n; v++) {
      const base = `${engine[0]}${frame.tag ? "-" + frame.tag : ""}-v${v}.png`;
      progress(`  · ${engine} ${frame.tag || "main"} v${v} … `);

      let r;
      if (engine === "gemini") {
        r = await genGemini({ prompt, ar: f.ar, refs: opts.refs });
      } else if (opts.refs.length) {
        r = await editOpenAI({ prompt, refPath: opts.refs[0], size: f.oaiSize });
      } else {
        r = await genOpenAI({ prompt, size: f.oaiSize });
      }

      if (r.ok) {
        const savePath = path.join(outDir, base);
        fs.writeFileSync(savePath, r.buffer);
        if (f.custom) fitTo(savePath, f.w, f.h); // crop/scale to the exact requested size
        let branded = false;
        if (!opts.noLogo && !spec.noLogo && haveBrand) branded = brandImage(savePath, { position: opts.logoPos || spec.logoPos || "south" });
        let stickers = 0;
        if (opts.brands?.length) stickers = brandStickers(savePath, opts.brands);
        console.log(`ok (${(r.buffer.length / 1024).toFixed(0)}kb)${branded ? " +logo" : ""}${stickers ? ` +${stickers}brand` : ""}`);
        results.push({ engine, variant: v, slide: frame.slide, ok: true, file: base, prompt });
      } else {
        console.log(`FAIL ${r.error || ""}`);
        results.push({ engine, variant: v, slide: frame.slide, ok: false, error: r.error, prompt });
      }
    }
  }
}

if (!opts.dry) {
  const sheet = writeContactSheet(outDir, { label, recipe: recipeName, format: f.label, when: today }, results);
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n✓ ${okCount}/${results.length} images generated`);
  console.log(`▸ contact sheet: ${sheet}`);
  console.log(`  open it:  open "${sheet}"\n`);

  if (opts.json) {
    const manifest = {
      ok: okCount > 0,
      recipe: recipeName,
      topic,
      format: f.label,
      outfit,
      outDir,
      contactSheet: sheet,
      images: results.filter((r) => r.ok).map((r) => ({
        engine: r.engine, variant: r.variant, slide: r.slide,
        file: r.file, path: path.join(outDir, r.file),
      })),
      failures: results.filter((r) => !r.ok).map((r) => ({ engine: r.engine, error: r.error })),
    };
    process.stdout.write(JSON.stringify(manifest) + "\n");
  }
} else {
  console.log(`\n✓ dry-run complete — prompts written to ${outDir}\n`);
}

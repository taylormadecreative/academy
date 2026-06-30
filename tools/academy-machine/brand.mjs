// brand.mjs — composite the REAL Taylormade Academy logo onto a generated image,
// in place, using ImageMagick. The logo is never AI-drawn (that drifts); we always
// stamp the actual asset (assets/academy-logo-badge.png — full-color logo on a
// subtle white rounded chip so it reads on any background).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BADGE = path.join(HERE, "assets", "academy-logo-badge.png");

// Resolve IM binaries by absolute path first (Claude Desktop launches us with a
// minimal PATH that won't include /opt/ImageMagick/bin), then fall back to PATH.
const bin = (name) => {
  const abs = `/opt/ImageMagick/bin/${name}`;
  return fs.existsSync(abs) ? abs : name;
};
const CONVERT = process.env.IM_CONVERT || bin("convert");
const IDENTIFY = process.env.IM_IDENTIFY || bin("identify");

function imgWidth(p) {
  const r = spawnSync(IDENTIFY, ["-format", "%w", p], { encoding: "utf8" });
  return parseInt(r.stdout, 10) || 1080;
}
function imgDims(p) {
  const r = spawnSync(IDENTIFY, ["-format", "%w %h", p], { encoding: "utf8" });
  const [w, h] = (r.stdout || "").trim().split(/\s+/).map(Number);
  return { w: w || 1, h: h || 1 };
}

// Scale + center-crop an image to EXACTLY w×h (crop-to-fill). Lets us hit any
// custom size even though the engines only generate a few aspect ratios.
export function fitTo(pngPath, w, h) {
  if (!fs.existsSync(pngPath)) return false;
  const r = spawnSync(CONVERT, [
    pngPath, "-resize", `${w}x${h}^`, "-gravity", "center", "-extent", `${w}x${h}`, pngPath,
  ], { stdio: "ignore" });
  return r.status === 0;
}

const BRANDS_DIR = path.join(HERE, "assets", "brands");

// Which brand logos do we actually have a chip badge for?
export function availableBrands() {
  try {
    return fs.readdirSync(BRANDS_DIR).filter((f) => f.endsWith("-badge.png")).map((f) => f.replace("-badge.png", ""));
  } catch { return []; }
}

// Stamp real brand logos (TikTok, Claude, …) as small white-chip stickers, stacked
// in a corner. Uses the REAL logo files — AI can't render these without garbling them.
export function brandStickers(pngPath, names = [], { position = "northeast" } = {}) {
  if (!fs.existsSync(pngPath) || !names.length) return 0;
  const w = imgWidth(pngPath);
  const sw = Math.round(w * 0.17);     // sticker width
  const pad = Math.round(w * 0.04);
  const gap = Math.round(w * 0.02);
  let yOff = pad, stamped = 0;
  for (const raw of names) {
    const name = String(raw).toLowerCase().trim();
    const badge = path.join(BRANDS_DIR, `${name}-badge.png`);
    if (!fs.existsSync(badge)) continue;
    const r = spawnSync(CONVERT, [
      pngPath, "(", badge, "-resize", `${sw}x`, ")",
      "-gravity", position, "-geometry", `+${pad}+${yOff}`, "-composite", pngPath,
    ], { stdio: "ignore" });
    if (r.status === 0) {
      stamped++;
      const d = imgDims(badge);
      yOff += Math.round(sw * (d.h / d.w)) + gap;
    }
  }
  return stamped;
}

// Stamp the logo badge onto pngPath (overwrites it). position: south (default,
// bottom-center) | southeast | southwest. scalePct = badge width / image width.
// This is the EXPLICIT-placement path (--logo-pos); auto placement uses
// placeLogoSmart below. Kept small + chip-free by default for a cleaner look.
export function brandImage(pngPath, { position = "south", scalePct = 0.16 } = {}) {
  const art = logoArt();
  if (!art || !fs.existsSync(pngPath)) return false;
  const w = imgWidth(pngPath);
  const bw = Math.max(110, Math.round(w * scalePct));
  const margin = Math.round(w * 0.05);
  const geom = position === "south" || position === "north" ? `+0+${margin}` : `+${margin}+${margin}`;
  const r = spawnSync(CONVERT, [
    pngPath,
    "(", art.dark, "-resize", `${bw}x`, ")",
    "-gravity", position, "-geometry", geom, "-composite",
    pngPath,
  ], { stdio: "ignore" });
  return r.status === 0;
}

// ---- Smart, designerly logo placement ---------------------------------------
// The raw logo (transparent PNG) trimmed of its padding, plus a paper-white
// "reversed" copy for dark backgrounds. Built once and cached.
const RAW_LOGO = path.join(HERE, "assets", "academy-logo.png");
const CACHE = path.join(HERE, "assets", ".cache");
const PAPER = "#fcfdff";

function newer(src, dst) {
  try { return fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs; } catch { return false; }
}

// Returns { dark, light, aspect } — trimmed logo art for light/dark backgrounds.
let _art = null;
function logoArt() {
  if (_art) return _art;
  if (!fs.existsSync(RAW_LOGO)) return null;
  fs.mkdirSync(CACHE, { recursive: true });
  const dark = path.join(CACHE, "logo-dark.png");   // navy/blue/gold logo on light bg
  const light = path.join(CACHE, "logo-light.png"); // reversed paper-white on dark bg
  if (!newer(RAW_LOGO, dark)) {
    spawnSync(CONVERT, [RAW_LOGO, "-trim", "+repage", dark], { stdio: "ignore" });
  }
  if (!newer(RAW_LOGO, light)) {
    // Recolor every visible pixel to paper-white, keep the alpha shape -> clean
    // single-color reversed mark that reads on navy/dark areas.
    spawnSync(CONVERT, [dark, "-channel", "RGB", "-fill", PAPER, "-colorize", "100", light], { stdio: "ignore" });
  }
  if (!fs.existsSync(dark)) return null;
  const d = imgDims(dark);
  _art = { dark, light: fs.existsSync(light) ? light : dark, aspect: d.h / d.w };
  return _art;
}

// Grayscale standard deviation (busyness) + mean (brightness) of a sub-rectangle.
function regionStats(pngPath, x, y, w, h) {
  const r = spawnSync(CONVERT, [
    pngPath, "-crop", `${w}x${h}+${x}+${y}`, "+repage",
    "-colorspace", "Gray", "-format", "%[fx:standard_deviation] %[fx:mean]", "info:",
  ], { encoding: "utf8" });
  const [std, mean] = (r.stdout || "").trim().split(/\s+/).map(Number);
  return { std: isFinite(std) ? std : 1, mean: isFinite(mean) ? mean : 1 };
}

// Place the logo where a designer would: small, in the QUIETEST corner of THIS
// image (so placement varies per generation), reversed to white if that corner is
// dark, never a chip. `brands` (top-right stickers) reserve the NE corner.
export function placeLogoSmart(pngPath, { brands = [], scalePct = 0.14 } = {}) {
  const art = logoArt();
  if (!art || !fs.existsSync(pngPath)) return false;
  const { w: W, h: H } = imgDims(pngPath);
  const bw = Math.max(110, Math.round(W * scalePct));
  const bh = Math.round(bw * art.aspect);
  const m = Math.round(W * 0.05);         // edge margin
  const p = Math.round(bw * 0.45);        // extra breathing room sampled around the mark
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // candidate anchors: bottom corners favored, dead-center-bottom de-preferred,
  // top corners allowed. bias < 1 = preferred (multiplies the busyness score).
  const boxes = {
    SouthWest: { lx: m,           ly: H - m - bh, bias: 0.88 },
    SouthEast: { lx: W - m - bw,  ly: H - m - bh, bias: 0.88 },
    NorthWest: { lx: m,           ly: m,          bias: 1.00 },
    NorthEast: { lx: W - m - bw,  ly: m,          bias: 1.00 },
    South:     { lx: (W - bw) / 2, ly: H - m - bh, bias: 1.12 },
  };
  if (brands?.length) delete boxes.NorthEast; // brand stickers live here

  let best = null;
  for (const [g, b] of Object.entries(boxes)) {
    const rx = clamp(Math.round(b.lx - p), 0, Math.max(0, W - 1));
    const ry = clamp(Math.round(b.ly - p), 0, Math.max(0, H - 1));
    const rw = clamp(bw + 2 * p, 1, W - rx);
    const rh = clamp(bh + 2 * p, 1, H - ry);
    const { std, mean } = regionStats(pngPath, rx, ry, rw, rh);
    const score = std * b.bias;           // lower = quieter = better
    if (!best || score < best.score) best = { g, score, mean };
  }
  if (!best) return false;

  // reverse to white when the chosen corner is dark; dark logo on light corners
  const src = best.mean >= 0.55 ? art.dark : art.light;
  const geom = best.g === "South" ? `+0+${m}` : `+${m}+${m}`;
  const r = spawnSync(CONVERT, [
    pngPath,
    "(", src, "-resize", `${bw}x`, ")",
    "-gravity", best.g, "-geometry", geom, "-composite",
    pngPath,
  ], { stdio: "ignore" });
  return r.status === 0 ? best.g : false;
}

export const haveBrand = fs.existsSync(RAW_LOGO) || fs.existsSync(BADGE);

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
export function brandImage(pngPath, { position = "south", scalePct = 0.26 } = {}) {
  if (!fs.existsSync(BADGE) || !fs.existsSync(pngPath)) return false;
  const w = imgWidth(pngPath);
  const bw = Math.max(120, Math.round(w * scalePct));
  const margin = Math.round(w * 0.045);
  const geom = position === "south" ? `+0+${margin}` : `+${margin}+${margin}`;
  const r = spawnSync(CONVERT, [
    pngPath,
    "(", BADGE, "-resize", `${bw}x`, ")",
    "-gravity", position, "-geometry", geom, "-composite",
    pngPath,
  ], { stdio: "ignore" });
  return r.status === 0;
}

export const haveBrand = fs.existsSync(BADGE);

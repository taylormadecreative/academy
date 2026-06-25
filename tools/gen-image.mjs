// Gemini 3.1 Flash image generator (Nano Banana 2). Usage:
//   node gen-image.mjs <out.png> "<prompt>"
// Reads GOOGLE_API_KEY from env. 16:9 by default (GEN_AR to override).
import fs from "node:fs";

const KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEN_MODEL || "gemini-3.1-flash-image";
const AR = process.env.GEN_AR || "16:9";
const [, , outPath, ...rest] = process.argv;
const prompt = rest.join(" ");

if (!KEY) { console.error("ERR no GOOGLE_API_KEY"); process.exit(1); }
if (!outPath || !prompt) { console.error("usage: node gen-image.mjs <out.png> <prompt>"); process.exit(1); }

async function gen(withImageConfig) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: withImageConfig
      ? { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: AR } }
      : { responseModalities: ["IMAGE"] },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, j };
}

let r = await gen(true);
if (!r.ok) r = await gen(false); // retry without imageConfig if the schema is rejected
if (!r.ok) { console.error("API error", r.status, JSON.stringify(r.j).slice(0, 600)); process.exit(2); }

const parts = r.j?.candidates?.[0]?.content?.parts || [];
const img = parts.find((p) => p.inlineData?.data);
if (!img) { console.error("no image part", JSON.stringify(r.j).slice(0, 600)); process.exit(3); }
fs.writeFileSync(outPath, Buffer.from(img.inlineData.data, "base64"));
console.log("saved", outPath, fs.statSync(outPath).size, "bytes", img.inlineData.mimeType || "");

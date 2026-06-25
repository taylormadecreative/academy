// ChatGPT Image (OpenAI gpt-image) generator.
//   node openai-image.mjs <out.png> "<prompt>"
//   node openai-image.mjs --models            # list available image models
// Env: OPENAI_API_KEY (required), GEN_MODEL (default gpt-image-1),
//      GEN_SIZE (default 1536x1024), GEN_QUALITY (default high).
import fs from "node:fs";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("ERR no OPENAI_API_KEY in env"); process.exit(1); }

const MODEL = process.env.GEN_MODEL || "gpt-image-1";
const SIZE = process.env.GEN_SIZE || "1536x1024";
const QUALITY = process.env.GEN_QUALITY || "high";
const [, , outPath, ...rest] = process.argv;

if (outPath === "--models") {
  const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${KEY}` } });
  const j = await r.json();
  const imgs = (j.data || []).map((m) => m.id).filter((id) => /image/i.test(id)).sort();
  console.log("image-capable models:", imgs.join(", ") || "(none listed)");
  process.exit(0);
}

const prompt = rest.join(" ");
if (!outPath || !prompt) { console.error("usage: node openai-image.mjs <out.png> <prompt>"); process.exit(1); }

const res = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
});
const j = await res.json().catch(() => ({}));
if (!res.ok) { console.error("API error", res.status, JSON.stringify(j).slice(0, 700)); process.exit(2); }

const b64 = j?.data?.[0]?.b64_json;
if (!b64) { console.error("no image in response", JSON.stringify(j).slice(0, 500)); process.exit(3); }
fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
console.log("saved", outPath, fs.statSync(outPath).size, "bytes");

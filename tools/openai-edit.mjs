// ChatGPT Image (OpenAI gpt-image-2) IMAGE EDIT — composites a real photo onto a
// new AI background while preserving the subject.
//   node openai-edit.mjs <out.png> <inputImage> "<prompt>"
// Env: OPENAI_API_KEY (required), GEN_MODEL (default gpt-image-2),
//      GEN_SIZE (default 1024x1536), GEN_QUALITY (default high),
//      GEN_FIDELITY (default high — preserves the subject's face/details).
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("ERR no OPENAI_API_KEY"); process.exit(1); }

const MODEL = process.env.GEN_MODEL || "gpt-image-2";
const SIZE = process.env.GEN_SIZE || "1024x1536";
const QUALITY = process.env.GEN_QUALITY || "high";
const FIDELITY = process.env.GEN_FIDELITY || "high";
const [, , outPath, inputPath, ...rest] = process.argv;
const prompt = rest.join(" ");
if (!outPath || !inputPath || !prompt) { console.error("usage: node openai-edit.mjs <out.png> <input> <prompt>"); process.exit(1); }

const buf = fs.readFileSync(inputPath);
const ext = path.extname(inputPath).toLowerCase();
const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

const fd = new FormData();
fd.append("model", MODEL);
fd.append("image", new Blob([buf], { type }), "input" + ext);
fd.append("prompt", prompt);
fd.append("size", SIZE);
fd.append("quality", QUALITY);
if (FIDELITY && FIDELITY !== "off") fd.append("input_fidelity", FIDELITY); // unsupported on some models

const res = await fetch("https://api.openai.com/v1/images/edits", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}` },
  body: fd,
});
const j = await res.json().catch(() => ({}));
if (!res.ok) { console.error("API error", res.status, JSON.stringify(j).slice(0, 800)); process.exit(2); }
const b64 = j?.data?.[0]?.b64_json;
if (!b64) { console.error("no image in response", JSON.stringify(j).slice(0, 500)); process.exit(3); }
fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
console.log("saved", outPath, fs.statSync(outPath).size, "bytes");

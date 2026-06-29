// engines.mjs — importable wrappers around Nano Banana 2 (Gemini) and ChatGPT
// image (OpenAI), each returning { ok, buffer, mime, error }. Built-in retry.
// Mirrors the logic in ../gen-image.mjs, ../openai-image.mjs, ../openai-edit.mjs
// but adds reference-image support and is callable from make.mjs.
import fs from "node:fs";
import path from "node:path";

const GKEY = process.env.GOOGLE_API_KEY;
const OKEY = process.env.OPENAI_API_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fn();
      if (r.ok) return r;
      last = r;
    } catch (e) {
      last = { ok: false, error: String(e?.message || e) };
    }
    await sleep(800 * (i + 1));
  }
  return last || { ok: false, error: "unknown error" };
}

function mimeFor(p) {
  const ext = path.extname(p).toLowerCase();
  return ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
}

// ---- Nano Banana 2 / Gemini (best for exact 4:5 & 9:16 framing + ref photos) ----
export async function genGemini({ prompt, ar = "4:5", refs = [], model }) {
  if (!GKEY) return { ok: false, error: "no GOOGLE_API_KEY in env" };
  const MODEL = model || process.env.GEN_MODEL_GEMINI || "gemini-3.1-flash-image";

  const parts = [];
  for (const rp of refs) {
    try {
      const data = fs.readFileSync(rp).toString("base64");
      parts.push({ inlineData: { mimeType: mimeFor(rp), data } });
    } catch { /* skip unreadable ref */ }
  }
  parts.push({ text: prompt });

  const call = (withImageConfig) => {
    const body = {
      contents: [{ parts }],
      generationConfig: withImageConfig
        ? { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ar } }
        : { responseModalities: ["IMAGE"] },
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GKEY}`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, status: res.status, error: JSON.stringify(j).slice(0, 400) };
      const ps = j?.candidates?.[0]?.content?.parts || [];
      const img = ps.find((p) => p.inlineData?.data);
      if (!img) return { ok: false, error: "no image part in response" };
      return { ok: true, buffer: Buffer.from(img.inlineData.data, "base64"), mime: img.inlineData.mimeType || "image/png" };
    });
  };

  // retry, and if the imageConfig schema is rejected fall back without it
  return withRetry(async () => {
    let r = await call(true);
    if (!r.ok && /imageConfig|aspectRatio|INVALID/i.test(r.error || "")) r = await call(false);
    return r;
  });
}

// ---- ChatGPT image generate (best for crisp typographic posters / clean text) ----
export async function genOpenAI({ prompt, size = "1024x1536", model, quality = "high" }) {
  if (!OKEY) return { ok: false, error: "no OPENAI_API_KEY in env" };
  const MODEL = model || process.env.GEN_MODEL_OPENAI || "gpt-image-1";
  return withRetry(() =>
    fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OKEY}` },
      body: JSON.stringify({ model: MODEL, prompt, size, quality, n: 1 }),
    }).then(async (res) => {
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, status: res.status, error: JSON.stringify(j).slice(0, 400) };
      const b64 = j?.data?.[0]?.b64_json;
      if (!b64) return { ok: false, error: "no image in response" };
      return { ok: true, buffer: Buffer.from(b64, "base64"), mime: "image/png" };
    })
  );
}

// ---- ChatGPT image 2.0 EDIT — composite a real photo onto a new academy scene,
//      preserving the subject's face. This is the "fresh from real refs" path. ----
export async function editOpenAI({ prompt, refPath, size = "1024x1536", model, quality = "high", fidelity = "high" }) {
  if (!OKEY) return { ok: false, error: "no OPENAI_API_KEY in env" };
  const MODEL = model || process.env.GEN_MODEL_OPENAI_EDIT || "gpt-image-2";
  let buf;
  try { buf = fs.readFileSync(refPath); } catch (e) { return { ok: false, error: "cannot read ref: " + refPath }; }
  return withRetry(() => {
    const fd = new FormData();
    fd.append("model", MODEL);
    fd.append("image", new Blob([buf], { type: mimeFor(refPath) }), "input" + path.extname(refPath));
    fd.append("prompt", prompt);
    fd.append("size", size);
    fd.append("quality", quality);
    // input_fidelity is only supported on some models (e.g. gpt-image-1), not gpt-image-2
    if (fidelity && fidelity !== "off" && !/gpt-image-2/.test(MODEL)) fd.append("input_fidelity", fidelity);
    return fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OKEY}` },
      body: fd,
    }).then(async (res) => {
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, status: res.status, error: JSON.stringify(j).slice(0, 400) };
      const b64 = j?.data?.[0]?.b64_json;
      if (!b64) return { ok: false, error: "no image in response" };
      return { ok: true, buffer: Buffer.from(b64, "base64"), mime: "image/png" };
    });
  });
}

export const haveKeys = { gemini: !!GKEY, openai: !!OKEY };

// contact-sheet.mjs — render an HTML grid of every generated variant so you can
// compare side-by-side and pick the cleanest. Pure function: takes results, writes index.html.
import fs from "node:fs";
import path from "node:path";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function writeContactSheet(outDir, meta, results) {
  const cards = results.map((r) => {
    const media = r.ok
      ? `<img src="./${esc(r.file)}" alt="${esc(r.engine)} ${r.variant}">`
      : `<div class="fail">⚠ ${esc(r.engine)} failed<br><small>${esc(r.error || "")}</small></div>`;
    const tag = r.slide != null ? `slide ${r.slide}` : `v${r.variant}`;
    return `<figure>
      ${media}
      <figcaption>
        <span class="badge ${r.engine}">${esc(r.engine)}</span> ${tag}
        ${r.ok ? `<code>${esc(r.file)}</code>` : ""}
        <details><summary>prompt</summary><p>${esc(r.prompt)}</p></details>
      </figcaption>
    </figure>`;
  }).join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.label)} — Academy Machine contact sheet</title>
<style>
  :root{--ink:#0a1733;--paper:#fcfdff;--gold:#fdc921;--muted:#94a3b8}
  *{box-sizing:border-box} body{margin:0;background:#eef2fb;color:var(--ink);
    font:15px/1.5 'Inter',system-ui,sans-serif;padding:28px}
  header{max-width:1200px;margin:0 auto 22px}
  h1{font:700 26px/1.2 'Space Grotesk','Inter',sans-serif;margin:0 0 4px}
  .meta{color:var(--muted);font-size:13px}
  .grid{max-width:1200px;margin:0 auto;display:grid;
    grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
  figure{margin:0;background:var(--paper);border-radius:14px;overflow:hidden;
    box-shadow:0 6px 22px rgba(10,23,51,.08)}
  figure img{width:100%;display:block;background:#dfe6f5}
  .fail{padding:40px 16px;text-align:center;color:#b91c1c;background:#fff1f1}
  figcaption{padding:10px 12px;font-size:13px}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;
    font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.04em}
  .badge.gemini{background:#1e3a8a} .badge.openai{background:#0a1733}
  code{display:block;color:var(--muted);font-size:11px;margin:6px 0}
  details{margin-top:4px} summary{cursor:pointer;color:#1e3a8a;font-weight:600}
  details p{color:#475569;font-size:12px;white-space:pre-wrap}
</style></head><body>
<header>
  <h1>${esc(meta.label)}</h1>
  <div class="meta">recipe <b>${esc(meta.recipe)}</b> · format <b>${esc(meta.format)}</b> ·
    ${results.filter((r) => r.ok).length}/${results.length} generated ·
    ${esc(meta.when)}</div>
</header>
<div class="grid">
${cards}
</div>
</body></html>`;

  const file = path.join(outDir, "index.html");
  fs.writeFileSync(file, html);
  return file;
}

// tests/academy/prompt-kit.test.mjs — run: python3 build_prompt_kit.py && node --test tests/academy/prompt-kit.test.mjs
// The class-day Prompt Kit: exactly three Letter pages, at the address every old email link uses, made from the
// course module, and carrying nothing a public file must never carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const pdf = fs.readFileSync(ROOT + 'ai101/cheat-sheet.pdf');
const html = execFileSync('python3', ['-c', 'import build_prompt_kit as k; print(k.kit_html())'], { cwd: ROOT }).toString();
test('nothing spills past its page (a page box hides overflow, so 2 pages alone proves nothing)', async () => {
  const { chromium } = await import('./e2e/pw.mjs');
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 816, height: 1056 } });
  await p.goto('file://' + process.env.HOME + '/workshop-campaigns/ai-101-free/prompt-kit/kit.html');
  await p.waitForTimeout(600);
  const spill = await p.evaluate(() => [...document.querySelectorAll('.page')].flatMap((pg, i) => {
    const box = pg.getBoundingClientRect();
    return [...pg.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.bottom > box.bottom + 0.5 || r.right > box.right + 0.5); })
      .map((el) => `page ${i + 1}: ${el.tagName.toLowerCase()}.${el.className}`);
  }));
  await b.close();
  assert.deepEqual(spill, []);
});
test('three pages', () => { assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 3); });
test('Letter size', () => { assert.match(pdf.toString('latin1'), /\/MediaBox\s*\[\s*0 0 612 792\s*\]/); });
test('the kit carries 15 prompts (big enough to read on paper), 10 follow-ups, the fix-its and never-paste', () => {
  assert.equal((html.match(/class="kp-prompt"/g) || []).length, 15);
  assert.match(html, /All 30 are on your class page/);
  assert.equal((html.match(/class="kp-fu"/g) || []).length, 10);
  assert.match(html, /Never paste/); assert.match(html, /Fill in your prompt/);
});
test('follow line: Instagram first, then the Facebook group', () => {
  assert.ok(html.indexOf('@taylormade_creative') < html.indexOf('Facebook group'));
});
test('nothing a public file must never carry (the build guard, with its private list when present)', () => {
  execFileSync('python3', ['-c', 'import build_prompt_kit as k\nfrom build_ai101_class import check_public_copy\ncheck_public_copy(k.kit_html())'], { cwd: ROOT, stdio: 'pipe' });
  assert.doesNotMatch(html, /\$\s?65\b/);
});

// ---- final-review fixes (10/6) ----
test('print: readable sizes, and nothing inside the quarter inch a home printer cannot reach', async () => {
  const { chromium } = await import('./e2e/pw.mjs');
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 816, height: 1056 } });
  await p.goto('file://' + process.env.HOME + '/workshop-campaigns/ai-101-free/prompt-kit/kit.html');
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    const prompts = [...document.querySelectorAll('.kp-prompt span')].map(px);
    const near = [...document.querySelectorAll('.page')].flatMap((pg, i) => {
      const box = pg.getBoundingClientRect();
      return [...pg.querySelectorAll('footer *, header *')].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .filter((el) => { const q = el.getBoundingClientRect(); return q.bottom > box.bottom - 24 || q.top < box.top + 24; }).map((el) => `page ${i + 1}: ${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
    });
    const tiny = [...document.querySelectorAll('.page *')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && px(el) < 9.3).map((el) => el.className || el.tagName);
    return { minPrompt: Math.min(...prompts), near, tiny };
  });
  await b.close();
  assert.ok(r.minPrompt >= 11.3, `prompt text is ${r.minPrompt}px; 8.5pt (11.3px) is the floor on paper`);
  assert.deepEqual(r.near, [], 'text in the unprintable edge');
  assert.deepEqual(r.tiny, [], 'nothing under 7pt');
});
test("one palette: the kit's part colours are the class page's", () => {
  const css = fs.readFileSync(ROOT + 'css/ai101-class.css', 'utf8');
  const kit = JSON.parse(execFileSync('python3', ['-c', 'import json, build_prompt_kit as k; print(json.dumps(k.COLORS))'], { cwd: ROOT }).toString());
  for (const [k, c] of Object.entries(kit)) assert.match(css, new RegExp(`--p-${k}:${c}`), k);
});
test('the chat loop has arrowheads; the footer also names TikTok and LinkedIn', () => {
  assert.match(html, /<marker id="k"/); assert.match(html, /marker-end="url\(#k\)"/);
  assert.match(html, /TikTok/); assert.match(html, /LinkedIn/);
});

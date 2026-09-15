// tests/ht/contrast.test.mjs — run: node --test tests/ht/contrast.test.mjs
// Every text/background pair the HT room paints is ≥ 4.5:1 (WCAG AA). The pairs are listed here
// on purpose — a stylesheet parser would miss inherited colors; a human reads this table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../ht/hub/room.css', import.meta.url), 'utf8');
const lum = (hex) => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const PAIRS = [
  ['#FFFFFF', '#291C14', 'body text on the Terra canvas'],
  ['#FFFFFF', '#3B0000', 'body text on Mahogany (strip, panel, bar, preview)'],
  ['#FFFFFF', '#660100', 'button text on Maroon (r2-btn, fx tray, sheet card)'],
  ['#FFFFFF', '#8F0000', 'text on Brick'],
  ['#F7E3B8', '#291C14', 'Ember secondary text on canvas (r2-line, r2-wait ol)'],
  ['#F7E3B8', '#3B0000', 'Ember on Mahogany'],
  ['#C09780', '#291C14', 'Taupe muted text on canvas (r2-title, r2-under, r2-fine)'],
  ['#C09780', '#3B0000', 'Taupe on Mahogany (tabs off, r2-who span, r2-empty)'],
  ['#C09780', '#660100', 'Taupe on Maroon (tool hints, disabled cta)'],
  ['#3B0000', '#FFCC00', 'Mahogany on Gold (Enter, Bring, cta, fx on, queue number)'],
  ['#FFCC00', '#3B0000', 'Gold on Mahogany (recording chip, active tab, counts)'],
  ['#94CCAB', '#3B0000', 'Sage on Mahogany (live dot text)'],
  ['#00373E', '#C7EDBF', 'Eco Green on Fresh (cta.on)'],
  ['#FAA88A', '#660100', 'Bloom danger text on Maroon (end class)'],
  ['#FFFFFF', '#BA2E2E', 'white on Cinder (Leave)'],
  ['#3B0000', '#F7E3B8', 'Mahogany on Ember (toast)'],
  ['#3B0000', '#FFFAEB', 'Mahogany on Sand (host card fields)'],
  ['#660100', '#FFFAEB', 'Maroon on Sand (host card labels)'],
];

test('every pair the room paints is at least 4.5:1', () => {
  for (const [fg, bg, what] of PAIRS) {
    const r = ratio(fg, bg);
    assert.ok(r >= 4.5, `${what}: ${fg} on ${bg} = ${r.toFixed(2)}`);
  }
});

test('room.css uses HT colors and none of the Academy navy/gold', () => {
  for (const navy of ['#04123a', '#0a1733', '#0f1d44', '#162650', '#22345f', '#fdc921', '#9fb0d4', '#c9d4ee', '#6f80a8', '#3ddc97'])
    assert.doesNotMatch(css.toLowerCase(), new RegExp(navy), navy + ' is an Academy color');
  for (const ht of ['#291c14', '#3b0000', '#660100', '#ffcc00', '#c09780', '#f7e3b8'])
    assert.match(css.toLowerCase(), new RegExp(ht), ht + ' missing');
});

test('room.css never sets display on a kit element and keeps the [hidden] guards', () => {
  assert.doesNotMatch(css, /rtk-[a-z-]+\s*\{[^}]*display\s*:/);
  assert.match(css, /\.r2-pane\[hidden\]\{display:none\}/);
  assert.match(css, /\.r2-sheet\[hidden\]\{display:none\}/);
});

test('room.css hides the hub chrome while in the room and paints Ada on the waiting screen', () => {
  assert.match(css, /body\.in-room[^{]*\.ht-tabs/);
  assert.match(css, /body\.in-room[^{]*\.ht-head/);
  assert.match(css, /body\.in-room[^{]*\.ht-room-ctl/);
  assert.match(css, /ada-face\.jpg/);
});

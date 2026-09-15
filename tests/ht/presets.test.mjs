// tests/ht/presets.test.mjs — run: node --test tests/ht/presets.test.mjs
// The HT presets are the OPIL bodies with HT's name, HT's design tokens and (guest) no file sharing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (n) => JSON.parse(fs.readFileSync(new URL('../../scripts/rtk-presets/' + n + '.json', import.meta.url), 'utf8'));

const HT_UI = {
  theme: 'darkest', font_family: 'Inter', border_radius: 'rounded', border_width: 'thin',
  colors: {
    brand: { 300: '#FFE580', 400: '#FFD940', 500: '#FFCC00', 600: '#D9AD00', 700: '#B38F00' },
    background: { 600: '#8F0000', 700: '#660100', 800: '#4D0000', 900: '#3B0000', 1000: '#291C14' },
    text: '#FFFFFF', text_on_brand: '#3B0000', video_bg: '#3B0000',
    danger: '#FA2626', success: '#94CCAB', warning: '#F2B00D',
  },
  logo: 'https://taylormadeacademy.com/ht/img/ht-monogram-gold.png', spacing_base: 4,
};

function stripUiAndName(p) { const c = JSON.parse(JSON.stringify(p)); delete c.name; delete c.ui; return c; }

test('ht-class-host = opil-host with HT name + HT tokens, nothing else changed', () => {
  const ht = read('ht-class-host'), opil = read('opil-host');
  assert.equal(ht.name, 'ht-class-host');
  assert.deepEqual(ht.ui.design_tokens, HT_UI);
  assert.deepEqual(stripUiAndName(ht), stripUiAndName(opil));
  assert.equal(ht.config.view_type, 'GROUP_CALL');
});

test('ht-class-guest = opil-student with HT name + HT tokens + no file sharing + transcription on, nothing else changed', () => {
  const ht = read('ht-class-guest'), opil = read('opil-student');
  assert.equal(ht.name, 'ht-class-guest');
  assert.deepEqual(ht.ui.design_tokens, HT_UI);
  assert.equal(ht.permissions.chat.public.files, false);
  assert.equal(ht.permissions.chat.private.files, false);
  assert.equal(ht.permissions.chat.public.text, true);          // text chat stays
  assert.equal(ht.permissions.transcription_enabled, true);     // HT guests are captioned (9/15: "show the transcriptions as she talks")
  const a = stripUiAndName(ht), b = stripUiAndName(opil);
  b.permissions.chat.public.files = false; b.permissions.chat.private.files = false;
  b.permissions.transcription_enabled = true;
  assert.deepEqual(a, b);
});

test('both bodies keep the two fields the API silently requires', () => {
  for (const n of ['ht-class-host', 'ht-class-guest']) {
    const p = read(n);
    assert.equal(typeof p.permissions.plugins.config, 'object');   // 400 without it (memory: realtimekit-live-rooms)
    assert.equal(p.ui.design_tokens.spacing_base, 4);
  }
});

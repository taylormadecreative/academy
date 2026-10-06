/* js/ai101-kit.js — the AI 101 class kit's pure logic. No DOM, no network, so `node --test` covers every
   branch (tests/academy/ai101-kit.test.mjs). Used by the class page (js/ai101-class.js, js/ai101-proof.js)
   and the stage (js/ai101-stage.js). displayName() must stay in step with ea_review_save in 0059. */
export const PART_KEYS = ['role', 'task', 'context', 'format', 'example'];

// Spaces of every kind, invisible joiners and control characters all count as one space, so a name made of them
// is no name. ea_review_display_name in 0059 uses the same set.
const SPACEY = /[\s\p{Cc}\u200b-\u200d\u2060\ufeff]+/gu;
const clean = (s) => String(s == null ? '' : s).replace(SPACEY, ' ').trim();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const end = (s) => (/[.!?]["')\]]?$/.test(s) ? s : s + '.');

export function promptPieces(parts = {}) {
  const p = Object.fromEntries(PART_KEYS.map((k) => [k, clean(parts && parts[k])]));
  const out = [];
  if (p.role) out.push({ key: 'role', text: end(/^you are\b/i.test(p.role) ? p.role.replace(/^you are/i, 'You are') : 'You are ' + p.role) });
  for (const k of ['task', 'context', 'format']) if (p[k]) out.push({ key: k, text: end(cap(p[k])) });
  if (p.example) out.push({ key: 'example', text: 'Here is an example I like: "' + p.example.replace(/^["“]+|["”]+$/g, '') + '"' });
  return out;
}
export function buildPrompt(parts = {}) { return promptPieces(parts).map((x) => x.text).join(' '); }

export function missingParts(parts = {}) {
  return PART_KEYS.slice(0, 4).filter((k) => !clean(parts && parts[k]));
}

/* A teaching approximation, labelled as one on the page: real tokenizers differ by model. Words keep their
   leading space (as real tokens do), numbers go in chunks of up to three digits, long words split in fives. */
export function splitTokens(text) {
  const pieces = String(text == null ? '' : text).match(/\s*[A-Za-z']+|\s*\d{1,3}|\s*[^\sA-Za-z\d]/g) || [];
  const out = [];
  for (const piece of pieces) {
    const word = piece.trim();
    if (/^[A-Za-z']+$/.test(word) && word.length > 8) {
      const lead = piece.slice(0, piece.length - word.length);
      for (let i = 0; i < word.length; i += 5) out.push((i === 0 ? lead : '') + word.slice(i, i + 5));
    } else out.push(piece);
  }
  return out;
}

const CT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ctParts = (ms) => Object.fromEntries(CT.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
export function ctMinutes(nowMs) { const p = ctParts(nowMs); return (+p.hour % 24) * 60 + +p.minute; }
export function ctDate(nowMs) { const p = ctParts(nowMs); return `${p.year}-${p.month}-${p.day}`; }

export function isBehind(nowMs, sceneIndex, checks) {
  const day = ctDate(nowMs), t = ctMinutes(nowMs);
  return (checks || []).some((c) => c.date === day && t >= c.at && sceneIndex < c.scene);
}

export function countdown(msLeft) {
  const s = Math.max(0, Math.ceil((msLeft || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* The countdown to a moment (the 7:00 start): days and hours when it's far off, hours and minutes within a day,
   m:ss within the hour — so a rehearsal days early never shows "5020:12". */
export function untilLabel(msLeft) {
  const ms = Math.max(0, msLeft || 0);
  if (ms >= 24 * 3600e3) return `${Math.floor(ms / 86400e3)}d ${Math.floor((ms % 86400e3) / 3600e3)}h`;
  if (ms >= 3600e3) return `${Math.floor(ms / 3600e3)}h ${String(Math.floor((ms % 3600e3) / 60e3)).padStart(2, '0')}m`;
  return countdown(ms);
}

export function readState(storage, key, fallback) {
  try { const v = storage ? storage.getItem(key) : null; return v == null ? fallback : JSON.parse(v); }
  catch (e) { return fallback; }
}
export function writeState(storage, key, value) {
  try { if (!storage) return false; storage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

export function displayName(fullName) { // counts characters, not UTF-16 halves, like Postgres does
  const w = clean(fullName).split(' ').filter(Boolean);
  if (!w.length) return 'Academy member';
  const chars = (s) => Array.from(s), f = chars(w[0]);
  const first = chars(f[0].toUpperCase() + f.slice(1).join('')).slice(0, 40).join('');
  return w.length > 1 ? `${first} ${chars(w[w.length - 1])[0].toUpperCase()}.` : first;
}

export function createDeck(beats) {
  const b = beats.map((n) => Math.max(1, n | 0));
  let scene = 0, beat = 0;
  const pos = () => ({ scene, beat });
  return {
    pos,
    next() { if (beat < b[scene] - 1) beat++; else if (scene < b.length - 1) { scene++; beat = 0; } return pos(); },
    prev() { if (beat > 0) beat--; else if (scene > 0) { scene--; beat = b[scene] - 1; } return pos(); },
    go(s, bt = 0) { scene = Math.max(0, Math.min(b.length - 1, s | 0)); beat = Math.max(0, Math.min(b[scene] - 1, bt | 0)); return pos(); },
  };
}

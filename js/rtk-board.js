/* Whiteboard — class plugin (spec 2026-09-16-class-features-design.md §7).
   Tools › Whiteboard opens a drawing surface over the video: pen (three widths, five colors), text,
   a sticky note, a box, an arrow, a picture from Files, move what you added, undo what you added; the
   host can clear the board (two taps) and close it for everyone. Every mark is one JSON op
   ({id, kind, points|text|rect|path, color, w, by, at}) that rides the class channel `board` AND lands in
   ea_class_board_ops, so a late joiner loads the board and it survives a reload. One board per room:
   'main', or the small group's meeting id inside a breakout. Save to Files renders a PNG into the
   class's materials (OPIL sessions only — a room without a session is told so).
   A picture on the board is always a file from Files (a materials/ path in the class bucket): every
   viewer mints their own short link, so no op can make a classmate's browser fetch an outside address.
   Coordinates are a fixed 1600×900 board scaled to fit the stage, so everyone sees the same picture;
   on a phone the board keeps a readable size and scrolls (the honest limit: one screen, no infinite
   canvas) — the Scroll tool, phone only, is how a finger pans it.
   What the channel may carry: an 'op' payload is a drawable or a move only; undo rides its own payload;
   clear / open / close count only from a remembered host, and a clear is checked against the table a
   moment later (the channel is public — payload.from is the sender's word, see the integrator note).
   The pure decisions (reduceOps, hitTest, serialize/deserialize, wrapText, fit, mergeLoaded) are
   exported for tests; this file is import-safe in Node. */
export const BOARD_W = 1600;
export const BOARD_H = 900;
export const MIN_CSS_W = 560;    /* below this a phone scrolls the board instead of shrinking it further */
export const TEXT_MAX = 400;
export const NOTE_W = 320;
export const NOTE_H = 200;
export const NOTE_FONT = 26;
export const NOTE_LINE = 32;
export const NOTE_PAD = 16;
export const TEXT_WRAP_W = 720;
export const MAX_POINTS = 4000;
export const COLORS = Object.freeze([
  { name: 'White', hex: '#fcfdff' },
  { name: 'Gold', hex: '#fdc921' },
  { name: 'Green', hex: '#3ddc97' },
  { name: 'Red', hex: '#ff5c5c' },
  { name: 'Blue', hex: '#7fb2ff' },
]);
export const WIDTHS = Object.freeze([{ name: 'Thin', w: 3 }, { name: 'Medium', w: 6 }, { name: 'Thick', w: 12 }]);
export const TOOLS = Object.freeze([
  { key: 'pen', word: 'Pen', line: 'Pen — draw with your finger or mouse.' },
  { key: 'text', word: 'Text', line: 'Text — tap where the words should go.' },
  { key: 'note', word: 'Note', line: 'Note — tap where the sticky note should go.' },
  { key: 'rect', word: 'Box', line: 'Box — drag to draw a box.' },
  { key: 'arrow', word: 'Arrow', line: 'Arrow — drag from the tail to the tip.' },
  { key: 'move', word: 'Move', line: 'Move — drag anything you added.' },
  { key: 'scroll', word: 'Scroll', line: 'Scroll — swipe to move around the board. Pick a tool to draw.', phoneOnly: true },
]);
export const SHAPE_KINDS = Object.freeze(['pen', 'text', 'note', 'rect', 'arrow', 'image']);
/* what an 'op' payload from a classmate may carry: something drawn, or a move. Undo has its own payload;
   clear is the host's own payload — a clear wrapped inside an 'op' would let anyone wipe every screen. */
export const isDrawOp = (op) => !!op && (SHAPE_KINDS.includes(op.kind) || op.kind === 'move');
export const RECONCILE_MS = 2500;   /* after a host's clear arrives, the table is re-read this much later */
const HEX = /^#[0-9a-f]{6}$/i;
const BUCKET = 'opil-files';

/* ---- ids and time ---- */
export function newId(now) {
  const t = (Number(now) || Date.now()).toString(36);
  return t + '-' + Math.random().toString(36).slice(2, 8);
}
/* "Whiteboard 7:42 PM" — the file's name in Files */
export function whiteboardTitle(now, zone) {
  const opts = { hour: 'numeric', minute: '2-digit' }; if (zone) opts.timeZone = zone;
  return 'Whiteboard ' + new Date(Number(now) || Date.now()).toLocaleTimeString('en-US', opts);
}
export const textSize = (w) => Math.round(18 + (Number(w) || 3) * 2);   /* thin 24 · medium 30 · thick 42 */

/* ---- ops: validate, serialize, deserialize ---- */
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; };
const pairs = (list, max) => {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const p of list.slice(0, max)) { if (!Array.isArray(p)) return null; const x = num(p[0]), y = num(p[1]); if (x == null || y == null) return null; out.push([x, y]); }
  return out.length ? out : null;
};
const rect4 = (r) => { const p = Array.isArray(r) && r.length === 4 ? r.map(num) : null; return p && p.every(v => v != null) && p[2] >= 0 && p[3] >= 0 ? p : null; };
/* a storage path the class may read: materials/<uploader>/<file>, no dots-up, no scheme */
export const isMaterialsPath = (p) => typeof p === 'string' && /^materials\/[^/]+\/[^/]+$/.test(p) && !/(^|\/)\.\.?(\/|$)/.test(p) && !/[\r\n\t:?#\\]/.test(p);
/* an op as the board trusts it, or null. A string is parsed first. Never throws. */
export function normalizeOp(raw) {
  let o = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { return null; } }
  if (!o || typeof o !== 'object') return null;
  const kind = String(o.kind || '');
  const id = String(o.id || '').slice(0, 40);
  if (!id) return null;
  const base = { id, kind, by: String(o.by || '').slice(0, 80), at: Number(o.at) || 0, color: HEX.test(String(o.color || '')) ? String(o.color).toLowerCase() : COLORS[0].hex, w: Math.min(40, Math.max(1, Number(o.w) || 3)) };
  if (kind === 'pen') { const points = pairs(o.points, MAX_POINTS); return points ? Object.assign(base, { points }) : null; }
  if (kind === 'arrow') { const points = pairs(o.points, 2); return points && points.length === 2 ? Object.assign(base, { points }) : null; }
  if (kind === 'rect') { const rect = rect4(o.rect); return rect ? Object.assign(base, { rect }) : null; }
  if (kind === 'text' || kind === 'note') {
    const text = String(o.text == null ? '' : o.text).slice(0, TEXT_MAX).trim(); const rect = rect4(o.rect);
    return text && rect ? Object.assign(base, { text, rect }) : null;
  }
  if (kind === 'image') {   /* a file in the class bucket only — never an outside address */
    const path = String(o.path || '').slice(0, 300); const rect = rect4(o.rect);
    if (!isMaterialsPath(path) || !rect) return null;
    return Object.assign(base, { path, rect });
  }
  if (kind === 'move') { const dx = num(o.dx), dy = num(o.dy), target = String(o.target || '').slice(0, 40); return target && dx != null && dy != null ? Object.assign(base, { target, dx, dy }) : null; }
  if (kind === 'undo') { const target = String(o.target || '').slice(0, 40); return target ? Object.assign(base, { target }) : null; }
  if (kind === 'clear') return base;
  return null;
}
export const serialize = (op) => { const n = normalizeOp(op); return n ? JSON.stringify(n) : null; };
export const deserialize = (s) => normalizeOp(s);

/* ---- reduce: the ops that still count after clears and undos, and the shapes they make ---- */
export function keptOps(ops) {
  let kept = [];
  for (const op of ops || []) {
    if (!op || typeof op !== 'object') continue;
    if (op.kind === 'clear') { kept = []; continue; }
    if (op.kind === 'undo') {   /* you can only undo what you added */
      for (let i = kept.length - 1; i >= 0; i--) if (kept[i].id === op.target && kept[i].by === op.by) { kept.splice(i, 1); break; }
      continue;
    }
    kept.push(op);
  }
  return kept;
}
const cloneShape = (op) => Object.assign({}, op, op.points ? { points: op.points.map(p => p.slice()) } : {}, op.rect ? { rect: op.rect.slice() } : {});
/* the shapes to draw, in order: clears wipe, undos remove, moves shift the shape they name (own shapes only) */
export function reduceOps(ops) {
  const shapes = [], byId = new Map();
  for (const op of keptOps(ops)) {
    if (op.kind === 'move') {
      const s = byId.get(op.target); if (!s || s.by !== op.by) continue;
      if (s.points) s.points = s.points.map(p => [p[0] + op.dx, p[1] + op.dy]);
      if (s.rect) { s.rect[0] += op.dx; s.rect[1] += op.dy; }
    } else if (SHAPE_KINDS.includes(op.kind)) {
      const s = cloneShape(op); shapes.push(s); byId.set(s.id, s);
    }
  }
  return shapes;
}
/* what the board holds once its rows arrive: the rows (the table is the truth for clears and undos — they
   delete rows), then the ops that came over the channel while we loaded, minus anything a clear among them
   already wiped (everything up to the last clear is gone either way, and a clear replayed AFTER the rows
   would wipe what was drawn since it) and minus ops the rows already hold. Undos and moves in the tail
   stay: an undo only removes its author's own mark, so it is safe if the row delete has not landed yet. */
export function mergeLoaded(rows, pending) {
  const base = (rows || []).filter(Boolean), tail = (pending || []).filter(Boolean);
  let cut = -1; tail.forEach((p, i) => { if (p.kind === 'clear') cut = i; });
  const seen = new Set(base.map(r => r.id));
  return base.concat(tail.slice(cut + 1).filter(p => p.kind !== 'clear' && !seen.has(p.id)));
}
/* the last thing this person added (or moved) that is still on the board — what Undo takes back */
export function lastOwn(ops, by) {
  const kept = keptOps(ops);
  for (let i = kept.length - 1; i >= 0; i--) if (kept[i].by === by) return kept[i].id;
  return null;
}

/* ---- geometry ---- */
export function bounds(op) {
  if (!op) return null;
  if (op.rect) return op.rect.slice();
  if (op.points && op.points.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    op.points.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return [x0, y0, x1 - x0, y1 - y0];
  }
  return null;
}
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};
/* is (x, y) on this shape? Strokes and arrows count within their width plus a finger's slack; boxes,
   text, notes and pictures count inside their rectangle. */
export function hitTest(op, x, y, pad = 8) {
  if (!op) return false;
  if (op.kind === 'pen' || op.kind === 'arrow') {
    const pts = op.points || []; const r = (Number(op.w) || 3) / 2 + pad;
    if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= r;
    for (let i = 1; i < pts.length; i++) if (segDist(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= r) return true;
    return false;
  }
  const b = bounds(op); if (!b) return false;
  const p = op.kind === 'rect' ? pad : 0;
  return x >= b[0] - p && x <= b[0] + b[2] + p && y >= b[1] - p && y <= b[1] + b[3] + p;
}
/* the topmost shape under a point that this person may move (their own) */
export function pickShape(shapes, x, y, by) {
  for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].by === by && hitTest(shapes[i], x, y)) return shapes[i];
  return null;
}
/* the board's size on this screen: fit 16:9 inside the box; never narrower than MIN_CSS_W (a phone scrolls) */
export function fit(boxW, boxH, min = MIN_CSS_W) {
  let scale = Math.min((Number(boxW) || 0) / BOARD_W, (Number(boxH) || 0) / BOARD_H);
  if (!(scale > 0) || scale * BOARD_W < min) scale = min / BOARD_W;
  return { cssW: Math.round(BOARD_W * scale), cssH: Math.round(BOARD_H * scale), scale };
}
/* a pointer's place on the board, clamped to it */
export function toBoard(clientX, clientY, rect, scale) {
  const x = (clientX - rect.left) / scale, y = (clientY - rect.top) / scale;
  return [Math.max(0, Math.min(BOARD_W, Math.round(x))), Math.max(0, Math.min(BOARD_H, Math.round(y)))];
}
/* lines of text that fit a width, by a measure function (the canvas's measureText in the browser) */
export function wrapText(text, maxWidth, measure, maxLines = 12) {
  const lines = [];
  String(text || '').split(/\r?\n/).forEach(para => {
    let line = '';
    para.split(/\s+/).filter(Boolean).forEach(word => {
      while (measure(word) > maxWidth && word.length > 1) {   /* a word longer than the box breaks by letters */
        let cut = word.length - 1; while (cut > 1 && measure(word.slice(0, cut)) > maxWidth) cut--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, cut)); word = word.slice(cut);
      }
      const trial = line ? line + ' ' + word : word;
      if (line && measure(trial) > maxWidth) { lines.push(line); line = word; } else line = trial;
    });
    lines.push(line);
  });
  return lines.slice(0, maxLines);
}
/* how much is on the board, as a sentence */
export const countLine = (count) => count ? count + (count === 1 ? ' thing' : ' things') + ' on the board.' : 'Nothing on the board yet.';
/* the line under the toolbar: what the current tool does, or whose board this is. The overlay shows the
   tool sentence AND the count (boardLine) so a reader learns both. */
export function stateLine({ tool, count, host } = {}) {
  const t = TOOLS.find(x => x.key === tool);
  if (t) return t.line;
  return count ? countLine(count) : host ? 'Nothing on the board yet — pick a tool.' : 'Nothing on the board yet.';
}
export const boardLine = ({ tool, count } = {}) => (TOOLS.some(x => x.key === tool) ? stateLine({ tool }) + ' ' : '') + countLine(count);
export function boardIdFor(ctx) {
  try { if (ctx.inSmallGroup && ctx.inSmallGroup()) { const id = ctx.getMeeting().meta.meetingId; if (id) return String(id); } } catch (e) {}
  return 'main';
}

/* ---- drawing (browser only; called with a 2d context in board units) ---- */
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawShape(g, s, images, measureFont) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (s.kind === 'pen') {
    g.strokeStyle = s.color; g.lineWidth = s.w; g.beginPath();
    const p = s.points; g.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) g.lineTo(p[0][0] + 0.1, p[0][1]);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
    g.stroke();
  } else if (s.kind === 'arrow') {
    const [a, b] = s.points; g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = s.w;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), head = 10 + s.w * 3;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] - Math.cos(ang) * head * 0.6, b[1] - Math.sin(ang) * head * 0.6); g.stroke();
    g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45)); g.lineTo(b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45)); g.closePath(); g.fill();
  } else if (s.kind === 'rect') {
    g.strokeStyle = s.color; g.lineWidth = s.w; roundRect(g, s.rect[0], s.rect[1], s.rect[2], s.rect[3], 6); g.stroke();
  } else if (s.kind === 'text') {
    const size = textSize(s.w); g.font = measureFont(size); g.fillStyle = s.color; g.textBaseline = 'top';
    wrapText(s.text, s.rect[2] + 4, (t) => g.measureText(t).width).forEach((line, i) => g.fillText(line, s.rect[0], s.rect[1] + i * size * 1.25));
  } else if (s.kind === 'note') {
    g.fillStyle = '#fdc921'; roundRect(g, s.rect[0], s.rect[1], s.rect[2], s.rect[3], 10); g.fill();
    g.fillStyle = '#04123a'; g.font = measureFont(NOTE_FONT); g.textBaseline = 'top';
    const pad = NOTE_PAD, lines = wrapText(s.text, s.rect[2] - pad * 2, (t) => g.measureText(t).width, Math.floor((s.rect[3] - pad * 2) / NOTE_LINE));
    lines.forEach((line, i) => g.fillText(line, s.rect[0] + pad, s.rect[1] + pad + i * NOTE_LINE));
  } else if (s.kind === 'image') {
    const im = images.get(s.id);
    if (im && im.ok) { try { g.drawImage(im.img, s.rect[0], s.rect[1], s.rect[2], s.rect[3]); } catch (e) {} }
    else { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.setLineDash([8, 8]); roundRect(g, s.rect[0], s.rect[1], s.rect[2], s.rect[3], 8); g.stroke(); g.setLineDash([]); g.fillStyle = '#9fb0d4'; g.font = measureFont(20); g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(im && im.failed ? 'This picture didn’t load' : 'Picture loading…', s.rect[0] + s.rect[2] / 2, s.rect[1] + s.rect[3] / 2); g.textAlign = 'start'; }
  }
}
function paintBoard(g, shapes, draft, selectedId, images, measureFont) {
  g.clearRect(0, 0, BOARD_W, BOARD_H);
  g.fillStyle = '#0a1733'; g.fillRect(0, 0, BOARD_W, BOARD_H);
  g.fillStyle = 'rgba(255,255,255,.07)';
  for (let x = 40; x < BOARD_W; x += 40) for (let y = 40; y < BOARD_H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
  shapes.forEach(s => drawShape(g, s, images, measureFont));
  if (draft) drawShape(g, draft, images, measureFont);
  if (selectedId) { const s = shapes.find(x => x.id === selectedId); const b = s && bounds(s); if (b) { g.strokeStyle = '#fdc921'; g.lineWidth = 2; g.setLineDash([6, 6]); g.strokeRect(b[0] - 6, b[1] - 6, b[2] + 12, b[3] + 12); g.setLineDash([]); } }
}

/* ---- the plugin ---- */
export function create(ctx) {
  const { sb, esc, uid, host, toast, confirmInline } = ctx;
  let chan = null, overlay = null, canvas = null, g = null, scrollBox = null, input = null, lineEl = null, ro = null;
  let ops = [], shapes = [], loaded = false, loading = null, loadStamp = 0, pending = [], boardId = 'main', reconcileTimer = null;
  let tool = 'pen', color = COLORS[1].hex, width = WIDTHS[1].w;
  let draft = null, drag = null, selectedId = null, layout = { cssW: 0, cssH: 0, scale: 1 };
  let warnedSave = false, everSeen = false, saving = false;
  const images = new Map();   /* shape id → { img, ok, failed } */
  const measureFont = (size) => '600 ' + size + 'px Inter, system-ui, sans-serif';
  const now = () => (ctx.now ? ctx.now() : Date.now());
  const visible = () => !!(overlay && !overlay.hidden);

  function ensureCss() {
    try {
      if (document.querySelector('link[data-rtk-board]')) return;
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/rtk-board.css' + new URL(import.meta.url).search; l.dataset.rtkBoard = '1'; document.head.appendChild(l);
    } catch (e) {}
  }

  /* ---- state ---- */
  function recompute() { shapes = reduceOps(ops); shapes.forEach(s => { if (s.kind === 'image') loadImage(s); }); paint(); sayState(); }
  /* before the board has loaded (never opened, or loading now) an op waits in `pending`; load() merges it in */
  function apply(op) { if (!op) return; if (!loaded) { pending.push(op); return; } ops.push(op); recompute(); }
  async function persist(op) {
    try {
      const { error } = await sb.from('ea_class_board_ops').insert({ room_key: ctx.roomKey, board_id: boardId, op_id: op.id, op });
      if (error) throw error;
    } catch (e) {
      console.warn('[board] save op', e);
      if (!warnedSave) { warnedSave = true; toast('Your drawing shows now, but may not stay after a reload. Check your connection.', 7000); }
    }
  }
  function emit(op) {
    const clean = normalizeOp(op); if (!clean) return;
    apply(clean);
    if (chan) chan.send({ kind: 'op', board: boardId, op: clean });
    persist(clean);
  }
  /* stamped with the board it is for: a load still in flight when the class splits must not land the main
     room's rows under the small group's id (resetBoard drops the stamp; the stale result is thrown away) */
  async function load() {
    if (loading) return loading;
    const forBoard = boardId, stamp = ++loadStamp;
    const stale = () => forBoard !== boardId || stamp !== loadStamp;
    loading = (async () => {
      try {
        const { data, error } = await sb.from('ea_class_board_ops').select('op').eq('room_key', ctx.roomKey).eq('board_id', forBoard).order('seq');
        if (error) throw error;
        if (stale()) return;
        const rows = (data || []).map(r => normalizeOp(r.op)).filter(Boolean);
        ops = mergeLoaded(rows, pending); pending = []; loaded = true;
      } catch (e) {
        if (stale()) return;
        console.warn('[board] load', e); ops = mergeLoaded([], pending); pending = []; loaded = true;
        toast('Could not load what was already on the board. You can still draw — reload to try again.', 7000);
      }
      recompute();
    })();
    return loading;
  }
  /* read the table again, keeping the channel ops that arrive meanwhile: a host's clear is confirmed this way */
  function reload() { loaded = false; loading = null; pending = []; return load(); }
  function resetBoard() { ops = []; shapes = []; pending = []; loaded = false; loading = null; loadStamp++; selectedId = null; draft = null; drag = null; images.clear(); boardId = boardIdFor(ctx); }

  /* ---- the channel ---- */
  function handle(p, meta) {
    if (!p || typeof p !== 'object' || !meta || meta.mine) return;
    if (String(p.board || 'main') !== boardId) return;   /* another room's board */
    if (p.kind === 'op') {   /* a drawable or a move, by its sender — never a clear or an undo in disguise */
      const op = normalizeOp(p.op); if (!op || op.by !== p.from || !isDrawOp(op)) return;
      apply(op); firstNews();
    } else if (p.kind === 'undo') {
      const op = normalizeOp({ id: newId(now()), kind: 'undo', target: p.target, by: p.from }); if (op) apply(op);
    } else if (p.kind === 'clear') {
      if (!meta.fromHost) return;
      apply(normalizeOp({ id: newId(now()), kind: 'clear', by: p.from }));
      if (visible()) toast('The host cleared the whiteboard.');
      /* the channel takes the sender's word for who they are; the table does not. A moment later the rows
         are read again: a real clear stays clear, a forged one puts the marks back. */
      if (loaded) { clearTimeout(reconcileTimer); reconcileTimer = setTimeout(() => { reconcileTimer = null; if (loaded) reload(); }, RECONCILE_MS); }
    } else if (p.kind === 'open') {
      if (!meta.fromHost) return;
      open({ byHost: true });
    } else if (p.kind === 'close') {
      if (!meta.fromHost) return;
      if (visible()) { hide(); toast('The host closed the whiteboard. It’s still in Tools if you want it back.', 6000); }
    }
  }
  /* something landed on a board I have never opened: say where it is, once */
  function firstNews() { if (everSeen || visible()) return; everSeen = true; toast('Someone is drawing on the whiteboard — open Tools › Whiteboard to see it.', 7000); }

  /* ---- the overlay ---- */
  function build() {
    if (overlay) return;
    ensureCss();
    overlay = ctx.stage.overlay('r2-wb');
    /* the action buttons render twice: inline in the bar (a wide screen) and inside a More sheet (a phone,
       where the bar must stay short so the board keeps room to draw on); CSS shows one of the two */
    const actions = () => `<button type="button" class="r2-mini" data-act="undo">Undo</button>
          <button type="button" class="r2-mini" data-act="save">Save to Files</button>
          ${host ? '<button type="button" class="r2-mini r2-wb-danger" data-act="clear">Clear the board</button>' : ''}
          <button type="button" class="r2-mini" data-act="close">Close</button>
          ${host ? '<button type="button" class="r2-mini" data-act="closeall">Close for everyone</button>' : ''}`;
    overlay.innerHTML = `<div class="r2-wb-bar">
        <span class="r2-wb-line" role="status"></span>
        <div class="r2-wb-group r2-wb-tools" role="group" aria-label="Tool">${TOOLS.map(t => `<button type="button" class="r2-mini${t.phoneOnly ? ' r2-wb-phone' : ''}" data-tool="${t.key}" aria-pressed="false">${esc(t.word)}</button>`).join('')}</div>
        <div class="r2-wb-style"><div class="r2-wb-group r2-wb-widths" role="group" aria-label="Line width">${WIDTHS.map(x => `<button type="button" class="r2-mini" data-width="${x.w}" aria-pressed="false" aria-label="${esc(x.name)} line">${esc(x.name)}</button>`).join('')}</div>
        <div class="r2-wb-group r2-wb-colors" role="group" aria-label="Color">${COLORS.map(c => `<button type="button" class="r2-mini r2-wb-swatch" data-color="${c.hex}" style="--ink:${c.hex}" aria-pressed="false" aria-label="${esc(c.name)}"><i></i><span>${esc(c.name)}</span></button>`).join('')}</div></div>
        <div class="r2-wb-group r2-wb-acts">${actions()}</div>
        <div class="r2-wb-group r2-wb-more"><button type="button" class="r2-mini" data-act="more">More</button></div>
      </div>
      <div class="r2-wb-scroll"><div class="r2-wb-wrap"><canvas class="r2-wb-canvas" aria-label="Whiteboard"></canvas><textarea class="r2-wb-input" rows="2" maxlength="${TEXT_MAX}" hidden aria-label="Type, then press Enter"></textarea></div></div>`;
    canvas = overlay.querySelector('.r2-wb-canvas'); g = canvas.getContext('2d');
    scrollBox = overlay.querySelector('.r2-wb-scroll'); input = overlay.querySelector('.r2-wb-input'); lineEl = overlay.querySelector('.r2-wb-line');
    overlay.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
    overlay.querySelectorAll('[data-width]').forEach(b => b.addEventListener('click', () => { width = Number(b.dataset.width) || 6; syncBar(); }));
    overlay.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { color = b.dataset.color; syncBar(); }));
    wireActions(overlay.querySelector('.r2-wb-acts'), null);
    overlay.querySelector('[data-act="more"]').addEventListener('click', () => {
      const pane = document.createElement('div'); pane.className = 'r2-wb-sheet'; pane.innerHTML = `<p class="r2-fine">Undo takes back the last thing you added. Save puts a picture of the board in Files.</p><div class="r2-wb-sheet-acts">${actions()}</div>`;
      wireActions(pane, () => { try { ctx.closeSheet(); } catch (e) {} });
      ctx.openSheet('Whiteboard', pane);
    });
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); } else if (e.key === 'Escape') { e.preventDefault(); cancelText(); } });
    input.addEventListener('blur', () => { if (!input.hidden) commitText(); });
    try { ro = new ResizeObserver(() => relayout()); ro.observe(scrollBox); } catch (e) { try { window.addEventListener('resize', relayout); } catch (x) {} }
    syncBar();
  }
  /* the action buttons, wherever they render; `after` runs once an action is done (the More sheet closes) */
  function wireActions(root, after) {
    const done = () => { if (after) after(); };
    const on = (act, fn) => { const b = root.querySelector('[data-act="' + act + '"]'); if (b) b.addEventListener('click', fn); return b; };
    on('undo', () => { undo(); done(); });
    on('save', () => { save(); done(); });
    on('close', () => { hide(); done(); toast(host ? 'Closed for you — everyone else still sees the board. Close for everyone takes it off every screen.' : 'Whiteboard closed for you — it’s in Tools when you want it back.', 6000); });
    /* confirmInline rewrites the button's words on the first tap and leaves them on the second — the label is set whole here */
    on('clear', (ev) => { const b = ev.currentTarget; if (!confirmInline(b, 'Clear everything?')) return; b.innerHTML = 'Clear the board'; clearAll(); done(); });
    on('closeall', () => { closeForEveryone(); done(); });
  }
  const saveButtons = () => { const out = []; try { overlay.querySelectorAll('[data-act="save"]').forEach(b => out.push(b)); document.querySelectorAll('.r2-wb-sheet [data-act="save"]').forEach(b => out.push(b)); } catch (e) {} return out; };
  function relayout() {
    if (!canvas || !visible()) return;
    const box = scrollBox.getBoundingClientRect();
    layout = fit(box.width, box.height);
    const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.style.width = layout.cssW + 'px'; canvas.style.height = layout.cssH + 'px';
    canvas.width = Math.round(layout.cssW * dpr); canvas.height = Math.round(layout.cssH * dpr);
    g.setTransform(dpr * layout.scale, 0, 0, dpr * layout.scale, 0, 0);
    paint();
  }
  function paint() { if (!g || !visible()) return; try { paintBoard(g, shapes, draft, selectedId, images, measureFont); } catch (e) { console.warn('[board] paint', e); } }
  /* the tool sentence and how much is on the board, together — a reader learns both */
  function sayState() { if (!lineEl) return; lineEl.textContent = boardLine({ tool, count: shapes.length }); }
  function syncBar() {
    if (!overlay) return;
    overlay.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tool ? 'true' : 'false'));
    overlay.querySelectorAll('[data-width]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.width) === width ? 'true' : 'false'));
    overlay.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', b.dataset.color === color ? 'true' : 'false'));
    /* groups the tool does not use are dimmed, never hidden: hiding them reflows the bar and the board jumps under the finger */
    overlay.querySelector('.r2-wb-widths').classList.toggle('r2-wb-off', !(tool === 'pen' || tool === 'rect' || tool === 'arrow' || tool === 'text'));
    overlay.querySelector('.r2-wb-colors').classList.toggle('r2-wb-off', tool === 'note' || tool === 'move' || tool === 'scroll');
    /* Scroll hands the finger to the browser: the canvas pans instead of drawing (touch-action lives in the CSS) */
    if (canvas) canvas.dataset.scroll = tool === 'scroll' ? '1' : '';
    sayState();
  }
  function setTool(t) { if (!TOOLS.some(x => x.key === t)) return; cancelText(); tool = t; selectedId = null; syncBar(); paint(); }

  /* ---- open / close ---- */
  async function open({ byHost } = {}) {
    try {
      build();
      const id = boardIdFor(ctx); if (id !== boardId) resetBoard();
      const wasVisible = visible();
      overlay.hidden = false; relayout();
      if (!loaded) { lineEl.textContent = 'Loading the board…'; await load(); relayout(); }
      sayState();
      /* only a fresh open is news: Tools tapped while the board is up, or a picture added, must not force the
         board back onto someone who closed it for themselves, nor log another chapter */
      if (host && !byHost && !wasVisible) { if (chan) chan.send({ kind: 'open', board: boardId }); try { ctx.events.log('board', 'Whiteboard opened'); } catch (e) {} }
      everSeen = true;
    } catch (e) { console.warn('[board] open', e); toast('The whiteboard could not open. Reload the page and try again.', 7000); }
  }
  function hide() { cancelText(); if (overlay) overlay.hidden = true; }
  function closeForEveryone() { hide(); if (chan) chan.send({ kind: 'close', board: boardId }); toast('Whiteboard closed for everyone.'); }

  /* ---- drawing ---- */
  const at = (e) => toBoard(e.clientX, e.clientY, canvas.getBoundingClientRect(), layout.scale);
  function onDown(e) {
    if (!visible() || (e.button != null && e.button !== 0)) return;
    if (tool === 'scroll') return;   /* the browser gets this touch: it pans the board */
    if (!input.hidden) { commitText(); return; }
    const [x, y] = at(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    if (tool === 'pen') draft = { id: newId(now()), kind: 'pen', points: [[x, y]], color, w: width, by: uid, at: now() };
    else if (tool === 'rect') draft = { id: newId(now()), kind: 'rect', rect: [x, y, 0, 0], color, w: width, by: uid, at: now(), _from: [x, y] };
    else if (tool === 'arrow') draft = { id: newId(now()), kind: 'arrow', points: [[x, y], [x, y]], color, w: width, by: uid, at: now() };
    else if (tool === 'text' || tool === 'note') { showInput(x, y); e.preventDefault(); return; }
    else if (tool === 'move') {
      const s = pickShape(shapes, x, y, uid);
      selectedId = s ? s.id : null;
      drag = s ? { id: s.id, from: [x, y], dx: 0, dy: 0, base: cloneShape(s) } : null;
      if (!s) toast(shapes.some(sh => hitTest(sh, x, y)) ? 'You can only move what you added.' : 'Tap something you added, then drag it.', 4000);
      paint();
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (!draft && !drag) return;
    const [x, y] = at(e);
    if (draft) {
      if (draft.kind === 'pen') { const l = draft.points[draft.points.length - 1]; if (Math.hypot(x - l[0], y - l[1]) >= 2 && draft.points.length < MAX_POINTS) draft.points.push([x, y]); }
      else if (draft.kind === 'rect') { const f = draft._from; draft.rect = [Math.min(f[0], x), Math.min(f[1], y), Math.abs(x - f[0]), Math.abs(y - f[1])]; }
      else if (draft.kind === 'arrow') draft.points[1] = [x, y];
    } else if (drag) {
      drag.dx = x - drag.from[0]; drag.dy = y - drag.from[1];
      const s = shapes.find(sh => sh.id === drag.id);
      if (s) { const b = drag.base; if (b.points) s.points = b.points.map(p => [p[0] + drag.dx, p[1] + drag.dy]); if (b.rect) s.rect = [b.rect[0] + drag.dx, b.rect[1] + drag.dy, b.rect[2], b.rect[3]]; }
    }
    paint(); e.preventDefault();
  }
  function onUp(e) {
    try { canvas.releasePointerCapture(e.pointerId); } catch (x) {}
    if (draft) {
      const d = draft; draft = null;
      const ok = d.kind === 'pen' ? d.points.length >= 1 : d.kind === 'rect' ? d.rect[2] >= 4 && d.rect[3] >= 4 : Math.hypot(d.points[1][0] - d.points[0][0], d.points[1][1] - d.points[0][1]) >= 6;
      if (ok) { delete d._from; emit(d); } else paint();
    } else if (drag) {
      const d = drag; drag = null;
      if (Math.abs(d.dx) >= 2 || Math.abs(d.dy) >= 2) emit({ id: newId(now()), kind: 'move', target: d.id, dx: d.dx, dy: d.dy, by: uid, at: now() });
      else recompute();
    }
  }
  /* text and notes: a box appears where you tapped; Enter keeps it, Escape drops it */
  function showInput(x, y) {
    input.hidden = false; input.value = ''; input.dataset.x = x; input.dataset.y = y; input.dataset.kind = tool;
    input.classList.toggle('note', tool === 'note');
    input.style.left = Math.round(x * layout.scale) + 'px'; input.style.top = Math.round(y * layout.scale) + 'px';
    input.style.color = tool === 'note' ? '#04123a' : color; input.style.fontSize = Math.round((tool === 'note' ? NOTE_FONT : textSize(width)) * layout.scale) + 'px';
    input.placeholder = tool === 'note' ? 'Type the note, then press Enter' : 'Type, then press Enter';
    try { input.focus(); } catch (e) {}
    setTimeout(() => { try { if (!input.hidden) input.focus(); } catch (e) {} }, 0);
  }
  /* hide, THEN blur on purpose: a hidden element that still has focus gets its blur from the browser
     later, and that late blur would commit the next box empty (seen in the Chrome harness 9/16) */
  function hideInput() { input.hidden = true; input.value = ''; try { input.blur(); } catch (e) {} }
  function cancelText() { if (!input || input.hidden) return; hideInput(); }
  function commitText() {
    if (!input || input.hidden) return;
    const text = input.value.trim().slice(0, TEXT_MAX), kind = input.dataset.kind, x = Number(input.dataset.x) || 0, y = Number(input.dataset.y) || 0;
    hideInput();
    if (!text) return;
    if (kind === 'note') { emit({ id: newId(now()), kind: 'note', text, rect: [Math.min(x, BOARD_W - NOTE_W), Math.min(y, BOARD_H - NOTE_H), NOTE_W, NOTE_H], color: '#fdc921', w: width, by: uid, at: now() }); return; }
    const size = textSize(width); g.font = measureFont(size);
    const lines = wrapText(text, TEXT_WRAP_W, (t) => g.measureText(t).width);
    const w = Math.max(20, Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)))), h = Math.ceil(lines.length * size * 1.25);
    emit({ id: newId(now()), kind: 'text', text, rect: [Math.max(0, Math.min(x, BOARD_W - w)), Math.max(0, Math.min(y, BOARD_H - h)), w, h], color, w: width, by: uid, at: now() });   /* on the board, never off its edge */
  }
  /* a picture from Files: the Files tab hands over the file's storage path (and, if it has one, a signed
     link this viewer may use right now); the op carries only the path — every viewer mints their own link,
     so the board never sends anyone's browser to an outside address. It lands centred, at most 600 wide. */
  async function addImage(url, path) {
    const p = String(path || '');
    if (!isMaterialsPath(p)) { toast('Only a picture from Files can go on the board. Add it to Files first, then choose Put on the whiteboard.', 7000); return null; }
    await open();
    const im = await loadUrl(/^https:\/\//i.test(String(url || '')) ? String(url) : await signedLink(p));
    if (!im) { toast('That picture didn’t load. Try Download instead.', 6000); return null; }
    const scale = Math.min(1, 600 / im.naturalWidth, 500 / im.naturalHeight), w = Math.round(im.naturalWidth * scale), h = Math.round(im.naturalHeight * scale);
    const op = { id: newId(now()), kind: 'image', path: p, rect: [Math.round((BOARD_W - w) / 2), Math.round((BOARD_H - h) / 2), w, h], color, w: width, by: uid, at: now() };
    images.set(op.id, { img: im, ok: true });
    emit(op); toast('Picture added — Move drags it where you want.', 5000);
    return op.id;
  }
  async function signedLink(path) {
    try { const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600); return data && data.signedUrl ? data.signedUrl : null; } catch (e) { console.warn('[board] picture link', e); return null; }
  }
  function loadUrl(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      try { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; } catch (e) { resolve(null); }
    });
  }
  async function loadImage(s) {
    if (images.has(s.id)) return;
    images.set(s.id, { img: null, ok: false });
    const im = isMaterialsPath(s.path) ? await loadUrl(await signedLink(s.path)) : null;
    images.set(s.id, im ? { img: im, ok: true } : { img: null, ok: false, failed: true });
    paint();
  }

  /* ---- undo · clear · save ---- */
  async function undo() {
    const target = lastOwn(ops, uid);
    if (!target) { toast('Nothing of yours to undo.'); return; }
    emitUndo(target);
  }
  function emitUndo(target) {
    const op = normalizeOp({ id: newId(now()), kind: 'undo', target, by: uid, at: now() });
    apply(op);
    if (chan) chan.send({ kind: 'undo', board: boardId, target });
    sb.from('ea_class_board_ops').delete().eq('room_key', ctx.roomKey).eq('board_id', boardId).eq('op_id', target).then(({ error }) => { if (error) console.warn('[board] undo row', error.message); }, (e) => console.warn('[board] undo row', e));
  }
  async function clearAll() {
    if (!host) return;
    apply(normalizeOp({ id: newId(now()), kind: 'clear', by: uid, at: now() }));
    if (chan) chan.send({ kind: 'clear', board: boardId });
    try { const { error } = await sb.from('ea_class_board_ops').delete().eq('room_key', ctx.roomKey).eq('board_id', boardId); if (error) throw error; toast('The board is clear for everyone.'); }
    catch (e) { console.warn('[board] clear rows', e); toast('The board is clear on every screen now, but the old marks may come back after a reload. Try Clear again.', 7000); }
    try { ctx.events.log('board', 'Whiteboard cleared'); } catch (e) {}
  }
  function renderPng() {
    return new Promise((resolve, reject) => {
      const c = document.createElement('canvas'); c.width = BOARD_W; c.height = BOARD_H;
      const cg = c.getContext('2d'); paintBoard(cg, shapes, null, null, images, measureFont);
      try { c.toBlob((b) => b ? resolve(b) : reject(new Error('no blob')), 'image/png'); } catch (e) { reject(e); }
    });
  }
  async function save() {
    if (saving) return;
    /* an ea_rooms room (HT, the Academy) saves under its class key (0054); an OPIL session under its number */
    const roomKey = ctx.isRoom && ctx.target && ctx.target.id ? 'room:' + ctx.target.id : null;
    if (!roomKey && (!ctx.session || ctx.session.no == null)) { toast('Saving to Files needs a class session — this room has none. Take a screenshot to keep it.', 7000); return; }
    if (roomKey && !ctx.host) { toast('Only a host can save the board to Files here — take a screenshot to keep it.', 7000); return; }
    if (!shapes.length) { toast('The board is empty — draw something first.'); return; }
    saving = true; const btns = saveButtons(); btns.forEach(btn => { btn.disabled = true; btn.textContent = 'Saving…'; });
    try {
      const blob = await renderPng();
      const title = whiteboardTitle(now(), 'America/New_York');
      const path = 'materials/' + uid + '/' + (roomKey ? 'room/' + ctx.target.id + '/' : '') + now().toString(36) + '-Whiteboard.png';
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false });
      if (up.error) throw up.error;
      const ins = await sb.from('ea_opil_materials').insert(roomKey ? { room_key: roomKey, kind: 'resource', title, file_path: path, uploaded_by: uid } : { session_no: ctx.session.no, kind: 'resource', title, file_path: path, uploaded_by: uid });
      if (ins.error) { try { await sb.storage.from(BUCKET).remove([path]); } catch (e) {} throw ins.error; }
      toast('Saved to Files as “' + title + '” — everyone in the ' + (roomKey ? 'room' : 'class') + ' can download it.', 7000);
      try { ctx.events.log('board', 'Whiteboard saved to Files', { path }); } catch (e) {}
    } catch (e) {
      console.warn('[board] save', e);
      toast(/security|tainted/i.test(String(e && (e.name || e.message))) ? 'A picture on the board blocks saving. Remove it and try again.' : 'Could not save the board to Files. Check your connection and try again.', 7000);
    }
    saving = false; btns.forEach(btn => { btn.disabled = false; btn.textContent = 'Save to Files'; });
  }

  return {
    name: 'board',   /* the integrator finds this plugin by name (Tools › Whiteboard, Files › Put on the whiteboard) */
    start() {
      try {
        boardId = boardIdFor(ctx);
        chan = ctx.channel('board'); chan.on(handle);
        ctx.on('bind', () => { const id = boardIdFor(ctx); if (id === boardId) return; const wasOpen = visible(); hide(); resetBoard(); if (wasOpen) open({ byHost: true }); });
        ctx.on('ended', () => hide());
      } catch (e) { console.warn('[board] start', e); }
    },
    stop() { try { if (chan) chan.stop(); } catch (e) {} chan = null; clearTimeout(reconcileTimer); reconcileTimer = null; try { if (ro) ro.disconnect(); } catch (e) {} if (overlay) { try { overlay.remove(); } catch (e) {} overlay = null; } },
    open: () => open(),
    close: hide,
    addImage,
    reload,
    isOpen: visible,
    ops: () => ops.slice(),
    shapes: () => shapes.slice(),
    boardId: () => boardId,
  };
}

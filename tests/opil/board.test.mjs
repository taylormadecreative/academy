// node --test tests/opil/board.test.mjs — the whiteboard's pure decisions and the plugin's channel rules
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reduceOps, keptOps, lastOwn, hitTest, pickShape, bounds, normalizeOp, serialize, deserialize, wrapText, fit, toBoard,
  whiteboardTitle, stateLine, countLine, boardLine, boardIdFor, textSize, newId, create, mergeLoaded, isDrawOp, isMaterialsPath,
  BOARD_W, BOARD_H, MIN_CSS_W, TEXT_MAX, COLORS, TOOLS, SHAPE_KINDS, RECONCILE_MS,
} from '../../js/rtk-board.js';

const pen = (id, by, pts, extra) => Object.assign({ id, kind: 'pen', by, points: pts, color: '#fdc921', w: 6, at: 1 }, extra);
const box = (id, by, rect) => ({ id, kind: 'rect', by, rect, color: '#fcfdff', w: 3, at: 1 });

test('reduceOps: shapes in order; a clear wipes everything before it', () => {
  const ops = [pen('a', 'u1', [[0, 0], [10, 10]]), box('b', 'u2', [5, 5, 50, 50]), { id: 'c', kind: 'clear', by: 'host' }, pen('d', 'u1', [[1, 1]])];
  assert.deepEqual(reduceOps(ops).map(s => s.id), ['d']);
  assert.deepEqual(reduceOps(ops.slice(0, 2)).map(s => s.id), ['a', 'b']);
});

test('undo removes only your own op — someone else naming your id changes nothing', () => {
  const ops = [pen('a', 'u1', [[0, 0]]), box('b', 'u2', [0, 0, 1, 1]), { id: 'x', kind: 'undo', target: 'a', by: 'u2' }];
  assert.deepEqual(reduceOps(ops).map(s => s.id), ['a', 'b']);
  ops.push({ id: 'y', kind: 'undo', target: 'a', by: 'u1' });
  assert.deepEqual(reduceOps(ops).map(s => s.id), ['b']);
  assert.equal(lastOwn(ops, 'u1'), null);
  assert.equal(lastOwn(ops, 'u2'), 'b');
});

test('move shifts your own shape (points and rects), never someone else’s; an unknown target is ignored', () => {
  const ops = [pen('a', 'u1', [[0, 0], [10, 10]]), box('b', 'u2', [5, 5, 50, 50]),
    { id: 'm1', kind: 'move', target: 'a', dx: 100, dy: 50, by: 'u1' },
    { id: 'm2', kind: 'move', target: 'b', dx: 100, dy: 50, by: 'u1' },
    { id: 'm3', kind: 'move', target: 'nope', dx: 1, dy: 1, by: 'u1' }];
  const s = reduceOps(ops);
  assert.deepEqual(s[0].points, [[100, 50], [110, 60]]);
  assert.deepEqual(s[1].rect, [5, 5, 50, 50]);
  assert.deepEqual(ops[0].points, [[0, 0], [10, 10]], 'the source op is never mutated');
  assert.equal(lastOwn(ops, 'u1'), 'm3', 'undo takes back the last thing you did, a move included');
  const undone = reduceOps(ops.concat({ id: 'u', kind: 'undo', target: 'm1', by: 'u1' }));
  assert.deepEqual(undone[0].points, [[0, 0], [10, 10]], 'undoing a move puts the shape back');
  assert.equal(keptOps(ops).length, 5);
});

test('hitTest: a stroke counts within its width plus a finger; boxes, text and notes count inside', () => {
  const stroke = pen('a', 'u1', [[100, 100], [200, 100]], { w: 6 });
  assert.equal(hitTest(stroke, 150, 105), true);
  assert.equal(hitTest(stroke, 150, 130), false);
  assert.equal(hitTest(pen('dot', 'u1', [[50, 50]]), 55, 52), true);
  const arrow = { id: 'r', kind: 'arrow', by: 'u1', points: [[0, 0], [100, 100]], w: 3 };
  assert.equal(hitTest(arrow, 50, 50), true); assert.equal(hitTest(arrow, 50, 80), false);
  const b = box('b', 'u1', [10, 10, 100, 60]);
  assert.equal(hitTest(b, 50, 40), true); assert.equal(hitTest(b, 5, 5), true, 'a box has slack outside its line'); assert.equal(hitTest(b, 200, 200), false);
  const t = { id: 't', kind: 'text', by: 'u1', text: 'hi', rect: [300, 300, 80, 30] };
  assert.equal(hitTest(t, 340, 315), true); assert.equal(hitTest(t, 299, 315), false);
  assert.deepEqual(bounds(stroke), [100, 100, 100, 0]);
  assert.equal(hitTest(null, 0, 0), false);
});

test('pickShape: the topmost of YOUR shapes under the finger', () => {
  const shapes = reduceOps([box('a', 'u1', [0, 0, 100, 100]), box('b', 'u2', [0, 0, 100, 100]), box('c', 'u1', [0, 0, 100, 100])]);
  assert.equal(pickShape(shapes, 50, 50, 'u1').id, 'c');
  assert.equal(pickShape(shapes, 50, 50, 'u2').id, 'b');
  assert.equal(pickShape(shapes, 50, 50, 'u3'), null);
  assert.equal(pickShape(shapes, 500, 500, 'u1'), null);
});

test('serialize/deserialize round-trip; bad ops are refused, bad colors fall back, text is capped', () => {
  const op = pen('a1', 'u1', [[1.26, 2], [3, 4]], { w: 12, color: '#3DDC97', at: 1700000000000 });
  const json = serialize(op);
  assert.equal(typeof json, 'string');
  const back = deserialize(json);
  assert.deepEqual(back, { id: 'a1', kind: 'pen', by: 'u1', at: 1700000000000, color: '#3ddc97', w: 12, points: [[1.3, 2], [3, 4]] });
  assert.equal(deserialize('not json'), null);
  assert.equal(normalizeOp(null), null);
  assert.equal(normalizeOp({ kind: 'pen', points: [[0, 0]] }), null, 'no id, no op');
  assert.equal(normalizeOp({ id: 'z', kind: 'blob' }), null);
  assert.equal(normalizeOp({ id: 'z', kind: 'pen', points: [] }), null);
  assert.equal(normalizeOp({ id: 'z', kind: 'pen', points: [[0, 'x']] }), null);
  assert.equal(normalizeOp({ id: 'z', kind: 'arrow', points: [[0, 0]] }), null, 'an arrow needs two points');
  assert.equal(normalizeOp({ id: 'z', kind: 'rect', rect: [0, 0, -5, 5] }), null);
  assert.equal(normalizeOp({ id: 'z', kind: 'text', text: '   ', rect: [0, 0, 1, 1] }), null, 'empty text is no op');
  const long = normalizeOp({ id: 'z', kind: 'text', text: 'x'.repeat(1000), rect: [0, 0, 1, 1], color: 'red' });
  assert.equal(long.text.length, TEXT_MAX); assert.equal(long.color, COLORS[0].hex);
  assert.equal(normalizeOp({ id: 'z', kind: 'image', src: 'https://tracker.example/pixel', rect: [0, 0, 1, 1] }), null, 'a picture is a file in Files, never an outside address');
  assert.equal(normalizeOp({ id: 'z', kind: 'image', rect: [0, 0, 10, 10], path: '../etc' }), null, 'a path outside materials/ is refused');
  assert.equal(normalizeOp({ id: 'z', kind: 'image', rect: [0, 0, 10, 10], path: 'materials/u/../../x' }), null);
  const img = normalizeOp({ id: 'z', kind: 'image', src: 'https://x/y.png', rect: [0, 0, 10, 10], path: 'materials/u/1-a.png' });
  assert.equal(img.path, 'materials/u/1-a.png'); assert.equal('src' in img, false, 'the op carries the path only — every viewer mints their own link');
  assert.deepEqual(normalizeOp({ id: 'm', kind: 'move', target: 'a', dx: 1, dy: '2', by: 'u' }).dx, 1);
  assert.equal(normalizeOp({ id: 'm', kind: 'move', target: '', dx: 1, dy: 2 }), null);
  assert.equal(normalizeOp({ id: 'u', kind: 'undo', target: 'a' }).target, 'a');
  assert.equal(normalizeOp({ id: 'c', kind: 'clear' }).kind, 'clear');
  assert.equal(normalizeOp({ id: 'z', kind: 'pen', points: [[0, 0]], w: 999 }).w, 40, 'width is capped');
  assert.equal(serialize({ id: 'z', kind: 'blob' }), null);
});

test('wrapText: words fill a width, a too-long word breaks by letters, lines are capped', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapText('the quick brown fox', 100, measure), ['the quick', 'brown fox']);
  assert.deepEqual(wrapText('a\nb', 100, measure), ['a', 'b']);
  assert.deepEqual(wrapText('abcdefghijklmnop', 50, measure), ['abcde', 'fghij', 'klmno', 'p']);
  assert.equal(wrapText('x y z w', 10, measure, 2).length, 2);
  assert.deepEqual(wrapText('', 100, measure), ['']);
});

test('fit: the board fits 16:9 inside the stage; a phone never shrinks it past readable, it scrolls', () => {
  const d = fit(1200, 800);
  assert.equal(d.cssW, 1200); assert.equal(d.cssH, 675); assert.equal(d.scale, 0.75);
  const wide = fit(2000, 450);
  assert.equal(wide.cssH, 450); assert.equal(wide.cssW, 800);
  const short = fit(1000, 300);
  assert.equal(short.cssW, MIN_CSS_W, 'a short stage still gets a readable board — it scrolls'); assert.equal(short.cssH, 315);
  const phone = fit(360, 500);
  assert.equal(phone.cssW, MIN_CSS_W); assert.equal(phone.cssH, 315);
  assert.equal(fit(0, 0).cssW, MIN_CSS_W, 'a box with no size yet still gets a board');
  assert.deepEqual(toBoard(110, 110, { left: 10, top: 10 }, 0.5), [200, 200]);
  assert.deepEqual(toBoard(-50, 99999, { left: 0, top: 0 }, 1), [0, BOARD_H]);
  assert.equal(BOARD_W / BOARD_H, 16 / 9);
});

test('words: the file title, the state line, the text sizes', () => {
  assert.equal(whiteboardTitle(Date.UTC(2026, 8, 16, 23, 42), 'America/New_York'), 'Whiteboard 7:42 PM');
  assert.equal(stateLine({ tool: 'pen' }), 'Pen — draw with your finger or mouse.');
  assert.equal(stateLine({ tool: 'nope', count: 0, host: true }), 'Nothing on the board yet — pick a tool.');
  assert.equal(stateLine({ count: 1 }), '1 thing on the board.');
  assert.equal(stateLine({ count: 4 }), '4 things on the board.');
  assert.equal(textSize(3), 24); assert.equal(textSize(6), 30); assert.equal(textSize(12), 42);
  assert.equal(TOOLS.length, 7); assert.equal(COLORS.length, 5);
  assert.deepEqual(TOOLS.filter(t => t.phoneOnly).map(t => t.key), ['scroll'], 'Scroll is the phone-only way to pan the board');
  assert.equal(countLine(0), 'Nothing on the board yet.'); assert.equal(countLine(2), '2 things on the board.');
  assert.equal(boardLine({ tool: 'pen', count: 3 }), 'Pen — draw with your finger or mouse. 3 things on the board.', 'the overlay says the tool AND the count');
  assert.equal(boardLine({ tool: 'nope', count: 0 }), 'Nothing on the board yet.');
  assert.notEqual(newId(1), newId(1));
  assert.match(newId(1700000000000), /^[a-z0-9]+-[a-z0-9]{6}$/);
});

test('boardIdFor: main in the class, the small group’s meeting id inside one', () => {
  assert.equal(boardIdFor({ inSmallGroup: () => false, getMeeting: () => ({ meta: { meetingId: 'abc' } }) }), 'main');
  assert.equal(boardIdFor({ inSmallGroup: () => true, getMeeting: () => ({ meta: { meetingId: 'abc' } }) }), 'abc');
  assert.equal(boardIdFor({ inSmallGroup: () => true, getMeeting: () => { throw new Error('gone'); } }), 'main');
  assert.equal(boardIdFor({}), 'main');
});

/* ---- the plugin, with a stub ctx: no DOM until open(), so the channel rules can be checked in Node ---- */
function stubCtx({ host = false, uid = 'me', rows = [], defer = false } = {}) {
  const subs = [], sent = [], toasts = [], events = [], listeners = {}, selects = [];
  const db = { rows, defer, resolvers: [] };
  const answer = () => ({ data: db.rows.map(op => ({ op })), error: null });
  const order = () => { selects.push(1); if (!db.defer) return Promise.resolve(answer()); return new Promise(r => db.resolvers.push(() => r(answer()))); };
  const ctx = {
    sb: { from: () => ({
      insert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ eq: () => ({ order }) }) }),
      delete: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }), then: (ok) => ok({ error: null }) }) }) }),
    }) },
    esc: (s) => String(s), uid, host, roomKey: 'opil:1', session: { no: 1 },
    toast: (m) => toasts.push(m), confirmInline: () => true,
    inSmallGroup: () => false, getMeeting: () => ({ meta: { meetingId: 'root' } }),
    channel: () => ({ on: (cb) => subs.push(cb), send: (p) => sent.push(p), stop() {} }),
    on: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); },
    events: { log: async (k, l) => { events.push([k, l]); }, list: async () => [] },
    now: () => 1700000000000,
    stage: { overlay() { throw new Error('no DOM in Node'); } },
  };
  return { ctx, subs, sent, toasts, events, listeners, selects, db, fire: (p, meta) => subs.forEach(cb => cb(p, meta)) };
}

test('plugin: start subscribes the board channel and never throws; ops from classmates are kept for the first open', () => {
  const s = stubCtx();
  const p = create(s.ctx); p.start();
  assert.equal(s.subs.length, 1);
  assert.equal(p.boardId(), 'main');
  s.fire({ kind: 'op', board: 'main', from: 'u2', op: pen('a', 'u2', [[0, 0]]) }, { fromHost: false, mine: false });
  assert.equal(p.ops().length, 0, 'held until the board loads');
  assert.equal(s.toasts.length, 1); assert.match(s.toasts[0], /Tools › Whiteboard/);
  s.fire({ kind: 'op', board: 'main', from: 'u2', op: pen('b', 'u2', [[0, 0]]) }, { fromHost: false, mine: false });
  assert.equal(s.toasts.length, 1, 'the "someone is drawing" toast comes once');
});

test('plugin: an op whose sender is not its author is dropped; another board’s ops are ignored; my own echo is ignored', () => {
  const s = stubCtx();
  const p = create(s.ctx); p.start();
  s.fire({ kind: 'op', board: 'main', from: 'u9', op: pen('a', 'u2', [[0, 0]]) }, { fromHost: false, mine: false });
  s.fire({ kind: 'op', board: 'other', from: 'u2', op: pen('b', 'u2', [[0, 0]]) }, { fromHost: false, mine: false });
  s.fire({ kind: 'op', board: 'main', from: 'me', op: pen('c', 'me', [[0, 0]]) }, { fromHost: false, mine: true });
  assert.equal(s.toasts.length, 0, 'nothing landed, so nothing to announce');
});

test('plugin: clear, open and close count only from a host; open without a DOM is a sentence, not a crash', () => {
  const s = stubCtx();
  const p = create(s.ctx); p.start();
  s.fire({ kind: 'clear', board: 'main', from: 'u2' }, { fromHost: false, mine: false });
  s.fire({ kind: 'close', board: 'main', from: 'u2' }, { fromHost: false, mine: false });
  assert.equal(s.toasts.length, 0);
  s.fire({ kind: 'open', board: 'main', from: 'h1' }, { fromHost: true, mine: false });
  return new Promise(r => setTimeout(r, 0)).then(() => {
    assert.equal(s.toasts.length, 1); assert.match(s.toasts[0], /could not open/i);
    assert.equal(p.isOpen(), false);
  });
});

test('plugin: bind into a small group switches the board id and drops the old board’s pending ops', () => {
  const s = stubCtx();
  let inGroup = false;
  s.ctx.inSmallGroup = () => inGroup; s.ctx.getMeeting = () => ({ meta: { meetingId: inGroup ? 'grp-7' : 'root' } });
  const p = create(s.ctx); p.start();
  s.fire({ kind: 'op', board: 'main', from: 'u2', op: pen('a', 'u2', [[0, 0]]) }, { fromHost: false, mine: false });
  inGroup = true; s.listeners.bind.forEach(cb => cb());
  assert.equal(p.boardId(), 'grp-7');
  assert.equal(p.ops().length, 0);
  inGroup = false; s.listeners.bind.forEach(cb => cb());
  assert.equal(p.boardId(), 'main');
  p.stop();
});

test('plugin: the public surface the integrator wires', () => {
  const p = create(stubCtx().ctx);
  assert.equal(p.name, 'board');
  ['start', 'stop', 'open', 'close', 'addImage', 'reload', 'isOpen', 'ops', 'shapes', 'boardId'].forEach(k => assert.equal(typeof p[k], 'function', k));
});

test('isDrawOp / isMaterialsPath: what an op payload may carry, and where a picture may come from', () => {
  assert.equal(isDrawOp({ kind: 'pen' }), true); assert.equal(isDrawOp({ kind: 'move' }), true);
  assert.equal(isDrawOp({ kind: 'clear' }), false); assert.equal(isDrawOp({ kind: 'undo' }), false); assert.equal(isDrawOp(null), false);
  SHAPE_KINDS.forEach(k => assert.equal(isDrawOp({ kind: k }), true, k));
  assert.equal(isMaterialsPath('materials/u1/abc-photo 1.png'), true, 'a name with a space is fine');
  assert.equal(isMaterialsPath('materials/u1/../x'), false); assert.equal(isMaterialsPath('materials/../u1/x'), false);
  assert.equal(isMaterialsPath('https://tracker.example/pixel'), false); assert.equal(isMaterialsPath('materials/u1'), false);
  assert.equal(isMaterialsPath('materials/u1/a/b.png'), false); assert.equal(isMaterialsPath('materials/u1/a?x=1'), false);
  assert.equal(isMaterialsPath(null), false);
});

test('mergeLoaded: rows first; a clear that came while loading never replays after the rows (host clears, draws X, student opens → X shows)', () => {
  const X = pen('x', 'host', [[1, 1]]), old = pen('old', 'u2', [[0, 0]]);
  const clear = { id: 'c', kind: 'clear', by: 'host' };
  assert.deepEqual(reduceOps(mergeLoaded([X], [clear, X])).map(s => s.id), ['x'], 'the reported bug: [X, clear] wiped X');
  assert.deepEqual(reduceOps(mergeLoaded([X], [old, clear, X])).map(s => s.id), ['x'], 'what came before the clear is gone with it');
  const Y = pen('y', 'u2', [[2, 2]]);
  assert.deepEqual(reduceOps(mergeLoaded([X], [clear, X, Y])).map(s => s.id), ['x', 'y'], 'ops after the clear that are not in the rows yet are kept, once');
  assert.deepEqual(reduceOps(mergeLoaded([X, Y], [{ id: 'u', kind: 'undo', target: 'y', by: 'u2' }])).map(s => s.id), ['x'], 'an undo that beat its row delete still counts (own mark only)');
  assert.deepEqual(reduceOps(mergeLoaded([X, Y], [{ id: 'u', kind: 'undo', target: 'y', by: 'u9' }])).map(s => s.id), ['x', 'y'], 'someone else naming your mark changes nothing');
  const mv = { id: 'm', kind: 'move', target: 'x', dx: 10, dy: 0, by: 'host' };
  assert.deepEqual(reduceOps(mergeLoaded([X], [mv]))[0].points, [[11, 1]]);
  assert.deepEqual(mergeLoaded([], []), []); assert.deepEqual(mergeLoaded(null, [X]).map(s => s.id), ['x']);
});

test('plugin: a clear or an undo wrapped inside an "op" payload is dropped — only the host\'s own clear payload counts', () => {
  const s = stubCtx({ rows: [pen('a', 'u2', [[0, 0]]), pen('b', 'me', [[1, 1]])] });
  const p = create(s.ctx); p.start();
  return p.reload().then(() => {
    assert.equal(p.shapes().length, 2);
    s.fire({ kind: 'op', board: 'main', from: 'u9', op: { id: 'k', kind: 'clear', by: 'u9' } }, { fromHost: false, mine: false });
    assert.equal(p.shapes().length, 2, 'a wrapped clear from a classmate wipes nothing');
    assert.equal(s.toasts.length, 0, 'and is not announced as drawing');
    s.fire({ kind: 'op', board: 'main', from: 'u9', op: { id: 'k2', kind: 'undo', target: 'b', by: 'u9' } }, { fromHost: false, mine: false });
    assert.equal(p.shapes().length, 2, 'a wrapped undo is dropped too');
    s.fire({ kind: 'op', board: 'main', from: 'h1', op: { id: 'k3', kind: 'clear', by: 'h1' } }, { fromHost: true, mine: false });
    assert.equal(p.shapes().length, 2, 'even from a host, a clear rides its own payload');
    s.fire({ kind: 'op', board: 'main', from: 'u9', op: pen('c', 'u9', [[3, 3]]) }, { fromHost: false, mine: false });
    assert.equal(p.shapes().length, 3, 'a drawable still lands');
    s.fire({ kind: 'clear', board: 'main', from: 'h1' }, { fromHost: true, mine: false });
    assert.equal(p.shapes().length, 0, 'the host\'s clear payload clears');
    p.stop();
  });
});

test('plugin: a host clear is checked against the table a moment later — a forged one puts the marks back, a real one stays clear', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = stubCtx({ rows: [pen('a', 'u2', [[0, 0]])] });
  const p = create(s.ctx); p.start();
  return p.reload().then(async () => {
    assert.equal(p.shapes().length, 1);
    s.fire({ kind: 'clear', board: 'main', from: 'h1' }, { fromHost: true, mine: false });
    assert.equal(p.shapes().length, 0, 'clear now');
    const before = s.selects.length;
    t.mock.timers.tick(RECONCILE_MS);
    await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
    assert.equal(s.selects.length, before + 1, 'the rows were read again');
    assert.equal(p.shapes().length, 1, 'the table still had the mark, so it is back (the clear was not the host\'s)');
    s.db.rows = [];
    s.fire({ kind: 'clear', board: 'main', from: 'h1' }, { fromHost: true, mine: false });
    t.mock.timers.tick(RECONCILE_MS);
    await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
    assert.equal(p.shapes().length, 0, 'a real clear stays clear');
    p.stop();
  });
});

test('plugin: a load still in flight when the class splits is thrown away — the small group never shows the main room\'s marks', () => {
  const s = stubCtx({ rows: [pen('main-a', 'u2', [[0, 0]])], defer: true });
  let inGroup = false;
  s.ctx.inSmallGroup = () => inGroup; s.ctx.getMeeting = () => ({ meta: { meetingId: inGroup ? 'grp-7' : 'root' } });
  const p = create(s.ctx); p.start();
  const first = p.reload();
  assert.equal(s.selects.length, 1);
  inGroup = true; s.listeners.bind.forEach(cb => cb());
  assert.equal(p.boardId(), 'grp-7');
  s.db.rows = [pen('grp-b', 'u3', [[5, 5]])];
  s.db.resolvers.shift()();   /* the OLD select answers now, with the main room's rows */
  return first.then(() => {
    assert.deepEqual(p.ops().map(o => o.id), [], 'stale rows never land under the new board id');
    const second = p.reload();
    s.db.resolvers.shift()();
    return second;
  }).then(() => {
    assert.deepEqual(p.ops().map(o => o.id), ['grp-b'], 'the group board loads its own rows');
    p.stop();
  });
});

test('plugin: addImage refuses anything that is not a file in Files, with a sentence', async () => {
  const s = stubCtx();
  const p = create(s.ctx); p.start();
  assert.equal(await p.addImage('https://tracker.example/pixel.png', null), null);
  assert.equal(await p.addImage('https://x/y.png', 'https://tracker.example/pixel.png'), null);
  assert.equal(s.toasts.length, 2); assert.match(s.toasts[0], /Only a picture from Files/);
  assert.equal(s.sent.length, 0, 'nothing went over the channel');
});

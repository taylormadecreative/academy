// node --test tests/opil/reactions.test.mjs — reactions + live pulse: the pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, PULSE_ORDER, WINDOW_MS, COOLDOWN_MS, INBOUND_MS, INBOUND_BURST, INBOUND_BURST_MS, kindOf, canReact, canAccept, createGate, pulseCounts, pulseCopy, createPulse, parseReaction, peopleCount, meetingIdOf, floatX, create } from '../../js/rtk-reactions.js';

const T = Date.parse('2026-09-16T23:00:00Z');   /* "now" for every test */
const ev = (kind, from, agoMs) => ({ kind, from, at: T - agoMs });

test('six kinds, each a word plus an emoji; the pulse reads confused first', () => {
  assert.equal(KINDS.length, 6);
  assert.deepEqual(KINDS.map(k => k.id), ['got', 'confused', 'slower', 'faster', 'clap', 'heart']);
  KINDS.forEach(k => { assert.ok(k.word.length > 1, k.id + ' has a word'); assert.ok(k.emoji, k.id + ' has an emoji'); });
  assert.equal(PULSE_ORDER[0], 'confused');
  assert.equal(kindOf('confused').emoji, '🙋');
  assert.equal(kindOf('nope'), null); assert.equal(kindOf(null), null);
});

test('canReact: never reacted → yes; 2 s apart → yes; 1.999 s → no; junk lastAt → yes', () => {
  assert.equal(canReact(null, T), true);
  assert.equal(canReact(undefined, T), true);
  assert.equal(canReact(T - COOLDOWN_MS, T), true);
  assert.equal(canReact(T - COOLDOWN_MS + 1, T), false);
  assert.equal(canReact(T - 1, T), false);
  assert.equal(canReact('what', T), true);
  assert.equal(COOLDOWN_MS, 2000);
});

test('canAccept (the way in) is looser than the tray: 1 s, so a late first message never drops an honest second tap', () => {
  assert.equal(INBOUND_MS, 1000);
  assert.equal(canAccept(null, T), true);
  assert.equal(canAccept(T - 1000, T), true);
  assert.equal(canAccept(T - 999, T), false);
  assert.equal(canAccept(T, T), false);
  /* the real shape of the bug: sent 2000 ms apart, the first arrived 400 ms late → received 1600 ms apart → still counted */
  assert.equal(canAccept(T + 400, T + 2000), true);
});

test('createGate: a room-wide budget — 5 per 200 ms whoever sends, the rest dropped and counted', () => {
  assert.equal(INBOUND_BURST, 5); assert.equal(INBOUND_BURST_MS, 200);
  let t = T; const g = createGate({ now: () => t });
  const got = []; for (let i = 0; i < 50; i++) got.push(g.allow());
  assert.equal(got.filter(Boolean).length, 5); assert.equal(g.dropped, 45);
  t += 199; assert.equal(g.allow(), false);
  t += 1; assert.equal(g.allow(), true);                /* a new window */
  const g2 = createGate({ now: () => t, max: 2, perMs: 1000 });
  assert.deepEqual([g2.allow(), g2.allow(), g2.allow()], [true, true, false]);
});

test('pulseCounts: only the last 60 s, unknown kinds dropped, total adds up', () => {
  const events = [
    ev('confused', 'a', 5000), ev('confused', 'b', 30000), ev('slower', 'c', 59000),
    ev('confused', 'd', 61000),                       /* just outside the window */
    ev('clap', 'e', 1000), { kind: 'wave', from: 'f', at: T - 1000 }, { kind: 'clap', from: 'g', at: 'soon' },
    ev('heart', 'h', -5000),                          /* from the future: not yet */
  ];
  const c = pulseCounts(events, T, WINDOW_MS);
  assert.equal(c.confused, 2); assert.equal(c.slower, 1); assert.equal(c.clap, 1); assert.equal(c.heart, 0); assert.equal(c.got, 0); assert.equal(c.faster, 0);
  assert.equal(c.total, 4);
  assert.deepEqual(pulseCounts([], T), { got: 0, confused: 0, slower: 0, faster: 0, clap: 0, heart: 0, total: 0 });
  assert.equal(pulseCounts(null, T).total, 0);
});

test('pulseCounts counts people, not taps: a person who taps Confused five times is 1 confused', () => {
  const events = [ev('confused', 'a', 20000), ev('confused', 'a', 15000), ev('confused', 'a', 10000), ev('confused', 'a', 5000), ev('confused', 'a', 1000)];
  assert.equal(pulseCounts(events, T).confused, 1);
  const claps = [ev('clap', 'a', 9000), ev('clap', 'a', 3000), ev('clap', 'b', 2000)];
  assert.equal(pulseCounts(claps, T).clap, 2);
});

test('pulseCounts: got it / confused / slower / faster are one state per person — the newest wins; applause is separate', () => {
  const events = [ev('confused', 'a', 40000), ev('got', 'a', 10000), ev('slower', 'b', 30000), ev('faster', 'b', 5000), ev('heart', 'a', 2000)];
  const c = pulseCounts(events, T);
  assert.equal(c.confused, 0); assert.equal(c.got, 1); assert.equal(c.slower, 0); assert.equal(c.faster, 1); assert.equal(c.heart, 1);
  /* the order the events arrive in does not matter — `at` decides */
  const shuffled = [events[1], events[4], events[0], events[3], events[2]];
  assert.deepEqual(pulseCounts(shuffled, T), c);
  /* events with no sender each count once */
  assert.equal(pulseCounts([ev('confused', null, 1000), ev('confused', null, 2000)], T).confused, 2);
});

test('pulseCounts honours `since` (the host tapped to clear)', () => {
  const events = [ev('confused', 'a', 30000), ev('confused', 'b', 5000)];
  assert.equal(pulseCounts(events, T, WINDOW_MS, T - 10000).confused, 1);
  assert.equal(pulseCounts(events, T, WINDOW_MS, T - 1000).confused, 0);
  assert.equal(pulseCounts(events, T, WINDOW_MS, 0).confused, 2);
});

test('pulseCopy reads like the spec: "6 confused · 3 slower"; plurals; empty is empty', () => {
  assert.equal(pulseCopy({ confused: 6, slower: 3 }, 40).line, '6 confused · 3 slower');
  assert.equal(pulseCopy({ got: 2, clap: 1, heart: 4, faster: 1 }, 40).line, '1 faster · 2 got it · 1 clap · 4 hearts');
  const e = pulseCopy({}, 10);
  assert.equal(e.line, ''); assert.equal(e.empty, true); assert.equal(e.red, false); assert.equal(e.note, '');
  assert.equal(pulseCopy(null, 10).empty, true);
});

test('pulseCopy goes red when confused ≥ 25% of the people in the room, with a plain note', () => {
  assert.equal(pulseCopy({ confused: 2 }, 10).red, false);       /* 2 of 10 = 20% */
  assert.equal(pulseCopy({ confused: 3 }, 10).red, true);        /* 30% */
  assert.equal(pulseCopy({ confused: 3 }, 12).red, true);        /* exactly 25% */
  assert.equal(pulseCopy({ confused: 2 }, 12).red, false);
  assert.equal(pulseCopy({ confused: 0, slower: 9 }, 10).red, false);   /* only confused turns it red */
  assert.equal(pulseCopy({ confused: 3 }, 10).note, '3 of 10 confused — worth a pause.');
  assert.equal(pulseCopy({ confused: 1 }, 1).note, 'Everyone here is confused — worth a pause.');
  assert.equal(pulseCopy({ confused: 1 }, 0).red, true);         /* no meeting count yet: treat the room as one person */
});

test('pulseCopy never claims more people than are in the room (a flood of made-up senders cannot inflate it)', () => {
  const c = pulseCopy({ confused: 50, clap: 12 }, 10);
  assert.equal(c.line, '10 confused · 10 claps');
  assert.equal(c.note, 'Everyone here is confused — worth a pause.');
  assert.equal(pulseCopy({ confused: 3 }, 0).line, '3 confused');   /* no count yet: nothing to clamp to */
});

test('createPulse: a rolling window with add / reset / counts on an injectable clock', () => {
  let t = T; const p = createPulse({ now: () => t });
  assert.equal(p.add('confused', 'a'), true);
  assert.equal(p.add('wave', 'a'), false);
  t += 30000; p.add('slower', 'b'); p.add('clap', 'c');
  assert.equal(p.counts().total, 3);
  t += 31000;                                    /* 61 s after the first: it rolled off */
  const c = p.counts(); assert.equal(c.confused, 0); assert.equal(c.slower, 1); assert.equal(c.clap, 1);
  p.reset(); assert.equal(p.counts().total, 0); assert.equal(p.size, 0); assert.equal(p.since, t);
  p.add('heart', 'z', t - 5000);                 /* stamped before the clear: stays out */
  assert.equal(p.counts().heart, 0);
  p.add('heart', 'z'); assert.equal(p.counts().heart, 1);
});

test('parseReaction accepts only a known kind and strings the rest', () => {
  assert.deepEqual(parseReaction({ kind: 'clap', from: 'u1', m: 'mtg' }), { kind: 'clap', from: 'u1', m: 'mtg' });
  assert.deepEqual(parseReaction({ kind: 'got' }), { kind: 'got', from: null, m: null });
  assert.equal(parseReaction({ kind: 'lol', from: 'u1' }), null);
  assert.equal(parseReaction(null), null); assert.equal(parseReaction('clap'), null); assert.equal(parseReaction({}), null);
});

test('peopleCount is the kit’s joined count plus me; meetingIdOf reads meta', () => {
  assert.equal(peopleCount({ participants: { joined: { size: 11 } } }), 12);
  assert.equal(peopleCount({ participants: { joined: { toArray: () => [1, 2, 3] } } }), 4);
  assert.equal(peopleCount(null), 1); assert.equal(peopleCount({}), 1);
  assert.equal(meetingIdOf({ meta: { meetingId: 'm-1' } }), 'm-1'); assert.equal(meetingIdOf(null), null);
});

test('floatX keeps an emoji in the left two thirds, clear of the tray', () => {
  assert.equal(floatX(0), 6); assert.equal(floatX(1), 66); assert.equal(floatX(0.5), 36);
  assert.equal(floatX(-3), 6); assert.equal(floatX('x'), 6);
});

/* ---- the plugin's spine, with a stub ctx and no DOM (the host promises start() never throws) ---- */
function stubCtx(over = {}) {
  const sent = [], subs = [];
  const ctx = Object.assign({
    uid: 'me', host: false, now: () => T, esc: (s) => String(s),
    el: () => { throw new Error('no DOM in this test'); },
    getMeeting: () => ({ meta: { meetingId: 'main' }, participants: { joined: { size: 9 } } }),
    stage: { overlay: () => { throw new Error('no DOM'); } },
    bar: { addButton: () => { throw new Error('no DOM'); } },
    channel: () => ({ on: (cb) => subs.push(cb), send: (p) => { sent.push(p); }, stop() {} }),
    on() {}, toast() {},
  }, over);
  return { ctx, sent, subs };
}

test('create(ctx) is safe without a DOM: start() swallows its own failure, stop() is quiet', () => {
  const { ctx } = stubCtx();
  const p = create(ctx);
  assert.equal(p.name, 'reactions');
  assert.equal(p.pulseEl, null);                 /* not a host → no strip */
  assert.doesNotThrow(() => p.start());
  assert.doesNotThrow(() => p.stop());
  assert.doesNotThrow(() => p.start());          /* a second start after stop is allowed */
});

test('a host with no el() still gets a plugin (no strip) rather than a throw', () => {
  const { ctx } = stubCtx({ host: true, el: undefined });
  const p = create(ctx);
  assert.equal(p.pulseEl, null);
  assert.doesNotThrow(() => p.start());
});

test('handle(): my own echo is ignored, another meeting’s reaction is ignored, a flood from one sender is throttled — and a host’s pulse counts the rest', () => {
  /* a tiny element so the host’s strip can exist without a browser */
  const fake = () => { const kids = []; const n = { hidden: true, textContent: '', cls: new Set(), parentElement: null,
    classList: { toggle(c, v) { v ? n.cls.add(c) : n.cls.delete(c); }, add(c) { n.cls.add(c); }, remove(c) { n.cls.delete(c); } },
    addEventListener() {}, setAttribute() {}, querySelector() { return fake(); }, querySelectorAll() { return kids; }, appendChild(k) { kids.push(k); k.parentElement = n; }, remove() {} }; return n; };
  let t = T;
  const { ctx } = stubCtx({ host: true, now: () => t, el: () => fake() });
  const p = create(ctx);
  assert.ok(p.pulseEl, 'a host gets a strip');
  p.handle({ kind: 'confused', from: 'me' }, { mine: true });            /* my echo */
  p.handle({ kind: 'confused', from: 'x', m: 'breakout-2' }, {});        /* elsewhere */
  p.handle({ kind: 'confused', from: 'a', m: 'main' }, {});
  p.handle({ kind: 'confused', from: 'a', m: 'main' }, {});              /* 0 ms later: throttled */
  t += 999;  p.handle({ kind: 'got', from: 'a' }, {});                   /* 999 ms later: still throttled — a stays confused */
  assert.equal(p.pulse.counts().confused, 1); assert.equal(p.pulse.counts().got, 0);
  t += 1001;
  p.handle({ kind: 'slower', from: 'a' }, {});                            /* no m: honoured; a's state is now slower */
  p.handle({ kind: 'clap', from: 'b' }, {});
  p.handle({ kind: 'nonsense', from: 'c' }, {});
  const c = p.pulse.counts();
  assert.equal(c.confused, 0); assert.equal(c.slower, 1); assert.equal(c.clap, 1); assert.equal(c.total, 2);
  assert.equal(p.pulseEl.hidden, false);
  assert.equal(p.pulseEl.cls.has('is-red'), false);
  /* three of ten confused → red */
  t += 2000; ['d', 'e', 'f'].forEach(u => p.handle({ kind: 'confused', from: u }, {}));
  assert.equal(p.pulse.counts().confused, 3);
  assert.equal(p.pulseEl.cls.has('is-red'), true);
});

test('handle(): 50 reactions from 50 made-up senders inside one instant → only the budgeted 5 count; the next window admits 5 more', () => {
  const fake = () => ({ hidden: true, textContent: '', classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, appendChild() {}, remove() {}, parentElement: null });
  let t = T;
  const { ctx } = stubCtx({ host: true, now: () => t, el: () => fake() });
  const p = create(ctx);
  for (let i = 0; i < 50; i++) p.handle({ kind: 'confused', from: 'bot-' + i }, {});
  assert.equal(p.pulse.counts().confused, INBOUND_BURST);
  assert.equal(p.dropped, 45);
  t += INBOUND_BURST_MS;
  for (let i = 50; i < 60; i++) p.handle({ kind: 'clap', from: 'bot-' + i }, {});
  assert.equal(p.pulse.counts().clap, INBOUND_BURST);
  assert.equal(p.pulse.counts().total, INBOUND_BURST * 2);
  /* an honest room never hits it: 9 people 200 ms apart each */
  const { ctx: c2 } = stubCtx({ host: true, now: () => t, el: () => fake() });
  const p2 = create(c2);
  for (let i = 0; i < 9; i++) { t += 200; p2.handle({ kind: 'got', from: 'u' + i }, {}); }
  assert.equal(p2.pulse.counts().got, 9); assert.equal(p2.dropped, 0);
});

test('react(): sends { kind, m } once per 2 s and draws my own at once (the pulse counts me too when I host); the tray closes on a send', () => {
  let t = T; const toasts = [];
  const fake = () => ({ hidden: true, textContent: '', classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, appendChild() {}, remove() {}, parentElement: null, contains() { return false; } });
  const { ctx, sent } = stubCtx({ host: true, now: () => t, el: () => fake(), stage: { overlay: () => fake() }, bar: { addButton: () => fake() }, toast: (m) => toasts.push(m) });
  const p = create(ctx);
  p.start();
  assert.equal(p.isOpen, false);
  p.react('got'); p.react('clap');             /* the second one is inside the cooldown */
  assert.deepEqual(sent, [{ kind: 'got', m: 'main' }]);
  assert.equal(p.isOpen, false);
  assert.equal(toasts[0], 'Sent Got it 👍 — you can send another in a moment.');
  t += 2000; p.react('clap');
  assert.equal(sent.length, 2); assert.equal(sent[1].kind, 'clap');
  p.react('lol'); assert.equal(sent.length, 2);
  const c = p.pulse.counts(); assert.equal(c.got, 1); assert.equal(c.clap, 1);
  p.stop();                                    /* clears the pulse tick and the cooldown so the test runner can exit */
});

test('the Pulse strip: placePulseAfter() puts it under the Now line as a row; unplaced it falls back to the stage with one warning; stop() takes it off the page and the bind hook is inert while stopped', () => {
  const warned = []; const origWarn = console.warn; console.warn = (...a) => warned.push(a.join(' '));
  try {
    const mk = () => { const n = { hidden: true, textContent: '', cls: new Set(), parentElement: null, kids: [],
      classList: { toggle(c, v) { v ? n.cls.add(c) : n.cls.delete(c); }, add(c) { n.cls.add(c); }, remove(c) { n.cls.delete(c); } },
      addEventListener() {}, setAttribute() {}, contains() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; },
      appendChild(k) { n.kids.push(k); k.parentElement = n; }, insertAdjacentElement(where, k) { n.parentElement.kids.push(k); k.parentElement = n.parentElement; },
      remove() { if (n.parentElement) { n.parentElement.kids = n.parentElement.kids.filter(x => x !== n); n.parentElement = null; } } }; return n; };
    const binds = [];
    const layer = mk();
    const { ctx } = stubCtx({ host: true, el: () => mk(), stage: { overlay: () => layer }, bar: { addButton: () => mk() }, on: (ev, cb) => { if (ev === 'bind') binds.push(cb); } });
    /* 1. placed by the integrator before start(): a row under the Now line, nothing appended to the stage */
    const root = mk(), nowLine = mk(); root.appendChild(nowLine);
    const p = create(ctx);
    assert.equal(binds.length, 1, 'the bind hook is registered once, in create()');
    assert.equal(p.placePulseAfter(nowLine), true);
    assert.equal(p.pulseEl.parentElement, root); assert.ok(p.pulseEl.cls.has('r2-pulse-row'));
    p.start();
    assert.equal(layer.kids.includes(p.pulseEl), false);
    assert.equal(warned.filter(w => /Pulse strip was not placed/.test(w)).length, 0);
    p.stop();
    assert.equal(p.pulseEl.parentElement, null, 'stop() takes the strip off the page');
    assert.doesNotThrow(() => binds[0]({}), 'the retained bind hook is inert while stopped');
    /* 2. a second start() with nothing placed: the fallback pill on the stage, one warning */
    p.start();
    assert.equal(p.pulseEl.parentElement, layer); assert.equal(p.pulseEl.cls.has('r2-pulse-row'), false);
    assert.equal(warned.filter(w => /Pulse strip was not placed/.test(w)).length, 1);
    p.stop(); p.start(); p.stop();
    assert.equal(warned.filter(w => /Pulse strip was not placed/.test(w)).length, 1, 'warned once');
    assert.equal(binds.length, 1, 'no second bind listener after restarts');
  } finally { console.warn = origWarn; }
});

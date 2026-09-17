// node --test tests/opil/warmup.test.mjs — warm-ups on the waiting screen: the pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_QUESTION, CITY_MAX, NAME_MAX, HERE_WINDOW_MS, HERE_PLACEHOLDER,
  questionOf, cityWord, citiesLine, alreadyHereCopy, nameOf, hereNames, herePeople, answerRows, answersSummary, savedCopy,
  serial, create, mountWaiting,
} from '../../js/rtk-warmup.js';

const profiles = [
  { user_id: 'a', display_name: 'Kiara Pee' },
  { user_id: 'b', display_name: 'Amos Abdulai' },
  { user_id: 'c', display_name: '' },
  { user_id: 'd', display_name: 'Holy' },
  { user_id: 'me', display_name: 'Nelson Taylor' },
];

test('questionOf: the coordinator’s question, trimmed, else the default', () => {
  assert.equal(questionOf({ warmup_q: '  What’s your team building?  ' }), 'What’s your team building?');
  assert.equal(questionOf({ warmup_q: '' }), DEFAULT_QUESTION);
  assert.equal(questionOf({ warmup_q: null }), DEFAULT_QUESTION);
  assert.equal(questionOf(null), DEFAULT_QUESTION);
  assert.equal(questionOf({}), DEFAULT_QUESTION);
  assert.equal(questionOf({ warmup_q: 'x'.repeat(300) }).length, 200);
});

test('cityWord: "Atlanta, GA" → Atlanta; whitespace collapsed; blank stays blank', () => {
  assert.equal(cityWord('Atlanta, GA'), 'Atlanta');
  assert.equal(cityWord('  new   york  '), 'new york');
  assert.equal(cityWord(''), '');
  assert.equal(cityWord(null), '');
  assert.equal(cityWord(', GA'), '');
  assert.equal(cityWord('x'.repeat(60)).length, 40);
});

test('citiesLine: each place once, in answer order, "and N more" past the cap, nothing when nobody said', () => {
  assert.equal(citiesLine([]), '');
  assert.equal(citiesLine([{ city: null }, { city: '' }]), '');
  assert.equal(citiesLine([{ city: 'Atlanta, GA' }, { city: 'Tallahassee' }, { city: 'atlanta' }, { city: 'Dallas, TX' }]), 'Joining from Atlanta · Tallahassee · Dallas');
  const many = Array.from({ length: CITY_MAX + 3 }, (_, i) => ({ city: 'Town ' + i }));
  const line = citiesLine(many);
  assert.ok(line.startsWith('Joining from Town 0 · Town 1'));
  assert.ok(line.endsWith(' · and 3 more'));
  assert.equal((line.match(/Town/g) || []).length, CITY_MAX);
});

test('alreadyHereCopy: a sentence for none, one, two, three, and many — unnamed people counted, never listed', () => {
  assert.equal(alreadyHereCopy([]), 'No one else yet — you’re the first one here.');
  assert.equal(alreadyHereCopy(null), 'No one else yet — you’re the first one here.');
  assert.equal(alreadyHereCopy(['Kiara Pee']), 'Kiara Pee is already here.');
  assert.equal(alreadyHereCopy(['Kiara Pee', 'Amos Abdulai']), 'Kiara Pee and Amos Abdulai are already here.');
  assert.equal(alreadyHereCopy(['Kiara Pee', 'Amos Abdulai', 'Holy']), 'Kiara Pee, Amos Abdulai and Holy are already here.');
  assert.equal(alreadyHereCopy(['Kiara Pee', 'Amos Abdulai', 'Holy', 'Seira']), 'Kiara Pee, Amos Abdulai, Holy and 1 other are already here.');
  assert.equal(alreadyHereCopy(['A', 'B', 'C', 'D', 'E', 'F']), 'A, B, C and 3 others are already here.');
  /* a classmate who shares my name is a person, not me (I am left out by id upstream) */
  assert.equal(alreadyHereCopy(['Nelson Taylor']), 'Nelson Taylor is already here.');
  /* people we could not name are counted in the tail, never read out as "A classmate, A classmate" */
  assert.equal(alreadyHereCopy([HERE_PLACEHOLDER]), 'A classmate is already here.');
  assert.equal(alreadyHereCopy([HERE_PLACEHOLDER, HERE_PLACEHOLDER, HERE_PLACEHOLDER]), '3 classmates are already here.');
  assert.equal(alreadyHereCopy(['Kiara Pee', HERE_PLACEHOLDER, HERE_PLACEHOLDER]), 'Kiara Pee and 2 others are already here.');
  assert.equal(alreadyHereCopy(['Kiara Pee', 'Holy', HERE_PLACEHOLDER]), 'Kiara Pee, Holy and 1 other are already here.');
  assert.equal(NAME_MAX, 3);
});

test('nameOf: the profile name, else the fallback, else Someone', () => {
  assert.equal(nameOf(profiles, 'a'), 'Kiara Pee');
  assert.equal(nameOf(profiles, 'c', 'A classmate'), 'A classmate');
  assert.equal(nameOf(profiles, 'zzz'), 'Someone');
  assert.equal(nameOf(null, 'a', 'X'), 'X');
});

test('hereNames: waiting or in, seen inside the window, me left out by id, one entry per person, named A–Z then the unnamed', () => {
  const now = Date.parse('2026-09-16T22:30:00Z');
  const fresh = new Date(now - 30000).toISOString(), stale = new Date(now - HERE_WINDOW_MS - 1000).toISOString();
  const presence = [
    { user_id: 'a', state: 'waiting', last_seen: fresh },
    { user_id: 'b', state: 'in', last_seen: fresh },
    { user_id: 'c', state: 'waiting', last_seen: fresh },          /* blank profile → A classmate */
    { user_id: 'g', state: 'waiting', last_seen: fresh },          /* no profile at all → a SECOND A classmate */
    { user_id: 'd', state: 'out', last_seen: fresh },              /* left */
    { user_id: 'me', state: 'waiting', last_seen: fresh },         /* me */
    { user_id: 'e', state: 'in', last_seen: stale },               /* a tab that died */
    { user_id: 'f', state: 'in', last_seen: null },
    { user_id: 'a', state: 'waiting', last_seen: fresh },          /* the same person twice stays one chip */
  ];
  assert.deepEqual(hereNames(presence, profiles, { uid: 'me', now }), ['Amos Abdulai', 'Kiara Pee', HERE_PLACEHOLDER, HERE_PLACEHOLDER]);
  assert.deepEqual(herePeople(presence, profiles, { uid: 'me', now }).map(p => p.user_id), ['b', 'a', 'c', 'g']);
  assert.equal(herePeople(presence, profiles, { uid: 'me', now })[2].named, false);
  /* a namesake of mine is still a person here */
  const twin = [{ user_id: 'x', state: 'in', last_seen: fresh }];
  assert.deepEqual(hereNames(twin, [{ user_id: 'x', display_name: 'Nelson Taylor' }, { user_id: 'me', display_name: 'Nelson Taylor' }], { uid: 'me', now }), ['Nelson Taylor']);
  assert.deepEqual(hereNames([], profiles, { uid: 'me', now }), []);
  assert.deepEqual(hereNames(null, null, { uid: 'me', now }), []);
});

test('serial: a call during a run marks it dirty and runs once more at the end — never two at once', async () => {
  let running = 0, most = 0, runs = 0;
  const step = serial(async () => { running++; most = Math.max(most, running); runs++; await new Promise(r => setTimeout(r, 15)); running--; });
  step(); step(); step(); step();
  await new Promise(r => setTimeout(r, 80));
  assert.equal(most, 1);
  assert.equal(runs, 2);   /* the first run, then one catch-up for the three calls that landed during it */
  /* a throw inside still frees the lock */
  let n = 0;
  const bad = serial(async () => { n++; if (n === 1) throw new Error('once'); });
  await bad().catch(() => {});
  await bad();
  assert.equal(n, 2);
});

test('answerRows: name · city · answer, oldest first, blank rows dropped', () => {
  const warm = [
    { user_id: 'b', answer: 'Ship the demo', city: 'Charlotte, NC', created_at: '2026-09-16T22:12:00Z' },
    { user_id: 'a', answer: '  Learn how payments APIs work ', city: 'Atlanta, GA', created_at: '2026-09-16T22:10:00Z' },
    { user_id: 'd', answer: null, city: 'Dallas', created_at: '2026-09-16T22:15:00Z' },
    { user_id: 'c', answer: '   ', city: '', created_at: '2026-09-16T22:16:00Z' },
  ];
  const rows = answerRows(warm, profiles);
  assert.deepEqual(rows.map(r => r.name), ['Kiara Pee', 'Amos Abdulai', 'Holy']);
  assert.equal(rows[0].answer, 'Learn how payments APIs work');
  assert.equal(rows[0].city, 'Atlanta');
  assert.equal(rows[2].answer, '');
  assert.equal(rows[2].city, 'Dallas');
  assert.deepEqual(answerRows([], profiles), []);
  assert.equal(answersSummary(rows), '2 answers · 3 said where they’re from');
  assert.equal(answersSummary([rows[0]]), '1 answer · 1 said where they’re from');
  assert.equal(answersSummary([]), 'No answers yet');
});

test('savedCopy: says what happens next, and what is still missing', () => {
  assert.equal(savedCopy({ answer: '', city: '' }), '');
  assert.match(savedCopy({ answer: 'x', city: 'Atlanta' }), /host sees it when the class starts/);
  assert.match(savedCopy({ answer: 'x', city: '' }), /where you’re joining from/);
  assert.match(savedCopy({ answer: '', city: 'Atlanta' }), /Add an answer/);
});

/* ---- the plugin shape, with a stub supabase: import-safe, never throws ---- */
function stubSb({ warm = [], fail = false, names = null } = {}) {
  const calls = [];
  const table = (name) => {
    const q = {
      _name: name, _op: 'select',
      select() { calls.push(['select', name, q._op]); return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, limit() { return q; },
      upsert(row) { q._op = 'upsert'; calls.push(['upsert', name, row]); return q; },
      update(row) { q._op = 'update'; calls.push(['update', name, row]); return q; },
      delete() { q._op = 'delete'; calls.push(['delete', name]); return q; },
      then(res, rej) {
        if (fail) return Promise.resolve({ data: null, error: new Error('boom') }).then(res, rej);
        const data = name === 'ea_class_warmups' && q._op === 'select' ? warm : name === 'ea_profiles' ? profiles : [];
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    };
    return q;
  };
  const sb = {
    calls,
    from: table,
    rpc(fn, args) {
      calls.push(['rpc', fn, args]);
      if (fail || !names) return Promise.resolve({ data: null, error: new Error('no such function') });
      return Promise.resolve({ data: names, error: null });
    },
    channel() { const ch = { on(ev, spec) { calls.push(['on', spec && spec.table, spec && spec.event]); return ch; }, subscribe() { return ch; } }; return ch; },
    removeChannel() {},
  };
  return sb;
}

test('create(ctx) returns the contract (start/stop/mountAnswers); a host starts without a DOM and names come from ea_class_names first', async () => {
  /* user "z" has no profile row at all — the function names them from their registration / email */
  const sb = stubSb({
    warm: [{ user_id: 'a', answer: 'Hi', city: 'Atlanta, GA', created_at: '2026-09-16T22:10:00Z' }, { user_id: 'z', answer: 'Here to learn', city: 'Dallas', created_at: '2026-09-16T22:11:00Z' }],
    names: [{ user_id: 'a', name: 'Kiara Pee' }, { user_id: 'z', name: 'jsmith' }],
  });
  const ctx = { sb, el: () => null, esc: (s) => s, uid: 'me', host: true, roomKey: 'opil:1', session: { no: 1, warmup_q: 'Q?' }, getMeeting: () => { throw new Error('no meeting'); }, toast() {}, on() {} };
  const p = create(ctx);
  assert.equal(typeof p.start, 'function'); assert.equal(typeof p.stop, 'function'); assert.equal(typeof p.mountAnswers, 'function');
  assert.equal(p.question, 'Q?');
  p.start();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(p.rows.length, 2); assert.equal(p.rows[0].name, 'Kiara Pee'); assert.equal(p.rows[0].city, 'Atlanta');
  assert.equal(p.rows[1].name, 'jsmith');
  assert.ok(sb.calls.some(c => c[0] === 'rpc' && c[1] === 'ea_class_names' && c[2].p_key === 'opil:1'), 'names are asked from the class function');
  assert.ok(sb.calls.some(c => c[0] === 'on' && c[1] === 'ea_class_warmups'), 'a host listens for answers');
  assert.equal(p.mountAnswers(null), null);
  p.stop();
});

test('create(ctx): a student’s start() opens no channel and reads nothing — the section is the host’s', async () => {
  const sb = stubSb({ warm: [{ user_id: 'a', answer: 'Hi', city: 'Atlanta', created_at: '2026-09-16T22:10:00Z' }] });
  const p = create({ sb, el: () => null, esc: (s) => s, uid: 'me', host: false, roomKey: 'opil:1', session: { no: 1 }, getMeeting: () => null, toast() {}, on() {} });
  p.start();
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(p.rows, []);
  assert.equal(sb.calls.filter(c => c[0] === 'on' || c[0] === 'rpc').length, 0);
  p.stop();
});

test('create(ctx): a failing database never throws out of start, and the profiles fallback is tried when the function is missing', async () => {
  const p = create({ sb: stubSb({ fail: true }), el: () => null, esc: (s) => s, uid: 'me', host: true, roomKey: 'room:abc', session: null, getMeeting: () => null, toast() {}, on() {} });
  assert.equal(p.question, DEFAULT_QUESTION);
  assert.doesNotThrow(() => p.start());
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(p.rows, []);
  p.stop();
  /* no function yet (names: null) → ea_profiles still names people */
  const sb = stubSb({ warm: [{ user_id: 'b', answer: 'Yo', city: '', created_at: '2026-09-16T22:10:00Z' }] });
  const p2 = create({ sb, el: () => null, esc: (s) => s, uid: 'me', host: true, roomKey: 'opil:2', session: { no: 2 }, getMeeting: () => null, toast() {}, on() {} });
  p2.start();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(p2.rows[0].name, 'Amos Abdulai');
  p2.stop();
});

test('mountWaiting without a container says so and returns a stop()', () => {
  const r = mountWaiting({ sb: stubSb(), el: () => null, esc: (s) => s, uid: 'me', roomKey: 'opil:1', session: null, container: null });
  assert.equal(typeof r.stop, 'function');
  assert.doesNotThrow(() => r.stop());
});

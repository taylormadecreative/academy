// tests/academy/lobby.test.mjs — run: node --test tests/academy/*.test.mjs
// The lobby's pure decisions (js/lobby.js): who holds the doors, when a guest goes in, and the words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  GRACE_MS, NO_CHANNEL_MS, HOST_GONE_MS, hostView, topicOf, roomKeyOf, openKey, shortName, initials, cityWord, readPresence, gate, isSettled,
  STATS, FACTS, GAME, SEQUENCE, sourceRow, slideKind, slideLabel, tallyRound, cleanPicks, bubbleText, wallRows,
  crowdLine, hostCount, namesLine, citiesLine, startsLine, phaseCopy, hostDoorsLine, markU, LESSONS, holdPref,
} from '../../js/lobby.js';

test('the channel is private-policy shaped: <plugin>-<room key> (0053 reads the key after the first dash)', () => {
  assert.equal(topicOf('abc-123'), 'lobby-room:abc-123');
  assert.equal(roomKeyOf('abc-123'), 'room:abc-123');
  const topic = topicOf('9f1c2d3e-0000-4000-8000-000000000001');
  assert.equal(topic.slice(topic.indexOf('-') + 1), 'room:9f1c2d3e-0000-4000-8000-000000000001');
  assert.equal(openKey('r1'), 'tma-lobby-open:r1');
});

test('shortName: a first name, a title keeps its name, an email is cut at the @', () => {
  assert.equal(shortName('Meme Johnson'), 'Meme');
  assert.equal(shortName('  Jamal   Ware '), 'Jamal');
  assert.equal(shortName('Dr. Gray'), 'Dr. Gray');
  assert.equal(shortName('dr Wallace Smith'), 'dr Wallace');
  assert.equal(shortName('kiara1.pee@gmail.com'), 'kiara1.pee');
  assert.equal(shortName(''), '');
  assert.equal(shortName(null), '');
  assert.ok(shortName('Supercalifragilisticexpialidocious').length <= 18);
});

test('initials: one or two letters, never the title', () => {
  assert.equal(initials('Meme Johnson'), 'M');
  assert.equal(initials('Dr. Gray'), 'G');
  assert.equal(initials('mary-kate'), 'MK');
  assert.equal(initials(''), '·');
});

test('cityWord: the city before the comma', () => {
  assert.equal(cityWord('Atlanta, GA'), 'Atlanta');
  assert.equal(cityWord('  Fort   Worth '), 'Fort Worth');
  assert.equal(cityWord(null), '');
});

test('readPresence: the host key holds the doors; guests are one per key, in arrival order', () => {
  const ps = {
    h1: [{ role: 'host', name: 'Nelson', doors: 'closed', live: true, at: 5 }],
    g2: [{ role: 'guest', name: 'Jamal Ware', city: 'Washington, DC', at: 20 }],
    g1: [{ role: 'guest', name: 'Meme', at: 10 }, { role: 'guest', name: 'Meme J', city: 'Atlanta', at: 30 }],   /* two tabs */
    me: [{ role: 'guest', name: 'Me', at: 15 }],
    junk: [null, 'x'],
  };
  const r = readPresence(ps, 'me');
  assert.deepEqual(r.host, { seen: true, open: false, live: true, name: 'Nelson' });
  assert.deepEqual(r.guests.map(g => g.id), ['g1', 'me', 'g2']);
  assert.equal(r.guests[0].name, 'Meme', 'the newest meta names the person (shortName)');
  assert.equal(r.guests[0].city, 'Atlanta');
  assert.equal(r.guests[0].at, 10, 'arrival is the first tab');
  assert.equal(r.guests[1].you, true);
  assert.equal(r.guests[2].city, 'Washington');
});

test('readPresence: any host meta saying open opens the doors (a second host tab, a spoofed close cannot hold people)', () => {
  const r = readPresence({ h1: [{ role: 'host', doors: 'closed' }, { role: 'host', doors: 'open' }], x: [{ role: 'host', doors: 'closed' }] });
  assert.equal(r.host.open, true);
  assert.equal(readPresence(null).host.seen, false);
  assert.deepEqual(readPresence({}).guests, []);
});

test('gate: before the class = wait; Nelson holding = hold; open = enter; no word from him = hold, then enter (fail open)', () => {
  const none = { seen: false, open: false }, holding = { seen: true, open: false }, open = { seen: true, open: true };
  assert.equal(gate({ isLive: false, host: holding, settled: true }), 'wait');
  assert.equal(gate({ isLive: false, host: open, settled: true }), 'wait', 'open doors before the class still wait for it to start');
  assert.equal(gate({ isLive: true, host: holding, settled: true }), 'hold', 'holding beats the grace');
  assert.equal(gate({ isLive: true, host: open, settled: false }), 'enter');
  assert.equal(gate({ isLive: true, host: none, settled: false }), 'hold');
  assert.equal(gate({ isLive: true, host: none, settled: true }), 'enter');
  assert.equal(gate({ isLive: true, host: undefined, settled: true }), 'enter');
});

test('isSettled: GRACE_MS after the channel is up, NO_CHANNEL_MS after mounting when it never came up', () => {
  assert.equal(isSettled({ now: 1000 + GRACE_MS - 1, mountedAt: 0, subscribedAt: 1000 }), false);
  assert.equal(isSettled({ now: 1000 + GRACE_MS, mountedAt: 0, subscribedAt: 1000 }), true);
  assert.equal(isSettled({ now: NO_CHANNEL_MS - 1, mountedAt: 0, subscribedAt: 0 }), false);
  assert.equal(isSettled({ now: NO_CHANNEL_MS, mountedAt: 0, subscribedAt: 0 }), true);
  assert.equal(isSettled({ now: 50, mountedAt: 0, subscribedAt: 10, grace: 40 }), true);
  assert.ok(GRACE_MS <= 10000 && NO_CHANNEL_MS <= 15000, 'nobody waits long on a lobby that is not working');
});

test('the counts read as sentences', () => {
  assert.match(crowdLine(1), /^Just you so far/);
  assert.equal(crowdLine(2), 'You and 1 other person are in the lobby.');
  assert.equal(crowdLine(13), 'You and 12 other people are in the lobby.');
  assert.equal(hostCount(0), 'Nobody in the lobby yet');
  assert.equal(hostCount(1), '1 person in the lobby');
  assert.equal(hostCount(9), '9 people in the lobby');
  assert.equal(namesLine([]), '');
  assert.equal(namesLine(['Meme']), 'Meme');
  assert.equal(namesLine([{ name: 'Meme' }, { name: 'Jamal' }]), 'Meme and Jamal');
  assert.equal(namesLine(['A', 'B', 'C']), 'A, B and C');
  assert.equal(namesLine(['A', 'B', 'C', 'D', 'E']), 'A, B, C and 2 more');
  assert.equal(citiesLine([{ city: 'Dallas, TX' }, { city: 'dallas' }, { city: 'Atlanta' }, {}]), 'Joining from Dallas · Atlanta');
  assert.equal(citiesLine([]), '');
  assert.match(citiesLine('ABCDEFGH'.split('').map(c => ({ city: c }))), /and 2 more$/);
});

test('startsLine: only a start inside the next 12 hours, in minutes or hours', () => {
  const now = Date.parse('2026-10-09T23:37:00Z');
  const fmt = () => '7:00 PM';
  assert.equal(startsLine('2026-10-10T00:00:00Z', now, fmt), 'Starts at 7:00 PM · in 23 min');
  assert.equal(startsLine('2026-10-10T02:05:00Z', now, fmt), 'Starts at 7:00 PM · in 2 h 28 min');
  assert.equal(startsLine('2026-10-09T23:00:00Z', now, fmt), '', 'a past start says nothing');
  assert.equal(startsLine('2026-10-12T00:00:00Z', now, fmt), '', 'days away says nothing');
  assert.equal(startsLine(null, now, fmt), '');
  assert.equal(startsLine('nonsense', now, fmt), '');
});

test('phaseCopy: the three moments, with one gold word each', () => {
  for (const ph of ['wait', 'hold', 'enter']) {
    const c = phaseCopy(ph, 'Nelson Taylor');
    assert.equal((c.h.match(/\{u\}/g) || []).length, 1, ph + ': one gold word');
    assert.ok(c.state && c.sub, ph);
    assert.doesNotMatch(c.h + c.sub + c.state, /—/, 'no em dash in his public copy');
  }
  assert.equal(phaseCopy('wait', 'Nelson Taylor').h, 'You’re in the {u}lobby{/u}.');
  assert.equal(phaseCopy('hold', 'Nelson Taylor').h, 'Nelson is {u}here{/u}.');
  assert.match(phaseCopy('wait', 'Nelson Taylor').sub, /by itself/);
  assert.match(phaseCopy('hold', '').state, /^Nelson is in the room/, 'a missing host name falls back to Nelson');
});

test('hostDoorsLine says what will happen, in every state', () => {
  assert.match(hostDoorsLine({ connected: false }), /offline/);
  assert.match(hostDoorsLine({ hold: false, live: false }), /walk straight in when you start/);
  assert.match(hostDoorsLine({ hold: true, open: true, live: true }), /doors are open/i);
  assert.match(hostDoorsLine({ hold: true, open: false, live: false }), /even after you start/);
  assert.match(hostDoorsLine({ hold: true, open: false, live: true }), /until you bring them in/);
});

test('markU escapes everything but the gold word', () => {
  assert.equal(markU('You’re in the {u}lobby{/u}.'), 'You’re in the <span class="lb-u">lobby</span>.');
  assert.equal(markU('<b>{u}x{/u}</b>'), '&lt;b&gt;<span class="lb-u">x</span>&lt;/b&gt;');
});

test('the lessons: seven, each says why, one gold word, hallucination first, no prices, no em dashes', () => {
  assert.equal(LESSONS.length, 7);
  const ids = LESSONS.map(l => l.v);
  assert.equal(ids[0], 'halluc', 'hallucination comes first (Nelson 10/8: never trust AI blindly comes first)');
  for (const l of LESSONS) {
    assert.equal((l.h.match(/\{u\}/g) || []).length, 1, l.v + ': one gold word');
    assert.ok(l.why.length > 40, l.v + ': says why in words');
    assert.doesNotMatch(l.h + l.why, /\$|—/, l.v + ': no price, no em dash');
  }
  const stat = LESSONS.find(l => l.v === 'stat');
  assert.match(stat.why, /66%/); assert.match(stat.src, /Microsoft and LinkedIn, 2024 Work Trend Index/);
});

test('holdPref: ?lobby=off turns holding off for that page', () => {
  assert.equal(holdPref('?lobby=off'), false);
  assert.equal(holdPref('?k=abc'), true, 'on by default (no localStorage in Node)');
});

test('the room page loads the lobby on its own (a broken lobby never breaks the room) and keeps the old screen behind ?lobby=off', () => {
  const html = readFileSync(new URL('../../room/index.html', import.meta.url), 'utf8');
  assert.match(html, /try \{ LB = await Promise\.race\(\[import\('\/js\/lobby\.js\?v=[a-z0-9]+'\), new Promise\(\(_, no\) => setTimeout\(\(\) => no\(new Error\('the lobby took too long'\)\), 4000\)\)\]\); \} catch/);
  assert.doesNotMatch(html, /^import [^\n]*lobby\.js/m, 'never a static import');
  assert.match(html, /if \(LB && lobbyMode !== 'off'\) lobbyHere\(\); else if \(branch === 'waiting'\) waitHere\(\); else joinAsGuest\(\);/);
  assert.match(html, /if \(branch === 'waiting'\) waitHere\(\); else joinAsGuest\(\);\n  \}\n\}/, 'a lobby that throws falls back to the old path');
});

test('isSettled counts the grace from the later of the channel and the class going live', () => {
  assert.equal(isSettled({ now: 20000, mountedAt: 0, subscribedAt: 1000, liveAt: 19000 }), false, 'the class just went live: Nelson gets his grace');
  assert.equal(isSettled({ now: 19000 + GRACE_MS, mountedAt: 0, subscribedAt: 1000, liveAt: 19000 }), true);
  assert.equal(isSettled({ now: 30000, mountedAt: 0, subscribedAt: 0, liveAt: 25000 }), false);
});

test('hostView: a host who blinks off the channel keeps the doors held for HOST_GONE_MS, then the lobby fails open', () => {
  const holding = { seen: true, open: false, live: true }, gone = { seen: false, open: false, live: false };
  const base = { channelOn: true, offAt: 0, lastHost: holding, lastHostAt: 100000 };
  assert.deepEqual(hostView({ ...base, now: 100500, host: holding }), holding);
  assert.deepEqual(hostView({ ...base, now: 100000 + HOST_GONE_MS - 1, host: gone }), holding, 'a reload or a Wi-Fi blip is not "Nelson left"');
  assert.equal(hostView({ ...base, now: 100000 + HOST_GONE_MS, host: gone }).seen, false, 'gone for good: fail open');
  assert.equal(gate({ isLive: true, host: hostView({ ...base, now: 100000 + HOST_GONE_MS, host: gone }), settled: true }), 'enter');
  /* this guest's own channel is down: the last word for the grace, then nothing */
  assert.deepEqual(hostView({ now: 200000 + GRACE_MS - 1, channelOn: false, offAt: 200000, host: holding, lastHost: holding, lastHostAt: 199000 }), holding);
  assert.equal(hostView({ now: 200000 + GRACE_MS, channelOn: false, offAt: 200000, host: holding, lastHost: holding, lastHostAt: 199000 }).seen, false);
  assert.equal(hostView({ now: 5, channelOn: false, offAt: 0, host: holding, lastHost: null, lastHostAt: 0 }).seen, false);
  assert.ok(HOST_GONE_MS >= 10000 && HOST_GONE_MS <= 30000);
});

test('the screen plays every slide it names: 18 in a loop, the game twice, hallucination first', () => {
  const ids = new Set([...LESSONS.map(l => l.v), ...STATS.map(s => s.v), ...FACTS.map(f => f.v), 'game']);
  SEQUENCE.forEach(id => assert.ok(ids.has(id), id));
  assert.equal(SEQUENCE[0], 'halluc');
  assert.equal(SEQUENCE.filter(x => x === 'game').length, 2);
  [...LESSONS, ...STATS, ...FACTS].forEach(x => assert.ok(SEQUENCE.includes(x.v), x.v + ' is on the screen'));
  assert.equal(slideLabel('game'), 'Play: be the AI'); assert.equal(slideLabel('s-pay'), 'Real numbers'); assert.equal(slideLabel('f-robot'), 'Did you know?'); assert.equal(slideLabel('tokens'), 'AI in ten seconds');
  assert.equal(slideKind('stat'), 'lesson', 'the 66% lesson stays a lesson');
});

test('real numbers: the checked figures, a source on every one, one gold word, no em dashes', () => {
  const want = { 's-weekly': 900, 's-work': 75, 's-pay': 62, 's-adults': 44, 's-jobs': 170, 's-fast': 100 };
  STATS.forEach(st => {
    assert.equal(st.to, want[st.v], st.v + ' is the number checked at the source on 10/9');
    assert.ok(st.src && /20\d\d/.test(st.src), st.v + ' names its source and year');
    assert.equal((st.h.match(/\{u\}/g) || []).length, 1, st.v);
    assert.doesNotMatch(st.h + st.why + st.src, /—/);
  });
  FACTS.forEach(f => { assert.ok(f.year >= 1900 && f.year <= 2026); assert.doesNotMatch(f.h + f.why, /—/); assert.equal((f.h.match(/\{u\}/g) || []).length, 1, f.v); });
  /* every number and fact names its source, links to it, and shows the organization's real logo (assets/logos/sources) */
  [...STATS, ...FACTS, LESSONS.find(l => l.v === 'stat')].forEach(x => {
    assert.ok(x.src, x.v + ' has a source'); assert.match(x.url, /^https:\/\//, x.v + ' links to it');
    assert.ok(x.logos && x.logos.length, x.v + ' shows a logo');
    x.logos.forEach(f => assert.ok(existsSync(new URL('../../assets/logos/sources/' + f, import.meta.url)), f + ' is in the repo'));
    const row = sourceRow(x); assert.match(row, /See the source/); assert.match(row, /rel="noopener noreferrer"/); assert.match(row, /alt="[A-Z]/);
  });
  assert.match(STATS.find(s => s.v === 's-pay').why, /\$1\.62/);
});

test('tallyRound: counts the lobby, the favorite wins, ties go to the first option, junk is ignored', () => {
  const opts = GAME[0].opts;
  const t = tallyRound([{ picks: { 0: 'time' } }, { picks: { 0: 'time' } }, { picks: { 0: 'day' } }, { picks: { 0: 'banana' } }, { picks: {} }, null], 0, opts);
  assert.equal(t.n, 3); assert.equal(t.top, 'time'); assert.equal(t.pct.time, 67); assert.equal(t.pct.day, 33); assert.equal(t.pct.dream, 0);
  assert.equal(tallyRound([{ picks: { 0: 'night' } }, { picks: { 0: 'day' } }], 0, opts).top, 'day', 'a tie goes to the earlier option');
  const none = tallyRound([], 0, opts); assert.equal(none.n, 0); assert.equal(none.top, null); assert.equal(none.pct.time, 0);
});

test('cleanPicks keeps only round numbers with short words', () => {
  assert.deepEqual(cleanPicks({ 0: 'time', 1: 'coffee', x: 'no', 2: 'a'.repeat(40), 3: 5 }), { 0: 'time', 1: 'coffee' });
  assert.deepEqual(cleanPicks(null), {}); assert.deepEqual(cleanPicks('x'), {});
});

test('bubbleText: one short line', () => {
  assert.equal(bubbleText('  my   emails '), 'my emails');
  const long = bubbleText('I would really love help with writing all of my weekly newsletters faster');
  assert.ok(long.length <= 34 && long.endsWith('…'));
  assert.equal(bubbleText(null), '');
});

test('wallRows: newest first, one per person, blanks out', () => {
  const rows = [
    { user_id: 'a', answer: 'old', updated_at: '2026-10-09T23:00:00Z' }, { user_id: 'b', answer: 'newest', updated_at: '2026-10-09T23:05:00Z' },
    { user_id: 'c', answer: '  ', updated_at: '2026-10-09T23:06:00Z' }, { user_id: 'd', answer: null, city: 'Dallas' }, { user_id: 'a', answer: 'dupe', updated_at: '2026-10-09T22:00:00Z' },
  ];
  assert.deepEqual(wallRows(rows).map(r => r.answer), ['newest', 'old']);
  assert.equal(wallRows(rows, 1).length, 1);
});

test('readPresence carries each guest’s game picks', () => {
  const r = readPresence({ g1: [{ role: 'guest', name: 'Meme', at: 1, picks: { 0: 'time', bad: 'x' } }] }, 'me');
  assert.deepEqual(r.guests[0].picks, { 0: 'time' });
});

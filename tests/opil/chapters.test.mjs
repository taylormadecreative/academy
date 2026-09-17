// node --test tests/opil/chapters.test.mjs — a replay that's a lesson: the pure decisions and the plugin's batching
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterLabel, chapterOffsets, chapterAt, fmtClock, durationWord, transcriptLine, transcriptOffsets, transcriptSearch, searchCopy, transcriptText,
  summaryLines, assignmentList, summaryErrorCopy, summaryStateCopy, pickReplay, replayPlayerSrc, replayMissingCopy,
  markText, transcriptGateCopy, loadAllRows, pollIsMine,
  create, FLUSH_MS, BATCH_MAX, STAGE_DEDUPE_MS, PAGE_ROWS,
} from '../../js/rtk-chapters.js';

const T0 = '2026-09-16T22:30:00Z';
const at = (s) => new Date(Date.parse(T0) + s * 1000).toISOString();

test('fmtClock: minutes and seconds, hours when it runs that long, never negative', () => {
  assert.equal(fmtClock(0), '0:00');
  assert.equal(fmtClock(7), '0:07');
  assert.equal(fmtClock(723), '12:03');
  assert.equal(fmtClock(3735), '1:02:15');
  assert.equal(fmtClock(-9), '0:00');
  assert.equal(fmtClock('x'), '0:00');
  assert.equal(durationWord(3600), '1 hr');
  assert.equal(durationWord(3900), '1 hr 5 min');
  assert.equal(durationWord(7500), '2 hrs 5 min');
  assert.equal(durationWord(2880), '48 min');
  assert.equal(durationWord(0), '');
});

test('chapterLabel says each kind plainly and falls back to the label the room wrote', () => {
  assert.equal(chapterLabel({ kind: 'stage', data: { name: 'Kiara Pee' } }), 'Kiara Pee on stage');
  assert.equal(chapterLabel({ kind: 'file', data: { title: 'Week 1 slides.pdf' } }), 'Showed Week 1 slides.pdf');
  assert.equal(chapterLabel({ kind: 'groups_start' }), 'Small groups');
  assert.equal(chapterLabel({ kind: 'groups_end' }), 'Back together');
  assert.equal(chapterLabel({ kind: 'poll', data: { question: 'Which track?' } }), 'Poll: Which track?');
  assert.equal(chapterLabel({ kind: 'board' }), 'Whiteboard');
  assert.equal(chapterLabel({ kind: 'stage', label: 'Amos on stage' }), 'Amos on stage');
  assert.equal(chapterLabel({ kind: 'mystery' }), 'mystery');
});

test('chapterOffsets: seconds from the replay start, sorted, clamped at 0, dropped when far outside the recording', () => {
  const events = [
    { id: 'c', kind: 'poll', at: at(1500), data: { question: 'Ready?' } },
    { id: 'a', kind: 'stage', at: at(-3), data: { name: 'Jamal' } },      /* asked for a moment before the recording began */
    { id: 'b', kind: 'file', at: at(65), data: { title: 'Deck.pdf' } },
    { id: 'z', kind: 'stage', at: at(-400), data: { name: 'Old' } },     /* from before this replay */
    { id: 'y', kind: 'board', at: at(9000) },                            /* long after it ended */
  ];
  const ch = chapterOffsets(events, T0, { duration: 3600 });
  assert.deepEqual(ch.map(c => [c.id, c.offset, c.clock, c.label]), [
    ['a', 0, '0:00', 'Jamal on stage'],
    ['b', 65, '1:05', 'Showed Deck.pdf'],
    ['c', 1500, '25:00', 'Poll: Ready?'],
  ]);
  assert.deepEqual(chapterOffsets(events, null), []);
  assert.equal(chapterOffsets(events, T0).length, 4, 'without a duration the late one stays');
});

test('chapterAt: the chapter playing at a second', () => {
  const ch = [{ offset: 0 }, { offset: 65 }, { offset: 1500 }];
  assert.equal(chapterAt(ch, 0), 0);
  assert.equal(chapterAt(ch, 64), 0);
  assert.equal(chapterAt(ch, 65), 1);
  assert.equal(chapterAt(ch, 4000), 2);
  assert.equal(chapterAt([{ offset: 10 }], 3), -1);
});

test('transcriptLine: finals only, once, with the kit’s id and a clean row for the RPC', () => {
  const d = new Date(T0);
  const row = transcriptLine({ id: 'l1', name: 'Jamal Ware', transcript: '  Welcome to  the lab. ', isPartialTranscript: false, date: d, customParticipantId: 'u-1', peerId: 'p-1' }, 0);
  assert.deepEqual(row, { id: 'l1', at: T0.replace('Z', '.000Z'), speaker_id: 'u-1', speaker_name: 'Jamal Ware', text: 'Welcome to the lab.' });
  assert.equal(transcriptLine({ id: 'l2', transcript: 'partial', isPartialTranscript: true }), null);
  assert.equal(transcriptLine({ id: 'l3', transcript: '   ' }), null);
  assert.equal(transcriptLine({ transcript: 'no id' }), null);
  const fallback = transcriptLine({ id: 'l4', transcript: 'no date', peerId: 'p-9' }, Date.parse(T0));
  assert.equal(fallback.at, T0.replace('Z', '.000Z')); assert.equal(fallback.speaker_id, 'p-9'); assert.equal(fallback.speaker_name, null);
});

test('transcriptOffsets + transcriptSearch + searchCopy: lines with clocks, a case-insensitive search on words or speaker', () => {
  const rows = [
    { id: 'b', at: at(90), speaker_name: 'Kiara Pee', text: 'How does an AGENT decide?' },
    { id: 'a', at: at(5), speaker_name: 'Jamal Ware', text: 'Welcome to the lab.' },
    { id: 'c', at: at(120), speaker_name: null, text: 'agents call tools' },
  ];
  const lines = transcriptOffsets(rows, T0);
  assert.deepEqual(lines.map(l => [l.id, l.clock, l.speaker]), [['a', '0:05', 'Jamal Ware'], ['b', '1:30', 'Kiara Pee'], ['c', '2:00', 'Someone']]);
  assert.deepEqual(transcriptSearch(lines, 'agent').map(l => l.id), ['b', 'c']);
  assert.deepEqual(transcriptSearch(lines, 'jamal').map(l => l.id), ['a']);
  assert.equal(transcriptSearch(lines, '  ').length, 3);
  assert.equal(transcriptSearch(lines, 'zebra').length, 0);
  assert.equal(searchCopy(2, 'agent', 3), '2 lines mention “agent” — tap one to jump there.');
  assert.equal(searchCopy(1, 'lab', 3), '1 line mentions “lab” — tap one to jump there.');
  assert.equal(searchCopy(0, 'zebra', 3), 'Nothing in the transcript says “zebra”.');
  assert.equal(searchCopy(3, '', 3), '3 lines');
  assert.equal(searchCopy(0, '', 0), 'No transcript lines were saved for this class.');
  assert.match(transcriptText(lines, 'S1'), /^S1\n\n0:05  Jamal Ware: Welcome to the lab\.\n/);
});

test('summaryLines and assignmentList clean what the model wrote', () => {
  assert.deepEqual(summaryLines('- One\n• Two\n3. Three\n\n4) Four\nFive\nSix'), ['One', 'Two', 'Three', 'Four', 'Five']);
  assert.deepEqual(assignmentList(['Read chapter 2', { text: 'Ship the demo', who: 'The Rattlers', due: 'next Wednesday' }, { title: 'Bring a question' }, '', null]),
    ['Read chapter 2', 'Ship the demo — The Rattlers · due next Wednesday', 'Bring a question']);
  assert.deepEqual(assignmentList('a\nb'), ['a', 'b']);
  assert.deepEqual(assignmentList(null), []);
});

test('the summary card and the server’s words are sentences with a next step', () => {
  assert.match(summaryErrorCopy('no_key'), /isn’t set up yet/);
  assert.match(summaryErrorCopy('nothing_to_summarize'), /nothing to summarize yet/);
  assert.match(summaryErrorCopy('not_allowed'), /coordinator/);
  assert.match(summaryErrorCopy('whatever'), /Try again/);
  assert.match(summaryStateCopy({ row: null, staff: true }), /Make summary/);
  assert.match(summaryStateCopy({ row: null, staff: false }), /on its way/);
  assert.equal(summaryStateCopy({ row: { summary: 'x' }, staff: false }), '');
  assert.match(summaryStateCopy({ busy: true }), /Writing/);
});

test('pickReplay: the published one wins, else the newest ready; replayPlayerSrc turns the watch link into the player', () => {
  const rows = [
    { id: 1, status: 'ready', published: false, watch_url: 'https://customer-abc.cloudflarestream.com/uid-new/watch', created_at: at(10) },
    { id: 2, status: 'ready', published: true, watch_url: 'https://customer-abc.cloudflarestream.com/uid-pub/watch', created_at: at(0) },
    { id: 3, status: 'uploading', published: false, created_at: at(20) },
  ];
  assert.equal(pickReplay(rows).id, 2);
  assert.equal(pickReplay(rows.filter(r => r.id !== 2)).id, 1);
  assert.equal(pickReplay([rows[2]]), null);
  assert.equal(replayPlayerSrc(rows[1]), 'https://customer-abc.cloudflarestream.com/uid-pub/iframe');
  assert.equal(replayPlayerSrc({ stream_uid: 'abc123' }), 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/abc123/iframe');
  assert.equal(replayPlayerSrc({ watch_url: 'https://evil.example/x/watch' }), null);
  assert.equal(replayPlayerSrc(null), null);
  assert.match(replayMissingCopy({ session: null }), /isn’t on the calendar/);
  assert.match(replayMissingCopy({ session: {}, staff: true, replays: [{}] }), /still being prepared/);
  assert.match(replayMissingCopy({ session: {}, staff: false, replays: [] }), /isn’t published yet/);
});

test('markText: the highlight is found on the raw words, so < & and regex characters match what the count matched', () => {
  assert.deepEqual(markText('Tom & Jerry <agent> AGENT', 'agent'), [
    { text: 'Tom & Jerry <', hit: false }, { text: 'agent', hit: true }, { text: '> ', hit: false }, { text: 'AGENT', hit: true },
  ]);
  assert.deepEqual(markText('x&y', '&'), [{ text: 'x', hit: false }, { text: '&', hit: true }, { text: 'y', hit: false }]);
  assert.deepEqual(markText('a.b', '.'), [{ text: 'a', hit: false }, { text: '.', hit: true }, { text: 'b', hit: false }]);
  assert.deepEqual(markText('plain', ''), [{ text: 'plain', hit: false }]);
  assert.deepEqual(markText('', 'x'), []);
});

test('transcriptGateCopy: a student waits for Publish; a failed load and an empty class each say so', () => {
  assert.match(transcriptGateCopy({ open: false, lines: 40 }), /once the program team publishes it/);
  assert.match(transcriptGateCopy({ open: true, lines: 0, failed: true }), /Reload the page/);
  assert.match(transcriptGateCopy({ open: true, lines: 0 }), /No transcript lines were saved/);
  assert.equal(transcriptGateCopy({ open: true, lines: 3 }), '');
});

test('loadAllRows: pages past the database’s 1,000-row cap until a short page; an error keeps what was read and says so', async () => {
  const all = Array.from({ length: 2345 }, (_, i) => ({ id: 'l' + i }));
  const calls = [];
  const page = async (from, to) => { calls.push([from, to]); return { data: all.slice(from, to + 1), error: null }; };
  const r = await loadAllRows(page);
  assert.equal(r.rows.length, 2345); assert.equal(r.error, null);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.equal(PAGE_ROWS, 1000);
  const exact = await loadAllRows(async (f, t) => ({ data: all.slice(f, t + 1).slice(0, 10), error: null }), 10, 30);
  assert.equal(exact.rows.length, 30, 'stops at maxRows');
  let n = 0;
  const broken = await loadAllRows(async (f, t) => { n++; return n === 2 ? { data: null, error: { message: 'boom' } } : { data: all.slice(f, t + 1), error: null }; });
  assert.equal(broken.rows.length, 1000); assert.equal(broken.error.message, 'boom');
  const threw = await loadAllRows(async () => { throw new Error('offline'); });
  assert.equal(threw.rows.length, 0); assert.equal(threw.error.message, 'offline');
});

test('pollIsMine: only the page that made the poll says yes; a poll with no maker is unknown', () => {
  const self = { id: 'peer-1', userId: 'kit-1', customParticipantId: 'uid-1', name: 'Nelson Taylor' };
  assert.equal(pollIsMine({ createdBy: 'Nelson Taylor' }, self, 'uid-1'), true);
  assert.equal(pollIsMine({ createdByUserId: 'kit-1' }, self, 'uid-1'), true);
  assert.equal(pollIsMine({ createdByUserId: 'uid-1' }, self, 'uid-1'), true);
  assert.equal(pollIsMine({ createdBy: 'Jamal Ware', createdByUserId: 'kit-2' }, self, 'uid-1'), false);
  assert.equal(pollIsMine({ question: 'Which track?' }, self, 'uid-1'), null);
  assert.equal(pollIsMine(null, self, 'uid-1'), null);
});

/* ---- the plugin: a fake ctx ---- */
function fakeCtx({ host = true } = {}) {
  const listeners = {}, logged = [], rpcs = [];
  let t = 1000;
  const ctx = {
    host, roomKey: 'opil:1',
    sb: { rpc: async (name, args) => { rpcs.push({ name, args }); return { data: { ok: true, added: args.p_lines.length }, error: null }; } },
    events: { log: async (kind, label, data) => { logged.push({ kind, label, data }); } },
    on: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); },
    emit: (ev, ...a) => (listeners[ev] || []).forEach(cb => cb(...a)),
    now: () => t, tick: (ms) => { t += ms; },
    uid: 'uid-1',
    getMeeting: () => null,
  };
  return { ctx, logged, rpcs, listeners };
}

test('create: the host logs the timeline once per moment — a double tap on stage, a repeating clock, do not make two chapters', async () => {
  const { ctx, logged } = fakeCtx();
  const p = create(ctx); p.start();
  await p.logStage('Kiara Pee'); await p.logStage('Kiara Pee');
  ctx.tick(STAGE_DEDUPE_MS + 1); await p.logStage('Kiara Pee');
  await p.logGroups(true); await p.logGroups(true); await p.logGroups(false); await p.logGroups(false);
  await p.logFile('Deck.pdf'); await p.logPoll('Which track?'); await p.logBoard();
  assert.deepEqual(logged.map(l => l.kind), ['stage', 'stage', 'groups_start', 'groups_end', 'file', 'poll', 'board']);
  assert.equal(logged[0].label, 'Kiara Pee on stage');
  assert.equal(logged[4].label, 'Showed Deck.pdf');
  assert.deepEqual(logged[5].data, { question: 'Which track?' });
  p.stop();
});

test('create: the room’s hooks reach the same log', async () => {
  const { ctx, logged } = fakeCtx();
  const p = create(ctx); p.start();
  ctx.emit('stage', 'Amos'); ctx.emit('file', 'Notes.pdf'); ctx.emit('groups', true); ctx.emit('poll', 'Q?'); ctx.emit('board', 'Whiteboard');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(logged.map(l => l.kind), ['stage', 'file', 'groups_start', 'poll', 'board']);
  p.stop();
});

test('create: transcript lines are kept once and saved as one batch through the RPC; a failed save is retried with the same lines', async () => {
  const { ctx, rpcs } = fakeCtx();
  const p = create(ctx); p.start();
  ctx.emit('transcript', { id: 'l1', name: 'Jamal', transcript: 'Hello', isPartialTranscript: false, date: new Date(T0) });
  ctx.emit('transcript', { id: 'l1', name: 'Jamal', transcript: 'Hello', isPartialTranscript: false, date: new Date(T0) });   /* the replay on join */
  ctx.emit('transcript', { id: 'l2', name: 'Jamal', transcript: 'Hello again', isPartialTranscript: true });                  /* a partial */
  ctx.emit('transcript', { id: 'l3', name: 'Kiara', transcript: 'Hi', isPartialTranscript: false, date: new Date(T0) });
  assert.equal(p.pending, 2);
  const added = await p.flush();
  assert.equal(added, 2); assert.equal(p.pending, 0);
  assert.equal(rpcs.length, 1); assert.equal(rpcs[0].name, 'ea_class_transcript_add'); assert.equal(rpcs[0].args.p_key, 'opil:1');
  assert.deepEqual(rpcs[0].args.p_lines.map(l => l.id), ['l1', 'l3']);
  /* the network blinks */
  ctx.sb.rpc = async () => { throw new Error('offline'); };
  ctx.emit('transcript', { id: 'l4', transcript: 'Later', isPartialTranscript: false });
  assert.equal(await p.flush(), 0); assert.equal(p.pending, 1, 'kept for next time');
  ctx.sb.rpc = async (name, args) => ({ data: { ok: true, added: args.p_lines.length }, error: null });
  assert.equal(await p.flush(), 1); assert.equal(p.pending, 0);
  p.stop();
});

test('create: a batch never exceeds BATCH_MAX lines; a refusal (not the host) drops the batch instead of retrying forever', async () => {
  const { ctx, rpcs } = fakeCtx();
  const p = create(ctx); p.start();
  for (let i = 0; i < BATCH_MAX + 10; i++) ctx.emit('transcript', { id: 'x' + i, transcript: 'line ' + i, isPartialTranscript: false });
  await p.flush();
  assert.equal(rpcs[0].args.p_lines.length, BATCH_MAX); assert.equal(p.pending, 10);
  ctx.sb.rpc = async () => ({ data: { ok: false, why: 'not_host' }, error: null });
  assert.equal(await p.flush(), 0); assert.equal(p.pending, 0);
  p.stop();
});

test('create: a student’s page logs nothing and saves nothing', async () => {
  const { ctx, logged, rpcs } = fakeCtx({ host: false });
  const p = create(ctx); p.start();
  await p.logStage('Me'); ctx.emit('transcript', { id: 'l1', transcript: 'Hi', isPartialTranscript: false });
  assert.equal(await p.flush(), 0);
  assert.equal(logged.length, 0); assert.equal(rpcs.length, 0); assert.equal(p.pending, 0);
  p.stop();
});

test('create: a new poll on the meeting becomes a chapter with its question — on the maker’s page only', async () => {
  const { ctx, logged } = fakeCtx();
  const handlers = {};
  const mm = { self: { id: 'peer-1', userId: 'kit-1', customParticipantId: ctx.uid, name: 'Nelson' }, polls: { items: [], on: (ev, cb) => { handlers[ev] = cb; } } };
  const p = create(ctx); p.start(); p.onBind(mm);
  mm.polls.items = [{ question: 'Which track are you on?' }]; handlers.pollsUpdate();   /* the kit did not say who made it: logged */
  handlers.pollsUpdate();   /* a vote, not a new poll */
  mm.polls.items = mm.polls.items.concat([{ question: 'Jamal’s poll', createdByUserId: 'kit-2', createdBy: 'Jamal Ware' }]); handlers.pollsUpdate();   /* the other host page's poll: not ours to log */
  mm.polls.items = mm.polls.items.concat([{ question: 'Ready?', createdByUserId: 'kit-1', createdBy: 'Nelson' }]); handlers.pollsUpdate();   /* ours */
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(logged.map(l => l.label), ['Poll: Which track are you on?', 'Poll: Ready?']);
  p.stop();
});

test('create: stop() saves what is still waiting and lets go of the page listeners', async () => {
  const { ctx, rpcs } = fakeCtx();
  const p = create(ctx); p.start();
  ctx.emit('transcript', { id: 'last', transcript: 'Bye', isPartialTranscript: false });
  await p.stop();
  assert.equal(rpcs.length, 1); assert.deepEqual(rpcs[0].args.p_lines.map(l => l.id), ['last']); assert.equal(p.pending, 0);
  assert.equal(await p.logStage('After'), false, 'a stopped plugin logs nothing');
});

test('the constants are what the spec says', () => {
  assert.equal(FLUSH_MS, 20000);
  assert.ok(BATCH_MAX <= 500, 'the RPC takes at most 500 lines per call');
});

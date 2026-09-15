// tests/academy/words.test.mjs — run: node --test tests/opil/*.test.mjs tests/academy/*.test.mjs
// The room's words (ROOM_WORDS) through the same nowCopy/joinCopy the OPIL class room uses,
// and the proof that the OPIL defaults did not move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../opil/hub/live-rooms.js';
import { capFirst, OPIL_WORDS, ROOM_WORDS, nowCopy, joinCopy } from '../../opil/hub/live-rooms.js';

test('live-rooms.js keeps every OPIL export and adds exactly capFirst, OPIL_WORDS, ROOM_WORDS (+ the 9/15 ask/transcript helpers)', () => {
  assert.deepEqual(Object.keys(mod).sort(), [
    'OPIL_WORDS', 'ROOM_WORDS', 'addTranscript', 'askLineCopy', 'capFirst', 'joinCopy', 'liveListHTML', 'nextInLine', 'nowCopy', 'pickRoom',
    'queueEmptyCopy', 'queueOrder', 'queuePosition', 'roomFromQuery', 'roomPath', 'sessLabel', 'stateCopy', 'transcriptText', 'useV2',
  ]);
});

test('OPIL_WORDS and ROOM_WORDS are frozen and carry the same keys', () => {
  assert.equal(Object.isFrozen(OPIL_WORDS), true);
  assert.equal(Object.isFrozen(ROOM_WORDS), true);
  const keys = ['one', 'many', 'host', 'teaching', 'thing', 'waiting', 'replayFor', 'notAllowed', 'notOpen', 'notConfigured'];
  assert.deepEqual(Object.keys(OPIL_WORDS).sort(), keys.slice().sort());
  assert.deepEqual(Object.keys(ROOM_WORDS).sort(), keys.slice().sort());
  assert.deepEqual(OPIL_WORDS, {
    one: 'student', many: 'students', host: 'your facilitator', teaching: 'is teaching', thing: 'class',
    waiting: null, replayFor: 'your students',
    notAllowed: 'Your account is not in this cohort.', notOpen: 'The room opens when your facilitator starts the class.',
    notConfigured: 'The class room is not set up yet.',
  });
  assert.deepEqual(ROOM_WORDS, {
    one: 'person', many: 'people', host: 'Nelson', teaching: 'is live', thing: 'session',
    waiting: 'Nelson hasn’t started yet — when he does, press Enter and you’re in.', replayFor: 'members',
    notAllowed: 'You need Nelson’s link or an Academy membership.', notOpen: 'Nelson hasn’t started yet.',
    notConfigured: 'The room is not set up yet.',
  });
});

test('capFirst capitalises the first letter only', () => {
  assert.equal(capFirst('class'), 'Class');
  assert.equal(capFirst('session'), 'Session');
  assert.equal(capFirst('your facilitator'), 'Your facilitator');
  assert.equal(capFirst('Nelson'), 'Nelson');
  assert.equal(capFirst(''), '');
});

test('nowCopy: the OPIL default and an explicit OPIL_WORDS give the exact strings tests/opil/room-v2.test.mjs checks', () => {
  const a = { facilitator: 'Casey Dike', title: 'Your AI Toolkit', recording: true };
  const b = { facilitator: null, title: 'Your AI Toolkit', recording: false };
  const c = { facilitator: 'Casey Dike', title: 'Your AI Toolkit', recording: true, breakout: { name: 'Data Divas', left: '11:42' } };
  assert.equal(nowCopy(a), 'Casey Dike is teaching: Your AI Toolkit · This class is being recorded');
  assert.equal(nowCopy(b), 'Class in progress: Your AI Toolkit');
  assert.equal(nowCopy(c), 'Small groups · Data Divas · 11:42 left');
  assert.equal(nowCopy(a, OPIL_WORDS), nowCopy(a));
  assert.equal(nowCopy(b, OPIL_WORDS), nowCopy(b));
  assert.equal(nowCopy(c, OPIL_WORDS), nowCopy(c));
});

test('nowCopy with ROOM_WORDS: Nelson is live, a session in progress, recorded, and breakout unchanged', () => {
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'Taylormade Academy Live', recording: true }, ROOM_WORDS),
    "Nelson is live: Taylormade Academy Live · This session is being recorded");
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'Taylormade Academy Live', recording: false }, ROOM_WORDS),
    "Nelson is live: Taylormade Academy Live");
  assert.equal(nowCopy({ facilitator: null, title: 'Office hours', recording: false }, ROOM_WORDS),
    "Session in progress: Office hours");
  assert.equal(nowCopy({ facilitator: null, title: 'Office hours', recording: true }, ROOM_WORDS),
    "Session in progress: Office hours · This session is being recorded");
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'x', recording: true, breakout: { name: 'Table 2' } }, ROOM_WORDS),
    "Small groups · Table 2");
  assert.equal(nowCopy({ facilitator: 'Nelson', title: 'x', recording: true, breakout: { name: 'Table 2', left: '4:10' } }, ROOM_WORDS),
    "Small groups · Table 2 · 4:10 left");
});

test('joinCopy: the OPIL default and an explicit OPIL_WORDS give the exact strings tests/opil/room-v2.test.mjs checks', () => {
  const cases = [
    [{ live: true, host: false, facilitator: 'Casey Dike', joined: 26 }, 'Casey Dike is in the room · 26 students joined'],
    [{ live: true, host: false, facilitator: null, joined: 1 }, 'The class is running · 1 student joined'],
    [{ live: false, host: false, facilitator: 'Casey Dike', startsAt: '7:00 PM' }, "Class hasn’t started yet. You’re all set — it starts at 7:00 PM — press Enter when it does."],
    [{ live: false, host: false, facilitator: 'Casey Dike', startsAt: null }, "Class hasn’t started yet. You’re all set — press Enter when Casey Dike starts it."],
    [{ live: false, host: false, facilitator: null, startsAt: null }, "Class hasn’t started yet. You’re all set — press Enter when your facilitator starts it."],
    [{ live: false, host: true, facilitator: 'Casey Dike' }, "This room is yours. Start the class when you’re ready — students who have the link are waiting here."],
    [{ live: true, host: true, facilitator: 'Casey Dike', joined: 3 }, 'Your class is running · 3 students joined'],
    [{ live: true, host: true, facilitator: 'Casey Dike' }, 'Your class is running · 0 students joined'],
  ];
  for (const [input, want] of cases) {
    assert.equal(joinCopy(input), want);
    assert.equal(joinCopy(input, OPIL_WORDS), want);
  }
});

test('joinCopy with ROOM_WORDS: not live and not Nelson → the waiting sentence, whatever startsAt or facilitator say', () => {
  const want = "Nelson hasn’t started yet — when he does, press Enter and you’re in.";
  assert.equal(joinCopy({ live: false, host: false }, ROOM_WORDS), want);
  assert.equal(joinCopy({ live: false, host: false, facilitator: 'Nelson', joined: 4 }, ROOM_WORDS), want);
  assert.equal(joinCopy({ live: false, host: false, facilitator: null, startsAt: '7:00 PM' }, ROOM_WORDS), want);
});

test('joinCopy with ROOM_WORDS: live and host sentences count people', () => {
  assert.equal(joinCopy({ live: true, host: false, facilitator: 'Nelson', joined: 12 }, ROOM_WORDS), "Nelson is in the room · 12 people joined");
  assert.equal(joinCopy({ live: true, host: false, facilitator: 'Nelson', joined: 1 }, ROOM_WORDS), "Nelson is in the room · 1 person joined");
  assert.equal(joinCopy({ live: true, host: false, facilitator: null, joined: 1 }, ROOM_WORDS), "The session is running · 1 person joined");
  assert.equal(joinCopy({ live: true, host: false, facilitator: null, joined: 0 }, ROOM_WORDS), "The session is running · 0 people joined");
  assert.equal(joinCopy({ live: false, host: true }, ROOM_WORDS), "This room is yours. Start the session when you’re ready — people who have the link are waiting here.");
  assert.equal(joinCopy({ live: true, host: true, joined: 3 }, ROOM_WORDS), "Your session is running · 3 people joined");
  assert.equal(joinCopy({ live: true, host: true, joined: 1 }, ROOM_WORDS), "Your session is running · 1 person joined");
});

test('joinCopy without a waiting sentence falls through to the hasn\'t-started sentences, capitalised from words.thing', () => {
  const noWait = Object.freeze({ ...ROOM_WORDS, waiting: null });
  assert.equal(joinCopy({ live: false, host: false, startsAt: '7:00 PM' }, noWait),
    "Session hasn’t started yet. You’re all set — it starts at 7:00 PM — press Enter when it does.");
  assert.equal(joinCopy({ live: false, host: false, facilitator: null, startsAt: null }, noWait),
    "Session hasn’t started yet. You’re all set — press Enter when Nelson starts it.");
  assert.equal(joinCopy({ live: false, host: false, facilitator: 'Casey Dike', startsAt: null }, noWait),
    "Session hasn’t started yet. You’re all set — press Enter when Casey Dike starts it.");
});

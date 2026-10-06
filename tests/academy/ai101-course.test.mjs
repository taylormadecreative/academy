// tests/academy/ai101-course.test.mjs — run: node --test tests/academy/ai101-course.test.mjs
// ai101_course.py is the course. These are its rules as checks: shape, counts, the demo prompts verbatim from
// the run of show, every word defined, every tool line filled, and nothing a public page must never carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const C = JSON.parse(execFileSync('python3', ['-c', 'import json, ai101_course as c; print(json.dumps({k: getattr(c, k) for k in dir(c) if k.isupper()}))'], { cwd: ROOT }).toString());

test('seven steps, numbered 1-7, each with a check line and minutes that fit the hour', () => {
  assert.deepEqual(C.STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(C.STEPS.every((s) => s.check && s.title && s.do.length));
  assert.ok(C.STEPS.reduce((a, s) => a + s.min, 0) <= 42, 'teaching + practice end by 7:42 for Q&A');
});
test('the demo prompts are the run of show, verbatim', () => {
  assert.equal(C.DEMO.bad, 'Write a post about my bakery.');
  assert.equal(C.GOOD, 'You are a social media writer for a small family bakery. Write an Instagram caption for our new sweet potato pie. It\'s my grandmother\'s recipe and we only sell it on Fridays. Our customers are busy parents who love comfort food. Keep it under 60 words, warm and friendly, and end with a question. Here\'s a caption we loved last month: "Saturday mornings smell like cinnamon around here. Come see what\'s fresh before it\'s gone. What\'s your go-to Saturday treat?"');
  assert.deepEqual(C.DEMO.follow_ups, ['Make it shorter.', 'Now write it like a grandmother is talking.', 'Give me 3 more options, each with a different opening line.']);
  assert.equal(C.DEMO.check.length, 2);
});
test('five parts in R T C F E order, each with an ask and a placeholder', () => {
  assert.deepEqual(C.PARTS.map((p) => p.letter).join(''), 'RTCFE');
  assert.ok(C.PARTS.every((p) => p.ask && p.placeholder));
});
test('library: 5 groups of 6, every prompt has [BLANKS]', () => {
  assert.deepEqual(C.LIBRARY.map((g) => g.group), ['At work', 'Your own business', 'Home and family', 'Money and time', 'Learn anything']);
  for (const g of C.LIBRARY) { assert.equal(g.items.length, 6, g.group); for (const it of g.items) assert.match(it.prompt, /\[[A-Z]/, it.title); }
});
test('every tool has every line, and all three tools have the same keys', () => {
  const keys = ['name', 'site', 'url', 'signup', 'type', 'new_chat', 'save_once', 'save_short', 'upload', 'voice', 'limit'];
  assert.deepEqual(C.TOOL_ORDER, ['claude', 'chatgpt', 'gemini']);
  for (const t of C.TOOL_ORDER) for (const k of keys) assert.ok(C.TOOLS[t][k], `${t}.${k}`);
  assert.match(C.TOOLS_CHECKED, /^\d{4}-\d{2}-\d{2}$/);
});
test('counts: 6 outcomes, 10 follow-ups, 6 level-ups, 10 things, 6 fixes, 6 never-paste, 13 words', () => {
  assert.equal(C.OUTCOMES.length, 6); assert.equal(C.FOLLOW_UPS.length, 10); assert.equal(C.LEVEL_UPS.length, 6);
  assert.equal(C.TEN_THINGS.length, 10); assert.equal(C.FIX_IT.length, 6); assert.equal(C.NEVER_PASTE.length, 6);
  assert.equal(C.WORDS_FULL.length, 13);
  const words = C.WORDS_FULL.map((w) => w[0]);
  for (const w of C.WORDS_STEP2) assert.ok(words.includes(w), w);
});
test('follow leads with Instagram then the Facebook group', () => {
  assert.equal(C.FOLLOW.instagram.handle, '@taylormade_creative');
  assert.equal(C.FOLLOW.facebook.url, 'https://www.facebook.com/groups/taylormadeacademy');
});
test('nothing a public page must never carry (the build guard, with its private list when present)', () => {
  execFileSync('python3', ['-c', 'import json, ai101_course as c\nfrom build_ai101_class import check_public_copy\ncheck_public_copy(json.dumps({k: getattr(c, k) for k in dir(c) if k.isupper()}, ensure_ascii=False))'], { cwd: ROOT, stdio: 'pipe' });
});
test('the stage text is complete and the guesses are labelled as an illustration in code', () => {
  for (const k of ['soon_h', 'chat_prompt', 'steer_answer', 'tokens_sentence', 'window_words', 'check_claim', 'save_card', 'bye_thanks']) assert.ok(C.STAGE[k], k);
  assert.match(C.STAGE.check_claim_note, /made-up example/i, 'the fake fact is called a made-up example on screen');
  assert.equal(C.STAGE.safe_items.length, 6);
});

// ---- final-review fixes (10/6): fact-check, training design, accessibility ----
test('setup: the Claude sign-up warns about the texted code, and so does the starting-soon screen', () => {
  assert.match(C.TOOLS.claude.signup, /texts a code to your phone/);
  assert.match(C.TOOLS.claude.signup, /Google Voice and landlines don't work/);
  assert.match(C.STAGE.soon_sub, /texts you a code/);
});
test('limits and menus match the vendors as checked', () => {
  assert.doesNotMatch(C.TOOLS.chatgpt.limit, /best model/);
  assert.match(C.TOOLS.chatgpt.limit, /doesn't cap everyday text chats/);
  assert.match(C.TOOLS.gemini.limit, /weekly limit/);
  assert.doesNotMatch(C.FIX_IT[2][1], /cap how much you can send in a few hours/);
  assert.match(C.TOOLS.gemini.new_chat, /phone app/);
  assert.equal(C.TOOLS.gemini.save_short, 'Settings & help → Personal context');
  assert.match(C.TOOLS.gemini.save_once, /In November/);
  assert.match(C.TOOLS.claude.save_once, /a folder for one job/);
});
test('words: a token is a small piece of text; custom instructions are not Projects; an agent uses tools', () => {
  const W = Object.fromEntries(C.WORDS_FULL);
  assert.match(W.Token, /^A small piece of text/);
  assert.equal(C.STAGE.tokens_h, 'A token is a small piece of text.');
  assert.doesNotMatch(W['Custom instructions'], /Projects and Gems work this way too/);
  assert.match(W.Agent, /use tools/);
  assert.ok(C.WORDS_STEP2.includes('Prompt'));
});
test('checking means a second source you find yourself, not "are you sure?"', () => {
  assert.match(C.DEMO.check[0], /a link to a source for each one/);
  assert.doesNotMatch(C.DEMO.check.join(' '), /Are you sure\?/);
  const step = C.STEPS.find((s) => s.id === 'check');
  assert.match(step.do.join(' '), /Proof is a second source you find yourself/);
  assert.match(step.check, /opened one source/);
  assert.match(C.STAGE.check_claim, /Bluebonnet Business AI Index/);
  assert.match(C.STAGE.check_claim_note, /both fake/);
  assert.ok(C.STAGE.check_guess_note, 'the guess bars are called an example on screen');
});
test('safe use: the swap, the slip, the why, and who to ask at work', () => {
  assert.ok(C.NEVER_PASTE.some((x) => /^Employee information/.test(x)));
  assert.ok(C.NEVER_PASTE.some((x) => /^Customer or client information/.test(x)));
  assert.match(C.NEVER_PASTE_SLIP, /Delete that chat/);
  assert.match(C.TEN_THINGS[6][1], /\[brackets\]/);
  const step = C.STEPS.find((s) => s.id === 'check');
  assert.match(step.do.join(' '), /Which AI tools can I use, and what can I put in them\?/);
  const notes = Object.fromEntries(C.LIBRARY[0].items.map((i) => [i.title, i.note || '']));
  for (const t of ['Meeting notes into a summary', 'Plan a hard conversation', 'A job post']) assert.ok(notes[t], t);
  assert.match(C.STAGE.safe_foot, /\[brackets\]/);
});
test('no unsupported superlatives; fix-its that are true', () => {
  assert.doesNotMatch(JSON.stringify(C.TEN_THINGS), /change the answer the most/);
  assert.doesNotMatch(C.FIX_IT[3][1], /like make medical or legal decisions/);
  assert.match(C.FIX_IT[5][1], /Incognito or Temporary/);
  assert.match(C.LEVEL_UPS[1].why, /often works better/);
});
test('the hour is re-timed so the safe beat and the 7:41 tap fit; practice is 11 minutes', () => {
  assert.deepEqual(C.STEPS.map((s) => s.time), ['7:00', '7:02', '7:08', '7:19', '7:24', '7:28', '7:30']);
  assert.equal(C.STEPS.find((s) => s.id === 'yourturn').min, 11);
  assert.ok(C.STEPS.reduce((a, s) => a + s.min, 0) <= 41, 'teaching + practice end by 7:41');
});
test('a step with a flow places each line and each prompt exactly once', () => {
  for (const s of C.STEPS.filter((x) => x.flow)) {
    assert.deepEqual(s.flow.filter((f) => f[0] === 'do').map((f) => f[1]).sort(), s.do.map((_, i) => i), s.id + ' do');
    assert.deepEqual(s.flow.filter((f) => f[0] === 'prompt').map((f) => f[1]).sort(), (s.prompts || []).map((_, i) => i), s.id + ' prompts');
  }
  for (const id of ['words', 'prompt5', 'check']) assert.ok(C.STEPS.find((s) => s.id === id).flow, id + ' puts each instruction next to its copy box');
});
test('outcomes are things you can see someone do', () => {
  assert.ok(C.OUTCOMES.every((o) => !/^Know\b/.test(o)));
  assert.match(C.OUTCOMES[3], /second source/);
});
test('the confidence question says confident at what, and how the number is used', () => {
  assert.match(C.PULSE_Q.before, /confident .*something useful/);
  assert.match(C.PULSE_Q.after, /^Now, /);
  assert.deepEqual(C.PULSE_ENDS, ['Not at all confident', 'Very confident']);
  assert.match(C.PULSE_NOTE, /only share totals/);
});
test('practice taps and the 3-question check', () => {
  assert.deepEqual(C.PRACTICE_TAPS.map((t) => t.kind), ['useful', 'steered']);
  assert.deepEqual(C.CHECK_ITEMS.map((t) => t.kind), ['chk_safe', 'chk_verify', 'chk_prompt']);
  for (const q of C.CHECK_ITEMS) { assert.equal(q.options.length, 3, q.kind); assert.ok(q.right >= 1 && q.right <= 3, q.kind); assert.ok(q.yes && q.no && q.q, q.kind); }
  assert.doesNotMatch(JSON.stringify(C.CHECK_ITEMS), /the most\b/);
});
test('a company visitor can raise a hand; the pitch no longer contradicts step 6', () => {
  assert.match(C.WHATS_NEXT.team_p, /\bTEAM\b/);
  assert.doesNotMatch(C.WHATS_NEXT.agent_p, /over again/);
  assert.match(C.WHATS_NEXT.replay_p, /stays free on this page/);
});
test('wider examples, fewer stereotypes', () => {
  assert.equal(C.DEMO_ALT.parts.length, 4);
  assert.doesNotMatch(JSON.stringify(C.PARTS), /older members/);
  assert.doesNotMatch(JSON.stringify(C.LIBRARY), /RECEPTIONIST/);
  assert.doesNotMatch(C.STAGE.steer_grandma, /^Baby,/);
  assert.equal(C.LEVEL_UPS[3].title, 'Use your own language');
});
test('setup is taught: three things open, two chats, copy and paste, the first tap', () => {
  const titles = C.START_HERE.map((x) => x.title);
  for (const t of ["Tonight you'll have three things open", 'How to copy and paste', 'One tap before we start', 'Stuck on the account?']) assert.ok(titles.includes(t), t);
  assert.match(C.START_HERE[0].body, /three of the best known/);
  assert.match(C.START_HERE[0].body, /room chat .* AI chat/);
});
test('an access line that promises only what is true', () => { assert.match(C.ACCESS, /doesn't have live captions/); });

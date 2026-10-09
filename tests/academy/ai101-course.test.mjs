// tests/academy/ai101-course.test.mjs — run: node --test tests/academy/ai101-course.test.mjs
// ai101_course.py is the course. These are its rules as checks: shape, counts, the demo prompts verbatim from
// the run of show, every word defined, every tool line filled, and nothing a public page must never carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const C = JSON.parse(execFileSync('python3', ['-c', 'import json, ai101_course as c; print(json.dumps({k: getattr(c, k) for k in dir(c) if k.isupper()}))'], { cwd: ROOT }).toString());

test('eight steps, numbered 1-8, each with a check line; teaching + practice end by 7:45 (Nelson 10/8: running a few minutes long is fine)', () => {
  assert.deepEqual(C.STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(C.STEPS.every((s) => s.check && s.title && s.do.length));
  assert.ok(C.STEPS.reduce((a, s) => a + s.min, 0) <= 45, 'teaching + practice end by 7:45 for the after tap and Q&A');
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
test('counts: 6 outcomes, 10 follow-ups, 6 level-ups, 10 things, 6 fixes, 6 never-paste, 15 words', () => {
  assert.equal(C.OUTCOMES.length, 6); assert.equal(C.FOLLOW_UPS.length, 10); assert.equal(C.LEVEL_UPS.length, 6);
  assert.equal(C.TEN_THINGS.length, 10); assert.equal(C.FIX_IT.length, 6); assert.equal(C.NEVER_PASTE.length, 6);
  assert.equal(C.WORDS_FULL.length, 15); // 10/9: + Frontier model, AGI
  const words = C.WORDS_FULL.map((w) => w[0]);
  for (const w of C.WORDS_STEP2) assert.ok(words.includes(w), w);
});
test('follow leads with Instagram then the Facebook group', () => {
  assert.equal(C.FOLLOW.instagram.handle, '@taylormade_creative');
  assert.equal(C.FOLLOW.facebook.url, 'https://www.facebook.com/groups/taylormadeacademy');
});
test('nothing a public page must never carry (the build guard, with its private list when present)', () => {
  // STAGE_DEAL is the one place the list-only price may appear (the stage only, Nelson 10/8); the code is still refused there
  execFileSync('python3', ['-c', 'import json, ai101_course as c\nfrom build_ai101_class import check_public_copy\ncheck_public_copy(json.dumps({k: getattr(c, k) for k in dir(c) if k.isupper() and k != "STAGE_DEAL"}, ensure_ascii=False))\ncheck_public_copy(json.dumps(c.STAGE_DEAL), allow_list_price=True)'], { cwd: ROOT, stdio: 'pipe' });
});
test('the stage text is complete and the guesses are labelled as an illustration in code', () => {
  for (const k of ['soon_h', 'chat_prompt', 'steer_answer', 'tokens_sentence', 'window_msgs', 'check_claim', 'save_card', 'bye_thanks']) assert.ok(C.STAGE[k], k);
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
  // 10/9 (Nelson): most chatbots come with a search or research tool now; trust real sources, not Reddit or opinions
  assert.match(C.STAGE.check_how, /^On its own, it doesn't look anything up/);
  assert.match(C.STAGE.check_search, /search or research tool/); assert.match(C.STAGE.check_skip[1], /Reddit/);
  assert.match(step.do.join(' '), /search or research tool now[\s\S]*Not Reddit, forums or people's opinions/);
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
test('the hour is re-timed: the laptop step at 7:02 pushes everything after it 4 minutes; practice is still 11 minutes', () => {
  assert.deepEqual(C.STEPS.map((s) => s.time), ['7:00', '7:02', '7:06', '7:12', '7:23', '7:28', '7:32', '7:34']);
  for (let i = 1; i < C.STEPS.length; i++) {
    const [h0, m0] = C.STEPS[i - 1].time.split(':').map(Number), [h1, m1] = C.STEPS[i].time.split(':').map(Number);
    assert.equal(h1 * 60 + m1 - (h0 * 60 + m0), C.STEPS[i - 1].min, `${C.STEPS[i - 1].id} ends when ${C.STEPS[i].id} starts`);
  }
  assert.equal(C.STEPS.find((s) => s.id === 'yourturn').min, 11);
  assert.ok(C.STEPS.reduce((a, s) => a + s.min, 0) <= 45, 'teaching + practice end by 7:45');
});
test('Step 2 gets it on the laptop: every tool x computer has steps, a download page, what it needs, and the website fallback', () => {
  const laptop = C.STEPS.find((s) => s.id === 'laptop');
  assert.equal(laptop.n, 2); assert.equal(laptop.time, '7:02');
  assert.deepEqual(C.OS_ORDER, ['mac', 'windows']);
  for (const t of C.TOOL_ORDER) {
    const i = C.INSTALL[t];
    assert.match(i.get_url, /^https:\/\//, t);
    assert.ok(i.get_url.includes(i.get.split('/')[0]), `${t} button text matches its link`);
    for (const o of C.OS_ORDER) {
      assert.ok(i[o].length >= 3 && i[o].length <= 4, `${t}/${o}: 3 or 4 steps`);
      assert.match(i[o][0], new RegExp(i.get.replace(/\./g, '\\.')), `${t}/${o} starts at the download page`);
      assert.match(i[o + '_needs'], /^Needs /, `${t}/${o} says what it needs`);
    }
  }
  assert.match(C.INSTALL.chatgpt.windows.join(' '), /Microsoft Store/, 'ChatGPT on Windows installs through the Store');
  assert.match(C.INSTALL.chatgpt.mac_needs, /macOS 14/); assert.match(C.INSTALL.gemini.mac_needs, /Apple chip/); assert.match(C.INSTALL.claude.mac_needs, /macOS 11/);
  assert.match(C.INSTALL_WEB, /\{site\}/);
  assert.match(laptop.do.join(' '), /Ask IT before you install/, 'work laptops: IT first');
  assert.match(C.INSTALL_CHECKED, /^\d{4}-\d{2}-\d{2}$/);
});
test("his line: don't fall in love with one AI, on the class page and full screen on the stage", () => {
  assert.equal(C.NO_LOVE.h, "Don't fall in love with one AI.");
  assert.match(C.NO_LOVE.body, /They change all the time/);
  assert.match(C.NO_LOVE.body, /learn the skill, not the app/);
  assert.ok(C.STEPS.find((s) => s.id === 'laptop').flow.some((f) => f[1] === 'no_love'));
  assert.equal(C.STAGE.nolove_foot, 'Learn the skill, not the app.');
  assert.deepEqual(C.STAGE.nolove_tools, ['Claude', 'ChatGPT', 'Gemini']);
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

test('account setup: Claude = Google or the emailed link, then the texted code, no password; ChatGPT = sign up, emailed code, name + birthday, no phone', () => {
  assert.deepEqual(Object.keys(C.SETUP), C.TOOL_ORDER);
  for (const t of C.TOOL_ORDER) { assert.ok(C.SETUP[t].steps.length >= 3 && C.SETUP[t].steps.length <= 4, t); assert.ok(C.SETUP[t].note, t); }
  const cl = C.SETUP.claude.steps.join(' ');
  assert.match(cl, /Continue with Google/); assert.match(cl, /Secure link to log in to Claude\.ai/); assert.match(cl, /texts you a code/); assert.match(cl, /Verify code/);
  assert.match(C.SETUP.claude.note, /no password/i);
  const gpt = C.SETUP.chatgpt.steps.join(' ');
  assert.match(gpt, /Sign up/); assert.match(gpt, /Google, Microsoft or Apple/); assert.match(gpt, /birthday/); assert.match(gpt, /skip it/);
  assert.equal(C.SETUP.chatgpt.note, 'No phone number needed.');
  assert.ok(C.STEPS.find((s) => s.id === 'laptop').flow.some((f) => f[1] === 'setup'));
  assert.match(C.SETUP_CHECKED, /^\d{4}-\d{2}-\d{2}$/);
});

test("each AI's strong suit: Nelson's picks as headlines, checked lines under them, and what each can't do", () => {
  assert.deepEqual(C.STRENGTHS.map((x) => x.tool), C.TOOL_ORDER);
  assert.deepEqual(C.STRENGTHS.map((x) => x.pick), ['coding and building apps', 'images and planning content', 'videos, images and music']);
  const pts = Object.fromEntries(C.STRENGTHS.map((x) => [x.tool, x.points.join(' ')]));
  assert.match(pts.claude, /Can't make pictures, videos or music/); assert.match(pts.claude, /small margins that change often/);
  assert.match(pts.chatgpt, /video app shut down in April/); assert.match(pts.chatgpt, /a few a day/);
  assert.match(pts.gemini, /18 and up/); assert.match(pts.gemini, /Making videos needs a paid plan/); assert.match(pts.gemini, /5 minutes/);
  assert.match(C.STRENGTHS_FOOT, /Checked October 8, 2026/);
  assert.ok(C.STEPS.find((s) => s.id === 'laptop').flow.some((f) => f[1] === 'strengths'));
  assert.equal(C.STAGE.strengths.length, 3);
  assert.match(C.STAGE.steer_grandma, /\bhoney\b/); assert.doesNotMatch(C.STAGE.steer_grandma, /my grandmother's/i);
});

test("never trust AI blindly, up front (Nelson 10/8): Step 3 opens with it, Start here has it, hallucination is a starting word", () => {
  assert.equal(C.TRUST_WARN.h, 'Never trust AI blindly.');
  assert.match(C.TRUST_WARN.body, /hallucination/); assert.match(C.TRUST_WARN.body, /do a job wrong/); assert.match(C.TRUST_WARN.body, /check its work/);
  assert.ok(C.WORDS_STEP2.includes('Hallucination'));
  assert.deepEqual(C.STEPS.find((s) => s.id === 'words').flow[0], ['extra', 'trust'], 'the warning is the first thing in Step 3');
  assert.ok(C.START_HERE.some((x) => x.title === 'One rule before you start' && /Never trust AI blindly/.test(x.body)));
  assert.match(C.STAGE.words_warn_rule, /Never trust it blindly/);
});

test('context window (Nelson 10/8): your whole chat, re-read every reply, so longer costs more; when full the start falls out', () => {
  const st = C.STEPS.find((s) => s.id === 'check').do[0];
  assert.match(st, /reads the whole chat again/); assert.match(st, /costs more to run/); assert.match(st, /uses up your free messages faster/); assert.match(st, /stay in the same chat while you're on the same subject/); assert.match(st, /New subject\? Start a new chat\./); assert.match(st, /Sum up this chat/);
  assert.match(Object.fromEntries(C.WORDS_FULL)['Context window'], /cost more/);
  assert.equal(C.STAGE.window_costs.length, 3); assert.match(C.STAGE.window_costs[2], /costs more/);
  assert.match(C.STAGE.window_msgs[0][1], /Ann/); assert.match(C.STAGE.window_msgs.at(-1)[1], /don't see your name/);
  assert.match(C.STAGE.window_example, /^Example chat/);
  // 10/9 (Nelson): same subject = same chat (a new chat starts from zero); a long one gets summed up into a new chat
  assert.deepEqual(C.STAGE.window_rules.map((r) => r[0]), ['Same subject?', 'New subject?', 'Too long?']);
  assert.doesNotMatch(JSON.stringify(C.STAGE) + C.STEPS.find((s) => s.id === 'check').do[0], /New job/);
});
test('the next-word scene explains itself: how it guesses, and why that can be wrong', () => {
  assert.match(C.STAGE.check_how, /doesn't look anything up/); assert.match(C.STAGE.check_why, /not what's true/); assert.match(C.STAGE.check_why, /hallucination/);
  assert.match(C.STAGE.check_guess_note, /Example numbers/);
});

test('the 48-hour deal: 9 PM tonight to Sunday 9 PM CT, $65 vs $75 on the stage only', () => {
  assert.match(C.STAGE_DEAL.next_p, /^\$65 instead of \$75, for 48 hours only\./); assert.match(C.STAGE_DEAL.next_p, /Sunday at 9 PM CT/);
  assert.match(C.WHATS_NEXT.deal_p, /48 hours/); assert.doesNotMatch(C.WHATS_NEXT.deal_p, /\$/);
});
test("frontier models and AGI (Nelson 10/9): honest words, no dates or predictions, on the stage and the class page from one dict", () => {
  const F = C.FRONTIER, all = JSON.stringify(F) + JSON.stringify(C.WORDS_FULL.filter(([w]) => /Frontier|AGI/.test(w)));
  assert.match(F.agi, /as good as a person at most thinking work/);
  assert.match(F.agi_note, /No one agrees/);
  assert.match(F.stage_agi, /No one agrees what counts, or when/);
  assert.doesNotMatch(all, /\b(20[3-9]\d|by 20\d\d|will (arrive|come|be here)|is here|already here|never)\b/i, 'no dates, predictions or claims it is here');
  assert.deepEqual(F.climbers, ['Claude', 'ChatGPT', 'Gemini']);
  assert.ok(C.WORDS_STEP2.includes('Frontier model') && C.WORDS_STEP2.includes('AGI'));
  assert.equal(C.STAGE_STEP.frontier, 3);
});

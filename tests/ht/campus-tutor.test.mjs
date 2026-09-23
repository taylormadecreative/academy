// Ada, the course tutor: deterministic retrieval, integrity guard, storage, and rubric drafting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const T = await import(new URL('../../ht/hub/campus-tutor.js', import.meta.url));

const modules = [
  { id: 'm1', course_id: 'c', position: 1, title: 'Understand what AI can—and cannot—do', body: 'Generative AI predicts useful patterns in language, images, and other information. A fluent answer can still be inaccurate or incomplete. Treat its output as a draft to evaluate, not as evidence.\n\nBefore using a tool for coursework, check your instructor’s policy. Keep private student information, passwords, and confidential documents out of unapproved tools. Verify factual claims using reliable original sources, and acknowledge AI assistance when required.\n\nPractice: ask an AI tool to explain a familiar concept. Identify one claim you would verify and name a source you could check.', assignment_prompt: null },
  { id: 'm2', course_id: 'c', position: 2, title: 'Write a clear prompt and evaluate the result', body: 'A useful prompt explains the task, audience, context, and desired output. State what a good result must include and what information is missing.\n\nExample: “Help me draft a study plan for two biology chapters over five days. I have 45 minutes each day. Include retrieval practice and a way to check my understanding. Ask me about any missing requirements before planning.”\n\nReview the result for accuracy, bias, usefulness, and fit. Improve one instruction at a time. You remain responsible for deciding whether the final output meets the assignment requirements.', assignment_prompt: null },
  { id: 'm3', course_id: 'c', position: 3, title: 'Create, reflect, and share your work', body: 'Choose a small, practical task: a study plan, a campus event brief, or a portfolio summary. Use an approved AI tool if available; you may also write the prompt and expected output yourself.\n\nYour submission will be reviewed for a clear purpose, specific instructions, evidence of evaluation, and your own reflection. A staff reviewer will return feedback or approve the work.', assignment_prompt: 'Submit: (1) your task and intended audience; (2) the prompt you wrote; (3) a short excerpt of the result or your expected result; (4) what you verified or changed; and (5) one limitation and how you addressed it. Do not include confidential information.' },
];
const assignments = [
  { id: 'brief', status: 'published', title: 'Responsible AI project brief', instructions: 'Describe a useful campus project, its audience, and a prompt you would use. Include one result you would verify, the source you would consult, and a limitation you would explain. Submit your brief as text or an HTTPS project link.', points_possible: 100 },
  { id: 'secret', status: 'draft', title: 'SECRET draft', instructions: 'SECRET cafeteria instructions for the hidden draft.', points_possible: 50 },
];
const corpus = T.buildCorpus({ modules, assignments });

test('light stemming and tokenizing drop stopwords and punctuation', () => {
  assert.equal(T.stem('prompts'), T.stem('prompt'));
  assert.equal(T.stem('verified'), T.stem('verify'));
  assert.equal(T.stem('writing'), T.stem('write'));
  assert.equal(T.stem('planning'), T.stem('plan'));
  assert.deepEqual(T.tokenize('What makes a CLEAR prompt?!'), ['clear', 'prompt']);
});

test('sentences never split inside a quoted example', () => {
  const parts = T.sentences(modules[1].body.split('\n\n')[1]);
  assert.equal(parts.length, 1);
  assert.match(parts[0], /^Example: “Help me draft.*planning\.”$/);
});

test('Ada answers from course modules with citations to the right module', () => {
  const accurate = T.answerQuestion('How do I check if an AI answer is accurate?', corpus);
  assert.equal(accurate.kind, 'answer');
  assert.ok(accurate.passages.length >= 1 && accurate.passages.length <= 2);
  assert.equal(accurate.passages[0].citation.kind, 'module');
  assert.equal(accurate.passages[0].citation.number, 1);
  assert.match(accurate.passages[0].citation.label, /^From Module 1 · /);
  const prompt = T.answerQuestion('What makes a clear prompt?', corpus);
  assert.equal(prompt.passages[0].citation.number, 2);
  assert.match(prompt.passages[0].text, /useful prompt explains the task/);
  assert.deepEqual(prompt.passages.map(item => item.citation.number), [2], 'a passage that only shares the word "clear" is not cited');
  for (const question of ['How do I check if an AI answer is accurate?', 'What goes in the project brief?', 'What should my reflection include?', 'How do I verify a claim?']) {
    const answer = T.answerQuestion(question, corpus);
    if (answer.kind === 'answer') assert.ok(answer.passages.length <= 2, `${question}: at most two passages`);
  }
  const brief = T.answerQuestion('What goes in the project brief?', corpus);
  assert.equal(brief.kind, 'answer');
  assert.ok(brief.passages.some(item => item.citation.kind === 'assignment' && item.citation.id === 'brief'));
  assert.deepEqual(T.answerQuestion('What makes a clear prompt?', corpus), prompt, 'answers are deterministic');
});

test('Ada says so honestly when the materials do not cover a question', () => {
  for (const question of ['What time does the cafeteria open on Sunday?', 'What is the capital of France?', 'Is AI going to take my job?']) {
    assert.equal(T.answerQuestion(question, corpus).kind, 'none', question);
  }
  assert.equal(T.answerQuestion('   ', corpus).kind, 'empty');
});

test('draft assignment instructions never enter the tutor library', () => {
  assert.ok(corpus.passages.every(passage => !/SECRET/.test(passage.text) && passage.source.id !== 'secret'));
  assert.equal(T.answerQuestion('What are the hidden draft cafeteria instructions?', corpus).kind, 'none');
});

test('integrity guard declines doing the work but still answers how-to questions', () => {
  for (const question of ['Write my brief', 'Can you write my brief for me?', 'write the brief for me', 'Please do my assignment', 'answer the quiz', 'Give me the answers', 'Could you complete this project for me', 'Draft my reflection for me please']) {
    assert.equal(T.isIntegrityRequest(question), true, question);
    const answer = T.answerQuestion(question, corpus);
    assert.equal(answer.kind, 'integrity', question);
    assert.equal(answer.pointer?.kind, 'module', `${question} points to a module`);
  }
  assert.equal(T.answerQuestion('Write the brief for me', corpus).pointer.number, 3);
  for (const question of ['How do I write my brief?', 'What makes a clear prompt?', 'What goes in the project brief?', 'What should my reflection include?']) {
    assert.equal(T.isIntegrityRequest(question), false, question);
  }
});

test('suggested questions are ones this course can answer', () => {
  const suggestions = T.suggestedQuestions(corpus);
  assert.deepEqual(suggestions, ['How do I check if an AI answer is accurate?', 'What makes a clear prompt?', 'What goes in the project brief?']);
  assert.deepEqual(T.suggestedQuestions(T.buildCorpus({})), []);
});

test('conversation storage is per user and section, capped at 20 turns, and survives broken storage', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) } });
  try {
    const turns = Array.from({ length: 25 }, (_, index) => ({ q: `Question ${index}`, a: { kind: 'none', passages: [] } }));
    T.saveTurns('u1', 'c1', turns);
    assert.ok(store.has('ht-hub-tutor-v1:u1:c1'));
    const loaded = T.loadTurns('u1', 'c1');
    assert.equal(loaded.length, 20); assert.equal(loaded[0].q, 'Question 5');
    assert.deepEqual(T.loadTurns('u2', 'c1'), []);
    T.clearTurns('u1', 'c1'); assert.deepEqual(T.loadTurns('u1', 'c1'), []);
    store.set('ht-hub-tutor-v1:u1:c1', '{not json'); assert.deepEqual(T.loadTurns('u1', 'c1'), []);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.deepEqual(T.loadTurns('u1', 'c1'), []); assert.equal(T.saveTurns('u1', 'c1', turns), false);
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; }
});

test('tutor panel escapes questions and links citations to the modules tab', () => {
  const h = { esc: value => String(value).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`), href: (view, query = {}) => `/ht/hub/${view}/?${new URLSearchParams(query)}`, cohortId: 'c1', userId: 'u1', instructorId: 't1', instructorName: 'Morgan T.' };
  const html = T.renderTurns(h, [{ q: '<img src=x onerror=alert(1)>', a: T.answerQuestion('What makes a clear prompt?', corpus) }, { q: 'cafeteria?', a: { kind: 'none', passages: [] } }]);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /href="\/ht\/hub\/courses\/\?cohort=c1&#38;tab=modules#module-2"/);
  assert.match(html, /I couldn't find that in this course's materials\. Try rephrasing, or <a href="\/ht\/hub\/people\/\?person=t1">ask Morgan T\.<\/a>/);
});

test('rubric: sample brief uses 25/20/13/6; other assignments split evenly; totals and missing points', () => {
  const sample = T.rubricFor({ title: 'Responsible AI project brief', points_possible: 100 });
  assert.equal(sample.criteria.length, 4);
  assert.deepEqual(sample.criteria.map(criterion => criterion.name), ['Purpose & audience', 'Prompt clarity', 'Evidence of verification', 'Reflection & limits']);
  assert.deepEqual(sample.criteria[0].levels.map(level => level.points), [25, 20, 13, 6]);
  assert.deepEqual(T.rubricTotal(sample, { purpose: 'exemplary', prompt: 'proficient', verify: 'developing', reflect: 'beginning' }), { total: 64, picked: 4, complete: true });
  assert.deepEqual(T.rubricTotal(sample, { purpose: 'exemplary' }), { total: 25, picked: 1, complete: false });
  const forty = T.rubricFor({ title: 'Other', points_possible: 40 });
  assert.equal(forty.each, 10); assert.deepEqual(forty.criteria[1].levels.map(level => level.points), [10, 8, 5.2, 2.4]);
  assert.equal(T.rubricTotal(forty, { purpose: 'exemplary', prompt: 'exemplary', verify: 'exemplary', reflect: 'exemplary' }).total, 40);
  assert.equal(T.rubricFor({ title: 'No points' }), null);
});

test('Ada drafts kind, specific feedback from the chosen levels using the student’s first name', () => {
  const rubric = T.rubricFor({ title: 'Responsible AI project brief', points_possible: 100 });
  const levels = { purpose: 'exemplary', prompt: 'proficient', verify: 'developing', reflect: 'exemplary' };
  const text = T.draftFeedback(rubric, levels, 'Jordan R.');
  assert.match(text, /^Jordan, this is solid work/);
  assert.match(text, /purpose and the audience very clear/);
  assert.match(text, /Next step: pick one claim/);
  assert.ok(text.indexOf('Next step') > text.indexOf('reflection is honest'), 'strengths come before next steps');
  assert.equal(T.draftFeedback(rubric, levels, 'Jordan R.'), text);
  assert.equal(T.draftFeedback(rubric, {}, 'Jordan R.'), '');
});

test('Ada answers "when is it due" from the published assignment dates, points, and attempts', () => {
  const dated = T.buildCorpus({ modules, assignments: [
    { ...assignments[0], max_attempts: 3, due_at: new Date(2026, 8, 25, 23, 59).toISOString(), closes_at: new Date(2026, 8, 26, 23, 59).toISOString() },
    { ...assignments[1], due_at: new Date(2026, 8, 20, 23, 59).toISOString() },
  ] });
  assert.equal(T.formatWhen(new Date(2026, 8, 25, 23, 59), new Date(2026, 0, 1)), 'Friday, Sep 25 at 11:59 PM');
  for (const question of ['whats the due date', 'When is the brief due?', 'how many attempts do I get']) {
    const answer = T.answerQuestion(question, dated);
    assert.equal(answer.kind, 'answer', question);
    assert.equal(answer.passages.length, 1, `${question}: only published work`);
    assert.equal(answer.passages[0].citation.id, 'brief');
    assert.match(answer.passages[0].text, /^Responsible AI project brief is due Friday, Sep 25 at 11:59 PM\. You can still turn it in until Saturday, Sep 26 at 11:59 PM\. After that, it closes\. It is worth 100 points, and you get 3 attempts\.$/, question);
    assert.doesNotMatch(JSON.stringify(answer), /SECRET/);
  }
  for (const question of ['Can I turn it in late?', "what's the late policy?", 'What if I miss the deadline?']) {
    const answer = T.answerQuestion(question, dated);
    assert.equal(answer.kind, 'answer', question);
    assert.equal(answer.lead, 'Here is what happens after the due date:');
    assert.equal(answer.passages.length, 1, question);
    assert.equal(answer.passages[0].text, 'If you miss the due date for Responsible AI project brief, you can still turn it in until Saturday, Sep 26 at 11:59 PM. It will show as late. After that, it closes and you can\'t turn it in. If you need more time, ask your instructor about an extension.', question);
    assert.doesNotMatch(answer.passages[0].text, /worth|attempts/, 'late answers do not repeat the full due-date answer');
  }
  assert.equal(T.answerQuestion('What time does the cafeteria open on Sunday?', dated).kind, 'none');
});

test('Ada leads grading questions with the rubric, not a policy sentence', () => {
  const policy = T.buildCorpus({ modules, assignments: [{ ...assignments[0], instructions: `${assignments[0].instructions} Coursework grades are separate from pathway completion.` }] });
  const answer = T.answerQuestion('How is my brief graded?', policy);
  assert.equal(answer.kind, 'answer');
  assert.match(answer.passages[0].text, /graded with a rubric\. It has four parts, worth 25 points each, for 100 points in all: Purpose & audience, Prompt clarity, Evidence of verification, and Reflection & limits\./);
  assert.match(answer.passages[0].citation.label, /^From the rubric · Responsible AI project brief$/);
  assert.deepEqual(answer.passages[1].items.map(item => [item.label, item.points]), [['Purpose & audience', 25], ['Prompt clarity', 25], ['Evidence of verification', 25], ['Reflection & limits', 25]]);
  assert.doesNotMatch(answer.passages[0].text + answer.passages[1].text, /separate from pathway/);
  assert.ok(answer.passages.slice(2).every(item => item.citation.kind === 'module'), 'any extra support comes from a lesson');
  assert.equal(T.answerQuestion('What is the rubric for the brief?', policy).lead, 'Here is how your work is graded:');
});

test('source chips show the full module title', () => {
  const answer = T.answerQuestion('How do I check if an AI answer is accurate?', corpus);
  assert.equal(answer.passages[0].citation.label, 'From Module 1 · Understand what AI can—and cannot—do');
});

test('the verification criterion connects to the module\'s "evaluation" wording', () => {
  const rubric = T.rubricFor({ title: 'Responsible AI project brief', points_possible: 100 });
  const verify = rubric.criteria.find(criterion => criterion.id === 'verify');
  assert.equal(verify.name, 'Evidence of verification');
  assert.match(verify.detail, /evaluation/i); assert.match(verify.detail, /what you checked and how/i);
  const html = T.renderRubric({ esc: value => String(value), attemptId: 'a1', levels: {} }, rubric);
  assert.match(html, /<span>Evidence of verification<\/span><span class="rubric-max">25 points<\/span><\/legend><p class="rubric-detail">Your evaluation — what you checked and how\.<\/p>/);
  assert.equal((html.match(/rubric-detail/g) || []).length, 1, 'only criteria with a descriptor show one');
});

/* Ada, the Hub's AI guide: course help and Ada-drafted rubric feedback.
 * Fully offline and deterministic: Ada only reads this section's own course modules and
 * published assignment instructions. No network calls, no generated facts. */

export const TUTOR_KEY_PREFIX = 'ht-hub-tutor-v1';
export const RUBRIC_KEY_PREFIX = 'ht-hub-rubric-v1';
export const TUTOR_MAX_TURNS = 20;
const MIN_SCORE = 1.2;
/** At least this share of the question's own words must appear in the material. */
const MIN_COVERAGE = 0.4;

const STOPWORDS = new Set(('a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing done down during each few for from further get gets go goes going got had has have having he her here hers him his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours out over own please same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself tell explain mean means need needs know want wants thing things something someone kind way ways really much many one lot use used using make makes making help ada time times include includes put').split(/\s+/));
/** Common subject words match almost everything, so they can support an answer but never carry one alone. */
const WEAK = new Set(['ai', 'tool', 'course', 'student', 'work', 'class', 'good', 'result']);
/** A very small, fixed set of equivalents so plain questions still find the course wording. */
const SYNONYMS = {
  accurate: ['accuracy', 'inaccurate', 'verify', 'fact'], correct: ['accurate', 'verify'], true: ['verify', 'accurate'], check: ['verify', 'evaluate'],
  fact: ['factual', 'claim', 'verify'], wrong: ['inaccurate', 'bias'], mistake: ['inaccurate'], source: ['sources', 'original'],
  cite: ['acknowledge', 'source'], credit: ['acknowledge'], private: ['confidential', 'password'], privacy: ['private', 'confidential'], safe: ['private', 'confidential', 'policy'],
  graded: ['reviewed', 'review'], grade: ['review', 'reviewed'], submit: ['submission'], hand: ['submit'], due: ['submit'],
  instruction: ['prompt'], ask: ['prompt'], question: ['prompt'], good: ['useful'], better: ['improve', 'useful'], limit: ['limitation'], limitation: ['limit'],
  reflect: ['reflection'], reflection: ['reflect'], brief: ['submission'], rule: ['policy'], allowed: ['policy', 'approved'],
};

/** Light stemming: plural s, -ies/-ied, -ing, -ed, doubled consonants, and a silent trailing e. */
export function stem(word) {
  let w = String(word || '').toLowerCase();
  if (w.length <= 3) return w;
  if (/ies$|ied$/.test(w) && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (/ing$/.test(w) && w.length > 5) w = w.slice(0, -3);
  else if (/ed$/.test(w) && w.length > 4) w = w.slice(0, -2);
  else if (/es$/.test(w) && /(ch|sh|x|ss|z)es$/.test(w)) w = w.slice(0, -2);
  else if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

/** Lowercase, strip punctuation, drop stopwords, stem. Order is kept; duplicates are allowed. */
export function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[’']s\b/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(word => word && !STOPWORDS.has(word) && !/^\d+$/.test(word)).map(stem).filter(word => word.length > 1);
}

function queryTerms(question) {
  const base = [...new Set(tokenize(question))];
  const expanded = new Map(base.map(term => [term, { weight: 1, origin: term }]));
  for (const word of String(question || '').toLowerCase().replace(/[^a-z]+/g, ' ').split(' ')) {
    if (STOPWORDS.has(word)) continue;
    for (const extra of SYNONYMS[word] || SYNONYMS[stem(word)] || []) { const term = stem(extra); if (!expanded.has(term)) expanded.set(term, { weight: 0.6, origin: stem(word) }); }
  }
  return { terms: expanded, base };
}

/** Split text into sentences without breaking inside a quotation. */
export function sentences(text) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?”"])\s+(?=[A-Z“"(0-9])/);
  const out = [];
  let open = '';
  for (const part of parts) {
    const piece = open ? `${open} ${part}` : part;
    const opens = (piece.match(/“/g) || []).length, closes = (piece.match(/”/g) || []).length;
    if (opens > closes) { open = piece; continue; }
    open = ''; if (piece.trim()) out.push(piece.trim());
  }
  if (open.trim()) out.push(open.trim());
  return out;
}

/** "Friday, Sep 25 at 11:59 PM" in the reader's own time zone. The year shows only when it is not this year. */
export function formatWhen(value, now = new Date()) {
  const d = new Date(value);
  if (!value || !Number.isFinite(d.getTime())) return '';
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`.replace(/\s+/g, ' ');
}

/**
 * Build Ada's library from one section: the connected course's modules (title, body, and the
 * module's own assignment prompt) and the section's PUBLISHED assignment instructions only.
 */
export function buildCorpus({ modules = [], assignments = [] } = {}) {
  const passages = [];
  const add = (text, source, paragraph) => sentences(text).forEach((sentence, index) => passages.push({ text: sentence, source, paragraph, index, tokens: new Set(tokenize(sentence)) }));
  modules.slice().sort((a, b) => Number(a.position) - Number(b.position)).forEach((module, position) => {
    const source = { kind: 'module', id: module.id, number: position + 1, title: String(module.title || `Module ${position + 1}`), titleTokens: new Set(tokenize(module.title)) };
    String(module.body || '').split(/\n\s*\n/).filter(Boolean).forEach((paragraph, p) => add(paragraph, source, p));
    if (module.assignment_prompt) add(module.assignment_prompt, source, 'prompt');
  });
  const published = assignments.filter(item => item.status === 'published');
  published.forEach(assignment => {
    const source = { kind: 'assignment', id: assignment.id, title: String(assignment.title || 'Assignment'), titleTokens: new Set(tokenize(assignment.title)) };
    String(assignment.instructions || '').split(/\n\s*\n/).filter(Boolean).forEach((paragraph, p) => add(paragraph, source, p));
  });
  // Dates, points, attempts, and the rubric are kept apart from the ranked sentences: they answer
  // "when is it due?" and "how is it graded?" directly instead of competing on keywords.
  const facts = published.map(assignment => ({
    id: assignment.id, title: String(assignment.title || 'Assignment'), titleTokens: new Set(tokenize(assignment.title)),
    due_at: assignment.due_at || null, closes_at: assignment.closes_at || null, points: Number(assignment.points_possible) || 0,
    attempts: Number(assignment.max_attempts) || 0, personal: !!assignment.personal_extension, rubric: rubricFor(assignment),
  }));
  const df = new Map();
  for (const passage of passages) for (const term of new Set([...passage.tokens, ...passage.source.titleTokens])) df.set(term, (df.get(term) || 0) + 1);
  return { passages, df, size: passages.length, facts };
}

function idf(corpus, term) { return Math.log((corpus.size + 1) / ((corpus.df.get(term) || 0) + 0.5)); }

/** Score every passage by keyword overlap with the question. Title matches count at half weight. */
export function rankPassages(question, corpus) {
  const { terms, base } = queryTerms(question);
  if (!terms.size || !corpus?.size) return [];
  const ranked = corpus.passages.map(passage => {
    let score = 0, strong = 0;
    const matched = [], covered = new Set();
    for (const [term, { weight, origin }] of terms) {
      const inText = passage.tokens.has(term), inTitle = passage.source.titleTokens.has(term);
      if (!inText && !inTitle) continue;
      score += idf(corpus, term) * weight * (inText ? 1 : 0.5);
      matched.push(term); covered.add(origin);
      if (!WEAK.has(origin) && inText) strong++;
    }
    return { passage, score, strong, matched, coverage: base.length ? covered.size / base.length : 0 };
  }).filter(item => item.score > 0 && item.strong > 0);
  return ranked.sort((a, b) => b.score - a.score || a.passage.text.length - b.passage.text.length);
}

const citationFor = source => source.kind === 'module'
  ? { kind: 'module', id: source.id, number: source.number, title: source.title, label: `From Module ${source.number} · ${source.title}` }
  : { kind: 'assignment', id: source.id, title: source.title, label: `From the assignment · ${source.title}` };

/** The guard is for requests that hand the work to Ada, not for questions about how to do it. */
export function isIntegrityRequest(question) {
  const q = String(question || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  if (!q) return false;
  const work = '(assignment|homework|brief|essay|paper|quiz|test|exam|project|submission|reflection|response|answers?|knowledge check|prompt|paragraph)';
  const verbs = '(write|do|complete|finish|answer|draft|make|create|generate|fill out|fill in|solve|redo|rewrite)';
  if (new RegExp(`\\b${verbs}\\b[^.?!]{0,60}\\bfor me\\b`).test(q)) return true;
  if (new RegExp(`\\b(give|tell|send|show) me (the |all the )?answers?\\b`).test(q)) return true;
  if (new RegExp(`\\banswer (the|this|my|these) (quiz|questions?|knowledge check|test|exam)\\b`).test(q)) return true;
  if (new RegExp(`\\bdo my (assignment|homework|work|brief|project|quiz)\\b`).test(q)) return true;
  const asksHow = /^(how|what|where|when|why|which|who)\b|^(can|could|should|do|may) i\b|^is it\b/.test(q);
  if (new RegExp(`\\b(can|could|will|would) you (please |just )?${verbs}\\b[^.?!]{0,40}\\b(my|the|this|a|an|me)\\b[^.?!]{0,40}\\b${work}`).test(q)) return true;
  if (new RegExp(`^(please |ada,? |hey ada,? )*${verbs} (me )?(my|the|this|a|an)\\b[^.?!]{0,40}\\b${work}`).test(q)) return true;
  if (!asksHow && new RegExp(`\\bwrite my\\b`).test(q)) return true;
  return false;
}

/* ---------- Plain logistics: due dates and grading ---------- */
const DUE_INTENT = /\b(due|deadlines?|late|how long do i have|when (is|are|do|does|should|can|must)\b.*\b(submit|turn(ed)? in|hand(ed)? in|clos(e|es|ed)|finish|send))\b/;
const DETAIL_INTENT = /\b(how many (points|attempts|tries|chances)|worth|points possible|attempts?|tries|resubmit|submit again)\b/;
const GRADING_INTENT = /\b(grad(e|ed|es|ing)|scor(e|ed|es|ing)|rubric|marked|points? (for|on))\b/;
const plural = (count, word) => `${count.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${word}${count === 1 ? '' : 's'}`;
const intentText = question => String(question || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ');
const LATE_INTENT = /\b(late|lateness|after the (due date|deadline)|miss(ed)? the (due date|deadline)|past the (due date|deadline)|extensions?|more time)\b/;
export function questionIntent(question) {
  const q = intentText(question);
  if (LATE_INTENT.test(q)) return 'late';
  if (GRADING_INTENT.test(q) && !/\bdue\b/.test(q)) return 'grading';
  if (DUE_INTENT.test(q) || DETAIL_INTENT.test(q)) return 'due';
  return '';
}
/** The assignment(s) a question names; every published one when it names none. */
function assignmentsAsked(question, facts) {
  const words = new Set(tokenize(question).filter(word => !WEAK.has(word)));
  const scored = facts.map(item => ({ item, hits: [...item.titleTokens].filter(token => words.has(token)).length })).filter(entry => entry.hits > 0);
  if (scored.length) { const best = Math.max(...scored.map(entry => entry.hits)); return scored.filter(entry => entry.hits === best).map(entry => entry.item); }
  return facts;
}
const byDue = (a, b) => (Date.parse(a.due_at) || Infinity) - (Date.parse(b.due_at) || Infinity) || a.title.localeCompare(b.title);
const assignmentCitation = (item, prefix = 'From the assignment') => ({ kind: 'assignment', id: item.id, title: item.title, label: `${prefix} · ${item.title}` });
function dueAnswer(question, corpus) {
  const chosen = assignmentsAsked(question, corpus?.facts || []).slice().sort(byDue).slice(0, 3);
  if (!chosen.length) return null;
  return { kind: 'answer', lead: chosen.length === 1 ? 'Here is what your assignment says:' : 'Here is what your assignments say:', passages: chosen.map(item => {
    const due = formatWhen(item.due_at), closes = formatWhen(item.closes_at);
    const parts = [due ? `${item.title} is due ${due}.` : `${item.title} has no due date yet.`];
    if (closes && item.closes_at !== item.due_at) parts.push(`You can still turn it in until ${closes}. After that, it closes.`);
    if (item.personal) parts.push('These dates include your personal extension.');
    const facts = [item.points ? `It is worth ${plural(item.points, 'point')}` : '', item.attempts ? `you get ${plural(item.attempts, 'attempt')}` : ''].filter(Boolean);
    if (facts.length) parts.push(`${facts.join(', and ')}.`);
    return { text: parts.join(' '), citation: assignmentCitation(item) };
  }) };
}
/** Late questions get the close date and what happens after the due date, not the whole due-date answer. */
function lateAnswer(question, corpus) {
  const chosen = assignmentsAsked(question, corpus?.facts || []).slice().sort(byDue).slice(0, 3);
  if (!chosen.length) return null;
  return { kind: 'answer', lead: 'Here is what happens after the due date:', passages: chosen.map(item => {
    const due = formatWhen(item.due_at), closes = formatWhen(item.closes_at);
    const parts = [];
    if (!due && !closes) parts.push(`${item.title} has no due date or closing date yet, so it can't be late.`);
    else if (!due) parts.push(`${item.title} has no due date, but it closes ${closes}. After that, you can't turn it in.`);
    else if (!closes) parts.push(`${item.title} is due ${due}. It has no closing date, so you can still turn it in after that. It will show as late.`);
    else if (Date.parse(item.closes_at) <= Date.parse(item.due_at)) parts.push(`${item.title} closes when it is due, ${due}. After that, you can't turn it in.`);
    else parts.push(`If you miss the due date for ${item.title}, you can still turn it in until ${closes}. It will show as late. After that, it closes and you can't turn it in.`);
    if (item.personal) parts.push('These dates include your personal extension.');
    else parts.push('If you need more time, ask your instructor about an extension.');
    return { text: parts.join(' '), citation: assignmentCitation(item) };
  }) };
}
function gradingAnswer(question, corpus) {
  const asked = assignmentsAsked(question, corpus?.facts || []).filter(item => item.rubric).sort(byDue);
  const item = asked[0];
  if (!item) return null;
  const { rubric } = item, names = rubric.criteria.map(criterion => criterion.name);
  const list = `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  const passages = [
    { text: `${item.title} is graded with a rubric. It has ${['zero', 'one', 'two', 'three', 'four', 'five', 'six'][rubric.criteria.length] || rubric.criteria.length} parts, worth ${plural(rubric.each, 'point')} each, for ${plural(rubric.possible, 'point')} in all: ${list}.`, citation: assignmentCitation(item, 'From the rubric') },
    { text: 'To earn full points on each part:', items: rubric.criteria.map(criterion => ({ label: criterion.name, points: rubric.each, text: criterion.levels.find(level => level.id === 'exemplary')?.text || '' })), citation: assignmentCitation(item, 'From the rubric') },
  ];
  // One supporting line from the lessons, when a lesson talks about how work is reviewed.
  const lesson = rankPassages(`${question} reviewed feedback`, corpus).find(entry => entry.passage.source.kind === 'module');
  if (lesson && lesson.score >= MIN_SCORE) passages.push({ text: lesson.passage.text, citation: citationFor(lesson.passage.source) });
  return { kind: 'answer', lead: 'Here is how your work is graded:', passages };
}

/**
 * Ada's answer. kind: 'answer' (1–3 cited passages), 'none' (not in the materials),
 * 'integrity' (declines to do the work; points to the right module), or 'empty'.
 */
export function answerQuestion(question, corpus) {
  const text = String(question || '').trim();
  if (!text) return { kind: 'empty', passages: [] };
  if (isIntegrityRequest(text)) {
    const topic = text.replace(/\b(please|can|could|will|would|you|write|do|complete|finish|answer|draft|make|create|generate|for me|me|my|the|this|assignment|homework|brief|essay|paper|quiz|test|exam|project|submission|work)\b/gi, ' ');
    const modules = corpus?.passages?.filter(passage => passage.source.kind === 'module') || [];
    const topicModule = rankPassages(topic, corpus).find(item => item.passage.source.kind === 'module');
    const assignmentModule = modules.find(passage => passage.paragraph === 'prompt');
    const source = topicModule?.passage.source || assignmentModule?.source || modules[0]?.source;
    return { kind: 'integrity', passages: [], pointer: source ? citationFor(source) : null };
  }
  const intent = questionIntent(text);
  const direct = intent === 'grading' ? gradingAnswer(text, corpus) : intent === 'due' ? dueAnswer(text, corpus) : intent === 'late' ? lateAnswer(text, corpus) : null;
  if (direct) return direct;
  const ranked = rankPassages(text, corpus);
  if (!ranked.length || ranked[0].score < MIN_SCORE || ranked[0].coverage < MIN_COVERAGE) return { kind: 'none', passages: [] };
  const top = ranked[0].score, chosen = [], seen = new Set();
  for (const item of ranked) {
    if (chosen.length >= 3 || item.score < top * 0.5) break;
    if (item.coverage < MIN_COVERAGE) continue;
    const key = `${item.passage.source.id}:${item.passage.paragraph}:${item.passage.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let passageText = item.passage.text;
    // A very short sentence reads better with the sentence that follows it in the same paragraph.
    if (passageText.length < 90) {
      const next = corpus.passages.find(other => other.source === item.passage.source && other.paragraph === item.passage.paragraph && other.index === item.passage.index + 1);
      if (next) { passageText += ` ${next.text}`; seen.add(`${next.source.id}:${next.paragraph}:${next.index}`); }
    }
    chosen.push({ text: passageText, citation: citationFor(item.passage.source) });
  }
  return { kind: 'answer', passages: chosen };
}

const CANDIDATE_QUESTIONS = ['How do I check if an AI answer is accurate?', 'What makes a clear prompt?', 'What goes in the project brief?', 'What should I keep out of AI tools?', 'How will my work be reviewed?', 'What should my reflection include?'];
/** Three starter questions that this section's materials can actually answer. */
export function suggestedQuestions(corpus) {
  return CANDIDATE_QUESTIONS.filter(question => answerQuestion(question, corpus).kind === 'answer').slice(0, 3);
}

/* ---------- Conversation storage (per user + section, browser only) ---------- */
export const tutorKey = (userId, cohortId) => `${TUTOR_KEY_PREFIX}:${userId}:${cohortId}`;
function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
export function loadTurns(userId, cohortId) {
  try { const value = JSON.parse(storage()?.getItem(tutorKey(userId, cohortId)) || '[]'); return Array.isArray(value) ? value.filter(turn => turn && typeof turn.q === 'string' && turn.a && typeof turn.a.kind === 'string').slice(-TUTOR_MAX_TURNS) : []; } catch { return []; }
}
export function saveTurns(userId, cohortId, turns) {
  try { const store = storage(); if (!store) return false; store.setItem(tutorKey(userId, cohortId), JSON.stringify(turns.slice(-TUTOR_MAX_TURNS))); return true; } catch { return false; }
}
export function clearTurns(userId, cohortId) { try { storage()?.removeItem(tutorKey(userId, cohortId)); } catch { /* storage unavailable */ } }

/* ---------- Tutor rendering ---------- */
function citationHref(h, citation) {
  return citation.kind === 'module' ? h.href('courses', { cohort: h.cohortId, tab: 'modules' }) + `#module-${citation.number}` : h.href('courses', { cohort: h.cohortId, tab: 'assignments', assignment: citation.id });
}
function chip(h, citation) {
  return `<a class="tutor-cite" href="${h.esc(citationHref(h, citation))}" data-academic-nav title="${h.esc(citation.kind === 'module' ? `Module ${citation.number} · ${citation.title}` : citation.title)}">${h.esc(citation.label)}</a>`;
}
function answerHtml(h, answer) {
  if (answer.kind === 'integrity') {
    return `<p>That part is yours to write. It is how you learn it, and your instructor wants to hear your thinking. I can explain the ideas behind it instead. Try asking me what a part of the assignment means.</p>${answer.pointer ? `<p>A good place to start:</p><p>${chip(h, answer.pointer)}</p>` : ''}`;
  }
  if (answer.kind === 'none') {
    const ask = h.instructorId && h.instructorId !== h.userId ? `<a href="${h.esc(h.href('people', { person: h.instructorId }))}">ask ${h.esc(h.instructorName)}</a>` : `ask ${h.esc(h.instructorName)}`;
    return `<p>I couldn't find that in this course's materials. Try rephrasing, or ${ask}${/[.!?]$/.test(String(h.instructorName || '')) ? '' : '.'}</p>`;
  }
  const fmt = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const items = item => Array.isArray(item.items) && item.items.length ? `<ul class="tutor-list">${item.items.map(entry => `<li><span class="tutor-list-head"><strong>${h.esc(entry.label)}</strong>${Number.isFinite(Number(entry.points)) ? `<span class="tutor-num">${fmt(entry.points)} pts</span>` : ''}</span>${entry.text ? `<span>${h.esc(entry.text)}</span>` : ''}</li>`).join('')}</ul>` : '';
  return `<p class="tutor-lead">${h.esc(answer.lead || 'Here is what your course materials say:')}</p>${answer.passages.map(item => `<div class="tutor-passage"><p>${h.esc(item.text)}</p>${items(item)}${chip(h, item.citation)}</div>`).join('')}`;
}
const turnHtml = (h, turn) => `<div class="tutor-turn"><p class="tutor-q"><span class="campus-sr-only">You asked: </span>${h.esc(turn.q)}</p><div class="tutor-a"><span class="campus-sr-only">Ada: </span>${answerHtml(h, turn.a)}</div></div>`;
export function renderTurns(h, turns) {
  if (!turns.length) return `<p class="tutor-empty">Ask about anything in this course. I'll show you where the answer comes from.</p>`;
  return turns.map(turn => turnHtml(h, turn)).join('');
}

/**
 * Bring the newest turn into view, like any chat: the log scrolls so the newest question sits at
 * its top (short answers simply land at the bottom). On phones the log grows with the page, so the
 * page scrolls instead when the newest question is above the screen.
 */
export function showNewest(log, { page = false } = {}) {
  const last = log?.lastElementChild;
  if (!last) return;
  if (log.scrollHeight > log.clientHeight + 1) {
    const offset = last.getBoundingClientRect().top - log.getBoundingClientRect().top;
    log.scrollTop = Math.max(0, log.scrollTop + offset - 4);
    return;
  }
  if (!page) return;
  const top = last.getBoundingClientRect().top, view = globalThis.innerHeight || 0;
  if (top < 72 || top > view * 0.45) globalThis.scrollBy?.({ top: top - 88, behavior: 'auto' });
}

/** h: { esc, href, cohortId, userId, instructorId, instructorName, preview, suggestions } */
export function renderTutorPanel(h) {
  const turns = loadTurns(h.userId, h.cohortId);
  const id = `tutor-q-${String(h.cohortId).replace(/[^A-Za-z0-9_-]/g, '')}`;
  return `<section class="campus-panel tutor-panel" id="ada" data-tutor data-cohort-id="${h.esc(h.cohortId)}" aria-labelledby="${id}-title">
<div class="tutor-head"><img class="tutor-face" src="/ht/img/ada-face.jpg" alt="" width="44" height="44" loading="lazy" decoding="async"><div>${h.preview ? '<p class="campus-eyebrow">Student view preview</p>' : '<p class="campus-eyebrow">Your AI guide for this course</p>'}<h3 id="${id}-title">Ask Ada</h3><p class="campus-muted">${h.preview ? 'This is what your students see. Ada answers from this section’s materials.' : 'I answer from this course’s lessons and assignments.'}</p></div></div>
<div class="tutor-log" data-tutor-log role="log" aria-live="polite" aria-relevant="additions text">${renderTurns(h, turns)}</div>
${h.suggestions.length ? `<div class="tutor-suggest" aria-label="Suggested questions" role="group">${h.suggestions.map(q => `<button type="button" class="tutor-chip" data-tutor-suggest="${h.esc(q)}">${h.esc(q)}</button>`).join('')}</div>` : ''}
<form class="tutor-form" data-tutor-form><label class="campus-sr-only" for="${id}">Ask Ada a question about this course</label><input id="${id}" name="question" type="text" maxlength="300" autocomplete="off" placeholder="Ask about this course…" enterkeyhint="send"><button class="campus-button" type="submit">Ask</button></form>
<div class="tutor-foot"><p class="campus-muted">Ada answers from this course’s materials only. She won’t write your assignment. Check anything important with your instructor.</p><button type="button" class="tutor-clear" data-tutor-clear${turns.length ? '' : ' hidden'}>Clear conversation</button></div>
</section>`;
}

/** getContext() returns the same h object used to render, plus corpus. */
export function bindTutor(root, getContext, onDraftSettled = () => {}) {
  const panelFor = target => target?.closest?.('[data-tutor]');
  const ask = (panel, question) => {
    const h = getContext(panel.dataset.cohortId);
    if (!h) return;
    const text = String(question || '').trim().slice(0, 300);
    const input = panel.querySelector('input[name="question"]');
    if (!text) { input?.focus(); return; }
    const turns = loadTurns(h.userId, h.cohortId), turn = { q: text, a: answerQuestion(text, h.corpus), at: new Date().toISOString() };
    turns.push(turn);
    saveTurns(h.userId, h.cohortId, turns);
    const log = panel.querySelector('[data-tutor-log]');
    if (log) {
      // Append only the new turn so screen readers announce just the new answer.
      log.querySelector('.tutor-empty')?.remove();
      log.insertAdjacentHTML('beforeend', turnHtml(h, turn));
      while (log.children.length > TUTOR_MAX_TURNS) log.firstElementChild.remove();
      showNewest(log, { page: true });
    }
    const clear = panel.querySelector('[data-tutor-clear]'); if (clear) clear.hidden = false;
    if (input) { input.value = ''; input.focus({ preventScroll: true }); }
    onDraftSettled(panel.querySelector('form[data-tutor-form]'));
  };
  const submit = event => {
    const form = event.target.closest?.('form[data-tutor-form]');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    ask(panelFor(form), form.elements.question.value);
  };
  const click = event => {
    const suggest = event.target.closest?.('[data-tutor-suggest]');
    if (suggest && root.contains(suggest)) { event.preventDefault(); ask(panelFor(suggest), suggest.dataset.tutorSuggest); return; }
    const clear = event.target.closest?.('[data-tutor-clear]');
    if (clear && root.contains(clear)) {
      event.preventDefault();
      const panel = panelFor(clear), h = getContext(panel.dataset.cohortId);
      if (!h) return;
      clearTurns(h.userId, h.cohortId);
      const log = panel.querySelector('[data-tutor-log]'); if (log) log.innerHTML = renderTurns(h, []);
      clear.hidden = true; panel.querySelector('input[name="question"]')?.focus({ preventScroll: true });
    }
  };
  root.addEventListener('submit', submit); root.addEventListener('click', click);
  // Open on the newest turn, like any chat, and again once fonts and images settle the layout.
  const settle = () => root.querySelectorAll?.('[data-tutor-log]').forEach(log => showNewest(log));
  settle();
  globalThis.requestAnimationFrame?.(settle);
  globalThis.document?.fonts?.ready?.then(settle).catch?.(() => {});
  globalThis.addEventListener?.('load', settle, { once: true });
  return () => { root.removeEventListener('submit', submit); root.removeEventListener('click', click); globalThis.removeEventListener?.('load', settle); };
}

/* ---------- Rubric ---------- */
export const RUBRIC_LEVELS = [
  { id: 'exemplary', name: 'Exemplary', ratio: 1 },
  { id: 'proficient', name: 'Proficient', ratio: 0.8 },
  { id: 'developing', name: 'Developing', ratio: 0.52 },
  { id: 'beginning', name: 'Beginning', ratio: 0.24 },
];
export const RUBRIC_CRITERIA = [
  { id: 'purpose', name: 'Purpose & audience', levels: { exemplary: 'Clear purpose. Names exactly who it helps and why.', proficient: 'Purpose is clear. Audience is named but general.', developing: 'Purpose or audience is unclear or missing a detail.', beginning: 'Purpose and audience are not stated yet.' } },
  { id: 'prompt', name: 'Prompt clarity', levels: { exemplary: 'Prompt names task, audience, context, and a good result.', proficient: 'Prompt is clear but misses one part.', developing: 'Prompt is vague or missing key limits.', beginning: 'No usable prompt yet.' } },
  { id: 'verify', name: 'Evidence of verification', levels: { exemplary: 'Shows what was checked and the source used.', proficient: 'Names a result to check; the source is thin.', developing: 'Mentions checking without a source or steps.', beginning: 'No sign the result was checked.' } },
  { id: 'reflect', name: 'Reflection & limits', levels: { exemplary: 'Honest reflection. A real limit and how it was handled.', proficient: 'Names a limit; says little about the fix.', developing: 'Reflection is brief or general.', beginning: 'No reflection or limitation yet.' } },
];
const round = value => Math.round(value * 100) / 100;
export const SAMPLE_RUBRIC_TITLE = 'Responsible AI project brief';

/** The sample brief uses 25/20/13/6 per criterion. Other assignments split points evenly. */
export function rubricFor(assignment) {
  const possible = Number(assignment?.points_possible);
  if (!Number.isFinite(possible) || possible <= 0) return null;
  const sample = String(assignment.title || '').trim().toLowerCase() === SAMPLE_RUBRIC_TITLE.toLowerCase() && possible === 100;
  const each = sample ? 25 : round(possible / 4);
  return {
    possible, each,
    criteria: RUBRIC_CRITERIA.map(criterion => ({ ...criterion, levels: RUBRIC_LEVELS.map(level => ({ id: level.id, name: level.name, text: criterion.levels[level.id], points: sample ? { exemplary: 25, proficient: 20, developing: 13, beginning: 6 }[level.id] : round(each * level.ratio) })) })),
  };
}
export function rubricTotal(rubric, levels = {}) {
  let total = 0, picked = 0;
  for (const criterion of rubric?.criteria || []) { const level = criterion.levels.find(item => item.id === levels[criterion.id]); if (level) { total += level.points; picked++; } }
  return { total: Math.min(round(total), rubric?.possible ?? 0), picked, complete: !!rubric && picked === rubric.criteria.length };
}

export const rubricKey = attemptId => `${RUBRIC_KEY_PREFIX}:${attemptId}`;
export function loadRubric(attemptId) {
  if (!attemptId) return null;
  try { const value = JSON.parse(storage()?.getItem(rubricKey(attemptId)) || 'null'); return value && typeof value === 'object' ? { levels: value.levels && typeof value.levels === 'object' ? value.levels : {}, published: value.published && typeof value.published === 'object' ? value.published : null } : null; } catch { return null; }
}
export function saveRubric(attemptId, record) {
  if (!attemptId) return false;
  try { const store = storage(); if (!store) return false; store.setItem(rubricKey(attemptId), JSON.stringify({ levels: record.levels || {}, published: record.published || null })); return true; } catch { return false; }
}

const FEEDBACK = {
  purpose: {
    exemplary: 'You made the purpose and the audience very clear, so a reader knows right away who this project helps and why.',
    proficient: 'Your purpose is clear. Naming your audience a little more exactly would make it even stronger.',
    developing: 'Next step: say in one sentence who this project is for and what problem it solves for them.',
    beginning: 'Next step: start by naming the task and the people it will help. Module 3 has examples to follow.',
  },
  prompt: {
    exemplary: 'Your prompt is specific. It names the task, the audience, the context, and what a good result looks like.',
    proficient: 'Your prompt gives the task and context well. Adding what the result must include would sharpen it.',
    developing: 'Next step: rewrite your prompt so it states the task, the audience, and the output you want. Module 2 shows how.',
    beginning: 'Next step: add the prompt you would actually use, with a clear task and limits. Module 2 has a model prompt.',
  },
  verify: {
    exemplary: 'You showed exactly what you checked and the source you used. That is the heart of using AI responsibly.',
    proficient: 'You named a result to verify. Say which source you checked it against so a reader can follow your steps.',
    developing: 'Next step: pick one claim from the result and explain how you would check it with a reliable original source.',
    beginning: 'Next step: include one result you would verify and the source you would use to check it.',
  },
  reflect: {
    exemplary: 'Your reflection is honest and thoughtful, and you explained a real limit of the tool and how you handled it.',
    proficient: 'Your reflection names a limit. Add one sentence about what you did about it.',
    developing: 'Next step: describe one thing the AI tool could not do well here and how you worked around it.',
    beginning: 'Next step: add a short reflection with one limitation and how you would explain it to your audience.',
  },
};

/** A kind, specific paragraph from the chosen levels. Strengths come first, then next steps. */
export function draftFeedback(rubric, levels, studentName) {
  if (!rubric) return '';
  const first = String(studentName || '').trim().split(/\s+/)[0] || 'Hi';
  const chosen = rubric.criteria.filter(criterion => levels?.[criterion.id] && FEEDBACK[criterion.id]?.[levels[criterion.id]]);
  if (!chosen.length) return '';
  const { total } = rubricTotal(rubric, levels), ratio = total / rubric.possible;
  const complete = chosen.length === rubric.criteria.length;
  const opening = !complete ? `${first}, here are my notes so far.` : ratio >= 0.9 ? `${first}, this is strong work.` : ratio >= 0.7 ? `${first}, this is solid work with a clear direction.` : ratio >= 0.45 ? `${first}, you have a good start here.` : `${first}, thank you for turning this in. Let's build on it together.`;
  const strong = chosen.filter(criterion => ['exemplary', 'proficient'].includes(levels[criterion.id]));
  const grow = chosen.filter(criterion => !['exemplary', 'proficient'].includes(levels[criterion.id]));
  const lines = [...strong, ...grow].map(criterion => FEEDBACK[criterion.id][levels[criterion.id]]);
  const closing = grow.length ? 'Make these changes and send a new attempt if you have one left. I am glad to talk it through.' : 'Keep bringing this same care to your next project.';
  return [opening, ...lines, closing].join(' ');
}

/** h: { esc, attemptId, levels } */
export function renderRubric(h, rubric) {
  if (!rubric) return '';
  const levels = h.levels || {}, { total, picked } = rubricTotal(rubric, levels), fmt = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `<fieldset class="rubric" data-rubric data-attempt-id="${h.esc(h.attemptId)}"><legend class="rubric-legend">Rubric · ${fmt(rubric.possible)} points</legend><p class="campus-muted">Pick a level for each part. The score fills in for you, and you can still change it.</p>${rubric.criteria.map(criterion => `<fieldset class="rubric-criterion"><legend><span>${h.esc(criterion.name)}</span><span class="rubric-max">${fmt(rubric.each)} points</span></legend><div class="rubric-levels">${criterion.levels.map(level => `<label class="rubric-level"><input type="radio" name="rubric_${criterion.id}" value="${level.id}" data-rubric-criterion="${criterion.id}" data-points="${level.points}"${levels[criterion.id] === level.id ? ' checked' : ''}><span class="rubric-level-top"><span class="rubric-level-name">${level.name}</span><span class="rubric-level-points">${fmt(level.points)}</span></span><span class="rubric-level-text">${h.esc(level.text)}</span></label>`).join('')}</div></fieldset>`).join('')}<div class="rubric-total"><span>Rubric total</span><output data-rubric-total aria-live="polite">${picked ? `${fmt(total)} / ${fmt(rubric.possible)}` : `— / ${fmt(rubric.possible)}`}</output></div></fieldset>`;
}
export function renderDraftButton() {
  return `<div class="rubric-draft"><button type="button" class="campus-button campus-button-secondary campus-button-small" data-rubric-draft><img class="rubric-draft-face" src="/ht/img/ada-face.jpg" alt="" width="20" height="20" loading="lazy" decoding="async">Draft feedback with Ada</button><p class="campus-muted">Ada drafts, you decide. Nothing is sent until you publish.</p><p class="rubric-draft-status" data-rubric-status role="status"></p></div>`;
}

/** Student-facing breakdown for a published grade. */
export function renderRubricResult(h, rubric, published) {
  if (!rubric || !published?.levels) return '';
  const rows = rubric.criteria.map(criterion => ({ criterion, level: criterion.levels.find(level => level.id === published.levels[criterion.id]) })).filter(row => row.level);
  if (!rows.length) return '';
  const fmt = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `<div class="rubric-result"><p class="campus-eyebrow">How your work was scored</p><ul>${rows.map(({ criterion, level }) => `<li><span class="rubric-result-name">${h.esc(criterion.name)}</span><span class="rubric-result-level">${h.esc(level.name)} · ${fmt(level.points)} / ${fmt(rubric.each)}</span></li>`).join('')}</ul></div>`;
}

export function readLevels(form) {
  const levels = {};
  form?.querySelectorAll?.('input[type="radio"][data-rubric-criterion]:checked').forEach(input => { levels[input.dataset.rubricCriterion] = input.value; });
  return levels;
}

/** Faculty Today: the teaching day for an instructor (staff or admin role).
 *  One clear job up top (grade what came in, reach the students who were flagged), then the
 *  sections they teach, today's classes, requests waiting on a reply, and a note about Ada.
 *  Grading comes from the campus store; the early-alert numbers come from the same saved
 *  sample the Student success page uses, so the two pages always agree. The app renders the h1. */
const assetStamp = new URL(import.meta.url).search;
const [{ caseloadSummary }, { classSessionHref }] = await Promise.all([
  import('./campus-success.js' + assetStamp),
  import('./campus-classrooms.js' + assetStamp)
]);

const list = (value) => (Array.isArray(value) ? value : []);
const ms = (value) => { const t = new Date(value).getTime(); return Number.isFinite(t) ? t : NaN; };
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'this student';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const me = (ctx) => ctx.state?.user?.id || ctx.state?.member?.user_id || null;
/* Small counts read as words in the serif headline (Georgia's numerals are old-style). Above
   twenty the digits stay, set in Inter so they line up. */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const countWords = (n) => (Number.isInteger(n) && n >= 0 && n <= 20 ? WORDS[n] : `<span class="faculty-num">${Number(n)}</span>`);
const memberName = (ctx, id) => list(ctx.state.members).find((m) => m.user_id === id)?.display_name || 'A student';

function sameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
function sinceWords(value) {
  const minutes = Math.max(0, Math.round((Date.now() - ms(value)) / 60000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
function untilWords(value) {
  const minutes = Math.round((ms(value) - Date.now()) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes <= 0) return 'starting now';
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'in about an hour' : `in about ${hours} hours`;
}

/* ---------- data ---------- */
function mySections(ctx) {
  const id = me(ctx);
  return list(ctx.state.cohorts).filter((c) => c.instructor_id === id && c.status === 'active');
}
/** Latest attempt per student per assignment that has no draft or published grade yet. */
export function gradingQueue(state, cohortIds) {
  const ids = new Set(cohortIds);
  const assignments = list(state.assignments).filter((a) => ids.has(a.cohort_id));
  const queue = [];
  for (const a of assignments) {
    const latest = new Map();
    for (const attempt of list(state.assignment_attempts).filter((x) => x.assignment_id === a.id)) {
      const prev = latest.get(attempt.user_id);
      if (!prev || attempt.attempt_no > prev.attempt_no) latest.set(attempt.user_id, attempt);
    }
    for (const attempt of latest.values()) {
      const graded = list(state.assignment_grades).some((g) => g.assignment_id === a.id && g.user_id === attempt.user_id && ['draft', 'published'].includes(g.status)
        && (g.attempt_id ? g.attempt_id === attempt.id : ms(g.created_at) >= ms(attempt.submitted_at)));
      if (!graded) queue.push({ assignment: a, attempt });
    }
  }
  return queue.sort((x, y) => ms(x.attempt.submitted_at) - ms(y.attempt.submitted_at));
}
function sectionFacts(ctx, cohort) {
  const now = Date.now();
  const roster = list(ctx.state.cohort_members).filter((m) => m.cohort_id === cohort.id && m.active !== false).length;
  const open = list(ctx.state.assignments).filter((a) => a.cohort_id === cohort.id && a.status === 'published' && (!a.closes_at || ms(a.closes_at) > now)).length;
  const next = list(ctx.state.class_sessions)
    .filter((s) => s.cohort_id === cohort.id && s.status === 'scheduled' && ms(s.ends_at || s.starts_at) >= now)
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at))[0] || null;
  return { roster, open, next };
}
function todaysClasses(ctx, cohortIds) {
  const ids = new Set(cohortIds), now = Date.now();
  const mine = list(ctx.state.class_sessions).filter((s) => ids.has(s.cohort_id) && s.status === 'scheduled').sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
  const today = mine.filter((s) => sameDay(s.starts_at, now));
  if (today.length) return { heading: 'Today’s classes', rows: today };
  const next = mine.find((s) => ms(s.starts_at) > now);
  return { heading: 'Next class', rows: next ? [next] : [] };
}
function waitingRequests(ctx) {
  const id = me(ctx);
  return list(ctx.state.requests).filter((r) => r.assigned_to === id && r.status !== 'resolved').sort((a, b) => ms(b.created_at) - ms(a.created_at));
}

/* ---------- pieces ---------- */
function hero(ctx, queue, alerts, sections) {
  const { esc, href, icon } = ctx;
  const first = queue[0];
  const toGrade = queue.length, toReach = alerts.waiting;
  const who = first ? memberName(ctx, first.attempt.user_id) : '';
  const noun = first && /brief/i.test(first.assignment.title) ? 'brief' : 'work';
  const gradeHref = first
    ? href('courses', { cohort: first.assignment.cohort_id, tab: 'assignments', assignment: first.assignment.id })
    : href('courses', sections[0] ? { cohort: sections[0].id, tab: 'assignments' } : {});
  const title = toGrade && toReach ? `Grade ${countWords(toGrade)}, reach ${countWords(toReach)}.`
    : toGrade ? `Grade ${countWords(toGrade)}, then teach.`
    : toReach ? `Reach ${countWords(toReach)} ${toReach === 1 ? 'student' : 'students'} today.`
    : 'You are all caught up.';
  const line = [
    first ? `${esc(who)} turned in the ${esc(first.assignment.title)} ${esc(sinceWords(first.attempt.submitted_at))}.` : 'No submissions are waiting on a grade.',
    toReach ? `On your early-alert list, ${plural(toReach, 'student is', 'students are')} still waiting on a first touch.` : 'Every student on your early-alert list has heard from someone.'
  ].join(' ');
  return `<section class="campus-hero faculty-hero" aria-labelledby="facultyHeroTitle">
    <div class="faculty-hero-copy">
      <p class="campus-eyebrow">Your teaching day</p>
      <h2 id="facultyHeroTitle">${title}</h2>
      <p>${line}</p>
      <dl class="faculty-hero-stats">
        <div><dt>Waiting on a grade</dt><dd>${toGrade}</dd></div>
        <div><dt>Waiting on a first touch</dt><dd>${toReach}</dd></div>
      </dl>
      <div class="campus-card-actions">
        <a class="campus-button" href="${esc(gradeHref)}" data-faculty-cta="grade">${icon('check')}${first ? `Grade ${esc(firstName(who))}’s ${noun}` : 'Open my sections'}</a>
        <a class="campus-button campus-button-secondary" href="${esc(href('success'))}" data-faculty-cta="caseload">${icon('users')}Open my caseload</a>
      </div>
    </div>
    <div class="faculty-hero-media">
      <img src="/ht/img/students-library.jpg" alt="Huston-Tillotson students in the library, wearing Rams shirts" loading="eager" decoding="async">
      ${first ? `<p class="faculty-hero-card"><span class="faculty-hero-card-label">Waiting on your grade</span><strong>${esc(who)}</strong><span>${esc(first.assignment.title)}</span></p>` : ''}
    </div>
  </section>`;
}
function sectionCard(ctx, cohort) {
  const { esc, href, icon, formatDate, formatTime } = ctx;
  const f = sectionFacts(ctx, cohort);
  const [course, group] = String(cohort.title).split(' · ');
  const next = f.next
    ? `${sameDay(f.next.starts_at, Date.now()) ? 'Today' : esc(formatDate(f.next.starts_at))} · ${esc(formatTime(f.next.starts_at))}`
    : 'Not scheduled';
  return `<article class="faculty-section">
    <div class="faculty-section-head"><p class="campus-eyebrow">${esc(group || 'Section')}</p><h3>${esc(course)}</h3></div>
    <dl class="faculty-section-facts">
      <div><dt>Students</dt><dd>${f.roster}<span class="faculty-dd-note">in this demo roster</span></dd></div>
      <div><dt>Assignments open</dt><dd>${f.open}</dd></div>
      <div class="faculty-section-next"><dt>Next class</dt><dd>${next}${f.next ? `<span>${esc(f.next.title)}</span>` : ''}</dd></div>
    </dl>
    <div class="faculty-section-links">
      <a href="${esc(href('courses', { cohort: cohort.id, tab: 'overview' }))}">Open section ${icon('arrow')}</a>
      <a href="${esc(href('courses', { cohort: cohort.id, tab: 'grades' }))}">Gradebook ${icon('arrow')}</a>
    </div>
  </article>`;
}
function classRow(ctx, session) {
  const { esc, formatTime } = ctx;
  const link = classSessionHref(ctx, session);
  const start = ms(session.starts_at), end = ms(session.ends_at), now = Date.now();
  const live = session.is_live || (start <= now && now < end);
  const when = live ? 'Happening now' : sameDay(start, now) ? untilWords(session.starts_at) : ctx.formatDate(session.starts_at);
  const title = String(session.title).split(':');
  return `<li class="faculty-class${live ? ' is-live' : ''}">
    <span class="faculty-class-time"><strong>${esc(formatTime(session.starts_at))}</strong><span>${Number.isFinite(end) ? esc(formatTime(session.ends_at)) : ''}</span></span>
    <span class="faculty-class-body"><strong>${esc(title[0])}</strong>${title.length > 1 ? `<span>${esc(title.slice(1).join(':').trim())}</span>` : ''}<span class="faculty-class-when">${esc(when)}</span></span>
    ${link ? `<a class="campus-button campus-button-secondary campus-button-small" href="${esc(link)}">${live ? 'Join class' : 'Open classroom'}</a>` : ''}
  </li>`;
}
function requestsPanel(ctx, rows) {
  const { esc, href, icon } = ctx;
  const body = rows.length
    ? `<ul class="faculty-requests">${rows.slice(0, 3).map((r) => `<li><a href="${esc(href('support'))}"><span class="faculty-request-meta">${esc(memberName(ctx, r.user_id))} · ${esc(r.category)} · ${esc(sinceWords(r.created_at))}</span><strong>${esc(r.subject)}</strong><span class="faculty-request-state">${r.status === 'open' ? 'Needs a first reply' : 'In progress'}</span></a></li>`).join('')}</ul>`
    : `<p class="campus-muted">Nothing is waiting on you. New requests assigned to you will show up here.</p>`;
  return `<section class="campus-panel faculty-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Requests</p><h2>${rows.length ? `${plural(rows.length, 'student')} waiting on you` : 'All replied'}</h2></div><a href="${esc(href('support'))}">Get help queue</a></div>${body}
    <a class="faculty-inline-link" href="${esc(href('people'))}">${icon('chat')}Open messages</a></section>`;
}
function alertsPanel(ctx, alerts) {
  const { esc, href } = ctx;
  const stat = (n, label) => `<div><dd>${n}</dd><dt>${label}</dt></div>`;
  return `<section class="campus-panel faculty-panel faculty-alerts"><div class="campus-section-head"><div><p class="campus-eyebrow">Your early alerts</p><h2>${plural(alerts.flagged, 'student')} in your caseload</h2></div><a href="${esc(href('success'))}">Open my caseload</a></div>
    <dl class="faculty-alert-stats">${stat(alerts.waiting, 'Waiting on a first touch')}${stat(alerts.open, 'Contacted, still open')}${stat(alerts.resolved, 'Resolved')}</dl>
    <p class="campus-muted faculty-alert-note">Only the students assigned to you, the same numbers as your Student success page. A short, kind nudge is usually enough.</p></section>`;
}
function adaNote(ctx, queue) {
  const { esc, href, icon } = ctx;
  const target = queue[0] ? href('courses', { cohort: queue[0].assignment.cohort_id, tab: 'assignments', assignment: queue[0].assignment.id }) : href('courses');
  return `<section class="campus-panel faculty-ada">${icon('star')}<div><h2>Ada can help you grade</h2><p class="campus-muted">Ada, the Hub's AI guide, drafts feedback against your rubric. You read it, change what you want, and nothing reaches a student until you approve it.</p><a href="${esc(target)}">Try it on the next submission <span aria-hidden="true">→</span></a></div></section>`;
}

export function renderFaculty(view, ctx) {
  const { esc, href } = ctx;
  const sections = mySections(ctx);
  const ids = sections.map((c) => c.id);
  const queue = gradingQueue(ctx.state, ids);
  const alerts = caseloadSummary(ctx.state?.member?.display_name || '');
  const classes = todaysClasses(ctx, ids);
  const requests = waitingRequests(ctx);
  return `<div class="faculty-view">
    ${hero(ctx, queue, alerts, sections)}
    <div class="campus-grid campus-grid-main faculty-grid">
      <div class="campus-stack">
        <section class="campus-panel faculty-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Teaching this term</p><h2>Your sections</h2></div><a href="${esc(href('courses'))}">All courses</a></div>
          ${sections.length ? `<div class="faculty-sections">${sections.map((c) => sectionCard(ctx, c)).join('')}</div>` : '<p class="campus-muted">You are not teaching a section yet. Sections you are assigned to will show up here.</p>'}</section>
        <section class="campus-panel faculty-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Class sessions</p><h2>${classes.heading}</h2></div><a href="${esc(href('live'))}">All classrooms</a></div>
          ${classes.rows.length ? `<ol class="faculty-classes">${classes.rows.map((s) => classRow(ctx, s)).join('')}</ol>` : '<p class="campus-muted">No classes on the calendar. Schedule one from Classrooms.</p>'}</section>
      </div>
      <aside class="campus-stack">
        ${requestsPanel(ctx, requests)}
        ${alertsPanel(ctx, alerts)}
        ${adaNote(ctx, queue)}
      </aside>
    </div>
  </div>`;
}

export function bindFaculty() { return () => {}; }

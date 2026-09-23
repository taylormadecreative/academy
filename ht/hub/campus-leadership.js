/** Leadership views: Today, Insights, and the academic overview. Every figure here is an
 *  illustrative, campus-scale SAMPLE (about 1,100 students) and says so on screen. Live
 *  workspace totals still come from the campus store and render beneath the sample. */
const assetStamp = new URL(import.meta.url).search;
const { renderStaff, bindStaff } = await import('./campus-staff.js' + assetStamp);

const YEARS = [['all', 'All students'], ['fy', 'First-year'], ['so', 'Sophomore'], ['jr', 'Junior'], ['sr', 'Senior']];
const SAMPLE = {
  term: 'Fall 2026',
  weeks: ['Aug 17', 'Aug 24', 'Aug 31', 'Sep 7', 'Sep 14', 'Sep 21', 'Sep 28', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26', 'Nov 2'],
  weeksShown: 6, // the term is six weeks in; later weeks are not drawn
  byYear: {
    fy: { enrolled: 318, persist: 81, persistLast: 78, active: [44, 52, 58, 61, 63, 66], flagged: 17, completion: 72 },
    so: { enrolled: 284, persist: 87, persistLast: 85, active: [47, 54, 60, 63, 65, 67], flagged: 9, completion: 76 },
    jr: { enrolled: 262, persist: 90, persistLast: 89, active: [50, 56, 62, 66, 68, 70], flagged: 6, completion: 79 },
    sr: { enrolled: 278, persist: 93, persistLast: 92, active: [53, 59, 64, 67, 70, 73], flagged: 6, completion: 83 }
  },
  activeLastYear: [41, 46, 50, 52, 53, 55],
  funnel: [['Inquiries', 9420], ['Applied', 3860], ['Admitted', 1910], ['Deposited', 412], ['Enrolled', 318]],
  pathways: [['Career Ready', 81], ['AI Literacy', 74], ['Digital Storytelling', 68], ['Financial Wellness', 59]],
  support: { medianReply: '3.2 hours', month: 214, byTopic: [['Advising', 62], ['Financial aid', 48], ['Learning', 41], ['Career', 33], ['Technology', 30]] },
  alerts: { contacted: 24, resolved: 11, reasons: [['Missed two or more assignments', 16], ['No Hub sign-in in 10 days', 11], ['Grade below C at midterm', 7], ['Missed three classes', 4]] },
  giving: { raised: 48200, donors: 126, cohorts: 3 },
  checkins: 1386,
  sections: [
    ['AI Literacy · First-Year Scholars', 'Morgan T.', 24, 88],
    ['Career Ready · Junior Seminar', 'Dr. Ellis P.', 31, 90],
    ['Digital Storytelling · Creative Lab', 'Riley S.', 18, 83],
    ['Intro to Data · Business Majors', 'Terrence M.', 22, 79],
    ['Financial Wellness · Sophomore Cohort', 'Dana K.', 27, 71]
  ]
};
const DOORS = [
  ['admissions', 'Families', 'Admitted students and parents, before move-in.'],
  ['alumni', 'Alumni', 'Chapters, mentors, and Homecoming.'],
  ['career', 'Employers', 'A searchable portfolio of student work.'],
  ['board', 'Trustees', 'The packet, the agenda, and check-in.'],
  ['advancement', 'Donors', 'Every gift, followed through to the work.'],
  ['outreach', 'Neighbors', 'Public programs and a summer bridge.']
];

let yearFilter = 'all';
const sum = (list) => list.reduce((a, b) => a + b, 0);
const role = (ctx) => ctx.state?.member?.role;
const num = (n) => Number(n).toLocaleString('en-US');
const pts = (n) => `${n} ${Math.abs(n) === 1 ? 'pt' : 'pts'}`;

function slice(year) {
  const keys = year === 'all' ? Object.keys(SAMPLE.byYear) : [year];
  const rows = keys.map((k) => SAMPLE.byYear[k]);
  const enrolled = sum(rows.map((r) => r.enrolled));
  const weighted = (field) => Math.round(sum(rows.map((r) => r[field] * r.enrolled)) / enrolled);
  const active = SAMPLE.byYear.fy.active.map((_, i) => Math.round(sum(rows.map((r) => r.active[i] * r.enrolled)) / enrolled));
  return { enrolled, persist: weighted('persist'), persistLast: weighted('persistLast'), active, flagged: sum(rows.map((r) => r.flagged)), completion: weighted('completion') };
}

export function leadershipViews(view, ctx) {
  if (ctx.state?.mode === 'unavailable') return false;
  const r = role(ctx);
  if (view === 'insights') return ['staff', 'admin', 'leadership'].includes(r);
  return r === 'leadership' && ['home', 'courses'].includes(view);
}

/* ---------- small, accessible chart pieces ---------- */
function sampleNote(ctx) {
  return `<p class="lead-sample-note">${ctx.icon('chart')}<span><strong>Illustrative sample.</strong> Campus-scale figures for a university of about 1,100 students, not Huston-Tillotson results. Individual student records are never shown here.</span></p>`;
}
function trendLine(values, compare, labels, { id, unit = '%', height = 180, width = 560, label }) {
  const w = width, h = height, pad = { l: 46, r: 16, t: 16, b: 30 };
  const all = [...values, ...(compare || [])];
  const lo = Math.max(0, Math.floor((Math.min(...all) - 6) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...all) + 4) / 10) * 10);
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (labels.length - 1);
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const path = (list) => list.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const grid = [lo, (lo + hi) / 2, hi].map((v) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" class="lead-grid"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" class="lead-axis">${v}${unit}</text>`).join('');
  const ticks = labels.map((l, i) => (i % 2 === 0 ? `<text x="${x(i)}" y="${h - 6}" text-anchor="middle" class="lead-axis">${l}</text>` : '')).join('');
  const last = values.length - 1;
  const points = values.map((v, i) => ({ label: labels[i], value: v, compare: compare ? compare[i] : null }));
  return `<figure class="lead-chart" data-lead-chart="${id}" data-points='${JSON.stringify(points).replace(/'/g, '&#39;')}' data-unit="${unit}">
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${grid}${ticks}
      ${compare ? `<path d="${path(compare)}" class="lead-line-compare"/>` : ''}
      <path d="${path(values)}" class="lead-line"/>
      <circle cx="${x(last)}" cy="${y(values[last])}" r="5" class="lead-dot"/>
      <text x="${x(last) - 8}" y="${y(values[last]) - 12}" text-anchor="end" class="lead-direct">${values[last]}${unit}</text>
      <g class="lead-cross" hidden><line class="lead-cross-line" y1="${pad.t}" y2="${h - pad.b}"/><circle r="5" class="lead-dot"/></g>
      <rect class="lead-hit" x="${pad.l}" y="0" width="${w - pad.l - pad.r}" height="${h}" data-x0="${pad.l}" data-x1="${w - pad.r}" data-lo="${lo}" data-hi="${hi}" data-top="${pad.t}" data-bottom="${h - pad.b}"/>
    </svg>
    <div class="lead-tip" role="status" hidden></div>
  </figure>`;
}
function bars(rows, { max, unit = '', emphasis } = {}) {
  const top = max || Math.max(...rows.map((r) => r[1]));
  return `<ul class="lead-bars">${rows.map(([label, value]) => `<li${emphasis && emphasis(label, value) ? ' class="is-emphasis"' : ''}><span class="lead-bar-label">${label}</span><span class="lead-bar-track"><span class="lead-bar-fill" style="width:${Math.max(2, (value / top) * 100).toFixed(1)}%"></span></span><span class="lead-bar-value">${num(value)}${unit}</span></li>`).join('')}</ul>`;
}
function table(caption, head, rows) {
  return `<details class="lead-table"><summary>View as a table</summary><table><caption class="campus-sr-only">${caption}</caption><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></details>`;
}
function kpi(label, value, delta, tone, detail) {
  return `<article class="lead-kpi"><span class="lead-kpi-label">${label}</span><strong>${value}</strong><span class="lead-kpi-delta" data-tone="${tone}">${tone === 'up' ? '<span aria-hidden="true">▲</span> ' : tone === 'down' ? '<span aria-hidden="true">▼</span> ' : ''}${delta}</span>${detail ? `<span class="lead-kpi-detail">${detail}</span>` : ''}</article>`;
}
function yearFilterBar(ctx) {
  return `<div class="lead-filters" role="group" aria-label="Filter by class year"><span class="lead-filter-term">${ctx.icon('calendar')} ${SAMPLE.term} · week 6</span>${YEARS.map(([k, l]) => `<button type="button" class="lead-chip" data-lead-year="${k}" aria-pressed="${yearFilter === k}">${l}</button>`).join('')}</div>`;
}

/* ---------- Today ---------- */
function upcoming(ctx) {
  const now = Date.now();
  return (ctx.state.events || []).filter((e) => e.status === 'published' && new Date(e.ends_at || e.starts_at).getTime() >= now).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 3);
}
/* The President space's sample town hall is October 15 at noon; drop it from the week once it has passed. */
function townHallAhead(now = new Date()) { return now < new Date(now.getFullYear(), 9, 15, 13); }
function home(ctx) {
  const { esc, href, icon } = ctx, s = slice('all'), HT = window.HT || {};
  const first = (HT.leadershipWalkthrough || [])[0];
  const tour = first ? href(`/ht/hub/${first.key}/`) : href('spaces');
  const doors = DOORS.map(([key, label, line]) => {
    const art = HT.spaceArtwork?.[key];
    return `<a class="lead-door" href="${esc(href(`/ht/hub/${key}/`))}">${art ? `<img src="${esc(art.image)}" alt="" decoding="async">` : ''}<span><strong>${label}</strong><span>${line}</span></span>${icon('arrow')}</a>`;
  }).join('');
  const events = upcoming(ctx);
  return `<section class="campus-hero lead-hero"><div class="lead-hero-copy"><p class="campus-eyebrow">This week on the Hill</p><h2>Every student, every class, one view.</h2><p>Enrollment, persistence, learning, and the students who need a hand, with a clear next step for each. Start the tour to see the Hub the way a student, a family, and a trustee will.</p><div class="campus-card-actions"><a class="campus-button lead-button-gold" href="${esc(tour)}">Take the 13-stop tour</a><a class="campus-button campus-button-secondary" href="${esc(href('insights'))}">Open campus insights</a></div></div><img class="lead-hero-photo" src="/ht/img/wallace-students.jpg" alt="Dr. Melva K. Wallace with Huston-Tillotson students" loading="eager" decoding="async"></section>
  ${sampleNote(ctx)}
  <section class="lead-kpis" aria-label="Campus pulse">
    ${kpi('Students enrolled', num(s.enrolled), '3.1% vs. last fall', 'up', `${SAMPLE.term}`)}
    ${kpi('Fall-to-spring persistence', s.persist + '%', `${pts(s.persist - s.persistLast)} vs. last year`, 'up', 'Projected from week-6 signals')}
    ${kpi('Active in the Hub this week', s.active.at(-1) + '%', `${pts(s.active.at(-1) - SAMPLE.activeLastYear.at(-1))} vs. last year`, 'up', 'Signed in and did one thing')}
    ${kpi('Students flagged for outreach', s.flagged, '9 fewer than last week', 'down', `${SAMPLE.alerts.contacted} contacted · ${SAMPLE.alerts.resolved} resolved`)}
  </section>
  <div class="campus-grid campus-grid-main lead-home-grid"><div class="campus-stack">
    <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Needs your attention</p><h2>${s.flagged} students may need a hand</h2></div><a href="${esc(href('success'))}">Open Student success</a></div>
      <p class="campus-muted">Advisors see the names. You see the pattern, and whether every flag has an owner.</p>${bars(SAMPLE.alerts.reasons)}
      <div class="lead-progress-row"><span><strong>${SAMPLE.alerts.contacted}</strong> contacted</span><span><strong>${SAMPLE.alerts.resolved}</strong> resolved</span><span><strong>${s.flagged - SAMPLE.alerts.contacted}</strong> waiting on a first touch</span></div></section>
    <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Engagement</p><h2>Weekly active students</h2></div><a href="${esc(href('insights'))}">All insights</a></div>
      ${trendLine(s.active, SAMPLE.activeLastYear, SAMPLE.weeks.slice(0, SAMPLE.weeksShown), { id: 'home-active', label: `Weekly active students, ${SAMPLE.term}, rising from ${s.active[0]}% to ${s.active.at(-1)}%, above last year each week` })}
      <p class="lead-legend"><span class="lead-key"></span>${SAMPLE.term}<span class="lead-key is-compare"></span>Fall 2025</p></section>
  </div><aside class="campus-stack">
    <section class="campus-panel campus-today-agenda"><div class="campus-section-head"><div><p class="campus-eyebrow">On the calendar</p><h2>This week</h2></div><a href="${esc(href('events'))}">All events</a></div>
      <div class="campus-list">${events.map((e) => `<a class="campus-row campus-calendar-row" href="${esc(href('events'))}#event-${esc(e.id)}"><span class="campus-event-date">${esc(ctx.formatDate(e.starts_at))}</span><span><strong>${esc(e.title)}</strong><span class="campus-muted">${esc(ctx.formatTime(e.starts_at))} · ${esc(e.location || e.office || 'Campus')}</span></span></a>`).join('')}${townHallAhead() ? `<a class="campus-row campus-calendar-row" href="${esc(href('/ht/hub/president/'))}"><span class="campus-event-date">Oct 15</span><span><strong>Fall town hall</strong><span class="campus-muted">12:00 PM · Auditorium and live in the Hub</span></span></a>` : ''}</div></section>
    <section class="campus-panel lead-giving"><p class="campus-eyebrow">Advancement</p><h2>$${num(SAMPLE.giving.raised)} to student work</h2><p class="campus-muted">${SAMPLE.giving.donors} donors funded ${SAMPLE.giving.cohorts} cohorts this fall. Each gift links to the class it paid for.</p><a class="campus-button campus-button-secondary" href="${esc(href('/ht/hub/advancement/'))}">See the donor view</a></section>
    <section class="campus-panel lead-trust-card">${icon('door')}<div><h2>Ready for your IT review</h2><p class="campus-muted">Sign-in, student records, accessibility, and integrations on one page.</p><a href="${esc(href('trust'))}">Security &amp; integrations <span aria-hidden="true">→</span></a></div></section>
  </aside></div>
  <section class="campus-panel lead-doors-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Beyond enrolled students</p><h2>Every audience has a door</h2></div><a href="${esc(href('spaces'))}">All 13 spaces</a></div><div class="lead-doors">${doors}</div></section>`;
}

/* ---------- Insights ---------- */
function insights(ctx) {
  const s = slice(yearFilter), yearLabel = YEARS.find(([k]) => k === yearFilter)[1];
  const funnelMax = SAMPLE.funnel[0][1];
  const persistRows = [['First-year', SAMPLE.byYear.fy], ['Sophomore', SAMPLE.byYear.so], ['Junior', SAMPLE.byYear.jr], ['Senior', SAMPLE.byYear.sr]];
  const weeks = SAMPLE.weeks.slice(0, SAMPLE.weeksShown);
  return `<div data-lead-insights>${sampleNote(ctx)}${yearFilterBar(ctx)}
  <section class="lead-kpis" aria-label="Key measures for ${yearLabel}" aria-live="polite">
    ${kpi('Students enrolled', num(s.enrolled), yearFilter === 'all' ? '3.1% vs. last fall' : `${Math.round((s.enrolled / 1142) * 100)}% of campus`, yearFilter === 'all' ? 'up' : 'flat', yearLabel)}
    ${kpi('Fall-to-spring persistence', s.persist + '%', `${pts(s.persist - s.persistLast)} vs. last year`, 'up', 'Projected from week-6 signals')}
    ${kpi('Active in the Hub this week', s.active.at(-1) + '%', `${pts(s.active.at(-1) - s.active[0])} since week 1`, 'up', 'Signed in and did one thing')}
    ${kpi('Pathway completion', s.completion + '%', 'of students who started one', 'flat', 'Co-curricular pathways')}
  </section>
  <div class="lead-chart-grid">
    <section class="campus-panel lead-span-2"><div class="campus-section-head"><div><p class="campus-eyebrow">Engagement · ${yearLabel}</p><h2>Weekly active students</h2></div><p class="lead-legend"><span class="lead-key"></span>${SAMPLE.term}<span class="lead-key is-compare"></span>Fall 2025 · all students</p></div>
      ${trendLine(s.active, SAMPLE.activeLastYear, weeks, { id: 'insights-active', width: 1100, height: 240, label: `Weekly active ${yearLabel.toLowerCase()}, ${s.active[0]}% in week 1 to ${s.active.at(-1)}% in week 6` })}
      ${table('Weekly active students', ['Week of', SAMPLE.term, 'Fall 2025'], weeks.map((w, i) => [w, s.active[i] + '%', SAMPLE.activeLastYear[i] + '%']))}</section>
    <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Persistence</p><h2>Projected return in spring</h2></div></div>
      <ul class="lead-bars lead-bars-compare">${persistRows.map(([l, r]) => `<li><span class="lead-bar-label">${l}</span><span class="lead-bar-track"><span class="lead-bar-fill" style="width:${r.persist}%"></span><span class="lead-bar-mark" style="left:${r.persistLast}%" title="Last year ${r.persistLast}%"></span></span><span class="lead-bar-value">${r.persist}%</span></li>`).join('')}</ul>
      <p class="lead-legend"><span class="lead-key"></span>This year<span class="lead-key is-mark"></span>Last year</p>
      <p class="campus-muted">First-year students carry the most risk, and the most room to move: every point is about three students.</p></section>
    <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Admissions · entering class</p><h2>From inquiry to enrolled</h2></div><a href="${ctx.esc(ctx.href('/ht/hub/admissions/'))}">Admissions space</a></div>
      ${bars(SAMPLE.funnel, { max: funnelMax })}<p class="campus-muted">${Math.round((SAMPLE.funnel[4][1] / SAMPLE.funnel[3][1]) * 100)}% of deposited students enrolled; the admitted-student community runs from deposit to move-in.</p></section>
    <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Learning</p><h2>Pathway completion</h2></div><a href="${ctx.esc(ctx.href('learn'))}">Pathways</a></div>
      ${bars(SAMPLE.pathways, { max: 100, unit: '%', emphasis: (_, v) => v < 65 })}<p class="campus-muted">Financial Wellness trails the rest; its module three is where most students stop.</p></section>
    <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Student support</p><h2>${SAMPLE.support.month} requests this month</h2></div><a href="${ctx.esc(ctx.href('support'))}">Support queue</a></div>
      ${bars(SAMPLE.support.byTopic)}<p class="campus-muted">Median first reply: <strong>${SAMPLE.support.medianReply}</strong>. Every request has a named owner.</p></section>
    <section class="campus-panel lead-span-2"><div class="campus-section-head"><div><p class="campus-eyebrow">Campus life &amp; giving</p><h2>What students showed up for</h2></div></div>
      <div class="lead-mini-stats"><div><strong>${num(SAMPLE.checkins)}</strong><span>event check-ins this month</span></div><div><strong>$${num(SAMPLE.giving.raised)}</strong><span>given to student-work cohorts</span></div><div><strong>${SAMPLE.giving.donors}</strong><span>donors this fall</span></div></div></section>
  </div>
  <div class="lead-export"><button type="button" class="campus-button campus-button-secondary" data-lead-export>${ctx.icon('download')} Export this sample (CSV)</button></div>
  <details class="lead-live-totals"><summary><span><p class="campus-eyebrow">Live records</p><strong>This demo’s workspace, right now</strong><span class="campus-muted">Counts of the records people create while trying the demo.</span></span><span class="campus-page-guide-chevron" aria-hidden="true">⌄</span></summary>${renderStaff('insights', ctx)}</details></div>`;
}

/* ---------- Learning, for leadership ---------- */
function courses(ctx) {
  const { esc, href } = ctx;
  return `${sampleNote(ctx)}<section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Academic overview · ${SAMPLE.term}</p><h2>Course sections across campus</h2></div><a href="${esc(href('success'))}">Student success</a></div>
    <p class="campus-muted">Section totals only. Leadership never sees an individual student’s grades; instructors and advisors do.</p>
    <div class="lead-table-wrap"><table class="lead-sections"><thead><tr><th scope="col">Section</th><th scope="col">Instructor</th><th scope="col">Enrolled</th><th scope="col">On track</th></tr></thead><tbody>${SAMPLE.sections.map(([t, i, n, p]) => `<tr${p < 75 ? ' class="is-watch"' : ''}><th scope="row">${esc(t)}</th><td>${esc(i)}</td><td>${n}</td><td><span class="lead-track"><span style="width:${p}%"></span></span> ${p}%${p < 75 ? ' <span class="lead-flag">Watch</span>' : ''}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="campus-panel lead-course-links"><div><h2>Beyond the classroom</h2><p class="campus-muted">Co-curricular pathways earn badges that travel to a student’s career portfolio.</p></div><a class="campus-button campus-button-secondary" href="${esc(href('learn'))}">Open learning pathways</a></section>`;
}

export function renderLeadership(view, ctx) {
  const body = view === 'insights' ? insights(ctx) : view === 'courses' ? courses(ctx) : home(ctx);
  return `<div class="lead-view" data-lead-view="${view}">${body}</div>`;
}

function csv(ctx) {
  const s = slice(yearFilter), rows = [['Measure', 'Value', 'Note']];
  rows.push(['Students enrolled', s.enrolled, 'Illustrative sample'], ['Fall-to-spring persistence (%)', s.persist, ''], ['Active this week (%)', s.active.at(-1), ''], ['Pathway completion (%)', s.completion, '']);
  SAMPLE.funnel.forEach(([l, v]) => rows.push(['Admissions: ' + l, v, '']));
  SAMPLE.support.byTopic.forEach(([l, v]) => rows.push(['Support requests: ' + l, v, '']));
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
  a.download = `ht-hub-sample-insights-${yearFilter}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  ctx.notify('Sample insights exported. Figures are illustrative.');
}

function wireCharts(root) {
  const off = [];
  root.querySelectorAll('[data-lead-chart]').forEach((fig) => {
    const svg = fig.querySelector('svg'), hit = fig.querySelector('.lead-hit'), tip = fig.querySelector('.lead-tip'), cross = fig.querySelector('.lead-cross');
    const points = JSON.parse(fig.dataset.points), unit = fig.dataset.unit;
    const x0 = +hit.dataset.x0, x1 = +hit.dataset.x1, lo = +hit.dataset.lo, hi = +hit.dataset.hi, top = +hit.dataset.top, bottom = +hit.dataset.bottom;
    const show = (index) => {
      const p = points[index], x = x0 + (index * (x1 - x0)) / (points.length - 1), y = top + (bottom - top) * (1 - (p.value - lo) / (hi - lo));
      cross.hidden = false; cross.querySelector('line').setAttribute('x1', x); cross.querySelector('line').setAttribute('x2', x);
      cross.querySelector('circle').setAttribute('cx', x); cross.querySelector('circle').setAttribute('cy', y);
      tip.hidden = false; tip.innerHTML = `<strong>Week of ${p.label}</strong><span>${p.value}${unit} this year</span>${p.compare != null ? `<span class="is-compare">${p.compare}${unit} last year</span>` : ''}`;
      const box = svg.getBoundingClientRect(), scale = box.width / svg.viewBox.baseVal.width;
      tip.style.left = `${Math.min(box.width - 150, Math.max(0, x * scale - 70))}px`;
    };
    const move = (e) => { const box = svg.getBoundingClientRect(), scale = svg.viewBox.baseVal.width / box.width; const vx = (e.clientX - box.left) * scale; show(Math.max(0, Math.min(points.length - 1, Math.round(((vx - x0) / (x1 - x0)) * (points.length - 1))))); };
    const leave = () => { cross.hidden = true; tip.hidden = true; };
    let focusIndex = points.length - 1;
    const key = (e) => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); focusIndex = Math.max(0, Math.min(points.length - 1, focusIndex + (e.key === 'ArrowRight' ? 1 : -1))); show(focusIndex); };
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', leave);
    svg.addEventListener('focus', () => show(focusIndex)); svg.addEventListener('blur', leave); svg.addEventListener('keydown', key);
    off.push(() => { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerleave', leave); svg.removeEventListener('keydown', key); });
  });
  return () => off.forEach((f) => f());
}

export function bindLeadership(view, root, ctx) {
  const staffCleanup = view === 'insights' ? bindStaff(view, root, ctx) : null;
  let chartsCleanup = wireCharts(root);
  const click = (e) => {
    const chip = e.target.closest('[data-lead-year]');
    if (chip && root.contains(chip)) {
      yearFilter = chip.dataset.leadYear;
      const holder = root.querySelector('[data-lead-view]');
      if (holder) { chartsCleanup(); holder.innerHTML = insights(ctx); chartsCleanup = wireCharts(root); root.querySelector(`[data-lead-year="${yearFilter}"]`)?.focus(); }
      return;
    }
    if (e.target.closest('[data-lead-export]')) csv(ctx);
  };
  root.addEventListener('click', click);
  return () => { root.removeEventListener('click', click); chartsCleanup(); staffCleanup?.(); };
}

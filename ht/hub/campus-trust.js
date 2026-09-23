/** Security & integrations: the page a campus IT team and the president's cabinet read first.
 *  Everything here must stay accurate and conservative. Two statuses only:
 *   - built:  exists in the product today and can be tried in this demo
 *   - scoped: planned; confirmed with HT's IT team before launch
 *  Never name a vendor, never claim a certification or audit that has not happened. */

const STATUS = {
  built: { label: 'Built', icon: 'check', note: 'In the product today. You can try it in this demo.' },
  scoped: { label: 'Scoped with your IT team', icon: 'users', note: 'Planned. We confirm the details together before launch.' }
};

export const TRUST_GROUPS = [
  { title: 'Sign-in & identity', icon: 'door', items: [
    ['built', 'Sign in with a one-time email code', 'No passwords to store, reuse, or leak. Each code works one time.'],
    ['built', 'Encrypted in transit', 'Every page and every request uses HTTPS.'],
    ['scoped', 'Campus single sign-on', 'Sign in with HT’s campus accounts, using SAML or OIDC.']
  ] },
  { title: 'Student records & privacy', icon: 'shield', items: [
    ['built', 'Access rules live in the database, for every table', 'Students see their own records. Instructors see only the sections they teach. Leadership sees campus totals, never one student’s grades.'],
    ['built', 'Private messages stay private', 'A private message is visible only to the two people in it.'],
    ['built', 'Class recordings stay private until staff publish them', 'Live classes can be recorded. A recording is not shared until a staff member chooses to publish it.'],
    ['built', 'The demo never touches real records', 'In sample mode, every change stays in the visitor’s own browser.']
  ] },
  { title: 'Integrations', icon: 'grid', items: [
    ['scoped', 'Nightly roster and enrollment sync', 'Students, sections, and enrollments come from HT’s student information system each night.'],
    ['scoped', 'Works alongside your current LMS', 'LTI 1.3, so courses can link in both directions while HT decides what lives where.']
  ] },
  { title: 'Accessibility', icon: 'users', items: [
    ['built', 'Keyboard and contrast checks on every page', 'Every page works with a keyboard. Text contrast is checked in automated tests.'],
    ['scoped', 'Outside accessibility review and VPAT', 'We design to WCAG 2.2 AA. An outside review and a VPAT are planned before launch.']
  ] },
  { title: 'Data ownership', icon: 'download', items: [
    ['built', 'Reports export as CSV', 'Campus-wide totals download as a spreadsheet file your team can open anywhere.'],
    ['scoped', 'Full data export and deletion on request', 'HT can ask for all of its data, or ask for it to be deleted.'],
    ['scoped', 'A retention schedule set by HT', 'HT decides how long each kind of record is kept.'],
    ['scoped', 'Audit log exports for admins', 'Admins can download a record of who changed what, and when.']
  ] }
];

/* Who sees what. Each cell: [kind, text]. kind is yes | some | no. Text is always visible, so
   meaning never depends on color or icon alone. */
const COLUMNS = ['Own coursework', 'A section’s grades', 'Private messages', 'Campus totals', 'Early-alert names'];
export const ACCESS = [
  ['Student', 'Their own classes and pathways', [['yes', 'Yes'], ['no', 'No, only their own grades'], ['some', 'Only their own'], ['no', 'No'], ['no', 'No']]],
  ['Instructor', 'Staff who teach a section', [['some', 'Sections they teach'], ['some', 'Sections they teach'], ['some', 'Only their own'], ['some', 'Totals only'], ['no', 'No']]],
  ['Advisor', 'Staff with a student caseload', [['no', 'No'], ['no', 'No'], ['some', 'Only their own'], ['some', 'Totals only'], ['some', 'Their caseload only']]],
  ['Leadership', 'President’s cabinet', [['no', 'No'], ['no', 'No'], ['some', 'Only their own'], ['yes', 'Yes, totals only'], ['no', 'No, counts only']]],
  ['Trustee', 'Board members', [['no', 'No'], ['no', 'No'], ['no', 'No'], ['no', 'No'], ['no', 'No']]]
];

export const TRUST_QUESTIONS = [
  ['Where is student data stored?', 'In a managed database. The access rules live inside the database itself, so every page and every export follows the same rules. All traffic is encrypted in transit. Hosting region, backups, and recovery details are in the security packet, and we review them with your team.'],
  ['Who owns the data?', 'HT owns its data. That includes student records, coursework, messages, and recordings. The Hub keeps them only to run the Hub for HT, and your agreement will say so in writing.'],
  ['What about FERPA?', 'We do not claim a certification or audit we have not completed. The Hub is built to support your FERPA obligations: students see only their own records, staff see only what their role needs, and HT decides who has access.'],
  ['Does AI train on student data?', 'No. Nothing a student writes in the Hub is used to train any AI model.'],
  ['How are live class recordings handled?', 'Recordings stay private until a staff member publishes them. Once published, they appear for the class they belong to. HT’s retention schedule will set how long they are kept.'],
  ['How do people sign in?', 'Today, with a one-time code sent to a campus email address, so there are no passwords to leak. Campus single sign-on with HT’s campus accounts, using SAML or OIDC, is scoped with your IT team before launch.'],
  ['Can we turn off a feature?', 'Yes. Tell us which features to leave off for your campus, such as community channels or Ada, the Hub’s AI guide, and we set that before launch.'],
  ['What happens when the contract ends?', 'HT gets a full export of its data. Then the data is deleted on a date HT chooses. Export and deletion on request are scoped with your IT team, so the steps are agreed in writing before launch.']
];

const counts = () => TRUST_GROUPS.flatMap((g) => g.items).reduce((acc, [status]) => { acc[status] = (acc[status] || 0) + 1; return acc; }, {});

function chip(status, ctx) {
  const s = STATUS[status];
  return `<span class="trust-chip" data-status="${status}">${ctx.icon(s.icon)}<span>${s.label}</span></span>`;
}

function cell([kind, text], ctx) {
  const mark = kind === 'no' ? ctx.icon('close') : ctx.icon('check');
  return `<span class="trust-mark" data-kind="${kind}">${mark}<span>${ctx.esc(text)}</span></span>`;
}

function matrix(ctx) {
  const { esc } = ctx;
  return `<section class="campus-panel trust-matrix-panel" aria-labelledby="trust-matrix-title">
    <div class="campus-section-head"><div><p class="campus-eyebrow">Who sees what</p><h2 id="trust-matrix-title">Each person sees what their role needs</h2></div></div>
    <p class="campus-muted trust-lead">These rules are enforced in the database, not only on the screen. A page cannot show a record the database will not hand over.</p>
    <div class="trust-matrix-wrap"><table class="trust-matrix">
      <caption class="campus-sr-only">Who can see what in the HT Hub, by role</caption>
      <thead><tr><th scope="col">Role</th>${COLUMNS.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${ACCESS.map(([role, who, cells]) => `<tr><th scope="row"><strong>${esc(role)}</strong><span>${esc(who)}</span></th>${cells.map((c, i) => `<td data-label="${esc(COLUMNS[i])}">${cell(c, ctx)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="trust-footnote">Trustees see the board space only: the packet, the agenda, and check-in. HT decides which staff count as instructors and advisors.</p>
  </section>`;
}

function checklist(ctx) {
  const { esc, icon } = ctx;
  const c = counts();
  return `<section class="campus-panel trust-checklist" aria-labelledby="trust-check-title">
    <div class="campus-section-head"><div><p class="campus-eyebrow">Readiness checklist</p><h2 id="trust-check-title">What’s built, what we’ll set up together</h2></div></div>
    <dl class="trust-legend">${Object.entries(STATUS).map(([k, s]) => `<div><dt>${chip(k, ctx)}</dt><dd><strong>${c[k] || 0} items.</strong> ${esc(s.note)}</dd></div>`).join('')}</dl>
    <div class="trust-groups">${TRUST_GROUPS.map((g) => `<section class="trust-group" aria-labelledby="trust-g-${esc(slug(g.title))}">
      <h3 id="trust-g-${esc(slug(g.title))}">${icon(g.icon)}<span>${esc(g.title)}</span></h3>
      <ul>${g.items.map(([status, title, body]) => `<li class="trust-item" data-status="${status}"><div><strong>${esc(title)}</strong><p>${esc(body)}</p></div>${chip(status, ctx)}</li>`).join('')}</ul>
    </section>`).join('')}</div>
  </section>`;
}

function questions(ctx) {
  const { esc } = ctx;
  return `<section class="campus-panel trust-faq" aria-labelledby="trust-faq-title">
    <div class="campus-section-head"><div><p class="campus-eyebrow">Plain answers</p><h2 id="trust-faq-title">Questions your IT team will ask</h2></div><button type="button" class="campus-button campus-button-secondary campus-button-small" data-trust-toggle-all aria-controls="trust-faq-list">Open all</button></div>
    <div class="trust-faq-list" id="trust-faq-list">${TRUST_QUESTIONS.map(([q, a], i) => `<details class="trust-q" id="trust-q-${i + 1}"><summary><span>${esc(q)}</span><span class="trust-q-sign" aria-hidden="true"></span></summary><p>${esc(a)}</p></details>`).join('')}</div>
  </section>`;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function renderTrust(view, ctx) {
  const { esc, href, icon } = ctx;
  const c = counts();
  const packet = href('support', { topic: 'Technology', subject: 'Security packet request' });
  return `<div class="trust-page">
    <section class="campus-hero trust-hero">
      <div class="trust-hero-copy">
        <p class="campus-eyebrow">For HT’s IT team and cabinet</p>
        <h2>Your data stays yours.</h2>
        <p>This page shows how the Hub signs people in, protects student records, and connects to campus systems. Each item is marked honestly: built today, or scoped with your IT team before launch.</p>
        <ul class="trust-hero-facts">
          <li>${icon('check')}<span><strong>${c.built} built</strong> and ready to try</span></li>
          <li>${icon('users')}<span><strong>${c.scoped} scoped</strong> with your IT team</span></li>
          <li>${icon('shield')}<span><strong>HT owns</strong> its data</span></li>
        </ul>
        <div class="campus-card-actions"><a class="campus-button" href="${esc(packet)}">Request the security packet</a><button type="button" class="campus-button campus-button-secondary" data-trust-copy>${icon('globe')}<span>Share this page with IT</span></button></div>
      </div>
      <img class="trust-hero-photo" src="/ht/img/campus-hero.jpg" alt="The Huston-Tillotson University sign in front of a campus building with a bell tower, under a blue sky" loading="eager" decoding="async">
    </section>
    <p class="lead-sample-note">${icon('shield')}<span><strong>Built to support your FERPA obligations.</strong> We list only what exists today or what we will set up with you. We do not claim a certification or outside audit we have not completed.</span></p>
    ${checklist(ctx)}
    ${matrix(ctx)}
    <div class="trust-two">${questions(ctx)}
    <section class="campus-panel trust-close" aria-labelledby="trust-close-title">
      <div><p class="campus-eyebrow">Next step</p><h2 id="trust-close-title">Ready for your review</h2><p>Ask for the security packet and we will walk your team through each item. Or send this page to IT so they can start with the same list.</p></div>
      <div class="campus-card-actions"><a class="campus-button" href="${esc(packet)}">Request the security packet</a><button type="button" class="campus-button campus-button-secondary" data-trust-copy>${icon('globe')}<span>Share this page with IT</span></button></div>
    </section></div>
  </div>`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText && globalThis.isSecureContext !== false) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the legacy path */ }
  try {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; area.style.top = '0';
    document.body.append(area); area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}

export function bindTrust(view, root, ctx) {
  const onClick = async (event) => {
    const copy = event.target.closest?.('[data-trust-copy]');
    if (copy && root.contains(copy)) {
      const url = new URL(globalThis.location.href);
      url.hash = '';
      const ok = await copyText(url.href);
      ctx.notify(ok ? 'Link copied. Paste it into an email to your IT team.' : `Copy this link to share: ${url.href}`, ok ? 'success' : 'error');
      return;
    }
    const toggle = event.target.closest?.('[data-trust-toggle-all]');
    if (toggle && root.contains(toggle)) {
      const items = Array.from(root.querySelectorAll('.trust-q'));
      const open = !items.every((d) => d.open);
      items.forEach((d) => { d.open = open; });
      sync();
    }
  };
  const sync = () => {
    const toggle = root.querySelector('[data-trust-toggle-all]');
    if (!toggle) return;
    const all = Array.from(root.querySelectorAll('.trust-q')).every((d) => d.open);
    toggle.textContent = all ? 'Close all' : 'Open all';
  };
  const onToggle = (event) => { if (event.target.classList?.contains('trust-q')) sync(); };
  root.addEventListener('click', onClick);
  root.addEventListener('toggle', onToggle, true);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('toggle', onToggle, true); };
}

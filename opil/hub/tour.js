/* OPIL Lab Hub — first-visit tour. One engine, steps per surface and role.
   nav() calls tour(ctx, page) on every hub page; it runs once per page per device
   (localStorage), again on ?tour=1, and from the "Show me around" control in the nav. */

const KEY = (page) => 'opil-tour:' + page;

/* Who is standing here, in the words the page uses. */
function roleOf(ctx) {
  if (ctx.isAdmin) return 'coordinator';
  if ((ctx.facSessions || []).length) return 'facilitator';
  if (ctx.isJudge) return 'judge';
  return 'student';
}

/* A step: where to point (first selector that is on the page wins; `up` climbs to the
   card that holds it), what to call it, and one or two plain sentences. Anything the
   page does not have today is skipped, so an empty locker or no live banner is fine. */
function steps(page, role, ctx) {
  const staff = role !== 'student';
  const you = {
    student: 'You are in as a student. Everything your team does this year lives here.',
    judge: 'You are in as a judge. This is what the cohort sees; your scoring view is one tap away.',
    coordinator: 'You are in as the coordinator. This is the student view; your own view is one tap away.',
    facilitator: ctx.isJudge
      ? 'You are in as a facilitator and a judge. This is the student view; your sessions and your scoring are each one tap away.'
      : 'You are in as a facilitator. This is the student view; your sessions are one tap away.',
  }[role];
  const home = [
    { at: ['#hello', '.hub-head'], title: 'Welcome to the Lab Hub', body: you },
    { at: ['#annList'], up: '.hcard', title: 'Announcements', body: 'Anything the program team needs the whole cohort to know lands here first. Check it before every session.' },
    { at: ['#sessList'], up: '.hcard', title: 'The AI Thread', body: 'Fourteen Monday sessions across the year. After each one, its recording and playbook (the step-by-step guide from that night) appear on its row here, so you never lose a session.' },
    { at: ['#progList'], up: '.hcard', title: 'The OPIL curriculum', body: (staff ? 'The Wednesday sessions the facilitators run' : 'Your Wednesday sessions with the facilitators') + ': Track 1 on the business, Track 2 on open payments, and the HPC series. Materials and recordings land on each row, the same as the AI Thread.' },
    { at: ['#mileList'], up: '.hcard', title: 'The year', body: 'The big dates: the December pitch, the February hackathon, the March showcase. "Add to calendar" puts all of it on your phone.' },
    staff
      ? { at: ['#teamCard'], up: '.hcard', title: 'A student’s team card', body: 'Students see their team, teammates, and the door to their team space here. You have no team by design, so yours stays empty.' }
      : { at: ['#teamCard', '#noTeamNote'], up: '.hcard', title: 'Your team', body: 'Your team, your teammates, and "Open team space", where the chat, the roster, and your checkpoints live. If you are not seated yet, this note says where your application stands.' },
    staff
      ? { at: ['.ln-team'], title: 'Your own view', body: role === 'judge' ? 'Judging is here. Everything else on this page is exactly what a student sees.' : 'Your ' + (role === 'coordinator' ? 'Coordinator' : 'My sessions') + ' view is here' + (role === 'facilitator' && ctx.isJudge ? ', and Judging next to it for the December pitch and the March showcase' : '') + '. Everything else on this page is exactly what a student sees; a blue band reminds you when you are looking at their side.' }
      : { at: ['.ln-primary', '.ln-dock'], title: 'Getting around', body: 'Home, My team, Messages, Showcase. On a phone these sit at the bottom of the screen, under your thumb.' },
  ];
  const team = [
    { at: ['#chatScroll'], up: '.hcard', title: 'Team chat', body: 'Live, and only your team can see it. Whatever you send here shows up for your teammates the moment you hit Send.' },
    { at: ['#roster'], up: '.hcard', title: 'Roster', body: 'Everyone seated on your team. The lead is whoever registered first; nothing else changes between lead and member.' },
    { at: ['#dvForm'], up: '.hcard', title: 'The locker', body: 'A checkpoint is a piece of work your team owes by a date. Drop it here, as a link or a file, against the session it belongs to. It all counts toward the December pitch and the March showcase.' },
    { at: ['.ln-tab[href="/opil/showcase/"]', '.ln-dock-a[href="/opil/showcase/"]'], title: 'Showcase', body: 'When the program team publishes a piece of your work, it appears on the public showcase with your names on it.' },
  ];
  const judge = [
    { at: ['#evPitch'], up: 'div', title: 'Which event', body: 'Pitch in December, Showcase in March. Pick the one you are scoring; your scores are kept separately for each.' },
    { at: ['#teams'], title: 'The teams', body: 'One card per team. Open a card to see the work they have published and the rubric underneath it.' },
    { at: ['#teams .rub .cr'], title: 'Four criteria, one to five', body: 'Problem and customer, business model, prototype and payment flow, presentation. Tap a number for each. Twenty is the most a team can score.' },
    { at: ['#teams .rub .save'], title: 'Save per team', body: 'Save writes your score for that team. You can come back and revise until the event closes. The notes box goes to the program team, never to the students.' },
  ];
  const admin = [
    { at: ['#stats'], title: 'The numbers', body: 'Teams forming, students applied, attendance so far, and how many teams have work in the locker. Live, from the same data the students see.' },
    { at: ['#regTbl'], up: '.hcard', title: 'Registrations', body: 'Every application. The + on a row opens every answer, the resumes open in a new tab, and Approve seats that student on their team the next time they sign in.' },
    { at: ['#sessMgr'], up: '.hcard', title: 'Sessions and content', body: 'For each session: paste the recording and playbook links, set a check-in code to read out on the night, and upload materials. Add a session at the bottom of the list for anything the facilitators run. To broadcast, open the live room: its Broadcast control goes live from this device\u2019s camera, nothing to install.' },
    { at: ['#facForm'], up: '.hcard', title: 'Facilitators', body: 'Add a facilitator by email and tick the sessions they lead. When they sign in they get My sessions: their sessions only, with the same recording, materials and check-in controls you have here.' },
    { at: ['#attWrap'], up: '.hcard', title: 'Attendance', body: 'One cell per student per session. Tap to mark; students can also check themselves in with the code you set.' },
    { at: ['#judgeForm'], up: '.hcard', title: 'Judges and scores', body: 'Add a judge by email and they get the scoring view the moment they sign in. Averages per team show up here as scores come in.' },
    { at: ['#annForm'], up: '.hcard', title: 'Announcements', body: 'Whatever you post here is the first thing every student sees on their hub home.' },
    { at: ['.ln-primary', '.ln-dock'], title: 'See what they see', body: 'Home, My team, Messages, Showcase open the student side exactly as the cohort has it. A blue band up top brings you back here in one tap.' },
  ];
  /* My sessions: the coordinator page, filtered to one facilitator's rows. The steps point
     inside the first row (the engine opens it), so every control gets named once. */
  const facilitator = [
    { at: ['.hub-head'], title: 'Your sessions', body: 'You are in as a facilitator. Only the sessions you lead are listed here; the coordinator manages the rest. Open a row to run a session.' },
    { at: ['#sessMgr'], up: '.hcard', title: 'One row per session', body: 'Each row is a session with its date and what is attached so far. The ✎ opens it. Anything you save here shows up on the students\u2019 hub home within seconds.' },
    { at: ['input[data-f="recording"]'], title: 'Recording and playbook', body: 'After the session, paste the recording link and the playbook link (the step-by-step guide from that night) here. Students find both on that session\u2019s row.' },
    { at: ['.addMat'], title: 'Materials', body: 'An assignment is work you want back; a resource is something to read or use. Either is a link, such as your Zoom link, a reading, a form, or a file up to 25 MB. It appears under the session on every student\u2019s home.' },
    { at: ['input[data-f="checkin"]'], title: 'Check-in code', body: 'Generate a code and read it out on the night. Students type it on their hub home to mark themselves present, so attendance is theirs to claim rather than yours to chase.' },
    { at: ['.camBtn'], title: 'Going live', body: 'Go live from this device uses your own camera and mic, nothing to install. Students watch in the live room with cohort chat beside the video, and when you end, the recording saves itself into this session\u2019s Recording link.' },
    { at: ['.saveSess'], title: 'Save', body: 'Save writes the recording link, playbook link and check-in code for this session. Materials save on their own the moment you add them.' },
    ctx.isJudge
      ? { at: ['a.ln-team[href="/opil/hub/judge/"]', 'a[href="/opil/hub/judge/"]'], title: 'You also judge', body: 'Scoring for the December pitch and the March showcase lives under Judging: four criteria, one to five each, per team. It has its own short tour.' }
      : null,
    { at: ['.ln-primary', '.ln-dock'], title: 'See what they see', body: 'Home, My team, Messages, Showcase open the student side exactly as the cohort has it. A blue band up top brings you back here in one tap.' },
  ].filter(Boolean);
  const by = { home, team, judge, admin: role === 'facilitator' ? facilitator : admin };
  return by[page] || [];
}

/* ---------------------------------------------------------------- engine */
let live = null;   /* the running tour, so a second call replaces instead of stacking */

function visible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function find(step) {
  for (const sel of step.at) {
    let el = document.querySelector(sel);
    if (!el) continue;
    /* a target inside a closed <details> is on the page but has no box: open it */
    const d = el.closest('details'); if (d && !d.open) d.open = true;
    if (step.up) el = el.closest(step.up) || el;
    if (visible(el)) return el;
  }
  return null;
}

/* Rows and cards render after the page's data lands, a beat after nav() starts the tour.
   Look again, briefly, until the set of reachable targets stops growing. */
function settled(list) {
  return new Promise((res) => {
    let last = -1, same = 0, tries = 0;
    const tick = () => {
      const found = list.map(s => ({ ...s, el: find(s) })).filter(s => s.el);
      if (found.length === list.length || ++tries > 20 || (found.length === last && ++same >= 3)) return res(found);
      if (found.length !== last) { last = found.length; same = 0; }
      setTimeout(tick, 150);
    };
    tick();
  });
}

export function start(ctx, page) {
  const wanted = steps(page, roleOf(ctx), ctx);
  if (!wanted.length) return false;
  settled(wanted).then((all) => { if (all.length) run(all, page); });
  return true;
}

function run(all, page) {
  if (live) live.close(false);

  const veil = document.createElement('div'); veil.className = 'tr-veil';
  const spot = document.createElement('div'); spot.className = 'tr-spot';
  const card = document.createElement('div'); card.className = 'tr-card';
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'false'); card.setAttribute('aria-live', 'polite');
  document.body.append(veil, spot, card);
  document.body.classList.add('tr-on');

  let i = 0, raf = 0;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function place() {
    const el = all[i].el;
    const r = el.getBoundingClientRect(), pad = 8;
    spot.style.cssText = `top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    if (window.matchMedia('(max-width:720px)').matches) { card.style.cssText = ''; return; }   /* docked by CSS */
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    let top = r.bottom + gap;
    if (top + ch > window.innerHeight - 16) top = Math.max(16, r.top - ch - gap);   /* no room below: above */
    let left = Math.min(Math.max(16, r.left), window.innerWidth - cw - 16);
    card.style.cssText = `top:${top}px;left:${left}px`;
  }
  function render() {
    const s = all[i], last = i === all.length - 1;
    card.innerHTML = `<div class="tr-n">Step ${i + 1} of ${all.length}</div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>
      <div class="tr-row"><button type="button" class="tr-x" aria-label="Close the tour">Skip</button><span style="flex:1"></span>
      ${i ? '<button type="button" class="tr-b">Back</button>' : ''}<button type="button" class="tr-go">${last ? 'Done' : 'Next'}</button></div>`;
    s.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    /* measure after the scroll has had a frame; keep following the page after that */
    requestAnimationFrame(() => { place(); card.querySelector('.tr-go').focus({ preventScroll: true }); });
    setTimeout(place, 450);   /* once the smooth scroll has settled on a long page */
  }
  function go(d) { i = Math.max(0, Math.min(all.length - 1, i + d)); render(); }
  function close(done) {
    cancelAnimationFrame(raf);
    veil.remove(); spot.remove(); card.remove();
    document.body.classList.remove('tr-on');
    window.removeEventListener('resize', follow); window.removeEventListener('scroll', follow, true);
    document.removeEventListener('keydown', keys);
    /* a dismissed tour is a seen tour: never nag */
    try { localStorage.setItem(KEY(page), done ? 'done' : 'skipped'); } catch (e) {}
    live = null;
  }
  function follow() { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }
  function keys(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close(false); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); i === all.length - 1 ? close(true) : go(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
  }
  card.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.classList.contains('tr-x')) close(false);
    else if (b.classList.contains('tr-b')) go(-1);
    else if (b.classList.contains('tr-go')) (i === all.length - 1 ? close(true) : go(1));
  });
  window.addEventListener('resize', follow); window.addEventListener('scroll', follow, true);
  document.addEventListener('keydown', keys);
  live = { close };
  render();
  return true;
}

/* First visit only, unless ?tour=1. Returns whether a tour exists for this page at all,
   so the nav knows whether to show its "Show me around" control. */
export function tour(ctx, page) {
  const has = steps(page, roleOf(ctx), ctx).length > 0;
  if (!has) return false;
  const force = new URLSearchParams(location.search).get('tour') === '1';
  let seen = null; try { seen = localStorage.getItem(KEY(page)); } catch (e) {}
  if (!seen || force) start(ctx, page);
  return true;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const asModule = value => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`;
const progressSource = fs.readFileSync(new URL('../../ht/hub/campus-onboarding-progress.js', import.meta.url), 'utf8');
const progressURL = asModule(progressSource);
const source = fs.readFileSync(new URL('../../ht/hub/campus-onboarding.js', import.meta.url), 'utf8').replace("new URL(import.meta.url).search", "''").replace("import('./campus-onboarding-progress.js' + assetStamp)", `import('${progressURL}')`);
const { createOnboardingProgress, onboardingSteps } = await import(progressURL);
const { renderOnboarding, renderOnboardingPrompt, renderPageOrientation, bindOnboarding, onboardingDestinations } = await import(asModule(source));
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let nextIdentity = 0;
function context(role = 'student', mode = 'demo') {
  const id = `member-${++nextIdentity}`;
  const values = new Map();
  const ctx = {
    state: { mode, user: { id }, member: { user_id: id, role, active: true, display_name: 'Test member' }, settings: {} },
    esc: escape, icon: name => `<svg data-icon="${name}" aria-hidden="true"></svg>`,
    href: (view, query = {}) => { const url = new URL(view.startsWith('/') ? view : `/ht/hub/${view === 'home' ? '' : view === 'people' ? 'messages/' : `${view}/`}`, 'https://ht.invalid'); url.searchParams.set('demo', role === 'admin' ? 'staff' : role); for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value); return url.pathname + url.search + url.hash; },
    onboarding: createOnboardingProgress({ storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } }),
    refreshes: 0, notices: [], refresh() { this.refreshes++; }, notify(message) { this.notices.push(message); },
  };
  return ctx;
}
function at(url, run) { const previous = globalThis.location; globalThis.location = { href: url }; try { return run(); } finally { if (previous === undefined) delete globalThis.location; else globalThis.location = previous; } }
function fakeRoot() {
  const listeners = new Map(), nodes = new Set(), selectors = new Map();
  return { listeners, nodes, selectors,
    addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
    contains: node => nodes.has(node), querySelector: selector => selectors.get(selector) || null,
    querySelectorAll: selector => selectors.get(selector) || [],
    click(action, tagName = 'BUTTON', extra = {}) { const node = { tagName, dataset: { onboardingAction: action } }; nodes.add(node); const event = { target: { closest: () => node }, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra }; listeners.get('click')?.(event); return event; },
  };
}

test('student first-use guide has one primary course action, seven optional stops, and accurate progress wording', () => {
  const ctx = context();
  const html = renderOnboarding('welcome', ctx);
  assert.match(html, /Student guide/); assert.match(html, /Find my courses/); assert.match(html, /0 of 7 places explored/);
  assert.equal((html.match(/class="campus-onboarding-step(?: |")/g) || []).length, 7);
  assert.match(html, /not coursework or tasks completed/); assert.match(html, /Explore on my own/);
  assert.match(html, /href="#campusOnboardingMap">Find any page/);
  assert.doesNotMatch(html, /data-onboarding-action="complete"/);
  assert.match(html, /data-campus-onboarding/);
  assert.equal(renderOnboarding('courses', ctx), '');
});

test('staff and administrator guides prioritize teaching and expose role-appropriate destinations', () => {
  for (const role of ['staff', 'admin']) {
    const ctx = context(role), html = renderOnboarding('welcome', ctx);
    assert.match(html, /Staff guide/); assert.match(html, /Open my teaching workspace/); assert.match(html, /0 of 7 places explored/);
    const destinations = onboardingDestinations(ctx);
    assert.ok(destinations.some(item => item.title === 'Teach your courses'));
    assert.ok(destinations.some(item => item.title === 'Manage sections & enrollment' && item.query.manage === '1'));
    assert.ok(destinations.some(item => item.view === 'staff'));
    assert.ok(destinations.some(item => item.view === 'insights'));
  }
  const destinations = onboardingDestinations(context());
  assert.ok(!destinations.some(item => item.view === 'staff' || item.view === 'insights' || item.query?.manage));
});

test('leadership receives insights orientation without instructor tools', () => {
  const ctx = context('leadership'), html = renderOnboarding('welcome', ctx);
  assert.match(html, /Leadership guide/); assert.match(html, /0 of 3 places explored/); assert.match(html, /Explore campus insights/);
  assert.ok(onboardingDestinations(ctx).some(item => item.view === 'insights'));
  assert.ok(!onboardingDestinations(ctx).some(item => item.view === 'staff' || item.query?.manage));
});

test('guest, unavailable, inactive, and mismatched accounts get a public map with no onboarding write controls', () => {
  for (const variation of ['guest', 'unavailable', 'inactive', 'mismatched']) {
    const ctx = context('staff', ['guest', 'unavailable'].includes(variation) ? variation : 'live');
    if (variation === 'inactive') ctx.state.member.active = false;
    if (variation === 'mismatched') ctx.state.member.user_id = 'someone-else';
    const html = renderOnboarding('welcome', ctx);
    assert.match(html, /Sign in to your campus workspace/); assert.match(html, /Find a page/);
    assert.doesNotMatch(html, /data-onboarding-action|Your staff workspace|0 of 7/);
    assert.equal(renderOnboardingPrompt('home', ctx), '');
  }
});

test('site map contains all primary destinations and allowlisted office previews, escaping office content', () => {
  const previous = globalThis.window;
  globalThis.window = { HT: { spaces: { career: { title: '<img src=x onerror=alert(1)>Career', blurb: '<script>unsafe</script>', office: 'Career "services"' }, events: { title: 'Duplicate events' }, live: { title: 'Duplicate live' }, '../../../evil': { title: 'Evil route' }, showcase: { title: 'Student showcase', blurb: 'Projects and achievements' } } } };
  try {
    const ctx = context(), items = onboardingDestinations(ctx), html = renderOnboarding('welcome', ctx);
    for (const view of ['home', 'courses', 'learn', 'live', 'community', 'people', 'events', '/ht/hub/calendar/', 'support', 'spaces']) assert.equal(items.filter(item => item.view === view).length, 1, view);
    assert.equal(items.filter(item => item.group === 'Office previews').length, 2);
    assert.match(html, /Office previews/); assert.match(html, /labeled examples/); assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;Career/);
    assert.doesNotMatch(html, /<script>|<img src=x|Duplicate events|Duplicate live|Evil route|href="[^"]*evil/);
    assert.match(html, /href="\/ht\/hub\/career\//);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test('Ada orientation always has a readable guide and only links to Today for an available recording', () => {
  const ctx = context(); let html = renderOnboarding('welcome', ctx);
  assert.match(html, /use this written guide without watching a video/); assert.match(html, /recorded welcome will be added/);
  assert.doesNotMatch(html, /<video|<iframe|autoplay|Find Ada’s recorded/);
  ctx.state.settings.ada_video_url = 'https://video.example/welcome.mp4';
  html = renderOnboarding('welcome', ctx);
  assert.match(html, /Find Ada’s recorded welcome on Today/); assert.doesNotMatch(html, /https:\/\/video.example/);
  assert.match(html, /Community posts are visible in the campus feed/);
});

test('active progress resumes the next unexplored destination and completion is offered only after every stop', () => {
  const ctx = context(); ctx.onboarding.start(ctx.state); ctx.onboarding.visit(ctx.state, 'courses');
  let html = renderOnboarding('welcome', ctx);
  assert.match(html, /1 of 7 places explored/); assert.match(html, /Continue: Find your classroom/); assert.match(html, /is-explored/); assert.match(html, />Explored</);
  assert.doesNotMatch(html, /data-onboarding-action="complete"/);
  for (const step of onboardingSteps('student')) ctx.onboarding.visit(ctx.state, step.id);
  html = renderOnboarding('welcome', ctx); assert.match(html, /Finish my guide/);
  ctx.onboarding.complete(ctx.state); html = renderOnboarding('welcome', ctx);
  assert.match(html, /You know your way around/); assert.match(html, /Restart guide/); assert.match(html, /Go to Today/);
});

test('per-page help replaces the generic banner, while dismissed or completed full-site guides never auto-prompt', () => {
  const ctx = context();
  assert.equal(renderOnboardingPrompt('courses', ctx), ''); assert.equal(renderOnboardingPrompt('home', ctx), '');
  assert.match(renderPageOrientation('courses', ctx), /Full site guide/);
  assert.equal(renderOnboardingPrompt('welcome', ctx), '');
  ctx.onboarding.dismiss(ctx.state);
  assert.equal(renderOnboardingPrompt('home', ctx), ''); assert.equal(renderOnboardingPrompt('courses', ctx), '');
  ctx.onboarding.restart(ctx.state); for (const step of onboardingSteps('student')) ctx.onboarding.visit(ctx.state, step.id); ctx.onboarding.complete(ctx.state);
  assert.equal(renderOnboardingPrompt('home', ctx), '');
});

test('every primary Hub destination has a concise first-visit explanation and a route back to the full guide', () => {
  const ctx = context();
  const views = ['home', 'courses', 'learn', 'events', 'community', 'people', 'spaces', 'support', 'staff', 'insights', 'live'];
  for (const view of views) {
    const html = renderPageOrientation(view, ctx);
    assert.match(html, /class="campus-page-guide"/, view);
    assert.match(html, /First time here\?/, view);
    assert.match(html, /Full site guide/, view);
    assert.match(html, /data-campus-page-guide=/, view);
  }
  assert.equal(renderPageOrientation('welcome', ctx), '');
  assert.equal(renderPageOrientation('unavailable', ctx), '');
  assert.match(renderPageOrientation('community', ctx), /Community posts are visible to campus members/);
  assert.match(renderPageOrientation('people', ctx), /private to the people in that conversation/);
  assert.match(renderPageOrientation('live', ctx), /cohort classroom/);
});

test('page guidance changes for staff, course sections, and assigned classroom tools', () => {
  const staff = context('staff');
  assert.match(renderPageOrientation('courses', staff), /section you teach/);
  assert.match(renderPageOrientation('courses', staff), /gradebook/i);
  assert.match(renderPageOrientation('live', staff), /sections assigned to you/);
  assert.match(renderPageOrientation('staff', staff), /Announcements, Events, Learning, or Review work/);
  const leadership = context('leadership');
  assert.match(renderPageOrientation('insights', leadership), /private student work and messages remain/);
});

test('page guides arrive collapsed and leave the page once seen', () => {
  const ctx = context(), previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const html = renderPageOrientation('community', ctx);
    const key = `ht-hub-page-guide:v1:${encodeURIComponent(`demo:student:${ctx.state.user.id}:community`)}`;
    assert.match(html, /<details class="campus-page-guide"/);
    assert.doesNotMatch(html, /<details class="campus-page-guide"[^>]* open>/);
    assert.match(html, /data-page-guide-done>Got it/);
    values.set(key, 'seen');
    assert.equal(renderPageOrientation('community', ctx), '');
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});

test('Got it stores only this page guide and leaves the whole-site guide available', () => {
  const ctx = context(), previous = globalThis.localStorage, values = new Map(), root = fakeRoot();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const key = `ht-hub-page-guide:v1:${encodeURIComponent(`demo:student:${ctx.state.user.id}:community`)}`;
  const summary = { focused: false, focus() { this.focused = true; } };
  const details = { open: true, dataset: { campusPageGuide: key }, querySelector: () => summary };
  details.matches = selector => selector === '[data-campus-page-guide]';
  const done = { dataset: { pageGuideDone: '' }, matches: selector => selector === '[data-page-guide-done]', closest: selector => selector === '[data-campus-page-guide]' ? details : null };
  root.nodes.add(done); root.nodes.add(details);
  const previousLocation = globalThis.location;
  globalThis.location = { href: 'https://ht.invalid/ht/hub/community/?demo=student' };
  try {
    bindOnboarding('community', root, ctx);
    root.listeners.get('click')({ target: { closest: selector => selector === '[data-page-guide-done]' ? done : null } });
    assert.equal(values.get(key), 'seen'); assert.equal(details.open, false); assert.equal(summary.focused, true);
    assert.equal(ctx.onboarding.read(ctx.state).status, 'new');
    // The page tip is gone; the whole-site guide stays in the header and on Today.
    assert.equal(renderPageOrientation('community', ctx), '');
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; if (previousLocation === undefined) delete globalThis.location; else globalThis.location = previousLocation; }
});

test('guided destinations show their tour instruction instead of duplicate page help', () => {
  const ctx = context(); ctx.onboarding.start(ctx.state); ctx.onboarding.visit(ctx.state, 'courses');
  const html = at('https://ht.invalid/ht/hub/courses/?guide=courses', () => renderPageOrientation('courses', ctx));
  assert.equal(html, '');
});

test('deep course tabs and message threads name the page the visitor is actually viewing', () => {
  const ctx = context();
  let html = at('https://ht.invalid/ht/hub/courses/?cohort=section&tab=assignments', () => renderPageOrientation('courses', ctx));
  assert.match(html, /See how to use Assignments/); assert.match(html, /due dates, then submit your work/);
  html = at('https://ht.invalid/ht/hub/messages/?person=member', () => renderPageOrientation('people', ctx));
  assert.match(html, /See how to use Conversation/); assert.match(html, /write your reply in the message box/);
  html = at('https://ht.invalid/ht/hub/live/?cohort=section', () => renderPageOrientation('live', ctx));
  assert.match(html, /See how to use Cohort classroom/);
  html = at('https://ht.invalid/ht/hub/messages/?new=1', () => renderPageOrientation('people', ctx));
  assert.match(html, /See how to use New message/); assert.match(html, /Search the campus directory/);
  html = at('https://ht.invalid/ht/hub/support/?request=request-id', () => renderPageOrientation('support', ctx));
  assert.match(html, /See how to use Support request/); assert.match(html, /campus team’s replies/);
  const staff = context('staff');
  html = at('https://ht.invalid/ht/hub/live/?manage=1&cohort=section', () => renderPageOrientation('live', staff));
  assert.match(html, /See how to use Classroom management/); assert.match(html, /manage classrooms, enrollment, or scheduled sessions/);
});

test('contextual guide validates requested step and route; persisted current step supports inner course navigation', () => {
  const ctx = context(); ctx.onboarding.start(ctx.state); ctx.onboarding.visit(ctx.state, 'courses');
  let html = at('https://ht.invalid/ht/hub/courses/?guide=courses', () => renderOnboardingPrompt('courses', ctx));
  assert.match(html, /Start with your courses/); assert.match(html, /Next: Find your classroom/); assert.match(html, /Back to guide/);
  html = at('https://ht.invalid/ht/hub/courses/?cohort=section&tab=assignments', () => renderOnboardingPrompt('courses', ctx));
  assert.match(html, /campus-onboarding-context/);
  assert.equal(at('https://ht.invalid/ht/hub/courses/?guide=insights', () => renderOnboardingPrompt('courses', ctx)), '');
  assert.equal(at('https://ht.invalid/ht/hub/events/?guide=courses', () => renderOnboardingPrompt('events', ctx)), '');
  assert.match(at('https://ht.invalid/ht/hub/', () => renderOnboardingPrompt('home', ctx)), /Resume guide/);
  assert.equal(at('https://ht.invalid/ht/hub/events/', () => renderOnboardingPrompt('events', ctx)), '');
});

test('last explored destination points back to explicit guide completion', () => {
  const ctx = context(); for (const step of onboardingSteps('student')) ctx.onboarding.visit(ctx.state, step.id);
  const html = at('https://ht.invalid/ht/hub/spaces/?guide=spaces', () => renderOnboardingPrompt('spaces', ctx));
  assert.match(html, /7 of 7 places explored/); assert.match(html, />Finish guide</); assert.doesNotMatch(html, />Next:/);
});

test('blocked browser storage is explained without disabling guide destinations', () => {
  const ctx = context(); ctx.onboarding = createOnboardingProgress({ storage: null });
  const html = renderOnboarding('welcome', ctx);
  assert.match(html, /browser cannot save guide progress/); assert.match(html, /Find my courses/); assert.match(html, /Find your way anywhere/);
});

test('start and skip anchors save progress and keep native navigation without refreshing or preventing the click', () => {
  const ctx = context(), root = fakeRoot(), cleanup = bindOnboarding('welcome', root, ctx);
  const event = root.click('start', 'A');
  assert.equal(ctx.onboarding.read(ctx.state).status, 'active'); assert.equal(event.defaultPrevented, false); assert.equal(ctx.refreshes, 0);
  const skipped = root.click('dismiss', 'A');
  assert.equal(ctx.onboarding.read(ctx.state).status, 'dismissed'); assert.equal(skipped.defaultPrevented, false); assert.equal(ctx.refreshes, 0);
  cleanup(); assert.equal(root.listeners.size, 0);
});

test('dismissal removes only guide query and preserves form-route parameters and hash before refreshing', async () => {
  const ctx = context(), root = fakeRoot(); ctx.onboarding.start(ctx.state);
  const previousLocation = globalThis.location, previousHistory = globalThis.history; let rewritten;
  globalThis.location = { href: 'https://ht.invalid/ht/hub/courses/?demo=student&cohort=course&tab=assignments&guide=courses#draft' };
  globalThis.history = { state: { keep: true }, replaceState(state, title, url) { assert.deepEqual(state, { keep: true }); rewritten = url; } };
  try {
    const cleanup = bindOnboarding('courses', root, ctx); root.click('dismiss'); await Promise.resolve();
    assert.equal(ctx.onboarding.read(ctx.state).status, 'dismissed'); assert.equal(ctx.refreshes, 1);
    assert.equal(rewritten, '/ht/hub/courses/?demo=student&cohort=course&tab=assignments#draft'); cleanup();
  } finally { if (previousLocation === undefined) delete globalThis.location; else globalThis.location = previousLocation; if (previousHistory === undefined) delete globalThis.history; else globalThis.history = previousHistory; }
});

test('action binding denies unauthenticated writes, ignores unknown actions, and cannot prematurely complete', () => {
  let ctx = context('staff', 'guest'), root = fakeRoot(); bindOnboarding('welcome', root, ctx); root.click('start');
  assert.equal(ctx.onboarding.read(ctx.state).role, null); assert.equal(ctx.refreshes, 0);
  ctx = context(); root = fakeRoot(); bindOnboarding('welcome', root, ctx); root.click('deleteCampus'); assert.equal(ctx.refreshes, 0);
  root.click('complete'); assert.notEqual(ctx.onboarding.read(ctx.state).status, 'complete'); assert.equal(ctx.notices.length, 0);
});

function searchRoot() {
  const root = fakeRoot();
  const input = { value: '', matches: selector => selector === '[data-onboarding-search]' };
  const destinations = ['assignments courses learning', 'messages inbox direct', 'career office preview'].map(onboardingDestination => ({ dataset: { onboardingDestination }, hidden: false }));
  const groups = [destinations.slice(0, 2), destinations.slice(2)].map(items => ({ hidden: false, querySelectorAll: () => items }));
  const count = { textContent: '3 destinations' }, empty = { hidden: true };
  root.selectors.set('[data-onboarding-search]', input); root.selectors.set('[data-onboarding-destination]', destinations); root.selectors.set('[data-onboarding-map-group]', groups); root.selectors.set('[data-onboarding-search-count]', count); root.selectors.set('[data-onboarding-no-results]', empty);
  return { root, input, destinations, groups, count, empty, search(value) { input.value = value; root.listeners.get('input')({ target: input }); } };
}

test('site-map search filters pages and groups in place, announces the count, and offers useful no-results help', () => {
  const ctx = context(), ui = searchRoot(); const cleanup = bindOnboarding('welcome', ui.root, ctx);
  ui.search('  MESSAGES  ');
  assert.deepEqual(ui.destinations.map(item => item.hidden), [true, false, true]); assert.deepEqual(ui.groups.map(item => item.hidden), [false, true]);
  assert.equal(ui.count.textContent, '1 destination found'); assert.equal(ui.empty.hidden, true); assert.equal(ctx.refreshes, 0);
  ui.search('does not exist'); assert.equal(ui.count.textContent, '0 destinations found'); assert.equal(ui.empty.hidden, false);
  ui.search(''); assert.equal(ui.count.textContent, '3 destinations'); assert.deepEqual(ui.groups.map(item => item.hidden), [false, false]); cleanup();
});

test('search survives a routine rerender without storing the query in onboarding progress or crossing account identity', () => {
  const ctx = context(), first = searchRoot(); const cleanup = bindOnboarding('welcome', first.root, ctx);
  first.search('career'); cleanup();
  const second = searchRoot(); const cleanupSecond = bindOnboarding('welcome', second.root, ctx);
  assert.equal(second.input.value, 'career'); assert.deepEqual(second.destinations.map(item => item.hidden), [true, true, false]);
  assert.deepEqual(ctx.onboarding.read(ctx.state).visited, []); assert.equal(ctx.refreshes, 0); cleanupSecond();
  const other = searchRoot(); bindOnboarding('welcome', other.root, context()); assert.equal(other.input.value, '');
});

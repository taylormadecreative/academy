/* An optional, role-aware guide. Exploring a page never changes campus records. */
const assetStamp = new URL(import.meta.url).search;
const { getOnboardingRole, onboardingSteps } = await import('./campus-onboarding-progress.js' + assetStamp);
const escape = (ctx, value) => ctx.esc(String(value ?? ''));
const icon = (ctx, name) => typeof ctx.icon === 'function' ? ctx.icon(name) : '';
const officeKeys = ['advancement', 'president', 'showcase', 'students', 'career', 'alumni', 'admissions', 'outreach', 'board'];
const searchQueries = new Map();
const roleNames = { student: 'Student guide', staff: 'Staff guide', admin: 'Staff guide', leadership: 'Leadership guide' };
const pageGuidance = {
  home: { title: 'Today', steps: ['Start with the next course or campus update that matters to you.', 'Use Learning, Community, Messages, or Campus to continue.'] },
  courses: { title: 'My courses', steps: ['Choose a course section to open its workspace.', 'Use Overview, Modules, Assignments, Grades, and People to find the right course task.'] },
  learn: { title: 'Learning pathways', steps: ['Choose a pathway to see its readings and practice sessions.', 'Work through activities in order; pathway progress is separate from course assignments and grades.'] },
  events: { title: 'Events', steps: ['Browse campus events and open one to check its date, time, and location.', 'RSVP when that option is available. Use the Academic calendar for published term dates.'] },
  community: { title: 'Community', steps: ['Choose a channel to see its conversation.', 'Reply to a post or write an update. Community posts are visible to campus members.'] },
  people: { title: 'Messages', steps: ['Choose a conversation from your inbox, or select New message to find someone.', 'Messages are private to the people in that conversation.'] },
  spaces: { title: 'Around campus', steps: ['Search for an office, program, or service, then open its card.', 'Use Messages to contact someone or Get help when you are unsure where to go.'] },
  support: { title: 'Get help', steps: ['Choose the kind of help you need and explain the question or issue.', 'Review the details before sending. Return here to follow replies and status.'] },
  staff: { title: 'Staff workspace', steps: ['Choose Announcements, Events, Learning, or Review work for the campus task at hand.', 'Use My courses to teach a section, review submissions, and manage published grades.'] },
  insights: { title: 'Campus insights', steps: ['Choose a date range or summary to understand activity over time.', 'Use these campus-level indicators for context; private student work and messages remain in their permitted workspaces.'] },
  live: { title: 'Classrooms & live sessions', steps: ['Choose your cohort classroom for course sessions, materials, attendance, and replays.', 'Campus-wide events have their own listing. Classroom management appears only to assigned instructors and administrators.'] },
};
const fallbackProgress = role => ({ role, status: 'new', visited: [], activeStep: null, persistent: false });
const progressFor = ctx => ctx.onboarding?.read(ctx.state) || fallbackProgress(getOnboardingRole(ctx.state));
const stepHref = (ctx, step) => ctx.href(step.view, { guide: step.id });
const anchor = (ctx, href, text, classes = '', attributes = '') => `<a${classes ? ` class="${classes}"` : ''} href="${escape(ctx, href)}"${attributes ? ` ${attributes}` : ''}>${escape(ctx, text)}</a>`;
const button = (action, text, classes = 'campus-button campus-button-secondary') => `<button type="button" class="${classes}" data-onboarding-action="${action}">${text}</button>`;
function currentProgress(ctx) {
  const role = getOnboardingRole(ctx.state), steps = onboardingSteps(role), saved = progressFor(ctx);
  const visited = steps.filter(step => (saved.visited || []).includes(step.id)).map(step => step.id);
  return { ...saved, role, steps, visited, next: steps.find(step => !visited.includes(step.id)) || null };
}
function progressMarkup(progress) {
  return `<div class="campus-onboarding-progress"><span>${progress.visited.length} of ${progress.steps.length} places explored</span><progress value="${progress.visited.length}" max="${Math.max(1, progress.steps.length)}" aria-label="Places explored in your guide"></progress></div>`;
}
function persistence(progress) {
  return `<p class="campus-muted campus-onboarding-status">${progress.persistent ? 'Your guide progress is saved in this browser.' : 'Your browser cannot save guide progress right now. You can still explore every page.'} This checklist tracks pages you explore, not coursework or tasks completed.</p>`;
}
function roleIntroduction(role) {
  if (role === 'staff' || role === 'admin') return { title: 'Make yourself at home.', text: 'Start with your teaching workspace, then find the people and tools that keep your campus moving.', first: 'Open my teaching workspace' };
  if (role === 'leadership') return { title: 'Get to know your campus workspace.', text: 'Find campus insights, hear the community, and explore the offices that support life on the Hill.', first: 'Explore campus insights' };
  return { title: 'Your campus. A place to begin.', text: 'Find your courses first. Then discover your classroom, campus conversations, messages, events, and people who can help.', first: 'Find my courses' };
}
function guideHero(ctx, progress) {
  const intro = roleIntroduction(progress.role);
  const complete = progress.status === 'complete';
  const primary = complete ? anchor(ctx, ctx.href('home'), 'Go to Today', 'campus-button') : progress.next ? anchor(ctx, stepHref(ctx, progress.next), progress.status === 'new' ? intro.first : progress.visited.length ? `Continue: ${progress.next.title}` : intro.first, 'campus-button', 'data-onboarding-action="start"') : button('complete', 'Finish my guide', 'campus-button');
  return `<section class="campus-panel campus-onboarding-hero" aria-labelledby="campusOnboardingWelcome"><div><p class="campus-eyebrow">${roleNames[progress.role] || 'Your Hub guide'} · At your own pace</p><h2 id="campusOnboardingWelcome" tabindex="-1" data-onboarding-focus>${complete ? 'You know your way around.' : intro.title}</h2><p class="campus-lede">${complete ? 'Your guide is complete. Keep this page close whenever you need a shortcut or a reminder.' : intro.text}</p><div class="campus-onboarding-actions">${primary}${anchor(ctx, '#campusOnboardingMap', 'Find any page')}${!complete ? anchor(ctx, ctx.href('home'), 'Explore on my own', 'campus-onboarding-text-button', 'data-onboarding-action="dismiss"') : button('restart', 'Restart guide', 'campus-onboarding-text-button')}</div></div><div class="campus-onboarding-hero-progress">${progressMarkup(progress)}<p>${complete ? 'You can revisit any stop below.' : 'A short tour, with room to explore. You can leave and return to Guide at any time.'}</p></div></section>`;
}
function checklist(ctx, progress) {
  return `<section class="campus-panel campus-onboarding-checklist" aria-labelledby="campusOnboardingStops"><div class="campus-section-head"><div><h2 id="campusOnboardingStops">Your first stops</h2><p class="campus-muted">Open a page to explore it. Choose any stop in any order.</p></div>${progress.visited.length && progress.status !== 'complete' ? button('restart', 'Start over', 'campus-onboarding-text-button') : ''}</div><ol role="list">${progress.steps.map((step, index) => { const visited = progress.visited.includes(step.id); return `<li class="campus-onboarding-step${visited ? ' is-explored' : ''}${progress.next?.id === step.id ? ' is-next' : ''}"><span class="campus-onboarding-step-number" aria-hidden="true">${visited ? icon(ctx, 'check') : index + 1}</span><div><div class="campus-onboarding-step-title"><h3>${escape(ctx, step.title)}</h3>${visited ? '<span class="campus-onboarding-explored">Explored</span>' : progress.next?.id === step.id ? '<span class="campus-onboarding-next">Suggested next</span>' : ''}</div><p>${escape(ctx, step.description)}</p>${anchor(ctx, stepHref(ctx, step), step.action, '', 'data-onboarding-action="start"')}</div></li>`; }).join('')}</ol>${persistence(progress)}</section>`;
}
const primaryDestinations = [
  { group: 'Learning & your day', title: 'Today', view: 'home', description: 'Your starting point for learning, updates, and what is coming up.', keywords: 'home dashboard welcome ada announcements', icon: 'home' },
  { group: 'Learning & your day', title: 'My courses', view: 'courses', description: 'Open your enrolled sections, lessons, assignments, feedback, and grades.', keywords: 'learning lms coursework homework modules teacher instructor gradebook submit', icon: 'book' },
  { group: 'Learning & your day', title: 'Learning pathways', view: 'learn', description: 'Build skills with readings, practice, and pathway completion activities.', keywords: 'training curriculum skills learning modules', icon: 'book' },
  { group: 'Learning & your day', title: 'Classrooms & live sessions', view: 'live', description: 'Find your cohort classroom, scheduled sessions, and available replays.', keywords: 'zoom video meeting class attendance cohort room replay recording', icon: 'play' },
  { group: 'People & campus life', title: 'Community', view: 'community', description: 'Follow campus channels, join conversations, and share with your community.', keywords: 'posts discussion groups channels feed clubs social', icon: 'users' },
  { group: 'People & campus life', title: 'Messages', view: 'people', description: 'Find campus members and keep direct conversations in one inbox.', keywords: 'dm dms chat communication inbox private direct directory people', icon: 'chat' },
  { group: 'People & campus life', title: 'Events', view: 'events', description: 'Discover campus gatherings and reserve a place at available events.', keywords: 'calendar rsvp meeting gathering activities', icon: 'calendar' },
  { group: 'People & campus life', title: 'Academic calendar', view: '/ht/hub/calendar/', description: 'Look up the published academic calendar and download dates.', keywords: 'semester term holidays registration dates schedule academic', icon: 'calendar' },
  { group: 'Help & campus resources', title: 'Get help', view: 'support', description: 'Ask a question and follow replies to your own help requests.', keywords: 'support ticket advice advising trouble assistance contact', icon: 'help' },
  { group: 'Help & campus resources', title: 'Around campus', view: 'spaces', description: 'Find campus offices, resources, and the people who can point you forward.', keywords: 'campus office resources directory student services', icon: 'grid' },
];
export function onboardingDestinations(ctx) {
  const role = getOnboardingRole(ctx.state);
  const items = primaryDestinations.map(item => ({ ...item }));
  if (['staff', 'admin'].includes(role)) {
    items.push({ group: 'Your staff workspace', title: 'Teach your courses', view: 'courses', description: 'Create assignments, review submissions, and publish feedback for the sections you teach.', keywords: 'teacher teaching instructor grading gradebook assignments', icon: 'book' });
    items.push({ group: 'Your staff workspace', title: 'Manage sections & enrollment', view: 'live', query: { manage: '1' }, description: 'Manage the sections, rosters, and classroom schedules available to your role.', keywords: 'instructor teaching students roster enrollment cohort classroom', icon: 'users' });
    items.push({ group: 'Your staff workspace', title: 'Staff workspace', view: 'staff', description: 'Manage campus announcements, events, learning pathways, and support work.', keywords: 'office staff administration publish settings ada transcript', icon: 'briefcase' });
  }
  if (['staff', 'admin', 'leadership'].includes(role)) items.push({ group: role === 'leadership' ? 'Your leadership workspace' : 'Your staff workspace', title: 'Campus insights', view: 'insights', description: 'See the campus participation and learning summaries available to your role.', keywords: 'leadership report reports analytics participation data', icon: 'chart' });
  const spaces = globalThis.window?.HT?.spaces || {};
  for (const key of officeKeys) {
    const space = spaces[key];
    if (!space || typeof space.title !== 'string' || !space.title.trim()) continue;
    items.push({ group: 'Office previews', title: space.title, view: `/ht/hub/${key}/`, description: typeof space.blurb === 'string' ? space.blurb : 'Explore this campus office preview.', keywords: `${key} ${typeof space.office === 'string' ? space.office : ''} office preview sample`, icon: 'grid' });
  }
  return items;
}
function map(ctx) {
  const destinations = onboardingDestinations(ctx), groups = [...new Set(destinations.map(item => item.group))];
  return `<section class="campus-onboarding-map" aria-labelledby="campusOnboardingMap"><div class="campus-section-head"><div><h2 id="campusOnboardingMap">Find your way anywhere</h2><p class="campus-muted">Every main destination, with a quick explanation of what you will find.</p></div></div><div class="campus-panel campus-onboarding-map-search"><label class="campus-field" for="campusOnboardingSearch"><span>Find a page</span><input id="campusOnboardingSearch" data-onboarding-search type="search" aria-label="Search the Hub" placeholder="Try assignments, messages, or an office" aria-controls="campusOnboardingDestinations" autocomplete="off"></label><p class="campus-muted" role="status" aria-live="polite" data-onboarding-search-count>${destinations.length} destinations</p></div><div id="campusOnboardingDestinations" class="campus-onboarding-map-grid">${groups.map(group => `<section class="campus-panel campus-onboarding-map-group" data-onboarding-map-group><h3>${escape(ctx, group)}</h3>${group === 'Office previews' ? '<p class="campus-muted">These pages contain labeled examples of campus office experiences.</p>' : ''}<div>${destinations.filter(item => item.group === group).map(item => `<a class="campus-onboarding-destination" href="${escape(ctx, ctx.href(item.view, item.query || {}))}" data-onboarding-destination="${escape(ctx, `${item.title} ${item.description} ${item.keywords} ${group}`.toLowerCase())}"><span class="campus-onboarding-destination-icon">${icon(ctx, item.icon)}</span><span><strong>${escape(ctx, item.title)}</strong><span>${escape(ctx, item.description)}</span></span><span aria-hidden="true">→</span></a>`).join('')}</div></section>`).join('')}</div><div class="campus-panel campus-empty" data-onboarding-no-results hidden><h3>No matching pages yet</h3><p>Try a shorter phrase, such as “course,” “message,” or “career.” You can also ask for help.</p>${anchor(ctx, ctx.href('support'), 'Get help')}</div></section>`;
}
function quickHelp(ctx, role) {
  const teacher = ['staff', 'admin'].includes(role);
  const hasVideo = typeof ctx.state.settings?.ada_video_url === 'string' && ctx.state.settings.ada_video_url.trim();
  return `<aside class="campus-stack campus-onboarding-quickhelp"><section class="campus-panel"><h2>A few helpful things</h2><details open><summary>Where did the menu go?</summary><p>On a computer, Today, Learning, Community, Messages, and Campus run across the top. On a phone, those five stay at the bottom. Events, Classrooms, and the Academic calendar are under More in the top menu; Get help stays in the header. Campus opens offices and resources. Use this Guide to find every destination.</p></details><details><summary>${teacher ? 'Where do I manage teaching?' : 'Why is a course missing?'}</summary><p>${teacher ? 'My courses contains the sections you teach. Open a section to create assignments or review submissions. Manage sections & enrollment in Classrooms controls the rosters and schedules available to your role.' : 'Your instructor adds you to a course section. Joining a learning pathway does not enroll you in a section. Check that you are signed in with your campus account, then contact your instructor if a course is missing.'}</p></details><details><summary>Courses or learning pathways?</summary><p>My courses holds section assignments and published grades. Learning pathways holds readings, practice, and completion activities. A course may link to a pathway; their progress records are separate.</p></details><details><summary>What can other people see?</summary><p>Community posts are visible in the campus feed. Direct messages are for the people in the conversation. Student submissions and grades stay within the permitted student and instructor views. Help requests have their own support access.</p></details><details><summary>How do I sign in?</summary><p>Use the account button at the top. An active campus membership opens your workspace; a section enrollment opens your course. The interactive demo uses sample accounts and keeps its changes in this browser.</p></details></section><section class="campus-panel campus-onboarding-ada"><p class="campus-eyebrow">Your campus welcome</p><h2>Meet Ada</h2><p>Ada is your HT campus ambassador. Start with your course, use Messages when you need to reach someone, and choose Get help whenever you need direction.</p><p>You can use this written guide without watching a video.</p>${hasVideo ? anchor(ctx, ctx.href('home'), 'Find Ada’s recorded welcome on Today') : '<p class="campus-muted">Ada’s recorded welcome will be added when the recording is ready.</p>'}</section></aside>`;
}
export function renderOnboarding(view, ctx) {
  if (view !== 'welcome') return '';
  const progress = currentProgress(ctx);
  const intro = progress.role ? guideHero(ctx, progress) : `<section class="campus-panel campus-onboarding-hero"><div><p class="campus-eyebrow">Your Hub guide</p><h2 data-onboarding-focus tabindex="-1">Find your place on the Hill.</h2><p class="campus-lede">Explore the map below. Sign in with your campus account for a student or staff guide and your own workspace.</p><div class="campus-onboarding-actions">${anchor(ctx, '/login/?next=%2Fht%2Fhub%2Fwelcome%2F', 'Sign in to your campus workspace', 'campus-button')}</div></div></section>`;
  return `<div class="campus-stack campus-onboarding" data-campus-onboarding>${intro}${progress.role ? `<div class="campus-onboarding-layout">${checklist(ctx, progress)}${quickHelp(ctx, progress.role)}</div>` : quickHelp(ctx, null)}${map(ctx)}</div>`;
}
function guidedStep(view, progress) {
  let requested = '';
  try { requested = new URL(globalThis.location?.href || 'https://ht.invalid/').searchParams.get('guide') || ''; } catch { return null; }
  if (requested) return progress.steps.find(step => step.id === requested && step.view === view) || null;
  return progress.steps.find(step => step.id === progress.activeStep && step.view === view) || null;
}
function pageGuideKey(view, ctx) {
  const state = ctx.state || {};
  let scope = '';
  try {
    const params = new URL(globalThis.location?.href || 'https://ht.invalid/').searchParams;
    if (view === 'courses' && params.has('cohort')) scope = `course-${params.get('tab') || 'overview'}${params.has('assignment') ? '-assignment' : ''}`;
    else if (view === 'live' && params.has('manage')) scope = 'classroom-management';
    else if (view === 'live' && params.has('cohort')) scope = 'cohort-classroom';
    else if (view === 'people' && params.has('person')) scope = 'direct-conversation';
    else if (view === 'people' && params.get('new') === '1') scope = 'new-message';
    else if (view === 'support' && params.has('request')) scope = 'support-request';
  } catch { /* Keep the first-visit help at its top-level route. */ }
  const identity = [state.mode || 'guest', state.member?.role || 'guest', state.user?.id || 'anonymous', view, scope].filter(Boolean).join(':');
  return `ht-hub-page-guide:v1:${encodeURIComponent(identity)}`;
}
function pageGuideSeen(key) {
  try { return globalThis.localStorage?.getItem(key) === 'seen'; } catch { return false; }
}
function pageGuideTitle(view, ctx) {
  let params;
  try { params = new URL(globalThis.location?.href || 'https://ht.invalid/').searchParams; } catch { return pageGuidance[view]?.title || 'this page'; }
  if (view === 'courses' && params.has('cohort')) {
    if (params.has('assignment')) return 'Assignment';
    return ({ overview: 'Course overview', modules: 'Modules', assignments: 'Assignments', grades: 'Grades', people: 'People' })[params.get('tab') || 'overview'] || 'Course overview';
  }
  if (view === 'people' && params.has('person')) return 'Conversation';
  if (view === 'people' && params.get('new') === '1') return 'New message';
  if (view === 'live' && params.has('manage')) return 'Classroom management';
  if (view === 'live' && params.has('cohort')) return 'Cohort classroom';
  if (view === 'support' && params.has('request')) return 'Support request';
  return pageGuidance[view]?.title || 'this page';
}
function pageGuideTip(view, ctx) {
  const role = ctx.state.member?.role;
  let params = new URLSearchParams();
  try { params = new URL(globalThis.location?.href || 'https://ht.invalid/').searchParams; } catch { /* Use the top-level page guidance. */ }
  if (view === 'courses' && params.has('cohort')) {
    const tab = params.get('tab') || 'overview', manage = ['staff', 'admin'].includes(role);
    if (tab === 'assignments') return [manage ? 'Create a draft assignment or open one to review student attempts.' : 'Open an assignment to read its instructions and due dates, then submit your work there.', 'Published feedback and grades stay with this course section.'];
    if (tab === 'grades') return [manage ? 'Choose a student and assignment to review work and manage the gradebook.' : 'Review your instructor’s published grades and feedback here.', manage ? 'Draft grades stay private until you publish them.' : 'Submitted work awaiting review is not counted as a published grade.'];
    if (tab === 'modules') return ['Choose a module to open its connected learning materials.', 'Course assignments and pathway completion are tracked separately.'];
    if (tab === 'people') return [manage ? 'Review the section roster and available instructor tools.' : 'Find your instructor and classmates in the section roster.', 'Use Messages to continue a private conversation when available.'];
    return [manage ? 'Use the course tabs to prepare assignments, review work, and manage the roster.' : 'Start with this section overview, then use the tabs for modules, assignments, grades, and people.', 'Use the classroom link for scheduled sessions and recordings.'];
  }
  if (view === 'courses' && ['staff', 'admin'].includes(role)) return ['Choose a section you teach to open its workspace.', 'Use Assignments to prepare or review work, Grades to manage the gradebook, and People to check the roster.'];
  if (view === 'live' && params.has('manage') && ['staff', 'admin'].includes(role)) return ['Use the tabs to manage classrooms, enrollment, or scheduled sessions.', 'Choose a classroom to work with its roster and schedule. Access follows your instructor assignment or campus role.'];
  if (view === 'live' && params.has('manage')) return ['Classroom management is available only to authorized instructors and administrators.', 'Use your course workspace or ask campus support if you need access.'];
  if (view === 'live' && params.has('cohort') && ['staff', 'admin'].includes(role)) return ['Use this cohort classroom to find scheduled sessions, shared materials, and available recordings.', 'Roster and management tools are available only for sections assigned to you.'];
  if (view === 'live' && params.has('cohort')) return ['Use this cohort classroom to find scheduled sessions, shared materials, and available recordings.', 'Only the class tools available to your campus role will appear here.'];
  if (view === 'live' && ['staff', 'admin'].includes(role)) return ['Choose a classroom to see its roster and scheduled sessions.', 'Teaching and roster controls are available only for sections assigned to you.'];
  if (view === 'people' && params.has('person')) return ['This is a direct conversation. Read the history above, then write your reply in the message box.', 'Only the people in this conversation can see these messages.'];
  if (view === 'people' && params.get('new') === '1') return ['Search the campus directory for the person you want to reach.', 'Choose Message beside their name to open a private conversation.'];
  if (view === 'support' && params.has('request')) return ['Open the request to read its status and the campus team’s replies.', 'Use the reply box on the request to continue the private support conversation.'];
  if (view === 'staff' && !['staff', 'admin'].includes(role)) return ['This workspace is for authorized campus staff.', 'Use My courses to continue learning, or ask campus support if you believe you need staff access.'];
  if (view === 'insights' && !['staff', 'admin', 'leadership'].includes(role)) return ['Campus reporting is available to authorized staff and university leadership.', 'Use your courses or campus spaces for student services and learning resources.'];
  return pageGuidance[view]?.steps || [];
}
export function renderPageOrientation(view, ctx) {
  if (view === 'welcome' || view === 'unavailable' || ctx.state?.mode === 'unavailable' || !pageGuidance[view]) return '';
  const progress = currentProgress(ctx);
  if (guidedStep(view, progress) || (view === 'home' && progress.status === 'active')) return '';
  const key = pageGuideKey(view, ctx), guidance = { ...pageGuidance[view], title: pageGuideTitle(view, ctx) }, tips = pageGuideTip(view, ctx);
  // Collapsed on arrival, and gone once someone has opened or dismissed it; the header Guide link stays.
  if (pageGuideSeen(key)) return '';
  const open = '';
  return `<details class="campus-page-guide" data-campus-page-guide="${escape(ctx, key)}"${open}><summary><span><strong>First time here?</strong><span>How this page works</span></span><span class="campus-page-guide-chevron" aria-hidden="true">⌄</span></summary><div class="campus-page-guide-content"><div><p class="campus-eyebrow">Start here</p><ol>${tips.map(tip => `<li>${escape(ctx, tip)}</li>`).join('')}</ol></div><div class="campus-page-guide-actions">${anchor(ctx, ctx.href('welcome'), 'Full site guide', 'campus-button campus-button-secondary campus-button-small')}<button type="button" class="campus-onboarding-text-button" data-page-guide-done>Got it</button></div></div></details>`;
}
export function renderOnboardingPrompt(view, ctx) {
  if (view === 'welcome') return '';
  const progress = currentProgress(ctx);
  if (!progress.role || progress.status === 'dismissed' || progress.status === 'complete') return '';
  if (progress.status === 'new') return '';
  const step = guidedStep(view, progress);
  if (step) {
    const next = progress.steps.find(item => !progress.visited.includes(item.id) && item.id !== step.id);
    return `<section class="campus-onboarding-context" aria-label="Your Hub guide"><div><p class="campus-eyebrow">${roleNames[progress.role] || 'Your Hub guide'} · ${progress.visited.length} of ${progress.steps.length} places explored</p><h2>${escape(ctx, step.title)}</h2><p>${escape(ctx, step.hint)}</p></div><div class="campus-onboarding-actions">${next ? anchor(ctx, stepHref(ctx, next), `Next: ${next.title}`, 'campus-button campus-button-secondary campus-button-small') : anchor(ctx, ctx.href('welcome'), 'Finish guide', 'campus-button campus-button-secondary campus-button-small')}${anchor(ctx, ctx.href('welcome'), 'Back to guide')}${button('dismiss', 'Close guide', 'campus-onboarding-text-button')}</div></section>`;
  }
  return view === 'home' ? `<section class="campus-onboarding-prompt" aria-label="Continue your Hub guide"><div><strong>Your guide is here when you need it.</strong><p>${progress.visited.length} of ${progress.steps.length} places explored. Pick up where you left off.</p></div>${anchor(ctx, ctx.href('welcome'), 'Resume guide', 'campus-button campus-button-secondary campus-button-small')}</section>` : '';
}
export function bindOnboarding(view, root, ctx) {
  if (!root?.addEventListener) return () => {};
  const searchKey = `${ctx.state.mode || 'guest'}:${ctx.state.user?.id || ''}:${ctx.state.member?.role || ''}`;
  const click = event => {
    const done = event.target.closest?.('[data-page-guide-done]');
    if (done && root.contains(done) && (done.matches?.('[data-page-guide-done]') || Object.hasOwn(done.dataset || {}, 'pageGuideDone'))) {
      const details = done.closest('[data-campus-page-guide]');
      if (details) {
        try { globalThis.localStorage?.setItem(details.dataset.campusPageGuide, 'seen'); } catch { /* The page guide remains usable without browser storage. */ }
        details.open = false;
        details.querySelector('summary')?.focus({ preventScroll: true });
      }
      return;
    }
    const target = event.target.closest?.('[data-onboarding-action]');
    if (!target || !root.contains(target) || !getOnboardingRole(ctx.state)) return;
    const action = target.dataset.onboardingAction;
    if (!['start', 'dismiss', 'restart', 'complete'].includes(action) || typeof ctx.onboarding?.[action] !== 'function') return;
    if (target.tagName === 'A') {
      if (['start', 'dismiss'].includes(action) && !event.defaultPrevented) ctx.onboarding[action](ctx.state);
      return;
    }
    event.preventDefault();
    if (action === 'dismiss') {
      try {
        const url = new URL(globalThis.location.href);
        url.searchParams.delete('guide');
        globalThis.history?.replaceState(globalThis.history.state, '', url.pathname + url.search + url.hash);
      } catch { /* The guide can still be dismissed without history support. */ }
    }
    ctx.onboarding[action](ctx.state);
    if (action === 'complete' && ctx.onboarding.read(ctx.state).status === 'complete') ctx.notify?.('You have explored your Hub guide. Return to Guide anytime.');
    Promise.resolve(ctx.refresh?.()).then(() => {
      if (view === 'welcome') root.querySelector('[data-onboarding-focus]')?.focus({ preventScroll: true });
    }).catch(() => ctx.notify?.('Your guide could not refresh. Please reload this page.', 'error'));
  };
  const toggle = event => {
    const details = event.target;
    if (!details?.matches?.('[data-campus-page-guide]') || !root.contains(details) || details.open) return;
    try { globalThis.localStorage?.setItem(details.dataset.campusPageGuide, 'seen'); } catch { /* Keep navigation available if storage is blocked. */ }
  };
  const search = event => {
    if (!event.target.matches?.('[data-onboarding-search]')) return;
    const query = event.target.value.trim().toLowerCase();
    searchQueries.set(searchKey, event.target.value);
    if (searchQueries.size > 20) searchQueries.delete(searchQueries.keys().next().value);
    let count = 0;
    root.querySelectorAll('[data-onboarding-destination]').forEach(item => {
      item.hidden = !item.dataset.onboardingDestination.includes(query);
      if (!item.hidden) count++;
    });
    root.querySelectorAll('[data-onboarding-map-group]').forEach(group => { group.hidden = !Array.from(group.querySelectorAll('[data-onboarding-destination]')).some(item => !item.hidden); });
    const status = root.querySelector('[data-onboarding-search-count]');
    if (status) status.textContent = `${count} ${count === 1 ? 'destination' : 'destinations'}${query ? ' found' : ''}`;
    const empty = root.querySelector('[data-onboarding-no-results]');
    if (empty) empty.hidden = count > 0;
  };
  const input = root.querySelector('[data-onboarding-search]');
  if (input && searchQueries.has(searchKey)) {
    input.value = searchQueries.get(searchKey);
    search({ target: input });
  }
  root.addEventListener('click', click);
  root.addEventListener('input', search);
  root.addEventListener('toggle', toggle, true);
  return () => { root.removeEventListener('click', click); root.removeEventListener('input', search); root.removeEventListener('toggle', toggle, true); };
}

/* The HT Hub — core data. Each space adds itself in /ht/hub/data/<key>.js. Everything here is SAMPLE content. */
window.HT = window.HT || {};
HT.site = { name: 'Huston-Tillotson University', short: 'HT', partner: 'Taylormade Academy', hub: '/ht/hub/', sample: true, adaPoster: '/ht/img/ada-face.jpg' };
HT.spaces = HT.spaces || {};
HT.order = ['advancement', 'president', 'events', 'live', 'learn', 'community', 'showcase', 'students', 'career', 'alumni', 'admissions', 'outreach', 'board'];
/* One photo per campus space, none repeated: the directory cards and the app-backed
   page heroes both use it. athletics.jpg carries the Rams mark, so it stays off
   every non-athletics space. */
HT.spaceArtwork = {
  advancement: { image: '/ht/img/fall-convocation.jpg', alt: 'Huston-Tillotson faculty and students at Fall Convocation' },
  president: { image: '/ht/img/cover-dais.jpg', alt: 'Dr. Melva K. Wallace on the dais at a Huston-Tillotson ceremony' },
  events: { image: '/ht/img/commencement.jpg', alt: 'Two Huston-Tillotson graduates celebrating commencement' },
  live: { image: '/ht/img/r-academic.jpg', alt: 'Rendering of a Huston-Tillotson academic building' },
  learn: { image: '/ht/img/students-library.jpg', alt: 'Huston-Tillotson students gathered in the library' },
  community: { image: '/ht/img/wallace-students.jpg', alt: 'Huston-Tillotson students and university leadership together' },
  showcase: { image: '/ht/img/r-student-center.jpg', alt: 'Rendering of the Huston-Tillotson student center' },
  students: { image: '/ht/img/hero-flyover-poster.jpg', alt: 'Students walking across the Huston-Tillotson campus, rendering' },
  career: { image: '/ht/img/student-laptop.jpg', alt: 'A Huston-Tillotson student working at a laptop in the library' },
  alumni: { image: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson University sign and bell tower in Austin, Texas' },
  admissions: { image: '/ht/img/r-village-plaza.jpg', alt: 'Rendering of a Huston-Tillotson residential plaza' },
  outreach: { image: '/ht/img/r-retail-street.jpg', alt: 'Architectural rendering of a walkable campus retail street' },
  board: { image: '/ht/img/r-admin-dusk.jpg', alt: 'Rendering of the Huston-Tillotson administrative building at dusk' }
};
/* A clearly labeled, illustrative path leaders can follow across the full hub. */
HT.leadershipWalkthrough = [
  { key: 'success', title: 'Every student who needs a hand has an owner', detail: 'Early alerts come from sign-ins, missed work, midterm grades, and attendance. Advisors see names; you see the pattern.' },
  { key: 'insights', title: 'The whole campus on one page', detail: 'Enrollment, persistence, weekly activity, pathways, and support, filtered by class year. Sample figures.' },
  { key: 'courses', role: 'student', query: { cohort: 'a0000000-0000-4000-8000-000000000001', tab: 'overview' }, hash: 'ada', title: 'Ada tutors from the course itself', detail: 'You are now Jordan, a first-year student. Ask Ada a question: she answers only from this class’s lessons, and won’t write the assignment.' },
  { key: 'courses', role: 'staff', query: { cohort: 'a0000000-0000-4000-8000-000000000001', tab: 'assignments', assignment: 'd0000000-0000-4000-8000-000000000001' }, title: 'Grade in minutes, with a rubric', detail: 'You are now Morgan, the instructor. Open Imani’s brief, pick a level for each part, and let Ada draft the feedback you edit and publish.' },
  { key: 'learn', role: 'student', title: 'Credentials that travel', detail: 'Back as Jordan: finished pathways become badges and a printable record that feeds the career portfolio.' },
  { key: 'trust', title: 'Ready for your IT review', detail: 'What is built today, what we set up with your IT team, and who can see what.' },
  { key: 'president', title: 'University communication reaches one shared place', detail: 'The town hall, the replay shelf, the annual calendar, and approved messages together.' },
  { key: 'admissions', title: 'Welcome begins before move-in', detail: 'Follow an admitted student from the first campus connection to the next useful step for the student and family.' },
  { key: 'students', title: 'Student support meets the whole week', detail: 'Orientation, organizations, campus events, and help in one familiar starting place.' },
  { key: 'community', title: 'A campus conversation has a next step', detail: 'Move from a shared channel to a private message or the right campus office without losing context.' },
  { key: 'events', title: 'The academic year becomes easier to act on', detail: 'Published dates beside event details, calendar actions, and a sample check-in at the door.' },
  { key: 'career', title: 'Student work can travel further', detail: 'Portfolios students shape, and a way for employers to find relevant skills and projects.' },
  { key: 'showcase', title: 'Progress becomes visible with permission', detail: 'Coursework and research in a showcase, with clear student-consent expectations.' },
  { key: 'alumni', title: 'Relationships continue after graduation', detail: 'Alumni chapters, mentoring, Homecoming, and lifelong learning connected to campus.' },
  { key: 'advancement', title: 'Giving connects to the work it makes possible', detail: 'A sample cohort and its student work, ready for a thoughtful donor update.' },
  { key: 'outreach', title: 'Campus learning extends into the neighborhood', detail: 'Partners, families, and prospective students find public programs and a next step.' },
  { key: 'board', title: 'Governance has a clear working space', detail: 'The sample meeting agenda, materials, and attendance flow in a trustee space.' },
  { key: 'live', role: 'staff', title: 'Each cohort gets its own classroom', detail: 'You are Morgan again: your section’s sessions, materials, attendance, and replays in one place. Finish the tour from here.' }
];
HT.pages = ['replay', 'calendar', 'session', 'legacy-live'];   /* pages outside the main tabs: replay belongs to Live, academic calendar to Events */

HT.home = {
  title: 'Home', kicker: 'Huston-Tillotson University · Austin, Texas', stamp: 'Preview · sample content',
  sub: 'Every office on the Hill, one sign-in. Events, live seminars, learning, community, and the people behind each gift.',
  headCta: { label: 'Open the live room', href: '/ht/hub/live/', style: 'ht' },
  blocks: [
    { type: 'intro', kicker: 'Huston-Tillotson × Taylormade Academy', title: 'One campus. One hub. Every office.',
      text: 'The HT Hub is where a campus runs the things that usually live in separate subscriptions: the event app, the live room, the classroom beside the course catalog, the community, the showcase, and the way donors see what their gift built. Ada opens the door. The people of HT do the rest.',
      ctas: [{ label: 'See the spaces', href: '#spaces', style: 'ht' }, { label: 'Put it on your phone', href: '#install', style: 'ht-line' }],
      video: '/ht/img/ada-idle-loop.mp4', poster: '/ht/img/ada-idle-poster.jpg', imageAlt: 'Ada, the Hub’s AI guide, at the campus gate',
      ada: { text: 'Welcome to the Hill. Three things are coming up: the President\'s Fall Briefing for donors on October 8, the fall town hall on October 15 at noon, and the 152nd Charter Day Observance on October 23. Pick a space below and I\'ll walk you in.', when: 'Ada, the Hub’s AI guide · sample' } },
    { type: 'notice', tone: 'maroon', html: '<b>What is real and what is sample.</b> Sign-in, the live room, the replay page, HT\'s published calendar and the community are real and running. Every HT name, event and figure marked Sample is sample content, prepared with Institutional Advancement for the University\'s review.' },
    { type: 'announcements', title: 'Campus announcements', meta: 'Sample', items: [
      { who: 'Office of the President', when: 'This week', text: 'The fall town hall streams live in the hub on October 15 at noon. The replay lands the same afternoon.' },
      { who: 'Institutional Advancement', when: 'This week', text: 'Donor Appreciation Weekend agenda is posted. Guests can add it to their calendar from the Events space.' },
      { who: 'Student Affairs', when: 'Last week', text: 'Check-in codes are shown on the screen at each session. One tap marks you present.' } ] },
    { type: 'spaces', id: 'spaces', title: 'The spaces', meta: 'Thirteen spaces, one sign-in' },
    { type: 'calendar', side: true, title: 'Coming up on the Hill', meta: 'Sample', items: [
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Advancement · Live room', tag: 'Live room', tagCls: 'soft' },
      { date: '2026-10-13', title: 'AI Literacy · Session 01', where: 'Learn · Track one' },
      { date: '2026-10-15', title: 'Fall town hall, live', where: 'Office of the President · Live room', tag: 'Live room', tagCls: 'soft' },
      { date: '2026-10-23', title: '152nd Charter Day Observance', where: 'HT\'s published calendar · Campus' },
      { date: '2026-11-06', title: 'Donor Appreciation Weekend, day one', where: 'Advancement · Campus' } ] },
    { type: 'install', side: true },
    { type: 'cards', side: true, title: 'Running a space?', meta: 'Start here', items: [
      { meta: 'The playbook', title: 'How your office runs its space', text: 'Who does what, the ten jobs step by step, the four rules that never bend, and the rhythm of a term. Built to print.', href: '/ht/playbook/', foot: 'Open the playbook →' } ] },
    { type: 'cards', side: true, title: 'Already running', meta: 'Built the same way', items: [
      { meta: 'Atlanta University Center', title: 'The AI Thread · Open Payments Innovation Lab', text: 'Registration, a lab hub, sessions, check-in, materials, live room, showcase, and judging, for the AUC Data Science Initiative.', href: '/opil/', foot: 'See the program →' } ] }
  ]
};

HT.spaces.advancement = {
  key: 'advancement', title: 'Advancement', office: 'Institutional Advancement', icon: 'gift',
  blurb: 'Donor pages by name, the President\'s briefing, Donor Appreciation Weekend, and the cohorts a gift can fund.',
  sub: 'The ask and the thank-you, by name. Then the room where donors hear from the President, and the program their gift builds.',
  stamp: 'Preview · sample donors', headCta: { label: 'Open the donor deck', href: 'https://taylormadecreative.github.io/ht-advancement/', style: 'ht' },
  blocks: [
    { type: 'intro', kicker: 'Institutional Advancement', title: 'Every donor, by name. Every gift, followed through.',
      text: 'A personal page for the ask and one for what happened after, sent from your office under HT\'s name. A live briefing donors join from a text. A weekend on campus with its own agenda in their pocket. And a named cohort a gift can fund, with the students it reached on the other side.',
      ctas: [{ label: 'The donor pages', href: '#pages', style: 'ht' }, { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-line' }],
      image: '/ht/img/fall-convocation.jpg', imageAlt: 'Fall Convocation at Huston-Tillotson',
      ada: { text: 'Welcome to the Advancement space. Three sample donor pages are below: the thank-you, the ask, and an endowment update. Each one opens from a text or an email, the way a donor would open it.', when: 'Ada, the Hub’s AI guide · sample' } },
    { type: 'stats', items: [{ n: '3', label: 'Donor pages in review (sample)' }, { n: 'Oct 8', label: 'President\'s Fall Briefing, live (sample)' }, { n: 'Nov 6–7', label: 'Donor Appreciation Weekend (sample)' }, { n: '24', label: 'Cohort seats funded this year (sample)' }] },
    { type: 'cards', id: 'pages', title: 'Donor pages', meta: 'Each opens from a text or an email', items: [
      { meta: 'The thank-you · after the gift', title: 'Robert & Denise Johnson', text: 'Your Year on the Hill: the endowed scholarship in their name, the students it reached, and a note from the President.', href: 'https://taylormadecreative.github.io/ht-advancement/stewardship.html?to=Robert%20%26%20Denise%20Johnson', img: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson campus', badge: 'Sample', foot: 'Open the page →' },
      { meta: 'The ask · before the gift', title: 'Yvette Reed \'92', text: 'Meet Me Halfway, for one person: the promise, the why, three sophomores, and the President before the ask.', img: '/ht/img/r-village-plaza.jpg', alt: 'Rendering of the campus plaza', href: 'https://taylormadecreative.github.io/ht-advancement/solicitation.html?to=Yvette%20Reed', badge: 'Sample', foot: 'Open the page →' },
      { meta: 'The update · the endowment', title: 'An endowed fund', text: 'The annual update a fund\'s donors asked for, as a page instead of a letter: the fund, the year, and the names it made possible.', href: 'https://taylormadecreative.github.io/ht-advancement/stewardship.html?to=The%20Founders&fund=Founders%20Endowed%20Scholarship', img: '/ht/img/r-academic.jpg', alt: 'Rendering of an academic building', badge: 'Sample', foot: 'Open the page →' } ] },
    { type: 'player', id: 'briefing', cardTitle: 'The President\'s Fall Briefing', meta: 'Donors join from a text · replay the same day', title: 'President\'s Fall Briefing', live: false, poster: '/ht/img/cover-dais.jpg',
      now: { title: 'Rehearsal loop on the HT player', who: 'Real broadcast goes here on Oct 8', when: '12:00 PM CT' } },
    { type: 'split', id: 'weekend', kicker: 'Donor Appreciation Weekend · Nov 6–7', title: 'A weekend on campus, with the agenda in their pocket.',
      text: 'Guests open one link: the schedule, the speakers, where to be, a message to the host, and a check-in at the door. No app store, no rented event app. Add it to a calendar in one tap.',
      bullets: ['Agenda, speakers, and rooms for both days', 'A private message line to your events lead', 'Check-in code at the door, attendance in your hands', 'Photos and the President\'s thank-you land in the same place after'],
      image: '/ht/img/campus-hero.jpg', imageAlt: 'The Huston-Tillotson campus', side: 'right', cta: { label: 'Open the weekend agenda', href: '/ht/hub/events/#weekend', style: 'ht' } },
    { type: 'split', id: 'fund', kicker: 'What a gift builds', title: 'Fund a cohort. Meet the students on the other side.',
      text: 'A named block of seats in a track the campus already runs. The gift goes to the University, the University funds the block, and no student pays. The donor\'s page shows the cohort their gift funded, the sessions it covered, and the showcase at the end.',
      bullets: ['A named cohort: "The Johnson Family AI Literacy Cohort"', 'Seats, sessions, and a showcase, on the donor\'s own page', 'Students appear with permission, first names, their work'],
      image: '/ht/img/student-laptop.jpg', imageAlt: 'A student working on a laptop', side: 'left', cta: { label: 'How funding a cohort works', href: '/ht/fund/', style: 'ht' } },
    { type: 'cta', title: 'Three donors to start.', text: 'One who just gave, one about to be asked, and an endowed fund whose donors are due their annual update.', primary: { label: 'Open the donor deck', href: 'https://taylormadecreative.github.io/ht-advancement/', style: 'ht' }, secondary: { label: 'The Board portal', href: '/ht/hub/board/', style: 'ht-line' } },
    { type: 'announcements', side: true, title: 'Advancement desk', meta: 'Sample', items: [
      { who: 'Stewardship', when: 'This week', text: 'The Johnson page is ready for the President\'s note. Two-line script attached in materials.' },
      { who: 'Events', when: 'This week', text: 'Weekend agenda posted. The guest list opens October 16.' },
      { who: 'Gift officers', when: 'Last week', text: 'Visit folders now print from each donor page, ready for the visit.' } ] },
    { type: 'calendar', side: true, title: 'The Advancement calendar', meta: 'Sample', items: [
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Live room · 12:00 PM CT', tag: 'Live room', tagCls: 'soft' },
      { date: '2026-11-06', title: 'Donor Appreciation Weekend, day one', where: 'Campus' },
      { date: '2026-11-07', title: 'Donor Appreciation Weekend, day two', where: 'Campus' },
      { date: '2026-12-01', title: 'Year-end letters go out from each donor page', where: 'Stewardship' },
      { day: 'Feb', mon: '2027', title: 'Homecoming 2027 · alumni giving', where: 'Alumni Relations · dates announced by HT', tag: 'Save the month', tagCls: 'soft' } ] },
    { type: 'people', side: true, title: 'Your team in the hub', meta: 'Sample roles, one real name', dm: false, items: [
      { name: 'Linda Y. Jackson', role: 'Vice President for Institutional Advancement', org: 'Proposed space owner', gold: true, tag: 'Owner' },
      { name: 'Gift officer (sample)', role: 'Major gifts', org: 'Drafts the ask pages' },
      { name: 'Stewardship coordinator (sample)', role: 'Endowment reports', org: 'Owns the thank-you pages' },
      { name: 'Events lead (sample)', role: 'Donor weekend', org: 'Runs the agenda and check-in' } ] },
    { type: 'materials', side: true, title: 'Materials', meta: 'Sample', items: [
      { kind: 'DECK', title: 'The ask and the thank-you, by name', sub: 'The donor-page deck', href: 'https://taylormadecreative.github.io/ht-advancement/' },
      { kind: 'DOC', title: 'President\'s note, two-line script', sub: 'For the Johnson page · sample', restricted: true },
      { kind: 'PDF', title: 'Donor Appreciation Weekend · printed agenda', sub: 'Prints from the Events space', href: '/ht/hub/events/' },
      { kind: 'REC', title: 'Spring briefing replay', sub: 'Sample recording slot', restricted: true } ] }
  ]
};

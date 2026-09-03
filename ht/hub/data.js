/* The HT Hub — core data. Each space adds itself in /ht/hub/data/<key>.js. Everything here is SAMPLE content. */
window.HT = window.HT || {};
HT.site = { name: 'Huston-Tillotson University', short: 'HT', partner: 'Taylormade Academy', hub: '/ht/hub/', sample: true, adaPoster: '/ht/img/ada-idle-poster.jpg' };
HT.spaces = HT.spaces || {};
HT.order = ['advancement', 'president', 'events', 'live', 'learn', 'community', 'showcase', 'students', 'career', 'alumni', 'admissions', 'outreach', 'board'];

HT.home = {
  title: 'Home', kicker: 'Huston-Tillotson University · one campus, one hub', stamp: 'Preview · sample content',
  sub: 'Every office on the Hill, one sign-in. Events, live seminars, learning, community, and the people behind each gift.',
  headCta: { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Huston-Tillotson × Taylormade Academy', title: 'One campus. One hub. Every office.',
      text: 'The HT Hub is where a campus runs the things that usually live in six different subscriptions: the event app, the live room, the co-curricular classroom, the community, the showcase, and the way donors see what their gift built. Ada opens the door. The people of HT do the rest.',
      ctas: [{ label: 'See the spaces', href: '#spaces', style: 'ht' }, { label: 'Put it on your phone', href: '#install', style: 'ht-line' }],
      video: '/ht/img/ada-idle-loop.mp4', poster: '/ht/img/ada-idle-poster.jpg', imageAlt: 'Ada, the HT student ambassador, at the campus gate',
      ada: { text: 'Welcome to the Hill. Three things are happening this week: the President\'s fall briefing for donors, orientation check-ins, and the first AI Literacy session. Pick a space below and I\'ll walk you in.', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'announcements', title: 'Campus announcements', meta: 'Sample', items: [
      { who: 'Office of the President', when: 'Today', text: 'The fall town hall streams live in the hub on Thursday at noon. Replay lands the same afternoon.' },
      { who: 'Institutional Advancement', when: 'Yesterday', text: 'Donor Appreciation Weekend agenda is posted. Guests can add it to their calendar from the Events space.' },
      { who: 'Student Affairs', when: 'Monday', text: 'Orientation Week check-in codes are shown on the screen at each session. One tap marks you present.' } ] },
    { type: 'spaces', id: 'spaces', title: 'The spaces', meta: 'One sign-in for all of it' },
    { type: 'notice', tone: 'maroon', html: '<b>What is real and what is sample.</b> Sign-in, the live player, and the program pattern are the same ones running today for the Atlanta University Center. Every HT name, event, and figure on these pages is sample content prepared for a working session with Institutional Advancement.' },
    { type: 'calendar', side: true, title: 'This week on the Hill', meta: 'Sample', items: [
      { date: '2026-09-08', title: 'Orientation Week check-in', where: 'Student Affairs · Events space' },
      { date: '2026-09-10', title: 'Fall town hall, live', where: 'Office of the President · Live room', tag: 'Live', tagCls: 'live' },
      { date: '2026-09-14', title: 'AI Literacy · Session 01', where: 'Learn · Track one' },
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Advancement · Live room' } ] },
    { type: 'install', side: true },
    { type: 'cards', side: true, title: 'Built the same way for', meta: 'Live today', items: [
      { meta: 'Atlanta University Center', title: 'The AI Thread · Open Payments Innovation Lab', text: 'Registration, a lab hub, sessions, check-in, materials, live room, showcase, and judging, for the AUC Data Science Initiative.', href: '/opil/', foot: 'See the program →' } ] }
  ]
};

HT.spaces.advancement = {
  key: 'advancement', title: 'Advancement', office: 'Institutional Advancement', icon: 'gift',
  blurb: 'Donor pages by name, the President\'s briefing, Donor Appreciation Weekend, and the cohorts a gift can fund.',
  sub: 'The ask and the thank-you, by name. Then the room where donors hear from the President, and the program their gift builds.',
  stamp: 'Preview · sample donors', headCta: { label: 'Open the donor deck', href: 'https://taylormadecreative.github.io/ht-advancement/', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Institutional Advancement', title: 'Every donor, by name. Every gift, followed through.',
      text: 'A personal page for the ask and one for what happened after, sent from your office under HT\'s name. A live briefing donors join from a text. A weekend on campus with its own agenda in their pocket. And a named cohort a gift can fund, with the students it reached on the other side.',
      ctas: [{ label: 'The donor pages', href: '#pages', style: 'ht' }, { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-line' }],
      image: '/ht/img/wallace-students.jpg', imageAlt: 'Dr. Wallace with Huston-Tillotson students on campus',
      ada: { text: 'Ms. Jackson, three donor pages are drafted and waiting for your read before the fall briefing. The Links\' endowment update is first in the queue.', when: 'Ada · sample line' } },
    { type: 'stats', items: [{ n: '3', label: 'Donor pages in review (sample)' }, { n: 'Oct 8', label: 'President\'s Fall Briefing, live' }, { n: 'Nov 6–7', label: 'Donor Appreciation Weekend' }, { n: '24', label: 'Cohort seats funded this year (sample)' }] },
    { type: 'cards', id: 'pages', title: 'Donor pages', meta: 'Each opens from a text or an email', items: [
      { meta: 'The thank-you · stewardship', title: 'Robert & Denise Johnson', text: 'Your Year on the Hill: the Johnson Family Endowed Scholarship, the students it reached, and a note from the President.', href: 'https://taylormadecreative.github.io/ht-advancement/stewardship.html?to=Robert%20%26%20Denise%20Johnson', img: '/ht/img/students-library.jpg', alt: 'Students studying in the library', badge: 'Sample', foot: 'Open the page →' },
      { meta: 'The ask · solicitation', title: 'Yvette Reed \'92', text: 'Meet Me Halfway, for one person: the promise, the why, three sophomores, and the President before the ask.', href: 'https://taylormadecreative.github.io/ht-advancement/solicitation.html?to=Yvette%20Reed', img: '/ht/img/fall-convocation.jpg', alt: 'Fall convocation at Huston-Tillotson', badge: 'Sample', foot: 'Open the page →' },
      { meta: 'The update · endowment', title: 'The Links', text: 'The endowment update they asked for, as a page instead of a letter: the fund, the year, the names it made possible.', href: 'https://taylormadecreative.github.io/ht-advancement/stewardship.html?to=The%20Links&fund=Links%20Endowed%20Scholarship', img: '/ht/img/commencement.jpg', alt: 'Commencement on the Hill', badge: 'Sample', foot: 'Open the page →' } ] },
    { type: 'player', id: 'briefing', cardTitle: 'The President\'s Fall Briefing', meta: 'Donors join from a text · replay the same day', title: 'President\'s Fall Briefing', live: false, poster: '/ht/img/cover-dais.jpg',
      now: { title: 'Rehearsal loop on the HT player', who: 'Real broadcast goes here on Oct 8', when: '12:00 PM CT' } },
    { type: 'split', id: 'weekend', kicker: 'Donor Appreciation Weekend · Nov 6–7', title: 'A weekend on campus, with the agenda in their pocket.',
      text: 'Guests open one link: the schedule, the speakers, where to be, a message to the host, and a check-in at the door. No app store, no rented event app. Add it to a calendar in one tap.',
      bullets: ['Agenda, speakers, and rooms for both days', 'A private message line to your events lead', 'Check-in code at the door, attendance in your hands', 'Photos and the President\'s thank-you land in the same place after'],
      image: '/ht/img/campus-hero.jpg', imageAlt: 'The Huston-Tillotson campus', side: 'right', cta: { label: 'Open the weekend agenda', href: '/ht/hub/events/#weekend', style: 'ht' } },
    { type: 'split', id: 'fund', kicker: 'What a gift builds', title: 'Fund a cohort. Meet the students on the other side.',
      text: 'A named block of seats in a track the campus already runs, one invoice, no student pays. The donor\'s page shows the cohort their gift funded, the sessions it covered, and the showcase at the end.',
      bullets: ['A named cohort: "The Johnson Family AI Literacy Cohort"', 'Seats, sessions, and a showcase, on the donor\'s own page', 'Students appear with permission, first names, their work'],
      image: '/ht/img/student-laptop.jpg', imageAlt: 'A student working on a laptop', side: 'left', cta: { label: 'How funding a cohort works', href: '/ht/fund/', style: 'ht-gold' } },
    { type: 'cta', title: 'Three donors to start.', text: 'One who just gave, one about to be asked, and the endowment that already asked for an update.', primary: { label: 'Open the donor deck', href: 'https://taylormadecreative.github.io/ht-advancement/', style: 'ht-gold' }, secondary: { label: 'Board & Foundation portal', href: '/ht/hub/board/', style: 'ht-line' } },
    { type: 'announcements', side: true, title: 'Advancement desk', meta: 'Sample', items: [
      { who: 'Stewardship', when: 'Today', text: 'The Johnson page is ready for the President\'s note. Two-line script attached in materials.' },
      { who: 'Events', when: 'Yesterday', text: 'Weekend agenda posted. Guest list opens Friday.' },
      { who: 'Gift officers', when: 'Monday', text: 'Visit folders now print from each donor page. Bring the page, not the PDF.' } ] },
    { type: 'calendar', side: true, title: 'The Advancement calendar', meta: 'Sample', items: [
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Live room · 12:00 PM CT', tag: 'Live', tagCls: 'live' },
      { date: '2026-11-06', title: 'Donor Appreciation Weekend, day one', where: 'Campus' },
      { date: '2026-11-07', title: 'Donor Appreciation Weekend, day two', where: 'Campus' },
      { date: '2026-12-01', title: 'Year-end letters go out from each donor page', where: 'Stewardship' },
      { date: '2027-02-12', title: 'Homecoming 2027 · alumni giving', where: 'Alumni Relations' } ] },
    { type: 'people', side: true, title: 'Your team in the hub', meta: 'Sample roles', dm: false, items: [
      { name: 'Linda Y. Jackson', role: 'Vice President, Institutional Advancement', org: 'Space owner', gold: true, tag: 'Owner', tagCls: 'green' },
      { name: 'Gift officer (sample)', role: 'Major gifts', org: 'Drafts the ask pages' },
      { name: 'Stewardship coordinator (sample)', role: 'Endowment reports', org: 'Owns the thank-you pages' },
      { name: 'Events lead (sample)', role: 'Donor weekend', org: 'Runs the agenda and check-in' } ] },
    { type: 'materials', side: true, title: 'Materials', meta: 'Sample', items: [
      { kind: 'DECK', title: 'The ask and the thank-you, by name', sub: 'The donor-page deck', href: 'https://taylormadecreative.github.io/ht-advancement/' },
      { kind: 'DOC', title: 'President\'s note, two-line script', sub: 'For the Johnson page', restricted: true },
      { kind: 'PDF', title: 'Donor Appreciation Weekend · printed agenda', sub: 'Prints from the Events space', href: '/ht/hub/events/' },
      { kind: 'REC', title: 'Spring briefing replay', sub: 'Sample recording slot', restricted: true } ] }
  ]
};

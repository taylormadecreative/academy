/* The HT Hub — The live room. The class room block is REAL (ht/hub/room.js); every other block
   here is SAMPLE content and says so. No tool or vendor names on this page. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.live = {
  key: 'live', title: 'Live', office: 'The live room', icon: 'play',
  blurb: 'HT\'s own class room: everyone on camera, share a screen, ask a question, and the replay lands here.',
  sub: 'Seminars, town halls, briefings and classes in HT\'s own room, with everyone on camera, a screen to share, questions in a queue, and the replay on this page after.',
  stamp: 'The class room is real · the rest is sample', headCta: { label: 'Open the room', href: '#room', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'The live room', title: 'One room for everything the campus does live.',
      text: 'A seminar, a town hall, a donor briefing, a guest lecture, a class. The host sends one link. People sign in with their email and a six-digit code, walk in muted with the camera off, and turn either on with one tap. The host shares a screen, brings a question onto the stage, and can end the session for everyone when it is done — leaving the room never ends it. Anyone who is signed in can walk in while a session runs. The recording lands on this page for the host to review and publish.',
      ctas: [{ label: 'Open the room', href: '#room', style: 'ht' }, { label: 'How a session runs', href: '#how', style: 'ht-line' }],
      image: '/ht/img/cover-dais.jpg', imageAlt: 'The dais in the auditorium at Huston-Tillotson',
      ada: { text: 'When your host starts, you\'ll walk straight in. Until then this page checks every few seconds, so there\'s nothing to refresh.', when: 'Ada · HT student ambassador' } },
    { type: 'room', id: 'room', cardTitle: 'The HT class room', meta: 'Real · this room is live' },
    { type: 'stats', items: [{ n: '1 link', label: 'Is all a guest needs, plus their email' }, { n: '1 tap', label: 'Turns a camera or mic on' }, { n: 'Same day', label: 'The replay is ready to review' }, { n: '5', label: 'Offices with a session on the calendar (sample)' }] },
    { type: 'steps', id: 'how', title: 'How a session runs', meta: 'Three steps, one afternoon', items: [
      { em: 'Step one', h: 'Send the link', p: 'The host copies the room link from this page and sends it by text or email. It works before the session starts; people who open it early wait in the room and are brought in the moment it begins.' },
      { em: 'Step two', h: 'Start class', p: 'The host presses Start class, checks the camera, and enters. Everyone is on camera if they choose to be. Share a screen, take questions from the queue, put someone on the stage, split into small groups.' },
      { em: 'Step three', h: 'The replay lands here', p: 'Every session records itself. The host reviews it, presses Publish, and it appears on this page as the last session for the people who were in the room.' } ] },
    { type: 'replays', id: 'replays', title: 'The replay shelf', meta: 'Sample recordings', items: [
      { title: 'Fall Convocation address', date: 'Aug 2026', len: '38:12', poster: '/ht/img/fall-convocation.jpg', tag: 'Office of the President · sample' },
      { title: 'Faculty development · session one', date: 'Aug 2026', len: '52:18', poster: '/ht/img/students-library.jpg', tag: 'Academic Affairs · sample' },
      { title: 'A live visit for families', date: 'Jul 2026', len: '44:30', poster: '/ht/img/campus-hero.jpg', tag: 'Admissions · sample' },
      { title: 'Commencement 2026', date: 'May 2026', len: '1:52:40', poster: '/ht/img/commencement.jpg', tag: 'Office of the President · sample' },
      { title: 'Spring donor briefing', date: 'Apr 2026', len: '41:05', poster: '/ht/img/wallace-students.jpg', tag: 'Institutional Advancement · sample' },
      { title: 'Guest lecture · building a business in Austin', date: 'Mar 2026', len: '58:47', poster: '/ht/img/student-laptop.jpg', tag: 'Career Services · sample' } ] },
    { type: 'calendar', side: true, id: 'calendar', title: 'Coming up live', meta: 'Sample · every office', items: [
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Institutional Advancement · 12:00 PM CT', tag: 'Live', tagCls: 'live' },
      { date: '2026-10-15', title: 'Fall town hall', where: 'Office of the President · 12:00 PM CT', tag: 'Live', tagCls: 'live' },
      { date: '2026-10-22', title: 'Guest lecture · Business program', where: 'Academic Affairs · 6:00 PM CT' },
      { date: '2026-10-29', title: 'Faculty development · teaching with the hub', where: 'Academic Affairs · 3:00 PM CT' },
      { date: '2026-11-07', title: 'Donor Appreciation Weekend luncheon', where: 'Institutional Advancement · 12:00 PM CT' },
      { date: '2026-11-19', title: 'A live visit for families', where: 'Admissions · 6:30 PM CT' },
      { date: '2027-01-21', title: 'Spring town hall', where: 'Office of the President · 12:00 PM CT' },
      { date: '2027-03-25', title: 'Faculty development · spring session', where: 'Academic Affairs · 3:00 PM CT' } ] },
    { type: 'faq', side: true, id: 'faq', title: 'What donors and faculty ask', meta: 'Four questions', items: [
      { q: 'Do I need an account to join?', a: 'Yes, and it takes a minute: your email, then a six-digit code we send you. The first time, you type your name once. Nothing to download.' },
      { q: 'Does it work on a phone?', a: 'Yes. Camera, mic, chat and the question queue all work in the phone\'s browser. Add the hub to your home screen and it opens like an app.' },
      { q: 'Who can watch the recording?', a: 'The host reviews each recording first and decides whether to publish it. Once published, it appears on this page for the people who were in the room.' },
      { q: 'Can a session be private to one group?', a: 'Yes. Only people with the current link can enter. The host can issue a new link at any time, which closes the door on the old one.' } ] },
    { type: 'materials', side: true, title: 'For hosts', meta: 'Sample', items: [
      { kind: 'DOC', title: 'Host checklist · before you start', sub: 'Camera, light, the link sent, one page', restricted: true },
      { kind: 'DOC', title: 'Running the question queue', sub: 'Bring someone on stage, then hand it back', restricted: true },
      { kind: 'DECK', title: 'President\'s Fall Briefing · slides', sub: 'Share from the room on Oct 8', restricted: true } ] },
    { type: 'cta', title: 'The next session is October 8 at noon.', text: 'The President\'s Fall Briefing for donors, live from the auditorium. Open the room a few minutes early; your host will bring you in.',
      primary: { label: 'Open the room', href: '#room', style: 'ht-gold' }, secondary: { label: 'See every session', href: '#calendar', style: 'ht-line' } }
  ]
};

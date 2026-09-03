/* The HT Hub — Office of the President. Everything here is SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.president = {
  key: 'president', title: 'President', office: 'Office of the President', icon: 'mic',
  blurb: 'The fall town hall live, past addresses on replay, and the President\'s calendar for the year.',
  sub: 'Town halls, addresses, and the calendar for the year, from the Office of the President.',
  stamp: 'Preview · sample content', headCta: { label: 'Watch the town hall', href: '#townhall', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Office of the President', title: 'The President, in her own words. Live, and on replay.',
      text: 'The fall town hall streams here on Thursday at noon, from the auditorium, with the room\'s questions and the hub\'s in one line. Every address stays on the shelf after. The year\'s calendar sits below it, from convocation to commencement.',
      ctas: [{ label: 'Watch the town hall', href: '#townhall', style: 'ht' }, { label: 'The year at a glance', href: '#calendar', style: 'ht-line' }],
      image: '/ht/img/wallace-students.jpg', imageAlt: 'Dr. Melva K. Wallace with Huston-Tillotson students on campus',
      ada: { text: 'The town hall is Thursday at noon. If you can\'t be in the auditorium, this page is the room. Questions you leave in the chat get read after the ones from the floor.', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'player', id: 'townhall', cardTitle: 'The fall town hall', meta: 'Live from the auditorium · replay the same afternoon', title: 'Office of the President', live: false, poster: '/ht/img/cover-dais.jpg',
      now: { title: 'Fall Town Hall, live from the auditorium', who: 'Dr. Melva K. Wallace, 7th President and CEO', when: 'Thursday, Sep 10 · 12:00 PM CT' } },
    { type: 'replays', id: 'replays', title: 'Past addresses', meta: 'Sample recordings', items: [
      { title: 'Fall Convocation address', date: 'Aug 2026', len: '38:12', poster: '/ht/img/fall-convocation.jpg', tag: 'Sample' },
      { title: 'A welcome to the Class of 2030', date: 'Aug 2026', len: '11:40', poster: '/ht/img/campus-hero.jpg', tag: 'Sample' },
      { title: 'Commencement address', date: 'May 2026', len: '24:05', poster: '/ht/img/commencement.jpg', tag: 'Sample' },
      { title: 'Spring town hall', date: 'Spring 2026', len: '56:30', poster: '/ht/img/students-library.jpg', tag: 'Sample' } ] },
    { type: 'timeline', id: 'calendar', title: 'The President\'s year', meta: 'Sample calendar · 2026 to 2027', items: [
      { when: 'Late August', title: 'Fall Convocation', text: 'The academic year opens. The address is on the replay shelf above.', done: true },
      { when: 'Sep 10', title: 'Fall Town Hall', text: 'Live from the auditorium at noon. Questions from the floor first, then from the hub.' },
      { when: 'Oct 8', title: 'President\'s Fall Briefing for donors', text: 'A briefing for the people behind each gift, in the live room. Sample event.' },
      { when: 'Nov 6–7', title: 'Donor Appreciation Weekend', text: 'Two days on the Hill. The President\'s thank-you at Saturday\'s luncheon. Sample event.' },
      { when: 'Jan 2027', title: 'Spring Town Hall', text: 'The spring semester opens the same way the fall did: in the auditorium, live in the hub.' },
      { when: 'February 2027', title: 'Homecoming 2027', text: 'The Hill fills back up. Dates announced by HT.' },
      { when: 'Spring 2027', title: 'Founders\' Day', text: 'The University\'s roots reach back to 1875. The campus gathers to mark them. Date announced by HT.' },
      { when: 'May 2027', title: 'Commencement', text: 'The year ends where it should, with the Class of 2027 on the stage.' } ] },
    { type: 'split', id: 'message', kicker: 'The President\'s message', meta: 'Two lanes', title: 'Two lanes for the President\'s message. Both end in her voice.',
      text: 'Some weeks there is time to write. Most weeks there is not. So the message has two ways in, and the office picks the one that fits the week.',
      bullets: ['Lane one: she records on her phone, anywhere, in one take. Her office gets a finished cut back, captioned and framed for the hub, the same day.', 'Lane two: her office approves a script first. The message is produced from the approved words and lands for her sign-off before anyone else sees it.', 'Either way, the President speaks for herself. Ada carries the campus announcements.', 'Every message lands in this space and, when it is for a donor, on that donor\'s own page.'],
      image: '/ht/img/r-admin-dusk.jpg', imageAlt: 'Rendering of the administration building at dusk', side: 'right',
      cta: { label: 'See how a donor page carries it', href: '/ht/hub/advancement/#pages', style: 'ht' } },
    { type: 'chat', id: 'room', title: 'The town hall room', meta: 'Open now · questions read Thursday', room: 'townhall', seed: [
      { who: 'Ada · HT student ambassador', text: 'Welcome to the town hall room. Leave your question here before noon on Thursday and the office pulls it into the run of show.', when: 'Sample · Tuesday' },
      { who: 'Jasmine R. · junior (sample)', text: 'Will the evening shuttle come up? The last loop leaves before the library closes.', when: 'Tuesday' },
      { who: 'Faculty · Business (sample)', text: 'Asking about the faculty development series and whether those sessions get recorded.', when: 'Tuesday' },
      { who: 'Marcus T. · first-year (sample)', text: 'First town hall for me. Do we ask here or stand up in the room?', when: 'Wednesday' },
      { who: 'Office of the President', text: 'Both. The room gets the mic first, then we read from here. The replay lands the same afternoon.', when: 'Wednesday' } ] },
    { type: 'announcements', side: true, title: 'From the office, read by Ada', meta: 'Sample', items: [
      { who: 'Ada · for the Office of the President', when: 'Today', text: 'Thursday\'s town hall starts at noon in the auditorium. Doors at 11:40. The stream opens here at 11:55.' },
      { who: 'Ada · for the Office of the President', when: 'Yesterday', text: 'Questions for the President go in the town hall room on this page until Thursday morning.' },
      { who: 'Ada · for the Office of the President', when: 'Monday', text: 'The Fall Convocation address is on the replay shelf. Thirty-eight minutes, captioned.' },
      { who: 'Ada · for the Office of the President', when: 'Last week', text: 'Founders\' Day is set for spring 2027. The office will post the date here first.' } ] },
    { type: 'materials', side: true, title: 'Messages and scripts', meta: 'Sample', items: [
      { kind: 'PLAY', title: 'Fall Convocation address', sub: 'Replay · 38 minutes', href: '#replays' },
      { kind: 'DOC', title: 'Town hall run of show', sub: 'Sep 10 · questions from the room and the hub', restricted: true },
      { kind: 'DOC', title: 'Welcome to the Class of 2030 · script', sub: 'Approved by the office · sample', restricted: true },
      { kind: 'DOC', title: 'Donor thank-you · two-line script', sub: 'For the Johnson page · sample', restricted: true },
      { kind: 'REC', title: 'Fall town hall replay', sub: 'Lands here Thursday afternoon', restricted: true } ] },
    { type: 'people', side: true, title: 'The office', meta: 'Sample roles, one real name', dm: false, items: [
      { name: 'Dr. Melva K. Wallace', role: '7th President and CEO', org: 'Space owner', gold: true, tag: 'Owner', tagCls: 'green' },
      { name: 'Chief of staff (sample)', role: 'Runs the town hall', org: 'Owns the run of show' },
      { name: 'Communications director (sample)', role: 'Approves scripts', org: 'Lane two starts here' },
      { name: 'Ada', role: 'HT student ambassador', org: 'Reads the announcements', tag: 'Ambassador', tagCls: 'soft' } ] },
    { type: 'cta', title: 'Join the town hall Thursday at noon.', text: 'Live from the auditorium, in the hub, with the replay the same afternoon.',
      primary: { label: 'Open the live room', href: '/ht/hub/live/', style: 'ht-gold' }, secondary: { label: 'Put it on your calendar', href: '/ht/hub/events/#orientation', style: 'ht-line' } }
  ]
};

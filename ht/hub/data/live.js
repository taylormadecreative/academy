/* The HT Hub — The live room. Everything here is SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.live = {
  key: 'live', title: 'Live', office: 'The live room', icon: 'play',
  blurb: 'Seminars, town halls, and briefings on HT\'s own player, with chat and same-day replays.',
  sub: 'Town halls, briefings, lectures, and faculty sessions, live on HT\'s player, with the replay the same afternoon.',
  stamp: 'Preview · sample sessions', headCta: { label: 'Open the room', href: '#room', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'The live room', title: 'One player for everything the campus does live.',
      text: 'Seminars, town halls, donor briefings, guest lectures, faculty development. All of it runs on HT\'s own player, under HT\'s name, with the chat beside the picture and the replay on the shelf the same afternoon. Anyone with the link can watch. No account needed to get in the door.',
      ctas: [{ label: 'Open the room', href: '#room', style: 'ht' }, { label: 'The replay shelf', href: '#replays', style: 'ht-line' }],
      image: '/ht/img/cover-dais.jpg', imageAlt: 'The dais in the auditorium at Huston-Tillotson',
      ada: { text: 'The next live session is the fall town hall, Thursday at noon. Open the room a few minutes early. The rehearsal loop is playing so you can check your sound.', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'player', id: 'room', cardTitle: 'The live room', meta: 'The real broadcast goes here', title: 'The HT live room', live: false, poster: '/ht/img/hero-flyover-poster.jpg',
      now: { title: 'Fall town hall, live from the auditorium', who: 'Dr. Melva K. Wallace, 7th President and CEO', when: 'Thursday, Sep 10 · 12:00 PM CT' } },
    { type: 'stats', items: [{ n: '8', label: 'Live sessions on the calendar (sample)' }, { n: '6', label: 'Replays on the shelf (sample)' }, { n: 'Same day', label: 'The replay lands after each session' }, { n: '5', label: 'Offices using the room (sample)' }] },
    { type: 'replays', id: 'replays', title: 'The replay shelf', meta: 'Sample recordings · captioned', items: [
      { title: 'Fall Convocation address', date: 'Aug 2026', len: '38:12', poster: '/ht/img/fall-convocation.jpg', tag: 'Office of the President' },
      { title: 'Faculty development · session one', date: 'Aug 2026', len: '52:18', poster: '/ht/img/students-library.jpg', tag: 'Academic Affairs' },
      { title: 'A live visit for families', date: 'Jul 2026', len: '44:30', poster: '/ht/img/campus-hero.jpg', tag: 'Admissions' },
      { title: 'Commencement 2026', date: 'May 2026', len: '1:52:40', poster: '/ht/img/commencement.jpg', tag: 'Office of the President' },
      { title: 'Spring donor briefing', date: 'Apr 2026', len: '41:05', poster: '/ht/img/wallace-students.jpg', tag: 'Institutional Advancement' },
      { title: 'Guest lecture · building a business in Austin', date: 'Mar 2026', len: '58:47', poster: '/ht/img/student-laptop.jpg', tag: 'Career Services' } ] },
    { type: 'steps', id: 'how', title: 'How a live seminar runs', meta: 'Three steps, one afternoon', items: [
      { em: 'Step one', h: 'Schedule it', p: 'Your office picks the date and writes two lines. It appears on the live calendar and the home page, and guests get the link by text or email.' },
      { em: 'Step two', h: 'Go live from any camera', p: 'A phone on a stand, the auditorium camera, or a laptop. The room opens fifteen minutes early with the chat on, and the host reads questions from the floor first.' },
      { em: 'Step three', h: 'The replay lands on the shelf', p: 'Captioned and trimmed, the same afternoon, next to the last one. Slides and materials sit beside it. Nothing to upload, nothing to forward.' } ] },
    { type: 'calendar', side: true, id: 'calendar', title: 'Coming up live', meta: 'Sample · every office', items: [
      { date: '2026-09-10', title: 'Fall town hall', where: 'Office of the President · 12:00 PM CT', tag: 'Live', tagCls: 'live' },
      { date: '2026-09-24', title: 'Faculty development · teaching with the hub', where: 'Academic Affairs · 3:00 PM CT' },
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Institutional Advancement · 12:00 PM CT' },
      { date: '2026-10-22', title: 'Guest lecture · Business program', where: 'Academic Affairs · 6:00 PM CT' },
      { date: '2026-11-07', title: 'Donor Appreciation Weekend luncheon', where: 'Institutional Advancement · 12:00 PM CT' },
      { date: '2026-11-19', title: 'A live visit for families', where: 'Admissions · 6:30 PM CT' },
      { date: '2027-01-21', title: 'Spring town hall', where: 'Office of the President · 12:00 PM CT' },
      { date: '2027-03-11', title: 'Faculty development · spring session', where: 'Academic Affairs · 3:00 PM CT' } ] },
    { type: 'chat', side: true, id: 'chat', title: 'The room chat', meta: 'Open during every session', room: 'live', seed: [
      { who: 'Ada · HT student ambassador', text: 'This is the room chat. It stays open during every live session and closes with the replay.', when: 'Sample' },
      { who: 'Dana W. · alumna (sample)', text: 'Watching from Houston. The picture is clean on my phone.', when: 'Last session' },
      { who: 'Faculty · Natural Sciences (sample)', text: 'Can we get the slides after? The replay usually covers it.', when: 'Last session' },
      { who: 'Office of the President', text: 'Slides land in Materials with the replay, same afternoon.', when: 'Last session' },
      { who: 'Kevin O. · senior (sample)', text: 'Is there a way to ask without typing? Is there a standing mic in the room?', when: 'Last session' },
      { who: 'Ada · HT student ambassador', text: 'Yes. The room gets the mic first, then the host reads from here.', when: 'Last session' } ] },
    { type: 'faq', side: true, id: 'faq', title: 'What donors and faculty ask', meta: 'Four questions', items: [
      { q: 'Do I need an account to watch?', a: 'No. The link opens the room for anyone who has it. Signing in adds your name to the chat and remembers where you left off.' },
      { q: 'Does it work on a phone?', a: 'Yes. It plays in the browser on any phone, and the chat sits under the picture. Add the hub to your home screen and it opens like an app.' },
      { q: 'Can we keep the recording?', a: 'Yes. Every replay stays on the shelf for as long as the University wants it there, and the file is the University\'s to download at any time.' },
      { q: 'Can a session be private to one group?', a: 'Yes. A briefing can open to a guest list only, with a code at the door the same way check-in works. Donors see the donor room. Faculty see theirs.' } ] },
    { type: 'materials', side: true, title: 'For hosts', meta: 'Sample', items: [
      { kind: 'DOC', title: 'Host checklist · before you go live', sub: 'Fifteen minutes, one page', restricted: true },
      { kind: 'DOC', title: 'Camera and sound · the short guide', sub: 'Phone, laptop, or the auditorium camera', restricted: true },
      { kind: 'PLAY', title: 'Fall Convocation address', sub: 'Replay · 38 minutes', href: '#replays' },
      { kind: 'DECK', title: 'President\'s Fall Briefing · slides', sub: 'Posts with the replay on Oct 8', restricted: true } ] },
    { type: 'cta', title: 'The next session is Thursday at noon.', text: 'The fall town hall, live from the auditorium. Open the room a few minutes early and say hello in the chat.',
      primary: { label: 'Open the room', href: '#room', style: 'ht-gold' }, secondary: { label: 'See every session', href: '#calendar', style: 'ht-line' } }
  ]
};

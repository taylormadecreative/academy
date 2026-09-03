/* The HT Hub, Learn (Academic Affairs, co-curricular). SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.learn = {
  key: 'learn', title: 'Learn', office: 'Academic Affairs · co-curricular', icon: 'book',
  blurb: 'Co-curricular tracks with a live room, a materials shelf, and a certificate from HT at the end.',
  sub: 'Short tracks that run beside the course catalog, never inside it. Live sessions, replays, materials, and a certificate issued by the University when a track closes.',
  stamp: 'Preview · sample tracks', headCta: { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Academic Affairs · co-curricular', title: 'Everything around the classroom.',
      text: 'AI Literacy, Entrepreneurship on the Hill, Financial Literacy. Short tracks with a live room, a materials shelf, attendance by code, and a certificate issued by HT at the end. This is not the University\'s course system, and it never touches it. It is the learning that happens between classes, kept in one place.',
      ctas: [{ label: 'The tracks', href: '#tracks', style: 'ht' }, { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-line' }],
      image: '/ht/img/students-library.jpg', imageAlt: 'Huston-Tillotson students studying in the library',
      ada: { text: 'Session 03 of AI Literacy is Monday at 6. The replay of Session 02 is on the shelf and the assignment is one page. Want me to put Monday on your calendar?', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'stats', items: [{ n: '3', label: 'Tracks open this year (sample)' }, { n: '19', label: 'Sessions across the tracks' }, { n: '2', label: 'AI Literacy sessions done' }, { n: '1', label: 'Certificate from HT per track' }] },
    { type: 'tracks', id: 'tracks', title: 'The tracks', meta: 'Live in the hub · replays same day', items: [
      { title: 'AI Literacy', text: 'Eight sessions. Every student leaves each one with real work done by AI, on free tools, in their own voice.', tag: 'Fall 2026', sessions: [
        { no: '01', title: 'Your AI toolkit', date: 'Sep 14 · done', done: true }, { no: '02', title: 'Write it once, in your voice', date: 'Sep 21 · done', done: true }, { no: '03', title: 'Research without the rabbit hole', date: 'Sep 28 · 6:00 PM', status: 'Next' },
        { no: '04', title: 'Numbers you can explain', date: 'Oct 5', status: 'Upcoming' }, { no: '05', title: 'Slides that say one thing', date: 'Oct 12', status: 'Upcoming' }, { no: '06', title: 'A small automation of your own', date: 'Oct 19', status: 'Upcoming' },
        { no: '07', title: 'Your portfolio page', date: 'Oct 26', status: 'Upcoming' }, { no: '08', title: 'Showcase rehearsal', date: 'Nov 2', status: 'Upcoming' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Lands on the student\'s page and the donor\'s page when the track ends', status: 'Sample', cls: 'sample' } },
      { title: 'Entrepreneurship on the Hill', text: 'Six sessions from an idea to a pitch, with a judged showcase in March.', tag: 'Spring 2027', sessions: [
        { no: '01', title: 'The problem worth solving', date: 'Jan 25', status: 'Opens Jan' }, { no: '02', title: 'Talk to ten people', date: 'Feb 1', status: 'Opens Jan' }, { no: '03', title: 'The one-page model', date: 'Feb 8', status: 'Opens Jan' },
        { no: '04', title: 'Price it', date: 'Feb 15', status: 'Opens Jan' }, { no: '05', title: 'Tell it in ninety seconds', date: 'Feb 22', status: 'Opens Jan' }, { no: '06', title: 'Pitch night rehearsal', date: 'Mar 1', status: 'Opens Jan' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Lands on the student\'s page and the donor\'s page when the track ends', status: 'Sample', cls: 'sample' } },
      { title: 'Financial Literacy', text: 'Five sessions on budgets, credit, and the first year after graduation, taught plainly.', tag: 'Fall 2026', sessions: [
        { no: '01', title: 'Where the money goes', date: 'Oct 7 · done', done: true }, { no: '02', title: 'Credit, explained once', date: 'Oct 14', status: 'Next' }, { no: '03', title: 'Loans and the letter you will get', date: 'Oct 21', status: 'Upcoming' },
        { no: '04', title: 'Your first paycheck', date: 'Oct 28', status: 'Upcoming' }, { no: '05', title: 'A plan you will keep', date: 'Nov 4', status: 'Upcoming' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Lands on the student\'s page and the donor\'s page when the track ends', status: 'Sample', cls: 'sample' } } ] },
    { type: 'cards', title: 'Faculty development', meta: 'Live in the hub · replays on the shelf', items: [
      { meta: 'Sep 24 · 3:00 PM', title: 'Teaching with the hub', text: 'Attendance by code, materials in one place, and the replay that lands the same afternoon.', img: '/ht/img/r-academic.jpg', alt: 'Rendering of an academic building', badge: 'Sample', foot: 'Replay after the session' },
      { meta: 'Nov 12 · 3:00 PM', title: 'AI in the syllabus, honestly', text: 'What to allow, what to require, and how to say it in the first week.', img: '/ht/img/students-library.jpg', alt: 'Students in the library', badge: 'Sample', foot: 'Replay after the session' },
      { meta: 'Mar 11 · 3:00 PM', title: 'Running your own track', text: 'Any department can open a co-curricular track. This is the one-hour walkthrough.', img: '/ht/img/fall-convocation.jpg', alt: 'Fall convocation', badge: 'Sample', foot: 'Replay after the session' } ] },
    { type: 'cards', title: 'Guest lecture series', meta: 'Open to the campus · replay available', items: [
      { meta: 'Oct 22 · 6:00 PM', title: 'Building a business in Austin', text: 'An alumna founder on the first three years, the mistakes, and the city.', img: '/ht/img/r-retail-street.jpg', alt: 'Rendering of a campus retail street at dusk', badge: 'Sample', foot: 'Replay available' },
      { meta: 'Nov 19 · 6:00 PM', title: 'A century and a half on the Hill', text: 'A faculty historian on the roots that reach to 1875 and the 1952 union that made HT.', img: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson campus', badge: 'Sample', foot: 'Replay available' },
      { meta: 'Feb 18 · 6:00 PM', title: 'Health careers, the real map', text: 'A panel of alumni in nursing, therapy, and public health on the paths that worked.', img: '/ht/img/commencement.jpg', alt: 'Commencement on the Hill', badge: 'Sample', foot: 'Replay available' } ] },
    { type: 'split', id: 'cohort', kicker: 'A named cohort a donor funded', title: 'The cohort on the donor\'s page.',
      text: 'When a gift funds a block of seats, the cohort appears on the donor\'s own page: the name they chose, the sessions, and the students it reached, first names only, with permission. The certificate lands there too.',
      bullets: ['"The Johnson Family AI Literacy Cohort" · 24 seats · sample', 'Daniel O., Maribel A., Jalen W., and twenty-one more, with permission', 'Showcase December 4, the donor is invited'],
      image: '/ht/img/student-laptop.jpg', imageAlt: 'A student working on a laptop', side: 'right', cta: { label: 'How funding a cohort works', href: '/ht/fund/', style: 'ht-gold' } },
    { type: 'faq', title: 'What faculty and students ask', items: [
      { q: 'Does this replace the University\'s course system?', a: 'No. Tracks are co-curricular and live only here. Courses, grades, and records stay exactly where they are.' },
      { q: 'Who teaches a track?', a: 'HT faculty and staff, guest instructors approved by Academic Affairs, and, for the AI tracks, the Academy\'s instructors, on HT\'s calendar.' },
      { q: 'Can a department run its own track?', a: 'Yes. A track is a schedule, a live room, a materials shelf, and a check-in code. The March faculty session walks through it.' },
      { q: 'Do students get credit?', a: 'A certificate of completion issued by HT, not course credit. It appears on the student\'s page and, when a donor funded the cohort, on the donor\'s page.' } ] },
    { type: 'cta', title: 'See what the tracks produce.', text: 'Projects, posters, and the judged showcase, on the Showcase space.', primary: { label: 'Open the Showcase', href: '/ht/hub/showcase/', style: 'ht-gold' }, secondary: { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-line' } },
    { type: 'materials', side: true, title: 'AI Literacy · materials', meta: 'Sample', items: [
      { kind: 'REC', title: 'Session 02 replay', sub: '41 minutes · captioned', href: '/ht/hub/live/' }, { kind: 'PLAY', title: 'Session 02 playbook', sub: 'Write it once, in your voice · 6 pages', restricted: true },
      { kind: 'DOC', title: 'Session 03 assignment', sub: 'One page, due Monday', restricted: true }, { kind: 'REC', title: 'Session 01 replay', sub: '38 minutes · captioned', href: '/ht/hub/live/' } ] },
    { type: 'checkin', side: true, title: 'Check in', meta: 'Code on the screen', session: 'AI Literacy · Session 03', sub: 'Monday, Sep 28 · 6:00 PM', code: 'LEARN03', hint: 'Type the code from the screen. Sample code for this preview: LEARN03.' },
    { type: 'announcements', side: true, title: 'Academic Affairs desk', meta: 'Sample', items: [
      { who: 'Academic Affairs', when: 'Today', text: 'Financial Literacy opens Oct 7 in the live room. Seats are open to every student.' },
      { who: 'AI Literacy', when: 'Yesterday', text: 'Session 02 replay is on the shelf. The assignment is one page and due Monday.' },
      { who: 'Faculty development', when: 'Monday', text: 'Teaching with the hub is Sep 24 at 3. Bring your syllabus.' } ] }
  ]
};

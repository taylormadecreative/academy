/* The HT Hub, Students (Student Affairs). SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.students = {
  key: 'students', title: 'Students', office: 'Student Affairs', icon: 'users',
  blurb: 'Orientation Week in your pocket, student orgs with their own channels, leadership programs, and seminars with attendance.',
  sub: 'The first week, the orgs, the leadership programs, and the seminar series, with a check-in code at the door of each.',
  stamp: 'Preview · sample content', headCta: { label: 'Orientation Week', href: '#orientation', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Student Affairs', title: 'Your first week, and every week after.',
      text: 'Orientation Week with the schedule in your pocket and a code at every door. Student organizations with their own channels. Leadership programs that end in a certificate. Seminar series that count attendance by one tap. All of it under the same sign-in as the rest of the Hill.',
      ctas: [{ label: 'Orientation Week', href: '#orientation', style: 'ht' }, { label: 'Student organizations', href: '#orgs', style: 'ht-line' }],
      image: '/ht/img/campus-hero.jpg', imageAlt: 'The Huston-Tillotson campus',
      ada: { text: 'Welcome to the Hill, Class of 2030. Tuesday starts at 8:30 with check-in and welcome bags at the main entrance. Your code is on the screen when you walk in. Want the three days on your calendar?', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'agenda', id: 'orientation', title: 'Orientation Week', meta: 'The first three days · full week in the hub', event: { name: 'Orientation Week', dates: 'Tue Sep 8 to Sat Sep 12, 2026', place: 'Huston-Tillotson University', note: 'Sample schedule' }, days: [
      { label: 'Tuesday, September 8', date: '2026-09-08', items: [
        { time: '8:30 AM', title: 'Check-in and welcome bags', where: 'Main entrance', who: 'Student Affairs', tag: 'Code on screen', tagCls: 'green' }, { time: '10:00 AM', title: 'Welcome to the Hill', where: 'The auditorium', who: 'Dr. Melva K. Wallace' },
        { time: '11:30 AM', title: 'Lunch with your orientation group', where: 'The library lawn', who: 'Peer leaders (sample)' }, { time: '1:30 PM', title: 'Academic advising by program', where: 'Classrooms listed on your schedule', who: 'Faculty advisors' },
        { time: '3:30 PM', title: 'ID cards and tech setup', where: 'The library', who: 'Student services' }, { time: '5:00 PM', title: 'Residence hall meetings', where: 'Your hall', who: 'Residence life' } ] },
      { label: 'Wednesday, September 9', date: '2026-09-09', items: [
        { time: '9:00 AM', title: 'Campus walk', where: 'Meet at the chapel', who: 'Peer leaders (sample)' }, { time: '10:30 AM', title: 'Chapel and a word from the chaplain', where: 'The chapel' },
        { time: '11:30 AM', title: 'Financial aid walk-through', where: 'The library · Financial aid' }, { time: '1:00 PM', title: 'Put the HT Hub on your phone', where: 'The library', who: 'Ada and the peer leaders', tag: 'Hub', tagCls: '' },
        { time: '2:30 PM', title: 'Clubs and organizations fair', where: 'The library lawn', who: 'Student orgs' }, { time: '6:30 PM', title: 'Evening social', where: 'The courtyard', who: 'Peer leaders (sample)' } ] },
      { label: 'Thursday, September 10', date: '2026-09-10', items: [
        { time: '9:00 AM', title: 'First-generation family session', where: 'The auditorium', who: 'Student Affairs and families' }, { time: '10:30 AM', title: 'Health and wellness session', where: 'The chapel', who: 'Counseling and health services' },
        { time: '12:00 PM', title: 'Fall town hall, live', where: 'The auditorium', who: 'Dr. Melva K. Wallace', tag: 'Live', tagCls: 'live' }, { time: '2:00 PM', title: 'Class of 2030 photo', where: 'The steps', who: 'Campus photographer (sample)' },
        { time: '3:30 PM', title: 'Your first week, planned', where: 'The library', who: 'Peer leaders (sample)' } ] } ] },
    { type: 'checkin', title: 'Check in at the door', meta: 'One tap marks you present', session: 'Orientation · Day one welcome', sub: 'Tuesday, Sep 8 · 8:30 AM · main entrance', code: 'HILL30', hint: 'The code is on the screen at the door. Sample code for this preview: HILL30.' },
    { type: 'cards', id: 'orgs', title: 'Student organizations', meta: 'Each has its own channel · counts are sample', items: [
      { meta: 'Student government · 41 members', title: 'Student Government Association', text: 'Meets Mondays at 5. Minutes post in the channel the same night.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Music · 58 members', title: 'Gospel choir', text: 'Rehearsal Wednesdays at 6 in the chapel. New voices welcome.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Pre-professional · 27 members', title: 'Pre-law society', text: 'Speakers, practice tests, and a spring trip to the courthouse.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'STEM · 33 members', title: 'STEM club', text: 'Study groups, the research showcase, and a build night each month.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Media · 22 members', title: 'Creative media collective', text: 'Photo, video, and the campus channel\'s weekly recap.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Service · 36 members', title: 'Service society', text: 'Saturday service in East Austin. Hours logged in the hub.', foot: 'Join the channel →', href: '/ht/hub/community/' } ] },
    { type: 'tracks', title: 'Leadership programs', meta: 'Certificates issued by HT · sample', items: [
      { title: 'Emerging Leaders', text: 'Six sessions for first- and second-year students who want to run something.', tag: 'Fall 2026', sessions: [
        { no: '01', title: 'What a leader on the Hill does', date: 'Sep 22 · done', done: true }, { no: '02', title: 'Running a meeting people come back to', date: 'Oct 6', status: 'Next' }, { no: '03', title: 'Money and a budget', date: 'Oct 20', status: 'Upcoming' },
        { no: '04', title: 'Asking for help', date: 'Nov 3', status: 'Upcoming' }, { no: '05', title: 'Your org\'s channel', date: 'Nov 17', status: 'Upcoming' }, { no: '06', title: 'Passing it on', date: 'Dec 1', status: 'Upcoming' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Lands on the student\'s page when the program ends', status: 'Sample', cls: 'sample' } },
      { title: 'Peer mentors', text: 'Four sessions for the students who run Orientation Week.', tag: 'Summer 2026', sessions: [
        { no: '01', title: 'The first week, from their side', date: 'Aug 18 · done', done: true }, { no: '02', title: 'When someone is struggling', date: 'Aug 20 · done', done: true }, { no: '03', title: 'The hub, the codes, the calendar', date: 'Aug 25 · done', done: true }, { no: '04', title: 'Day-of rehearsal', date: 'Sep 4', status: 'Next' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Lands on the student\'s page when the program ends', status: 'Sample', cls: 'sample' } } ] },
    { type: 'cards', title: 'Seminar series with attendance', meta: 'Check-in code on screen', items: [
      { meta: 'Monthly · counseling and health', title: 'Wellness Wednesdays', text: 'Sleep, stress, and the semester. Attendance counts toward the wellness certificate.', img: '/ht/img/fall-convocation.jpg', alt: 'Fall convocation', foot: 'Check-in code on screen' },
      { meta: 'Fall · Financial aid', title: 'Financial wellness', text: 'Four evenings on aid, budgets, and the letter that comes in March.', img: '/ht/img/students-library.jpg', alt: 'Students in the library', foot: 'Check-in code on screen' },
      { meta: 'Fall · the library', title: 'Study skills', text: 'Three sessions before midterms. The replay lands the same afternoon.', img: '/ht/img/student-laptop.jpg', alt: 'A student at a laptop', foot: 'Check-in code on screen' },
      { meta: 'Spring · civic engagement', title: 'Civic engagement', text: 'Voting, city council, and the service society\'s Saturdays.', img: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson campus', foot: 'Check-in code on screen' } ] },
    { type: 'cta', title: 'Everything on the Hill, one sign-in.', text: 'Your orgs, your seminars, your first week, and the campus channel, all in the same place as the live room.', primary: { label: 'Open the Community', href: '/ht/hub/community/', style: 'ht-gold' }, secondary: { label: 'The live room', href: '/ht/hub/live/', style: 'ht-line' } },
    { type: 'announcements', side: true, title: 'Student Affairs desk', meta: 'Sample', items: [
      { who: 'Student Affairs', when: 'Today', text: 'Orientation Week codes are shown on the screen at each session. One tap marks you present.' },
      { who: 'Residence life', when: 'Yesterday', text: 'Hall meetings are Tuesday at 5. Bring your ID.' },
      { who: 'Student orgs', when: 'Monday', text: 'The clubs fair is Wednesday at 2:30 on the library lawn. Every org has a table and a channel.' } ] },
    { type: 'calendar', side: true, title: 'This month', meta: 'Sample', items: [
      { date: '2026-09-08', title: 'Orientation Week begins', where: 'Main entrance · 8:30 AM' }, { date: '2026-09-09', title: 'Clubs and organizations fair', where: 'The library lawn · 2:30 PM' },
      { date: '2026-09-10', title: 'Fall town hall, live', where: 'The auditorium · noon', tag: 'Live', tagCls: 'live' }, { date: '2026-09-16', title: 'Wellness Wednesday', where: 'The chapel · 5:00 PM' },
      { date: '2026-09-22', title: 'Emerging Leaders · Session 01', where: 'The library · 5:00 PM' }, { date: '2026-09-26', title: 'Service Saturday', where: 'East Austin · 9:00 AM' } ] },
    { type: 'people', side: true, title: 'Student Affairs desk', meta: 'Sample roles', dm: false, items: [
      { name: 'Dean of Students (sample)', role: 'Student Affairs', org: 'Space owner', tag: 'Owner', tagCls: 'green' }, { name: 'Orientation lead (sample)', role: 'Orientation Week', org: 'Runs the schedule and the codes' },
      { name: 'Student orgs coordinator (sample)', role: 'Organizations', org: 'Opens channels, approves events' }, { name: 'Residence life director (sample)', role: 'Housing', org: 'Hall meetings and the housing channel' } ] }
  ]
};

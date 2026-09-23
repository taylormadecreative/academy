/* The HT Hub, Students (Student Affairs). SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.students = {
  key: 'students', title: 'Students', office: 'Student Affairs', icon: 'users',
  blurb: 'Spring Ready Week in your pocket, student orgs with their own channels, leadership programs, and seminars with attendance.',
  sub: 'The first week, the orgs, the leadership programs, and the seminar series, with a check-in code at the door of each.',
  stamp: 'Preview · sample content', headCta: { label: 'Spring Ready Week', href: '#orientation', style: 'ht' },
  blocks: [
    { type: 'intro', kicker: 'Student Affairs', title: 'Every week on the Hill, in your pocket.',
      text: 'Spring Ready Week with the schedule in your pocket and a code at every door. Student organizations with their own channels. Leadership programs with a certificate from HT at the end, next on the roadmap. Seminar series that count attendance by one tap. All of it under the same sign-in as the rest of the Hill.',
      ctas: [{ label: 'Spring Ready Week', href: '#orientation', style: 'ht' }, { label: 'Student organizations', href: '#orgs', style: 'ht-line' }],
      image: '/ht/img/students-library.jpg', imageAlt: 'Five Huston-Tillotson students in HT shirts in the campus library',
      ada: { text: 'Spring Ready Week starts October 20 at 8:30 with check-in at the main entrance: advising, aid, wellness, and the clubs fair, the three days before Charter Day. Your code is on the screen when you walk in. Want the three days on your calendar?', when: 'Ada, the Hub’s AI guide · sample' } },
    { type: 'agenda', id: 'orientation', title: 'Spring Ready Week', meta: 'The three days before Charter Day · advising opens Oct 19, registration Oct 26 · sample schedule', event: { name: 'Spring Ready Week', dates: 'Tue Oct 20 to Thu Oct 22, 2026', place: 'Huston-Tillotson University', note: 'Sample schedule' }, days: [
      { label: 'Tuesday, October 20', date: '2026-10-20', items: [
        { time: '8:30 AM', title: 'Check-in and welcome bags', where: 'Main entrance', who: 'Student Affairs', tag: 'Code on screen', tagCls: 'green' }, { time: '10:00 AM', title: 'Opening the week', where: 'The auditorium', who: 'Dean of Students (sample)' },
        { time: '11:30 AM', title: 'Lunch with your class', where: 'The library lawn', who: 'Peer leaders (sample)' }, { time: '1:30 PM', title: 'Spring advising by program', where: 'Classrooms listed on your schedule', who: 'Faculty advisors' },
        { time: '3:30 PM', title: 'Study skills before finals', where: 'The library', who: 'The library' }, { time: '5:00 PM', title: 'Residence hall meetings', where: 'Your hall', who: 'Residence life' } ] },
      { label: 'Wednesday, October 21', date: '2026-10-21', items: [
        { time: '9:00 AM', title: 'The 1875 walk · the campus and its story', where: 'Meet at the chapel', who: 'Peer leaders (sample)' }, { time: '10:30 AM', title: 'Chapel and a word from the chaplain', where: 'The chapel' },
        { time: '11:30 AM', title: 'Financial aid walk-through', where: 'The library · Financial aid' }, { time: '1:00 PM', title: 'Put the HT Hub on your phone', where: 'The library', who: 'Ada and the peer leaders', tag: 'Hub', tagCls: '' },
        { time: '2:30 PM', title: 'Clubs and organizations fair', where: 'The library lawn', who: 'Student orgs' }, { time: '6:30 PM', title: 'Evening social', where: 'The courtyard', who: 'Peer leaders (sample)' } ] },
      { label: 'Thursday, October 22', date: '2026-10-22', items: [
        { time: '9:00 AM', title: 'First-generation family session', where: 'The auditorium', who: 'Student Affairs and families' }, { time: '10:30 AM', title: 'Health and wellness session', where: 'The chapel', who: 'Counseling and health services' },
        { time: '12:00 PM', title: 'Charter Day eve · A century and a half on the Hill, live', where: 'The auditorium', who: 'A faculty historian (sample)', tag: 'Live room', tagCls: 'soft' }, { time: '2:00 PM', title: 'All-campus photo', where: 'The steps', who: 'Campus photographer (sample)' },
        { time: '3:30 PM', title: 'Charter Day, planned · how the Hill marks Friday', where: 'The library', who: 'Peer leaders (sample)' } ] } ] },
    { type: 'checkin', title: 'Check in at the door', meta: 'One tap marks you present', session: 'Spring Ready Week · Day one', sub: 'Tuesday, Oct 20 · 8:30 AM · main entrance', code: 'HILL30', hint: 'The code is on the screen at the door. Sample code for this preview: HILL30.' },
    { type: 'cards', id: 'orgs', title: 'Student organizations', meta: 'Each has its own channel · counts are sample', items: [
      { meta: 'Student government · 41 members', title: 'Student Government Association', text: 'Meets Wednesdays at 5. Minutes post in the channel the same night.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Music · 58 members', title: 'Gospel choir', text: 'Rehearsal Wednesdays at 6 in the chapel. New voices welcome.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Pre-professional · 27 members', title: 'Pre-law society', text: 'Speakers, practice tests, and a spring trip to the courthouse.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'STEM · 33 members', title: 'STEM club', text: 'Study groups, the research showcase, and a build night each month.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Media · 22 members', title: 'Creative media collective', text: 'Photo, video, and the campus channel\'s weekly recap.', foot: 'Join the channel →', href: '/ht/hub/community/' },
      { meta: 'Service · 36 members', title: 'Service society', text: 'Saturday service in East Austin. Hours logged in the hub.', foot: 'Join the channel →', href: '/ht/hub/community/' } ] },
    { type: 'tracks', title: 'Leadership programs', meta: 'Certificate from HT at the end · next', items: [
      { title: 'Emerging Leaders', text: 'Six sessions for first- and second-year students who want to run something.', tag: 'Fall 2026 · Spring 2027', sessions: [
        { no: '01', title: 'What a leader on the Hill does', date: 'Oct 27 · 5:00 PM', status: 'Next' }, { no: '02', title: 'Running a meeting people come back to', date: 'Nov 10', status: 'Upcoming' }, { no: '03', title: 'Money and a budget', date: 'Nov 17', status: 'Upcoming' },
        { no: '04', title: 'Asking for help', date: 'Dec 1', status: 'Upcoming' }, { no: '05', title: 'Your org\'s channel', date: 'Jan 26', status: 'Upcoming' }, { no: '06', title: 'Passing it on', date: 'Feb 9', status: 'Upcoming' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Next on the roadmap: lands on the student\'s page when the program ends', status: 'Next', cls: 'soft' } },
      { title: 'Peer mentors', text: 'Four sessions for the students who run Spring Ready Week.', tag: 'Fall 2026', sessions: [
        { no: '01', title: 'Spring Ready Week, from their side', date: 'Oct 12', status: 'Next' }, { no: '02', title: 'When someone is struggling', date: 'Oct 14', status: 'Upcoming' }, { no: '03', title: 'The hub, the codes, the calendar', date: 'Oct 15', status: 'Upcoming' }, { no: '04', title: 'Day-of rehearsal', date: 'Oct 19', status: 'Upcoming' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Next on the roadmap: lands on the student\'s page when the program ends', status: 'Next', cls: 'soft' } } ] },
    { type: 'cards', title: 'Seminar series with attendance', meta: 'Check-in code on screen', items: [
      { meta: 'Monthly · counseling and health', title: 'Wellness Wednesdays', text: 'Sleep, stress, and the semester. Attendance counts toward the wellness certificate.', img: '/ht/img/wallace-students.jpg', alt: 'Huston-Tillotson students and staff around a seminar table', foot: 'Check-in code on screen' },
      { meta: 'Fall · Financial aid', title: 'Financial wellness', text: 'Four evenings on aid, budgets, and the letter that comes in March.', tile: { icon: 'coin', label: 'Financial aid' }, foot: 'Check-in code on screen' },
      { meta: 'Fall · the library', title: 'Study skills', text: 'Three sessions before midterms. The replay lands the same afternoon.', img: '/ht/img/student-laptop.jpg', alt: 'A student studying at a laptop in the library', foot: 'Check-in code on screen' },
      { meta: 'Spring · civic engagement', title: 'Civic engagement', text: 'Voting, city council, and the service society\'s Saturdays.', tile: { icon: 'hands', label: 'Civic engagement' }, foot: 'Check-in code on screen' } ] },
    { type: 'cta', title: 'Everything on the Hill, one sign-in.', text: 'Your orgs, your seminars, your first week, and the campus channel, all in the same place as the live room.', primary: { label: 'Open the Community', href: '/ht/hub/community/', style: 'ht-gold' }, secondary: { label: 'The live room', href: '/ht/hub/live/', style: 'ht-line' } },
    { type: 'announcements', side: true, title: 'Student Affairs desk', meta: 'Sample', items: [
      { who: 'Student Affairs', when: 'This week', text: 'Spring Ready Week codes are shown on the screen at each session. One tap marks you present.' },
      { who: 'Residence life', when: 'This week', text: 'Hall meetings are October 20 at 5 in your hall. Bring your ID.' },
      { who: 'Student orgs', when: 'Last week', text: 'The clubs fair is October 21 at 2:30 on the library lawn. Every org has a table and a channel.' } ] },
    { type: 'calendar', side: true, title: 'Coming up', meta: 'Sample', items: [
      { date: '2026-10-15', title: 'Fall town hall, live', where: 'The auditorium · noon', tag: 'Live room', tagCls: 'soft' }, { date: '2026-10-20', title: 'Spring Ready Week begins', where: 'Main entrance · 8:30 AM' },
      { date: '2026-10-21', title: 'Clubs and organizations fair', where: 'The library lawn · 2:30 PM' }, { date: '2026-10-23', title: 'Charter Day Observance', where: 'HT\'s published calendar · Campus' },
      { date: '2026-10-24', title: 'Service Saturday', where: 'East Austin · 9:00 AM' }, { date: '2026-10-27', title: 'Emerging Leaders · Session 01', where: 'The library · 5:00 PM' }, { date: '2026-10-28', title: 'Wellness Wednesday', where: 'The chapel · 5:00 PM' } ] },
    { type: 'people', side: true, title: 'Student Affairs desk', meta: 'Sample roles', dm: false, items: [
      { name: 'Dean of Students (sample)', role: 'Student Affairs', org: 'Space owner', tag: 'Owner', tagCls: 'green' }, { name: 'Spring Ready Week lead (sample)', role: 'Spring Ready Week', org: 'Runs the schedule and the codes' },
      { name: 'Student orgs coordinator (sample)', role: 'Organizations', org: 'Opens channels, approves events' }, { name: 'Residence life director (sample)', role: 'Housing', org: 'Hall meetings and the housing channel' } ] }
  ]
};

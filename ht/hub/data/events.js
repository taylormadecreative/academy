/* The HT Hub — Campus events (the event app). Everything here is SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.events = {
  key: 'events', title: 'Events', office: 'Institutional Advancement · events', icon: 'calendar',
  blurb: 'Agendas, rooms, check-in at the door, and a line to your host. No app to download.',
  sub: 'Advancement\'s own events on one page: the agenda, the people, the rooms, and the door. The same page is there for any office that wants it, and it plugs into whatever Marketing builds.',
  stamp: 'Preview · sample events', headCta: { label: 'Open the weekend agenda', href: '#weekend', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Institutional Advancement · events', title: 'The whole event, in your pocket. No app to download.',
      text: 'One link opens the agenda, the speakers, the rooms, a line to your host, and the check-in at the door. Add it to your calendar in a tap. Print it if you like paper. Built for Advancement\'s own events, from the donor weekend to the fall briefing, and ready for any office that wants the same page.',
      ctas: [{ label: 'Donor Appreciation Weekend', href: '#weekend', style: 'ht' }, { label: 'Orientation Week', href: '/ht/hub/students/#orientation', style: 'ht-line' }],
      image: '/ht/img/campus-hero.jpg', imageAlt: 'The Huston-Tillotson campus in Austin',
      ada: { text: 'Here for Donor Appreciation Weekend? Your agenda is below, your check-in code is on the screen at the door, and the host line at the bottom of this page reaches the events lead.', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'cards', id: 'events', title: 'This year on the Hill', meta: 'Four events, one page each', items: [
      { meta: 'Nov 6–7, 2026', title: 'Donor Appreciation Weekend', text: 'Two days on the Hill for the people behind each gift. Welcome dinner Friday, the President\'s thank-you at Saturday\'s luncheon, the agenda in your pocket.', href: '#weekend', img: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson campus', badge: 'Sample', foot: 'Open the agenda →' },
      { meta: 'Sep 8–12, 2026', title: 'Orientation Week', text: 'Five days for the Class of 2030, run by Student Affairs in their own space: advising, the resources fair, the town hall, and a check-in code at every session.', href: '/ht/hub/students/#orientation', img: '/ht/img/students-library.jpg', alt: 'Students studying in the library', badge: 'Sample dates', foot: 'See the week →' },
      { meta: 'Spring 2027 · date announced by HT', title: 'Founders\' Day', text: 'The University\'s roots reach back to 1875. Founders\' Day gathers the campus to mark them. The agenda lands here the day the date is set.', img: '/ht/img/fall-convocation.jpg', alt: 'Fall convocation at Huston-Tillotson', foot: 'Details to come' },
      { meta: 'February 2027 · dates announced by HT', title: 'Homecoming 2027', text: 'The Hill fills back up. Alumni, students, and the people who love this place, together for a week.', img: '/ht/img/r-village-plaza.jpg', alt: 'Rendering of the campus plaza', foot: 'Details to come' } ] },
    { type: 'agenda', id: 'weekend', title: 'Donor Appreciation Weekend', meta: 'Add both days to your calendar in one tap',
      event: { name: 'Donor Appreciation Weekend', dates: 'Fri Nov 6 – Sat Nov 7, 2026', place: 'Huston-Tillotson University, Austin', note: 'Sample event' },
      days: [
        { label: 'Friday, November 6', date: '2026-11-06', items: [
          { time: '3:00 PM', end: '4:30 PM', title: 'Arrival and check-in', where: 'The welcome desk, main entrance', who: 'Events lead (sample)' },
          { time: '4:30 PM', end: '5:30 PM', title: 'Campus walk with student ambassadors', where: 'From the main entrance', who: 'Student ambassadors (sample)' },
          { time: '6:00 PM', end: '6:45 PM', title: 'Reception', where: 'The library lawn', who: 'Institutional Advancement' },
          { time: '7:00 PM', end: '8:30 PM', title: 'Welcome dinner', where: 'The President\'s dining room', who: 'Hosted by Linda Y. Jackson', tag: 'Check-in', tagCls: 'soft' },
          { time: '8:30 PM', end: '9:00 PM', title: 'A word from the President', where: 'The President\'s dining room', who: 'Dr. Melva K. Wallace' },
          { time: '9:00 PM', end: '9:30 PM', title: 'Shuttles to the hotel', where: 'Main entrance', who: 'Events lead (sample)' } ] },
        { label: 'Saturday, November 7', date: '2026-11-07', items: [
          { time: '8:30 AM', end: '9:30 AM', title: 'Breakfast with faculty', where: 'The President\'s dining room', who: 'Faculty hosts (sample)' },
          { time: '9:45 AM', end: '10:45 AM', title: 'Meet a funded cohort', where: 'The library', who: 'AI Literacy students, ahead of the December 4 showcase (sample)' },
          { time: '11:00 AM', end: '11:45 AM', title: 'Service of thanksgiving', where: 'The chapel', who: 'Campus ministry (sample)' },
          { time: '12:00 PM', end: '1:30 PM', title: 'Luncheon and the President\'s thank-you', where: 'The auditorium', who: 'Dr. Melva K. Wallace', tag: 'Live in the hub', tagCls: 'live' },
          { time: '1:45 PM', end: '2:30 PM', title: 'Photos on the steps', where: 'The auditorium steps', who: 'Campus photographer (sample)' },
          { time: '2:30 PM', end: '3:15 PM', title: 'Student showcase', where: 'The library lawn', who: 'Students from funded cohorts (sample)' },
          { time: '3:30 PM', end: '4:00 PM', title: 'Farewell and departures', where: 'Main entrance', who: 'Events lead (sample)' } ] } ] },
    { type: 'checkin', id: 'checkin', title: 'Check in at the door', meta: 'Sample session',
      session: 'Welcome dinner · Donor Appreciation Weekend', sub: 'Friday, Nov 6 · 7:00 PM · The President\'s dining room', code: 'HILL26',
      hint: 'The code is on the screen by the door. Type it once and you are marked present for the evening. For this preview, the screen says HILL26.' },
    { type: 'people', id: 'people', title: 'Speakers and hosts', meta: 'Sample roles, two real names', dm: false, items: [
      { name: 'Linda Y. Jackson', role: 'Vice President for Institutional Advancement', org: 'Your host for the weekend', gold: true, tag: 'Host', tagCls: 'green' },
      { name: 'Dr. Melva K. Wallace', role: '7th President and CEO', org: 'Saturday luncheon', gold: true, tag: 'Speaker', tagCls: 'soft' },
      { name: 'Events lead (sample)', role: 'Runs the agenda and check-in', org: 'Message for anything on the day' },
      { name: 'Faculty host (sample)', role: 'Saturday breakfast', org: 'Business program' },
      { name: 'Campus ministry (sample)', role: 'Service of thanksgiving', org: 'Saturday, the chapel' },
      { name: 'Student ambassadors (sample)', role: 'Campus walk', org: 'Friday, 4:30 PM' },
      { name: 'Orientation lead (sample)', role: 'Student Affairs', org: 'Orientation Week' } ] },
    { type: 'chat', id: 'host', title: 'Your host line', meta: 'Private · goes to the events lead', room: 'weekend-host', seed: [
      { who: 'Events lead (sample)', text: 'Welcome. This line comes straight to me for the weekend. Parking, a dietary need, a change of plans, anything.', when: 'Sample · Thursday' },
      { who: 'You · sample guest', text: 'Thank you. We land Friday around 2. Is check-in open that early?', when: 'Thursday', me: true },
      { who: 'Events lead (sample)', text: 'The desk opens at 3, but tell me your time and I will meet you at the gate.', when: 'Thursday' },
      { who: 'Events lead (sample)', text: 'Dinner is in the President\'s dining room at 7. The code on the door screen checks you in.', when: 'Thursday' } ] },
    { type: 'announcements', side: true, title: 'Event desk', meta: 'Sample', items: [
      { who: 'Event desk', when: 'Today', text: 'Donor Appreciation Weekend agenda is posted. Add both days to your calendar in one tap.' },
      { who: 'Student Affairs', when: 'Yesterday', text: 'Orientation Week check-in codes show on the screen at each session. One tap marks you present.' },
      { who: 'Event desk', when: 'Monday', text: 'Thursday\'s fall town hall is on the Orientation Week schedule too. Doors at 11:40.' },
      { who: 'Office of the President', when: 'Last week', text: 'Founders\' Day and Homecoming 2027 dates will post here the day they are set.' } ] },
    { type: 'calendar', side: true, title: 'The fall on the Hill', meta: 'Sample', items: [
      { date: '2026-09-08', title: 'Orientation Week begins', where: 'Main entrance · 8:30 AM' },
      { date: '2026-09-10', title: 'Fall town hall, live', where: 'The auditorium · 12:00 PM CT', tag: 'Live', tagCls: 'live' },
      { date: '2026-09-12', title: 'Orientation Week closes', where: 'Student Affairs' },
      { date: '2026-09-14', title: 'AI Literacy · Session 01', where: 'Learn · Track one' },
      { date: '2026-10-08', title: 'President\'s Fall Briefing for donors', where: 'Live room · 12:00 PM CT' },
      { date: '2026-11-06', title: 'Donor Appreciation Weekend, day one', where: 'Campus' },
      { date: '2026-11-07', title: 'Donor Appreciation Weekend, day two', where: 'Campus' },
      { date: '2026-11-19', title: 'A live visit for families', where: 'Admissions · Live room' } ] },
    { type: 'materials', side: true, title: 'Print and forms', meta: 'Sample', items: [
      { kind: 'PDF', title: 'Donor Appreciation Weekend · printed agenda', sub: 'Prints from the agenda above', href: '#weekend' },
      { kind: 'PDF', title: 'Orientation Week · printed schedule', sub: 'Student Affairs runs that week', href: '/ht/hub/students/#orientation' },
      { kind: 'FORM', title: 'Dietary needs and accessibility', sub: 'Weekend guests', restricted: true },
      { kind: 'DOC', title: 'Run of show · welcome dinner', sub: 'Events lead only', restricted: true } ] },
    { type: 'install', side: true, title: 'The event app', meta: 'No app store needed' },
    { type: 'cta', title: 'Coming to the Hill?', text: 'Add the weekend to your calendar, check in at the door, and message your host from the same page.',
      primary: { label: 'Open the weekend agenda', href: '#weekend', style: 'ht-gold' }, secondary: { label: 'Message the events lead', href: '#host', style: 'ht-line' } }
  ]
};

/* The HT Hub, Outreach (civic engagement and community outreach). SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.outreach = {
  key: 'outreach', title: 'Outreach', office: 'Civic engagement & community outreach', icon: 'globe',
  blurb: 'A public education series, church and neighborhood partner programs, and a summer bridge for high schoolers.',
  sub: 'The Hill has always belonged to East Austin. A public education series, partner programs, and a summer bridge, on the same platform the campus uses.',
  stamp: 'Preview · sample content', headCta: { label: 'The public series', href: '#series', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Civic engagement & community outreach', title: 'The Hill has always belonged to the neighborhood.',
      text: 'A public education series anyone in East Austin can join. Partner programs with churches, neighborhood associations, and high schools. A summer bridge that brings tenth and eleventh graders onto campus before their first fall. The community joins the same live room the campus uses, with the same sign-in.',
      ctas: [{ label: 'The public series', href: '#series', style: 'ht' }, { label: 'Summer Bridge', href: '#bridge', style: 'ht-line' }],
      image: '/ht/img/fall-convocation.jpg', imageAlt: 'Fall convocation at Huston-Tillotson',
      ada: { text: 'The first evening of AI for small business owners is Tuesday, October 6, at 6:30, in the auditorium and live. The code at the door is on the screen when you walk in.', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'cards', id: 'series', title: 'Public education series', meta: 'Free · open to the community · sample', items: [
      { meta: 'Tuesdays in October · 6:30 PM', title: 'AI for small business owners', text: 'Four evenings. Bring the task you are tired of doing and leave with it handed to a machine.', img: '/ht/img/r-retail-street.jpg', alt: 'Rendering of a campus street at dusk', badge: 'Sample', foot: 'Free · open to the neighborhood' },
      { meta: 'Thursdays in November · 6:30 PM', title: 'Financial wellness for families', text: 'Budgets, credit, and the college letter, for parents and grandparents.', img: '/ht/img/students-library.jpg', alt: 'Students in the library', badge: 'Sample', foot: 'Free · open to the neighborhood' },
      { meta: 'Feb 2027 · one evening', title: 'A history of the Hill', text: 'Roots that reach to 1875, and the 1952 union of Samuel Huston College and Tillotson College. Told by faculty, with the archives.', img: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson campus', badge: 'Sample', foot: 'Free · open to the neighborhood' },
      { meta: 'Apr 2027 · one evening', title: 'A health and wellness evening', text: 'Screenings, a panel of alumni in health careers, and the questions people do not ask their doctor.', img: '/ht/img/commencement.jpg', alt: 'Commencement on the Hill', badge: 'Sample', foot: 'Free · open to the neighborhood' } ] },
    { type: 'cards', title: 'Partner programs', meta: 'Sample · no real organization named here', items: [
      { meta: 'Churches', title: 'A church partner program (sample)', text: 'A monthly evening on campus for a partner congregation: a speaker, a meal, and a student host.', img: '/ht/img/fall-convocation.jpg', alt: 'Fall convocation', badge: 'Sample', foot: 'A channel per partner' },
      { meta: 'Neighborhood', title: 'A neighborhood association series (sample)', text: 'Quarterly sessions on the campus plan, the construction, and what it means for the block.', img: '/ht/img/r-village-plaza.jpg', alt: 'Rendering of the campus village plaza', badge: 'Sample', foot: 'A channel per partner' },
      { meta: 'High schools', title: 'A high-school partnership (sample)', text: 'Campus visits, a mentor from the Hill, and a seat in Summer Bridge for juniors who want it.', img: '/ht/img/students-library.jpg', alt: 'Students in the library', badge: 'Sample', foot: 'A channel per partner' } ] },
    { type: 'tracks', id: 'bridge', title: 'Summer Bridge 2027', meta: 'Tenth and eleventh graders · on campus · sample', items: [
      { title: 'Summer Bridge', text: 'Six mornings on the Hill before their first fall. A mentor, a lab, a class, and a certificate from HT.', tag: 'Summer 2027', sessions: [
        { no: '01', title: 'Welcome to the Hill', date: 'June', status: 'Summer 2027' }, { no: '02', title: 'A morning in the lab', date: 'June', status: 'Summer 2027' }, { no: '03', title: 'A college class, for real', date: 'June', status: 'Summer 2027' },
        { no: '04', title: 'AI in an hour', date: 'July', status: 'Summer 2027' }, { no: '05', title: 'Paying for college, plainly', date: 'July', status: 'Summer 2027' }, { no: '06', title: 'Family day and the certificate', date: 'July', status: 'Summer 2027' } ],
        cert: { title: 'Certificate of completion, issued by HT', text: 'Next on the roadmap: presented on family day', status: 'Next', cls: 'soft' } } ] },
    { type: 'split', kicker: 'One room for everyone', title: 'The community joins the same live room.',
      text: 'A neighbor who cannot make it to the auditorium opens the same link the campus uses and watches from home, with the chat beside the picture. The replay lands the same night.',
      bullets: ['No account needed to watch a public session', 'The code at the door counts the room; the link counts the rest', 'Every partner gets its own channel for the follow-up'],
      image: '/ht/img/fall-convocation.jpg', imageAlt: 'Fall convocation at Huston-Tillotson', side: 'right', cta: { label: 'The live room', href: '/ht/hub/live/', style: 'ht' } },
    { type: 'faq', title: 'What neighbors ask', items: [
      { q: 'Do I need to be a student?', a: 'No. Public sessions are open to anyone. Come to the door, or watch live in the room.' },
      { q: 'Is it free?', a: 'Yes. The public series and the partner programs are free to the community.' },
      { q: 'Can my church or school become a partner?', a: 'Yes. Message the outreach desk here. A partner program is a calendar, a channel, and a student host.' } ] },
    { type: 'cta', title: 'Bring the neighborhood up the Hill.', text: 'The first evening of the public series is in October, in the auditorium and live in the room.', primary: { label: 'The live room', href: '/ht/hub/live/', style: 'ht-gold' }, secondary: { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-line' } },
    { type: 'calendar', side: true, title: 'The outreach calendar', meta: 'Sample', items: [
      { date: '2026-10-06', title: 'AI for small business owners · evening one', where: 'The auditorium and live · 6:30 PM', tag: 'Live', tagCls: 'live' }, { date: '2026-10-24', title: 'Service Saturday with the service society', where: 'East Austin · 9:00 AM' },
      { date: '2026-11-05', title: 'Financial wellness for families · evening one', where: 'The auditorium and live · 6:30 PM' }, { date: '2027-02-11', title: 'A history of the Hill', where: 'The auditorium and live · 6:30 PM' },
      { date: '2027-06-08', title: 'Summer Bridge begins', where: 'Campus · 9:00 AM' } ] },
    { type: 'announcements', side: true, title: 'Outreach desk', meta: 'Sample', items: [
      { who: 'Community outreach', when: 'Today', text: 'AI for small business owners begins October 6. Free, and open to the neighborhood.' },
      { who: 'Community outreach', when: 'Yesterday', text: 'Summer Bridge 2027 applications open in January through partner high schools.' },
      { who: 'Service society', when: 'Monday', text: 'Service Saturday is October 24. Hours are logged in the hub.' } ] },
    { type: 'checkin', side: true, title: 'Check in at the door', meta: 'Code on the screen', session: 'AI for small business owners · evening one', sub: 'Tuesday, Oct 6 · 6:30 PM · the auditorium', code: 'EAST26', hint: 'Sample code for this preview: EAST26.' }
  ]
};

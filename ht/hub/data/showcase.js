/* The HT Hub, Showcase (student work and research). SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.showcase = {
  key: 'showcase', title: 'Showcase', office: 'Student work & research', icon: 'star',
  blurb: 'Student projects and the undergraduate research showcase, with judges, for the people behind each gift to see.',
  sub: 'See their name, see their face. The work students made, with their permission, for the campus and for the people who funded the seats.',
  stamp: 'Preview · sample projects', headCta: { label: 'The research showcase', href: '#research', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Student work & research', title: 'See their name. See their work.',
      text: 'Every track ends here. Projects from the co-curricular tracks, posters from the undergraduate research showcase, and the judges\' scores, in one place. Students appear with their permission, first names only. When a donor funded the cohort, the work lands on their page too.',
      ctas: [{ label: 'The projects', href: '#projects', style: 'ht' }, { label: 'Judges\' scoring', href: '#judging', style: 'ht-line' }],
      image: '/ht/img/student-laptop.jpg', imageAlt: 'A student working on a laptop',
      ada: { text: 'Six projects are up from AI Literacy. Two are from the Johnson cohort. The research showcase call for entries closes February 12.', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'cards', id: 'projects', title: 'Projects from the tracks', meta: 'With permission · first names only', items: [
      { meta: 'AI Literacy · Daniel O., Business', title: 'A booking assistant for a barbershop', text: 'A small automation that answers the shop\'s messages and books the chair. Built in Session 06.', img: '/ht/img/r-retail-street.jpg', alt: 'Rendering of a campus street', badge: 'With permission · sample' },
      { meta: 'AI Literacy · Maribel A., Biology', title: 'A study guide that writes itself', text: 'Lecture notes in, a weekly quiz out. She shares it with her lab section.', img: '/ht/img/students-library.jpg', alt: 'Students in the library', badge: 'With permission · sample' },
      { meta: 'AI Literacy · Jalen W., Communication', title: 'A week of content for the choir', text: 'The gospel choir\'s channel, planned a month ahead in the choir\'s own voice.', img: '/ht/img/fall-convocation.jpg', alt: 'Fall convocation', badge: 'With permission · sample' },
      { meta: 'Financial Literacy · Jasmine C., Biology', title: 'The first-paycheck plan', text: 'A one-page budget she will actually use, built in Session 04 and shared with her cohort.', img: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson campus', badge: 'With permission · sample' },
      { meta: 'Entrepreneurship · Marcus T., Business', title: 'A tutoring service for East Austin', text: 'Ten interviews, a one-page model, and a price. Pitch night is March 1.', img: '/ht/img/r-village-plaza.jpg', alt: 'Rendering of the campus village plaza', badge: 'With permission · sample' },
      { meta: 'AI Literacy · Aaliyah R., Kinesiology', title: 'A portfolio page in an evening', text: 'Her internship page, written once and kept current from her phone.', img: '/ht/img/r-student-center.jpg', alt: 'Rendering of the student center', badge: 'With permission · sample' } ] },
    { type: 'cards', id: 'research', title: 'Undergraduate research showcase, Spring 2027', meta: 'Posters · faculty mentors · sample', items: [
      { meta: 'Poster 01 · Biology', title: 'Water quality along the creek', text: 'Kiana M. and Devon C. · mentored by a biology faculty member', img: '/ht/img/r-land-aerial.jpg', alt: 'Aerial rendering of the campus', badge: 'Sample' },
      { meta: 'Poster 02 · Sociology', title: 'Who stays in East Austin', text: 'Priscilla O. · mentored by a sociology faculty member', img: '/ht/img/r-admin-dusk.jpg', alt: 'Rendering of a campus building at dusk', badge: 'Sample' },
      { meta: 'Poster 03 · Computer Science', title: 'A campus map that reads out loud', text: 'Tre J. and Simone A. · mentored by a computer science faculty member', img: '/ht/img/r-academic.jpg', alt: 'Rendering of an academic building', badge: 'Sample' } ] },
    { type: 'table', id: 'judging', title: 'Judges\' scoring', meta: 'Sample · out of 10 each', cols: ['Project', 'Clarity', 'Impact', 'Craft', 'Total'], rows: [
      ['A booking assistant for a barbershop', '9', '8', '9', '26'], ['A study guide that writes itself', '8', '9', '8', '25'], ['A week of content for the choir', '9', '7', '8', '24'], ['A tutoring service for East Austin', '8', '9', '7', '24'], ['A portfolio page in an evening', '7', '7', '9', '23'] ] },
    { type: 'people', title: 'The judges', meta: 'Sample roles', dm: false, items: [
      { name: 'Faculty judge (sample)', role: 'Academic Affairs', org: 'Scores clarity and craft' }, { name: 'Alumni judge (sample)', role: 'Class of 2009', org: 'Scores impact' }, { name: 'Community partner judge (sample)', role: 'East Austin', org: 'Scores impact and reach' } ] },
    { type: 'steps', title: 'From project to the donor\'s page', meta: 'Three steps', items: [
      { em: 'Step one', h: 'The student says yes', p: 'Permission first, in writing, through the University\'s own process. First names only, always.' },
      { em: 'Step two', h: 'The work goes on the Showcase', p: 'A title, a line, a photo of the work, never a grade. Judges score it here when there is a showcase.' },
      { em: 'Step three', h: 'It lands on the donor\'s page', p: 'When a gift funded the cohort, the same card appears on the donor\'s page, the day it is posted here.' } ] },
    { type: 'cta', title: 'The students a gift reached.', text: 'This is the page a donor opens after the thank-you. Fund a cohort and it fills in.', primary: { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-gold' }, secondary: { label: 'The Advancement space', href: '/ht/hub/advancement/', style: 'ht-line' } },
    { type: 'timeline', side: true, title: 'The showcase season', meta: 'Sample dates', items: [
      { when: 'Nov 2', title: 'AI Literacy showcase rehearsal', text: 'Session 08, in the live room.', done: false }, { when: 'Dec 4', title: 'Fall showcase', text: 'The auditorium. Donors invited.', done: false },
      { when: 'Jan 19', title: 'Research call for entries', text: 'Faculty mentors nominate.', done: false }, { when: 'Feb 12', title: 'Entries close', text: 'Posters submitted in the hub.', done: false },
      { when: 'Mar 12', title: 'Submission freeze', text: 'Judges receive the packet.', done: false }, { when: 'Mar 19', title: 'Research showcase', text: 'Judging live, scores posted here.', done: false } ] },
    { type: 'announcements', side: true, title: 'Showcase desk', meta: 'Sample', items: [
      { who: 'Academic Affairs', when: 'Today', text: 'The research showcase is March 19. Mentors can nominate from January 19.' },
      { who: 'AI Literacy', when: 'Yesterday', text: 'Two more projects posted from Session 06. Both students said yes.' },
      { who: 'Advancement', when: 'Monday', text: 'The Johnson cohort\'s projects now appear on the Johnson page.' } ] },
    { type: 'notice', side: true, tone: 'maroon', html: '<b>Permission first.</b> Nothing appears here without the student\'s written permission through the University\'s own process. First names only. Never a grade.' }
  ]
};

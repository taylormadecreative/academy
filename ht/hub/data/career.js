/* The HT Hub, Career (Career Services). SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.career = {
  key: 'career', title: 'Career', office: 'Career Services', icon: 'briefcase',
  blurb: 'A portfolio directory employers can search, the employer showcase, and mock interviews with replays.',
  sub: 'The work, not just the resume. A directory employers can search, seminars that replay, and the desk that reads your resume by appointment.',
  stamp: 'Preview · sample directory', headCta: { label: 'The directory', href: '#directory', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Career Services', title: 'Employers see the work, not just the resume.',
      text: 'Every student has a page with their projects on it. Employers search the directory by program and skill, the employer showcase brings them to campus, and the mock interview seminars replay the same afternoon. The desk reads resumes by appointment and answers the same day.',
      ctas: [{ label: 'Search the directory', href: '#directory', style: 'ht' }, { label: 'Employer showcase', href: '#employers', style: 'ht-line' }],
      image: '/ht/img/r-student-center.jpg', imageAlt: 'Rendering of the student center',
      ada: { text: 'Three sample internship postings are up from employers who came to last spring\'s showcase. Your portfolio page opens in AI Literacy Session 07 on October 26. Want the mock interview slot on the 14th?', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'directory', id: 'directory', title: 'Student portfolio directory', meta: 'Sample · first names only', search: true, items: [
      { name: 'Daniel O.', program: 'Business Administration', year: 'Class of 2029', skills: ['Automation', 'Customer service', 'Bookkeeping'], tag: 'Open to internships', tagCls: 'green' },
      { name: 'Maribel A.', program: 'Biology', year: 'Class of 2029', skills: ['Lab methods', 'Data entry', 'Tutoring'], tag: 'Open to internships', tagCls: 'green' },
      { name: 'Jalen W.', program: 'Communication', year: 'Class of 2029', skills: ['Video', 'Social content', 'Writing'] },
      { name: 'Jasmine C.', program: 'Biology, pre-nursing', year: 'Class of 2027', skills: ['Patient care', 'Scheduling', 'Spanish'], tag: 'Open to internships', tagCls: 'green' },
      { name: 'Marcus T.', program: 'Business Administration', year: 'Class of 2027', skills: ['Sales', 'Spreadsheets', 'Pitching'], tag: 'Graduating May', tagCls: 'soft' },
      { name: 'Aaliyah R.', program: 'Kinesiology', year: 'Class of 2028', skills: ['Coaching', 'Event setup', 'First aid'] },
      { name: 'Tre J.', program: 'Computer Science', year: 'Class of 2030', skills: ['Web pages', 'Python', 'Accessibility'], tag: 'Open to internships', tagCls: 'green' },
      { name: 'Simone A.', program: 'Computer Science', year: 'Class of 2029', skills: ['Data', 'Maps', 'Presenting'] },
      { name: 'Kiana M.', program: 'Biology', year: 'Class of 2028', skills: ['Field sampling', 'Reports', 'Photography'], tag: 'Open to internships', tagCls: 'green' },
      { name: 'Devon C.', program: 'Education', year: 'Class of 2027', skills: ['Tutoring', 'Lesson planning', 'Public speaking'], tag: 'Open to internships', tagCls: 'green' } ] },
    { type: 'cards', id: 'employers', title: 'Employer showcase', meta: 'Sample employers · never a real name here', items: [
      { meta: 'Technology · Austin', title: 'An Austin technology employer (sample)', text: 'Two summer internships in support and one in design. They read the directory first.', img: '/ht/img/r-academic.jpg', alt: 'Rendering of an academic building', badge: 'Sample', foot: 'Posting in the hub' },
      { meta: 'Health · Central Texas', title: 'A regional health system (sample)', text: 'Patient-care assistant roles for nursing and kinesiology students, with a spring session on campus.', img: '/ht/img/students-library.jpg', alt: 'Students in the library', badge: 'Sample', foot: 'Posting in the hub' },
      { meta: 'Public sector · Austin', title: 'A city department (sample)', text: 'Paid fellowships in community programs. They ask for the Showcase link, not a resume.', img: '/ht/img/r-admin-dusk.jpg', alt: 'Rendering of a campus building at dusk', badge: 'Sample', foot: 'Posting in the hub' },
      { meta: 'Founders · alumni', title: 'Alumni-owned businesses (sample)', text: 'Part-time roles at businesses alumni run, posted in the Alumni channel first.', img: '/ht/img/r-retail-street.jpg', alt: 'Rendering of a campus street', badge: 'Sample', foot: 'Posting in the hub' } ] },
    { type: 'replays', title: 'Career seminar replays', meta: 'Sample recordings · captioned', items: [
      { title: 'The first interview, rehearsed', date: 'Sep 2026', len: '36:20', poster: '/ht/img/fall-convocation.jpg', tag: 'Career Services' },
      { title: 'Your resume, read out loud', date: 'Aug 2026', len: '28:45', poster: '/ht/img/students-library.jpg', tag: 'Career Services' },
      { title: 'Negotiating the first offer', date: 'Apr 2026', len: '41:10', poster: '/ht/img/campus-hero.jpg', tag: 'Alumni panel' },
      { title: 'Building a business in Austin', date: 'Oct 2026', len: '58:47', poster: '/ht/img/r-retail-street.jpg', tag: 'Guest lecture' } ] },
    { type: 'split', kicker: 'Why a directory', title: 'The work, searchable.',
      text: 'An employer types "Python" or "patient care" and finds a student with a project to show, not a line on a resume. Students choose what appears and can close the tag with one tap.',
      bullets: ['Search by program, skill, or class year', 'Every entry links to the student\'s Showcase work', '"Open to internships" is the student\'s own switch'],
      image: '/ht/img/student-laptop.jpg', imageAlt: 'A student working on a laptop', side: 'right', cta: { label: 'See the Showcase', href: '/ht/hub/showcase/', style: 'ht' } },
    { type: 'faq', title: 'What students ask', items: [
      { q: 'Who can see my page?', a: 'Employers Career Services has approved, faculty, and you. Turn the internship tag on or off any time.' },
      { q: 'Does the desk read resumes?', a: 'Yes, by appointment, with a same-day answer. Book it from the calendar.' },
      { q: 'What if I have no projects yet?', a: 'Take a track. AI Literacy ends with a portfolio page in Session 07.' } ] },
    { type: 'cta', title: 'Bring the employers to the Hill.', text: 'The employer showcase runs each semester in the live room and on campus.', primary: { label: 'The Showcase', href: '/ht/hub/showcase/', style: 'ht-gold' }, secondary: { label: 'The tracks', href: '/ht/hub/learn/', style: 'ht-line' } },
    { type: 'calendar', side: true, title: 'Mock interviews and workshops', meta: 'Sample', items: [
      { date: '2026-09-14', title: 'Mock interviews, round one', where: 'Career Services · by appointment' }, { date: '2026-09-30', title: 'Resume clinic', where: 'The library · walk in' },
      { date: '2026-10-22', title: 'Building a business in Austin', where: 'Live room · 6:00 PM', tag: 'Live', tagCls: 'live' }, { date: '2026-11-05', title: 'Employer showcase, fall', where: 'The student center' },
      { date: '2027-02-04', title: 'Mock interviews, round two', where: 'Career Services · by appointment' } ] },
    { type: 'materials', side: true, title: 'Materials', meta: 'Sample', items: [
      { kind: 'DOC', title: 'The HT resume template', sub: 'One page, in the University\'s type', restricted: true }, { kind: 'DOC', title: 'Interview guide', sub: 'Twelve questions and how to answer them', restricted: true },
      { kind: 'PLAY', title: 'Your portfolio page', sub: 'AI Literacy · Session 07', href: '/ht/hub/learn/' } ] },
    { type: 'announcements', side: true, title: 'Career desk', meta: 'Sample', items: [
      { who: 'Career Services', when: 'Today', text: 'Three internship postings from last spring\'s showcase employers are open in the hub.' },
      { who: 'Career Services', when: 'Yesterday', text: 'Mock interview slots for the 14th are open. Book from the calendar.' },
      { who: 'Alumni Relations', when: 'Monday', text: 'Alumni-owned businesses posted two part-time roles in the Alumni channel.' } ] }
  ]
};

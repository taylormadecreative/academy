/* The HT Hub, Admissions (admissions and enrollment). SAMPLE content. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.admissions = {
  key: 'admissions', title: 'Admissions', office: 'Admissions & enrollment', icon: 'door',
  blurb: 'An admitted-student community before move-in, yield events live, and a space for parents.',
  sub: 'From the acceptance letter to move-in weekend: a community for admitted students, yield events live in the hub, and a space parents can open too.',
  stamp: 'Preview · sample content', headCta: { label: 'Admitted 2031', href: '#admitted', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Admissions & enrollment', title: 'Admitted on a Tuesday. On the Hill by Wednesday night.',
      text: 'The day a student is admitted, they join a community of the people they will walk in with. Housing questions get answered by a person. Admitted Student Night streams live. Parents get their own channel. By move-in, the campus is already familiar.',
      ctas: [{ label: 'The admitted community', href: '#admitted', style: 'ht' }, { label: 'Yield events', href: '#yield', style: 'ht-line' }],
      image: '/ht/img/r-student-center.jpg', imageAlt: 'Rendering of the student center',
      ada: { text: 'Congratulations, and welcome. Two hundred and twelve of your classmates are already in the Admitted 2031 channel. Admitted Student Night is live in March. Want me to save the date?', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'feed', id: 'admitted', title: 'Admitted students, Class of 2031', meta: 'Sample posts · a person answers', channels: ['Admitted 2031', 'Housing', 'Financial aid Q&A', 'Parents'], posts: [
      { who: 'Admissions', chan: 'Admitted 2031', when: 'Today', text: 'Admitted Student Night is March 4 at 6, live in the hub. Current students take your questions after the President. Add it to your calendar below.', likes: 64 },
      { who: 'Nia B.', chan: 'Admitted 2031', when: 'Today', text: 'Just got my letter. From Houston, thinking biology. Who else is coming from Houston?', likes: 38 },
      { who: 'Andre K.', chan: 'Admitted 2031', when: 'Yesterday', text: 'Dallas here, business. Is the gospel choir open to first-years? Asking for me.', likes: 27 },
      { who: 'Residence life desk (sample)', chan: 'Housing', when: 'Yesterday', text: 'Housing forms open April 1. You pick a hall and a roommate preference in the hub. We answer here the same day.', likes: 41 },
      { who: 'Financial aid desk (sample)', chan: 'Financial aid Q&A', when: 'Monday', text: 'Award letters go out the last week of March. If yours has a line you do not understand, post it here and we will read it with you.', likes: 52 },
      { who: 'Ms. Robinson (parent, sample)', chan: 'Parents', when: 'Monday', text: 'Is there a session for parents who have never done this before? First one in our family.', likes: 33 },
      { who: 'Admissions', chan: 'Parents', when: 'Monday', text: 'Yes. First-generation family night is March 18, live in the hub and in the auditorium. Bring every question.', likes: 45 },
      { who: 'Tasha L.', chan: 'Admitted 2031', when: 'Sunday', text: 'Toured the campus today. The bell tower is real and the library is quiet. See you all in August.', likes: 71 } ] },
    { type: 'calendar', id: 'yield', title: 'Yield events, live in the hub', meta: 'Sample', items: [
      { date: '2027-03-04', title: 'Admitted Student Night', where: 'Live room · 6:00 PM', tag: 'Live', tagCls: 'live' }, { date: '2027-03-11', title: 'Financial aid night', where: 'Live room · 6:30 PM' },
      { date: '2027-03-18', title: 'First-generation family night', where: 'The auditorium and live · 6:00 PM' }, { date: '2027-03-25', title: 'Housing tour, live from the halls', where: 'Live room · 5:30 PM' },
      { date: '2027-04-08', title: 'Parent session', where: 'Live room · 6:30 PM' }, { date: '2027-05-01', title: 'Decision Day', where: 'The Admitted 2031 channel' } ] },
    { type: 'player', cardTitle: 'Admitted Student Night', meta: 'Live in March · replay the same night', title: 'Admitted Student Night', live: false, poster: '/ht/img/r-student-center.jpg',
      now: { title: 'Admitted Student Night, live', who: 'Admissions team with current students', when: 'March 2027' } },
    { type: 'steps', title: 'From admitted to move-in', meta: 'Four steps, one place', items: [
      { em: 'Step one', h: 'Admitted', p: 'The letter arrives with one link. The student joins the Admitted 2031 channel the same day.' },
      { em: 'Step two', h: 'Questions answered', p: 'Housing, aid, and the choir, answered by a person in the channel, not a form.' },
      { em: 'Step three', h: 'Yield events, live', p: 'Admitted Student Night, family night, and the housing tour, all live in the hub with the replay for anyone who missed it.' },
      { em: 'Step four', h: 'Move-in weekend', p: 'The weekend schedule, the check-in code at the hall, and the first week, in their pocket before they arrive.' } ] },
    { type: 'split', kicker: 'Move-in weekend', title: 'The move-in weekend, in their pocket.',
      text: 'The schedule, the hall check-in, the family sessions, and the first campus walk, on the same phone that opened the acceptance letter. Parents see the same schedule in their own space.',
      bullets: ['Hall check-in by code, no line at a table', 'Family sessions Saturday morning, live for anyone who could not travel', 'Orientation Week starts in the same place Monday'],
      image: '/ht/img/campus-hero.jpg', imageAlt: 'The Huston-Tillotson campus', side: 'right', cta: { label: 'See Orientation Week', href: '/ht/hub/students/#orientation', style: 'ht' } },
    { type: 'faq', title: 'What families ask', items: [
      { q: 'Do parents get their own space?', a: 'Yes. The Parents channel opens the day of admission, and the parent session is live in April.' },
      { q: 'Is this on my phone?', a: 'Yes. It installs from Safari with the HT icon and opens like an app.' },
      { q: 'What about a student without a laptop?', a: 'Everything here works on a phone. The library has laptops for the sessions that need one.' },
      { q: 'When does the admitted community close?', a: 'It does not. On move-in day it becomes the Class of 2031 channel, with the same people in it.' } ] },
    { type: 'cta', title: 'The class that already knows each other.', text: 'By move-in, the Class of 2031 has been talking for five months.', primary: { label: 'See Orientation Week', href: '/ht/hub/students/', style: 'ht-gold' }, secondary: { label: 'The live room', href: '/ht/hub/live/', style: 'ht-line' } },
    { type: 'announcements', side: true, title: 'Admissions desk', meta: 'Sample', items: [
      { who: 'Admissions', when: 'Today', text: 'Admitted Student Night is March 4 at 6, live in the hub.' },
      { who: 'Residence life', when: 'Yesterday', text: 'Housing forms open April 1 in the hub.' },
      { who: 'Financial aid', when: 'Monday', text: 'Award letters go out the last week of March. Questions in the Financial aid Q&A channel.' } ] },
    { type: 'people', side: true, title: 'Your admissions counselors (sample)', meta: 'A message reaches a person', dm: true, items: [
      { name: 'Counselor, Houston and Gulf Coast (sample)', role: 'Admissions', org: 'Replies same day' }, { name: 'Counselor, Dallas-Fort Worth (sample)', role: 'Admissions', org: 'Replies same day' },
      { name: 'Counselor, Austin and Central Texas (sample)', role: 'Admissions', org: 'Replies same day' }, { name: 'Transfer counselor (sample)', role: 'Admissions', org: 'Credits and the transfer path' } ] },
    { type: 'notice', side: true, tone: 'maroon', html: '<b>Privacy.</b> Admitted students see first names and the channel. Families see their own space. Nothing here is public.' }
  ]
};

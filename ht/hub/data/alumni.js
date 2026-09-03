/* The HT Hub — Alumni space. SAMPLE content. Loaded after /ht/hub/data.js. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.alumni = {
  key: 'alumni', title: 'Alumni', office: 'Alumni Relations', icon: 'globe',
  blurb: 'Chapter channels, Homecoming 2027, mentors taking mentees, and learning that keeps going.',
  sub: 'Your chapter, your class year, and the students coming up behind you, in one place that already knows your name.',
  stamp: 'Preview · sample alumni', headCta: { label: 'Find a mentor', href: '#mentors', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Alumni Relations', title: 'The Hill, wherever you landed.',
      text: 'A chapter hub for the city you live in now. Reunion and Homecoming 2027 with the agenda in your pocket. A mentor list where a sophomore can find you by program and skill. And a learning track that keeps your HT education going long after the cap and gown. One sign-in, the same one the campus uses.',
      ctas: [{ label: 'Open your chapter', href: '#chapters', style: 'ht' }, { label: 'Homecoming 2027', href: '#homecoming', style: 'ht-line' }],
      image: '/ht/img/commencement.jpg', imageAlt: 'Commencement on the Hill at Huston-Tillotson University',
      ada: { text: 'Welcome back. The Austin chapter meets on the 17th, two mentors in your field are taking mentees this fall, and Homecoming 2027 is on your calendar. Want me to open the chapter channel?', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'stats', items: [{ n: '4', label: 'Chapter channels open (sample)' }, { n: 'Feb 2027', label: 'Homecoming, dates announced by HT' }, { n: '5', label: 'Mentors taking mentees this fall (sample)' }, { n: '4', label: 'Sessions in the fall alumni track' }] },
    { type: 'cards', id: 'chapters', title: 'Chapters', meta: 'Member counts are sample', items: [
      { meta: 'Austin · 312 members', title: 'Austin chapter', text: 'The home chapter. Monthly meetups near campus, a volunteer bench for Orientation Week, and first word on Homecoming.', href: '#channels', badge: 'Sample', foot: 'Open the chapter channel →' },
      { meta: 'Dallas-Fort Worth · 148 members', title: 'Dallas-Fort Worth chapter', text: 'Quarterly dinners, a carpool thread for game weekend, and a growing list of alumni who are hiring in the Metroplex.', href: '#channels', badge: 'Sample', foot: 'Open the chapter channel →' },
      { meta: 'Houston · 121 members', title: 'Houston chapter', text: 'A welcome table for new graduates moving to the city, and a mentor circle that meets before work.', href: '#channels', badge: 'Sample', foot: 'Open the chapter channel →' },
      { meta: 'Everywhere else · 460 members', title: 'Alumni everywhere', text: 'No chapter in your city yet? This is your channel. When five of you land in one place, Alumni Relations helps you start one.', href: '#channels', badge: 'Sample', foot: 'Open the chapter channel →' } ] },
    { type: 'cards', id: 'homecoming', title: 'Homecoming 2027', meta: 'February 2027 · dates announced by HT', items: [
      { meta: 'Reunion classes', title: 'The classes of 1977, 1997, 2002, 2017, and 2022', text: 'Milestone years get their own channel, their own table at brunch, and a class photo on the steps. Class agents post the plan here first.', href: '#channels', img: '/ht/img/fall-convocation.jpg', alt: 'Fall convocation at Huston-Tillotson', badge: 'Sample', foot: 'Join your class channel →' },
      { meta: 'Saturday morning', title: 'The alumni brunch', text: 'The President speaks, the reunion classes stand, and the Alumni Relations desk is right there to update your address. Add it to your calendar from the Events space.', href: '/ht/hub/events/', img: '/ht/img/campus-hero.jpg', alt: 'The Huston-Tillotson campus', badge: 'Sample', foot: 'Open the weekend agenda →' },
      { meta: 'Saturday night into Sunday', title: 'The step show and game weekend', text: 'The step show on Saturday night, then game weekend on campus. Check in at the door so your chapter gets credit for showing up.', href: '/ht/hub/events/', img: '/ht/img/r-village-plaza.jpg', alt: 'Rendering of the campus village plaza', badge: 'Sample', foot: 'Open the weekend agenda →' } ] },
    { type: 'directory', id: 'mentors', title: 'Mentors', meta: 'Sample alumni · first name and last initial only', search: true, items: [
      { name: "Renee W. '09", program: 'Business Administration', year: 'Class of 2009', skills: ['Small business', 'Bookkeeping', 'Hiring'], tag: 'Taking mentees', tagCls: 'green' },
      { name: "Marcus T. '14", program: 'Computer Science', year: 'Class of 2014', skills: ['Software', 'Interviews', 'Portfolio review'], tag: 'Taking mentees', tagCls: 'green' },
      { name: "Danielle R. '11", program: 'Education', year: 'Class of 2011', skills: ['Teaching', 'Certification', 'Classroom management'], tag: 'Full for fall', tagCls: 'soft' },
      { name: "Andre B. '17", program: 'Kinesiology', year: 'Class of 2017', skills: ['Physical therapy', 'Graduate school', 'Applications'], tag: 'Taking mentees', tagCls: 'green' },
      { name: "Keisha L. '05", program: 'Sociology', year: 'Class of 2005', skills: ['Nonprofits', 'Grant writing', 'Public speaking'], tag: 'Taking mentees', tagCls: 'green' },
      { name: "Jonathan H. '19", program: 'Communication', year: 'Class of 2019', skills: ['Video', 'Social media', 'Freelancing'], tag: 'By request', tagCls: 'soft' },
      { name: "Priscilla O. '98", program: 'Biology', year: 'Class of 1998', skills: ['Nursing', 'Healthcare careers', 'Night shifts and school'] },
      { name: "Terrence G. '12", program: 'Political Science', year: 'Class of 2012', skills: ['Law school', 'Public policy', 'City government'], tag: 'Taking mentees', tagCls: 'green' } ] },
    { type: 'feed', id: 'channels', title: 'Alumni channels', meta: 'Sample posts · pick a channel', channels: ['All alumni', 'Austin chapter', 'Class of 2017', 'Mentors'], posts: [
      { who: 'Alumni Relations', chan: 'All alumni', when: 'Today', text: 'Homecoming 2027 is in February. HT announces the exact dates, and the minute they do, the agenda lands here and in the Events space. Save the month.', likes: 58 },
      { who: "Keisha L. '05", chan: 'All alumni', when: 'Yesterday', text: 'Just finished the first session of the alumni track. Forty minutes, no fluff, and I left with something I can use at work on Monday. Sign up, the second one is in two weeks.', likes: 34 },
      { who: "Priscilla O. '98", chan: 'All alumni', when: 'Monday', text: 'To whoever left the note in my old dorm mailbox at the last reunion: I found it. Thank you. I am still laughing.', likes: 91 },
      { who: "Renee W. '09", chan: 'Austin chapter', when: 'Tuesday', text: 'Meetup on the 17th, 6:30, the coffee shop across from campus. Students welcome. Come ask what the first job after HT actually looks like.', likes: 27 },
      { who: "Andre B. '17", chan: 'Class of 2017', when: 'Sunday', text: 'Ten years. Who is in for a class table at the brunch? Drop a reply and I will start the list. Planning call is December 10 in this channel.', likes: 22 },
      { who: "Marcus T. '14", chan: 'Mentors', when: 'Last week', text: 'Took my first mentee through a mock interview this week. She got the callback. If you have been on the fence about the mentor list, this is your sign.', likes: 46 } ] },
    { type: 'tracks', id: 'learning', title: 'Lifelong learning', meta: 'Open to all alumni · sample track', items: [
      { title: 'AI for alumni professionals', text: 'Four evening sessions, live in the hub with the replay the same night. Built for the alum with a job, not the one with a computer science degree. Bring one task from your work and leave with it done faster.', tag: 'Fall 2026', tagCls: 'soft',
        sessions: [
          { no: '01', title: 'What changed, and what it means for your work', date: 'Sep 1', done: true },
          { no: '02', title: 'Writing, email, and the report you dread', date: 'Sep 22 · 6:30 PM CT', status: 'Next' },
          { no: '03', title: 'Spreadsheets, research, and the numbers you present', date: 'Oct 13 · 6:30 PM CT', status: 'Upcoming' },
          { no: '04', title: 'Your own small automation, built in the room', date: 'Nov 3 · 6:30 PM CT', status: 'Upcoming' } ],
        cert: { title: 'Certificate of completion', text: 'Issued by Alumni Relations with Taylormade Academy after all four sessions and one finished task from your own work.', status: 'Sample', cls: 'sample' } } ] },
    { type: 'calendar', side: true, title: 'The alumni calendar', meta: 'Sample', items: [
      { date: '2026-09-17', title: 'Austin chapter meetup', where: 'Near campus · 6:30 PM' },
      { date: '2026-09-22', title: 'AI for alumni professionals · Session 02', where: 'Live in the hub · 6:30 PM CT', tag: 'Live', tagCls: 'live' },
      { date: '2026-10-15', title: 'Mentor matching opens for spring', where: 'Mentors · Alumni Relations' },
      { date: '2026-11-17', title: 'Alumni giving update goes out from each page', where: 'Alumni Relations with Advancement' },
      { date: '2026-12-10', title: 'Class of 2017 reunion planning call', where: 'Class of 2017 channel' },
      { date: '2027-02-12', title: 'Homecoming 2027', where: 'Campus · final dates announced by HT', tag: 'Save the month', tagCls: 'soft' } ] },
    { type: 'announcements', side: true, title: 'From Alumni Relations', meta: 'Sample', items: [
      { who: 'Alumni Relations', when: 'Today', text: 'Reunion class channels for 1977, 1997, 2002, 2017, and 2022 are open. Class agents have the keys.' },
      { who: 'Mentorship', when: 'Yesterday', text: 'Five mentors are taking mentees this fall. Students find you by program and skill, and you say yes or not yet.' },
      { who: 'Records', when: 'Monday', text: 'Moved? Update your address from your own page. It takes a minute, and the Homecoming mailer uses it.' } ] },
    { type: 'people', side: true, title: 'Alumni Relations desk', meta: 'Sample roles', dm: false, items: [
      { name: 'Director of Alumni Relations (sample)', role: 'Space owner', org: 'Chapters, reunion, Homecoming', gold: true, tag: 'Owner', tagCls: 'green' },
      { name: 'Chapter coordinator (sample)', role: 'Austin, Dallas-Fort Worth, Houston', org: 'Helps a new chapter start' },
      { name: 'Reunion and Homecoming lead (sample)', role: 'Homecoming 2027', org: 'Runs the weekend agenda with Events' },
      { name: 'Mentorship coordinator (sample)', role: 'The mentor list', org: 'Matches students and alumni' } ] },
    { type: 'cta', title: 'Your class. Your chapter. Your gift.', text: 'The same page that knows your class year is the one that shows what a gift builds on the Hill, by name.', primary: { label: 'See what a gift builds', href: '/ht/hub/advancement/', style: 'ht-gold' }, secondary: { label: 'Find a mentor', href: '#mentors', style: 'ht-line' } }
  ]
};

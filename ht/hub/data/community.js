/* The HT Hub — Community space. SAMPLE content. Loaded after /ht/hub/data.js. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.community = {
  key: 'community', title: 'Community', office: 'The campus community', icon: 'chat',
  blurb: 'Channels by class and office, direct messages, and a leaderboard for the ones who show up.',
  sub: 'The Hill, in conversation. Channels by class, office, and org. Messages that reach a real person. A leaderboard for the ones who keep showing up.',
  stamp: 'Preview · sample community', headCta: { label: 'Open The Hill', href: '#the-hill', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'The campus community', title: 'Every conversation on the Hill, in one place.',
      text: 'Channels for your class year, your org, and the offices you actually need. A feed where the library posts its hours and a sophomore posts a study group. Direct messages that reach a person, not a form. And a leaderboard, because the people who show up for each other should be seen doing it.',
      ctas: [{ label: 'Open The Hill', href: '#the-hill', style: 'ht' }, { label: 'Message someone', href: '#messages', style: 'ht-line' }],
      image: '/ht/img/students-library.jpg', imageAlt: 'Huston-Tillotson students studying together in the library',
      ada: { text: 'Hey. The Class of 2030 channel is the busiest one this week. The library is open late through Thursday, choir rehearsal moved to 6, and Career Services posted a campus job. Want me to open the Campus channel?', when: 'Ada · HT student ambassador · sample line' } },
    { type: 'stats', items: [{ n: '6', label: 'Channels open on The Hill (sample)' }, { n: '3', label: 'Study groups posted this week (sample)' }, { n: '1', label: 'Campus job posted by Career Services (sample)' }, { n: 'Same day', label: 'Replies from an office desk (sample)' }] },
    { type: 'feed', id: 'the-hill', title: 'The Hill', meta: 'Sample posts · pick a channel', channels: ['Campus', 'Class of 2027', 'Class of 2030', 'Faculty lounge', 'Student orgs', 'Alumni'], posts: [
      { who: 'Malik T.', chan: 'Campus', when: 'Today', text: 'Library is open until midnight through Thursday for midterm week. Second floor is the quiet floor. Bring a sweater, they fixed the air.', likes: 41 },
      { who: 'Bri N.', chan: 'Campus', when: 'Today', text: 'Choir rehearsal moved to 6:00 tonight in the chapel. New voices welcome. You do not have to read music, you just have to show up and sing.', likes: 33 },
      { who: 'Career Services', chan: 'Campus', when: 'Yesterday', text: 'Campus job: two student assistants for the welcome desk, ten hours a week, starts in October. Apply from the Career space by Friday.', likes: 27 },
      { who: 'Aaliyah M.', chan: 'Campus', when: 'Monday', text: "Shout-out to the facilities crew who had the plaza cleared before 7 this morning after the storm. Y'all are the real ones.", likes: 88 },
      { who: 'Jordan P.', chan: 'Class of 2027', when: 'Tuesday', text: 'Senior seminar study group, Tuesdays at 4 in the library, room 204. We are on chapter six. Bring questions. We have snacks.', likes: 19 },
      { who: 'Tre J.', chan: 'Class of 2030', when: 'Today', text: 'First-year question: is there a way from the residence hall to the science building that does not cut through the plaza? Asking for my 8 AM self.', likes: 24 },
      { who: 'Simone A.', chan: 'Class of 2030', when: 'Yesterday', text: 'College Algebra study group, Thursdays at 7 in the library. Four of us so far. Room for more. We go slow and nobody feels behind.', likes: 31 },
      { who: 'Prof. L.', chan: 'Faculty lounge', when: 'Monday', text: 'Reminder that midterm grades are due in the portal by the 16th. The coffee in the lounge was fresh at 8:10. Come by, it will not last.', likes: 12 },
      { who: 'Devon C.', chan: 'Student orgs', when: 'Sunday', text: 'Student Government meets Wednesday at 5 in the student center. Open floor at the end for anything on your mind. That is what it is for.', likes: 16 },
      { who: "Renee W. '09", chan: 'Alumni', when: 'Last week', text: 'Austin chapter meetup on the 17th, 6:30, the coffee shop across from campus. Students welcome. Come ask what the first job after HT actually looks like.', likes: 29 } ] },
    { type: 'table', id: 'leaderboard', title: 'Leaderboard, this month (sample)', meta: 'Five points a post, four a reply', cols: ['Member', 'Posts', 'Replies', 'Points'], rows: [
      ['Aaliyah M.', '14', '31', '194'], ['Jordan P.', '11', '26', '159'], ['Devon C.', '9', '22', '133'], ['Simone A.', '8', '19', '116'], ['Malik T.', '7', '15', '95'], ['Tre J.', '6', '12', '78'] ] },
    { type: 'cards', id: 'offices', title: 'Channels by office', meta: 'Each opens its own space', items: [
      { meta: 'Student Affairs', title: 'Students', text: 'Orientation Week, housing, the student center, and the desk that answers.', href: '/ht/hub/students/', foot: 'Open the space →' },
      { meta: 'Events', title: 'Events', text: 'Every agenda on campus, add-to-calendar, and check-in at the door.', href: '/ht/hub/events/', foot: 'Open the space →' },
      { meta: 'The live room', title: 'Live', text: 'Town halls and seminars, live, with the replay the same afternoon.', href: '/ht/hub/live/', foot: 'Open the space →' },
      { meta: 'Learn', title: 'Learn', text: 'AI Literacy and the other tracks, with a certificate at the end.', href: '/ht/hub/learn/', foot: 'Open the space →' },
      { meta: 'Career Services', title: 'Career', text: 'Campus jobs, internships, and the portfolio that goes with you.', href: '/ht/hub/career/', foot: 'Open the space →' },
      { meta: 'Alumni Relations', title: 'Alumni', text: 'Chapter channels, mentors taking mentees, and Homecoming 2027.', href: '/ht/hub/alumni/', foot: 'Open the space →' } ] },
    { type: 'steps', id: 'new-channel', title: 'How a new channel gets made', meta: 'Three steps, usually the same week', items: [
      { em: '01', h: 'Ask in the Campus channel', p: 'Say what the channel is for and who it is for. A class year, an org, a study group, an office. Five people saying "me too" is plenty.' },
      { em: '02', h: 'Student Affairs says yes', p: 'They check the name, set who can post, and pick a student or staff lead. Most requests get an answer within a day.' },
      { em: '03', h: 'It shows up for everyone in it', p: 'The channel appears in the feed for its members, with a lead who can pin a post and welcome the first ten people by name.' } ] },
    { type: 'people', side: true, id: 'messages', title: 'Direct messages', meta: 'Sample · a message reaches a person', dm: true, items: [
      { name: 'Residence life desk (sample)', role: 'Student Affairs', org: 'Housing, keys, roommates', tag: 'Replies same day', tagCls: 'green' },
      { name: 'Career Services desk (sample)', role: 'Jobs and internships', org: 'Resume reads by appointment', tag: 'Replies same day', tagCls: 'green' },
      { name: 'Prof. L.', role: 'Faculty, Business', org: 'Office hours Tuesday and Thursday' },
      { name: 'Aaliyah M.', role: 'Peer mentor, Class of 2027', org: 'Student orgs' },
      { name: 'Tre J.', role: 'Class of 2030', org: 'Campus channel' },
      { name: "Renee W. '09", role: 'Alumni mentor', org: 'Austin chapter', tag: 'Taking mentees', tagCls: 'green' } ] },
    { type: 'announcements', side: true, title: 'From Student Affairs', meta: 'Sample', items: [
      { who: 'Student Affairs', when: 'Today', text: 'A reminder of the community guidelines: real names, kind words, no selling. Posts that break them come down, and you hear from us directly.' },
      { who: 'Student Affairs', when: 'Yesterday', text: 'Two new channels this week: Class of 2030 and Student orgs. Ask for yours in the Campus channel.' },
      { who: 'Orientation Week', when: 'Monday', text: 'First-years: your check-in code is on the screen at each session. One tap marks you present.' } ] },
    { type: 'notice', side: true, tone: 'gold', text: 'Posts are reviewed by Student Affairs. Report a post with one tap.' },
    { type: 'install', side: true },
    { type: 'cta', title: 'See you on the Hill.', text: 'Post in your channel, message a real person, and find the next thing happening on campus.', primary: { label: 'What is on this week', href: '/ht/hub/events/', style: 'ht-gold' }, secondary: { label: 'Open The Hill', href: '#the-hill', style: 'ht-line' } }
  ]
};

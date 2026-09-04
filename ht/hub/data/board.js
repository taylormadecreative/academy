/* The HT Hub — Board of Trustees space. Private portal, SAMPLE content. Loaded after /ht/hub/data.js. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.board = {
  key: 'board', title: 'Board', office: 'Board of Trustees', icon: 'shield',
  blurb: 'A private portal for trustees: the packet, the agenda, and check-in.',
  sub: 'The packet, the agenda, and the room, for the people who govern the Hill. Restricted to trustees.',
  stamp: 'Preview · restricted space, sample', headCta: { label: 'Fall meeting agenda', href: '#fall-meeting', style: 'ht-gold' },
  blocks: [
    { type: 'intro', kicker: 'Board of Trustees', title: 'The board packet, without the binder.',
      text: 'Restricted to trustees. Meeting materials open on the phone you already carry, with the agenda beside them. Check in at the door and the secretary sees who has arrived before the gavel. The campaign update comes straight from Advancement, the same page they run. Nothing here leaves this space.',
      ctas: [{ label: 'Meeting materials', href: '#materials', style: 'ht' }, { label: 'The fall agenda', href: '#fall-meeting', style: 'ht-line' }],
      image: '/ht/img/cover-dais.jpg', imageAlt: 'The dais at a Huston-Tillotson ceremony' },
    { type: 'notice', tone: 'maroon', html: '<b>Restricted space.</b> This portal is for trustees. Materials open only for signed-in members on the board list kept by the board secretary. Everything on this page is sample content for a working session.' },
    { type: 'materials', id: 'materials', title: 'Meeting materials', meta: 'Fall board meeting · October 16, 2026 · sample', items: [
      { kind: 'PDF', title: 'Agenda, fall board meeting', sub: 'Posted by the board secretary · one page', restricted: true },
      { kind: 'DOC', title: 'Minutes, summer meeting', sub: 'For approval at call to order', restricted: true },
      { kind: 'DECK', title: "President's report", sub: 'Dr. Melva K. Wallace · fall 2026', restricted: true },
      { kind: 'PDF', title: 'Finance Committee packet', sub: 'Updated yesterday · read before Friday', restricted: true },
      { kind: 'DECK', title: 'Advancement report', sub: 'Linda Y. Jackson · the donor pages and the fall briefing', href: '/ht/hub/advancement/' },
      { kind: 'PDF', title: 'Facilities update', sub: 'Campus plan renderings and the fall walk-through', restricted: true },
      { kind: 'PDF', title: 'Audit summary', sub: 'For executive session', restricted: true },
      { kind: 'DOC', title: 'Strategic plan, draft three', sub: 'Comments open in this space until October 9', restricted: true } ] },
    { type: 'agenda', id: 'fall-meeting', title: 'Fall board meeting', meta: 'Add it to your calendar in one tap',
      event: { name: 'Fall board meeting', dates: 'Friday, October 16, 2026', place: 'The boardroom', note: 'Sample agenda' },
      days: [{ label: 'Friday, October 16', date: '2026-10-16', items: [
        { time: '9:00 AM', end: '9:10 AM', title: 'Call to order and approval of the minutes', who: 'Board chair (sample)' },
        { time: '9:10 AM', end: '9:50 AM', title: "President's report", who: 'Dr. Melva K. Wallace, President' },
        { time: '9:50 AM', end: '10:40 AM', title: 'Committee reports: Finance, Academic Affairs, Facilities', who: 'Committee chairs (sample)' },
        { time: '10:40 AM', end: '11:15 AM', title: 'Campaign update from Advancement', who: 'Linda Y. Jackson, Vice President for Institutional Advancement', tag: 'Advancement', tagCls: 'soft' },
        { time: '11:15 AM', end: '11:55 AM', title: 'Executive session', where: 'The boardroom, trustees only', tag: 'Closed', tagCls: 'soft' },
        { time: '11:55 AM', end: '12:00 PM', title: 'Adjourn', who: 'Board chair (sample)' } ] }] },
    { type: 'checkin', id: 'checkin', title: 'Check in', meta: 'The code is on the screen at call to order', session: 'Fall board meeting', sub: 'October 16, 2026 · the boardroom', code: 'TRUST26', hint: 'Attendance is noted from check-ins. Sample code for this preview: TRUST26.' },
    { type: 'split', id: 'phone', kicker: 'The portal', title: 'Everything a trustee needs, on the phone they already carry.',
      text: 'No binder shipped a week early. No app to install. The packet, the agenda, and the room open from one link, and the board secretary sees who has checked in before the meeting starts.',
      bullets: ['Materials open in place, restricted to the board list', 'The agenda adds to a calendar in one tap and prints for the table', 'Check in at the door, attendance noted as you walk in', 'The campaign update is the same page Advancement runs, nothing re-typed'],
      image: '/ht/img/r-admin-dusk.jpg', imageAlt: 'Rendering of the administration building at dusk', side: 'right', cta: { label: 'Put it on your phone', href: '/ht/hub/#install', style: 'ht' } },
    { type: 'faq', id: 'faq', title: 'Questions trustees ask', meta: 'Sample answers', items: [
      { q: 'Is this space private?', a: 'Yes. The board space opens only for signed-in members on the board list kept by the board secretary. The rest of the hub is open to the campus. This preview shows sample content so you can see the shape of it.' },
      { q: 'Who can post here?', a: 'The board secretary and the Office of the President post announcements and materials. Trustees and trustees message the secretary directly. There is no open feed in this space, by design.' },
      { q: 'Can I download the materials?', a: 'Materials marked Restricted open in place, on your phone or laptop, and are not sent as attachments. The agenda prints from this page for anyone who wants paper at the table.' } ] },
    { type: 'calendar', side: true, title: 'The meeting cycle', meta: 'Sample dates', items: [
      { date: '2026-10-16', title: 'Fall board meeting', where: 'The boardroom · 9:00 AM', tag: 'Next', tagCls: 'green' },
      { date: '2027-01-22', title: 'Winter board meeting', where: 'The boardroom · 9:00 AM' },
      { date: '2027-03-12', title: 'Board retreat', where: 'Off campus · one day · trustees join', tag: 'Retreat', tagCls: 'soft' },
      { date: '2027-04-16', title: 'Spring board meeting', where: 'The boardroom · 9:00 AM' },
      { date: '2027-07-16', title: 'Summer board meeting', where: 'The boardroom · 9:00 AM' } ] },
    { type: 'people', side: true, title: 'Committees', meta: 'Sample roles', dm: false, items: [
      { name: 'Dr. Melva K. Wallace', init: 'MW', role: 'President', org: 'Office of the President', gold: true, tag: 'President', tagCls: 'green' },
      { name: 'Chair, Board of Trustees (sample)', role: 'Presides', org: 'Sets the agenda with the President' },
      { name: 'Chair, Finance Committee (sample)', role: 'Finance and audit', org: 'Owns the Finance Committee packet' },
      { name: 'Chair, Academic Affairs Committee (sample)', role: 'Academic programs', org: 'Reports at every meeting' },
      { name: 'Chair, Facilities Committee (sample)', role: 'The campus plan', org: 'Owns the facilities update' },
      { name: 'Board secretary (sample)', role: 'Materials, minutes, check-in', org: 'Posts everything in this space' } ] },
    { type: 'announcements', side: true, title: 'From the board secretary', meta: 'Sample', items: [
      { who: 'Board secretary', when: 'Today', text: 'The fall packet is complete. Eight items. The Finance Committee packet was updated yesterday, please re-read pages four and five.' },
      { who: 'Board secretary', when: 'Monday', text: 'Comments on the strategic plan draft close October 9. Reply in the document or message me here.' },
      { who: 'Board secretary', when: 'Last week', text: 'Check-in is new this fall. Type the code from the screen at call to order and attendance is noted as you sit down.' } ] },
    { type: 'cta', title: 'The fall meeting is Friday, October 16.', text: 'Read the packet on your phone, add the agenda to your calendar, and check in at the door.', primary: { label: 'Open the agenda', href: '#fall-meeting', style: 'ht-gold' }, secondary: { label: 'The Advancement report', href: '/ht/hub/advancement/', style: 'ht-line' } }
  ]
};

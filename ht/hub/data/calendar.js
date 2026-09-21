/* The published academic calendar keeps the original year renderer and data.
   Loaded after events.js by ht/build.mjs. Do not duplicate or invent academic dates here. */
(function () {
  'use strict';
  var year = (HT.spaces.events.blocks || []).filter(function (block) { return block.type === 'year'; })[0];
  if (!year) throw new Error('The academic calendar requires the published year data from events.js.');
  HT.spaces.calendar = {
    key: 'calendar', tab: 'events', title: 'Academic calendar', office: 'Huston-Tillotson University · academic dates', icon: 'calendar',
    blurb: 'The published academic calendar, with term filters, calendar downloads, and printing.',
    sub: 'Keep important academic dates close. Browse the dates already included from the University’s published calendar, filter by term, and add them to your calendar.',
    stamp: 'Published academic dates · 2026–2027',
    headCta: { label: 'Back to campus events', href: '/ht/hub/events/', style: 'ht' },
    blocks: [
      { type: 'notice', text: 'This is a reference copy of the University’s published academic calendar. Dates may change. Use the published calendar link below to confirm the latest University information.' },
      year,
      { type: 'cta', title: 'Find your next campus connection.', text: 'Explore campus workshops and gatherings, save your place, and check in when you arrive.', primary: { label: 'Browse campus events', href: '/ht/hub/events/', style: 'ht' } }
    ]
  };
})();

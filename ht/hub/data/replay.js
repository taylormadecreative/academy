/* The HT Hub — the replay page for the live room (REAL: ht/hub/replay.js reads the last session's chapters,
   summary, files and transcript). Not a tab: HT.pages lists it; the Live tab stays current here. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.replay = {
  key: 'replay', tab: 'live', title: 'Replay', office: 'The live room · the last session', icon: 'play',
  sub: 'The recording, with clickable chapters, a five-line summary, what was assigned, the files shown, and a searchable transcript.',
  stamp: 'Real · from the last session', headCta: { label: 'Back to the room', href: '/ht/hub/live/', style: 'ht-line' },
  blocks: [ { type: 'replay', id: 'replay' } ]
};

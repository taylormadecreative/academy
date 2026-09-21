/* Compatibility venue for existing shared-room links. New cohort classes use /session/. */
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces['legacy-live'] = {
  key: 'legacy-live', tab: 'live', title: 'Original shared room', office: 'Existing HT room', icon: 'play',
  sub: 'This is the original shared venue for existing invitations. Find your cohort’s scheduled sessions in Classrooms.',
  stamp: 'Shared venue · existing access rules',
  headCta: { label: 'Find your classroom', href: '/ht/hub/live/', style: 'ht-line' },
  blocks: [{ type: 'room', id: 'room', cardTitle: 'The HT shared room', meta: 'Existing room' }]
};

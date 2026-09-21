/* Pure route context for the real HT meeting/replay adapters. A managed session never
   falls back to the legacy campus room, even when its URL is missing or malformed. */
export const CLASSROOM_SLUG = /^htc-[0-9a-f]{24}$/;
export function classroomContext(pathname, search, allowLegacy = false) {
  const params = new URLSearchParams(search || '');
  const slug = params.get('room');
  const isSession = /^\/ht\/hub\/session\/?$/.test(pathname);
  if (slug !== null || isSession) {
    if (!slug || !CLASSROOM_SLUG.test(slug)) throw new Error('This classroom link is incomplete. Open the session from Classrooms & live sessions.');
    if (params.has('demo')) throw new Error('Open this sample session from the classroom demo. Demo sessions do not start a live meeting.');
    if (!isSession && !/^\/ht\/hub\/replay\/?$/.test(pathname)) throw new Error('Open this classroom using its scheduled session link.');
    const query = '?room=' + encodeURIComponent(slug);
    return { slug, managed: true, roomPath: '/ht/hub/session/' + query, replayPath: '/ht/hub/replay/' + query, summaryStorageKey: 'ht-summary-pending:' + slug };
  }
  if (!allowLegacy) throw new Error('Choose a classroom from Classrooms & live sessions.');
  return { slug: 'ht', managed: false, roomPath: '/ht/hub/legacy-live/', replayPath: '/ht/hub/replay/?legacy=1', summaryStorageKey: 'ht-summary-pending' };
}
export function classroomLogin(context, replay = false, key = null) {
  const destination = replay ? context.replayPath : context.roomPath + (!context.managed && key ? '?k=' + encodeURIComponent(key) : '');
  return '/login/?next=' + encodeURIComponent(destination);
}
export function validateClassroomAccess(access, roomId = null) {
  return !!access && access.managed === true && access.can_join === true && typeof access.room_id === 'string' && !!access.room_id && (!roomId || access.room_id === roomId);
}

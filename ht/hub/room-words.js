/* ht/hub/room-words.js — the words and colors that make the Academy room HT's. Pure: no DOM,
   no supabase; tests/ht/room-words.test.mjs covers it. Imported by ht/hub/room.js (both ride the
   HT build stamp from ht/build.mjs). The words object has the same keys as OPIL_WORDS /
   ROOM_WORDS in opil/hub/live-rooms.js — the room module reads them through nowCopy/joinCopy. */

/* The host is whoever the room row names (ea_rooms.host_name): Nelson today, an HT staffer once
   Nelson adds their email. Nobody in HT's room is assumed to be Nelson. */
export function htWords(hostName) {
  const host = (hostName && String(hostName).trim()) || 'Your host';
  return Object.freeze({
    one: 'person', many: 'people', host, teaching: 'is live', thing: 'session',
    waiting: host + ' hasn’t started yet — we’ll bring you in the moment they do.',
    replayFor: 'the HT Hub',
    notAllowed: 'You need your host’s link to join this room.',
    notOpen: host + ' hasn’t started yet.',
    notConfigured: 'The room is not set up yet.',
  });
}

/* provideRtkDesignSystem's shape (js/rtk-room-v2.js passes the Academy navy/gold in exactly this
   form): brand runs 300 dark → 700 light, the OPPOSITE of the preset JSON's 300 light → 700 dark.
   Terra canvas, Mahogany deep, Maroon panels, Brick raised; Gold accent with Mahogany text on it.
   #4D0000 is the one step not in HT's extended palette — the midpoint between Mahogany and Maroon. */
export const HT_TOKENS = Object.freeze({
  theme: 'dark', borderRadius: 'rounded', spacingBase: 4,
  colors: Object.freeze({
    brand: Object.freeze({ 300: '#B38F00', 400: '#D9AD00', 500: '#FFCC00', 600: '#FFD940', 700: '#FFE580' }),
    background: Object.freeze({ 600: '#8F0000', 700: '#660100', 800: '#4D0000', 900: '#3B0000', 1000: '#291C14' }),
    text: '#FFFFFF', 'text-on-brand': '#3B0000', 'video-bg': '#3B0000',
    danger: '#FA2626', success: '#94CCAB', warning: '#F2B00D',
  }),
});

/* what an ea-rtk-join / ea-rtk-record error says on the HT page — js/room-page.js has the same
   list with "Nelson" in it; HT's host is whoever the row names, so these never say a name */
export function htErrorText(code, status, words) {
  switch (code) {
    case 'sign_in': return 'Sign in again and retry.';
    case 'not_allowed': return words.notAllowed;
    case 'bad_link': return 'This link isn’t active anymore — ask your host for the new one.';
    case 'not_open': return words.notOpen;
    case 'room_full': return 'The room is full right now.';
    case 'slow_down': return 'Too many tries — wait a minute and try again.';
    case 'no_room': return 'The room isn’t open yet.';
    case 'not_host': return 'Only a host can do that.';
    case 'no_replay': return 'That replay is gone.';
    case 'nothing_to_retry': return 'Nothing to retry for that replay.';
    case 'rtk_not_configured': return words.notConfigured;
    default: return 'The server said ' + (status || code || 'nothing') + '.';
  }
}

/* "Sign in to join" → /login/?next=/ht/hub/live/?k=… so the key survives the email code and /welcome/ */
export function htLoginHref(k) {
  return '/login/?next=' + encodeURIComponent('/ht/hub/live/' + (k ? '?k=' + k : ''));
}

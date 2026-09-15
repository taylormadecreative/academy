/* /room/ — the decisions the Academy room page makes before it touches the DOM. Pure: no DOM,
   no supabase, so `node --test tests/academy/*.test.mjs` covers every branch.
   Imported by /room/index.html (stamped ?v= by build_site.py) and by /live/index.html for the
   status line and replay labels on Nelson's card. Nothing under /opil/ imports this file. */

/* the shape ea_room_new_key() mints: 16 random bytes, url-safe base64, no padding → 22 chars */
export const KEY_RX = /^[A-Za-z0-9_-]{22}$/;

/* ?k=<key> → the key; anything else → null, so a mangled link lands on the sign-in card (or,
   signed in, on whatever ea_room_state says for "no key") instead of a blank page. */
export function roomKey(search) {
  let v; try { v = new URLSearchParams(search || '').get('k'); } catch (e) { return null; }
  return v != null && KEY_RX.test(v) ? v : null;
}

/* ea_room_state(k) → which card the page shows. The order is the whole rule: a dead link wins
   over everything, sign-in over role, Nelson over people, the key over the clock. */
export function roomBranch(state) {
  if (!state || typeof state !== 'object') return 'error';
  if (state.bad_link) return 'dead_link';
  if (!state.signed_in) return 'landing';
  if (state.is_host) return state.is_live ? 'host_live' : 'host_idle';
  if (!state.can_join) return 'not_allowed';
  return state.is_live ? 'student' : 'waiting';
}

/* "Sign in to join" → /login/?next=/room/?k=… so the key survives the round trip through
   the email code and /welcome/ */
export function loginHref(k) {
  return '/login/?next=' + encodeURIComponent('/room/' + (k ? '?k=' + k : ''));
}

/* what an ea-rtk-join / ea-rtk-record error says on this page — the one source of truth for /room/
   and for Nelson's card on /live/; the three words-driven lines (not_allowed, not_open,
   rtk_not_configured) read from ROOM_WORDS or OPIL_WORDS in opil/hub/live-rooms.js */
export function joinErrorText(code, status, words) {
  switch (code) {
    case 'sign_in': return 'Sign in again and retry.';
    case 'not_allowed': return words.notAllowed;
    case 'bad_link': return 'This link isn’t active anymore — ask Nelson for the new one.';
    case 'not_open': return words.notOpen;
    case 'room_full': return 'The room is full right now.';
    case 'slow_down': return 'Too many tries — wait a minute and try again.';
    case 'no_room': return 'The room isn’t open yet.';
    case 'not_host': return 'Only Nelson can do that.';
    case 'no_replay': return 'That replay is gone.';
    case 'nothing_to_retry': return 'That replay is not failed, so there is nothing to retry.';
    case 'no_upload': return 'That recording never finished uploading, so there is nothing to retry.';
    case 'rtk_not_configured': return words.notConfigured;
    default: return 'The server said ' + status + '.';
  }
}

/* Nelson's card: "Off air" or "Live now · 12 people" (people = ea_room_state().people, admin only) */
export function statusLine(state) {
  if (!state.is_live) return 'Off air';
  const n = Number(state.people || 0);
  return 'Live now · ' + n + (n === 1 ? ' person' : ' people');
}

/* one label per ea_room_replays row, the same words as the OPIL coordinator row */
export function replayLabel(row) {
  const s = row.status;
  if (s === 'invoked' || s === 'recording' || s === 'uploading' || s === 'uploaded') return 'Replay preparing';
  if (s === 'ready') return row.published ? 'Published ✓' : 'Replay ready — review, then publish';
  return 'Replay failed';
}

/* the Stream /watch page is Cloudflare's hosted player and cannot be embedded; /iframe can */
export function iframeUrl(watchUrl) {
  return watchUrl ? watchUrl.replace(/\/watch$/, '/iframe') : null;
}

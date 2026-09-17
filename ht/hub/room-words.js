/* ht/hub/room-words.js — the words and colors that make the Academy room HT's. Pure: no DOM,
   no supabase; tests/ht/room-words.test.mjs covers it. Imported by ht/hub/room.js (both ride the
   HT build stamp from ht/build.mjs). The words object has the same keys as OPIL_WORDS /
   ROOM_WORDS in opil/hub/live-rooms.js — the room module reads them through nowCopy/joinCopy. */
import { KEY_RX } from '../../js/room-page.js';   /* the shape ea_room_new_key() mints; relative so node and the browser both resolve it */

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
    case 'no_upload': return 'That recording never finished uploading, so there is nothing to retry.';
    case 'bad_replay': return 'That replay id is not valid.';
    case 'rtk_not_configured': return words.notConfigured;
    default: return 'The server said ' + (status || code || 'nothing') + '.';
  }
}

/* "Sign in to join" → /login/?next=/ht/hub/live/?k=… so the key survives the email code and /welcome/ */
export function htLoginHref(k) {
  return '/login/?next=' + encodeURIComponent('/ht/hub/live/' + (k ? '?k=' + k : ''));
}

/* ---------- the invitation, remembered on this device ----------
   The link a host sends carries ?k=. Two things lose it: the sign-in round trip when the email
   code is opened in another browser (no bm_next there), and a reload after the URL was cleaned.
   So the room page keeps the last good key here for 7 days and uses it when the URL has none.
   `store` is {getItem,setItem,removeItem}: localStorage behind a try/catch shim in room.js, a
   Map-backed fake in the tests. Nothing here throws. */
export const ROOM_KEY_STORE = 'ht-room-key';
export const ROOM_KEY_MAX_AGE_MS = 7 * 24 * 3600e3;

/* keep k as {k, t}; anything that is not a key (or a store that cannot write) is a no-op → false */
export function rememberKey(store, k, now) {
  if (!store || typeof k !== 'string' || !KEY_RX.test(k)) return false;
  const t = Number.isFinite(now) ? now : Date.now();
  try { store.setItem(ROOM_KEY_STORE, JSON.stringify({ k, t })); return true; } catch (e) { return false; }
}

/* the remembered key, or null when there is none, it is malformed, it is not key-shaped, or it
   is maxAgeMs old or older ("younger than 7 days" is the rule) */
export function recallKey(store, now, maxAgeMs = ROOM_KEY_MAX_AGE_MS) {
  if (!store) return null;
  let raw; try { raw = store.getItem(ROOM_KEY_STORE); } catch (e) { return null; }
  if (typeof raw !== 'string' || !raw) return null;
  let v; try { v = JSON.parse(raw); } catch (e) { return null; }
  if (!v || typeof v !== 'object' || typeof v.k !== 'string' || !KEY_RX.test(v.k)) return null;
  if (typeof v.t !== 'number' || !Number.isFinite(v.t)) return null;   /* Number(null) is 0: a missing stamp is malformed, not ancient */
  const at = Number.isFinite(now) ? now : Date.now();
  if (at - v.t >= maxAgeMs) return null;
  return v.k;
}

/* the host made a new link, or the server said bad_link for the stored one: drop it */
export function forgetKey(store) {
  if (!store) return;
  try { store.removeItem(ROOM_KEY_STORE); } catch (e) {}
}

/* ---------- Next session (spec 2026-09-17 §2.4) ---------- */
/* what the Live space says above the room: the host's next session while it is ahead of now; null otherwise */
export function nextSessionLine(state, nowMs) {
  const at = state && state.next_at ? Date.parse(state.next_at) : NaN;
  if (!Number.isFinite(at) || at <= nowMs) return null;
  const d = new Date(at);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
  return { title: String(state.next_title || '').trim() || String(state.title || '').trim() || 'HT Live', when: day + ' · ' + time + ' CT', iso: d.toISOString() };
}
const icsStamp = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/* three ways onto a calendar — Google and Outlook as links, Apple (and everything else) as an .ics; nothing emails anyone */
export function calendarLinks({ title, startIso, roomUrl, minutes = 60 }) {
  const start = new Date(startIso), end = new Date(start.getTime() + minutes * 60000);
  const s = start.toISOString(), e = end.toISOString();
  const details = 'Join at ' + roomUrl;
  const google = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + encodeURIComponent(icsStamp(s) + '/' + icsStamp(e)) + '&details=' + encodeURIComponent(details) + '&location=' + encodeURIComponent(roomUrl);
  const outlook = 'https://outlook.live.com/calendar/0/deeplink/compose?subject=' + encodeURIComponent(title) + '&startdt=' + encodeURIComponent(s) + '&enddt=' + encodeURIComponent(e) + '&body=' + encodeURIComponent(details) + '&location=' + encodeURIComponent(roomUrl) + '&path=%2Fcalendar%2Faction%2Fcompose&rru=addevent';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Taylormade Academy//HT Hub//EN', 'BEGIN:VEVENT', 'UID:' + icsStamp(s) + '@taylormadeacademy.com', 'DTSTAMP:' + icsStamp(new Date().toISOString()), 'DTSTART:' + icsStamp(s), 'DTEND:' + icsStamp(e), 'SUMMARY:' + icsText(title), 'DESCRIPTION:' + icsText(details), 'URL:' + roomUrl, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return { google, outlook, ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
}

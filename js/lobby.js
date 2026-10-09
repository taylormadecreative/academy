/* js/lobby.js — the lobby: the Academy room's waiting room (Nelson, 10/9: "a waiting room for my ai workshop … cool
   animations about ai while people waited on me to enter the room … even if i'm in the room i still would like to have
   them in some sort of waiting room until i bring them to the class").

   What it is, in order:
   - Guests (people who are not the host) land in the lobby whether or not the class has started: a night stage in the
     keynote look (navy, dot grid, white type, gold), a living network where every person waiting is a node with their
     name, a screen that plays short AI lessons on a loop, the room's question of the day, and a camera check.
   - Nelson's /room/ page holds the doors. Its presence on the lobby channel says doors 'closed' until he presses
     Bring everyone in (before or after he is in the room), then 'open' for the rest of that session: everyone waiting
     walks into the class together and late arrivals walk straight in.
   - It FAILS OPEN. The lobby only holds people when Nelson's page is on the channel saying 'closed'. No word from his
     page (the channel never connects, his tab is gone) → after GRACE_MS the class runs exactly as it did before the
     lobby: live = in. A broken lobby can never strand a class.
   The channel is 'lobby-room:<id>', private (0053: anyone who may be in the room may read and send). The room's
   attendance beat (ea_class_presence 'waiting') and the warm-up answers (ea_class_warmups) are the same rows the old
   waiting screen wrote, so Nelson's Warm-up answers tab in the room keeps working.
   Pure decisions are exported for tests (tests/academy/lobby.test.mjs). Import-safe in Node. */

export const GRACE_MS = 7000;        /* live, and no word from Nelson's page for this long after the channel is up → in */
export const NO_CHANNEL_MS = 10000;  /* live, and the channel never came up within this long of mounting → in */
export const POLL_MS = 10000;        /* how often a lobby asks the server whether the room is live */
export const HOST_GONE_MS = 15000;   /* Nelson's page vanished from the channel (a reload, a Wi-Fi blip): keep his last word this long */
export const HOLD_KEY = 'tma-lobby-hold';            /* Nelson's switch: '0' = people walk straight in, like before */
export const openKey = (roomId) => 'tma-lobby-open:' + roomId;   /* this session's doors, kept across his reloads */
export const topicOf = (roomId) => 'lobby-room:' + roomId;
export const roomKeyOf = (roomId) => 'room:' + roomId;
export const ANSWER_MAX = 280;
export const CITY_MAX = 80;
export const ROOM_DEFAULT_QUESTION = 'What do you hope to hear today?';
export const MAX_NODES = 60;         /* people drawn in the network; everyone still counts */

/* ---------- pure helpers ---------- */
const TITLES = /^(dr|mr|mrs|ms|mx|prof|rev|pastor|coach|min|bishop|elder|sister|brother)\.?$/i;
/* the name on a node: a first name ("Meme"), a title keeps its name ("Dr. Gray"), an email is cut at the @ */
export function shortName(name) {
  const s = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.includes('@')) return s.split('@')[0].slice(0, 18);
  const parts = s.split(' ');
  if (parts.length > 1 && TITLES.test(parts[0])) return (parts[0] + ' ' + parts[1]).slice(0, 20);
  return parts[0].slice(0, 18);
}
/* one or two letters for inside the node */
export function initials(name) {
  const s = shortName(name).replace(/^(dr|mr|mrs|ms|mx|prof|rev|pastor|coach|min|bishop|elder|sister|brother)\.?\s+/i, '');
  const w = s.split(/[\s._-]+/).filter(Boolean);
  if (!w.length) return '·';
  return (w[0][0] + (w[1] ? w[1][0] : '')).toUpperCase();
}
/* "Atlanta, GA" → "Atlanta" */
export function cityWord(s) { return String(s == null ? '' : s).split(',')[0].replace(/\s+/g, ' ').trim().slice(0, 40); }
/* a channel's presenceState() → who holds the doors and who is waiting. A key can carry several metas (two tabs):
   a key with any host meta is the host's; a guest key is one person, named by their newest meta. */
export function readPresence(state, myId) {
  const host = { seen: false, open: false, live: false, name: '' };
  const guests = [];
  const keys = state && typeof state === 'object' ? Object.keys(state) : [];
  for (const key of keys) {
    const metas = Array.isArray(state[key]) ? state[key].filter(m => m && typeof m === 'object') : [];
    if (!metas.length) continue;
    const hosts = metas.filter(m => m.role === 'host');
    if (hosts.length) {
      host.seen = true;
      if (hosts.some(m => m.doors === 'open')) host.open = true;
      if (hosts.some(m => m.live)) host.live = true;
      if (!host.name) host.name = String(hosts[0].name || '');
      continue;
    }
    const newest = metas.reduce((a, b) => (Number(b.at) || 0) >= (Number(a.at) || 0) ? b : a);
    const first = metas.reduce((a, b) => (Number(b.at) || Infinity) < (Number(a.at) || Infinity) ? b : a);
    guests.push({ id: key, name: shortName(newest.name) || 'Someone', city: cityWord(newest.city), at: Number(first.at) || 0, you: key === myId });
  }
  guests.sort((a, b) => (a.at - b.at) || a.name.localeCompare(b.name));
  return { host, guests };
}
/* what a guest's lobby does right now:
   'wait'  the class has not started — stay in the lobby
   'hold'  the class is running and Nelson is holding the doors — stay in the lobby
   'enter' go into the class (Nelson opened the doors, or there has been no word from his page: fail open) */
export function gate({ isLive, host, settled }) {
  if (!isLive) return 'wait';
  if (host && host.open) return 'enter';
  if (host && host.seen) return 'hold';
  return settled ? 'enter' : 'hold';
}
/* has the lobby waited long enough for Nelson's page to speak? Counted from the later of the channel coming up and
   the class going live (a page that started before Nelson did must still give him the grace) */
export function isSettled({ now, mountedAt, subscribedAt, liveAt = 0, grace = GRACE_MS, noChannel = NO_CHANNEL_MS }) {
  if (subscribedAt) return now - Math.max(subscribedAt, liveAt) >= grace;
  return now - Math.max(mountedAt, liveAt) >= noChannel;
}
/* what the lobby believes about Nelson's doors right now:
   - the channel is up and his page is on it → what it says
   - his page just left (a reload, a blip) → his last word, for HOST_GONE_MS; then nothing (fail open)
   - this guest's own channel is down → the last word for the grace, then nothing (fail open) */
export function hostView({ now, channelOn, offAt, host, lastHost, lastHostAt, grace = GRACE_MS, gone = HOST_GONE_MS }) {
  const none = { seen: false, open: false, live: false };
  if (channelOn === false) return (lastHost && now - (offAt || 0) < grace) ? lastHost : none;
  if (host && host.seen) return host;
  if (lastHost && now - lastHostAt < gone) return lastHost;
  return host || none;
}
/* the count under the network, for a guest */
export function crowdLine(n) {
  const others = Math.max(0, (Number(n) || 0) - 1);
  if (!others) return 'Just you so far. People show up here as they arrive.';
  return 'You and ' + others + (others === 1 ? ' other person are' : ' other people are') + ' in the lobby.';
}
/* the count for Nelson */
export function hostCount(n) {
  const k = Number(n) || 0;
  return !k ? 'Nobody in the lobby yet' : k === 1 ? '1 person in the lobby' : k + ' people in the lobby';
}
/* "Meme, Jamal, Dr. Gray and 9 more" */
export function namesLine(people, max = 3) {
  const names = (people || []).map(p => typeof p === 'string' ? p : p && p.name).filter(Boolean);
  if (!names.length) return '';
  const shown = names.slice(0, max), rest = names.length - shown.length;
  if (rest > 0) return shown.join(', ') + ' and ' + rest + ' more';
  if (shown.length === 1) return shown[0];
  return shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1];
}
/* "Joining from Dallas · Atlanta · Houston" — each place once, in arrival order, six at most */
export function citiesLine(people) {
  const seen = new Set(), out = [];
  (people || []).forEach(p => { const c = cityWord(p && p.city); const k = c.toLowerCase(); if (c && !seen.has(k)) { seen.add(k); out.push(c); } });
  if (!out.length) return '';
  const shown = out.slice(0, 6), rest = out.length - shown.length;
  return 'Joining from ' + shown.join(' · ') + (rest > 0 ? ' · and ' + rest + ' more' : '');
}
/* the room's next start, when Nelson set one: "Starts at 7:00 PM · in 23 min" (only within the next 12 hours) */
export function startsLine(nextAt, now, fmt) {
  const t = nextAt ? Date.parse(nextAt) : NaN;
  if (!Number.isFinite(t)) return '';
  const ms = t - (typeof now === 'number' ? now : Date.now());
  if (ms <= 0 || ms > 12 * 3600e3) return '';
  const at = fmt ? fmt(t) : new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const min = Math.ceil(ms / 60000);
  const left = min < 60 ? 'in ' + min + ' min' : 'in ' + Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') + ' min';
  return 'Starts at ' + at + ' · ' + left;
}
/* the words for each moment. {u} marks the one word with the gold bar under it. */
export function phaseCopy(phase, hostName) {
  const who = shortName(hostName) || 'Nelson';
  if (phase === 'hold') return { state: who + ' is in the room', h: who + ' is {u}here{/u}.', sub: 'He’s getting the class ready and will bring everyone in together in a moment. Stay right here. This page moves you in by itself.' };
  if (phase === 'enter') return { state: 'The doors are open', h: 'Come on {u}in{/u}.', sub: 'Taking you into the class now…' };
  return { state: who + ' opens the doors soon', h: 'You’re in the {u}lobby{/u}.', sub: 'Stay on this page. When ' + who + ' brings everyone in, it moves you into the class by itself. No need to refresh.' };
}
/* the host's line beside the count */
export function hostDoorsLine({ live, open, hold, connected }) {
  if (connected === false) return 'The lobby is offline right now, so people walk straight in once you start.';
  if (!hold) return live ? 'People walk straight in. Holding is off.' : 'Holding is off: people walk straight in when you start.';
  if (open) return 'The doors are open. Anyone who arrives now walks straight in.';
  return live ? 'They wait in the lobby until you bring them in.' : 'They wait in the lobby, even after you start, until you bring them in.';
}
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* "{u}word{/u}" → the gold-bar span; everything else escaped */
export function markU(s) { return escHtml(s).replace(/\{u\}(.*?)\{\/u\}/g, '<span class="lb-u">$1</span>'); }

/* ---------- the AI lessons on the lobby screen ----------
   Nelson's class rules (10/8): every scene SAYS what it means and why, examples visibly do what they were asked,
   hallucination comes first. The words match the class (ai101_course.py: token, context window, hallucination). */
export const LESSONS = [
  { v: 'halluc', h: 'Sounds sure. Can be {u}wrong{/u}.', why: 'AI can make things up and say them like facts. That’s called a hallucination. Check anything that matters before you use it.' },
  { v: 'next', h: 'AI writes one {u}word{/u} at a time.', why: 'It guesses the most likely next word, adds it, and guesses again. A whole answer is built that way, one word at a time.' },
  { v: 'tokens', h: 'AI reads in {u}tokens{/u}.', why: 'A token is a small piece of text: a short word, part of a longer word, or a mark like a period. AI reads, writes and counts in tokens.' },
  { v: 'window', h: 'It re-reads the {u}whole{/u} chat.', why: 'Every reply re-reads your whole chat. A longer chat is slower, uses up your limit faster and costs more. When it’s full, it can forget the start.' },
  { v: 'prompt', h: 'Vague in, {u}vague{/u} out.', why: 'Say who it’s for, what matters and how it should sound. A good prompt has 5 parts, and they’re the difference between these two answers.' },
  { v: 'stat', h: '{u}2 out of 3{/u} leaders won’t hire without AI skills.', why: '66% of business leaders say they wouldn’t hire someone without AI skills. (Microsoft and LinkedIn, 2024 Work Trend Index.) That’s why you’re here.' },
  { v: 'apps', h: 'Learn the {u}skill{/u}, not the app.', why: 'Don’t fall in love with one AI. A good prompt works in all of them, and each one has a strong suit.' },
];
function lessonDemo(v) {
  switch (v) {
    case 'next': return `<div class="nx">
        <p class="nx-line"><span class="nx-base">Thanks for having me. I want to learn</span><span class="nx-add" data-w="1"> how</span><span class="nx-add" data-w="2"> to</span><span class="nx-add" data-w="3"> use AI.</span><span class="nx-caret"></span></p>
        <div class="nx-stack"><ul class="nx-cands" data-r="1"><li class="pick"><b>how</b><i style="--p:.52"></i><em>52%</em></li><li><b>more</b><i style="--p:.27"></i><em>27%</em></li><li><b>to</b><i style="--p:.12"></i><em>12%</em></li></ul>
        <ul class="nx-cands" data-r="2"><li class="pick"><b>to</b><i style="--p:.61"></i><em>61%</em></li><li><b>AI</b><i style="--p:.22"></i><em>22%</em></li><li><b>this</b><i style="--p:.09"></i><em>9%</em></li></ul></div>
        <p class="lb-note">Example numbers, not real ones.</p></div>`;
    case 'halluc': return `<div class="hc">
        <p class="hc-q">What’s the phone number for Marco’s Tacos on Elm Street?</p>
        <p class="hc-a"><span class="hc-ai">AI</span><span class="hc-t">Sure! Marco’s Tacos is at (214) 555-0182. They’re open until 10 PM.</span></p>
        <span class="hc-stamp">Made up</span>
        <p class="hc-check">Check it before you call.</p></div>`;
    case 'tokens': return `<div class="tk">
        <p class="tk-plain">Write a thank-you note to my neighbor.</p>
        <p class="tk-chips">${['Write', ' a', ' thank', '-you', ' note', ' to', ' my', ' neighbor', '.'].map((t, i) => `<span class="tk-c c${i % 4}">${escHtml(t.trim() || t)}</span>`).join('')}</p>
        <p class="tk-count"><b>0</b> tokens</p>
        <p class="lb-note">Example split. Each AI cuts text a little differently.</p></div>`;
    case 'window': return `<div class="cw">
        <div class="cw-frame"><span class="cw-label">Context window</span>
          <div class="cw-msgs"><p class="cw-m me">Plan my mom’s birthday dinner.</p><p class="cw-m ai">Sure! How many people, and what does she love?</p><p class="cw-m me">Eight people. She loves Italian.</p><p class="cw-m ai">Here’s a menu and a shopping list…</p><p class="cw-m me">Now write the invitation text.</p></div>
          <span class="cw-out">The start falls out</span></div>
        <p class="cw-read">Read again for this reply: <b>0</b> tokens</p></div>`;
    case 'prompt': return `<div class="pr">
        <div class="pr-row bad"><p class="pr-p">Write a caption.</p><p class="pr-a">Check out our new product today!</p><span class="pr-tag">Bland</span></div>
        <div class="pr-row good"><p class="pr-p">Write a warm, two-line caption for my grandma’s sweet potato pie. We only sell it on Fridays.</p><p class="pr-a">Grandma’s sweet potato pie is back this Friday.<br>Come early. It never makes it to Saturday.</p><span class="pr-tag">Better</span></div></div>`;
    case 'stat': return `<div class="st">
        <div class="st-dial"><svg class="st-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="st-track"/><circle cx="60" cy="60" r="50" class="st-fill" pathLength="100"/></svg>
        <p class="st-num"><span><b>66</b>%</span></p></div>
        <p class="st-src">Microsoft and LinkedIn<br>2024 Work Trend Index</p></div>`;
    case 'apps': return `<div class="ap">
        <p class="ap-core">Your prompt</p>
        <ul class="ap-list"><li data-i="0"><b>Claude</b><span>Coding and building apps</span></li><li data-i="1"><b>ChatGPT</b><span>Images and planning content</span></li><li data-i="2"><b>Gemini</b><span>Videos, images and music</span></li></ul></div>`;
  }
  return '';
}
/* one timeline per lesson. Every starting state is SET before the timeline is built (never a fromTo with a visible
   FROM — the repo's GSAP gotcha), so frame 0 is always the clean start. */
function lessonTimeline(gsap, node, v) {
  const q = (s) => node.querySelector(s), qa = (s) => [...node.querySelectorAll(s)];
  const tl = gsap.timeline({ paused: true });
  const head = q('.lb-vh'), why = q('.lb-why'), bar = q('.lb-vh .lb-u');
  gsap.set([head, why], { autoAlpha: 0, y: 14 });
  if (bar) gsap.set(bar, { '--bar': 0 });
  tl.to(head, { autoAlpha: 1, y: 0, duration: .6, ease: 'power3.out' }, 0);
  if (bar) tl.to(bar, { '--bar': 1, duration: .5, ease: 'power2.out' }, .35);
  if (v === 'next') {
    const adds = qa('.nx-add'), rounds = qa('.nx-cands');
    gsap.set(q('.nx-line'), { autoAlpha: 0 }); gsap.set(adds, { autoAlpha: 0 }); gsap.set(rounds, { autoAlpha: 0, y: 10 });
    qa('.nx-cands .pick').forEach(x => x.classList.remove('on'));
    gsap.set(qa('.nx-cands i'), { scaleX: 0 }); gsap.set(qa('.nx-cands li'), { autoAlpha: 0, x: -8 }); gsap.set(q('.lb-note'), { autoAlpha: 0 });
    tl.to(q('.nx-line'), { autoAlpha: 1, duration: .4 }, .6);
    rounds.forEach((r, i) => {
      const t = 1.2 + i * 2.6;
      tl.to(r, { autoAlpha: 1, y: 0, duration: .35 }, t);
      tl.to(r.querySelectorAll('li'), { autoAlpha: 1, x: 0, duration: .3, stagger: .1 }, t + .05);
      tl.to(r.querySelectorAll('i'), { scaleX: 1, duration: .7, ease: 'power2.out', stagger: .1 }, t + .2);
      tl.call(() => r.querySelector('.pick').classList.add('on'), null, t + 1.3);
      tl.to(adds[i], { autoAlpha: 1, duration: .25 }, t + 1.7);
      if (i < rounds.length - 1) tl.to(r, { autoAlpha: 0, y: -8, duration: .3 }, t + 2.25);   /* the last round stays: the frame ends on the pick */
    });
    tl.to(adds[2], { autoAlpha: 1, duration: .3 }, 1.2 + 2 * 2.6 + .1);
    tl.to(q('.lb-note'), { autoAlpha: 1, duration: .4 }, 1.6);
  } else if (v === 'halluc') {
    const t = q('.hc-t'), full = t.dataset.full || (t.dataset.full = t.textContent);
    t.textContent = '';
    gsap.set([q('.hc-q'), q('.hc-a')], { autoAlpha: 0, y: 10 }); gsap.set(q('.hc-stamp'), { autoAlpha: 0, scale: 1.8, rotation: -14 }); gsap.set(q('.hc-check'), { autoAlpha: 0 });
    tl.to(q('.hc-q'), { autoAlpha: 1, y: 0, duration: .45 }, .7);
    tl.to(q('.hc-a'), { autoAlpha: 1, y: 0, duration: .4 }, 1.6);
    const typed = { n: 0 };
    tl.to(typed, { n: full.length, duration: 2.2, ease: 'none', onUpdate: () => { t.textContent = full.slice(0, Math.round(typed.n)); } }, 1.8);
    tl.to(q('.hc-stamp'), { autoAlpha: 1, scale: 1, rotation: -8, duration: .3, ease: 'power4.out' }, 4.5);
    tl.to(q('.hc-check'), { autoAlpha: 1, duration: .4 }, 5.1);
  } else if (v === 'tokens') {
    const chips = qa('.tk-c'), count = q('.tk-count b'), n = { v: 0 };
    gsap.set(q('.tk-plain'), { autoAlpha: 0 }); gsap.set(q('.tk-chips'), { autoAlpha: 0 }); gsap.set(chips, { autoAlpha: 0, y: 8, scale: .9 }); gsap.set([q('.tk-count'), q('.lb-note')], { autoAlpha: 0 });
    count.textContent = '0';
    tl.to(q('.tk-plain'), { autoAlpha: 1, duration: .4 }, .7);
    tl.to(q('.tk-plain'), { autoAlpha: 0, y: -6, duration: .35 }, 2.1);
    tl.set(q('.tk-chips'), { autoAlpha: 1 }, 2.3);
    tl.to(chips, { autoAlpha: 1, y: 0, scale: 1, duration: .32, ease: 'expo.out', stagger: .22 }, 2.35);
    tl.to(q('.tk-count'), { autoAlpha: 1, duration: .3 }, 2.35);
    tl.to(n, { v: chips.length, duration: chips.length * .22, ease: 'none', onUpdate: () => { count.textContent = String(Math.round(n.v)); } }, 2.4);
    tl.to(q('.lb-note'), { autoAlpha: 1, duration: .4 }, 4.6);
  } else if (v === 'window') {
    const msgs = qa('.cw-m'), read = q('.cw-read b'), n = { v: 0 }, totals = [14, 40, 62, 120, 150];
    gsap.set(msgs, { autoAlpha: 0, y: 14 }); gsap.set(q('.cw-out'), { autoAlpha: 0 }); gsap.set(q('.cw-read'), { autoAlpha: 0 });
    read.textContent = '0';
    tl.to(q('.cw-read'), { autoAlpha: 1, duration: .3 }, .7);
    msgs.forEach((m, i) => {
      const t = .9 + i * .95;
      tl.to(m, { autoAlpha: 1, y: 0, duration: .35, ease: 'power2.out' }, t);
      tl.to(n, { v: totals.slice(0, i + 1).reduce((a, b) => a + b, 0), duration: .45, ease: 'power1.out', onUpdate: () => { read.textContent = String(Math.round(n.v)); } }, t + .05);
    });
    tl.to(msgs[0], { autoAlpha: 0, y: -18, duration: .5, ease: 'power2.in' }, 5.9);
    tl.to(q('.cw-out'), { autoAlpha: 1, duration: .35 }, 5.9);
  } else if (v === 'prompt') {
    const rows = qa('.pr-row');
    rows.forEach(r => { gsap.set(r, { autoAlpha: 0, y: 12 }); gsap.set(r.querySelector('.pr-a'), { autoAlpha: 0, x: -6 }); gsap.set(r.querySelector('.pr-tag'), { autoAlpha: 0, scale: .8 }); });
    rows.forEach((r, i) => {
      const t = .8 + i * 2.2;
      tl.to(r, { autoAlpha: 1, y: 0, duration: .4 }, t);
      tl.to(r.querySelector('.pr-a'), { autoAlpha: 1, x: 0, duration: .45 }, t + .8);
      tl.to(r.querySelector('.pr-tag'), { autoAlpha: 1, scale: 1, duration: .3, ease: 'expo.out' }, t + 1.3);
    });
  } else if (v === 'stat') {
    const fill = q('.st-fill'), num = q('.st-num b'), n = { v: 0 };
    gsap.set(fill, { strokeDashoffset: 100 }); gsap.set([q('.st-num'), q('.st-src')], { autoAlpha: 0 });
    num.textContent = '0';
    tl.to(q('.st-num'), { autoAlpha: 1, duration: .3 }, .8);
    tl.to(fill, { strokeDashoffset: 34, duration: 1.8, ease: 'power2.out' }, .9);
    tl.to(n, { v: 66, duration: 1.8, ease: 'power2.out', onUpdate: () => { num.textContent = String(Math.round(n.v)); } }, .9);
    tl.to(q('.st-src'), { autoAlpha: 1, duration: .4 }, 2.6);
  } else if (v === 'apps') {
    const items = qa('.ap-list li');
    gsap.set(q('.ap-core'), { autoAlpha: 0, scale: .9 }); gsap.set(items, { autoAlpha: 0, y: 10 });
    tl.to(q('.ap-core'), { autoAlpha: 1, scale: 1, duration: .45, ease: 'expo.out' }, .8);
    tl.to(items, { autoAlpha: 1, y: 0, duration: .4, stagger: .45 }, 1.4);
    items.forEach(it => it.classList.remove('on'));
    items.forEach((it, i) => { tl.call(() => { items.forEach(x => x.classList.toggle('on', x === it)); }, null, 3 + i * 1.3); });
    tl.call(() => items.forEach(x => x.classList.add('on')), null, 3 + items.length * 1.3);   /* it ends on all three: one prompt, every app */
  }
  tl.to(why, { autoAlpha: 1, y: 0, duration: .5, ease: 'power2.out' }, 1.1);
  return tl;
}

/* ---------- small shared plumbing (browser only) ---------- */
function verOf() { try { return new URL(import.meta.url).search; } catch (e) { return ''; } }
/* the stylesheet, once; resolves when it has loaded (the network measures the page, so it must not draw before the
   CSS sizes it), or after 3 s whatever happens */
let cssReady = null;
function ensureCss() {
  if (cssReady) return cssReady;
  if (typeof document === 'undefined') return (cssReady = Promise.resolve());
  cssReady = new Promise((res) => {
    const had = document.querySelector('link[data-lobby]');
    if (had) { res(); return; }
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.lobby = '1'; l.href = '/css/lobby.css' + verOf();
    l.onload = () => res(); l.onerror = () => res();
    document.head.appendChild(l);
    setTimeout(res, 3000);
  });
  return cssReady;
}
function loadGsap() {
  if (typeof window !== 'undefined' && window.gsap) return Promise.resolve(window.gsap);
  return new Promise((res) => {
    const s = document.createElement('script'); s.src = '/js/vendor/gsap.min.js' + verOf(); s.async = true;
    s.onload = () => res(window.gsap || null); s.onerror = () => res(null);
    document.head.appendChild(s);
    setTimeout(() => res(window.gsap || null), 6000);
  });
}
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
async function realtimeAuth(sb) {
  try { const tok = (await sb.auth.getSession()).data.session?.access_token; if (tok && sb.realtime && typeof sb.realtime.setAuth === 'function') await sb.realtime.setAuth(tok); } catch (e) {}
}
/* the lobby channel: presence keyed by the person's id. Never throws; onStatus hears 'on' | 'off'. */
function lobbyChannel(sb, roomId, key, { onSync, onStatus }) {
  let ch = null, stopped = false;
  const api = {
    async start(meta) {
      if (!sb || typeof sb.channel !== 'function') { onStatus('off'); return; }
      await realtimeAuth(sb);
      if (stopped) return;
      try {
        ch = sb.channel(topicOf(roomId), { config: { private: true, presence: { key } } });
        ch.on('presence', { event: 'sync' }, () => { try { onSync(ch.presenceState()); } catch (e) { console.warn('[lobby] sync', e); } });
        ch.subscribe(async (status) => {
          if (stopped) return;
          if (status === 'SUBSCRIBED') { onStatus('on'); try { await ch.track(meta()); } catch (e) { console.warn('[lobby] track', e); } }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus('off');
        });
      } catch (e) { console.warn('[lobby] channel', e); onStatus('off'); }
    },
    async retrack(meta) { try { if (ch) await ch.track(meta); } catch (e) {} },
    stop() { stopped = true; try { if (ch) { ch.untrack && ch.untrack(); sb.removeChannel(ch); } } catch (e) {} ch = null; },
  };
  return api;
}

/* ---------- the network: people as nodes, signals as gold pulses ---------- */
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function hash2(s) { return hash(s + '·y'); }
function makeNet(canvas, field, { reduced }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setPeople() {}, converge() {}, stop() {}, burst() {} };
  let W = 0, H = 0, dpr = 1, raf = 0, stopped = false, lastSpawn = 0, conv = null, first = true;
  const amb = [], ppl = new Map(), pulses = [], rings = [];
  const SPEED = reduced ? .25 : 1;
  function newAmb() { return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .16, vy: (Math.random() - .5) * .16, r: .7 + Math.random() * 1.5, tw: Math.random() * 6.283 }; }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.round(Math.min(120, Math.max(34, (W * H) / 15000)));
    while (amb.length < want) amb.push(newAmb());
    amb.length = want;
  }
  const fieldRect = () => { try { const r = field.getBoundingClientRect(); return r.width > 40 && r.height > 30 ? r : { left: W * .1, top: H * .72, width: W * .8, height: H * .22 }; } catch (e) { return { left: 0, top: H * .7, width: W, height: H * .25 }; } };
  function slot(n) {
    const r = fieldRect(), padX = Math.min(70, r.width * .08), top = r.top + 24, bot = r.top + r.height - 46;
    if (n.you) return { x: r.left + r.width / 2, y: top + (bot - top) * .55 };
    return { x: r.left + padX + n.sx * (r.width - 2 * padX), y: top + n.sy * Math.max(0, bot - top) };
  }
  function ring(x, y, gold) { rings.push({ x, y, t: 0, gold }); }
  function setPeople(list) {
    const now = performance.now(), keep = new Set();
    (list || []).slice(0, MAX_NODES).forEach(p => {
      keep.add(p.id);
      let n = ppl.get(p.id);
      if (!n) {
        n = { id: p.id, sx: hash(p.id), sy: hash2(p.id), born: now, gone: 0, vx: 0, vy: 0 };
        Object.assign(n, p); const s = slot(n);
        n.x = s.x + (Math.random() - .5) * 60; n.y = s.y - 40 - Math.random() * 30;
        ppl.set(p.id, n);
        if (!first) { ring(s.x, s.y, p.you); for (let k = 0; k < 5; k++) pulses.push({ ax: s.x, ay: s.y, bx: s.x + Math.cos(k * 1.256) * 160, by: s.y + Math.sin(k * 1.256) * 90, t: 0, sp: .9 + Math.random() * .5, gold: true }); }
      } else { n.name = p.name; n.city = p.city; n.you = p.you; n.gone = 0; }
    });
    for (const n of ppl.values()) if (!keep.has(n.id) && !n.gone) n.gone = now;
    /* even spread by arrival order: the golden-ratio walk never stacks two people in one spot */
    let k = 0;
    (list || []).slice(0, MAX_NODES).forEach(p => { const n = ppl.get(p.id); if (!n || n.you) return; n.sx = (0.5 + (k + 1) * 0.618034) % 1; n.sy = (0.15 + k * 0.381966) % 1; k++; });
    first = false;
  }
  function converge() { if (!conv) conv = { t0: performance.now() }; }
  function step(now) {
    if (stopped) return;
    raf = requestAnimationFrame(step);
    ctx.clearRect(0, 0, W, H);
    const cp = conv ? Math.min(1, (now - conv.t0) / 1400) : 0, ce = cp * cp * cp, cx = W / 2, cy = H / 2;
    /* ambient neurons */
    for (const a of amb) {
      a.x += a.vx * SPEED; a.y += a.vy * SPEED;
      if (a.x < -20) a.x = W + 20; if (a.x > W + 20) a.x = -20; if (a.y < -20) a.y = H + 20; if (a.y > H + 20) a.y = -20;
      a.dx = a.x + (cx - a.x) * ce; a.dy = a.y + (cy - a.y) * ce;
    }
    /* people: spring to their slot, push apart, drift */
    const list = [...ppl.values()];
    for (const n of list) {
      const s = slot(n), wob = reduced ? 0 : 6;
      const tx = s.x + Math.sin(now / 2400 + n.sx * 9) * wob, ty = s.y + Math.cos(now / 2900 + n.sy * 9) * wob;
      n.vx += (tx - n.x) * .012; n.vy += (ty - n.y) * .012;
      for (const m of list) { if (m === n) continue; const dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy; if (d2 < 74 * 74 && d2 > .01) { const f = (74 * 74 - d2) / (74 * 74) * .6; const d = Math.sqrt(d2); n.vx += dx / d * f; n.vy += dy / d * f; } }
      n.vx *= .86; n.vy *= .86; n.x += n.vx; n.y += n.vy;
      n.dx = n.x + (cx - n.x) * ce; n.dy = n.y + (cy - n.y) * ce;
      const age = (now - n.born) / 700, fade = n.gone ? 1 - (now - n.gone) / 600 : 1;
      n.a = Math.max(0, Math.min(1, age) * fade);
      if (n.gone && fade <= 0) ppl.delete(n.id);
    }
    /* links (quieter behind the headline and the question card, where people read) */
    const quiet = (x, y) => (W > 860 && x < W * .43 && y < H * .78) ? .4 : 1;
    const D = Math.min(170, Math.max(110, W / 10)), cand = [], boost = 1 + 2.4 * cp;
    ctx.lineWidth = 1;
    for (let i = 0; i < amb.length; i++) {
      const a = amb[i];
      for (let j = i + 1; j < amb.length; j++) {
        const b = amb[j], dx = a.dx - b.dx, dy = a.dy - b.dy, d2 = dx * dx + dy * dy;
        if (d2 > D * D) continue;
        const al = (1 - Math.sqrt(d2) / D) * .2 * boost * Math.min(quiet(a.dx, a.dy), quiet(b.dx, b.dy));
        ctx.strokeStyle = 'rgba(120,150,255,' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.dx, a.dy); ctx.lineTo(b.dx, b.dy); ctx.stroke();
        if (al > .09 && quiet(a.dx, a.dy) === 1 && quiet(b.dx, b.dy) === 1) cand.push([a, b]);
      }
    }
    for (const n of ppl.values()) {
      let k = 0;
      for (const a of amb) { const dx = n.dx - a.dx, dy = n.dy - a.dy; if (dx * dx + dy * dy < 200 * 200 && k < 3) { k++; ctx.strokeStyle = 'rgba(253,201,33,' + (.16 * n.a * boost).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(n.dx, n.dy); ctx.lineTo(a.dx, a.dy); ctx.stroke(); cand.push([n, a], [n, a]); } }
      for (const m of ppl.values()) { if (m.id <= n.id) continue; const dx = n.dx - m.dx, dy = n.dy - m.dy, d2 = dx * dx + dy * dy; if (d2 < 260 * 260) { ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - Math.sqrt(d2) / 260) * .2 * Math.min(n.a, m.a) * boost).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(n.dx, n.dy); ctx.lineTo(m.dx, m.dy); ctx.stroke(); cand.push([n, m]); } }
    }
    /* signals */
    const every = reduced ? 900 : 120;
    if (cand.length && now - lastSpawn > every && pulses.length < 60) {
      lastSpawn = now; const [a, b] = cand[(Math.random() * cand.length) | 0];
      pulses.push({ a, b, t: 0, sp: .5 + Math.random() * .7, gold: Math.random() < .55 });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]; p.t += .012 * p.sp * (reduced ? .5 : 1) * (1 + 3 * cp);
      if (p.t >= 1) { pulses.splice(i, 1); continue; }
      const ax = p.a ? p.a.dx : p.ax, ay = p.a ? p.a.dy : p.ay, bx = p.b ? p.b.dx : p.bx, by = p.b ? p.b.dy : p.by;
      const x = ax + (bx - ax) * p.t, y = ay + (by - ay) * p.t, al = Math.sin(p.t * Math.PI);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, p.gold ? 'rgba(253,201,33,' + al + ')' : 'rgba(190,210,255,' + al + ')'); g.addColorStop(1, 'rgba(253,201,33,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (al * .9).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 6.283); ctx.fill();
    }
    /* ambient dots on top of their links */
    for (const a of amb) { const tw = (.45 + .35 * Math.sin(now / 900 + a.tw)) * quiet(a.dx, a.dy); ctx.fillStyle = 'rgba(190,206,255,' + tw.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(a.dx, a.dy, a.r, 0, 6.283); ctx.fill(); }
    /* arrival rings */
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += reduced ? .02 : .014;
      if (r.t >= 1) { rings.splice(i, 1); continue; }
      for (const k of [0, .3]) { const t = r.t - k; if (t <= 0) continue; ctx.strokeStyle = (r.gold ? 'rgba(253,201,33,' : 'rgba(170,195,255,') + ((1 - t) * .8).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, 18 + t * 70, 0, 6.283); ctx.stroke(); }
    }
    /* the people */
    const small = W < 640;
    for (const n of ppl.values()) {
      if (n.a <= 0) continue;
      const R = (n.you ? 20 : 15) * (small ? .85 : 1);
      ctx.globalAlpha = n.a * (1 - ce * .4);
      const halo = ctx.createRadialGradient(n.dx, n.dy, R * .6, n.dx, n.dy, R * 2.6);
      halo.addColorStop(0, n.you ? 'rgba(253,201,33,.32)' : 'rgba(80,120,255,.28)'); halo.addColorStop(1, 'rgba(4,18,58,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(n.dx, n.dy, R * 2.6, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#0b1f55'; ctx.beginPath(); ctx.arc(n.dx, n.dy, R, 0, 6.283); ctx.fill();
      ctx.lineWidth = n.you ? 2.5 : 1.6; ctx.strokeStyle = n.you ? '#fdc921' : 'rgba(170,195,255,.9)'; ctx.stroke();
      ctx.fillStyle = '#fcfdff'; ctx.font = '700 ' + Math.round(R * .78) + 'px "Space Grotesk",Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(initials(n.name), n.dx, n.dy + .5);
      ctx.font = '600 ' + (small ? 11.5 : 13) + 'px Inter,sans-serif'; ctx.textBaseline = 'top';
      const label = n.you ? 'You' : n.name;
      const lw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(4,18,58,.78)'; roundRect(ctx, n.dx - lw / 2, n.dy + R + 6, lw, small ? 19 : 21, 10); ctx.fill();
      ctx.fillStyle = n.you ? '#fdc921' : 'rgba(252,253,255,.95)'; ctx.fillText(label, n.dx, n.dy + R + (small ? 9.5 : 10));
      ctx.globalAlpha = 1;
    }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  resize();
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  let ro = null; try { ro = new ResizeObserver(() => { if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize(); }); ro.observe(canvas); } catch (e) {}
  raf = requestAnimationFrame(step);
  return { setPeople, converge, stop() { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); try { if (ro) ro.disconnect(); } catch (e) {} } };
}

/* ---------- 1. the guest's lobby ----------
   o: { sb, user, state (ea_room_state), name (the person's display name), host (photo + name for the host card),
        pollState() → fresh ea_room_state | null, onAdmit() → mount the class, onDeadLink(), preview (bool: Nelson's
        look at it — no presence, never admits) }
   Returns { stop() }. */
export async function mountLobby(o) {
  await ensureCss();
  const { sb, user, preview } = o;
  let state = o.state || {};
  const uid = user && user.id ? user.id : 'preview';
  const roomKey = roomKeyOf(state.id);
  const reduced = reducedMotion();
  const myName = shortName(o.name) || 'You';
  let isLive = !!state.is_live, host = { seen: false, open: false, live: false }, guests = [], phase = 'wait', admitted = false, stopped = false;
  let mountedAt = Date.now(), subscribedAt = 0, channelOn = null, offAt = 0, liveAt = state.is_live ? Date.now() : 0, lastHost = null, lastHostAt = 0;
  /* the harness shortens the waits; nothing else sets these */
  const graceMs = (typeof window !== 'undefined' && window.__lobbyGraceMs) || GRACE_MS, noChannelMs = (typeof window !== 'undefined' && window.__lobbyNoChannelMs) || NO_CHANNEL_MS, hostGoneMs = (typeof window !== 'undefined' && window.__lobbyHostGoneMs) || HOST_GONE_MS;
  let city = '', answer = '', hadRow = false;
  const hostName = state.host_name || 'Nelson Taylor';
  const question = (typeof state.warmup_q === 'string' && state.warmup_q.trim()) ? state.warmup_q.trim().slice(0, 200) : ROOM_DEFAULT_QUESTION;

  const root = el(`<div class="lb" data-phase="wait" role="main">
    <canvas class="lb-net" aria-hidden="true"></canvas>
    <div class="lb-inner">
      <header class="lb-top">
        <a class="lb-brand" href="/" aria-label="Taylormade Academy home"><img src="/assets/logo-mark.webp" alt="" width="40" height="40"><span>Taylormade <b>Academy</b></span></a>
        <p class="lb-state" role="status" aria-live="polite"><b class="lb-state-t"></b></p>
        <p class="lb-clock"><b class="lb-time"></b><span>your time</span></p>
      </header>
      <div class="lb-main">
        <section class="lb-left">
          <p class="lb-kicker">${escHtml(state.title || 'Taylormade Academy')}</p>
          <h1 class="lb-h"></h1>
          <p class="lb-sub"></p>
          <p class="lb-starts" hidden></p>
          <div class="lb-host"><img src="/assets/agent-nelson-sm.webp" alt="" width="52" height="80"><div><span>Your host</span><b>${escHtml(hostName)}</b><em class="lb-host-on"></em></div></div>
          <form class="lb-warm" autocomplete="off">
            <p class="lb-warm-q">${escHtml(question)}</p>
            <div class="lb-warm-row">
              <label class="lb-warm-al"><span class="vh">Your answer</span><input class="lb-warm-a" type="text" maxlength="${ANSWER_MAX}" placeholder="Type your answer"></label>
              <label class="lb-warm-cityl"><span class="vh">Where are you joining from?</span><input class="lb-warm-c" type="text" maxlength="${CITY_MAX}" placeholder="Your city" autocomplete="address-level2"></label>
              <button type="submit" class="lb-btn gold lb-warm-go">Send</button>
            </div>
            <p class="lb-warm-said" role="status">Nelson sees every answer when the class starts.</p>
          </form>
        </section>
        <section class="lb-right" aria-label="AI in ten seconds">
          <div class="lb-screen">
            <div class="lb-screen-top"><span>AI in ten seconds</span><span class="lb-screen-n"></span></div>
            <div class="lb-stack">${LESSONS.map(l => `<article class="lb-vig" data-v="${l.v}"><h2 class="lb-vh">${markU(l.h)}</h2><div class="lb-demo">${lessonDemo(l.v)}</div><p class="lb-why">${escHtml(l.why)}</p></article>`).join('')}</div>
            <div class="lb-prog" aria-hidden="true"><i></i></div>
            <div class="lb-nav"><button type="button" class="lb-navb" data-d="-1" aria-label="Previous lesson">‹</button><button type="button" class="lb-navb lb-pause" aria-label="Pause the lessons" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3" width="3" height="10" rx="1"/><rect x="9.5" y="3" width="3" height="10" rx="1"/></svg></button><button type="button" class="lb-navb" data-d="1" aria-label="Next lesson">›</button></div>
          </div>
          <div class="lb-cam">
            <button type="button" class="lb-btn ghost lb-cam-b">Check my camera</button>
            <div class="lb-cam-v" hidden><video muted playsinline autoplay></video></div>
            <p class="lb-cam-s">Optional. Nothing is shared until you’re in the class.</p>
          </div>
        </section>
      </div>
      <footer class="lb-crowd">
        <div class="lb-crowd-k"><b class="lb-count">1</b><span class="lb-crowd-t"></span><span class="lb-arrive" aria-hidden="true"></span><span class="lb-cities"></span></div>
        <div class="lb-field" aria-hidden="true"></div>
        <p class="vh lb-sr" aria-live="polite"></p>
      </footer>
    </div>
    <div class="lb-flash" aria-hidden="true"></div>
  </div>`);
  (o.mountEl || document.body).appendChild(root);
  document.body.classList.add('in-lobby');
  try { return await runLobby(); }
  catch (e) { try { root.remove(); } catch (x) {} document.body.classList.remove('in-lobby'); throw e; }
  async function runLobby() {
  const q = (s) => root.querySelector(s);

  /* the clock */
  const clock = () => { try { q('.lb-time').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) {} };
  clock();
  const startsEl = q('.lb-starts');
  const paintStarts = () => { const s = isLive ? '' : startsLine(state.next_at, Date.now()); startsEl.textContent = s; startsEl.hidden = !s; };
  paintStarts();

  /* the words */
  function paintPhase() {
    const c = phaseCopy(phase, hostName);
    root.dataset.phase = phase;
    q('.lb-state-t').textContent = c.state;
    q('.lb-h').innerHTML = markU(c.h);
    q('.lb-sub').textContent = c.sub;
    q('.lb-host-on').textContent = phase === 'wait' ? '' : phase === 'hold' ? 'is in the room now' : 'is bringing you in';
    paintStarts();
  }
  paintPhase();

  /* the network */
  const net = makeNet(q('.lb-net'), q('.lb-field'), { reduced });
  let lastIds = new Set();
  function paintCrowd() {
    const all = guests.some(g => g.you) ? guests : [{ id: uid, name: myName, city, at: mountedAt, you: true }, ...guests];
    net.setPeople(all.map(g => ({ id: g.id, name: g.you ? myName : g.name, city: g.city, you: g.you })));
    q('.lb-count').textContent = String(all.length);
    q('.lb-crowd-t').textContent = crowdLine(all.length);
    const cl = citiesLine(all); q('.lb-cities').textContent = cl; q('.lb-cities').hidden = !cl;
    q('.lb-sr').textContent = namesLine(all.filter(g => !g.you), 8) ? 'Here with you: ' + namesLine(all.filter(g => !g.you), 8) : '';
    /* a toast for each new arrival after the first paint */
    const ids = new Set(all.map(g => g.id));
    if (lastIds.size) { const fresh = all.filter(g => !lastIds.has(g.id) && !g.you); if (fresh.length) toast(fresh.length === 1 ? fresh[0].name + ' just arrived' + (fresh[0].city ? ' from ' + fresh[0].city : '') : fresh.length + ' people just arrived'); }
    lastIds = ids;
  }
  let toastTimer = null;
  function toast(text) { const t = q('.lb-arrive'); t.textContent = text; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3600); }
  paintCrowd();

  /* the lessons */
  const screen = q('.lb-screen'), vigs = [...root.querySelectorAll('.lb-vig')];
  let gsap = null, li = -1, tl = null, next = null, prog = null;
  function showLesson(n) {
    if (stopped) return;
    clearTimeout(next);
    const prev = vigs[li]; li = (n + vigs.length) % vigs.length; const cur = vigs[li];
    q('.lb-screen-n').textContent = (li + 1) + ' of ' + vigs.length;
    if (!gsap) { vigs.forEach(v => v.classList.toggle('on', v === cur)); if (!paused) next = setTimeout(() => showLesson(li + 1), 12000); return; }
    if (tl) tl.kill();
    if (prev && prev !== cur) gsap.to(prev, { autoAlpha: 0, y: -10, duration: .35, ease: 'power2.in', onComplete: () => prev.classList.remove('on') });
    cur.classList.add('on');
    gsap.set(cur, { autoAlpha: 0, y: 12 });
    tl = lessonTimeline(gsap, cur, cur.dataset.v);
    const dur = Math.max(9, tl.duration() + 3.2);
    /* reduced motion: the finished frame, no choreography */
    gsap.to(cur, { autoAlpha: 1, y: 0, duration: reduced ? .2 : .5, delay: prev && prev !== cur && !reduced ? .3 : 0, ease: 'expo.out', onStart: () => { if (tl) { if (reduced) tl.progress(1); else tl.play(0); } } });
    if (prog) prog.kill();
    const bar = q('.lb-prog i'); gsap.set(bar, { scaleX: 0 }); prog = gsap.to(bar, { scaleX: 1, duration: dur, ease: 'none', paused });
    if (!paused) next = setTimeout(() => showLesson(li + 1), dur * 1000);
    curDur = dur;
  }
  /* the lessons move on their own; Pause holds the one on screen (WCAG 2.2.2), the arrows step by hand */
  let paused = false, curDur = 12;
  const pauseBtn = q('.lb-pause');
  function setPaused(on) {
    paused = on; pauseBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); pauseBtn.setAttribute('aria-label', on ? 'Play the lessons' : 'Pause the lessons');
    pauseBtn.innerHTML = on ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z"/></svg>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3" width="3" height="10" rx="1"/><rect x="9.5" y="3" width="3" height="10" rx="1"/></svg>';
    clearTimeout(next);
    if (on) { if (prog) prog.pause(); }
    else if (prog) { prog.resume(); const left = Math.max(1, (1 - prog.progress()) * curDur); next = setTimeout(() => showLesson(li + 1), left * 1000); }
    else next = setTimeout(() => showLesson(li + 1), 12000);
  }
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  root.querySelectorAll('.lb-navb[data-d]').forEach(b => b.addEventListener('click', () => showLesson(li + Number(b.dataset.d))));
  loadGsap().then(g => { if (stopped) return; gsap = g; if (gsap) gsap.defaults({ lazy: false }); showLesson(0); });

  /* the question of the day — the same row the old waiting screen wrote (ea_class_warmups), so Nelson's Warm-up
     answers tab in the room still lists it */
  const ain = q('.lb-warm-a'), cin = q('.lb-warm-c'), said = q('.lb-warm-said'), goBtn = q('.lb-warm-go');
  async function loadMine() {
    if (preview || !sb) return;
    try {
      const { data } = await sb.from('ea_class_warmups').select('answer, city').eq('room_key', roomKey).eq('user_id', uid).maybeSingle();
      if (data) { hadRow = true; answer = data.answer || ''; city = data.city || ''; if (!ain.value) ain.value = answer; if (!cin.value) cin.value = city; said.textContent = answer ? 'Sent. Nelson sees your answer in the room.' : ''; goBtn.textContent = 'Update'; retrack(); paintCrowd(); }
    } catch (e) {}
  }
  q('.lb-warm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = ain.value.trim().slice(0, ANSWER_MAX), c = cin.value.trim().slice(0, CITY_MAX);
    if (!a && !c) { said.textContent = 'Type an answer, or your city, then tap Send.'; ain.focus(); return; }
    if (preview) { said.textContent = 'Preview: answers are not saved here.'; return; }
    goBtn.disabled = true; goBtn.textContent = 'Sending…';
    try {
      const { error } = await sb.from('ea_class_warmups').upsert({ room_key: roomKey, user_id: uid, answer: a || null, city: c || null }, { onConflict: 'room_key,user_id' });
      if (error) throw error;
      answer = a; city = c; hadRow = true; said.textContent = a ? 'Sent. Nelson sees your answer in the room.' : 'Saved. Add an answer too if you like.';
      retrack(); paintCrowd();
    } catch (err) { console.warn('[lobby] warm-up', err); said.textContent = 'That didn’t send. Check your connection and tap Send again.'; }
    finally { goBtn.disabled = false; goBtn.textContent = hadRow ? 'Update' : 'Send'; }
  });

  /* the camera check: released before the class takes the camera */
  let camStream = null;
  const camBtn = q('.lb-cam-b'), camBox = q('.lb-cam-v'), camVideo = q('.lb-cam-v video'), camSay = q('.lb-cam-s');
  const stopCam = () => { try { if (camStream) camStream.getTracks().forEach(t => t.stop()); } catch (e) {} camStream = null; camVideo.srcObject = null; camBox.hidden = true; camBtn.textContent = 'Check my camera'; };
  camBtn.addEventListener('click', async () => {
    if (camStream) { stopCam(); camSay.textContent = 'Camera off. Nothing is shared until you’re in the class.'; return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camSay.textContent = 'This browser can’t check the camera here. You can turn it on in the class.'; return; }
    camBtn.disabled = true; camBtn.textContent = 'Starting your camera…';
    try {
      const got = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (stopped || admitted) { got.getTracks().forEach(t => t.stop()); return; }   /* answered after the doors opened: never carry a camera into the class */
      camStream = got; camVideo.srcObject = camStream; camVideo.play().catch(() => {}); camBox.hidden = false; camBtn.textContent = 'Looks good! Turn it off'; camSay.textContent = 'Only you can see this. It turns off when you go into the class.'; }
    catch (e) { camBtn.textContent = 'Check my camera'; camSay.textContent = 'The camera didn’t start. Allow the camera for taylormadeacademy.com, then tap again.'; }
    camBtn.disabled = false;
  });

  /* attendance: the lobby counts as waiting, like the old waiting screen (ea_class_presence) */
  let beat = null;
  if (!preview && sb) {
    try { const pm = await import('/js/rtk-presence.js' + verOf()); if (pm && pm.startBeating) beat = pm.startBeating(sb, roomKey, 'waiting', pm.deviceWord(navigator.userAgent)); } catch (e) {}
  }

  /* the doors */
  const meta = () => ({ role: 'guest', name: myName, city: cityWord(city), at: mountedAt });
  const chan = preview ? null : lobbyChannel(sb, state.id, uid, {
    onSync(ps) {
      const r = readPresence(ps, uid);
      const wasLive = host.live;
      host = r.host; guests = r.guests;
      if (host.seen) { lastHost = host; lastHostAt = Date.now(); }
      paintCrowd();
      if (host.live && !wasLive && !isLive) refresh();   /* Nelson just started: ask the server now, not in 10 s */
      evaluate();
    },
    onStatus(s) { const was = channelOn; channelOn = s === 'on'; if (channelOn && !subscribedAt) subscribedAt = Date.now(); if (!channelOn && was !== false) offAt = Date.now(); evaluate(); },
  });
  function retrack() { if (chan) chan.retrack(meta()); }
  if (chan) chan.start(meta);
  else if (preview) {
    /* Nelson's preview: a few sample people so he sees the network move (never saved, never on the channel) */
    const sample = [['p1', 'Meme', 'Atlanta'], ['p2', 'Jamal', 'Washington'], ['p3', 'Dr. Gray', 'Houston'], ['p4', 'Billy', 'Houston'], ['p5', 'Stephania', 'Dallas'], ['p6', 'Alexis', 'Dallas'], ['p7', 'Tiana', 'Fort Worth']];
    let k = 0; const add = () => { if (stopped || k >= sample.length) return; const s = sample[k++]; guests = [...guests, { id: s[0], name: s[1], city: s[2], at: Date.now() }]; paintCrowd(); setTimeout(add, 1600 + Math.random() * 1400); };
    setTimeout(add, 1200);
  }

  async function refresh() {
    if (stopped || !o.pollState) return;
    const st = await o.pollState();
    if (stopped || !st) return;
    if (st.bad_link) { stop(); if (o.onDeadLink) o.onDeadLink(); return; }
    state = Object.assign({}, state, st);
    if (st.is_live && !isLive) liveAt = Date.now();
    isLive = !!st.is_live;
    evaluate();
  }
  function evaluate() {
    if (stopped || admitted) return;
    const now = Date.now();
    const settled = isSettled({ now, mountedAt, subscribedAt: channelOn ? subscribedAt : 0, liveAt, grace: graceMs, noChannel: noChannelMs });
    const seen = hostView({ now, channelOn, offAt, host, lastHost, lastHostAt, grace: graceMs, gone: hostGoneMs });
    let g = gate({ isLive, host: seen, settled });
    if (preview) g = (o.previewPhase || 'wait');
    if (g === 'enter') { if (!preview) admit(); return; }
    if (g !== phase) { phase = g; paintPhase(); }
  }
  async function admit() {
    if (admitted || stopped) return;
    admitted = true; phase = 'enter'; paintPhase();
    stopCam();
    if (!reduced) net.converge();
    root.classList.add('admitting');
    await new Promise(r => setTimeout(r, reduced ? 500 : 1500));
    if (stopped) return;
    stop();
    if (o.onAdmit) o.onAdmit();
  }
  const tick = setInterval(() => { clock(); evaluate(); }, 1000);
  const poll = setInterval(refresh, POLL_MS);
  loadMine();
  if (preview && o.previewPhase) { phase = o.previewPhase; paintPhase(); }

  function stop() {
    if (stopped) return; stopped = true;
    clearInterval(tick); clearInterval(poll); clearTimeout(next); clearTimeout(toastTimer);
    try { if (tl) tl.kill(); if (prog) prog.kill(); } catch (e) {}
    stopCam(); net.stop();
    try { if (beat) beat.stop(); } catch (e) {}
    try { if (chan) chan.stop(); } catch (e) {}
    root.remove(); document.body.classList.remove('in-lobby');
  }
  return { stop, get phase() { return phase; } };
  }
}

/* ---------- 2. Nelson's side: hold the doors, see who is waiting, bring everyone in ----------
   hostLobby({ sb, roomId, uid, name, hold }) → { open(), setLive(b), reset(), setHold(b), on(fn), stop(),
   guests, open, live, hold, connected }. on(fn) hears every change. */
export function hostLobby({ sb, roomId, uid, name, hold }) {
  const subs = [];
  const s = { guests: [], open: store.get(openKey(roomId)) === '1', live: false, hold: hold !== false, connected: null };
  const emit = () => subs.forEach(f => { try { f(s); } catch (e) {} });
  const meta = () => ({ role: 'host', name: name || 'Nelson', doors: (s.open || !s.hold) ? 'open' : 'closed', live: s.live, at: Date.now() });
  const chan = lobbyChannel(sb, roomId, uid, {
    onSync(ps) { s.guests = readPresence(ps, uid).guests; emit(); },
    onStatus(st) { s.connected = st === 'on'; emit(); },
  });
  chan.start(meta);
  const retrack = () => { chan.retrack(meta()); emit(); };
  return {
    get guests() { return s.guests; }, get isOpen() { return s.open || !s.hold; }, get live() { return s.live; }, get hold() { return s.hold; }, get connected() { return s.connected; },
    on(fn) { subs.push(fn); fn(s); },
    open() { s.open = true; store.set(openKey(roomId), '1'); retrack(); },
    /* a fresh session (Start class) or the end of one: the doors close again */
    reset() { s.open = false; store.del(openKey(roomId)); retrack(); },
    setLive(b) { s.live = !!b; retrack(); },
    setHold(b) { s.hold = !!b; store.set(HOLD_KEY, b ? '1' : '0'); retrack(); },
    stop() { chan.stop(); },
  };
}
export function holdPref(search) {
  try { if (new URLSearchParams(search || '').get('lobby') === 'off') return false; } catch (e) {}
  return store.get(HOLD_KEY) !== '0';
}

/* the panel on Nelson's room card (before he is in the room) and the dock over the room (while he is in it) */
export function mountHostUi({ panelIn, lobby, previewHref }) {
  ensureCss();
  const panel = el(`<div class="lbh">
      <div class="lbh-top"><span class="lbh-k">The lobby</span><b class="lbh-n"></b></div>
      <p class="lbh-names"></p>
      <p class="lbh-line"></p>
      <div class="lbh-row">
        <button type="button" class="lbh-go">Bring everyone in &rarr;</button>
        <label class="lbh-hold"><input type="checkbox"> Hold people in the lobby until I bring them in</label>
        <a class="lbh-prev" href="${escHtml(previewHref)}" target="_blank" rel="noopener">See what they see</a>
      </div>
    </div>`);
  panelIn.appendChild(panel);
  const dock = el(`<div class="lbd" role="region" aria-label="The lobby" hidden>
      <div class="lbd-txt"><span class="lbd-k">The lobby</span><b class="lbd-n"></b><span class="lbd-names"></span></div>
      <button type="button" class="lbd-go">Bring everyone in &rarr;</button>
      <button type="button" class="lbd-min" aria-label="Make this smaller">–</button>
    </div>`);
  document.body.appendChild(dock);
  const hold = panel.querySelector('.lbh-hold input');
  let mini = false, openedAt = 0;
  function paint(s) {
    const n = s.guests.length, isOpen = s.open || !s.hold;
    panel.querySelector('.lbh-n').textContent = hostCount(n);
    panel.querySelector('.lbh-names').textContent = n ? namesLine(s.guests, 5) : 'People show up here the moment they open your link.';
    panel.querySelector('.lbh-line').textContent = hostDoorsLine({ live: s.live, open: s.open, hold: s.hold, connected: s.connected });
    const go = panel.querySelector('.lbh-go');
    go.hidden = isOpen || s.connected === false || !s.live; go.textContent = n ? 'Bring everyone in (' + n + ') →' : 'Open the doors →';
    hold.checked = s.hold;
    /* the dock: only while he is in the room (body.in-room) and the doors are his to open */
    const d = dock;
    d.querySelector('.lbd-n').textContent = isOpen ? 'Doors open' : hostCount(n);
    d.querySelector('.lbd-names').textContent = isOpen ? 'New arrivals walk straight in.' : (n ? namesLine(s.guests, 3) : 'Nobody waiting yet.');
    const dgo = d.querySelector('.lbd-go'); dgo.hidden = isOpen; dgo.textContent = n ? 'Bring everyone in (' + n + ') →' : 'Open the doors →';
    d.classList.toggle('open', isOpen); d.classList.toggle('mini', mini || (isOpen && Date.now() - openedAt > 6000));
    d.classList.toggle('waiting', !isOpen && n > 0);
    d.hidden = !s.live || s.connected === false || (!s.hold);
  }
  /* where the dock sits: in the free band under the room box when there is one (the room is 100dvh - 150px tall on a
     laptop, so its own bar is never covered), else over the top of the room, under its title strip */
  function place() {
    if (dock.hidden) return;
    const m = document.getElementById('rtkMount'); if (!m) return;
    const r = m.getBoundingClientRect(), h = dock.offsetHeight || 64, free = window.innerHeight - r.bottom;
    const top = free >= h + 16 ? r.bottom + (free - h) / 2 : Math.max(8, r.top + 64);
    dock.style.top = Math.round(top) + 'px'; dock.style.bottom = 'auto';
  }
  const placeTimer = setInterval(place, 1000);
  window.addEventListener('resize', place);
  lobby.on((st) => { paint(st); place(); });
  const doOpen = () => { openedAt = Date.now(); lobby.open(); setTimeout(() => paint({ guests: lobby.guests, open: true, hold: lobby.hold, live: lobby.live, connected: lobby.connected }), 6100); };
  panel.querySelector('.lbh-go').addEventListener('click', doOpen);
  dock.querySelector('.lbd-go').addEventListener('click', doOpen);
  dock.querySelector('.lbd-min').addEventListener('click', () => { mini = !mini; dock.classList.toggle('mini', mini); });
  hold.addEventListener('change', () => lobby.setHold(hold.checked));
  return { remove() { clearInterval(placeTimer); window.removeEventListener('resize', place); panel.remove(); dock.remove(); } };
}

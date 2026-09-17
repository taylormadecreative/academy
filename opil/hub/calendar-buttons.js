/* OPIL hub — "Add to calendar" (spec 2026-09-16, feature 9).
   One button on hub home that opens three choices:
     Google Calendar     → Google's subscribe-by-URL screen (the feed stays in sync when a date moves)
     Apple or Outlook    → webcal://…/ea-opil-calendar (the phone or Mac asks "Subscribe?")
     Download .ics       → a one-time copy of the schedule as a file
   The feed itself is the edge function ea-opil-calendar. Pure helpers up top (tests/opil/calendar.test.mjs
   imports them under node — nothing here touches `document` until mount() runs). */

export const FEED_URL = 'https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-opil-calendar';

/* the three links for a feed URL */
export function calendarLinks(feed = FEED_URL) {
  const webcal = String(feed).replace(/^https?:\/\//i, 'webcal://');
  return {
    google: 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal),
    webcal,
    ics: feed + '?download=1',
  };
}

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* the button + its menu (closed). Words, not icons; every choice says what happens. */
export function buttonsHTML(links, id = 'cal') {
  return `<div class="calb" data-calb>
  <button type="button" class="calb-btn" aria-haspopup="true" aria-expanded="false" aria-controls="${escAttr(id)}-menu">Add to calendar</button>
  <div class="calb-menu" id="${escAttr(id)}-menu" role="menu" hidden>
    <a class="calb-item" role="menuitem" href="${escAttr(links.google)}" target="_blank" rel="noopener"><b>Google Calendar</b><span>Opens Google and asks to add the OPIL calendar.</span></a>
    <a class="calb-item" role="menuitem" data-webcal href="${escAttr(links.webcal)}"><b>Apple or Outlook</b><span>Your phone or computer asks to subscribe. If nothing opens, use Download .ics below.</span></a>
    <a class="calb-item" role="menuitem" href="${escAttr(links.ics)}" target="_blank" rel="noopener"><b>Download .ics</b><span>A one-time copy of every date as a file.</span></a>
    <p class="calb-fine" data-calb-note hidden role="status">Nothing opened — use Download .ics.</p>
    <p class="calb-fine">Google, Apple and Outlook keep the calendar up to date when a class moves. The download is a snapshot.</p>
  </div>
</div>`;
}

const CSS = `
.calb{position:relative;display:inline-block}
.calb-btn{font:inherit;font-weight:600;font-size:12.5px;color:var(--blue,#0b40e0);background:var(--blue-soft,#e8eefc);border:0;border-radius:980px;padding:8px 14px;min-height:36px;cursor:pointer}
.calb-btn:hover{filter:brightness(.97)}
.calb-btn:focus-visible{outline:2px solid var(--blue,#0b40e0);outline-offset:2px}
.calb-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:20;width:min(320px,calc(100vw - 32px));background:#fff;border:1px solid var(--hair,#e4e9f1);border-radius:16px;box-shadow:0 12px 32px rgba(4,18,58,.14);padding:8px}
.calb-item{display:block;padding:12px 14px;min-height:48px;border-radius:12px;text-decoration:none;color:var(--ink,#0a1733)}
.calb-item:hover,.calb-item:focus-visible{background:var(--bg-soft,#f5f7fc);outline:none}
.calb-item b{display:block;font-size:14px;color:var(--ink,#0a1733)}
.calb-item span{display:block;font-size:12.5px;color:var(--muted,#5d6b84);margin-top:2px}
.calb-fine{margin:6px 14px 8px;font-size:11.5px;line-height:1.5;color:var(--muted-ink,#94a3b8)}
.calb-fine[data-calb-note]{color:var(--ink,#0a1733);font-weight:600}
/* phones: the button sits at the right end of a card header, so a panel hung off its left edge would run
   off screen. Pin the panel to the viewport instead (16px each side); mount() sets its top from the button. */
@media (max-width:720px){.calb-menu{position:fixed;left:16px;right:16px;width:auto;top:auto}}
`;

export const WEBCAL_WAIT_MS = 1500;

/* resolves true when the page lost focus or was hidden (something opened) within `ms`, false when it never did */
export function watchHandoff(ms, win = typeof window !== 'undefined' ? window : null, doc = typeof document !== 'undefined' ? document : null) {
  return new Promise((resolve) => {
    if (!win || !doc) { resolve(true); return; }
    let done = false;
    const finish = (opened) => { if (done) return; done = true; win.removeEventListener('blur', onAway); doc.removeEventListener('visibilitychange', onHide); resolve(opened); };
    const onAway = () => finish(true);
    const onHide = () => { if (doc.visibilityState === 'hidden') finish(true); };
    win.addEventListener('blur', onAway);
    doc.addEventListener('visibilitychange', onHide);
    win.setTimeout(() => finish(false), ms);
  });
}

function ensureStyle() {
  if (document.getElementById('calb-style')) return;
  const st = document.createElement('style'); st.id = 'calb-style'; st.textContent = CSS;
  document.head.appendChild(st);
}

/* mount(el): el is any empty element (a <span> in a card header). Returns { destroy }. */
export function mount(el, opts = {}) {
  if (!el) return { destroy() {} };
  try {
    ensureStyle();
    const links = calendarLinks(opts.feed || FEED_URL);
    el.innerHTML = buttonsHTML(links, opts.id || 'cal');
    const btn = el.querySelector('.calb-btn'), menu = el.querySelector('.calb-menu'), note = el.querySelector('[data-calb-note]');
    const phone = () => window.matchMedia && window.matchMedia('(max-width:720px)').matches;
    const place = () => { menu.style.top = phone() ? Math.round(btn.getBoundingClientRect().bottom + 8) + 'px' : ''; };
    const setOpen = (open) => {
      menu.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) place(); else note.hidden = true;
    };
    const onDoc = (ev) => { if (!el.contains(ev.target)) setOpen(false); };
    const onKey = (ev) => { if (ev.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } };
    const onMove = () => { if (!menu.hidden) setOpen(false); };   /* a pinned panel must not float away from its button */
    btn.addEventListener('click', () => { setOpen(menu.hidden); if (!menu.hidden) menu.querySelector('a')?.focus({ preventScroll: true }); });
    menu.addEventListener('click', (ev) => {
      const a = ev.target.closest('a'); if (!a) return;
      if (!a.hasAttribute('data-webcal')) { setTimeout(() => setOpen(false), 150); return; }
      /* webcal: is a bare protocol hand-off — a computer with nothing registered for it does nothing at all.
         When the page never loses focus within a moment and a half, say so and leave the menu open on the download. */
      watchHandoff(WEBCAL_WAIT_MS).then((opened) => {
        if (opened) { setOpen(false); return; }
        note.hidden = false;
        menu.querySelector('a[href$="download=1"]')?.focus({ preventScroll: true });
      });
    });
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return { destroy() { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onMove); window.removeEventListener('resize', onMove); el.innerHTML = ''; } };
  } catch (e) {
    console.warn('[calendar-buttons]', e);
    /* the plain link still works when the menu cannot be built */
    el.innerHTML = `<a href="${escAttr(calendarLinks(opts.feed || FEED_URL).ics)}" style="font-size:12px;font-weight:600;color:var(--blue,#0b40e0)">Add to calendar</a>`;
    return { destroy() { el.innerHTML = ''; } };
  }
}

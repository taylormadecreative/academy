// stub-room-v2.js — records the call, paints a marker, and lets the harness fire onOpened / onState.
// It models the CONTRACT of js/rtk-room-v2.js as of 9/15 (nobody ends a class by accident):
//   leave()            → the page hears ('left', m, 'left') once; nothing else happens
//   end()              → the page hears ('ended', m, 'ended') once (the real module removes everyone first)
//   the kit's roomLeft → drop(state): 'left' / 'kicked' / 'ended' keep their word; anything else is a DROP —
//                        the Reconnecting strip shows, the page hears ('reconnecting', m, 'dropped'), and the
//                        harness then says rejoinOk() (same meeting, ('joined', m, 'rejoined'), no card) or
//                        rejoinFail() (('left', m, 'dropped'))
//   the bar            → the same for host and guest: mic, camera, Chat & people, Share my screen, Effects,
//                        Captions, Tools, Leave — no "Need help?"
//   the mount promise  → like the real module, a host or student mount resolves only once the person is IN
//                        (the harness's state('joined')); until then the page's button must read Entering…
//   the target         → a room ({ kind:'room', … }) or, for the OPIL page, o.session with OPIL's words
export async function mountRoomV2(o) {
  const target = o.target || { kind: 'opil', title: o.session ? o.session.title : '', words: { thing: 'class', teaching: 'is teaching', replayFor: 'your students', waiting: null } };
  window.__mount = { mode: o.mode, target, facilitator: o.facilitator, meetingId: 'm-new' };
  o.mountEl.classList.add('r2host');
  /* the brand mark, as the real module draws it: first child of .r2-join-left, only when the target brought one */
  const brand = target.logo ? '<img class="r2-brand" src="' + target.logo.src + '" alt="' + target.logo.alt + '">' : '';
  o.mountEl.innerHTML = '<section class="r2-join"><div class="r2-join-left">' + brand + '<div class="r2-kicker">You’re in the right place.</div><h2 class="r2-title">' + target.title + '</h2><p class="r2-line">' + (o.mode === 'waiting' ? target.words.waiting : 'preview') + '</p>' + (o.mode === 'waiting' ? '<div class="r2-wait"><b>x</b></div>' : '<div class="r2-preview"></div>') + '</div></section>';
  /* the real module adds these before it paints anything — in waiting mode too (js/rtk-room-v2.js, before the
     `mode === 'waiting'` branch), so the page chrome above the room is already gone while a guest waits */
  document.body.classList.add('in-room', 'in-room-v2');
  const host = o.mode === 'host';
  /* in class, as the real module paints it: the what's-happening-now strip heads the room — the strip mark
     (target.mark, else the logo), the dot, the status line, the host's Recording tally. A guest's status line
     carries the recording notice; the host sees the tally instead (js/rtk-room-v2.js setNow). The bar is the
     same for everyone; the Reconnecting strip sits over the stage, hidden until a drop. */
  const inClass = () => {
    const w = target.words, mark = target.mark || target.logo;
    const strip = mark ? '<img class="r2-brand r2-brand-strip" src="' + mark.src + '" alt="' + mark.alt + '">' : '';
    const line = o.facilitator + ' ' + w.teaching + ': ' + target.title + (host ? '' : ' · This ' + w.thing + ' is being recorded');
    o.mountEl.innerHTML = '<div class="r2"><div class="r2-now">' + strip + '<span class="r2-dot"></span><span class="r2-nowtxt">' + line + '</span><span class="r2-rec"' + (host ? '' : ' hidden') + '>Recording <b class="r2-rectime">00:00:00</b> · saves automatically for ' + w.replayFor + '</span></div>' +
      '<div class="r2-main"><div class="r2-stage"><div class="r2-reconnect" role="status" hidden></div></div></div>' +
      '<div class="r2-bar"><div class="r2-chips"><button type="button" class="r2-chip" data-t="mic"><b>You’re muted</b><span>Tap to unmute</span></button><button type="button" class="r2-chip" data-t="cam"><b>Camera is off</b><span>Tap to turn on</span></button></div><div class="r2-primary"></div>' +
      '<div class="r2-right"><button type="button" class="r2-btn r2-open">Chat &amp; people</button><button type="button" class="r2-btn r2-share" aria-pressed="false">Share my screen</button><button type="button" class="r2-btn r2-fx-btn">Effects</button><button type="button" class="r2-btn r2-cc-btn" aria-pressed="false">Captions</button><button type="button" class="r2-btn r2-tools">Tools</button><button type="button" class="r2-leave">Leave</button></div></div></div>';
  };
  let gone = false, dropping = false;
  let inResolve = null; const isIn = new Promise((r) => { inResolve = r; });   /* resolved by state('joined') — the mount returns then */
  const tell = (st, reason) => { if (gone) return; if (st === 'left' || st === 'ended') gone = true; o.onState(st, null, reason); if (st === 'joined') inResolve(); };
  const leave = () => { if (gone || dropping) return; document.body.classList.remove('in-room', 'in-room-v2'); o.mountEl.innerHTML = ''; tell('left', 'left'); };
  const end = () => { if (gone) return; document.body.classList.remove('in-room', 'in-room-v2'); o.mountEl.innerHTML = ''; tell('ended', 'ended'); };
  const strip = (text) => { const el = o.mountEl.querySelector('.r2-reconnect'); if (!el) return; if (text) { el.textContent = text; el.hidden = false; } else { el.hidden = true; el.textContent = ''; } };
  window.__room = {
    meetingId: 'm-new',
    open: async (id) => { if (o.onOpened) await o.onOpened(id); },
    /* the harness drives the kit's own states: 'joined' paints the class; anything else is a roomLeft state */
    state: (s, reason) => {
      if (s === 'joined') { inClass(); tell('joined'); return; }
      if (s === 'left') return leave();
      if (s === 'kicked') { document.body.classList.remove('in-room', 'in-room-v2'); o.mountEl.innerHTML = ''; tell('left', 'kicked'); return; }
      if (s === 'ended') return end();
      /* a drop: the room stays mounted, the strip shows, the page is told and must do NOTHING */
      if (gone || dropping) return; dropping = true; strip('Reconnecting…'); tell('reconnecting', 'dropped');
    },
    rejoinOk: () => { if (!dropping) return; dropping = false; strip(null); tell('joined', 'rejoined'); },
    rejoinFail: () => { if (!dropping) return; dropping = false; strip(null); document.body.classList.remove('in-room', 'in-room-v2'); o.mountEl.innerHTML = ''; tell('left', 'dropped'); },
    leave, end,
  };
  if (o.mode === 'host' && o.onOpened) {
    /* the real join function stamps is_live + live_since on a ROOM row with the server clock the moment the
       meeting exists — before onOpened runs; the room page itself writes nothing on Start. (An OPIL session
       row is flipped by the page inside onOpened.) */
    if (window.__db && window.__db.room) { window.__db.room.is_live = true; window.__db.state.is_live = true; }
    await o.onOpened('m-new');
  }
  /* everyone presses Enter themselves: the real module resolves once they are in — so does this */
  if (o.mode === 'host' || o.mode === 'student') await isIn;
  return { meetingId: 'm-new', host, leave: async () => leave(), end: async () => end(), setRecording: (on) => { window.__rec = on; } };
}

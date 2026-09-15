// stub-room-v2.js — records the call, paints a marker, and lets the harness fire onOpened / onState.
export async function mountRoomV2(o) {
  window.__mount = { mode: o.mode, target: o.target, facilitator: o.facilitator };
  o.mountEl.classList.add('r2host');
  /* the brand mark, as the real module draws it: first child of .r2-join-left, only when the target brought one */
  const brand = o.target.logo ? '<img class="r2-brand" src="' + o.target.logo.src + '" alt="' + o.target.logo.alt + '">' : '';
  o.mountEl.innerHTML = '<section class="r2-join"><div class="r2-join-left">' + brand + '<div class="r2-kicker">You’re in the right place.</div><h2 class="r2-title">' + o.target.title + '</h2><p class="r2-line">' + (o.mode === 'waiting' ? o.target.words.waiting : 'preview') + '</p>' + (o.mode === 'waiting' ? '<div class="r2-wait"><b>x</b></div>' : '<div class="r2-preview"></div>') + '</div></section>';
  /* the real module adds these before it paints anything — in waiting mode too (js/rtk-room-v2.js, before the
     `mode === 'waiting'` branch), so the page chrome above the room is already gone while a guest waits */
  document.body.classList.add('in-room', 'in-room-v2');
  /* in class, as the real module paints it: the what's-happening-now strip heads the room — the strip mark
     (target.mark, else the logo), the dot, the status line, the host's Recording tally. A guest's status line
     carries the recording notice; the host sees the tally instead (js/rtk-room-v2.js setNow). */
  const inClass = () => {
    const w = o.target.words, mark = o.target.mark || o.target.logo, host = o.mode === 'host';
    const strip = mark ? '<img class="r2-brand r2-brand-strip" src="' + mark.src + '" alt="' + mark.alt + '">' : '';
    const line = o.facilitator + ' ' + w.teaching + ': ' + o.target.title + (host ? '' : ' · This ' + w.thing + ' is being recorded');
    o.mountEl.innerHTML = '<div class="r2"><div class="r2-now">' + strip + '<span class="r2-dot"></span><span class="r2-nowtxt">' + line + '</span><span class="r2-rec"' + (host ? '' : ' hidden') + '>Recording <b class="r2-rectime">00:00:00</b> · saves automatically for ' + w.replayFor + '</span></div><div class="r2-main"><div class="r2-stage"></div></div><div class="r2-bar"></div></div>';
  };
  window.__room = {
    open: async (id) => { if (o.onOpened) await o.onOpened(id); },
    state: (s) => { if (s === 'joined') inClass(); o.onState(s); },
    leave: () => o.onState('left'),
  };
  if (o.mode === 'host' && o.onOpened) {
    /* the real join function stamps is_live + live_since on the row with the server clock the
       moment the meeting exists — before onOpened runs. The page itself writes nothing on Start. */
    window.__db.room.is_live = true; window.__db.state.is_live = true;
    await o.onOpened('m-new');
  }
  return { meetingId: 'm-new', leave: async () => o.onState('left'), setRecording: (on) => { window.__rec = on; } };
}

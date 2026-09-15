// stub-room-v2.js — records the call, paints a marker, and lets the harness fire onOpened / onState.
export async function mountRoomV2(o) {
  window.__mount = { mode: o.mode, target: o.target, facilitator: o.facilitator };
  o.mountEl.classList.add('r2host');
  o.mountEl.innerHTML = '<section class="r2-join"><div class="r2-join-left"><div class="r2-kicker">You’re in the right place.</div><h2 class="r2-title">' + o.target.title + '</h2><p class="r2-line">' + (o.mode === 'waiting' ? o.target.words.waiting : 'preview') + '</p>' + (o.mode === 'waiting' ? '<div class="r2-wait"><b>x</b></div>' : '<div class="r2-preview"></div>') + '</div></section>';
  document.body.classList.add('in-room', 'in-room-v2');
  if (o.mode === 'waiting') document.body.classList.remove('in-room', 'in-room-v2');
  window.__room = {
    open: async (id) => { if (o.onOpened) await o.onOpened(id); },
    state: (s) => o.onState(s),
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

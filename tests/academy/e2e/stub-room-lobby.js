// tests/academy/e2e/stub-room-lobby.js — stands in for /js/rtk-room-v2.js in lobby.e2e.mjs: no video kit, just which
// mode the page asked for. A host mount flips the fake room live (what ea-rtk-join does) before onOpened.
export async function mountRoomV2(o) {
  const { mountEl, mode, onState, onOpened } = o;
  (window.__stubMounts = window.__stubMounts || []).push(mode);
  if (mode === 'waiting') { mountEl.innerHTML = '<div class="stub-wait">The old waiting screen</div>'; return { leave() { mountEl.innerHTML = ''; }, setRecording() {} }; }
  if (mode === 'host' && onOpened) { localStorage.setItem('fake-live', '1'); await onOpened('m-1'); }
  document.body.classList.add('in-room', 'in-room-v2');
  mountEl.classList.add('r2host');   /* the real module's box: 100dvh - 150px on a laptop (css/rtk-room-v2.css) */
  mountEl.innerHTML = `<div class="stub-room" data-mode="${mode}" style="height:100%;display:grid;grid-template-rows:56px 1fr 68px;background:#0a1733;color:#fff;font:600 22px Inter,sans-serif"><div style="background:#04123a;padding:16px">AI 101: Learn to talk to AI</div><div style="display:grid;place-items:center">In the class as ${mode}</div><div class="stub-bar" style="background:#0a1733;border-top:1px solid rgba(255,255,255,.1);padding:14px 16px;font-size:15px">mic · camera · Chat &amp; people · Share my screen · Tools · Leave</div></div>`;
  setTimeout(() => onState && onState('joined', {}, 'joined'), 30);
  const api = { meetingId: 'm-1', leave() { onState && onState('left', {}, 'left'); }, end() { localStorage.setItem('fake-live', '0'); onState && onState('ended', {}, 'ended'); }, setRecording() {} };
  window.__stubEnd = () => api.end();   /* End the session for everyone, from Tools in the room */
  return api;
}

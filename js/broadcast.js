/* Go live from this device. The browser's camera and mic go straight to Cloudflare Stream
   over WebRTC (WHIP); viewers watch it back over WebRTC too (WHEP), under a second behind.
   Cloudflare makes neither HLS nor a recording from a browser broadcast, so the recording is
   made HERE while on air and uploaded to Stream when the broadcaster ends. Shared by /live/
   (Academy), /opil/hub/live/ and /opil/hub/admin/ (OPIL). No Cloudflare secret lives in a
   page: ea-live-publish hands out the addresses, per request, to a signed-in admin or
   facilitator. */

async function callFn(cfg, token, body) {
  const r = await fetch(cfg.FUNCTIONS_BASE + '/ea-live-publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const why = { sign_in: 'Sign in again and retry.', not_allowed: 'Your account is not allowed to broadcast this room.',
                  stream_not_configured: 'Live streaming is not set up on the server yet.',
                  recording_not_configured: 'Recording upload is not set up on the server yet.' }[d.error] || ('Server said ' + r.status + '.');
    throw new Error(why);
  }
  return d;
}

/* Where to send the picture and where viewers will watch it: { whip, whep, hls }. */
export function publishTarget(cfg, token, room, sessionNo) {
  return callFn(cfg, token, sessionNo == null ? { room } : { room, session_no: sessionNo });
}

/* Camera + mic, 720p, mirrored preview. Throws with a human message on refusal. */
export async function openCamera(previewEl) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot use the camera. Try Chrome or Safari.');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    throw new Error(e && e.name === 'NotAllowedError' ? 'Camera and microphone were blocked. Allow them in the address bar and try again.' : 'Could not open the camera: ' + (e && e.message || e));
  }
  previewEl.srcObject = stream; previewEl.muted = true; previewEl.playsInline = true;
  previewEl.play().catch(() => {});
  return stream;
}

/* WHIP/WHEP want a complete offer; give ICE a moment to finish gathering. */
function waitIce(pc) {
  return new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 2000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}
async function whipExchange(pc, url) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIce(pc);
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp });
  if (!r.ok) { pc.close(); const e = new Error('Cloudflare answered ' + r.status + '.'); e.status = r.status; throw e; }
  const resource = r.headers.get('Location');
  await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });
  return resource ? new URL(resource, url).href : null;
}

/* Broadcast: one offer, one answer, then media flows. Returns { pc, stop }. */
export async function publish(whipUrl, stream) {
  const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
  for (const track of stream.getTracks()) {
    const tr = pc.addTransceiver(track, { direction: 'sendonly' });
    /* H.264 first when the browser offers it: Safari viewers decode it in hardware. */
    if (track.kind === 'video' && tr.setCodecPreferences && RTCRtpSender.getCapabilities) {
      const codecs = RTCRtpSender.getCapabilities('video').codecs;
      const h264 = codecs.filter(c => /h264/i.test(c.mimeType)), rest = codecs.filter(c => !/h264/i.test(c.mimeType));
      if (h264.length) { try { tr.setCodecPreferences(h264.concat(rest)); } catch (e) {} }
    }
  }
  const resource = await whipExchange(pc, whipUrl);
  return {
    pc,
    stop() {
      try { pc.close(); } catch (e) {}
      stream.getTracks().forEach(t => t.stop());
      if (resource) fetch(resource, { method: 'DELETE' }).catch(() => {});
    },
  };
}

/* Watch: the viewer side of the same handshake. Cloudflare answers 409 while nobody is
   broadcasting, so callers retry on e.status === 409. */
export async function play(whepUrl, videoEl) {
  const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  const ms = new MediaStream();
  videoEl.srcObject = ms;
  pc.addEventListener('track', (ev) => ms.addTrack(ev.track));
  const resource = await whipExchange(pc, whepUrl);
  return {
    pc,
    stop() { try { pc.close(); } catch (e) {} if (resource) fetch(resource, { method: 'DELETE' }).catch(() => {}); },
  };
}

/* Is the broadcast watchable yet? A throwaway viewer handshake says so; 409 means not yet. */
export async function whepReady(whepUrl, ms = 30000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const v = document.createElement('video'); const s = await play(whepUrl, v); s.stop(); return true; }
    catch (e) { if (e.status && e.status !== 409) return false; }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

/* Record locally while on air. Stop before the tracks end, or the tail is lost. */
export function startRecorder(stream) {
  if (!window.MediaRecorder) return null;
  const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
  const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3000000, audioBitsPerSecond: 128000 } : undefined); }
  catch (e) { return null; }
  const parts = [];
  rec.addEventListener('dataavailable', (ev) => { if (ev.data && ev.data.size) parts.push(ev.data); });
  rec.start(1000);
  return {
    mime: rec.mimeType || mime,
    stop: () => new Promise((res) => {
      const done = () => res(new Blob(parts, { type: rec.mimeType || mime || 'video/webm' }));
      if (rec.state === 'inactive') return done();
      rec.addEventListener('stop', done, { once: true });
      try { rec.stop(); } catch (e) { done(); }
    }),
  };
}

/* Upload the recording straight to Cloudflare Stream, resumable, 50 MiB at a time (a
   multiple of 256 KiB, as Stream requires). The server creates the upload; the bytes never
   touch it. Returns { uid, watch, hls }. */
export async function uploadRecording(cfg, token, body, blob, onProgress) {
  const d = await callFn(cfg, token, { ...body, action: 'record', bytes: blob.size, type: blob.type });
  await tusUpload(d.uploadUrl, blob, onProgress);
  return d;
}

/* The chunk loop on its own, so it can be exercised against a real upload URL. */
export async function tusUpload(uploadUrl, blob, onProgress) {
  const d = { uploadUrl };
  const CHUNK = 50 * 1024 * 1024;
  const H = { 'Tus-Resumable': '1.0.0' };
  let offset = 0, tries = 0;
  while (offset < blob.size) {
    const end = Math.min(offset + CHUNK, blob.size);
    let r = null;
    try {
      r = await fetch(d.uploadUrl, { method: 'PATCH', headers: { ...H, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }, body: blob.slice(offset, end) });
    } catch (e) { r = null; }
    if (r && (r.status === 204 || r.status === 200)) {
      const o = Number(r.headers.get('Upload-Offset')); offset = Number.isFinite(o) && o > 0 ? o : end; tries = 0;
      if (onProgress) onProgress(offset / blob.size);
      continue;
    }
    if (++tries > 4) throw new Error('The upload kept failing' + (r ? ' (' + r.status + ')' : '') + '. Your recording is still in this tab: download it below and send it to the program team.');
    await new Promise(x => setTimeout(x, 1500 * tries));
    try { const h = await fetch(d.uploadUrl, { method: 'HEAD', headers: H }); const o = Number(h.headers.get('Upload-Offset')); if (Number.isFinite(o)) offset = o; } catch (e) {}
  }
  return true;
}

/* The on-air panel both rooms use: preview, status line, one button, a note. */
export function panelHTML(id) {
  return '<div class="bc-panel" id="' + id + '">' +
    '<video class="bc-preview" autoplay muted playsinline></video>' +
    '<div class="bc-row"><span class="bc-status"><i></i><b>Camera off</b></span><button type="button" class="bc-btn">Go live from this device</button></div>' +
    '<p class="bc-note">Your camera and microphone stream straight from this browser, and the session records here for the replay. Keep this tab open while you are on air.</p>' +
    '</div>';
}

/* Wire a panel. The page supplies its own room logic: go(watchUrl) flips the room live,
   end() flips it back, saved({uid, watch, hls}) stores the replay, title() names it. */
export function wirePanel(panel, { cfg, token, room, sessionNo, go, end, saved, title }) {
  const video = panel.querySelector('.bc-preview'), btn = panel.querySelector('.bc-btn'),
        status = panel.querySelector('.bc-status'), note = panel.querySelector('.bc-note');
  let session = null, camera = null, recorder = null, blob = null;
  const say = (label, cls) => { status.className = 'bc-status' + (cls ? ' ' + cls : ''); status.querySelector('b').textContent = label; };
  const body = sessionNo == null ? { room } : { room, session_no: sessionNo };
  const guard = (ev) => { ev.preventDefault(); ev.returnValue = ''; };   /* the browser's own "leave page?" while on air */

  async function save() {
    if (!blob || !blob.size) { say('Camera off'); btn.textContent = 'Go live from this device'; btn.disabled = false; note.textContent = 'Off air. Nothing was recorded.'; return; }
    say('Saving recording…', 'warm'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const d = await uploadRecording(cfg, token, { ...body, title: title ? title() : '' }, blob, (p) => say('Saving recording… ' + Math.round(p * 100) + '%', 'warm'));
      if (saved) await saved(d);
      blob = null;
      say('Camera off'); note.textContent = 'Off air. Recording saved; it becomes the replay once Cloudflare finishes processing it, usually within a few minutes.';
    } catch (e) {
      say('Camera off');
      const name = 'recording-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + (blob.type.includes('mp4') ? '.mp4' : '.webm');
      note.innerHTML = '';
      note.append((e && e.message) || 'Could not save the recording.', ' ');
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'bc-link'; retry.textContent = 'Retry upload';
      retry.addEventListener('click', save);
      const dl = document.createElement('a'); dl.className = 'bc-link'; dl.textContent = 'Download recording'; dl.download = name; dl.href = URL.createObjectURL(blob);
      note.append(retry, ' · ', dl);
    }
    btn.textContent = 'Go live from this device'; btn.disabled = false;
  }

  btn.addEventListener('click', async () => {
    if (session) {
      btn.disabled = true; btn.textContent = 'Ending…';
      window.removeEventListener('beforeunload', guard);
      /* recorder first, then the tracks: a stopped track ends the recorder mid-file */
      blob = recorder ? await recorder.stop() : null; recorder = null;
      session.stop(); session = null; camera = null;
      try { await end(); } catch (e) {}
      await save();
      return;
    }
    btn.disabled = true;
    try {
      say('Checking…'); btn.textContent = 'Starting…';
      const target = await publishTarget(cfg, token, room, sessionNo);
      say('Opening camera…');
      camera = await openCamera(video);
      recorder = startRecorder(camera);
      say('Connecting…');
      session = await publish(target.whip, camera);
      say('Warming up…', 'warm'); note.textContent = 'Connected. Waiting for Cloudflare to open the room to viewers, a few seconds.';
      if (!(await whepReady(target.whep))) throw new Error('Cloudflare never opened the room to viewers. End and try again.');
      await go(target.whep);
      window.addEventListener('beforeunload', guard);
      say('On air', 'live'); btn.textContent = 'End broadcast'; btn.disabled = false;
      note.textContent = 'You are live. Viewers see you under a second behind. Keep this tab open; End broadcast saves the recording' + (recorder ? '.' : ' (this browser cannot record, so there will be no replay).');
    } catch (e) {
      if (recorder) { try { await recorder.stop(); } catch (x) {} recorder = null; }
      if (session) { session.stop(); session = null; } else if (camera) { camera.getTracks().forEach(t => t.stop()); }
      camera = null; video.srcObject = null;
      say('Camera off'); btn.textContent = 'Go live from this device'; btn.disabled = false;
      note.textContent = (e && e.message) || 'Could not start.';
    }
  });
  /* leaving the page mid-broadcast: take the room off air so viewers are not left with a
     dead LIVE chip; the recording in memory is gone with the tab, which the guard warned about */
  window.addEventListener('pagehide', () => { if (session) { session.stop(); session = null; end().catch(() => {}); } });
}

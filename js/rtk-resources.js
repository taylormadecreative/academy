/* Files for the class — the Files tab (add a file, show it to the class, download it) and the stage
   overlay everyone sees. Nelson 9/16: "when someone student or anybody can upload resources like a pdf
   or powerpoint and showcase them to the class and make it to where its an easy download they can
   share to everyone". Storage: the hub's own materials (ea_opil_materials + the private opil-files
   bucket, folder materials/<uploader>/ — 0041 opens both to the cohort), so a file added in class is
   on the hub home afterwards with the same Download. "Show to the class" rides a broadcast channel
   (`res-<session>`); each viewer mints their own short signed link. PDFs and pictures open on the
   stage; slides and docs cannot be drawn by a browser, so they are shared as a download instead.
   Pure decisions (kind, size, path, refusals, the showing line) live in opil/hub/live-rooms.js. */
const BUCKET = 'opil-files';
const ACCEPT = '.pdf,.ppt,.pptx,.key,.doc,.docx,.pages,.txt,.md,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.heic,.mp4,.mov,.zip';

export function createResources({ sb, copy, el, esc, sessionNo, uid, host, getMeeting, toast, paneEl, stageEl, countEl }) {
  let rows = [], chan = null, matsChan = null, poll = null, showing = null, heartbeat = null, hidden = false, urlTimer = null;
  const nameCache = new Map();
  const m = () => getMeeting();
  const inRoomName = (id) => { try { if (m().self.customParticipantId === id) return m().self.name; const p = m().participants.joined.toArray().find(x => x.customParticipantId === id); return p ? p.name : null; } catch (e) { return null; } };
  async function resolveNames(ids) {
    const need = [...new Set(ids)].filter(id => !nameCache.has(id));
    need.forEach(id => { const n = inRoomName(id); if (n) nameCache.set(id, n); });
    const left = need.filter(id => !nameCache.has(id));
    if (left.length) { try { const { data } = await sb.from('ea_profiles').select('user_id, display_name').in('user_id', left); (data || []).forEach(r => { if (r.display_name) nameCache.set(r.user_id, r.display_name); }); } catch (e) {} }
  }
  const who = (id) => nameCache.get(id) || (id === uid ? 'You' : 'A classmate');

  /* ---- the list ---- */
  async function load() {
    try {
      const { data } = await sb.from('ea_opil_materials').select('id, title, kind, link_url, file_path, uploaded_by, created_at').eq('session_no', sessionNo).order('created_at', { ascending: false });
      rows = data || [];
    } catch (e) { rows = []; }
    await resolveNames(rows.map(r => r.uploaded_by));
    paint();
  }
  function rowHTML(r) {
    const kind = r.file_path ? copy.fileKind(r.title) : 'link';
    const mine = r.uploaded_by === uid;
    const showable = r.file_path && copy.canShowInline(kind);
    return `<div class="r2-file" data-id="${esc(r.id)}">
      <span class="r2-file-kind k-${esc(kind)}">${kind === 'link' ? 'Link' : esc(copy.KIND_WORD[kind] || 'File')}</span>
      <div class="r2-file-who"><b>${esc(r.title)}</b><span>${mine ? 'You added this' : 'Added by ' + esc(who(r.uploaded_by))}</span></div>
      <div class="r2-file-actions">
        ${r.file_path ? `<button type="button" class="r2-mini r2-bring" data-show="${esc(r.id)}">${showable ? 'Show to class' : 'Share to class'}</button><button type="button" class="r2-mini" data-dl="${esc(r.id)}">Download</button>` : `<a class="r2-mini" href="${esc(r.link_url || '#')}" target="_blank" rel="noopener">Open link</a>`}
        ${mine || host ? `<button type="button" class="r2-mini r2-file-x" data-rm="${esc(r.id)}" aria-label="Remove ${esc(r.title)}">Remove</button>` : ''}
      </div>
    </div>`;
  }
  function paint() {
    if (!paneEl) return;
    const busy = paneEl.querySelector('.r2-file-busy');
    paneEl.innerHTML = `<div class="r2-files-head">
        <button type="button" class="r2-btn r2-file-add"><b>Add a file</b><span>PDF, slides, docs, pictures · up to 50 MB · everyone in the class can download it</span></button>
        <input type="file" class="r2-file-input" accept="${ACCEPT}" hidden>
      </div>
      ${busy ? busy.outerHTML : ''}
      <div class="r2-file-list">${rows.length ? rows.map(rowHTML).join('') : '<div class="r2-empty">No files yet. Add a PDF or a deck and everyone in the class can download it — it stays on the hub after class.</div>'}</div>`;
    if (countEl) countEl.textContent = rows.length || '';
    wire();
  }
  function wire() {
    const add = paneEl.querySelector('.r2-file-add'), input = paneEl.querySelector('.r2-file-input');
    add.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { const f = input.files && input.files[0]; input.value = ''; if (f) upload(f); });
    paneEl.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => show(rows.find(r => r.id === b.dataset.show))));
    paneEl.querySelectorAll('[data-dl]').forEach(b => b.addEventListener('click', () => download(rows.find(r => r.id === b.dataset.dl))));
    paneEl.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => remove(rows.find(r => r.id === b.dataset.rm), b)));
  }
  function busyLine(text) {
    let b = paneEl.querySelector('.r2-file-busy');
    if (!text) { if (b) b.remove(); return; }
    if (!b) { b = el('<div class="r2-file-busy"></div>'); paneEl.querySelector('.r2-files-head').insertAdjacentElement('afterend', b); }
    b.textContent = text;
  }

  /* ---- add a file: storage first, then the row the hub lists ---- */
  async function upload(file) {
    const why = copy.fileRefusal(file); if (why) { toast(why, 7000); return; }
    const path = copy.storagePath(uid, file.name, Date.now().toString(36));
    busyLine('Uploading ' + file.name + ' (' + copy.fmtSize(file.size) + ')…');
    try {
      const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (up.error) throw up.error;
      const ins = await sb.from('ea_opil_materials').insert({ session_no: sessionNo, title: file.name.slice(0, 200), kind: 'resource', file_path: path, uploaded_by: uid });
      if (ins.error) { try { await sb.storage.from(BUCKET).remove([path]); } catch (e) {} throw ins.error; }
      busyLine(null); toast(file.name + ' is up — everyone in the class can download it.', 6000);
      await load();
    } catch (e) {
      console.warn('[files] upload', e); busyLine(null);
      toast('Could not add that file. Check your connection and try again — or send it in Chat.', 8000);
    }
  }
  /* a short signed link for this viewer (the bucket is private; the cohort may read materials/) */
  async function signed(r, forDownload) {
    const opts = forDownload ? { download: r.title } : undefined;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(r.file_path, 900, opts);
    if (error || !data || !data.signedUrl) throw error || new Error('no url');
    return data.signedUrl;
  }
  async function download(r) {
    if (!r) return;
    /* open the tab first (a phone blocks a window opened after an await), then point it at the file */
    let w = null; try { w = window.open('', '_blank'); } catch (e) {}
    try { const url = await signed(r, true); if (w) w.location.href = url; else location.href = url; }
    catch (e) { console.warn('[files] download', e); if (w) w.close(); toast('Could not get that file right now. Try again in a moment.'); }
  }
  async function remove(r, btn) {
    if (!r) return;
    if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Remove? Tap again'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Remove'; } }, 4000); return; }
    try {
      const del = await sb.from('ea_opil_materials').delete().eq('id', r.id); if (del.error) throw del.error;
      if (r.file_path && r.uploaded_by === uid) { try { await sb.storage.from(BUCKET).remove([r.file_path]); } catch (e) {} }
      if (showing && showing.id === r.id) unshow();
      toast(r.title + ' removed.'); await load();
    } catch (e) { console.warn('[files] remove', e); toast('Could not remove that file.'); }
  }

  /* ---- show to the class: a broadcast; every viewer draws the file from their own signed link ---- */
  const send = async (payload) => { try { if (chan) await chan.send({ type: 'broadcast', event: 'res', payload }); } catch (e) {} };
  function start() {
    try {
      chan = sb.channel('res-' + sessionNo, { config: { broadcast: { self: true } } });
      chan.on('broadcast', { event: 'res' }, (msg) => handle(msg && msg.payload));
      chan.subscribe();
    } catch (e) { chan = null; }
    try { matsChan = sb.channel('mats-' + sessionNo).on('postgres_changes', { event: '*', schema: 'public', table: 'ea_opil_materials', filter: 'session_no=eq.' + sessionNo }, () => load()).subscribe(); } catch (e) {}
    poll = setInterval(load, 20000);
    load();
  }
  function stop() { clearInterval(poll); clearInterval(heartbeat); clearInterval(urlTimer); try { if (chan) sb.removeChannel(chan); if (matsChan) sb.removeChannel(matsChan); } catch (e) {} chan = matsChan = null; }
  function handle(p) {
    if (!p || typeof p !== 'object') return;
    if (p.type === 'show' && p.id && p.path) {
      if (showing && showing.id === p.id && p.from === showing.from) return;   /* the heartbeat */
      showing = { id: p.id, title: String(p.title || 'a file'), path: String(p.path), kind: p.kind, from: p.from, from_name: p.from_name || null };
      hidden = false; paintShow();
    } else if (p.type === 'unshow') {
      if (showing && (p.from === showing.from || p.host)) { showing = null; paintShow(); }
    }
  }
  async function show(r) {
    if (!r || !r.file_path) return;
    const kind = copy.fileKind(r.title);
    const payload = () => ({ type: 'show', id: r.id, title: r.title, path: r.file_path, kind, from: uid, from_name: inRoomName(uid) || who(uid) });
    showing = { id: r.id, title: r.title, path: r.file_path, kind, from: uid, from_name: payload().from_name }; hidden = false; paintShow();
    await send(payload());
    clearInterval(heartbeat); heartbeat = setInterval(() => { if (showing && showing.from === uid) send(payload()); else clearInterval(heartbeat); }, 15000);
    toast(copy.canShowInline(kind) ? 'Showing ' + r.title + ' to everyone. Stop showing is at the top of the stage.' : r.title + ' is shared — everyone sees a Download. To walk through it, use Share my screen.', 8000);
  }
  async function unshow() {
    const mineOrHost = showing && (showing.from === uid || host);
    if (!mineOrHost) return;
    await send({ type: 'unshow', from: uid, host: !!host });
    showing = null; clearInterval(heartbeat); paintShow();
  }
  async function paintShow() {
    if (!stageEl) return;
    clearInterval(urlTimer);
    if (!showing) { stageEl.hidden = true; stageEl.innerHTML = ''; stageEl.classList.remove('collapsed'); return; }
    const s = showing, mine = s.from === uid, canStop = mine || host;
    const line = copy.showingCopy({ who: s.from_name, title: s.title, kind: s.kind, mine });
    stageEl.hidden = false; stageEl.classList.toggle('collapsed', hidden);
    stageEl.innerHTML = `<div class="r2-show-bar"><span class="r2-show-line">${esc(line)}</span>
        <span class="r2-show-actions"><button type="button" class="r2-mini r2-bring" data-act="dl">Download</button>${copy.canShowInline(s.kind) ? '<button type="button" class="r2-mini" data-act="full">Open full screen</button>' : ''}${canStop ? '<button type="button" class="r2-mini" data-act="stop">Stop showing</button>' : `<button type="button" class="r2-mini" data-act="hide">${hidden ? 'Show' : 'Hide'}</button>`}</span></div>
      <div class="r2-show-body"></div>`;
    const row = rows.find(r => r.id === s.id) || { id: s.id, title: s.title, file_path: s.path };
    stageEl.querySelector('[data-act="dl"]').addEventListener('click', () => download(row));
    const full = stageEl.querySelector('[data-act="full"]'); if (full) full.addEventListener('click', async () => { let w = null; try { w = window.open('', '_blank'); } catch (e) {} try { const u = await signed(row, false); if (w) w.location.href = u; else location.href = u; } catch (e) { if (w) w.close(); } });
    const stop = stageEl.querySelector('[data-act="stop"]'); if (stop) stop.addEventListener('click', unshow);
    const hide = stageEl.querySelector('[data-act="hide"]'); if (hide) hide.addEventListener('click', () => { hidden = !hidden; paintShow(); });
    const body = stageEl.querySelector('.r2-show-body');
    if (hidden) { body.hidden = true; return; }
    if (!copy.canShowInline(s.kind)) { body.innerHTML = `<div class="r2-show-card"><b>${esc(s.title)}</b><span>${esc(copy.KIND_WORD[s.kind] || 'This file')} can’t be drawn inside the browser — download it to open. ${esc(mine ? 'To walk through it live, use Share my screen.' : '')}</span></div>`; return; }
    body.innerHTML = '<div class="r2-show-card"><span>Loading…</span></div>';
    try {
      const url = await signed(row, false);
      if (!showing || showing.id !== s.id) return;
      body.innerHTML = s.kind === 'image' ? `<img src="${esc(url)}" alt="${esc(s.title)}">` : `<iframe src="${esc(url)}#toolbar=0&navpanes=0&view=FitH" title="${esc(s.title)}"></iframe>`;
      urlTimer = setInterval(() => { if (showing && showing.id === s.id) paintShow(); }, 12 * 60000);   /* the link lasts 15 min; redraw before it dies */
    } catch (e) { console.warn('[files] show', e); body.innerHTML = '<div class="r2-show-card"><span>Could not open the file here — use Download.</span></div>'; }
  }

  return { start, stop, load, show, unshow, get showing() { return showing; } };
}

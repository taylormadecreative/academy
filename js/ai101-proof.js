/* js/ai101-proof.js — the proof from Friday, on the class page: the 1-5 confidence check (before at 7:00, after
   at 7:41), two practice taps, the 3 quick questions, and the review form. Every tap saves through
   ea_pulse_save, the review through ea_review_save (migration 0059), which decide verified/pending on the server.
   With no connection at load (sb null) the next tap tries to reconnect; if it still can't, the control says
   plainly that nothing was saved and keeps what the person chose or typed. */
export function mountProof({ sb, session, slug, kit, reconnect }) {
  const conn = { sb, session, pending: null };
  const client = async () => { // the live client, reconnecting once per tap if the page opened without one
    if (conn.sb) return conn.sb;
    if (!reconnect) return null;
    conn.pending ||= reconnect().then((c) => { if (c) { conn.sb = c.sb; conn.session = c.session; } return conn.sb; }, () => null)
      .finally(() => { conn.pending = null; });
    return conn.pending;
  };
  taps(conn, client, slug);
  review(conn, client, slug, kit);
}

const limit = (q) => { // every network call gives up after 10 s, so a control never stays stuck on "Saving…"
  const sig = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : null;
  return sig && q && q.abortSignal ? q.abortSignal(sig) : q;
};
const mine = (conn, table, cols, slug) => limit(conn.sb.from(table).select(cols).eq('workshop_slug', slug).eq('user_id', conn.session.user.id));

function taps(conn, client, slug) {
  const groups = [...document.querySelectorAll('[data-pulse]')];
  const touched = new Set(); // groups tapped on this visit: an earlier answer arriving late never overwrites them
  const press = (g, score) => g.querySelectorAll('[data-score]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.score === score)));
  const settle = (g, score) => { // a quiz question: say right or not quite, then lock (the first answer counts)
    if (!g.dataset.right) return;
    const msg = g.querySelector('.a1c-pulse-msg');
    msg.textContent = score === +g.dataset.right ? g.dataset.yes : g.dataset.no;
    g.querySelectorAll('[data-score]').forEach((b) => { b.disabled = true; });
    g.classList.add('done');
  };
  groups.forEach((g) => {
    const kind = g.dataset.pulse, msg = g.querySelector('.a1c-pulse-msg'), quiz = !!g.dataset.right;
    g.querySelectorAll('[data-score]').forEach((b) => b.addEventListener('click', async () => {
      if (b.disabled) return;
      const score = +b.dataset.score; touched.add(g); press(g, score);
      if (quiz) settle(g, score); else msg.textContent = 'Saving…';
      const sb = await client();
      if (!sb) { msg.textContent = (quiz ? msg.textContent + ' ' : '') + "Couldn't connect, so this didn't save." + (quiz ? '' : ' Tap your answer again in a minute.'); return; }
      let error = null;
      try { ({ error } = await limit(sb.rpc('ea_pulse_save', { p_slug: slug, p_kind: kind, p_score: score }))); } catch (e) { error = e; }
      if (quiz) { if (error) msg.textContent += " (That didn't save.)"; return; }
      msg.textContent = error ? "That didn't save. Tap your answer again." : 'Saved. Thank you!';
    }));
  });
  if (conn.sb && conn.session) mine(conn, 'ea_class_pulse', 'kind,score', slug).then(({ data }) => {
    (data || []).forEach((r) => {
      const g = groups.find((x) => x.dataset.pulse === r.kind);
      if (g && !touched.has(g)) { press(g, r.score); settle(g, r.score); }
    });
  }, () => {});
}

function review(conn, client, slug, kit) {
  const f = document.getElementById('reviewForm'); if (!f) return;
  const msg = f.querySelector('.a1c-review-msg'), shows = f.querySelector('[data-shows-as]'), btn = f.querySelector('button[type="submit"]');
  const val = f.querySelector('.a1c-stars-val');
  const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const DRAFT = 'a1c.review.' + slug;
  const say = (t, err) => { msg.textContent = t; msg.classList.toggle('err', !!err); };
  const clear = () => f.querySelectorAll('[aria-invalid]').forEach((x) => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
  const fail = (el, t) => { clear(); el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', msg.id); say(t, true); el.focus(); el.scrollIntoView({ block: 'center' }); };
  const showStars = () => { const c = f.querySelector('input[name="stars"]:checked'); val.textContent = c ? `${c.value} of 5 stars` : ''; };
  const draft = () => { const c = f.querySelector('input[name="stars"]:checked');
    kit.writeState(LS, DRAFT, { stars: c ? +c.value : 0, body: f.elements.body.value, who: f.elements.who.value, name: f.elements.name.value }); };
  const meta = (conn.session && conn.session.user && conn.session.user.user_metadata) || {};
  const saved = kit.readState(LS, DRAFT, null);
  if (saved && typeof saved === 'object') { // a review in progress survives a reload or a dead phone
    const star = f.querySelector(`input[name="stars"][value="${+saved.stars}"]`); if (star) star.checked = true;
    for (const k of ['body', 'who', 'name']) if (typeof saved[k] === 'string' && saved[k]) f.elements[k].value = saved[k];
  }
  if (!f.elements.name.value) f.elements.name.value = meta.full_name || meta.name || '';
  const drawName = () => { shows.textContent = kit.displayName(f.elements.name.value); };
  f.elements.name.addEventListener('input', drawName); drawName();
  f.querySelectorAll('input[name="stars"]').forEach((i) => i.addEventListener('change', () => { showStars(); draft(); }));
  for (const k of ['body', 'who', 'name']) f.elements[k].addEventListener('input', draft);
  showStars();
  if (conn.sb && conn.session) mine(conn, 'ea_reviews', 'stars,body,who_line,status', slug).maybeSingle().then(({ data }) => {
    if (!data) return;
    if (!saved || !saved.body) { // the server copy, unless they're mid-edit
      const star = f.querySelector(`input[name="stars"][value="${+data.stars}"]`); if (star) star.checked = true;
      f.elements.body.value = data.body || ''; f.elements.who.value = data.who_line || ''; showStars();
    }
    say(data.status === 'approved' ? 'Your review is up on the site. You can edit it here; an edit goes back to Nelson first.'
      : data.status === 'hidden' ? 'Nelson has your review. You can still edit it here.' : 'Nelson has your review. You can still edit it here.');
  }, () => {});
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (btn.getAttribute('aria-disabled') === 'true') return;
    const picked = f.querySelector('input[name="stars"]:checked');
    const stars = picked ? +picked.value : 0;
    const body = f.elements.body.value.trim(), who = f.elements.who.value.trim(), name = f.elements.name.value.trim();
    if (!stars) return fail(f.querySelector('input[name="stars"]'), 'Choose a star rating first.');
    if (body.length < 10) return fail(f.elements.body, 'Write at least a sentence about the class.');
    if (!name) return fail(f.elements.name, 'Add your name. Only your first name and last initial show.');
    if (!f.elements.ok.checked) return fail(f.elements.ok, 'Tick the box so your review can show on the site.');
    clear();
    btn.setAttribute('aria-disabled', 'true'); say('Posting…'); // aria-disabled, not disabled: the button keeps focus
    try {
      const sb = await client();
      if (!sb) return say("Couldn't connect, so this didn't post. Try again in a minute. Your words are still here.", true);
      let error = null;
      try { ({ error } = await limit(sb.rpc('ea_review_save', { p_slug: slug, p_stars: stars, p_body: body.slice(0, 1200), p_who: who.slice(0, 80) || null, p_name: name.slice(0, 80) }))); }
      catch (e) { error = e; }
      if (error) return say("That didn't post. Try again. Your words are still here.", true);
      kit.writeState(LS, DRAFT, null);
      say('Thank you! Nelson reads every review before it goes on the site.');
    } finally { btn.removeAttribute('aria-disabled'); }
  });
}

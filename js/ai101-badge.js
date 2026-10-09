/* js/ai101-badge.js — the end-of-class badge on the AI 101 class page (Nelson 10/9: "something cool at the end to show
   they took my course that they can share on their story or page"). A 1080x1920 story image drawn in a canvas with the
   person's name. Share opens the phone's share sheet (Instagram story, Messages…), Save downloads it, Add to LinkedIn
   is a plain link built on the server. It unlocks for everyone at the end of class (his call); ?badge=preview shows it
   early for his checks. The words and colours come from the page (#badgeData, ai101_course.py BADGE). The pure helpers
   are exported for tests/academy/ai101-badge.test.mjs; nothing here touches the page until mountBadge() runs. */

export const W = 1080, H = 1920;
const NAVY = '#04123a', INK2 = '#33415b', BLUE = '#0b40e0', GOLD = '#fdc921', PAPER = '#ffffff';
const PART_COLOURS = { role: '#0b40e0', task: '#a16207', context: '#0b7a53', format: '#c2410c', example: '#7048e8' }; // css/ai101-class.css
const DISPLAY = '"Space Grotesk", Inter, system-ui, sans-serif', BODY = 'Inter, system-ui, sans-serif';

export function badgeUnlocked(nowMs, startsUtc, unlockMin, preview) {
  if (preview) return true;
  const t = Date.parse(startsUtc);
  return Number.isFinite(t) && nowMs >= t + (Number(unlockMin) || 0) * 60000;
}

/* the name as typed or saved: invisible and control characters out, spaces collapsed, at most 40 characters */
export function badgeName(raw) {
  const s = String(raw || '').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, 40).join('');
}

/* a saved display name that is only the email's front ("jwashington24") is a placeholder nobody chose (welcome/) */
export function nameFrom({ profileName, meta, email }) {
  const handle = String(email || '').split('@')[0].toLowerCase();
  const p = badgeName(profileName);
  if (p && p.toLowerCase() !== handle) return p;
  return badgeName((meta && (meta.full_name || meta.name)) || '');
}

/* word-wrap with any measure function; a word longer than the line stays whole on its own line */
export function wrapLines(measure, text, maxWidth) {
  const words = String(text || '').split(' ').filter(Boolean), lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (line && measure(next) > maxWidth) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/* the biggest size (from max down to min, in steps) at which the text fits in maxLines lines */
export function fitSize(measureAt, text, maxWidth, maxLines, max, min, step = 6) {
  for (let size = max; size >= min; size -= step) {
    const lines = wrapLines((s) => measureAt(s, size), text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => measureAt(l, size) <= maxWidth)) return { size, lines };
  }
  return { size: min, lines: wrapLines((s) => measureAt(s, min), text, maxWidth) };
}

function spaced(ctx, px) { try { ctx.letterSpacing = px; } catch (e) {} }

/* the picture. Instagram covers about the top 250 px and the bottom 250 px with its own buttons, so the brand starts
   at 280 and the footer words sit above 1690. The middle block (kicker to "I learned…") is measured first, then
   centred between the brand and the footer band, so a one-line name and a long two-line name both fit. */
export const BAND = 1560;
export function drawBadge(ctx, { words, name, logo }) {
  const X = 90, MAXW = W - 2 * X, TOP = 420, BOTTOM = BAND - 50;
  ctx.save();
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; spaced(ctx, '0px');

  // brand: the mark + Taylormade Academy
  if (logo) { try { ctx.drawImage(logo, X, 280, 88, 88); } catch (e) {} }
  ctx.fillStyle = NAVY; ctx.font = `600 46px ${DISPLAY}`;
  const tx = X + (logo ? 112 : 0);
  ctx.fillText('Taylormade ', tx, 340);
  const tw = ctx.measureText('Taylormade ').width;
  ctx.font = `700 46px ${DISPLAY}`; ctx.fillText('Academy', tx + tw, 340);

  const shown = name || 'Your name';
  const nm = fitSize((s, size) => { ctx.font = `700 ${size}px ${DISPLAY}`; return ctx.measureText(s).width; }, shown, MAXW, 2, 124, 72);
  const TS = 100, D = 100, GAP = 26;
  ctx.font = `700 ${TS}px ${DISPLAY}`;
  const tlines = String(words.img_title || '').split('\n').flatMap((part) => wrapLines((s) => ctx.measureText(s).width, part, MAXW));
  ctx.font = `500 42px ${BODY}`;
  const llines = wrapLines((s) => ctx.measureText(s).width, words.img_learned, MAXW);

  // one pass to measure (draw = false), one to draw at the centred offset
  const block = (y0, draw) => {
    let y = y0;
    y += 30; // kicker baseline
    if (draw) { ctx.fillStyle = BLUE; ctx.font = `800 30px ${BODY}`; spaced(ctx, '4px'); ctx.fillText(String(words.img_kicker || '').toUpperCase(), X, y); spaced(ctx, '0px'); }
    y += 26;
    for (const line of nm.lines) { y += Math.round(nm.size * 1.02); if (draw) { ctx.fillStyle = name ? NAVY : '#b6bfd0'; ctx.font = `700 ${nm.size}px ${DISPLAY}`; ctx.fillText(line, X, y); } }
    y += 84;
    if (draw) { ctx.fillStyle = INK2; ctx.font = `500 52px ${BODY}`; ctx.fillText(words.img_took, X, y); }
    y += 12;
    for (const line of tlines) {
      y += Math.round(TS * 1.04);
      if (draw) { // the gold bar first, so the letters sit on it (the site's .u-gold)
        ctx.font = `700 ${TS}px ${DISPLAY}`;
        const bw = words.img_bar_word, k = (' ' + line + ' ').indexOf(' ' + bw + ' ');
        if (bw && k >= 0) { const bx = X + ctx.measureText(line.slice(0, k)).width; ctx.fillStyle = GOLD; ctx.fillRect(bx - 4, y - 16, ctx.measureText(bw).width + 8, 24); }
        ctx.fillStyle = NAVY; ctx.fillText(line, X, y);
      }
    }
    y += 70;
    if (draw) (words.parts || []).forEach((p, i) => {
      const cx = X + D / 2 + i * (D + GAP), cy = y + D / 2;
      ctx.fillStyle = PART_COLOURS[p.key] || NAVY; ctx.beginPath(); ctx.arc(cx, cy, D / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = `700 44px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText(p.letter, cx, cy + 15); ctx.textAlign = 'left';
    });
    y += D + 52;
    if (draw) { ctx.fillStyle = INK2; ctx.font = `600 32px ${BODY}`; ctx.fillText(words.img_parts, X, y); }
    y += 26;
    for (const line of llines) { y += 58; if (draw) { ctx.fillStyle = NAVY; ctx.font = `500 42px ${BODY}`; ctx.fillText(line, X, y); } }
    return y + 12; // the descenders of the last line
  };
  const h = block(0, false);
  block(Math.max(TOP, TOP + Math.floor((BOTTOM - TOP - h) / 2)), true);

  // footer band: the site and his handle
  ctx.fillStyle = NAVY; ctx.fillRect(0, BAND, W, H - BAND);
  ctx.fillStyle = GOLD; ctx.fillRect(X, BAND, 120, 10);
  ctx.fillStyle = '#ffffff'; ctx.font = `700 44px ${DISPLAY}`; ctx.fillText(words.img_site, X, BAND + 84);
  ctx.fillStyle = GOLD; ctx.font = `600 36px ${BODY}`; ctx.fillText(words.img_handle, X, BAND + 136);
  ctx.restore();
  return { blockHeight: h, nameSize: nm.size, nameLines: nm.lines.length, titleLines: tlines.length };
}

export function mountBadge({ sb, session, now = () => Date.now() }) {
  const sec = document.getElementById('badge'); if (!sec) return null;
  let words = {};
  try { words = JSON.parse(document.getElementById('badgeData').textContent); } catch (e) { console.warn('badge: no words', e); return null; }
  const $ = (id) => document.getElementById(id);
  const locked = $('badgeLocked'), box = $('badgeBox'), img = $('badgeImg'), input = $('badgeName'), msg = $('badgeMsg');
  const share = $('badgeShare'), save = $('badgeSave');
  const preview = new URLSearchParams(location.search).get('badge') === 'preview';
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  let blob = null, url = '', logo = null, ready = false, timer = 0, drawn = '';

  const fonts = () => Promise.all([`700 120px ${DISPLAY}`, `600 46px ${DISPLAY}`, `800 30px ${BODY}`, `500 54px ${BODY}`, `600 32px ${BODY}`]
    .map((f) => (document.fonts && document.fonts.load ? document.fonts.load(f) : Promise.resolve()))).catch(() => {});
  const loadLogo = () => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = '/assets/logo-mark.png'; });

  function render() {
    const name = badgeName(input.value);
    drawn = name;
    drawBadge(ctx, { words, name, logo });
    canvas.toBlob((b) => {
      if (!b || drawn !== name) return; // a newer render is on its way
      blob = b;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(b);
      img.src = url; save.href = url;
    }, 'image/png');
  }
  input.addEventListener('input', () => { msg.textContent = ''; clearTimeout(timer); timer = setTimeout(render, 150); });

  share.addEventListener('click', async () => {
    if (!badgeName(input.value)) { msg.textContent = words.name_needed; input.focus(); return; }
    if (!blob) return;
    const file = new File([blob], words.file || 'AI-101-badge.png', { type: 'image/png' });
    // files only: with text added, some phones hand the apps the text and drop the picture
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (e) { if (e && e.name !== 'AbortError') save.click(); }
    } else save.click();
  });
  save.addEventListener('click', (ev) => {
    if (!badgeName(input.value)) { ev.preventDefault(); msg.textContent = words.name_needed; input.focus(); return; }
    if (!blob) ev.preventDefault();
  });

  async function open() {
    locked.hidden = true; box.hidden = false;
    if (ready) return;
    ready = true;
    await Promise.all([fonts(), loadLogo().then((im) => { logo = im; })]);
    render();
  }
  async function prefill() {
    const user = session && session.user;
    if (!user) return;
    let profileName = '';
    try {
      if (sb) { const { data } = await sb.from('ea_profiles').select('display_name').eq('user_id', user.id).maybeSingle(); profileName = (data && data.display_name) || ''; }
    } catch (e) {}
    if (!input.value) input.value = nameFrom({ profileName, meta: user.user_metadata, email: user.email });
    if (ready) render();
  }

  prefill();
  if (badgeUnlocked(now(), sec.dataset.starts, sec.dataset.unlockMin, preview)) open();
  else {
    const tick = setInterval(() => { if (badgeUnlocked(now(), sec.dataset.starts, sec.dataset.unlockMin, preview)) { clearInterval(tick); open(); } }, 20000);
  }
  return { render, open };
}

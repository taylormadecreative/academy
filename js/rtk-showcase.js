/* Showcase page per team — class plugin (spec 2026-09-16-class-features-design.md §10).
   Every team gets a public page at /opil/showcase/team/?t=<slug> once "Publish our page" is on. The words
   the team writes (tagline, the project, a prototype link, a pitch video link) are edited on the team page
   (opil/hub/team/showcase-editor.js) through one RPC, ea_opil_team_update; the switch is ea_opil_team_publish;
   the public page reads one anon view, ea_opil_showcase_team (migration 0051).
   In a class, this plugin only lights up inside a TEAM room (roomKey 'team:<id>'): an "Our page" tab that
   says, in a sentence, whether the page is live, with the two links (edit it, see it). OPIL sessions and
   Academy/HT rooms get a plugin that does nothing.
   The pure decisions below (slugs, which video embeds, the cover URL, the words) are shared by the public
   page and the editor and covered by tests/opil/showcase.test.mjs. Import-safe in Node. */

export const SLUG_MAX = 60;
export const TAGLINE_MAX = 140;
export const PROJECT_MAX = 4000;
export const URL_MAX = 2048;   /* a prototype or video link; the RPC refuses a longer one rather than cut it */
export const COVER_BUCKET = 'content';
export const COVER_MAX_BYTES = 10 * 1024 * 1024;
export const SHOWCASE_INDEX = '/opil/showcase/';
export const TEAM_PAGE = '/opil/hub/team/';

/* "Team KIMT & Co." → 'team-kimt-and-co'. Mirrors ea_opil_slugify() in 0051 exactly: lower, '&' → ' and ',
   apostrophes dropped, every other run of non [a-z0-9] → '-', trimmed, at most 60 chars, never empty. */
export function slugify(name) {
  let s = String(name == null ? '' : name).toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  s = s.slice(0, SLUG_MAX).replace(/^-+|-+$/g, '');
  return s || 'team';
}
export const SLUG_RX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* ?t=rattlers → 'rattlers'; anything that is not a slug → null, so a bad link gets the "which team?" screen */
export function slugFromQuery(search) {
  let v; try { v = new URLSearchParams(search || '').get('t'); } catch (e) { return null; }
  if (v == null) return null;
  v = String(v).trim().toLowerCase();
  return SLUG_RX.test(v) && v.length <= SLUG_MAX ? v : null;
}
export const showcasePath = (slug) => SHOWCASE_INDEX + 'team/?t=' + encodeURIComponent(slug || '');
export const showcaseUrl = (slug, origin) => (origin || 'https://taylormadeacademy.com') + showcasePath(slug);

/* the cover is a picture in the PUBLIC content bucket, so it is a plain URL — no signed link, no sign-in.
   The path is opil/teams/<slug>/<file> with the file in [a-z0-9._-] only (the same rule as 0051): nothing in it
   can ever break out of a URL or a CSS url(). */
export const COVER_PATH_RX = /^opil\/teams\/[a-z0-9-]+\/[a-z0-9._-]+$/;
export function coverUrl(supabaseUrl, coverPath) {
  if (!supabaseUrl || !coverPath) return null;
  if (!COVER_PATH_RX.test(coverPath)) return null;
  return String(supabaseUrl).replace(/\/+$/, '') + '/storage/v1/object/public/' + COVER_BUCKET + '/' + coverPath.split('/').map(encodeURIComponent).join('/');
}
/* where a new cover goes: opil/teams/<slug>/cover-<stamp>.<ext> (the stamp defeats a cached old picture) */
export function coverPath(slug, fileName, stamp) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(String(fileName || ''));
  const ext = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
  return 'opil/teams/' + slugify(slug) + '/cover-' + (stamp || Date.now().toString(36)) + '.' + ext;
}
/* a sentence, or null when the picture is fine */
export function coverRefusal(file) {
  if (!file) return 'Choose a picture first.';
  const type = String(file.type || '').toLowerCase();
  if (!/^image\/(png|jpe?g|webp)$/.test(type)) return 'Use a PNG, JPG or WebP picture.';
  if ((Number(file.size) || 0) > COVER_MAX_BYTES) return 'That picture is over 10 MB. Export a smaller one and try again.';
  return null;
}

/* the pitch video: a pasted link → what to draw. { kind: 'youtube'|'vimeo'|'stream', src } for an iframe,
   null for anything else (the page shows a link instead). */
export function embedFor(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  let p; try { p = new URL(u); } catch (e) { return null; }
  const host = p.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  const path = p.pathname;
  const yt = (id) => (id && /^[\w-]{6,20}$/.test(id)) ? { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/' + id } : null;
  if (host === 'youtu.be') return yt(path.split('/')[1]);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (path === '/watch') return yt(p.searchParams.get('v'));
    const m = /^\/(?:embed|shorts|live|v)\/([\w-]+)/.exec(path);
    return m ? yt(m[1]) : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /^\/(?:video\/)?(\d{5,})/.exec(path);
    return m ? { kind: 'vimeo', src: 'https://player.vimeo.com/video/' + m[1] } : null;
  }
  /* Cloudflare Stream: customer-<code>.cloudflarestream.com/<uid>/watch | /iframe, or watch.cloudflarestream.com/<uid> */
  let m = /^customer-([a-z0-9]+)\.cloudflarestream\.com$/.exec(host);
  if (m) { const id = /^\/([a-f0-9]{32})(?:\/|$)/.exec(path); return id ? { kind: 'stream', src: 'https://customer-' + m[1] + '.cloudflarestream.com/' + id[1] + '/iframe' } : null; }
  if (host === 'watch.cloudflarestream.com' || host === 'iframe.cloudflarestream.com') {
    const id = /^\/([a-f0-9]{32})(?:\/|$)/.exec(path);
    return id ? { kind: 'stream', src: 'https://iframe.cloudflarestream.com/' + id[1] } : null;
  }
  return null;
}
export const EMBED_WORD = { youtube: 'YouTube', vimeo: 'Vimeo', stream: 'Cloudflare Stream' };
/* the editor's line under the video field */
export function videoWord(url) {
  const u = String(url || '').trim();
  if (!u) return 'Paste a YouTube, Vimeo or Cloudflare Stream link and the video plays on your page.';
  if (!/^https?:\/\//i.test(u)) return 'That doesn’t look like a link — it should start with https://';
  const e = embedFor(u);
  return e ? 'Plays on your page as a ' + EMBED_WORD[e.kind] + ' video.' : 'That link isn’t one we can play here — it will show as a “Watch the pitch” link instead.';
}
/* a link field's problem as a sentence, or null */
export function urlProblem(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (!/^https?:\/\/\S+$/i.test(v)) return 'A link starts with https:// — paste the whole address.';
  if (v.length > URL_MAX) return 'That link is too long to save (over ' + URL_MAX + ' characters). Use a shorter one, or a short link.';
  return null;
}

/* the state of the page, as one sentence */
export function publishWord(team, origin) {
  if (!team) return 'Loading your page…';
  if (team.is_staff) return 'The coordinator space has no public page.';
  if (team.published) return 'Your page is live at ' + showcaseUrl(team.slug, origin) + ' — anyone with the link can see it.';
  return 'Not published yet — only people in the lab can see this draft.';
}
/* the switch's label for its state */
export const publishLabel = (published) => published ? 'Unpublish our page' : 'Publish our page';
export const publishAgain = (published) => published ? 'Take it down? Tap again' : 'Make it public? Tap again';
/* what the page is missing before it is worth publishing (the editor says it; it never blocks) */
export function readiness(team) {
  const t = team || {}; const missing = [];
  if (!String(t.tagline || '').trim()) missing.push('a one-line tagline');
  if (!String(t.project || '').trim()) missing.push('what you built');
  if (!t.prototype_url && !t.video_url) missing.push('a prototype link or a pitch video');
  if (!missing.length) return 'Everything is filled in.';
  return 'Still missing: ' + missing.join(missing.length > 2 ? ', ' : ' and ') + '.';
}

/* "Alexis Burwinkel, Jordan Lee and Sam Okafor" */
export function memberLine(members) {
  const names = (Array.isArray(members) ? members : []).map(m => (m && typeof m === 'object') ? String(m.name || '').trim() : String(m || '').trim()).filter(Boolean);
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
/* the files section: only rows a visitor can actually open (an https link). A row with no link, or a link
   that is not http(s), is left out rather than printed as a dead line. */
export function fileRows(files) {
  return (Array.isArray(files) ? files : []).map(f => {
    const raw = String((f && (f.link_url || f.url)) || '').trim();
    const url = /^https?:\/\/\S+$/i.test(raw) ? raw : null;
    return url ? { title: String((f && f.title) || 'Untitled').slice(0, 200), url, kind: (f && f.kind) === 'locker' ? 'locker' : 'file', word: 'Open' } : null;
  }).filter(Boolean);
}
/* which of the editor's fields differ from the saved team (trimmed; null and '' are the same thing) —
   the editor saves these before it publishes, so a tap on Publish never throws typed words away */
export const EDIT_FIELDS = ['tagline', 'project', 'prototype_url', 'video_url'];
export function changedFields(team, values) {
  const t = team || {}, v = values || {};
  const norm = (x) => String(x == null ? '' : x).trim();
  return EDIT_FIELDS.filter(k => norm(v[k]) !== norm(t[k]));
}
/* the project text as paragraphs (blank line = new paragraph); esc is the page's escaper */
export function paragraphs(text, esc) {
  return String(text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(s => '<p>' + esc(s).replace(/\n/g, '<br>') + '</p>').join('');
}
/* the RPC's one-word errors, as sentences with a next step */
export function saveError(e) {
  const m = String((e && e.message) || e || '');
  if (/not_allowed|42501|permission/i.test(m)) return 'Only your team and the program team can change this page. Sign in with the email you applied with.';
  if (/staff_team/.test(m)) return 'The coordinator space is for trying things out — it has no public page.';
  if (/bad_url/.test(m)) return 'One of the links isn’t a full address. Paste the whole thing, starting with https://';
  if (/too_long/.test(m)) return 'One of the links is too long to save. Use a shorter one, or a short link.';
  if (/too long|check constraint|showcase_chk/i.test(m)) return 'One of the fields is too long. Trim it and save again.';
  return 'Could not save right now. Check your connection and try again.';
}

/* ---------- the room plugin: a team room's "Our page" tab ---------- */
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const href = '/css/rtk-showcase.css' + new URL(import.meta.url).search;
  if (document.querySelector('link[href="' + href + '"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
}
export function create(ctx) {
  const key = String((ctx && ctx.roomKey) || '');
  if (!/^team:/.test(key)) return { start() {}, stop() {} };   /* only a team room has a page of its own */
  const teamId = key.slice(5);
  const { sb, esc, panel } = ctx;
  let tab = null, timer = null;
  async function paint() {
    if (!tab) return;
    try {
      const { data, error } = await sb.from('ea_opil_teams').select('id, name, slug, published, tagline, project, prototype_url, video_url, is_staff').eq('id', teamId).maybeSingle();
      if (error) throw error;
      const t = data;
      const origin = (typeof location !== 'undefined' && location.origin) || undefined;
      /* the coordinator space has no page: say so and stop — no readiness line, no links to a page that cannot exist */
      tab.pane.innerHTML = !t
        ? '<div class="r2-empty">This room isn’t tied to a team page. Open the team page on the hub to set one up.</div>'
        : t.is_staff
          ? `<div class="r2-sc"><p class="r2-sc-state">${esc(publishWord(t, origin))}</p></div>`
          : `<div class="r2-sc"><p class="r2-sc-state${t.published ? ' on' : ''}">${esc(publishWord(t, origin))}</p>
             <p class="r2-fine">${esc(readiness(t))}</p>
             <div class="r2-sc-actions">
               <a class="r2-btn r2-sc-edit" href="${esc(TEAM_PAGE + '#showcase')}" target="_blank" rel="noopener">Edit our page</a>
               ${t.published && t.slug ? `<a class="r2-btn r2-sc-see" href="${esc(showcasePath(t.slug))}" target="_blank" rel="noopener">See our page</a>` : ''}
             </div></div>`;
    } catch (e) {
      console.warn('[showcase]', e);
      tab.pane.innerHTML = '<div class="r2-empty">Could not load your page right now. Open the team page on the hub instead.</div>';
    }
  }
  function start() {
    try {
      ensureCss();
      tab = panel.addTab('showcase', 'Our page');
      paint();
      timer = setInterval(paint, 60000);
    } catch (e) { console.warn('[showcase] start', e); }
  }
  function stop() { clearInterval(timer); timer = null; }
  return { start, stop };
}

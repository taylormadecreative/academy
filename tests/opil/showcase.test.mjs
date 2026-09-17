// node --test tests/opil/showcase.test.mjs — the showcase page's pure decisions (spec §10)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, SLUG_RX, SLUG_MAX, slugFromQuery, showcasePath, showcaseUrl, coverUrl, coverPath, coverRefusal, COVER_PATH_RX,
  embedFor, videoWord, urlProblem, URL_MAX, publishWord, publishLabel, publishAgain, readiness, memberLine, fileRows,
  changedFields, EDIT_FIELDS, paragraphs, saveError, create,
} from '../../js/rtk-showcase.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('slugify mirrors ea_opil_slugify: lower, & → and, apostrophes dropped, runs → one hyphen, trimmed, never empty', () => {
  assert.equal(slugify('The Rattlers'), 'the-rattlers');
  assert.equal(slugify('Team KIMT & Co.'), 'team-kimt-and-co');
  assert.equal(slugify("Tia's Corner Store"), 'tias-corner-store');
  assert.equal(slugify('Tia’s Corner Store'), 'tias-corner-store');
  assert.equal(slugify('  --DataDrive!!  '), 'datadrive');
  assert.equal(slugify('Famu   Impact  2026'), 'famu-impact-2026');
  assert.equal(slugify(''), 'team');
  assert.equal(slugify(null), 'team');
  assert.equal(slugify('###'), 'team');
  const long = slugify('a'.repeat(59) + '-' + 'b'.repeat(20));
  assert.ok(long.length <= SLUG_MAX, 'cut to 60');
  assert.ok(!long.endsWith('-'), 'no trailing hyphen after the cut');
  for (const s of ['the-rattlers', 'team-kimt-and-co', 'datadrive', long]) assert.match(s, SLUG_RX);
});

test('slugFromQuery accepts a slug and nothing else', () => {
  assert.equal(slugFromQuery('?t=the-rattlers'), 'the-rattlers');
  assert.equal(slugFromQuery('?t=The-Rattlers'), 'the-rattlers');   /* a pasted link with capitals still lands */
  assert.equal(slugFromQuery('?t=%20datadrive%20'), 'datadrive');
  assert.equal(slugFromQuery(''), null);
  assert.equal(slugFromQuery('?t='), null);
  assert.equal(slugFromQuery('?t=../admin'), null);
  assert.equal(slugFromQuery('?t=a--b'), null);
  assert.equal(slugFromQuery('?t=<script>'), null);
  assert.equal(slugFromQuery('?s=3'), null);
});

test('the page link', () => {
  assert.equal(showcasePath('the-rattlers'), '/opil/showcase/team/?t=the-rattlers');
  assert.equal(showcaseUrl('the-rattlers'), 'https://taylormadeacademy.com/opil/showcase/team/?t=the-rattlers');
  assert.equal(showcaseUrl('the-rattlers', 'http://localhost:8000'), 'http://localhost:8000/opil/showcase/team/?t=the-rattlers');
});

test('coverUrl is a plain public URL, only for a path inside opil/teams/<slug>/', () => {
  assert.equal(coverUrl('https://x.supabase.co', 'opil/teams/the-rattlers/cover-abc.jpg'), 'https://x.supabase.co/storage/v1/object/public/content/opil/teams/the-rattlers/cover-abc.jpg');
  assert.equal(coverUrl('https://x.supabase.co/', 'opil/teams/the-rattlers/cover-abc.jpg'), 'https://x.supabase.co/storage/v1/object/public/content/opil/teams/the-rattlers/cover-abc.jpg');
  assert.equal(coverUrl('https://x.supabase.co', null), null);
  assert.equal(coverUrl('', 'opil/teams/a/b.jpg'), null);
  assert.equal(coverUrl('https://x.supabase.co', 'materials/uid/secret.pdf'), null);   /* never a path outside the showcase folder */
  assert.equal(coverUrl('https://x.supabase.co', 'opil/teams/a/../b.jpg'), null);
  /* the file name is [a-z0-9._-] only — a quote, a paren or a space can never reach a url() or an attribute */
  assert.equal(coverUrl('https://x.supabase.co', "opil/teams/x/a').png;background:red"), null);
  assert.equal(coverUrl('https://x.supabase.co', 'opil/teams/x/a b.png'), null);
  assert.equal(coverUrl('https://x.supabase.co', 'opil/teams/x/Cover.PNG'), null);
  assert.equal(coverUrl('https://x.supabase.co', 'opil/teams/X/cover.png'), null);
  assert.match(coverPath('The Rattlers', 'Team Photo.JPEG', 'k9'), COVER_PATH_RX);   /* what coverPath() makes always passes */
  assert.match(coverPath('a', 'noext'), COVER_PATH_RX);
});

test('coverPath files the picture under the slug with a stamp and a clean extension', () => {
  assert.equal(coverPath('the-rattlers', 'Team Photo.JPEG', 'k1'), 'opil/teams/the-rattlers/cover-k1.jpg');
  assert.equal(coverPath('The Rattlers', 'x.png', 'k2'), 'opil/teams/the-rattlers/cover-k2.png');
  assert.equal(coverPath('a', 'noext', 'k3'), 'opil/teams/a/cover-k3.jpg');
  assert.match(coverPath('a', 'x.webp'), /^opil\/teams\/a\/cover-[a-z0-9]+\.webp$/);
});

test('coverRefusal says why, or nothing', () => {
  assert.equal(coverRefusal(null), 'Choose a picture first.');
  assert.equal(coverRefusal({ type: 'application/pdf', size: 10 }), 'Use a PNG, JPG or WebP picture.');
  assert.equal(coverRefusal({ type: 'image/heic', size: 10 }), 'Use a PNG, JPG or WebP picture.');
  assert.match(coverRefusal({ type: 'image/png', size: 11 * 1024 * 1024 }), /over 10 MB/);
  assert.equal(coverRefusal({ type: 'image/jpeg', size: 900000 }), null);
});

test('embedFor: YouTube in every shape', () => {
  const want = { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' };
  assert.deepEqual(embedFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), want);
  assert.deepEqual(embedFor('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s'), want);
  assert.deepEqual(embedFor('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), want);
  assert.deepEqual(embedFor('https://youtu.be/dQw4w9WgXcQ'), want);
  assert.deepEqual(embedFor('https://youtu.be/dQw4w9WgXcQ?si=abc'), want);
  assert.deepEqual(embedFor('https://www.youtube.com/shorts/dQw4w9WgXcQ'), want);
  assert.deepEqual(embedFor('https://www.youtube.com/embed/dQw4w9WgXcQ'), want);
  assert.deepEqual(embedFor('https://www.youtube.com/live/dQw4w9WgXcQ'), want);
  assert.equal(embedFor('https://www.youtube.com/channel/UCabc'), null);
  assert.equal(embedFor('https://www.youtube.com/watch?v=<bad>'), null);
});

test('embedFor: Vimeo and Cloudflare Stream; anything else is a link', () => {
  assert.deepEqual(embedFor('https://vimeo.com/123456789'), { kind: 'vimeo', src: 'https://player.vimeo.com/video/123456789' });
  assert.deepEqual(embedFor('https://player.vimeo.com/video/123456789?h=abc'), { kind: 'vimeo', src: 'https://player.vimeo.com/video/123456789' });
  assert.equal(embedFor('https://vimeo.com/channels/staffpicks'), null);
  const uid = 'a'.repeat(32);
  assert.deepEqual(embedFor('https://customer-nimm2h959enrq4x1.cloudflarestream.com/' + uid + '/watch'), { kind: 'stream', src: 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/' + uid + '/iframe' });
  assert.deepEqual(embedFor('https://customer-nimm2h959enrq4x1.cloudflarestream.com/' + uid + '/iframe'), { kind: 'stream', src: 'https://customer-nimm2h959enrq4x1.cloudflarestream.com/' + uid + '/iframe' });
  assert.deepEqual(embedFor('https://watch.cloudflarestream.com/' + uid), { kind: 'stream', src: 'https://iframe.cloudflarestream.com/' + uid });
  assert.equal(embedFor('https://customer-x.cloudflarestream.com/not-a-uid/watch'), null);
  assert.equal(embedFor('https://drive.google.com/file/d/abc/view'), null);
  assert.equal(embedFor('https://example.com/video.mp4'), null);
  assert.equal(embedFor('javascript:alert(1)'), null);
  assert.equal(embedFor('ftp://youtube.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(embedFor(''), null);
  assert.equal(embedFor(null), null);
});

test('videoWord and urlProblem speak in sentences', () => {
  assert.match(videoWord(''), /Paste a YouTube/);
  assert.match(videoWord('youtube.com/watch?v=dQw4w9WgXcQ'), /start with https/);
  assert.equal(videoWord('https://youtu.be/dQw4w9WgXcQ'), 'Plays on your page as a YouTube video.');
  assert.equal(videoWord('https://vimeo.com/123456789'), 'Plays on your page as a Vimeo video.');
  assert.match(videoWord('https://drive.google.com/file/d/abc/view'), /Watch the pitch/);
  assert.equal(urlProblem(''), null);
  assert.equal(urlProblem('   '), null);
  assert.equal(urlProblem('https://github.com/team/repo'), null);
  assert.match(urlProblem('github.com/team/repo'), /https:\/\//);
  assert.match(urlProblem('https://has a space'), /https:\/\//);
  assert.equal(URL_MAX, 2048);
  assert.equal(urlProblem('https://x.io/' + 'a'.repeat(URL_MAX - 13)), null);
  assert.match(urlProblem('https://x.io/' + 'a'.repeat(URL_MAX)), /too long/);
});

test('publishWord, the switch labels and readiness', () => {
  assert.equal(publishWord(null), 'Loading your page…');
  assert.equal(publishWord({ is_staff: true }), 'The coordinator space has no public page.');
  assert.match(publishWord({ published: false }), /^Not published yet/);
  /* the draft is readable by the whole cohort (t_read, 0029) — the sentence must not promise more privacy than that */
  assert.equal(publishWord({ published: false }), 'Not published yet — only people in the lab can see this draft.');
  assert.doesNotMatch(publishWord({ published: false }), /only your team/i);
  assert.equal(publishWord({ published: true, slug: 'the-rattlers' }), 'Your page is live at https://taylormadeacademy.com/opil/showcase/team/?t=the-rattlers — anyone with the link can see it.');
  assert.equal(publishLabel(false), 'Publish our page');
  assert.equal(publishLabel(true), 'Unpublish our page');
  assert.equal(publishAgain(false), 'Make it public? Tap again');
  assert.equal(publishAgain(true), 'Take it down? Tap again');
  assert.equal(readiness({}), 'Still missing: a one-line tagline, what you built, a prototype link or a pitch video.');
  assert.equal(readiness({ tagline: 'x', project: 'y' }), 'Still missing: a prototype link or a pitch video.');
  assert.equal(readiness({ tagline: 'x', project: 'y', video_url: 'https://youtu.be/abc' }), 'Everything is filled in.');
  assert.equal(readiness({ tagline: ' ', project: 'y', prototype_url: 'https://x' }), 'Still missing: a one-line tagline.');
});

test('memberLine reads like a person says it', () => {
  assert.equal(memberLine([]), '');
  assert.equal(memberLine([{ name: 'Alexis' }]), 'Alexis');
  assert.equal(memberLine([{ name: 'Alexis' }, { name: 'Jordan' }]), 'Alexis and Jordan');
  assert.equal(memberLine([{ name: 'Alexis' }, { name: '' }, { name: 'Jordan' }, 'Sam']), 'Alexis, Jordan and Sam');
  assert.equal(memberLine(null), '');
});

test('fileRows: only rows a visitor can open; a row with no https link is left out, never a dead line', () => {
  const rows = fileRows([
    { title: 'Pitch deck.pdf', url: null, kind: 'file' },                 /* a file with no link: not shown */
    { title: 'Repo', url: 'https://github.com/x/y', kind: 'locker' },
    { title: 'Nope', url: 'javascript:alert(1)' },                        /* not http(s): not shown */
    { title: null, link_url: 'http://example.com/demo ' },                /* the view's column name; trimmed; untitled */
    { title: 'Spaced', url: 'https://x.io/a b' },                         /* not one address: not shown */
  ]);
  assert.deepEqual(rows.map(r => [r.title, r.url, r.kind, r.word]), [
    ['Repo', 'https://github.com/x/y', 'locker', 'Open'],
    ['Untitled', 'http://example.com/demo', 'file', 'Open'],
  ]);
  assert.deepEqual(fileRows(null), []);
  assert.deepEqual(fileRows([{ title: 'Budget draft', url: null }]), []);
});

test('changedFields: which of the four words differ from the saved team (trimmed; null = empty)', () => {
  assert.deepEqual(EDIT_FIELDS, ['tagline', 'project', 'prototype_url', 'video_url']);
  const team = { tagline: 'Open payments', project: null, prototype_url: 'https://x', video_url: '' };
  assert.deepEqual(changedFields(team, { tagline: 'Open payments', project: '', prototype_url: 'https://x', video_url: null }), []);
  assert.deepEqual(changedFields(team, { tagline: ' Open payments ', project: '  ', prototype_url: 'https://x ', video_url: '' }), []);
  assert.deepEqual(changedFields(team, { tagline: 'Open payments!', project: 'We built…', prototype_url: 'https://x', video_url: '' }), ['tagline', 'project']);
  assert.deepEqual(changedFields(team, { tagline: 'Open payments', project: '', prototype_url: '', video_url: 'https://youtu.be/a' }), ['prototype_url', 'video_url']);
  assert.deepEqual(changedFields(null, {}), []);
  assert.deepEqual(changedFields({}, { tagline: 'x' }), ['tagline']);
});

test('paragraphs escapes and splits on blank lines', () => {
  assert.equal(paragraphs('We built <b>x</b>.\n\nFor corner stores.\nIn Atlanta.', esc), '<p>We built &lt;b&gt;x&lt;/b&gt;.</p><p>For corner stores.<br>In Atlanta.</p>');
  assert.equal(paragraphs('', esc), '');
  assert.equal(paragraphs(null, esc), '');
});

test('saveError turns the RPC’s words into a sentence with a next step', () => {
  assert.match(saveError({ message: 'not_allowed' }), /Only your team/);
  assert.match(saveError({ message: 'permission denied for table ea_opil_teams' }), /Only your team/);
  assert.match(saveError({ message: 'staff_team' }), /coordinator space/);
  assert.match(saveError({ message: 'bad_url: video_url' }), /https:\/\//);
  assert.match(saveError({ message: 'too_long: prototype_url' }), /too long to save/);
  assert.match(saveError({ message: 'new row for relation "ea_opil_teams" violates check constraint "ea_opil_teams_showcase_chk"' }), /too long/);
  assert.match(saveError(new Error('TypeError: Failed to fetch')), /Could not save right now/);
  assert.match(saveError(null), /Could not save right now/);
});

test('create(ctx): a no-op outside a team room; an "Our page" tab inside one', async () => {
  const noop = create({ roomKey: 'opil:1' });
  assert.equal(typeof noop.start, 'function'); assert.equal(typeof noop.stop, 'function');
  noop.start(); noop.stop();
  assert.deepEqual(Object.keys(create({ roomKey: 'room:abc' })).sort(), ['start', 'stop']);

  /* a team room: the tab is added and the pane says the state in a sentence (sb is a stub; no document needed for the pane) */
  const added = [];
  const pane = { innerHTML: '' };
  const team = { id: 't1', name: 'The Rattlers', slug: 'the-rattlers', published: true, tagline: 'x', project: 'y', prototype_url: 'https://x', video_url: null, is_staff: false };
  const sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: team, error: null }) }) }) }) };
  const ctx = { roomKey: 'team:t1', sb, esc, panel: { addTab(name, label) { added.push([name, label]); return { pane, count: {}, show() {} }; } } };
  const p = create(ctx);
  p.start();
  await new Promise(r => setTimeout(r, 5));
  p.stop();
  assert.deepEqual(added, [['showcase', 'Our page']]);
  assert.match(pane.innerHTML, /Your page is live at/);
  assert.match(pane.innerHTML, /Edit our page/);
  assert.match(pane.innerHTML, /See our page/);
  assert.match(pane.innerHTML, /Everything is filled in\./);

  /* a room whose team row cannot be read: a sentence, not a blank */
  const sbBad = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('boom') }) }) }) }) };
  const pane2 = { innerHTML: '' };
  const p2 = create({ roomKey: 'team:t2', sb: sbBad, esc, panel: { addTab() { return { pane: pane2, count: {}, show() {} }; } } });
  const warn = console.warn; console.warn = () => {};
  try { p2.start(); await new Promise(r => setTimeout(r, 5)); } finally { console.warn = warn; p2.stop(); }
  assert.match(pane2.innerHTML, /Could not load your page right now/);

  /* the coordinator space: the sentence and nothing else — no "still missing", no Edit / See links to a page that cannot exist */
  const staff = { id: 't3', name: 'Coordinator space', slug: 'coordinator-space', published: false, tagline: '', project: '', is_staff: true };
  const sbStaff = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: staff, error: null }) }) }) }) };
  const pane3 = { innerHTML: '' };
  const p3 = create({ roomKey: 'team:t3', sb: sbStaff, esc, panel: { addTab() { return { pane: pane3, count: {}, show() {} }; } } });
  p3.start(); await new Promise(r => setTimeout(r, 5)); p3.stop();
  assert.match(pane3.innerHTML, /The coordinator space has no public page\./);
  assert.doesNotMatch(pane3.innerHTML, /Still missing|Edit our page|See our page/);
});

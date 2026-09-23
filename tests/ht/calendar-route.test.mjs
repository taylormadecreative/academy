import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function calendarContext() {
  const returnLink = { href: '/ht/hub/events/#next', getAttribute: function () { return this.href; }, setAttribute: function (_key, value) { this.href = value; } };
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: (selector) => selector === '.ht-grid' ? { style: {} } : null, addEventListener: () => {} };
  const classList = { add: () => {}, toggle: () => {}, remove: () => {} };
  const bar = { innerHTML: '' };
  const context = { URL, URLSearchParams, Date, TextEncoder, console, setTimeout: () => {}, location: { origin: 'https://example.test', hostname: 'example.test', pathname: '/ht/hub/calendar/', search: '?demo=student' }, navigator: { userAgent: '' } };
  context.window = context;
  context.document = { currentScript: null, body: { getAttribute: () => 'calendar', classList }, querySelectorAll: (selector) => selector === 'a[href^="/ht/hub/"]' ? [returnLink] : [], addEventListener: () => {}, querySelector: () => null, getElementById: (id) => id === 'htRoot' ? root : id === 'htBar' ? bar : null };
  vm.createContext(context);
  for (const file of ['ht/hub/data.js', 'ht/hub/data/events.js', 'ht/hub/data/calendar.js', 'ht/hub/ht.js']) vm.runInContext(read(file), context, { filename: file });
  return { context, root, bar, returnLink };
}

test('academic calendar route uses the original year object and published source without copying dates', () => {
  const { context } = calendarContext();
  const original = context.HT.spaces.events.blocks.find((block) => block.type === 'year');
  const calendar = context.HT.spaces.calendar;
  assert.equal(calendar.blocks.find((block) => block.type === 'year'), original);
  assert.equal(calendar.tab, 'events');
  assert.ok(context.HT.pages.includes('calendar'));
  assert.equal(original.sourceHref, 'https://htu.edu/wp-content/uploads/2026/07/2026-2027-Academic-Calendar-FINAL.pdf');
  assert.ok(original.items.length > 60);
  assert.equal(calendar.blocks.filter((block) => block.type === 'year').length, 1);
  assert.ok(!calendar.blocks.some((block) => ['checkin', 'agenda', 'feed', 'dm'].includes(block.type)));
});

test('legacy calendar renderer retains term filters, full dated rows, ICS and print controls', () => {
  const { context, root, bar, returnLink } = calendarContext();
  context.HTHub.render('calendar');
  const original = context.HT.spaces.events.blocks.find((block) => block.type === 'year');
  assert.equal((root.innerHTML.match(/class="yr is-/g) || []).length, original.items.length);
  for (const term of ['next', 'fall', 'spring', 'summer']) assert.ok(root.innerHTML.includes(`data-yr="${term}"`));
  assert.match(root.innerHTML, /data-yics/);
  assert.match(root.innerHTML, /data-print/);
  assert.match(root.innerHTML, /<h1[^>]*>Academic calendar<\/h1>/);
  assert.ok(root.innerHTML.includes(original.sourceHref));
  assert.equal(returnLink.href, '/ht/hub/events/?demo=student#next');
  context.HTHub.boot();
  assert.match(bar.innerHTML, /reference dates from the University’s published calendar/);
  assert.doesNotMatch(bar.innerHTML, /sample content/);
});

test('build creates a standalone calendar shell and the new Events view links to it', async () => {
  const html = read('ht/hub/calendar/index.html');
  assert.match(html, /data-space="calendar"/);
  assert.match(html, /\/ht\/hub\/data\/all\.js\?v=/);
  const source = read('ht/hub/campus-student.js');
  const { renderStudent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const events = renderStudent('events', { state: { mode: 'guest', events: [] }, esc: (value) => String(value), href: (value) => `${value}?demo=student` });
  assert.match(events, /href="\/ht\/hub\/calendar\/\?demo=student"/);
  assert.match(events, /Open the academic calendar/);
});

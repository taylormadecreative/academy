import test from 'node:test';
import assert from 'node:assert/strict';
const { caseloadSummary, renderSuccess } = await import('../../ht/hub/campus-success.js');

const ctx = (role, name) => ({ state: { member: { role, display_name: name } }, esc: (v) => String(v), icon: () => '', href: (v) => `/ht/hub/${v}/`, formatDate: () => 'Sep 1', formatTime: () => '9 AM', notify: () => {} });

test('caseloadSummary: campus totals with no argument, owner-scoped otherwise', () => {
  const all = caseloadSummary();
  assert.deepEqual([all.flagged, all.waiting, all.open, all.resolved, all.flagged - all.waiting], [38, 14, 13, 11, 24]);
  const m = caseloadSummary('Morgan T.');
  assert.deepEqual([m.flagged, m.waiting, m.open, m.resolved], [7, 3, 2, 2]);
  /* A believable spread: nobody carries more than a dozen flags, and the four caseloads add up to the campus. */
  const owners = ['Morgan T.', 'Dr. Ellis P.', 'Dana K.', 'Ms. Reed'].map((o) => caseloadSummary(o));
  for (const o of owners.slice(1)) assert.ok(o.flagged >= 9 && o.flagged <= 12, `other advisors carry 9–12 (got ${o.flagged})`);
  for (const k of ['flagged', 'waiting', 'open', 'resolved']) assert.equal(owners.reduce((n, o) => n + o[k], 0), all[k], `${k} adds up`);
  assert.equal(caseloadSummary('').flagged, 0);
  assert.equal(caseloadSummary('Nobody').flagged, 0);
});

test('staff view lists only the signed-in advisor\'s students', () => {
  const html = renderSuccess('success', ctx('staff', 'Morgan T.'));
  assert.match(html, /You see the students assigned to you\. Other advisors see theirs; leadership sees totals only\./);
  assert.doesNotMatch(html, /Dr\. Ellis P\.|Dana K\.|Ms\. Reed/);
  assert.doesNotMatch(html, /Tiana W\.|Darius K\.|Brianna J\./);
  assert.match(html, /of 7 · oldest first/);
  assert.match(html, /class="success-history-mark"/);
  assert.doesNotMatch(html, /AI Literacy · First-Year Scholars|Imani B\./);
});

test('leadership sees campus totals and no student names', () => {
  const html = renderSuccess('success', ctx('leadership', 'Avery W.'));
  assert.match(html, /38 early alerts/);
  assert.match(html, /Ms\. Reed/);
  assert.doesNotMatch(html, /DeShawn R\.|Naomi B\./);
});

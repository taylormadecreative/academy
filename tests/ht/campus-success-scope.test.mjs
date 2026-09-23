import test from 'node:test';
import assert from 'node:assert/strict';
const { caseloadSummary, renderSuccess } = await import('../../ht/hub/campus-success.js');

const ctx = (role, name) => ({ state: { member: { role, display_name: name } }, esc: (v) => String(v), icon: () => '', href: (v) => `/ht/hub/${v}/`, formatDate: () => 'Sep 1', formatTime: () => '9 AM', notify: () => {} });

test('caseloadSummary: campus totals with no argument, owner-scoped otherwise', () => {
  const all = caseloadSummary();
  assert.deepEqual([all.flagged, all.waiting, all.flagged - all.waiting, all.resolved], [38, 14, 24, 11]);
  const m = caseloadSummary('Morgan T.');
  assert.deepEqual([m.flagged, m.waiting, m.open, m.resolved], [25, 10, 9, 6]);
  assert.equal(caseloadSummary('').flagged, 0);
  assert.equal(caseloadSummary('Nobody').flagged, 0);
});

test('staff view lists only the signed-in advisor\'s students', () => {
  const html = renderSuccess('success', ctx('staff', 'Morgan T.'));
  assert.match(html, /You see the students assigned to you\. Other advisors see theirs; leadership sees totals only\./);
  assert.doesNotMatch(html, /Dr\. Ellis P\.|Dana K\./);
  assert.doesNotMatch(html, /Tiana W\.|Darius K\./);
  assert.match(html, /of 25 · oldest first/);
  assert.doesNotMatch(html, /AI Literacy · First-Year Scholars|Imani B\./);
});

test('leadership sees campus totals and no student names', () => {
  const html = renderSuccess('success', ctx('leadership', 'Avery W.'));
  assert.match(html, /38 early alerts/);
  assert.doesNotMatch(html, /DeShawn R\.|Naomi B\./);
});

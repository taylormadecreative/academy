// Security & integrations page: accuracy guards. run: node --test tests/ht/campus-trust.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../../ht/hub/campus-trust.js', import.meta.url), 'utf8');
const { renderTrust, TRUST_GROUPS, TRUST_QUESTIONS, ACCESS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ctx = (role) => ({ state: { mode: 'demo', member: { role } }, esc, icon: (n) => `<svg data-icon="${n}"></svg>`, href: (t, q) => `/ht/hub/${t}/${q ? `?${new URLSearchParams(q)}` : ''}`, notify() {} });

test('renders for every role with no h1 and the two honest statuses', () => {
  for (const role of ['student', 'staff', 'admin', 'leadership']) {
    const html = renderTrust('trust', ctx(role));
    assert.ok(!html.includes('<h1'));
    assert.ok(!/undefined|NaN/.test(html));
    assert.match(html, /What’s built, what we’ll set up together/);
    assert.match(html, /href="\/ht\/hub\/support\/\?topic=Technology&amp;subject=Security\+packet\+request"/);
    assert.match(html, /data-trust-copy/);
  }
  const items = TRUST_GROUPS.flatMap((g) => g.items);
  assert.equal(items.filter(([s]) => s === 'built').length, 8);
  assert.equal(items.filter(([s]) => s === 'scoped').length, 7);
  assert.ok(items.every(([s]) => ['built', 'scoped'].includes(s)));
});

test('never names a hosting vendor or claims a certification', () => {
  const html = renderTrust('trust', ctx('leadership'));
  const text = html.replace(/<[^>]+>/g, ' ');
  for (const banned of [/supabase/i, /cloudflare/i, /\baws\b/i, /amazon/i, /vercel/i, /netlify/i, /github/i, /realtimekit/i, /openai/i, /anthropic/i, /microsoft/i, /\bentra\b/i, /google/i, /postgres/i, /\bcompleted before launch\b/i, /audit (is|was) complete/i, /\bSOC ?2\b/i, /certified/i, /FERPA[- ]compliant/i, /HIPAA/i, /leverage|seamless|robust|cutting-edge/i]) assert.doesNotMatch(text, banned, String(banned));
  assert.match(text, /Built to support your FERPA obligations/);
  assert.match(text, /We design to WCAG 2\.2 AA\. An outside review and a VPAT are planned before launch\./);
  assert.match(text, /HT’s campus accounts, using SAML or OIDC/);
  assert.match(text, /Nothing a student writes in the Hub is used to train any AI model/);
  assert.doesNotMatch(text, /answers from the course’s materials/, 'no Ask Ada chat is described');
  assert.doesNotMatch(text, /course tutor/i);
  const chips = html.match(/<span class="trust-chip" data-status="(built|scoped)">/g) || [];
  assert.ok(chips.length >= 17, 'every item and legend entry carries a chip');
  assert.match(html, /data-status="built"><svg data-icon="check">/);
  assert.match(html, /data-status="scoped"><svg data-icon="users">/);
  assert.ok(TRUST_QUESTIONS.length >= 6 && TRUST_QUESTIONS.length <= 8);
});

test('who-sees-what keeps leadership to totals and trustees to the board space', () => {
  const row = (name) => ACCESS.find(([r]) => r === name)[2];
  assert.equal(row('Leadership')[1][0], 'no');
  assert.equal(row('Leadership')[4][0], 'no');
  assert.ok(row('Trustee').every(([k]) => k === 'no'));
  assert.equal(row('Advisor')[4][0], 'some');
  assert.equal(row('Student')[1][0], 'no');
});

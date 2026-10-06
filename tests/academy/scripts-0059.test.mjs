// tests/academy/scripts-0059.test.mjs — run: node --test tests/academy/scripts-0059.test.mjs
// The three staged scripts Nelson runs with `! bash scripts/...`: they parse, the Supabase token never sits on a
// command line (anyone on the Mac can read those in `ps`), and the results script grades the 3 questions with the
// same right answers as the course module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const S = ['apply-0059.sh', 'ai101-results.sh', 'deploy-ai101-emails.sh'];
const read = (f) => fs.readFileSync(ROOT + 'scripts/' + f, 'utf8');
test('every script parses', () => { for (const f of S) execFileSync('bash', ['-n', ROOT + 'scripts/' + f]); });
test('the token goes to curl as a header file, never on the command line', () => {
  for (const f of ['apply-0059.sh', 'ai101-results.sh']) {
    assert.doesNotMatch(read(f), /-H "Authorization: Bearer \$SB_TOKEN"/, f);
    assert.match(read(f), /-H @<\(printf 'Authorization: Bearer %s\\n' "\$SB_TOKEN"\)/, f);
  }
});
test('the email deploy keeps its errors in a private temp file and says so when the site check fails', () => {
  const s = read('deploy-ai101-emails.sh');
  assert.doesNotMatch(s, /\/tmp\/dep\.err/); assert.match(s, /mktemp/);
  assert.match(s, /could not reach/i);
});
test('apply checks what 0059 now needs: 7 functions, the rate limiter from 0004, nothing for anon but the public read', () => {
  const s = read('apply-0059.sh');
  assert.match(s, /ea_rate_check/); assert.match(s, /'ea_workshop_open'/); assert.match(s, /functions 7/);
  assert.match(s, /anon_pulse_save/);
});
test('results: before/after for seat holders, who went up, practice taps, and the 3 questions graded like the course', () => {
  const s = read('ai101-results.sh');
  for (const k of ['went_up', 'ended_4_or_5', 'seat_both_n']) assert.match(s, new RegExp(k), k);
  const C = JSON.parse(execFileSync('python3', ['-c', 'import json, ai101_course as c; print(json.dumps(c.CHECK_ITEMS))'], { cwd: ROOT }).toString());
  for (const q of C) assert.match(s, new RegExp(`kind='${q.kind}' and score=${q.right}\\b`), q.kind + ' right answer matches the course');
});

// node --test tests/opil/pass.test.mjs — the no-code student door's words
import test from 'node:test';
import assert from 'node:assert/strict';
import { passCopy } from '../../opil/hub/live-rooms.js';

test('every answer from ea-opil-pass has a sentence that says what to do next', () => {
  assert.match(passCopy('not_on_list'), /email you applied with/);
  assert.match(passCopy('not_on_list'), /jware@aucenter\.edu/);
  assert.match(passCopy('slow_down'), /Wait a minute/);
  assert.match(passCopy('bad_email'), /look like an email/);
  assert.match(passCopy('verify'), /sign in with a code/);
});

test('an unknown or missing code still gets a way out (the code sign-in), never a blank', () => {
  for (const c of [undefined, null, '', 'sign_in_unavailable', 'method_not_allowed']) {
    assert.match(passCopy(c), /sign in with a code/);
  }
});

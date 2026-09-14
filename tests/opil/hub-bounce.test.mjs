// tests/opil/hub-bounce.test.mjs — run: node --test tests/opil/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginBounce } from '../../opil/hub/hub.js';

test('a room link survives the sign-in wall', () => {
  assert.equal(loginBounce({ pathname: '/opil/hub/live/', search: '?s=7' }), '/login/?next=%2Fopil%2Fhub%2Flive%2F%3Fs%3D7');
});
test('a plain hub page bounces exactly as before', () => {
  assert.equal(loginBounce({ pathname: '/opil/hub/team/', search: '' }), '/login/?next=%2Fopil%2Fhub%2Fteam%2F');
});

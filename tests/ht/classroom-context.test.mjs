import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const source = await readFile(new URL('../../ht/hub/classroom-context.js', import.meta.url), 'utf8');
const { classroomContext, classroomLogin, validateClassroomAccess } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const slug = 'htc-' + 'a'.repeat(24);
test('managed session and replay links preserve one room and ignore invitation keys', () => {
  for (const page of ['session', 'replay']) {
    const c = classroomContext(`/ht/hub/${page}/`, `?room=${slug}&k=legacy`);
    assert.equal(c.slug, slug); assert.equal(c.managed, true);
    assert.equal(new URL(classroomLogin(c, false, 'legacy'), 'https://test').searchParams.get('next'), `/ht/hub/session/?room=${slug}`);
    assert.equal(new URL(classroomLogin(c, true), 'https://test').searchParams.get('next'), `/ht/hub/replay/?room=${slug}`);
    assert.equal(c.summaryStorageKey, 'ht-summary-pending:' + slug);
  }
});
test('managed missing, malformed, unknown context and demo never fall back to shared ht', () => {
  for (const query of ['', '?room=', '?room=ht', '?room=htc-unknown', `?room=${slug.toUpperCase()}`, `?room=${slug}&demo=staff`]) {
    assert.throws(() => classroomContext('/ht/hub/session/', query, true));
  }
  assert.throws(() => classroomContext('/ht/hub/legacy-live/', `?room=${slug}`, true));
  assert.throws(() => classroomContext('/ht/hub/live/', '', false));
});
test('legacy paths require explicit adapter authorization and preserve their invitation', () => {
  const c = classroomContext('/ht/hub/legacy-live/', '?k=legacy', true);
  assert.equal(c.slug, 'ht'); assert.equal(c.managed, false);
  assert.equal(new URL(classroomLogin(c, false, 'legacy'), 'https://test').searchParams.get('next'), '/ht/hub/legacy-live/?k=legacy');
  assert.equal(c.replayPath, '/ht/hub/replay/?legacy=1');
});
test('access requires explicit flags and exact mapped room identity', () => {
  const access = { managed: true, can_join: true, is_host: false, room_id: 'one' };
  assert.equal(validateClassroomAccess(access, 'one'), true);
  for (const a of [null, {}, {...access, managed: false}, {...access, can_join: false}, {...access, can_join: 'true'}, {...access, room_id: null}]) assert.equal(validateClassroomAccess(a, 'one'), false);
  assert.equal(validateClassroomAccess(access, 'two'), false);
});

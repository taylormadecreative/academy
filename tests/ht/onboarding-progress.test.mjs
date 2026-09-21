import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../ht/hub/campus-onboarding-progress.js', import.meta.url), 'utf8');
const { getOnboardingRole, onboardingSteps, createOnboardingProgress } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const state = (role = 'student', id = 'person-one', mode = 'demo') => ({ mode, user: { id, email: 'private@example.test' }, member: { user_id: id, role, active: true, display_name: 'Private campus name' }, assignments: [{ body: 'Private student response' }] });
function memoryStorage() {
  const records = new Map();
  const writes = [];
  return { records, writes, getItem: key => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value); writes.push([key, value]); } };
}

test('guide roles require an active matching membership and recognized workspace mode', () => {
  assert.equal(getOnboardingRole(state()), 'student');
  assert.equal(getOnboardingRole(state('staff')), 'staff');
  assert.equal(getOnboardingRole(state('admin')), 'staff');
  assert.equal(getOnboardingRole(state('leadership', 'person-one', 'live')), 'leadership');
  const invalid = [null, {}, { ...state(), user: null }, { ...state(), member: null }, state('unknown'), state('constructor'), state('student', '', 'demo'), state('student', 'a'.repeat(129)), state('student', 'person:name')];
  for (const mode of ['guest', 'unavailable', 'live?demo=staff', undefined]) invalid.push({ ...state(), mode });
  for (const active of [false, null, undefined, 1, 'true']) invalid.push({ ...state(), member: { ...state().member, active } });
  invalid.push({ ...state(), member: { ...state().member, user_id: 'someone-else' } });
  for (const value of invalid) assert.equal(getOnboardingRole(value), null);
});

test('role steps cover the full orientation in order and returned copies cannot mutate future guides', () => {
  assert.deepEqual(onboardingSteps('student').map(step => step.id), ['courses', 'live', 'community', 'people', 'events', 'support', 'spaces']);
  assert.deepEqual(onboardingSteps('staff').map(step => step.id), ['courses', 'live', 'staff', 'community', 'people', 'support', 'insights']);
  assert.deepEqual(onboardingSteps('leadership').map(step => step.id), ['insights', 'community', 'spaces']);
  for (const role of ['student', 'staff', 'leadership']) {
    const steps = onboardingSteps(role);
    for (const step of steps) {
      assert.deepEqual(Object.keys(step).sort(), ['action', 'description', 'hint', 'id', 'title', 'view']);
      assert.equal(step.id, step.view);
      for (const value of Object.values(step)) assert.ok(typeof value === 'string' && value.trim().length > 0 && value.length < 300);
    }
    steps[0].title = 'Changed externally';
    steps.pop();
    assert.notEqual(onboardingSteps(role)[0].title, 'Changed externally');
  }
  for (const role of [null, undefined, 'guest', 'admin', 'constructor', '__proto__']) assert.deepEqual(onboardingSteps(role), []);
});

test('reading and starting do not mark a destination visited; only recognized guided visits do', () => {
  const storage = memoryStorage(), progress = createOnboardingProgress({ storage }), current = state();
  assert.deepEqual(progress.read(current), { role: 'student', status: 'new', visited: [], activeStep: null, persistent: true });
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(progress.start(current), { role: 'student', status: 'active', visited: [], activeStep: 'courses', persistent: true });
  assert.deepEqual(progress.complete(current).visited, []);
  assert.equal(progress.complete(current).status, 'active');
  const beforeInvalidVisit = storage.writes.length;
  for (const value of ['', 'staff', 'insights', 'constructor', '../staff', { id: 'courses' }]) assert.deepEqual(progress.visit(current, value).visited, []);
  assert.equal(storage.writes.length, beforeInvalidVisit);
  assert.deepEqual(progress.visit(current, 'courses').visited, ['courses']);
  assert.deepEqual(progress.visit(current, 'courses').visited, ['courses']);
  assert.equal(progress.start(current).activeStep, 'live');
  assert.deepEqual(progress.read(current).visited, ['courses']);
});

test('a completed guide requires every destination and survives a reload without reopening', () => {
  const storage = memoryStorage(), progress = createOnboardingProgress({ storage }), current = state();
  const ids = onboardingSteps('student').map(step => step.id);
  for (const id of ids.slice(0, -1)) progress.visit(current, id);
  assert.equal(progress.complete(current).status, 'active');
  const allVisited = progress.visit(current, ids.at(-1));
  assert.equal(allVisited.status, 'active', 'finishing still requires the explicit completion action');
  assert.equal(allVisited.activeStep, 'spaces');
  const complete = progress.complete(current);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.activeStep, null);
  assert.deepEqual(complete.visited, ids);
  for (const action of [() => progress.start(current), () => progress.dismiss(current), () => progress.visit(current, 'courses')]) assert.deepEqual(action(), complete);
  const restored = createOnboardingProgress({ storage });
  assert.deepEqual(restored.read(current), complete);
  assert.deepEqual(restored.restart(current), { role: 'student', status: 'active', visited: [], activeStep: 'courses', persistent: true });
});

test('dismiss preserves progress, incidental reads stay dismissed, and start resumes the first missing destination', () => {
  const storage = memoryStorage(), current = state(), progress = createOnboardingProgress({ storage });
  progress.visit(current, 'courses'); progress.visit(current, 'community');
  assert.equal(progress.dismiss(current).status, 'dismissed');
  assert.equal(progress.read(current).status, 'dismissed');
  assert.equal(createOnboardingProgress({ storage }).read(current).status, 'dismissed');
  assert.deepEqual(progress.start(current), { role: 'student', status: 'active', visited: ['courses', 'community'], activeStep: 'live', persistent: true });
  progress.dismiss(current);
  const deliberateVisit = progress.visit(current, 'people');
  assert.equal(deliberateVisit.status, 'active');
  assert.deepEqual(deliberateVisit.visited, ['courses', 'community', 'people']);
});

test('progress is isolated by actual user, demo versus live, and actual membership role including administrator', () => {
  const storage = memoryStorage(), progress = createOnboardingProgress({ storage });
  const identities = [state(), state('student', 'person-two'), state('student', 'person-one', 'live'), state('staff'), state('admin'), state('leadership')];
  for (const [index, current] of identities.entries()) {
    assert.equal(progress.read(current).status, 'new');
    progress.visit(current, onboardingSteps(getOnboardingRole(current))[0].id);
    assert.equal(storage.records.size, index + 1);
  }
  progress.restart(identities[0]);
  assert.deepEqual(progress.read(identities[0]).visited, []);
  for (const current of identities.slice(1)) assert.equal(progress.read(current).visited.length, 1);
  const saved = JSON.stringify([...storage.records]);
  assert.doesNotMatch(saved, /private@example|Private campus name|Private student response|assignments|display_name|email/);
  for (const raw of storage.records.values()) assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['activeStep', 'status', 'version', 'visited']);
});

test('URL role hints cannot upgrade the guide or create progress for guests, missing membership, or inactive users', () => {
  const storage = memoryStorage(), progress = createOnboardingProgress({ storage });
  const invalid = [state('student', 'person-one', 'guest'), { ...state(), member: null }, { ...state(), member: { ...state().member, active: false } }];
  const originalLocation = globalThis.location;
  globalThis.location = { href: 'https://example.test/ht/hub/?demo=staff&role=admin&guide=staff' };
  try {
    for (const current of invalid) {
      for (const name of ['read', 'start', 'visit', 'complete', 'dismiss', 'restart']) assert.deepEqual(progress[name](current, 'staff'), { role: null, status: 'new', visited: [], activeStep: null, persistent: false });
    }
    assert.equal(storage.records.size, 0);
    assert.equal(getOnboardingRole(state()), 'student');
    assert.equal(progress.visit(state(), 'staff').status, 'new');
  } finally {
    if (originalLocation === undefined) delete globalThis.location; else globalThis.location = originalLocation;
  }
});

test('malformed or oversized stored records fall back safely without rewriting unrelated browser data', () => {
  const valid = { version: 1, status: 'active', visited: ['courses'], activeStep: 'courses' };
  const malformed = ['{', 'null', '[]', 'x'.repeat(4097), JSON.stringify({ ...valid, version: 2 }), JSON.stringify({ ...valid, visited: 'courses' }), JSON.stringify({ ...valid, visited: ['courses', 'courses'] }), JSON.stringify({ ...valid, visited: ['staff'] }), JSON.stringify({ ...valid, visited: Array(8).fill('courses') }), JSON.stringify({ ...valid, activeStep: 'staff' }), JSON.stringify({ ...valid, status: 'complete' }), JSON.stringify({ ...valid, status: 'new' }), JSON.stringify({ ...valid, status: 'constructor' })];
  for (const raw of malformed) {
    const storage = memoryStorage();
    const seed = createOnboardingProgress({ storage }); seed.start(state());
    const key = [...storage.records.keys()][0];
    storage.records.set(key, raw); storage.records.set('other-application', 'keep');
    const progress = createOnboardingProgress({ storage });
    assert.deepEqual(progress.read(state()), { role: 'student', status: 'new', visited: [], activeStep: null, persistent: false });
    assert.deepEqual(progress.visit(state(), 'courses').visited, ['courses']);
    assert.deepEqual(progress.read(state()).visited, ['courses']);
    assert.equal(storage.records.get(key), raw);
    assert.equal(storage.records.get('other-application'), 'keep');
    assert.equal(progress.read(state('staff')).persistent, true, 'corruption is isolated to the affected identity');
  }
});

test('denied storage access, unavailable storage, and quota errors keep an isolated in-memory guide', () => {
  const denied = { getItem() { throw new Error('Storage denied'); }, setItem() { throw new Error('Storage denied'); } };
  const quota = { getItem() { return null; }, setItem() { throw new Error('Quota exceeded'); } };
  for (const storage of [null, {}, denied, quota]) {
    const progress = createOnboardingProgress({ storage }), current = state();
    assert.equal(progress.start(current).persistent, false);
    assert.deepEqual(progress.visit(current, 'courses').visited, ['courses']);
    assert.deepEqual(progress.read(current).visited, ['courses']);
    assert.deepEqual(progress.read(state('staff')).visited, []);
    progress.dismiss(current);
    assert.equal(progress.read(current).status, 'dismissed');
    assert.equal(progress.start(current).activeStep, 'live');
  }
});

test('storage property getter failures are caught at construction and returned snapshots do not leak mutable state', () => {
  const options = {}; Object.defineProperty(options, 'storage', { get() { throw new Error('Denied'); } });
  const progress = createOnboardingProgress(options), current = state();
  const snapshot = progress.visit(current, 'courses');
  assert.equal(snapshot.persistent, false);
  snapshot.visited.push('staff'); snapshot.status = 'complete';
  assert.deepEqual(progress.read(current), { role: 'student', status: 'active', visited: ['courses'], activeStep: 'courses', persistent: false });
});

test('reads observe another instance’s browser progress and destruction leaves saved completion untouched', () => {
  const storage = memoryStorage(), current = state('leadership');
  const first = createOnboardingProgress({ storage }), second = createOnboardingProgress({ storage });
  first.start(current);
  second.visit(current, 'insights');
  assert.deepEqual(first.read(current).visited, ['insights']);
  first.visit(current, 'community'); second.visit(current, 'spaces'); second.complete(current);
  assert.equal(first.read(current).status, 'complete');
  const before = [...storage.records];
  first.destroy();
  assert.deepEqual([...storage.records], before);
  assert.equal(first.read(current).role, null);
  assert.equal(first.restart(current).role, null);
  assert.equal(second.read(current).status, 'complete');
});

// node --test tests/opil/messages-directory.test.mjs — the Messages page's people list (0057)
import test from 'node:test';
import assert from 'node:assert/strict';
import { directory, teamSentLine, teamIntro } from '../../opil/hub/messages/directory.js';

test('directory: teams A→Z, me left out, one entry per person', () => {
  const rows = [{ user_id: 'b', team_name: 'Rattler Impact' }, { user_id: 'me', team_name: 'Rattler Impact' },
    { user_id: 'c', team_name: 'data divas' }, { user_id: 'b', team_name: 'Other' }, { user_id: 'd', team_name: ' ' }];
  const d = directory(rows, [], 'me');
  assert.deepEqual(d.teams, [{ name: 'data divas', uids: ['c'] }, { name: 'No team yet', uids: ['d'] }, { name: 'Rattler Impact', uids: ['b'] }]);
  assert.deepEqual(d.program, []);
});

test('directory: someone I messaged with who is on no team is Program team — once, never me, never a teammate', () => {
  const rows = [{ user_id: 'b', team_name: 'T' }];
  const partners = [{ sender_id: 'jarrell', recipient_id: 'me' }, { sender_id: 'me', recipient_id: 'jarrell' },
    { sender_id: 'me', recipient_id: 'b' }, { sender_id: 'jamal', recipient_id: 'me' }, null, { sender_id: 'staffer' }];
  assert.deepEqual(directory(rows, partners, 'me').program, ['jarrell', 'jamal', 'staffer']);
  assert.deepEqual(directory(null, null, 'me'), { teams: [], program: [] });
});

test('team copy says where it went and that team chat stays private', () => {
  assert.equal(teamSentLine('Rattler Impact', 4), 'Sent to 4 people on Rattler Impact. Each of them got it as a private message from you, and their replies come to you one by one.');
  assert.match(teamSentLine('Solo', 1), /^Sent to 1 person on Solo\./);
  assert.match(teamIntro('Rattler Impact', 4), /all 4 people on Rattler Impact.*team chat stays private/);
});

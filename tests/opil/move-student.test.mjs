// node --test tests/opil/move-student.test.mjs — Registrations → Move: the pure decisions
// (the RPC itself, ea_opil_move_student in 0055, was exercised on a real Postgres via PGlite)
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamKey, teamChoices, resultLine } from '../../opil/hub/admin/move-student.js';

test('teamKey mirrors ea_opil_team_key: case, punctuation, a leading "Team " never split a team', () => {
  assert.equal(teamKey('Team KIMT'), 'kimt');
  assert.equal(teamKey('KIMT'), 'kimt');
  assert.equal(teamKey('FAMU Impact '), 'famuimpact');
  assert.equal(teamKey('Rattler-Impact'), 'rattlerimpact');
  assert.equal(teamKey('Teamwork'), 'teamwork');     /* "Team" only drops as its own word */
  assert.equal(teamKey(null), '');
});

test('teamChoices: real teams + registration-only names, one per key, current and staff left out, A→Z', () => {
  const teams = [{ name: 'Rattler Impact' }, { name: 'FAMU Impact ' }, { name: 'Program Team', is_staff: true }, { name: 'data divas' }];
  const regs = [{ team_name: 'Team KIMT' }, { team_name: 'KIMT' }, { team_name: 'rattler impact' }, { team_name: 'program team' }, { team_name: '' }];
  assert.deepEqual(teamChoices(teams, regs, 'FAMU Impact'), ['data divas', 'Rattler Impact', 'Team KIMT']);
  assert.deepEqual(teamChoices(null, null, 'x'), []);
});

test('resultLine says what happened in plain words', () => {
  assert.equal(resultLine({ from: 'FAMU Impact', to: 'Rattler Impact', seated: true, old_removed: true }, 'Bengisu Kazazlar'),
    'Moved. Bengisu will see Rattler Impact the next time they open the hub. FAMU Impact had no one left, so it was removed.');
  assert.equal(resultLine({ from: 'Solo', to: 'New', seated: false, old_removed: false, old_kept: null }, 'Ada Lovelace'),
    "Moved. Ada hasn't signed in yet, so they land on New the first time they do.");
  assert.match(resultLine({ from: 'Old', to: 'New', seated: true, old_kept: 'it has chat, locker work or scores on it' }, 'A B'),
    /Old stays on the list because it has chat, locker work or scores on it\.$/);
  assert.equal(resultLine({ to: 'X', unchanged: true }, 'Sam'), 'Sam is already on X. Nothing changed.');
  assert.equal(resultLine(null, 'x'), '');
});

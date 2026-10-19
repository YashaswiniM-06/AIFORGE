import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateLegacyUser, authenticateTeamUser, parseTeamUsers } from '../lib/team-auth.mjs';

const users = () => parseTeamUsers(JSON.stringify([
  { username: 'owner', displayName: 'Workspace Owner', role: 'admin', password: 'a-very-long-owner-secret' },
  { username: 'reviewer1', displayName: 'Reviewer One', role: 'reviewer', password: 'another-long-reviewer-secret' },
]));
const basic = (username, password) => `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

test('configured team accounts authenticate to named, role-bearing identities', () => {
  const accounts = users();
  assert.deepEqual(authenticateTeamUser(basic('owner', 'a-very-long-owner-secret'), accounts), {
    id: 'owner', username: 'owner', displayName: 'Workspace Owner', role: 'admin',
  });
  assert.equal(authenticateTeamUser(basic('REVIEWER1', 'another-long-reviewer-secret'), accounts).role, 'reviewer');
  assert.equal(authenticateTeamUser(basic('reviewer1', 'wrong-secret'), accounts), null);
  assert.equal(authenticateTeamUser(basic('judge', 'shared-secret'), accounts), null,
    'Team mode rejects the shared account; the server must not fall back to legacy authentication.');
});

test('named-account configuration requires unique accounts, long secrets, admin, and reviewer roles', () => {
  assert.throws(() => parseTeamUsers('{bad'), /JSON array/);
  assert.throws(() => parseTeamUsers(JSON.stringify([{ username: 'owner', displayName: 'Owner', role: 'admin', password: 'short' }])), /at least one admin and one reviewer/);
  assert.throws(() => parseTeamUsers(JSON.stringify([
    { username: 'owner', displayName: 'Owner', role: 'admin', password: 'long-enough-secret-1' },
    { username: 'OWNER', displayName: 'Duplicate', role: 'reviewer', password: 'long-enough-secret-2' },
  ])), /unique/);
  assert.throws(() => parseTeamUsers(JSON.stringify([
    { username: 'owner', displayName: 'Owner', role: 'admin', password: 'long-enough-secret-1' },
    { username: 'second', displayName: 'Second', role: 'admin', password: 'long-enough-secret-2' },
  ])), /at least one admin and one reviewer/);
  assert.throws(() => parseTeamUsers(JSON.stringify([
    { username: 'owner', displayName: 'Owner', role: 'admin', password: 'same-long-secret-2026' },
    { username: 'reviewer', displayName: 'Reviewer', role: 'reviewer', password: 'same-long-secret-2026' },
  ])), /different password/);
});

test('legacy workspace login keeps its own identity only when named accounts are not enabled', () => {
  assert.deepEqual(authenticateLegacyUser(basic('judge', 'legacy-secret'), 'judge', 'legacy-secret'), {
    id: 'legacy-admin', username: 'judge', displayName: 'Workspace admin', role: 'admin',
  });
  assert.equal(authenticateLegacyUser(basic('judge', 'bad'), 'judge', 'legacy-secret'), null);
  assert.equal(authenticateTeamUser(basic('judge', 'legacy-secret'), []), null);
});

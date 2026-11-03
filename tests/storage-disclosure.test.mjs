import test from 'node:test';
import assert from 'node:assert/strict';
import { storageDisclosure } from '../public/storage-disclosure.js';

test('local workspaces disclose local storage and separate AI provider processing', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'preview.localhost']) {
    const copy = storageDisclosure(hostname);
    assert.equal(copy.workspaceLabel, 'Local workspace');
    assert.equal(copy.storageLabel, 'Stored on this computer');
    assert.match(copy.historyNotice, /Saved on this computer/);
    assert.match(copy.uploadNotice, /stored on this computer/i);
    assert.match(copy.uploadNotice, /AI-assisted mode also sends review content to the configured AI provider/);
  }
});

test('hosted workspaces disclose non-durable storage accurately until a persistent disk is verified', () => {
  const copy = storageDisclosure('packsignal.onrender.com');
  assert.equal(copy.workspaceLabel, 'Hosted workspace');
  assert.equal(copy.storageLabel, 'Server storage · retention depends on setup');
  assert.match(copy.historyNotice, /persistent-storage configuration/i);
  assert.match(copy.uploadNotice, /retention depends on the server's persistent-storage configuration/i);
  assert.match(copy.uploadNotice, /AI-assisted mode also sends review content to the configured AI provider/);
  assert.doesNotMatch(copy.uploadNotice, /this computer|private/i);
});

test('hosted workspaces disclose the persistent disk only after the server verifies it', () => {
  const copy = storageDisclosure('packsignal.onrender.com', { persistent: true });
  assert.equal(copy.storageLabel, 'Persistent service disk');
  assert.match(copy.historyNotice, /configured persistent service disk/i);
  assert.match(copy.uploadNotice, /configured persistent service disk/i);
  assert.match(copy.uploadNotice, /Backup and retention follow the hosting provider's policy/i);
});

test('other hosted deployments disclose that retention depends on their storage setup', () => {
  const copy = storageDisclosure('demo.example.com');
  assert.equal(copy.storageLabel, 'Server storage · retention depends on setup');
  assert.match(copy.historyNotice, /persistent-storage configuration/i);
  assert.match(copy.uploadNotice, /retention depends on the server's persistent-storage configuration/i);
});

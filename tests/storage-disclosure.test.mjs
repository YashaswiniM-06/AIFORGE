import test from 'node:test';
import assert from 'node:assert/strict';
import { storageDisclosure } from '../public/storage-disclosure.js';

test('local workspaces disclose local storage and separate AI provider processing', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'preview.localhost']) {
    const copy = storageDisclosure(hostname);
    assert.equal(copy.workspaceLabel, 'Local workspace');
    assert.equal(copy.storageLabel, 'Stored on this computer');
    assert.match(copy.uploadNotice, /stored on this computer/i);
    assert.match(copy.uploadNotice, /AI-assisted mode also sends review content to the configured AI provider/);
  }
});

test('hosted workspaces disclose server storage without claiming local or private storage', () => {
  const copy = storageDisclosure('packsignal.onrender.com');
  assert.equal(copy.workspaceLabel, 'Hosted workspace');
  assert.equal(copy.storageLabel, 'Stored on the server running PackSignal');
  assert.match(copy.uploadNotice, /stored on the server running PackSignal/i);
  assert.match(copy.uploadNotice, /AI-assisted mode also sends review content to the configured AI provider/);
  assert.doesNotMatch(copy.uploadNotice, /this computer|private/i);
});

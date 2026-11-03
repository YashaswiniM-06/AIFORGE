import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPersistentMount } from '../lib/persistent-storage.mjs';

test('ordinary directories and data paths outside the configured mount are never reported as persistent', async () => {
  const data = await mkdtemp(join(tmpdir(), 'packsignal-storage-check-'));
  try {
    assert.equal(await verifyPersistentMount(data, data), false, 'A normal directory shares the parent filesystem and is not a verified mount.');
    assert.equal(await verifyPersistentMount(data, join(data, 'unmounted-child')), false, 'A mount path that does not exist is rejected.');
    assert.equal(await verifyPersistentMount(data, '/'), false, 'Data outside the configured mount is rejected.');
    assert.equal(await verifyPersistentMount(data, ''), false, 'An empty mount setting is not persistent storage.');
  } finally {
    await rm(data, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCachedVehicles,
  getQueueRows,
  initializeOfflineQueue,
  prepareOfflineSyncChunk,
  queueOfflineScan,
} from '../src/features/offline-sync/services/offlineQueueStore.web.js';

test('web queue store does not expose native offline persistence', async () => {
  assert.equal(await initializeOfflineQueue(), false);
  assert.deepEqual(await getCachedVehicles(), []);
  assert.deepEqual(await getQueueRows('USR-1'), []);
  assert.deepEqual(await prepareOfflineSyncChunk('USR-1'), []);
  await assert.rejects(queueOfflineScan({}), /unavailable on web/);
});

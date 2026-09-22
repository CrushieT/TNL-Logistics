import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfflineQueueItem, buildSyncChunk, canQueueOfflineItem, isOfflineSingleScanBlocked, mapSyncOutcome, resolveRetryDelay, validateSyncResponse } from '../src/features/offline-sync/offlineQueueFlow.mjs';

const item = buildOfflineQueueItem({ clientEventId: 'a', ownerUserId: 'USR-1', trackingId: 'trk-2026-000001', targetStatus: 'ARRIVED_AT_TNL', clientSequence: 1 });

test('offline queue normalizes tracking IDs and rejects equivalent pending scans', () => {
  assert.equal(item.trackingId, 'TRK-2026-000001');
  assert.equal(canQueueOfflineItem([item], item).allowed, false);
});

test('offline queue keeps owner isolation and sequence ordering', () => {
  const later = { ...item, clientEventId: 'b', clientSequence: 2 };
  const other = { ...item, clientEventId: 'c', ownerUserId: 'USR-2', clientSequence: 0 };
  assert.deepEqual(buildSyncChunk([later, other, item], 'USR-1').map((row) => row.clientEventId), ['a', 'b']);
});

test('offline sync response must match every submitted event exactly once', () => {
  assert.equal(validateSyncResponse([item], { results: [{ clientEventId: 'a' }] }), true);
  assert.equal(validateSyncResponse([item], { results: [{ clientEventId: 'a' }, { clientEventId: 'a' }] }), false);
});

test('offline queue maps terminal and retryable outcomes safely', () => {
  assert.equal(mapSyncOutcome({ outcome: 'CONFLICT' }).queueStatus, 'CONFLICT');
  assert.equal(mapSyncOutcome({ retryable: true }).queueStatus, 'RETRYABLE');
  assert.equal(resolveRetryDelay(0, 60), 60000);
});

test('offline single scan is blocked only on native devices without connectivity', () => {
  assert.equal(isOfflineSingleScanBlocked('SINGLE', false, true), true);
  assert.equal(isOfflineSingleScanBlocked('BATCH', false, true), false);
  assert.equal(isOfflineSingleScanBlocked('SINGLE', true, true), false);
  assert.equal(isOfflineSingleScanBlocked('SINGLE', false, false), false);
});

test('offline retry chunks wait until their next scheduled attempt', () => {
  const retryAt = new Date('2030-01-01T00:00:00.000Z').toISOString();
  assert.equal(buildSyncChunk([{ ...item, queueStatus: 'RETRYABLE', nextAttemptAt: retryAt }], 'USR-1', 100, Date.parse('2029-12-31T23:59:59.000Z')).length, 0);
  assert.equal(buildSyncChunk([{ ...item, queueStatus: 'RETRYABLE', nextAttemptAt: retryAt }], 'USR-1', 100, Date.parse(retryAt)).length, 1);
  assert.equal(resolveRetryDelay(0, 60, 0.8), 60000);
});

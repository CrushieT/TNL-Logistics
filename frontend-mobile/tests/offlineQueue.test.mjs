import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfflineQueueItem, buildSyncChunk, canManuallyRetry, canQueueOfflineItem, isOfflineSingleScanBlocked, mapSyncOutcome, resolveRetryDelay, retryTimerDelay, safeOfflineReason, summarizeOfflineQueue, validateStoredQueueRow, validateSyncResponse } from '../src/features/offline-sync/offlineQueueFlow.mjs';

test('AC-23 timer wakes at bounded intervals while preserving a long server deadline', () => {
  const now = Date.parse('2026-09-23T00:00:00Z');
  assert.equal(retryTimerDelay('2026-10-23T00:00:00Z', now), 1_800_000);
  assert.equal(retryTimerDelay('2026-09-23T00:00:05Z', now), 5_000);
  assert.equal(retryTimerDelay('invalid', now), null);
});

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
  const result = { clientEventId: 'a', outcome: 'APPLIED', code: 'TRANSITION_APPLIED', retryable: false };
  assert.equal(validateSyncResponse([item], { results: [result] }), true);
  assert.equal(validateSyncResponse([item], { results: [result, result] }), false);
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

test('AC-16 rejects malformed item outcomes before changing a chunk', () => {
  const validResult = { clientEventId: item.clientEventId, outcome: 'APPLIED', retryable: false, code: 'TRANSITION_APPLIED' };
  assert.equal(validateSyncResponse([item], { results: [validResult] }), true);
  assert.equal(validateSyncResponse([item], { results: [{ ...validResult, outcome: 'UNKNOWN' }] }), false);
  assert.equal(validateSyncResponse([item], { results: [{ ...validResult, retryable: true }] }), false);
  assert.equal(validateSyncResponse([item], { results: [{ ...validResult, code: '<script>' }] }), false);
});

test('AC-23 preserves a server Retry-After longer than local backoff', () => {
  assert.equal(resolveRetryDelay(0, 3600, 0.8), 3600000);
  assert.equal(resolveRetryDelay(4, 0, 1.2), 1800000);
});

test('AC-17 rejects tampered SQLite command fields before upload', () => {
  const valid = { ...item, clientEventId: 'ef30a58c-49b2-4d41-9321-f78277b40cdd', capturedAt: '2026-09-23T00:00:00Z' };
  assert.equal(validateStoredQueueRow(valid, 'USR-1', Date.parse('2026-09-23T00:00:00Z')), true);
  for (const changed of [{ ownerUserId: 'USR-2' }, { targetStatus: 'COMPLETED' },
    { vehicleId: 'VH-001' }, { capturedAt: '1900-01-01T00:00:00Z' }, { clientSequence: 0 }]) {
    assert.equal(validateStoredQueueRow({ ...valid, ...changed }, 'USR-1', Date.parse('2026-09-23T00:00:00Z')), false);
  }
});

test('AC-18 and AC-21 expose counts and allowlisted reasons without raw messages', () => {
  assert.deepEqual(summarizeOfflineQueue([{ queueStatus: 'PENDING' }, { queueStatus: 'RETRYABLE' }, { queueStatus: 'CONFLICT' }]),
    { pending: 1, retryable: 1, terminal: 1 });
  assert.equal(safeOfflineReason('<script>'), null);
  assert.equal(safeOfflineReason('__proto__'), null);
  assert.equal(typeof safeOfflineReason('VEHICLE_MISMATCH'), 'string');
});

test('AC-23 manual retry bypasses local backoff but not a future 429 deadline', () => {
  const future = '2030-01-01T00:00:00Z';
  const retryable = { ...item, queueStatus: 'RETRYABLE', nextAttemptAt: future, lastOutcomeCode: 'TEMPORARY_FAILURE' };
  assert.equal(canManuallyRetry(retryable, true, true, Date.parse('2029-01-01T00:00:00Z')), true);
  assert.equal(buildSyncChunk([retryable], 'USR-1', 100, Date.parse('2029-01-01T00:00:00Z'), true).length, 1);
  const rateLimited = { ...retryable, lastOutcomeCode: 'HTTP_429' };
  assert.equal(canManuallyRetry(rateLimited, true, true, Date.parse('2029-01-01T00:00:00Z')), false);
  assert.equal(buildSyncChunk([rateLimited], 'USR-1', 100, Date.parse('2029-01-01T00:00:00Z'), true).length, 0);
});

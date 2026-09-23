import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineSyncCoordinator } from '../src/features/offline-sync/offlineSyncCoordinator.mjs';

const row = { clientEventId: 'a', trackingId: 'TRK-2026-000001', targetStatus: 'ARRIVED_AT_TNL',
  vehicleId: null, capturedAt: '2026-09-22T00:00:00Z', clientSequence: 1, attemptCount: 0 };

function createHarness(submit) {
  const calls = [];
  const environment = { ownerUserId: 'USR-1', isReady: true, isAuthenticated: true, isOnline: true, isForeground: true };
  let hasChunk = true;
  const queue = {
    async prepareOfflineSyncChunk(ownerUserId, now, manual) {
      calls.push(['prepare', ownerUserId, manual]);
      if (!hasChunk) return [];
      hasChunk = false;
      return [row];
    },
    async applyOfflineSyncResponse(...args) { calls.push(['apply', ...args]); },
    async returnChunkToPending(...args) { calls.push(['pending', ...args]); },
    async returnChunkToRetryable(...args) { calls.push(['retryable', ...args]); },
    async rejectChunk(...args) { calls.push(['reject', ...args]); },
    async rejectOwnerUnresolved(...args) { calls.push(['rejectOwner', ...args]); },
  };
  const coordinator = createOfflineSyncCoordinator({ queue, submit, getEnvironment: () => environment,
    onStateChange: (state) => calls.push(['state', state]), onQueueChanged: () => calls.push(['refresh']),
    onAcknowledged: () => calls.push(['acknowledged']),
    onPasswordReauthentication: () => calls.push(['passwordReauth']),
    cancelRetry: () => calls.push(['cancelRetry']), scheduleNextRetry: () => calls.push(['scheduleRetry']) });
  return { calls, environment, coordinator };
}

test('AC-15 lost response retries the same event ID without local removal', async () => {
  const { calls, coordinator } = createHarness(async (items) => {
    assert.equal(items[0].clientEventId, row.clientEventId);
    throw { status: null };
  });
  await coordinator.syncNow();
  assert.equal(calls.some(([name]) => name === 'apply'), false);
  const retry = calls.find(([name]) => name === 'retryable');
  assert.equal(retry[1], 'USR-1');
  assert.equal(retry[2][0].clientEventId, row.clientEventId);
  assert.equal(retry[3], 'TEMPORARY_FAILURE');
});

test('AC-20 a 401 resets the current chunk and pauses without another upload', async () => {
  const { calls, coordinator } = createHarness(async () => { throw { status: 401, code: 'SESSION_REAUTH_REQUIRED' }; });
  await coordinator.syncNow();
  assert.deepEqual(calls.filter(([name]) => name === 'pending').length, 1);
  assert.equal(calls.some(([name]) => name === 'passwordReauth'), false);
  assert.equal(calls.some(([name]) => name === 'scheduleRetry'), false);
});

test('AC-20 an ordinary 401 invokes password reauthentication once', async () => {
  const { calls, coordinator } = createHarness(async () => { throw { status: 401 }; });
  await coordinator.syncNow();
  assert.equal(calls.filter(([name]) => name === 'passwordReauth').length, 1);
});

test('AC-18 an owner change in flight cannot apply the response', async () => {
  let resolveRequest;
  const { calls, environment, coordinator } = createHarness(() => new Promise((resolve) => { resolveRequest = resolve; }));
  const running = coordinator.syncNow();
  while (!resolveRequest) await Promise.resolve();
  environment.ownerUserId = 'USR-2';
  resolveRequest({ results: [{ clientEventId: 'a', outcome: 'APPLIED', code: 'TRANSITION_APPLIED', retryable: false }] });
  await running;
  assert.equal(calls.some(([name]) => name === 'apply'), false);
  assert.equal(calls.filter(([name]) => name === 'pending').length, 1);
});

test('AC-23 a 429 retains server deadline and manual retry is not immediate', async () => {
  const { calls, coordinator } = createHarness(async () => { throw { status: 429, retryAfterSeconds: 3600 }; });
  await coordinator.syncNow(true);
  const retry = calls.find(([name]) => name === 'retryable');
  assert.equal(retry[3], 'HTTP_429');
  assert.ok(Date.parse(retry[4]) - Date.now() > 3_590_000);
});

test('AC-16 invalid responses retry the whole chunk with a safe code', async () => {
  const { calls, coordinator } = createHarness(async () => { throw { code: 'INVALID_SYNC_RESPONSE' }; });
  await coordinator.syncNow();
  assert.equal(calls.find(([name]) => name === 'retryable')[3], 'INVALID_SYNC_RESPONSE');
});

test('AC-02 role denial rejects all owner unresolved rows', async () => {
  const { calls, coordinator } = createHarness(async () => { throw { status: 403 }; });
  await coordinator.syncNow();
  assert.deepEqual(calls.find(([name]) => name === 'rejectOwner').slice(1), ['USR-1', 'ROLE_DENIED']);
});

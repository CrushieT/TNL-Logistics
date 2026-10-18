import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveKey,
  isCancellationError,
  createRequestCoordinator,
} from '../src/services/api/requestCoordinator.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('deriveKey creates deterministic canonical keys regardless of parameter ordering', () => {
  const key1 = deriveKey('reports', { endDate: '2026-10-17', startDate: '2026-10-01' });
  const key2 = deriveKey('reports', { startDate: '2026-10-01', endDate: '2026-10-17' });
  assert.equal(key1, key2);
  assert.equal(key1, 'reports:endDate=2026-10-17&startDate=2026-10-01');

  // Trims values and filters empty/null/undefined
  const key3 = deriveKey('dashboard', { cycle: ' 2026-10-15 ', emptyVal: '', nullVal: null, undef: undefined });
  assert.equal(key3, 'dashboard:cycle=2026-10-15');

  // Empty params returns scope name
  assert.equal(deriveKey('tracking-metrics'), 'tracking-metrics');
});

test('isCancellationError detects AbortError and CanceledError without false positives', () => {
  assert.equal(isCancellationError({ name: 'AbortError' }), true);
  assert.equal(isCancellationError({ name: 'CanceledError' }), true);
  assert.equal(isCancellationError({ code: 'ERR_CANCELED' }), true);
  assert.equal(isCancellationError({ isCanceled: true }), true);
  assert.equal(isCancellationError(new Error('Network timeout')), false);
  assert.equal(isCancellationError(null), false);
});

test('in-flight overlap prevention: concurrent triggers for the same key do not fire parallel requests', async () => {
  let activeFetches = 0;
  let peakConcurrency = 0;
  const d1 = deferred();

  const coordinator = createRequestCoordinator({
    scope: 'test',
    onSuccess: () => {},
  });

  const fetcher = async () => {
    activeFetches++;
    peakConcurrency = Math.max(peakConcurrency, activeFetches);
    await d1.promise;
    activeFetches--;
    return { result: 'ok' };
  };

  const req1 = coordinator.request('key1', fetcher);
  const req2 = coordinator.request('key1', fetcher);

  assert.equal(coordinator.getInFlight(), true);
  assert.equal(coordinator.hasQueuedFollowUp(), true);

  d1.resolve();
  await req1;
  await req2;

  assert.equal(peakConcurrency, 1, 'Should never exceed 1 concurrent request for the same key');
});

test('key change cancels in-flight obsolete request via AbortController', async () => {
  let signal1Aborted = false;
  const d1 = deferred();
  const d2 = deferred();

  const coordinator = createRequestCoordinator({
    scope: 'test',
  });

  const fetcher1 = async (signal) => {
    signal.addEventListener('abort', () => {
      signal1Aborted = true;
    });
    await d1.promise;
    return 'first';
  };

  const fetcher2 = async () => {
    await d2.promise;
    return 'second';
  };

  coordinator.request('key1', fetcher1);
  assert.equal(signal1Aborted, false);

  // Key changes to key2 while key1 is in flight
  coordinator.request('key2', fetcher2);
  assert.equal(signal1Aborted, true, 'Signal for key1 should be aborted immediately on key change');

  d1.resolve();
  d2.resolve();
});

test('stale response ordering: older request resolving after newer request is ignored via generation guard', async () => {
  const successes = [];
  const d1 = deferred();
  const d2 = deferred();

  const coordinator = createRequestCoordinator({
    scope: 'test',
    onSuccess: (data) => successes.push(data),
  });

  // Start request 1 (generation 1)
  coordinator.request('key1', async () => {
    await d1.promise;
    return 'first-slow';
  });

  // Switch to request 2 (generation 2)
  coordinator.request('key2', async () => {
    await d2.promise;
    return 'second-fast';
  });

  // Resolve request 2 first
  d2.resolve();
  await new Promise((r) => setTimeout(r, 10));

  // Resolve request 1 later
  d1.resolve();
  await new Promise((r) => setTimeout(r, 10));

  assert.deepEqual(successes, ['second-fast'], 'Older response should be discarded by generation guard');
});

test('coalescing: multiple triggers during an active request queue at most ONE follow-up', async () => {
  let executionCount = 0;
  const d1 = deferred();
  const d2 = deferred();

  const coordinator = createRequestCoordinator({
    scope: 'test',
  });

  const fetcher = async () => {
    executionCount++;
    if (executionCount === 1) {
      await d1.promise;
    } else {
      await d2.promise;
    }
    return `run-${executionCount}`;
  };

  // Start first request
  coordinator.request('key1', fetcher);

  // Trigger 5 refresh attempts while request 1 is in-flight
  coordinator.request('key1', fetcher);
  coordinator.request('key1', fetcher);
  coordinator.request('key1', fetcher);
  coordinator.request('key1', fetcher);
  coordinator.request('key1', fetcher);

  assert.equal(coordinator.hasQueuedFollowUp(), true);

  // Release request 1
  d1.resolve();
  await new Promise((r) => setTimeout(r, 10));

  // Request 2 (the single queued follow-up) is now running
  assert.equal(executionCount, 2);

  // Release request 2
  d2.resolve();
  await new Promise((r) => setTimeout(r, 10));

  // No more executions: total is exactly 2 runs, not 6
  assert.equal(executionCount, 2, 'Should coalesce 5 queued triggers into exactly 1 follow-up');
});

test('event burst debouncing: bursts within 300 ms trigger only once', async () => {
  let executions = 0;
  const coordinator = createRequestCoordinator({
    scope: 'test',
    debounceMs: 50,
  });

  const fetcher = async () => {
    executions++;
    return 'ok';
  };

  // Rapid burst of 4 calls
  coordinator.request('key1', fetcher, { debounce: true });
  coordinator.request('key1', fetcher, { debounce: true });
  coordinator.request('key1', fetcher, { debounce: true });
  coordinator.request('key1', fetcher, { debounce: true });

  assert.equal(executions, 0, 'Should not execute immediately when debounced');

  await new Promise((r) => setTimeout(r, 80));

  assert.equal(executions, 1, 'Should execute exactly once after debounce timer settles');
});

test('unmount cancels active request and ignores subsequent triggers', async () => {
  let aborted = false;
  let successCalled = false;
  const d1 = deferred();

  const coordinator = createRequestCoordinator({
    scope: 'test',
    onSuccess: () => {
      successCalled = true;
    },
  });

  coordinator.request('key1', async (signal) => {
    signal.addEventListener('abort', () => {
      aborted = true;
    });
    await d1.promise;
    return 'data';
  });

  assert.equal(aborted, false);
  coordinator.unmount();
  assert.equal(aborted, true, 'Active controller should be aborted on unmount');

  d1.resolve();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(successCalled, false, 'onSuccess must not be invoked after unmount');

  // Triggering after unmount returns unmounted status
  const postUnmount = await coordinator.request('key1', async () => 'data');
  assert.equal(postUnmount.status, 'unmounted');
});

test('React development remounts (mount -> unmount -> mount) resets cleanly without state leaks', async () => {
  const successes = [];

  // Simulate mount 1
  const coordinator1 = createRequestCoordinator({
    scope: 'test',
    onSuccess: (data) => successes.push(`mount1:${data}`),
  });
  const d1 = deferred();
  coordinator1.request('key1', async () => {
    await d1.promise;
    return 'res1';
  });

  // React StrictMode remount: unmount 1
  coordinator1.unmount();

  // Simulate mount 2
  const coordinator2 = createRequestCoordinator({
    scope: 'test',
    onSuccess: (data) => successes.push(`mount2:${data}`),
  });
  const d2 = deferred();
  coordinator2.request('key1', async () => {
    await d2.promise;
    return 'res2';
  });

  // Resolve both deferred promises
  d1.resolve();
  d2.resolve();
  await new Promise((r) => setTimeout(r, 20));

  // Mount 1 must not emit, only Mount 2
  assert.deepEqual(successes, ['mount2:res2']);
});

test('hidden/inactive screen: background refreshes are suspended and resumed at most once', async () => {
  let silentCalls = 0;
  const coordinator = createRequestCoordinator({
    scope: 'test',
  });

  // Tab becomes hidden
  coordinator.setVisibility(false);

  const silentFetcher = async () => {
    silentCalls++;
    return 'silent';
  };

  // Attempt background refresh while hidden
  const res = await coordinator.request('key1', silentFetcher, { isSilent: true });
  assert.equal(res.status, 'suspended');
  assert.equal(silentCalls, 0, 'Should not fetch while hidden');
  assert.equal(coordinator.hasMissedRefresh(), true);

  // Tab becomes visible again with registered resume fetcher
  coordinator.setVisibility(true, silentFetcher);
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(silentCalls, 1, 'Should trigger exactly one catch-up refresh on return');
  assert.equal(coordinator.hasMissedRefresh(), false);
});

test('cancellation is treated as normal cleanup without invoking onError', async () => {
  let errorInvoked = false;
  const coordinator = createRequestCoordinator({
    scope: 'test',
    onError: () => {
      errorInvoked = true;
    },
  });

  const req = coordinator.request('key1', async (signal) => {
    const err = new Error('Request was aborted');
    err.name = 'AbortError';
    throw err;
  });

  const res = await req;
  assert.equal(res.status, 'cancelled');
  assert.equal(errorInvoked, false, 'onError should NOT be called for cancellation');
});

test('mount reactivates the same instance without resetting generation or restoring work', async () => {
  const obsolete = deferred();
  const successes = [];
  let firstSignal;
  let cancelledExecutions = 0;
  const coordinator = createRequestCoordinator({ onSuccess: data => successes.push(data), debounceMs: 10 });
  const pending = coordinator.request('same', signal => { firstSignal = signal; return obsolete.promise; });
  await coordinator.request('same', async () => { cancelledExecutions++; });
  coordinator.request('same', async () => { cancelledExecutions++; }, { debounce: true });
  coordinator.unmount();
  const cleanupGeneration = coordinator.getGeneration();
  assert.equal(firstSignal.aborted, true);
  coordinator.mount(); coordinator.mount();
  assert.equal(coordinator.getGeneration(), cleanupGeneration);
  assert.equal(coordinator.hasQueuedFollowUp(), false);
  assert.equal(coordinator.hasMissedRefresh(), false);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(cancelledExecutions, 0);
  assert.deepEqual(successes, []);
  assert.equal((await coordinator.request('same', async () => 'fresh')).status, 'success');
  obsolete.resolve('obsolete'); await pending;
  assert.deepEqual(successes, ['fresh']);
  coordinator.unmount();
});

test('highlightDiff survives debounce, queued refresh, and visibility resume without overriding owned metadata', async () => {
  const metadata = [];
  const coordinator = createRequestCoordinator({ onSuccess: (data, meta) => metadata.push(meta), debounceMs: 5 });
  const options = { highlightDiff: true, isSilent: true, key: 'forged', generation: -1 };
  await coordinator.request('actual', async () => 'debounced', { ...options, debounce: true });
  const first = deferred();
  const pending = coordinator.request('actual', () => first.promise);
  await coordinator.request('actual', async () => 'queued', options);
  first.resolve('first'); await pending;
  await new Promise(resolve => setImmediate(resolve));
  coordinator.setVisibility(false);
  await coordinator.request('actual', async () => 'resumed', options);
  await coordinator.setVisibility(true);
  assert.deepEqual(metadata.map(meta => meta.highlightDiff), [true, false, true, true]);
  metadata.forEach(meta => { assert.equal(meta.key, 'actual'); assert.ok(meta.generation > 0); });
  coordinator.unmount();
});

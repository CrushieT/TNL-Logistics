import * as cache from '../src/services/api/responseCache.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as sseCore from '../src/services/api/sseClientCore.mjs';
import { createSseStreamParser, calculateBackoffDelay, isAuthFailureStatus } from '../src/services/api/sseClientCore.mjs';

test('createSseStreamParser ignores :keepalive and comment lines without triggering events', () => {
  const events = [];
  const parser = createSseStreamParser((type, data) => {
    events.push({ type, data });
  });

  // Feed W3C SSE comment lines
  parser.feed(':keepalive\n\n');
  parser.feed(': ping\n');
  parser.feed(':\n\n');

  assert.equal(events.length, 0, 'No events should be dispatched for comment lines');
});

test('createSseStreamParser correctly parses PAYMENT_RECORDED events with financial payload', () => {
  const events = [];
  const parser = createSseStreamParser((type, data) => {
    events.push({ type, data });
  });

  const payload = JSON.stringify({
    paymentId: 1042,
    shipmentId: 'SHP-2026-007',
    amountPaid: 500,
    shipmentBalance: 0,
    shipmentPaymentStatus: 'Paid',
  });

  parser.feed(`event: PAYMENT_RECORDED\ndata: ${payload}\n\n`);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'PAYMENT_RECORDED');
  assert.equal(events[0].data.paymentId, 1042);
  assert.equal(events[0].data.shipmentId, 'SHP-2026-007');
  assert.equal(events[0].data.amountPaid, 500);
  assert.equal(events[0].data.shipmentPaymentStatus, 'Paid');
});

test('createSseStreamParser parses SOA_UPDATED events used to refresh settlement state', () => {
  const events = [];
  const parser = createSseStreamParser((type, data) => {
    events.push({ type, data });
  });

  const payload = JSON.stringify({
    soaNo: 'SOA-2026-CL001-W40',
    clientId: 'CL001',
    shipmentIds: ['SHP-2026-011'],
  });

  parser.feed(`event: SOA_UPDATED\ndata: ${payload}\n\n`);

  assert.deepEqual(events, [{
    type: 'SOA_UPDATED',
    data: {
      soaNo: 'SOA-2026-CL001-W40',
      clientId: 'CL001',
      shipmentIds: ['SHP-2026-011'],
    },
  }]);
});

test('createSseStreamParser handles chunk fragmentation across network boundaries', () => {
  const events = [];
  const parser = createSseStreamParser((type, data) => {
    events.push({ type, data });
  });

  // Split packet across multiple chunks
  parser.feed('event: STATUS');
  assert.equal(events.length, 0);

  parser.feed('_UPDATE\nda');
  assert.equal(events.length, 0);

  parser.feed('ta: {"trackingId":"TRK-2026-000101","status');
  assert.equal(events.length, 0);

  parser.feed('":"LOADED_ON_TRUCK"}\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'STATUS_UPDATE');
  assert.equal(events[0].data.trackingId, 'TRK-2026-000101');
  assert.equal(events[0].data.status, 'LOADED_ON_TRUCK');
});

test('createSseStreamParser parses multiple events in a single chunk', () => {
  const events = [];
  const parser = createSseStreamParser((type, data) => {
    events.push({ type, data });
  });

  const streamChunk =
    'event: SHIPMENT_CREATED\ndata: {"shipmentId":"SHP-001"}\n\n' +
    ':keepalive\n\n' +
    'event: LABEL_PRINTED\ndata: {"shipmentId":"SHP-001","trackingIds":["TRK-01"]}\n\n';

  parser.feed(streamChunk);

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'SHIPMENT_CREATED');
  assert.equal(events[0].data.shipmentId, 'SHP-001');
  assert.equal(events[1].type, 'LABEL_PRINTED');
  assert.deepEqual(events[1].data.trackingIds, ['TRK-01']);
});

test('createSseStreamParser handles raw non-JSON payloads gracefully without throwing', () => {
  const events = [];
  const parser = createSseStreamParser((type, data) => {
    events.push({ type, data });
  });

  parser.feed('event: NOTIFICATION\ndata: Plain string message without json\n\n');

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'NOTIFICATION');
  assert.equal(events[0].data, 'Plain string message without json');
});

test('createSseStreamParser reset clears incomplete buffer', () => {
  const events = [];
  const parser = createSseStreamParser((type, data) => {
    events.push({ type, data });
  });

  parser.feed('event: PARTIAL\ndata: incomplete');
  parser.reset();
  parser.feed('\n\n');

  assert.equal(events.length, 0, 'No event should dispatch from a reset buffer');
});

test('calculateBackoffDelay follows exponential schedule (1s, 2s, 4s, 8s, 16s, 30s ceiling) with bounded jitter', () => {
  // Test with randomFactor = 0 (exact base)
  assert.equal(calculateBackoffDelay(0, 0), 1000);
  assert.equal(calculateBackoffDelay(1, 0), 2000);
  assert.equal(calculateBackoffDelay(2, 0), 4000);
  assert.equal(calculateBackoffDelay(3, 0), 8000);
  assert.equal(calculateBackoffDelay(4, 0), 16000);
  assert.equal(calculateBackoffDelay(5, 0), 30000);
  assert.equal(calculateBackoffDelay(10, 0), 30000);

  // Test with randomFactor = 1.0 (max jitter of 250ms, ceiling of 30s)
  assert.equal(calculateBackoffDelay(0, 1.0), 1250);
  assert.equal(calculateBackoffDelay(1, 1.0), 2250);
  assert.equal(calculateBackoffDelay(2, 1.0), 4250);
  assert.equal(calculateBackoffDelay(3, 1.0), 8250);
  assert.equal(calculateBackoffDelay(4, 1.0), 16250);
  assert.equal(calculateBackoffDelay(5, 1.0), 30000, 'Must never exceed 30s ceiling even with max jitter');
});

test('isAuthFailureStatus identifies 401 Unauthorized and 403 Forbidden as unrecoverable auth failures', () => {
  assert.equal(isAuthFailureStatus(401), true);
  assert.equal(isAuthFailureStatus(403), true);
  assert.equal(isAuthFailureStatus(500), false);
  assert.equal(isAuthFailureStatus(503), false);
  assert.equal(isAuthFailureStatus(404), false);
  assert.equal(isAuthFailureStatus(200), false);
});


const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function createClientHarness() {
  let auth = { userId: 'ADMIN-A', sessionGeneration: 1, isAuthenticated: true, isVerified: true };
  let token = 'test-token-a';
  const changed = new Set();
  const invalidated = new Set();
  const attempts = [];
  const timers = new Map();
  let timerId = 0;
  const session = {
    getToken: () => token,
    getSessionAuthContext: () => ({ ...auth }),
    onSessionChanged: callback => { changed.add(callback); },
    onSessionInvalidated: callback => { invalidated.add(callback); },
  };
  const { code } = transformSync(readFileSync(new URL('../src/services/api/sseClient.js', import.meta.url), 'utf8'), {
    configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'window', 'setTimeout', 'clearTimeout', 'console', code)(
    dependency => dependency === './responseCache.mjs' ? cache : dependency === './client' ? session : dependency === 'react-native' ? { Platform: { OS: 'web' } } : sseCore,
    module, module.exports,
    (url, options) => {
      const response = deferred(); attempts.push({ url, options, ...response }); return response.promise;
    }, {},
    (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    id => timers.delete(id), { warn() {} },
  );
  return {
    client: module.exports, attempts, timers,
    async settle() { for (let index = 0; index < 4; index++) await new Promise(resolve => setImmediate(resolve)); },
    changeSession(next = {}, nextToken = token, notify = true) {
      auth = { ...auth, ...next }; token = nextToken;
      if (notify) changed.forEach(callback => callback());
    },
    invalidate() {
      auth = { ...auth, userId: null, sessionGeneration: auth.sessionGeneration + 1, isAuthenticated: false, isVerified: false };
      token = null; invalidated.forEach(callback => callback()); changed.forEach(callback => callback());
    },
    runTimer() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id); timer.callback();
    },
  };
}

function streamingResponse() {
  const reads = [];
  return {
    reads,
    response: { ok: true, status: 200, body: { getReader: () => ({ read() { const next = deferred(); reads.push(next); return next.promise; } }) } },
  };
}

for (const status of [401, 403]) {
  test(`actual SSE client ignores obsolete ${status} after account change`, async () => {
    const harness = createClientHarness();
    const unsubscribe = harness.client.subscribeRealtimeEvents(() => {});
    harness.changeSession({ userId: 'ADMIN-B', sessionGeneration: 2 }, 'test-token-b');
    assert.equal(harness.attempts.length, 2);
    assert.equal(harness.attempts[0].options.signal.aborted, true);
    harness.attempts[0].resolve({ ok: false, status }); await harness.settle();
    await harness.client.initRealtimeConnection();
    assert.equal(harness.attempts.length, 2);
    assert.equal(harness.attempts[1].options.signal.aborted, false);
    assert.equal(harness.timers.size, 0);
    unsubscribe();
  });

  test(`actual SSE client reconnects with renewed token after obsolete ${status}`, async () => {
    const harness = createClientHarness();
    const unsubscribe = harness.client.subscribeRealtimeEvents(() => {});
    // Sliding renewal updates the token without emitting a session-change notification.
    harness.changeSession({}, 'test-token-renewed', false);
    harness.attempts[0].resolve({ ok: false, status }); await harness.settle();
    assert.equal(harness.attempts.length, 2);
    assert.equal(harness.attempts[1].options.headers.Authorization, 'Bearer test-token-renewed');
    assert.equal(harness.timers.size, 0);
    unsubscribe();
  });

  test(`actual SSE client stops for genuine ${status} until verified authentication changes`, async () => {
    const harness = createClientHarness();
    const unsubscribe = harness.client.subscribeRealtimeEvents(() => {});
    harness.attempts[0].resolve({ ok: false, status }); await harness.settle();
    harness.changeSession(); await harness.client.initRealtimeConnection();
    assert.equal(harness.attempts.length, 1);
    assert.equal(harness.timers.size, 0);
    harness.changeSession({}, 'new-verified-token');
    assert.equal(harness.attempts.length, 2);
    unsubscribe();
  });
}

test('actual SSE client ignores old cleanup and events after a replacement stream starts', async () => {
  const harness = createClientHarness();
  const events = [];
  const unsubscribe = harness.client.subscribeRealtimeEvents(event => events.push(event));
  const oldStream = streamingResponse();
  harness.attempts[0].resolve(oldStream.response); await harness.settle();
  harness.changeSession({ userId: 'ADMIN-B', sessionGeneration: 2 }, 'test-token-b');
  const newStream = streamingResponse();
  harness.attempts[1].resolve(newStream.response); await harness.settle();
  oldStream.reads[0].resolve({ done: false, value: new TextEncoder().encode('event: STATUS_UPDATE\ndata: {"old":true}\n\n') });
  await harness.settle(); await harness.client.initRealtimeConnection();
  assert.equal(harness.attempts.length, 2);
  assert.equal(harness.attempts[1].options.signal.aborted, false);
  assert.equal(harness.timers.size, 0);
  assert.deepEqual(events, []);
  newStream.reads[0].resolve({ done: false, value: new TextEncoder().encode('event: STATUS_UPDATE\ndata: {"current":true}\n\n') });
  await harness.settle();
  assert.deepEqual(events, [{ type: 'STATUS_UPDATE', data: { current: true } }]);
  unsubscribe(); newStream.reads[1].resolve({ done: true }); await harness.settle();
  assert.equal(harness.timers.size, 0);
});

test('actual SSE client preserves backoff and cancels retries on subscriber teardown', async () => {
  const harness = createClientHarness();
  const unsubscribe = harness.client.subscribeRealtimeEvents(() => {});
  const removeSecondSubscriber = harness.client.subscribeRealtimeEvents(() => {});
  assert.equal(harness.attempts.length, 1);
  harness.attempts[0].resolve({ ok: false, status: 503 }); await harness.settle();
  assert.equal(harness.timers.size, 1);
  assert.ok([...harness.timers.values()][0].delay >= 1000);
  harness.runTimer();
  harness.attempts[1].resolve({ ok: false, status: 503 }); await harness.settle();
  assert.equal(harness.timers.size, 1);
  assert.ok([...harness.timers.values()][0].delay >= 2000);
  unsubscribe(); assert.equal(harness.timers.size, 1);
  removeSecondSubscriber(); assert.equal(harness.timers.size, 0);
});

test('actual SSE client invalidation aborts pending requests and ignores late denial after teardown', async () => {
  const harness = createClientHarness();
  const unsubscribe = harness.client.subscribeRealtimeEvents(() => {});
  harness.invalidate();
  assert.equal(harness.attempts[0].options.signal.aborted, true);
  harness.attempts[0].resolve({ ok: false, status: 401 }); await harness.settle();
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.attempts.length, 1);
  harness.changeSession({ userId: 'ADMIN-B', sessionGeneration: 3, isAuthenticated: true, isVerified: true }, 'test-token-b');
  assert.equal(harness.attempts.length, 2);
  unsubscribe();
  harness.attempts[1].resolve({ ok: false, status: 403 }); await harness.settle();
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.attempts.length, 2);
});

test('actual SSE client ignores an obsolete successful handshake after a current denial', async () => {
  const harness = createClientHarness();
  const unsubscribe = harness.client.subscribeRealtimeEvents(() => {});
  harness.changeSession({ userId: 'ADMIN-B', sessionGeneration: 2 }, 'test-token-b');
  harness.attempts[1].resolve({ ok: false, status: 401 }); await harness.settle();
  harness.attempts[0].resolve(streamingResponse().response); await harness.settle();
  await harness.client.initRealtimeConnection();
  assert.equal(harness.attempts.length, 2);
  assert.equal(harness.timers.size, 0);
  unsubscribe();
});

test('actual SSE client replaces an old-session reconnect timer without duplicate attempts', async () => {
  const harness = createClientHarness();
  const unsubscribe = harness.client.subscribeRealtimeEvents(() => {});
  harness.attempts[0].resolve({ ok: false, status: 503 }); await harness.settle();
  const oldTimer = [...harness.timers.values()][0];
  harness.changeSession({ userId: 'ADMIN-B', sessionGeneration: 2 }, 'test-token-b');
  assert.equal(harness.attempts.length, 2);
  assert.equal(harness.timers.size, 0);
  oldTimer.callback(); await harness.settle();
  assert.equal(harness.attempts.length, 2);
  unsubscribe();
});

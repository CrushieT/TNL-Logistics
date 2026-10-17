import test from 'node:test';
import assert from 'node:assert/strict';
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


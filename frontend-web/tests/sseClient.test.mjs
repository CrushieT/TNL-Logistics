import test from 'node:test';
import assert from 'node:assert/strict';
import { createSseStreamParser } from '../src/services/api/sseClientCore.mjs';

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

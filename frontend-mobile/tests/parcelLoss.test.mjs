import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWaybillCompletionUnlocked } from '../src/features/waybills/waybillReturnFlow.mjs';
import { validateBatchCandidate, normalizeTrackingId, MAX_BATCH_SIZE } from '../src/features/scanner/scannerFlow.mjs';
import { buildWaybillHtml } from '../src/features/waybills/printWaybill.mjs';

test('exception manifests require the revision confirmed by a fresh printed QR scan', () => {
  const manifest = { waybillId: 'WYB-2026-0001', status: 'SENT_TO_HAULER', manifestRevision: 3, lostCount: 1, totalQuantity: 5 };
  assert.equal(isWaybillCompletionUnlocked(manifest, manifest.waybillId), false);
  assert.equal(isWaybillCompletionUnlocked(manifest, manifest.waybillId, 2), false);
  assert.equal(isWaybillCompletionUnlocked(manifest, manifest.waybillId, 3), true);
  assert.equal(isWaybillCompletionUnlocked({ ...manifest, manifestRevision: 4 }, manifest.waybillId, 3), false);
  assert.equal(isWaybillCompletionUnlocked({ ...manifest, lostCount: 5 }, manifest.waybillId, 3), false);
});

test('batch review explains loss without calling an unfinished parcel delivered', () => {
  const result = validateBatchCandidate({ trackingId: 'TRK-LOST', canScan: false, lost: true,
    currentStatusCode: 'ARRIVED_AT_TNL', scanBlockedReason: 'Parcel is lost. Admin must mark it found before scanning.' }, 'LOADED_TO_HAULER', 'DISPATCH_STAFF');
  assert.equal(result.isValid, false);
  assert.match(result.error, /lost/);
  assert.doesNotMatch(result.error, /terminal/);
});

test('mobile reprints retain and identify every original manifest member', () => {
  const html = buildWaybillHtml({ waybillId: 'WYB-2026-0001', statusLabel: 'Closed with Loss', deliveredCount: 1, lostCount: 1,
    parcels: [{ trackingId: 'TRK-OK' }, { trackingId: '<TRK-LOST>', lost: true }], totalQuantity: 2 });
  assert.ok(html.includes('&lt;TRK-LOST&gt; | LOST'));
  assert.ok(html.includes('Delivered: 1 | Lost: 1'));
  assert.equal((html.match(/TRK-OK/g) || []).length, 2);
});

test('the production Dispatch queue rejects lost arrivals and loaded parcels before adding them', async () => {
  const source = readFileSync(new URL('../src/app/(main)/waybills.js', import.meta.url), 'utf8');
  const start = source.indexOf('  const processQueueScan = ');
  assert.ok(start >= 0);
  const end = source.indexOf('\n  };', start) + '\n  };'.length;
  const handlerSource = source.slice(start, end);
  let context;
  let queue = [];
  let error = '';
  const bindings = {
    shipmentId: 'SHP-TEST', batchQueue: queue, availableUnits: [], normalizeTrackingId, MAX_BATCH_SIZE,
    safeHaptics: { warning() {}, error() {}, selection() {} },
    trackingScanApi: { getScanContext: async () => context },
    setError(value) { error = value; }, setNotice() {},
    setBatchQueue(update) { queue = update(queue); },
  };
  const processQueueScan = new Function(...Object.keys(bindings), `${handlerSource}; return processQueueScan;`)(...Object.values(bindings));
  for (const currentStatusCode of ['ARRIVED_AT_TNL', 'LOADED_TO_HAULER']) {
    context = { shipmentId: 'SHP-TEST', currentStatusCode, lost: true, canScan: false, scanBlockedReason: 'Parcel is lost. Admin must mark it found before scanning.' };
    await processQueueScan('TRK-2026-000001');
    assert.deepEqual(queue, []);
    assert.match(error, /lost/);
  }
  context = { shipmentId: 'SHP-TEST', currentStatusCode: 'ARRIVED_AT_TNL', lost: false, canScan: true };
  await processQueueScan('TRK-2026-000001');
  assert.deepEqual(queue, ['TRK-2026-000001']);
  assert.equal(error, '');
});

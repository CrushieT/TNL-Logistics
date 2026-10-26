import test from 'node:test';
import assert from 'node:assert/strict';
import {
  doesWaybillQrMatchOpenManifest,
  isWaybillCompletionUnlocked,
  parseWaybillQrPayload
} from '../src/features/waybills/waybillReturnFlow.mjs';

test('accepts only the exact printed waybill QR payload', () => {
  assert.deepEqual(parseWaybillQrPayload('WAYBILL:WYB-2026-0001'), {
    isValid: true,
    waybillId: 'WYB-2026-0001'
  });
  assert.deepEqual(parseWaybillQrPayload('WAYBILL:WYB-2026-10000'), {
    isValid: true,
    waybillId: 'WYB-2026-10000'
  });
  assert.deepEqual(parseWaybillQrPayload('TNL-WAYBILL:WYB-2026-0001'), {
    isValid: true,
    waybillId: 'WYB-2026-0001'
  });

  for (const value of [
    'TRK-2026-000001',
    'WAYBILL:TRK-2026-000001',
    'waybill:WYB-2026-0001',
    ' WAYBILL:WYB-2026-0001',
    'WAYBILL:WYB-2026-0001 ',
    'WAYBILL:WYB-26-1',
    'WAYBILL:',
    'TNL-WAYBILL:TRK-2026-000001',
    null
  ]) {
    assert.deepEqual(parseWaybillQrPayload(value), { isValid: false, waybillId: null });
  }
});

test('unlocks only a sent manifest with the matching scanned waybill ID', () => {
  const sent = { waybillId: 'WYB-2026-0001', status: 'SENT_TO_HAULER' };
  assert.equal(isWaybillCompletionUnlocked(sent, 'WYB-2026-0001'), true);
  assert.equal(isWaybillCompletionUnlocked(sent, null), false);
  assert.equal(isWaybillCompletionUnlocked(sent, 'WYB-2026-0002'), false);
  assert.equal(isWaybillCompletionUnlocked({ ...sent, status: 'GENERATED' }, sent.waybillId), false);
  assert.equal(isWaybillCompletionUnlocked({ ...sent, status: 'SIGNED_COMPLETED' }, sent.waybillId), false);
});

test('a different waybill QR cannot replace a manually opened manifest', () => {
  const openManifest = { waybillId: 'WYB-2026-0001', status: 'SENT_TO_HAULER' };
  assert.equal(doesWaybillQrMatchOpenManifest(null, 'WYB-2026-0002'), true);
  assert.equal(doesWaybillQrMatchOpenManifest(openManifest, 'WYB-2026-0001'), true);
  assert.equal(doesWaybillQrMatchOpenManifest(openManifest, 'WYB-2026-0002'), false);
});

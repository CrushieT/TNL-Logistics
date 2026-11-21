import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { generateQRMatrix } from '../../utils/qr.js';
import {
  computeParcelBillableWeight,
  groupParcelsByBillableWeight,
  paginateGroups,
  buildWaybillHtml,
  getWaybillQrPayload
} from './printWaybill.mjs';

function decodeMatrix(matrix) {
  const scale = 8;
  const margin = 4;
  const size = (matrix.length + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((row, rowIndex) => row.forEach((isDark, columnIndex) => {
    if (!isDark) return;
    for (let y = 0; y < scale; y += 1) {
      for (let x = 0; x < scale; x += 1) {
        const offset = (((rowIndex + margin) * scale + y) * size + (columnIndex + margin) * scale + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
      }
    }
  }));
  return jsQR(pixels, size, size)?.data;
}

test('computeParcelBillableWeight returns actual weight when actual exceeds volumetric', () => {
  const parcel = { weightKg: 7.5, lengthCm: 20, widthCm: 20, heightCm: 20 };
  assert.equal(computeParcelBillableWeight(parcel, 5000), 7.5);
});

test('computeParcelBillableWeight returns volumetric weight when volume exceeds actual', () => {
  const parcel = { weightKg: 2.0, lengthCm: 50, widthCm: 40, heightCm: 30 };
  assert.equal(computeParcelBillableWeight(parcel, 5000), 12.0);
});

test('groupParcelsByBillableWeight collapses same weight parcels into one row sorted descending', () => {
  const parcels = [
    { trackingId: 'TRK-1', seq: 1, weightKg: 3.0 },
    { trackingId: 'TRK-2', seq: 2, weightKg: 3.0 },
    { trackingId: 'TRK-3', seq: 3, weightKg: 6.5 },
    { trackingId: 'TRK-4', seq: 4, weightKg: 6.5 },
    { trackingId: 'TRK-5', seq: 5, weightKg: 8.0 }
  ];
  const { rows, totalBoxes, totalBillable, lostCount } = groupParcelsByBillableWeight(parcels, 5, 5000);

  assert.equal(rows.length, 3);
  assert.equal(totalBoxes, 5);
  assert.equal(totalBillable, 27.0);
  assert.equal(lostCount, 0);

  assert.equal(rows[0].billableWeight, 8.0);
  assert.equal(rows[0].boxes, 1);
  assert.equal(rows[0].rangeLabel, 'Package 5 of 5');

  assert.equal(rows[1].billableWeight, 6.5);
  assert.equal(rows[1].boxes, 2);
  assert.equal(rows[1].rangeLabel, 'Package 3–4 of 5');

  assert.equal(rows[2].billableWeight, 3.0);
  assert.equal(rows[2].boxes, 2);
  assert.equal(rows[2].rangeLabel, 'Package 1–2 of 5');
});

test('groupParcelsByBillableWeight formats scattered packages compactly as Various (N of Total)', () => {
  const indices = [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 54, 55];
  const parcels = indices.map((seq) => ({ trackingId: `TRK-${seq}`, seq, weightKg: 4.3 }));
  const { rows } = groupParcelsByBillableWeight(parcels, 55, 5000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rangeLabel, 'Various (46 of 55)');
  assert.equal(rows[0].boxes, 46);
});

test('buildWaybillHtml renders grouped table with TOTAL row and two copies', () => {
  const manifest = {
    waybillId: 'WYB-2026-0001',
    shipmentId: 'SHP-2026-0001',
    totalQuantity: 3,
    recipientName: 'Recipient',
    parcels: [
      { trackingId: 'TRK-1', seq: 1, weightKg: 5.0 },
      { trackingId: 'TRK-2', seq: 2, weightKg: 5.0 },
      { trackingId: 'TRK-3', seq: 3, weightKg: 10.0 }
    ]
  };
  const html = buildWaybillHtml(manifest, 'logo.png');

  assert.equal(html.match(/<section class="copy">/g).length, 2);
  assert.deepEqual(
    [...html.matchAll(/class="copy-label(?: client-copy)?">([^<]+)/g)].map((m) => m[1]),
    ['ORIGINAL COPY', 'CLIENT COPY']
  );

  // Dual-column grid
  assert.match(html, /class="manifest-grid"/);

  assert.match(html, /<th class="th-pkg-range">Packages<\/th>/);
  assert.match(html, /<th class="th-boxes">Boxes<\/th>/);
  assert.match(html, /<th class="th-bw">Billable Wt\.<\/th>/);

  assert.match(html, /Package 3 of 3/);
  assert.match(html, /10\.0 kg/);
  assert.match(html, /Package 1–2 of 3/);
  assert.match(html, /5\.0 kg/);

  // Summary row
  assert.match(html, /class="summary-row"/);
  assert.match(html, /Total Boxes: <\/span><b class="summary-val">3<\/b>/);
  assert.match(html, /Total Billable: <\/span><b class="summary-val">20\.0 kg<\/b>/);

  const payload = getWaybillQrPayload(manifest.waybillId);
  assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
});

test('buildWaybillHtml renders LOST indicator when lost parcels exist', () => {
  const manifest = {
    waybillId: 'WYB-2026-0002',
    totalQuantity: 2,
    parcels: [
      { trackingId: 'TRK-1', seq: 1, weightKg: 5.0, lost: false },
      { trackingId: 'TRK-2', seq: 2, weightKg: 5.0, lost: true }
    ]
  };
  const html = buildWaybillHtml(manifest, null);
  assert.match(html, /Lost: <\/span><b class="lost-val">1<\/b>/);
});

test('escapes manifest text and falls back to the brand name without a logo', () => {
  const html = buildWaybillHtml({
    waybillId: 'WYB-1',
    totalQuantity: 1,
    recipientName: '<Recipient>',
    parcels: [{ trackingId: 'TRK-1', seq: 1, weightKg: 5.0 }]
  }, null);
  assert.match(html, /&lt;Recipient&gt;/);
  assert.match(html, /TC &amp; CT INTEGRATED LOGISTICS/);
  assert.match(html, /RETURN CONFIRMATION QR/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /class="logo-fallback"/);
});

test('inlines the canonical base64 waybill logo by default when logoUri is omitted', () => {
  const html = buildWaybillHtml({
    waybillId: 'WYB-1',
    totalQuantity: 1,
    parcels: [{ trackingId: 'TRK-1', seq: 1, weightKg: 5.0 }]
  });
  assert.match(html, /<img src="data:image\/png;base64,[^"]+"/);
  assert.match(html, /class="logo-wrap"/);
  assert.doesNotMatch(html, /class="logo-fallback"/);
});

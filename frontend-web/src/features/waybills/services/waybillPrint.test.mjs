import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { generateQRMatrix } from '../../../utils/qr.js';
import {
  computeParcelBillableWeight,
  groupParcelsByBillableWeight,
  paginateGroups,
  buildWaybillPrintHtml,
  getWaybillQrPayload
} from './waybillPrint.mjs';

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
  const parcel = { weightKg: 8.5, lengthCm: 20, widthCm: 20, heightCm: 20 };
  // Volumetric: (20 * 20 * 20) / 5000 = 1.6 kg
  assert.equal(computeParcelBillableWeight(parcel, 5000), 8.5);
});

test('computeParcelBillableWeight returns volumetric weight when volume exceeds actual', () => {
  const parcel = { weightKg: 2.0, lengthCm: 50, widthCm: 40, heightCm: 30 };
  // Volumetric: (50 * 40 * 30) / 5000 = 12.0 kg
  assert.equal(computeParcelBillableWeight(parcel, 5000), 12.0);
});

test('computeParcelBillableWeight computes volumetric weight from volumeCbm', () => {
  const parcel = { weightKg: 1.5, volumeCbm: 0.02 };
  // Volumetric: (0.02 * 1,000,000) / 5000 = 4.0 kg
  assert.equal(computeParcelBillableWeight(parcel, 5000), 4.0);
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
  // (8.0 * 1) + (6.5 * 2) + (3.0 * 2) = 8.0 + 13.0 + 6.0 = 27.0
  assert.equal(totalBillable, 27.0);
  assert.equal(lostCount, 0);

  // Sorted descending by billable weight
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

test('groupParcelsByBillableWeight excludes lost parcels from rows and records lostCount', () => {
  const parcels = [
    { trackingId: 'TRK-1', seq: 1, weightKg: 4.0, lost: false },
    { trackingId: 'TRK-2', seq: 2, weightKg: 4.0, lost: true }
  ];
  const { rows, totalBoxes, lostCount } = groupParcelsByBillableWeight(parcels, 2, 5000);
  assert.equal(rows.length, 1);
  assert.equal(totalBoxes, 1);
  assert.equal(lostCount, 1);
});

test('groupParcelsByBillableWeight formats scattered packages compactly as Various (N of Total)', () => {
  const indices = [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 54, 55];
  const parcels = indices.map((seq) => ({ trackingId: `TRK-${seq}`, seq, weightKg: 4.3 }));
  const { rows } = groupParcelsByBillableWeight(parcels, 55, 5000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rangeLabel, 'Various (46 of 55)');
  assert.equal(rows[0].boxes, 46);
});

test('groupParcelsByBillableWeight formats small gap packages concisely', () => {
  const parcels = [
    { trackingId: 'TRK-1', seq: 1, weightKg: 5.0 },
    { trackingId: 'TRK-3', seq: 3, weightKg: 5.0 }
  ];
  const { rows } = groupParcelsByBillableWeight(parcels, 10, 5000);
  assert.equal(rows[0].rangeLabel, 'Package 1, 3 of 10');
});

test('paginateGroups splits at page boundary and returns empty array on empty input', () => {
  assert.deepEqual(paginateGroups([]), [[]]);
  const rows = Array.from({ length: 55 }, (_, i) => ({ rangeLabel: `Pkg ${i + 1}`, boxes: 1 }));
  const pages = paginateGroups(rows, 50);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].length, 50);
  assert.equal(pages[1].length, 5);
});

test('buildWaybillPrintHtml renders grouped table with TOTAL row and two copies', () => {
  const manifest = {
    waybillId: 'WYB-2026-0001',
    shipmentId: 'SHP-2026-0001',
    totalQuantity: 3,
    recipientName: 'Juan Dela Cruz',
    parcels: [
      { trackingId: 'TRK-1', seq: 1, weightKg: 5.0 },
      { trackingId: 'TRK-2', seq: 2, weightKg: 5.0 },
      { trackingId: 'TRK-3', seq: 3, weightKg: 10.0 }
    ]
  };
  const html = buildWaybillPrintHtml(manifest, '/tracking-logo.png');

  // Produces 2 copies (ORIGINAL COPY and CLIENT COPY)
  assert.equal(html.match(/<section class="copy">/g).length, 2);
  assert.deepEqual(
    [...html.matchAll(/class="copy-label(?: client-copy)?">([^<]+)/g)].map((m) => m[1]),
    ['ORIGINAL COPY', 'CLIENT COPY']
  );

  // Dual-column grid
  assert.match(html, /class="manifest-grid"/);

  // Grouped table headers
  assert.match(html, /<th class="th-pkg-range">Packages<\/th>/);
  assert.match(html, /<th class="th-boxes">Boxes<\/th>/);
  assert.match(html, /<th class="th-bw">Billable Wt\.<\/th>/);

  // Data rows: 10.0 kg (1 box) and 5.0 kg (2 boxes)
  assert.match(html, /Package 3 of 3/);
  assert.match(html, /10\.0 kg/);
  assert.match(html, /Package 1–2 of 3/);
  assert.match(html, /5\.0 kg/);

  // Summary row
  assert.match(html, /class="summary-row"/);
  assert.match(html, /Total Boxes: <\/span><b class="summary-val">3<\/b>/);
  assert.match(html, /Total Billable: <\/span><b class="summary-val">20\.0 kg<\/b>/);

  // Standard styling invariants
  assert.match(html, /size: A4 portrait/);
  assert.match(html, /min-height: 278mm/);
  assert.match(html, /break-inside: avoid/);

  // Return QR verification
  const payload = getWaybillQrPayload(manifest.waybillId);
  assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
});

test('buildWaybillPrintHtml renders LOST indicator when lost parcels exist', () => {
  const manifest = {
    waybillId: 'WYB-2026-0002',
    shipmentId: 'SHP-2026-0002',
    totalQuantity: 2,
    parcels: [
      { trackingId: 'TRK-1', seq: 1, weightKg: 5.0, lost: false },
      { trackingId: 'TRK-2', seq: 2, weightKg: 5.0, lost: true }
    ]
  };
  const html = buildWaybillPrintHtml(manifest, null);
  assert.match(html, /Lost: <\/span><b class="lost-val">1<\/b>/);
});

test('escapes document data and retains the text logo fallback', () => {
  const html = buildWaybillPrintHtml({
    waybillId: 'WYB-1',
    recipientName: '<Recipient>',
    parcels: [{ trackingId: 'TRK-1', weightKg: 5.0 }]
  }, null);
  assert.match(html, /&lt;Recipient&gt;/);
  assert.match(html, /TC &amp; CT INTEGRATED LOGISTICS/);
  assert.match(html, /RETURN CONFIRMATION QR/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /class="logo-fallback"/);
});

test('inlines the canonical base64 waybill logo by default when logoUri is omitted', () => {
  const html = buildWaybillPrintHtml({
    waybillId: 'WYB-1',
    parcels: [{ trackingId: 'TRK-1', weightKg: 5.0 }]
  });
  assert.match(html, /<img src="data:image\/png;base64,[^"]+"/);
  assert.match(html, /class="logo-wrap"/);
  assert.doesNotMatch(html, /class="logo-fallback"/);
});

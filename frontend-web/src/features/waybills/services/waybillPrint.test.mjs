import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { generateQRMatrix } from '../../../utils/qr.js';
import { buildWaybillPrintHtml, getWaybillQrPayload } from './waybillPrint.mjs';

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

test('prints exactly two complete copies of the selected manifest with 15-item pagination and multi-page headers', () => {
  const manifest = {
    waybillId: 'WYB-A', shipmentId: 'SHP-1', totalQuantity: 45,
    parcels: Array.from({ length: 45 }, (_, index) => ({ trackingId: `UNIT-${index + 1}`, seq: index + 1 })),
  };
  const html = buildWaybillPrintHtml(manifest, '/tracking-logo.png');
  assert.equal(html.match(/<section class="copy">/g).length, 6);
  assert.equal(html.match(/UNIT-45/g).length, 2);
  assert.equal(html.match(/<thead>/g).length, 6);
  assert.match(html, /display: table-header-group/);
  assert.match(html, /size: A4 portrait/);
  assert.doesNotMatch(html, /UNIT-46/);
  assert.equal(html.match(/class="return-qr"/g).length, 6);
  assert.equal(html.match(/aria-label="WAYBILL:WYB-A"/g).length, 6);
  const qrPaths = [...html.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(qrPaths.length, 6);
  assert.equal(qrPaths[0], qrPaths[1]);
  assert.match(html, /Page 1 of 3/);
  assert.match(html, /Page 3 of 3/);
  const payload = getWaybillQrPayload(manifest.waybillId);
  assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
});

test('escapes document data and retains the text logo fallback', () => {
  const html = buildWaybillPrintHtml({ waybillId: 'WYB-1', parcels: [{ trackingId: '<UNIT>' }] });
  assert.match(html, /&lt;UNIT&gt;/);
  assert.match(html, /TC &amp; CT INTEGRATED LOGISTICS/);
  assert.match(html, /RETURN CONFIRMATION QR/);
  assert.doesNotMatch(html, /<img/);
});

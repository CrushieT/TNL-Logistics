import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { generateQRMatrix } from '../../utils/qr.js';
import { buildWaybillHtml, getWaybillQrPayload } from './printWaybill.mjs';

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

test('prints two complete copies of only the selected manifest', () => {
  const manifest = {
    waybillId: 'WYB-2026-0001', shipmentId: 'SHP-2026-0001', totalQuantity: 45,
    clientName: 'Client', recipientName: 'Recipient',
    parcels: Array.from({ length: 45 }, (_, index) => ({ trackingId: `TRK-${index + 1}`, seq: index + 1 })),
  };
  const html = buildWaybillHtml(manifest, 'logo.png');
  assert.equal(html.match(/class="copy"/g).length, 2);
  assert.equal(html.match(/TRK-45/g).length, 2);
  assert.doesNotMatch(html, /TRK-46/);
  assert.match(html, /A4 landscape/);
  assert.match(html, /table-header-group/);
  assert.match(html, /logo.png/);
  assert.equal(html.match(/class="return-qr"/g).length, 2);
  assert.equal(html.match(/aria-label="TNL-WAYBILL:WYB-2026-0001"/g).length, 2);
  const qrPaths = [...html.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(qrPaths.length, 2);
  assert.equal(qrPaths[0], qrPaths[1]);
  const payload = getWaybillQrPayload(manifest.waybillId);
  assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
});

test('escapes manifest text and falls back to the brand name without a logo', () => {
  const html = buildWaybillHtml({ waybillId: 'WYB-1', totalQuantity: 1,
    clientName: '<Client>', parcels: [{ trackingId: 'TRK-1', seq: 1 }] });
  assert.match(html, /&lt;Client&gt;/);
  assert.match(html, /TNL LOGISTICS/);
  assert.match(html, /RETURN CONFIRMATION QR/);
  assert.doesNotMatch(html, /<img/);
});

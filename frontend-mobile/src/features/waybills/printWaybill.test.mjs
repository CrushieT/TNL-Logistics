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

test('prints two complete copies of only the selected manifest with 50-item dual-column pagination and multi-page headers', () => {
  const manifest = {
    waybillId: 'WYB-2026-0001', shipmentId: 'SHP-2026-0001', totalQuantity: 55,
    clientName: 'Client', recipientName: 'Recipient',
    parcels: Array.from({ length: 55 }, (_, index) => ({ trackingId: `TRK-${index + 1}`, seq: index + 1 })),
  };
  const html = buildWaybillHtml(manifest, 'logo.png');
  assert.equal(html.match(/class="copy"/g).length, 4);
  assert.deepEqual([...html.matchAll(/class="copy-label(?: client-copy)?">([^<]+)/g)].map(match => match[1]),
    ['ORIGINAL COPY', 'ORIGINAL COPY', 'CLIENT COPY', 'CLIENT COPY']);
  assert.equal(html.match(/TRK-55/g).length, 2);
  assert.doesNotMatch(html, /TRK-56/);
  assert.match(html, /A4 portrait/);
  assert.match(html, /table-header-group/);
  assert.match(html, /class="manifest-grid"/);
  assert.match(html, /class="manifest-table"/);
  assert.doesNotMatch(html, /<th>Contents<\/th>/i);
  assert.match(html, /logo\.png/);
  assert.equal(html.match(/class="return-qr"/g).length, 4);
  assert.equal(html.match(/aria-label="WAYBILL:WYB-2026-0001"/g).length, 4);
  const qrPaths = [...html.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(qrPaths.length, 4);
  assert.equal(qrPaths[0], qrPaths[1]);
  assert.match(html, /Page 1 of 2/);
  assert.match(html, /Page 2 of 2/);
  const payload = getWaybillQrPayload(manifest.waybillId);
  assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
});

test('labels additional single-page copies as client copies', () => {
  const html = buildWaybillHtml({ waybillId: 'WYB-1', parcels: [{ trackingId: 'UNIT' }] }, null, null, 3);
  assert.deepEqual([...html.matchAll(/class="copy-label(?: client-copy)?">([^<]+)/g)].map(match => match[1]),
    ['ORIGINAL COPY', 'CLIENT COPY', 'CLIENT COPY']);
  assert.equal((html.match(/class="copy-label client-copy">CLIENT COPY/g) || []).length, 2);
  assert.equal((html.match(/CLIENT SIGNATURE AND PRINTED NAME/g) || []).length, 3);
});

test('escapes manifest text and falls back to the brand name without a logo', () => {
  const html = buildWaybillHtml({ waybillId: 'WYB-1', totalQuantity: 1,
    recipientName: '<Recipient>', parcels: [{ trackingId: 'TRK-1', seq: 1 }] });
  assert.match(html, /&lt;Recipient&gt;/);
  assert.match(html, /TC &amp; CT INTEGRATED LOGISTICS/);
  assert.match(html, /RETURN CONFIRMATION QR/);
  assert.doesNotMatch(html, /<img/);
});

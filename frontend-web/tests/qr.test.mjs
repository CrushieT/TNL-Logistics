import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { generateQRMatrix } from '../src/utils/qr.js';

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

for (const payload of ['TRK-2026-000101', 'José | 城市配送', 'X'.repeat(180)]) {
  test(`web QR round trip: ${payload.slice(0, 20)}`, () => {
    assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import { generateQRMatrix } from '../src/utils/qr.js';
import {
  buildWaybillPrintHtml,
  getRenderedWaybillLogoUri,
  getWaybillQrPayload
} from '../src/features/waybills/services/waybillPrint.mjs';

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

test('web waybill preview displays the same return confirmation QR payload as printed copies', () => {
  const componentSource = readFileSync(
    new URL('../src/features/waybills/components/WaybillManifestCard.js', import.meta.url),
    'utf8'
  );
  const pageSource = readFileSync(new URL('../src/app/waybills/[id].js', import.meta.url), 'utf8');

  assert.match(componentSource, /getWaybillQrPayload\(waybillId\)/);
  assert.match(componentSource, /<QRCodeGenerator value=\{returnQrPayload\}/);
  assert.match(componentSource, /RETURN CONFIRMATION QR/);
  assert.match(componentSource, /accessibilityLabel=\{returnQrPayload\}/);
  assert.match(componentSource, /accessibilityLabel=\{brandName\}/);
  assert.match(pageSource, /Print two A4 copies/);
  assert.match(pageSource, /WaybillManifestCard manifest=\{manifest\}/);
  assert.match(pageSource, /getRenderedWaybillLogoUri\(document\)/);
  assert.doesNotMatch(pageSource, /resolveAssetSource/);
});

test('applies dynamic company branding in printed HTML', () => {
  const manifest = { waybillId: 'WYB-1', parcels: [{ trackingId: 'UNIT-1' }] };
  const branding = {
    companyName: 'TC & CT Integrated Logistics',
    companyAddress: 'Central Warehouse, Manila',
    companyContact: '09175550000',
    billingEmail: 'billing@tcct.ph',
  };
  const html = buildWaybillPrintHtml(manifest, null, branding);
  assert.match(html, /TC &amp; CT INTEGRATED LOGISTICS/);
  assert.match(html, /Central Warehouse, Manila/);
  assert.match(html, /09175550000/);
  assert.match(html, /billing@tcct\.ph/);
});

test('web printing resolves the rendered logo URI with a safe text-logo fallback', () => {
  const selector = '#printable-waybill-manifest img';
  assert.equal(getRenderedWaybillLogoUri({
    querySelector: (candidate) => {
      assert.equal(candidate, selector);
      return { currentSrc: '/assets/tracking-logo.hash.png', src: '/assets/tracking-logo.png' };
    }
  }), '/assets/tracking-logo.hash.png');
  assert.equal(getRenderedWaybillLogoUri({
    querySelector: () => ({ currentSrc: '', src: '/assets/tracking-logo.png' })
  }), '/assets/tracking-logo.png');
  assert.equal(getRenderedWaybillLogoUri({ querySelector: () => null }), null);
  assert.equal(getRenderedWaybillLogoUri(null), null);
});


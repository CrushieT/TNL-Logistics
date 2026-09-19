import test from 'node:test';
import assert from 'node:assert/strict';

import { generateQRMatrix, generateQRSvgPath, generateQRBitmapDataUri } from '../src/utils/qr.js';
import { normalizeLabelData } from '../src/features/printer/services/thermalLabelData.js';
import { buildEscPosCommands, buildLabelHtml } from '../src/features/printer/services/escposFormatter.js';

test('QR Code generator produces valid matrix for tracking ID', () => {
  const trackingId = 'TRK-2026-000101';
  const matrix = generateQRMatrix(trackingId);

  assert.ok(Array.isArray(matrix), 'Matrix should be an array');
  assert.ok(matrix.length >= 21, 'Matrix size should be at least Version 1 (21x21)');
  assert.equal(matrix.length, matrix[0].length, 'Matrix should be square');

  // Top-left finder pattern corner module must be black (true)
  assert.equal(matrix[0][0], true, 'Top-left finder pattern corner must be true');
});

test('generateQRSvgPath generates valid SVG path commands', () => {
  const matrix = generateQRMatrix('TRK-2026-000101');
  const { path, totalSize } = generateQRSvgPath(matrix);

  assert.ok(typeof path === 'string', 'Path should be a string');
  assert.ok(path.startsWith('M'), 'Path should start with Move command');
  assert.ok(path.includes('h1v1h-1z'), 'Path should contain unit square draws');
  assert.ok(typeof totalSize === 'number' && totalSize > 20, 'totalSize should be positive number');
});

test('generateQRBitmapDataUri generates valid monochrome BMP data URI', () => {
  const matrix = generateQRMatrix('TRK-2026-000101');
  const dataUri = generateQRBitmapDataUri(matrix, 2, 1);

  assert.ok(dataUri.startsWith('data:image/bmp;base64,'), 'Should have BMP data URI prefix');

  const base64Data = dataUri.replace('data:image/bmp;base64,', '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Check BMP Magic Number 'BM' (0x42, 0x4D)
  assert.equal(buffer[0], 0x42, 'BMP magic byte 0');
  assert.equal(buffer[1], 0x4d, 'BMP magic byte 1');

  // Check 1-bit per pixel in DIB header (offset 28)
  const bitsPerPixel = buffer.readUInt16LE(28);
  assert.equal(bitsPerPixel, 1, 'Should be 1-bit monochrome BMP');
});

test('normalizeLabelData applies defaults when fields are missing', () => {
  const emptyResult = normalizeLabelData();

  assert.equal(emptyResult.trackingId, 'TRK-2026-000101');
  assert.equal(emptyResult.packageIndex, 1);
  assert.equal(emptyResult.packageCount, 1);
  assert.equal(emptyResult.recipientName, 'Juan Dela Cruz');
  assert.equal(emptyResult.destinationHub, 'TNL Baguio Hub');
  assert.equal(emptyResult.route, 'Manila to TNL Baguio');
  assert.equal(emptyResult.totalAmount, 0);
});

test('normalizeLabelData maps shipment and unit fields accurately', () => {
  const shipment = {
    shipmentId: 'SHP-2026-088',
    recipientName: 'Maria Santos',
    recipientContact: '09181234567',
    recipientAddress: '123 Session Rd, Baguio City',
    destinationHub: 'TNL Baguio Central',
    clientName: 'Mountain Harvest Corp',
    description: 'Fresh Arabica Beans',
    origin: 'La Trinidad',
    totalAmount: 1850.5,
    units: [{ trackingId: 'TRK-2026-000881' }, { trackingId: 'TRK-2026-000882' }],
  };

  const unit = {
    trackingId: 'TRK-2026-000882',
    packageIndex: 2,
    description: 'Arabica Grade A',
  };

  const result = normalizeLabelData(shipment, unit, 1, 2);

  assert.equal(result.trackingId, 'TRK-2026-000882');
  assert.equal(result.packageIndex, 2);
  assert.equal(result.packageCount, 2);
  assert.equal(result.recipientName, 'Maria Santos');
  assert.equal(result.contactNumber, '09181234567');
  assert.equal(result.address, '123 Session Rd, Baguio City');
  assert.equal(result.destinationHub, 'TNL Baguio Central');
  assert.equal(result.contents, 'Arabica Grade A');
  assert.equal(result.clientName, 'Mountain Harvest Corp');
  assert.equal(result.shipmentId, 'SHP-2026-088');
  assert.equal(result.route, 'La Trinidad to TNL Baguio Central');
  assert.equal(result.totalAmount, 1850.5);
});

test('buildEscPosCommands outputs standard ESC/POS binary stream', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 3,
    recipientName: 'Juan Dela Cruz',
    contactNumber: '09171234567',
    address: '12 Session Rd',
    destinationHub: 'TNL Baguio Hub',
    contents: 'Dry Goods',
    clientName: 'Northbridge',
    shipmentId: 'SHP-2026-001',
    route: 'Manila to TNL Baguio',
    totalAmount: 450,
  };

  const bytes = buildEscPosCommands(labelData);
  assert.ok(bytes instanceof Uint8Array, 'Should return Uint8Array');
  assert.ok(bytes.length > 50, 'Command stream should be non-trivial');

  // Check ESC @ (Initialize: 0x1B, 0x40)
  assert.equal(bytes[0], 0x1b);
  assert.equal(bytes[1], 0x40);

  // Check presence of GS ( k (ESC/POS 2D barcode command: 0x1D, 0x28, 0x6B)
  let foundQrCommand = false;
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x28 && bytes[i + 2] === 0x6b) {
      foundQrCommand = true;
      break;
    }
  }
  assert.ok(foundQrCommand, 'Should contain GS ( k QR code command');

  // Check cut command at end: GS V 0 (0x1D, 0x56, 0x00)
  const lastThree = [bytes[bytes.length - 3], bytes[bytes.length - 2], bytes[bytes.length - 1]];
  assert.deepEqual(lastThree, [0x1d, 0x56, 0x00], 'Should end with GS V 0 paper cut');
});

test('buildLabelHtml generates printable HTML matching prototype layout', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 3,
    recipientName: 'Juan Dela Cruz',
    contactNumber: '09171234567',
    address: '12 Session Rd, Baguio City',
    destinationHub: 'TNL Baguio Hub',
    contents: 'Assorted office supplies',
    clientName: 'Northbridge Trading',
    shipmentId: 'SHP-2026-001',
    route: 'Manila to TNL Baguio',
    totalAmount: 450,
  };

  const html = buildLabelHtml(labelData);

  assert.ok(html.includes('<!DOCTYPE html>'), 'Should be valid HTML document');
  assert.ok(html.includes('TNL LOGISTICS'), 'Should include header brand');
  assert.ok(html.includes('PKG 1 / 3'), 'Should include package counter');
  assert.ok(html.includes('SCAN TO TRACK'), 'Should include scan prompt');
  assert.ok(html.includes('TRK-2026-000101'), 'Should include tracking ID');
  assert.ok(html.includes('Juan Dela Cruz'), 'Should include recipient name');
  assert.ok(html.includes('TNL Baguio Hub'), 'Should include destination hub');
  assert.ok(html.includes('Assorted office supplies'), 'Should include contents');
  assert.ok(html.includes('PHP 450'), 'Should format total amount in PHP');
  assert.ok(html.includes('<svg'), 'Should include SVG QR code');
});

test('buildLabelHtml generates multi-page HTML with CSS page breaks for multiple units', () => {
  const labels = [
    {
      trackingId: 'TRK-2026-000101',
      packageIndex: 1,
      packageCount: 2,
      recipientName: 'Juan Dela Cruz',
      contactNumber: '09171234567',
      address: '12 Session Rd',
      destinationHub: 'TNL Baguio Hub',
      contents: 'Office Supplies',
      clientName: 'Northbridge',
      shipmentId: 'SHP-2026-001',
      route: 'Manila to TNL Baguio',
      totalAmount: 450,
    },
    {
      trackingId: 'TRK-2026-000102',
      packageIndex: 2,
      packageCount: 2,
      recipientName: 'Juan Dela Cruz',
      contactNumber: '09171234567',
      address: '12 Session Rd',
      destinationHub: 'TNL Baguio Hub',
      contents: 'Office Supplies',
      clientName: 'Northbridge',
      shipmentId: 'SHP-2026-001',
      route: 'Manila to TNL Baguio',
      totalAmount: 450,
    },
  ];

  const html = buildLabelHtml(labels);

  assert.ok(html.includes('<!DOCTYPE html>'), 'Should be valid HTML document');
  assert.ok(html.includes('SHP-2026-001 (2 Labels)'), 'Title should reflect multiple labels');
  assert.ok(html.includes('TRK-2026-000101'), 'Should include first tracking ID');
  assert.ok(html.includes('TRK-2026-000102'), 'Should include second tracking ID');
  assert.ok(html.includes('PKG 1 / 2'), 'Should include Unit 1 counter');
  assert.ok(html.includes('PKG 2 / 2'), 'Should include Unit 2 counter');
  assert.ok(html.includes('page-break-after: always'), 'Should include CSS print page break');
});

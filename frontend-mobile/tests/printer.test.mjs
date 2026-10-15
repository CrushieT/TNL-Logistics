import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';

import { generateQRMatrix, generateQRSvgPath, generateQRBitmapDataUri } from '../src/utils/qr.js';
import {
  IncompleteLabelDataError,
  normalizeLabelData,
  resolveCurrentLabelBranding,
} from '../src/features/printer/services/thermalLabelData.js';
import {
  buildEscPosCommands,
  buildLabelHtml,
  prepareVerifiedLabelPrint,
} from '../src/features/printer/services/escposFormatter.js';
import { buildTsplOptions } from '../src/features/printer/services/tsplFormatter.js';
import {
  MAX_OUTBOX_ENTRIES,
  OutboxCapacityError,
  OutboxStorageError,
  PRINT_AUDIT_OUTBOX_KEY,
  createPrintAuditOutbox,
  syncPrintAuditEntry,
} from '../src/features/printer/services/printAuditOutbox.js';

function createMemoryStorage(initialValue = null) {
  let storedValue = initialValue;
  return {
    getItem: async () => storedValue,
    setItem: async (key, value) => {
      assert.equal(key, PRINT_AUDIT_OUTBOX_KEY);
      storedValue = value;
    },
    getStoredValue: () => storedValue,
  };
}

function createAuditEntry(index = 1, overrides = {}) {
  return {
    printJobId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ownerUserId: 'USR-OFFICE',
    shipmentId: 'SHP-2026-001',
    trackingIds: [`TRK-2026-${String(index).padStart(6, '0')}`],
    printerId: 'TEST-PRINTER',
    status: 'PENDING',
    ...overrides,
  };
}

test('label branding uses the fresh server response', async () => {
  const refreshedBranding = { companyName: 'TC & CT Integrated Logistics' };
  let fetchCount = 0;
  const branding = await resolveCurrentLabelBranding(async () => {
    fetchCount += 1;
    return refreshedBranding;
  });

  assert.equal(branding, refreshedBranding);
  assert.equal(fetchCount, 1);
});

test('label branding rejects failed and invalid refreshes', async () => {
  await assert.rejects(
    () => resolveCurrentLabelBranding(async () => { throw new Error('Branding service unavailable'); }),
    /Branding service unavailable/
  );
  await assert.rejects(
    () => resolveCurrentLabelBranding(async () => ({ companyName: '   ' })),
    /could not be verified/
  );
});

test('system label document uses freshly verified branding', async () => {
  const label = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Juan Dela Cruz',
    destinationHub: 'Manila Hub',
    shipmentId: 'SHP-2026-001',
  };
  const { html, branding } = await prepareVerifiedLabelPrint(label, async () => ({
    companyName: 'Current Cargo',
  }));

  assert.equal(branding.companyName, 'Current Cargo');
  assert.ok(html.includes('CURRENT CARGO'));
  assert.ok(!html.includes('TNL LOGISTICS'));
  await assert.rejects(
    () => prepareVerifiedLabelPrint(label, async () => { throw new Error('Branding service unavailable'); }),
    /Branding service unavailable/
  );
});

test('print audit retries AUTH_PAUSED entries after re-authentication', async () => {
  const outbox = createPrintAuditOutbox(createMemoryStorage());
  const entry = createAuditEntry();
  const unauthorizedError = new Error('Session expired');
  unauthorizedError.response = { status: 401 };

  const pausedStatus = await syncPrintAuditEntry({
    entry,
    outbox,
    sendAudit: async () => { throw unauthorizedError; },
  });

  assert.equal(pausedStatus, 'AUTH_PAUSED');
  assert.equal(await outbox.getPendingCount(entry.ownerUserId), 1);
  const pausedEntries = await outbox.getPendingPrintAudits(entry.ownerUserId);
  assert.equal(pausedEntries[0].status, 'AUTH_PAUSED');

  const retryStatus = await syncPrintAuditEntry({
    entry: pausedEntries[0],
    outbox,
    sendAudit: async () => undefined,
  });

  assert.equal(retryStatus, 'SYNCED');
  assert.equal(await outbox.getPendingCount(entry.ownerUserId), 0);
  assert.deepEqual(await outbox.readAll(), []);
});

test('print audit outbox rejects new jobs at capacity without deleting old entries', async () => {
  const existingEntries = Array.from(
    { length: MAX_OUTBOX_ENTRIES },
    (_, index) => createAuditEntry(index + 1)
  );
  const storage = createMemoryStorage(JSON.stringify(existingEntries));
  const outbox = createPrintAuditOutbox(storage);

  await assert.rejects(() => outbox.assertCapacityAvailable(), OutboxCapacityError);
  await assert.rejects(() => outbox.enqueuePrintAudit(createAuditEntry(MAX_OUTBOX_ENTRIES + 1)), OutboxCapacityError);
  assert.deepEqual(JSON.parse(storage.getStoredValue()), existingEntries);
});

test('print audit storage read failures do not overwrite durable entries', async () => {
  let writeCount = 0;
  const outbox = createPrintAuditOutbox({
    getItem: async () => { throw new Error('Storage unavailable'); },
    setItem: async () => { writeCount += 1; },
  });

  await assert.rejects(() => outbox.enqueuePrintAudit(createAuditEntry()), OutboxStorageError);
  assert.equal(writeCount, 0);
});

test('print audit preflight blocks printing when storage is not writable', async () => {
  const outbox = createPrintAuditOutbox({
    getItem: async () => null,
    setItem: async () => { throw new Error('Storage is read-only'); },
  });

  await assert.rejects(() => outbox.assertCapacityAvailable(), OutboxStorageError);
});

test('QR Code generator produces valid matrix for tracking ID', () => {
  const trackingId = 'TRK-2026-000101';
  const matrix = generateQRMatrix(trackingId);

  assert.ok(Array.isArray(matrix), 'Matrix should be an array');
  assert.ok(matrix.length >= 21, 'Matrix size should be at least Version 1 (21x21)');
  assert.equal(matrix.length, matrix[0].length, 'Matrix should be square');

  // Top-left finder pattern corner module must be black (true)
  assert.equal(matrix[0][0], true, 'Top-left finder pattern corner must be true');
});

function decodeMatrix(matrix, damagedModules = []) {
  const scale = 8;
  const margin = 4;
  const size = (matrix.length + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  const damaged = new Set(damagedModules.map(([row, column]) => `${row}:${column}`));
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      const isDark = damaged.has(`${row}:${column}`) ? !matrix[row][column] : matrix[row][column];
      if (!isDark) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const offset = (((row + margin) * scale + y) * size + (column + margin) * scale + x) * 4;
          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
        }
      }
    }
  }
  return jsQR(pixels, size, size)?.data;
}

for (const payload of [
  'TRK-2026-000101',
  'SHP-2026-088|TRK-2026-000882|PACKAGE-2',
  'Recipient: José Dela Cruz | 城市配送 | 09181234567',
  'X'.repeat(180),
]) {
  test(`QR round trip: ${payload.slice(0, 24)}`, () => {
    assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
  });
}

test('QR decoder recovers payload after limited module damage', () => {
  const payload = 'TRK-2026-000101|SHP-2026-088';
  const matrix = generateQRMatrix(payload);
  const lastModule = matrix.length - 1;
  assert.equal(decodeMatrix(matrix, [[lastModule, lastModule]]), payload);
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

test('normalizeLabelData rejects missing canonical fields', () => {
  assert.throws(() => normalizeLabelData(), IncompleteLabelDataError);
});

test('normalizeLabelData maps shipment and unit fields accurately', () => {
  const shipment = {
    shipmentId: 'SHP-2026-088',
    recipientDetails: {
      fullName: 'Maria Santos',
      contactNumber: '09181234567',
      address: '123 Session Rd, Baguio City',
    },
    destination: 'TNL Baguio Central',
    client: 'Mountain Harvest Corp',
    description: 'Fresh Arabica Beans',
    route: 'La Trinidad to TNL Baguio Central',
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
  assert.ok(html.includes('<div class="hub">Manila to TNL Baguio</div>'), 'Should show the entered route below the address');
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

test('buildLabelHtml escapes all untrusted label text', () => {
  const hostile = '<img src=x onerror="alert(1)">\'&';
  const html = buildLabelHtml({
    trackingId: hostile,
    packageIndex: 1,
    packageCount: 1,
    recipientName: hostile,
    contactNumber: hostile,
    address: hostile,
    destinationHub: hostile,
    contents: hostile,
    clientName: hostile,
    shipmentId: hostile,
    route: hostile,
    totalAmount: 1,
  });
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('onerror="'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&#39;&amp;'));
});

test('buildEscPosCommands applies dynamic company branding to byte stream', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Juan Dela Cruz',
    destinationHub: 'Manila Hub',
  };

  const bytes = buildEscPosCommands(labelData, { companyName: 'TC & CT Integrated Logistics' });
  const textFromBytes = String.fromCharCode(...bytes);

  assert.ok(textFromBytes.includes('TC & CT INTEGRATED LOGISTICS'), 'Byte stream should contain custom business name');
});

test('buildLabelHtml applies dynamic company branding and badge initial in mobile', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Juan Dela Cruz',
    destinationHub: 'Manila Hub',
    shipmentId: 'SHP-2026-001',
  };

  const html = buildLabelHtml(labelData, { companyName: 'TC & CT Integrated Logistics' });
  assert.ok(html.includes('TC &amp; CT INTEGRATED LOGISTICS'), 'Should include escaped company name');
  assert.ok(html.includes('TRK-2026-000101 - TC &amp; CT Integrated Logistics Shipping Label'), 'Document title must reflect company name');

  const acmeHtml = buildLabelHtml(labelData, 'Acme Cargo');
  assert.ok(acmeHtml.includes('ACME CARGO'), 'Should include custom uppercase brand title');
});

test('buildTsplOptions generates landscape TSPL payload with border, divider lines, and enlarged fonts without T badge', () => {
  const labelData = {
    trackingId: 'TRK-2026-000006',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Baguio Electrical Supply',
    contactNumber: '0917-000-0006',
    address: 'Baguio City',
    destinationHub: 'TNL Baguio',
    contents: 'Workflow fixture 6',
    shipmentId: 'SHP-2026-006',
    clientName: 'Sunrise Hardware',
    route: 'Manila to TNL Baguio',
    totalAmount: 500,
  };

  const tspl = buildTsplOptions(labelData, { companyName: 'TC & CT Integrated Logistics' });

  // Label paper geometry
  assert.equal(tspl.width, 100);
  assert.equal(tspl.height, 150);
  assert.equal(tspl.direction, 0);

  // QR Code rotated 90, enlarged (width 10), and positioned with balanced margins
  assert.equal(tspl.qrcode.length, 1);
  assert.equal(tspl.qrcode[0].code, 'TRK-2026-000006');
  assert.equal(tspl.qrcode[0].rotation, 90);
  assert.equal(tspl.qrcode[0].x, 555, 'QR code should be shifted down to x=555 to prevent leaning toward top header');
  assert.equal(tspl.qrcode[0].y, 110, 'QR code should be centered at y=110 between left border and text');
  assert.equal(tspl.qrcode[0].width, 10, 'QR code module width should be 10 for prominent sizing');

  // No T logo badge text
  const badgeTexts = tspl.text.filter((t) => t.text === 'T');
  assert.equal(badgeTexts.length, 0, 'Must not render isolated T brand badge');

  // Full company name without premature truncation
  const brandTitleItem = tspl.text.find((t) => t.text === 'TC & CT INTEGRATED LOGISTICS');
  assert.ok(brandTitleItem, 'Must contain full company name');
  assert.equal(brandTitleItem.fonttype, '4', 'Brand title must use large font 4');
  assert.equal(brandTitleItem.bold, true);

  // Enlarged bold tracking ID and hub
  const trkItem = tspl.text.find((t) => t.text === 'TRK-2026-000006');
  assert.ok(trkItem);
  assert.equal(trkItem.fonttype, '4');
  assert.equal(trkItem.bold, true);

  const hubItem = tspl.text.find((t) => t.text === 'Manila to TNL Baguio');
  assert.ok(hubItem);
  assert.equal(hubItem.fonttype, '4');
  assert.equal(hubItem.bold, true);

  // Enlarged footer fonts (font 3)
  const contentsItem = tspl.text.find((t) => t.text.includes('Workflow fixture 6'));
  assert.ok(contentsItem);
  assert.equal(contentsItem.fonttype, '3', 'Contents should use font 3 for readability');

  const shipmentItem = tspl.text.find((t) => t.text.includes('SHP-2026-006'));
  assert.ok(shipmentItem);
  assert.equal(shipmentItem.fonttype, '3', 'Shipment should use font 3 for readability');

  // Solid border & header divider lines in reverse array
  assert.ok(Array.isArray(tspl.reverse), 'Should include reverse blocks for solid lines');
  assert.equal(tspl.reverse.filter((block) => block.width === 4 || block.width === 680).length, 5);

  for (const [dividerX, startY] of [[250, 85], [125, 630]]) {
    const dashes = tspl.reverse.filter((block) => block.x === dividerX);
    assert.ok(dashes.length > 1, 'Each divider must contain separated dashes');
    assert.equal(dashes[0].y, startY);
    assert.equal(dashes.at(-1).y + dashes.at(-1).height, 1131, 'Final dash must touch the inside edge of the right border');
    for (let dashIndex = 0; dashIndex < dashes.length; dashIndex += 1) {
      const dash = dashes[dashIndex];
      assert.ok(dash.y + dash.height <= 1131, 'Dashes must not overlap or overflow the right border');
      if (dashIndex > 0) {
        const previousDash = dashes[dashIndex - 1];
        assert.ok(dash.y > previousDash.y + previousDash.height, 'Dashes must have gaps and must not invert each other');
      }
    }
  }
  const withoutTotal = buildTsplOptions({ ...labelData, totalAmount: null });
  assert.equal(withoutTotal.reverse.some((block) => block.x === 125), false, 'Total divider must be omitted when there is no total');

  // Total amount
  const totalItem = tspl.text.find((t) => t.text.includes('Total: PHP 500'));
  assert.ok(totalItem);
  assert.equal(totalItem.fonttype, '4', 'Total must be prominent font 4');
  assert.equal(totalItem.bold, true);
});

test('Bluetooth footer uses full-width contents and places shipment beside the client above the total', () => {
  const contents = 'General goods, workflow fixture Testing test Test and testing again';
  const payload = buildTsplOptions({
    trackingId: 'TRK-2026-000058', recipientName: 'Northbridge Trading',
    address: 'Unit 402, Trade Tower, Binondo, Manila', destinationHub: 'TNL Labo C.N.',
    contents, shipmentId: 'SHP-2026-014', clientName: 'Northbridge Trading',
    route: 'Manila to TNL Labo C.N.', totalAmount: 1249.85,
  });
  const shipment = payload.text.find((item) => item.text.startsWith('Shipment:'));
  const client = payload.text.find((item) => item.text.startsWith('Client:'));
  const contentsLines = payload.text.filter((item) => item.y === 85 && item.x > client.x && item.x < 340);
  assert.equal(contentsLines.map((item) => item.text).join(' '), `Contents: ${contents}`);
  assert.ok(contentsLines.length > 1);
  const characterWidths = { '1': 8, '2': 12, '3': 16 };
  for (const line of contentsLines) {
    assert.ok(line.y + line.text.length * characterWidths[line.fonttype] <= 1111);
  }
  assert.ok(contentsLines.some((line) => line.y + line.text.length * characterWidths[line.fonttype] > shipment.y));
  assert.ok(client.x < contentsLines.at(-1).x - 24, 'Client must be below the last contents line');
  assert.equal(shipment.x, client.x, 'Shipment must share the client row');
  assert.equal(shipment.y + shipment.text.length * characterWidths[shipment.fonttype], 1111);
  const total = payload.text.find((item) => item.text.startsWith('Total:'));
  assert.ok(shipment.x > total.x, 'Shipment must be above the total');
});

test('Bluetooth total keeps a fixed right edge as the amount grows', () => {
  const totals = [500, 1249.85, 1234567890.99].map((totalAmount) => {
    const payload = buildTsplOptions({ totalAmount });
    return payload.text.find((item) => item.text.startsWith('Total:'));
  });
  for (const total of totals) {
    assert.equal(total.y + total.text.length * 24 + 1, 1111);
    assert.ok(total.y >= 85);
  }
  assert.ok(totals[1].y < totals[0].y);
  assert.ok(totals[2].y < totals[1].y);
  assert.equal(totals[1].text, 'Total: PHP 1,249.85');
});

test('Bluetooth footer fits long words and wrapped client fields without duplicating the body route', () => {
  const labelData = {
    address: 'Unit 402, Trade Tower, Binondo, Manila', destinationHub: 'TNL Labo C.N.',
    contents: 'A'.repeat(150), shipmentId: 'SHP-2026-014',
    clientName: 'Northbridge Trading Company Warehouse and Distribution Services',
    route: 'Manila to TNL Labo C.N. via regional distribution warehouse', totalAmount: 1249.85,
  };
  const payload = buildTsplOptions(labelData);
  const footerStart = payload.text.findIndex((item) => item.text.startsWith('Contents:'));
  const footerEnd = payload.text.findIndex((item) => item.text.startsWith('Total:'));
  const footer = payload.text.slice(footerStart, footerEnd);
  const shipmentIndex = footer.findIndex((item) => item.text.startsWith('Shipment:'));
  assert.equal(footer.slice(0, shipmentIndex).map((item) => item.text).join('').replace(/\s/g, ''),
    `Contents:${labelData.contents}`);
  assert.equal(footer.slice(shipmentIndex + 1).map((item) => item.text).join(' '),
    `Client: ${labelData.clientName}`);
  assert.equal(footer.some((item) => item.text.startsWith('Route:')), false);
  const metrics = { '1': [8, 12], '2': [12, 20], '3': [16, 24] };
  const dividerX = payload.reverse.find((block) => block.width === 2 && block.y === 85).x;
  assert.ok(dividerX < 313, 'Footer divider must stay below the destination hub');
  for (const item of footer) {
    const [characterWidth, characterHeight] = metrics[item.fonttype];
    assert.ok(item.y + item.text.length * characterWidth <= (item.text.startsWith('Client:') ? 610 : 1111));
    assert.ok(item.x - characterHeight >= 133, 'Footer text must stay above the total divider');
    assert.ok(item.x < dividerX, 'Footer text must stay below the body divider');
  }
});

test('Bluetooth footer rejects text that cannot fit instead of silently truncating it', () => {
  assert.throws(() => buildTsplOptions({ contents: 'A'.repeat(2000) }), /footer is too long/);
});

test('Bluetooth address keeps Manila together and uses the available width before the right border', () => {
  const address = 'Unit 402, Trade Tower, Binondo, Manila';
  const payload = buildTsplOptions({ address, destinationHub: 'TNL Labo C.N.' });
  const addressLines = payload.text.filter((item) => item.y === 440 && item.x <= 430 && item.x >= 378);
  assert.equal(addressLines.length, 1);
  assert.equal(addressLines[0].text, address);
  assert.ok(addressLines[0].y + address.length * 16 <= 1111);
});

test('Bluetooth address preserves longer text and wraps at word boundaries', () => {
  const address = 'Building 17, Warehouse District, Barangay San Antonio, Quezon City, Metro Manila, Philippines';
  const payload = buildTsplOptions({ address });
  const addressLines = payload.text.filter((item) => item.y === 440 && item.x <= 430 && item.x >= 378);
  assert.equal(addressLines.map((item) => item.text).join(' '), address);
  const widths = { '1': 8, '2': 12, '3': 16 };
  for (const line of addressLines) {
    assert.ok(line.y + line.text.length * widths[line.fonttype] <= 1111);
    assert.ok(line.x >= 378, 'Address must stay clear of the destination hub');
  }
});

test('Bluetooth label fits registration text limits together without truncating address or contents', () => {
  const payload = buildTsplOptions({ address: 'A'.repeat(80), contents: 'D'.repeat(120),
    clientName: 'C'.repeat(150), route: 'R'.repeat(150), shipmentId: 'SHP-2026-014', totalAmount: 1249.85 });
  const addressLines = payload.text.filter((item) => item.y === 440 && item.x <= 430 && item.x >= 378);
  assert.equal(addressLines.map((item) => item.text).join(''), 'A'.repeat(80));
  const contentsStart = payload.text.findIndex((item) => item.text.startsWith('Contents:'));
  const shipmentStart = payload.text.findIndex((item) => item.text.startsWith('Shipment:'));
  assert.equal(payload.text.slice(contentsStart, shipmentStart).map((item) => item.text).join('').replace(/\s/g, ''),
    `Contents:${'D'.repeat(120)}`);
  const widths = { '1': 8, '2': 12, '3': 16, '4': 24 };
  for (const item of payload.text.slice(contentsStart)) {
    assert.ok(item.y + item.text.length * widths[item.fonttype] + (item.bold ? 1 : 0) <= 1111);
    assert.ok(item.x >= 90);
  }
});

test('Bluetooth body uses the entered route without an added arrow or destination substitution', () => {
  for (const route of ['Quezon City to Cebu via Lucena', 'R'.repeat(150)]) {
    const payload = buildTsplOptions({ address: 'Test address', destinationHub: 'UNRELATED HUB', route });
    const routeLines = payload.text.filter((item) => item.y === 440 && item.x <= 375);
    assert.equal(routeLines.map((item) => item.text).join('').replace(/\s/g, ''), route.replace(/\s/g, ''));
    assert.equal(payload.text.some((item) => item.text.startsWith('Route:')), false);
    assert.ok(payload.text.every((item) => !item.text.startsWith('->') && !item.text.includes('UNRELATED HUB')));
  }
  const withoutRoute = buildTsplOptions({ address: 'Test address', destinationHub: 'UNRELATED HUB' });
  assert.equal(withoutRoute.text.some((item) => item.y === 440 && item.x <= 375), false);
});

test('mobile HTML labels show the escaped entered route instead of a destination prefix', () => {
  const label = { trackingId: 'TRK-2026-000058', packageIndex: 1, packageCount: 1,
    destinationHub: 'UNRELATED HUB', route: 'Quezon <City> to Cebu',
    clientName: 'Example Client', contents: 'D'.repeat(120), shipmentId: 'SHP-2026-014', totalAmount: 500 };
  const html = buildLabelHtml(label);
  assert.ok(html.includes('<div class="hub">Quezon &lt;City&gt; to Cebu</div>'));
  assert.equal(html.split('Quezon &lt;City&gt; to Cebu').length - 1, 1, 'Route must appear only once');
  assert.equal(html.includes('UNRELATED HUB'), false);
  assert.ok(html.indexOf('class="contents-field"') < html.indexOf('class="client-field"'));
  assert.ok(html.indexOf('class="client-field"') < html.indexOf('class="shipment-field"'), 'Shipment must follow full-width contents on the client row');
  assert.ok(html.indexOf('class="shipment-field"') < html.indexOf('class="total-row"'));
  assert.ok(html.includes('D'.repeat(120)), 'Complete contents must be retained');
  assert.equal(buildLabelHtml({ ...label, route: null }).includes('<div class="hub">'), false);
});

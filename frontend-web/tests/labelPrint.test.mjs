import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IncompleteLabelDataError,
  escapeHtml,
  formatFiniteNumber,
  normalizeLabelData,
  buildLabelHtml,
} from '../src/features/shipments/services/labelPrintServiceCore.mjs';

test('normalizeLabelData extracts full shipment and parcel unit metadata', () => {
  const shipment = {
    shipmentId: 'SHP-2026-001',
    recipientDetails: {
      fullName: 'Juan Dela Cruz',
      contactNumber: '0917-555-0148',
      address: '148 Rizal Ave, Caloocan City',
    },
    destination: 'TNL Baguio Hub',
    origin: 'Manila',
    description: 'Assorted office supplies',
    client: 'Northbridge Trading',
    totalAmount: 500,
    units: [
      { trackingId: 'TRK-2026-000101', packageIndex: 1, packageCount: 3, weightKg: 2.5 },
      { trackingId: 'TRK-2026-000102', packageIndex: 2, packageCount: 3, weightKg: 1.5 },
      { trackingId: 'TRK-2026-000103', packageIndex: 3, packageCount: 3, weightKg: 3.0 },
    ],
  };

  const labelData = normalizeLabelData(shipment, shipment.units[0], 0, 3);

  assert.equal(labelData.trackingId, 'TRK-2026-000101');
  assert.equal(labelData.shipmentId, 'SHP-2026-001');
  assert.equal(labelData.packageIndex, 1);
  assert.equal(labelData.packageCount, 3);
  assert.equal(labelData.recipientName, 'Juan Dela Cruz');
  assert.equal(labelData.contactNumber, '0917-555-0148');
  assert.equal(labelData.address, '148 Rizal Ave, Caloocan City');
  assert.equal(labelData.destinationHub, 'TNL Baguio Hub');
  assert.equal(labelData.contents, 'Assorted office supplies');
  assert.equal(labelData.clientName, 'Northbridge Trading');
  assert.equal(labelData.route, 'Manila → TNL Baguio Hub');
  assert.equal(labelData.totalAmount, 500);
  assert.equal(labelData.weightKg, 2.5);
});

test('normalizeLabelData falls back gracefully on flat structures', () => {
  const shipment = {
    shipmentId: 'SHP-2026-007',
    recipient: 'Test Recipient',
    contactNumber: '09123123132',
    address: 'testing address',
    destinationHub: 'TNL Central',
    client: { name: 'Acme Corp' },
    route: 'Manila to Baguio',
    pricing: { totalAmount: 750 },
  };
  const unit = { trackingId: 'TRK-2026-000007' };

  const labelData = normalizeLabelData(shipment, unit, 0, 1);

  assert.equal(labelData.trackingId, 'TRK-2026-000007');
  assert.equal(labelData.shipmentId, 'SHP-2026-007');
  assert.equal(labelData.recipientName, 'Test Recipient');
  assert.equal(labelData.contactNumber, '09123123132');
  assert.equal(labelData.address, 'testing address');
  assert.equal(labelData.destinationHub, 'TNL Central');
  assert.equal(labelData.clientName, 'Acme Corp');
  assert.equal(labelData.route, 'Manila to Baguio');
  assert.equal(labelData.totalAmount, 750);
});

test('normalizeLabelData throws IncompleteLabelDataError when required fields are missing', () => {
  assert.throws(
    () => normalizeLabelData({}, {}),
    (err) => err instanceof IncompleteLabelDataError && err.missingFields.includes('trackingId')
  );
});

test('buildLabelHtml generates isolated printable HTML matching prototype layout', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 3,
    recipientName: 'Juan Dela Cruz',
    contactNumber: '0917-555-0148',
    address: '148 Rizal Ave, Caloocan City',
    destinationHub: 'TNL Baguio Hub',
    contents: 'Assorted office supplies',
    clientName: 'Northbridge Trading',
    shipmentId: 'SHP-2026-001',
    route: 'Manila → TNL Baguio',
    totalAmount: 500,
  };

  const html = buildLabelHtml(labelData);

  assert.ok(html.includes('<!DOCTYPE html>'), 'Must start with DOCTYPE');
  assert.ok(html.includes('@page {'), 'Must declare @page CSS rule');
  assert.ok(html.includes('size: A6 portrait;'), 'Must specify A6 portrait thermal paper size');
  assert.ok(html.includes('TNL LOGISTICS'), 'Must include brand name');
  assert.ok(html.includes('PKG 1 / 3'), 'Must include package pill');
  assert.ok(html.includes('SCAN TO TRACK'), 'Must include scan prompt');
  assert.ok(html.includes('TRK-2026-000101'), 'Must include tracking ID');
  assert.ok(html.includes('Juan Dela Cruz'), 'Must include recipient name');
  assert.ok(html.includes('0917-555-0148'), 'Must include contact number');
  assert.ok(html.includes('148 Rizal Ave, Caloocan City'), 'Must include recipient address');
  assert.ok(html.includes('to TNL Baguio Hub'), 'Must include destination hub with to prefix');
  assert.ok(html.includes('Assorted office supplies'), 'Must include contents');
  assert.ok(html.includes('SHP-2026-001'), 'Must include shipment ID');
  assert.ok(html.includes('Northbridge Trading'), 'Must include client name');
  assert.ok(html.includes('Manila → TNL Baguio'), 'Must include route');
  assert.ok(html.includes('PHP 500'), 'Must format PHP total amount matching frontend-mobile');
  assert.ok(html.includes('<svg'), 'Must render inline vector SVG QR code');
  assert.ok(html.includes('shape-rendering: crispEdges;'), 'Must configure crisp SVG edges for thermal print');
});

test('buildLabelHtml generates multi-unit document with CSS page breaks', () => {
  const labels = [
    {
      trackingId: 'TRK-2026-000101',
      packageIndex: 1,
      packageCount: 2,
      recipientName: 'Juan Dela Cruz',
      destinationHub: 'TNL Baguio Hub',
      shipmentId: 'SHP-2026-001',
      totalAmount: 500,
    },
    {
      trackingId: 'TRK-2026-000102',
      packageIndex: 2,
      packageCount: 2,
      recipientName: 'Juan Dela Cruz',
      destinationHub: 'TNL Baguio Hub',
      shipmentId: 'SHP-2026-001',
      totalAmount: 500,
    },
  ];

  const html = buildLabelHtml(labels);

  assert.ok(html.includes('SHP-2026-001 (2 Labels) - TNL Shipping Labels'), 'Title should reflect multiple labels');
  assert.ok(html.includes('PKG 1 / 2'), 'Must include first unit package counter');
  assert.ok(html.includes('PKG 2 / 2'), 'Must include second unit package counter');
  assert.ok(html.includes('TRK-2026-000101'), 'Must include first tracking ID');
  assert.ok(html.includes('TRK-2026-000102'), 'Must include second tracking ID');
  assert.ok(html.includes('page-break-after: always;'), 'Must specify page break after each card');
});

test('buildLabelHtml escapes untrusted input to prevent XSS in print document', () => {
  const hostile = '<script>alert(1)</script>';
  const html = buildLabelHtml({
    trackingId: 'TRK-2026-000999',
    packageIndex: 1,
    packageCount: 1,
    recipientName: hostile,
    destinationHub: 'TNL Hub',
    shipmentId: 'SHP-2026-999',
    contents: '"quoted" & <special>',
  });

  assert.ok(!html.includes('<script>'), 'Must not contain unescaped script tag');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Must contain escaped script tag');
  assert.ok(html.includes('&quot;quoted&quot; &amp; &lt;special&gt;'), 'Must contain escaped attributes');
});

test('buildLabelHtml applies dynamic company branding and badge letter', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Juan Dela Cruz',
    destinationHub: 'Camarines Hub',
    shipmentId: 'SHP-2026-001',
  };

  const html = buildLabelHtml(labelData, { companyName: 'TC & CT Integrated Logistics' });

  assert.ok(html.includes('TC &amp; CT INTEGRATED LOGISTICS'), 'Must include custom uppercase business name with HTML entities escaped');
  assert.ok(html.includes('<div class="brand-badge">T</div>'), 'Badge letter must be first letter T');
  assert.ok(html.includes('TRK-2026-000101 - TC &amp; CT Integrated Logistics Shipping Label'), 'Title must reflect company name');
});

test('buildLabelHtml derives badge initial from custom company name string', () => {
  const labelData = {
    trackingId: 'TRK-2026-000202',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Maria Santos',
    destinationHub: 'Baguio Central',
    shipmentId: 'SHP-2026-002',
  };

  const html = buildLabelHtml(labelData, 'Acme Cargo');

  assert.ok(html.includes('ACME CARGO'), 'Must include custom string brand title');
  assert.ok(html.includes('<div class="brand-badge">A</div>'), 'Badge letter must derive initial A');
  assert.ok(html.includes('TRK-2026-000202 - Acme Cargo Shipping Label'), 'Title must reflect custom brand string');
});

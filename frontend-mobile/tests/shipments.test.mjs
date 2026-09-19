import test from 'node:test';
import assert from 'node:assert/strict';

// Helper pure functions extracted from / mirroring shipment logic
function buildListParams({ search = '', status = 'ALL', labelStatus = 'ALL', page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (search && search.trim()) params.search = search.trim();
  if (status && status !== 'ALL') params.status = status;
  if (labelStatus && labelStatus !== 'ALL') params.labelStatus = labelStatus;
  return params;
}

function resolveBarcodeDestination(scannedCode) {
  const code = (scannedCode || '').trim();
  if (code.startsWith('TRK-')) {
    return { type: 'PARCEL', route: `/(main)/shipments/parcel/${encodeURIComponent(code)}` };
  }
  if (code.startsWith('SHP-')) {
    return { type: 'SHIPMENT', route: `/(main)/shipments/${encodeURIComponent(code)}` };
  }
  return { type: 'SEARCH', query: code };
}

function formatPlatformSource(registeredVia) {
  return registeredVia === 'MOBILE_FIELD' ? 'MOBILE' : 'PC';
}

function formatPlatformBanner(registeredVia) {
  return registeredVia === 'MOBILE_FIELD' ? 'REGISTERED ON MOBILE' : 'REGISTERED ON PC';
}

function resolveLabelBadge(allLabelsPrinted) {
  return allLabelsPrinted === true
    ? { label: 'labels printed', isPrinted: true }
    : { label: 'needs label', isPrinted: false };
}

function appendUniqueShipments(existingList, newPageItems) {
  const existingIds = new Set(existingList.map((s) => s.shipmentId));
  const uniqueItems = newPageItems.filter((s) => !existingIds.has(s.shipmentId));
  return [...existingList, ...uniqueItems];
}

test('buildListParams formats search and pagination parameters correctly', () => {
  const defaults = buildListParams();
  assert.equal(defaults.page, 0);
  assert.equal(defaults.size, 20);
  assert.equal(defaults.search, undefined);
  assert.equal(defaults.status, undefined);
  assert.equal(defaults.labelStatus, undefined);

  const custom = buildListParams({
    search: '  TRK-2026-000101  ',
    labelStatus: 'NEEDS_LABEL',
    status: 'LOADED_ON_TRUCK',
    page: 2,
    size: 20,
  });
  assert.equal(custom.page, 2);
  assert.equal(custom.size, 20);
  assert.equal(custom.search, 'TRK-2026-000101');
  assert.equal(custom.status, 'LOADED_ON_TRUCK');
  assert.equal(custom.labelStatus, 'NEEDS_LABEL');
});

test('buildListParams omits ALL filters', () => {
  const filtered = buildListParams({ status: 'ALL', labelStatus: 'ALL', search: '' });
  assert.equal(filtered.status, undefined);
  assert.equal(filtered.labelStatus, undefined);
  assert.equal(filtered.search, undefined);
});

test('resolveBarcodeDestination routes TRK barcodes to parcel detail', () => {
  const dest = resolveBarcodeDestination('TRK-2026-000101');
  assert.equal(dest.type, 'PARCEL');
  assert.equal(dest.route, '/(main)/shipments/parcel/TRK-2026-000101');
});

test('resolveBarcodeDestination routes SHP barcodes to shipment detail', () => {
  const dest = resolveBarcodeDestination('SHP-2026-001');
  assert.equal(dest.type, 'SHIPMENT');
  assert.equal(dest.route, '/(main)/shipments/SHP-2026-001');
});

test('resolveBarcodeDestination routes arbitrary text to search query', () => {
  const dest = resolveBarcodeDestination('Juan Dela Cruz');
  assert.equal(dest.type, 'SEARCH');
  assert.equal(dest.query, 'Juan Dela Cruz');
});

test('formatPlatformSource maps DESKTOP_OFFICE and MOBILE_FIELD', () => {
  assert.equal(formatPlatformSource('DESKTOP_OFFICE'), 'PC');
  assert.equal(formatPlatformSource('MOBILE_FIELD'), 'MOBILE');
  assert.equal(formatPlatformSource(null), 'PC');
});

test('formatPlatformBanner displays appropriate uppercase registration label', () => {
  assert.equal(formatPlatformBanner('DESKTOP_OFFICE'), 'REGISTERED ON PC');
  assert.equal(formatPlatformBanner('MOBILE_FIELD'), 'REGISTERED ON MOBILE');
});

test('resolveLabelBadge accurately reflects printed vs needs label state', () => {
  const printed = resolveLabelBadge(true);
  assert.equal(printed.label, 'labels printed');
  assert.equal(printed.isPrinted, true);

  const unprinted = resolveLabelBadge(false);
  assert.equal(unprinted.label, 'needs label');
  assert.equal(unprinted.isPrinted, false);

  const missing = resolveLabelBadge(null);
  assert.equal(missing.label, 'needs label');
  assert.equal(missing.isPrinted, false);
});

test('appendUniqueShipments preserves order and deduplicates existing IDs across pages', () => {
  const page0 = [
    { shipmentId: 'SHP-2026-001', recipientName: 'Alice' },
    { shipmentId: 'SHP-2026-002', recipientName: 'Bob' },
  ];
  const page1 = [
    { shipmentId: 'SHP-2026-002', recipientName: 'Bob Duplicate' },
    { shipmentId: 'SHP-2026-003', recipientName: 'Charlie' },
  ];

  const merged = appendUniqueShipments(page0, page1);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].shipmentId, 'SHP-2026-001');
  assert.equal(merged[1].shipmentId, 'SHP-2026-002');
  assert.equal(merged[1].recipientName, 'Bob');
  assert.equal(merged[2].shipmentId, 'SHP-2026-003');
});

// Helper pure functions for shipment detail metrics & financial breakdown
function formatShipmentMetrics(shipment) {
  const units = shipment.units || [];
  const totalWeightKg = shipment.weightKg != null
    ? Number(shipment.weightKg)
    : units.reduce((sum, u) => sum + (Number(u.weightKg) || 0), 0);
  const totalVolumeCm3 = shipment.volumeCm3 != null
    ? Number(shipment.volumeCm3)
    : units.reduce((sum, u) => sum + (Number(u.volumeCm3) || 0), 0);
  const totalVolumeM3 = totalVolumeCm3 > 0 ? (totalVolumeCm3 / 1000000).toFixed(4) : null;
  const billableWeightKg = shipment.billableWeightKg != null
    ? Number(shipment.billableWeightKg)
    : (totalVolumeCm3 > 0 ? Math.max(totalWeightKg, totalVolumeCm3 / 5000) : totalWeightKg);

  const hasMetrics = totalWeightKg > 0 || totalVolumeCm3 > 0 || billableWeightKg > 0;
  return hasMetrics
    ? `${totalWeightKg.toFixed(2)} kg actual, ${totalVolumeM3 ? `${totalVolumeM3} m³` : '0 m³'} (${billableWeightKg.toFixed(2)} kg billable)`
    : null;
}

function formatRoute(route) {
  if (!route) return 'TNL Baguio Hub';
  return route.replace(/\s*(?:->|→)\s*/g, ' to ');
}

function formatFinancialBreakdown(shipment) {
  const totalAmount = Number(shipment.totalAmount || 0);
  const amountPaid = shipment.amountPaid != null ? Number(shipment.amountPaid) : null;
  const balance = shipment.balance != null ? Number(shipment.balance) : (amountPaid != null ? Math.max(0, totalAmount - amountPaid) : 0);
  const paymentStatus = (shipment.payment || 'UNPAID').toUpperCase();

  return {
    totalAmount,
    amountPaid,
    balance,
    paymentStatus,
    badgeText: paymentStatus === 'PAID' ? 'Paid' : paymentStatus === 'PARTIALLY_PAID' ? 'Partial' : 'Unpaid',
    hasBalanceSubtext: (paymentStatus === 'PARTIALLY_PAID' && amountPaid != null) || (paymentStatus === 'UNPAID' && totalAmount > 0),
  };
}

test('formatShipmentMetrics aggregates unit weights and volumes when top-level fields are absent', () => {
  const shipment = {
    units: [
      { weightKg: 1.5, volumeCm3: 30000 },
      { weightKg: 2.25, volumeCm3: 60000 },
    ],
  };
  const result = formatShipmentMetrics(shipment);
  // Total weight: 3.75 kg, volume: 90000 cm3 = 0.0900 m3, volumetric weight = 90000 / 5000 = 18.00 kg
  assert.equal(result, '3.75 kg actual, 0.0900 m³ (18.00 kg billable)');
});

test('formatShipmentMetrics prioritizes server-computed rollup metrics if provided', () => {
  const shipment = {
    weightKg: 5.0,
    volumeCm3: 15000,
    billableWeightKg: 5.0,
    units: [],
  };
  const result = formatShipmentMetrics(shipment);
  assert.equal(result, '5.00 kg actual, 0.0150 m³ (5.00 kg billable)');
});

test('formatRoute normalizes arrow characters to "to"', () => {
  assert.equal(formatRoute('Manila → TNL Baguio'), 'Manila to TNL Baguio');
  assert.equal(formatRoute('Manila -> TNL Baguio'), 'Manila to TNL Baguio');
  assert.equal(formatRoute('Manila to TNL Baguio'), 'Manila to TNL Baguio');
  assert.equal(formatRoute(null), 'TNL Baguio Hub');
});

test('formatFinancialBreakdown accurately computes paid, partial, and unpaid balances', () => {
  const paidShipment = { totalAmount: 500, amountPaid: 500, balance: 0, payment: 'PAID' };
  const partialShipment = { totalAmount: 500, amountPaid: 200, balance: 300, payment: 'PARTIALLY_PAID' };
  const unpaidShipment = { totalAmount: 500, amountPaid: 0, balance: 500, payment: 'UNPAID' };

  const paidBreakdown = formatFinancialBreakdown(paidShipment);
  assert.equal(paidBreakdown.badgeText, 'Paid');
  assert.equal(paidBreakdown.hasBalanceSubtext, false);

  const partialBreakdown = formatFinancialBreakdown(partialShipment);
  assert.equal(partialBreakdown.badgeText, 'Partial');
  assert.equal(partialBreakdown.balance, 300);
  assert.equal(partialBreakdown.hasBalanceSubtext, true);

  const unpaidBreakdown = formatFinancialBreakdown(unpaidShipment);
  assert.equal(unpaidBreakdown.badgeText, 'Unpaid');
  assert.equal(unpaidBreakdown.balance, 500);
  assert.equal(unpaidBreakdown.hasBalanceSubtext, true);
});



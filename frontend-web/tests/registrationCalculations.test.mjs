import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShipmentMetrics } from '../src/features/shipments/registrationCalculations.mjs';
import { calculateTotalCents } from '../src/features/shipments/fixedPointPricing.mjs';
import {
  clampParcelPage,
  createParcelPaginationModel,
  generatePaginationItems,
  getParcelPageCount,
  getParcelPageIndex,
  PARCEL_PAGE_SIZE,
} from '../src/features/shipments/parcelPagination.mjs';

const baseShipment = {
  quantity: '2',
  weightPerUnit: '2.5',
  lengthCm: '50',
  widthCm: '40',
  heightCm: '30',
};

test('calculates volume and selects volumetric weight when it is greater', () => {
  const metrics = calculateShipmentMetrics(baseShipment, 5000);

  assert.equal(metrics.unitVolume, 0.06);
  assert.equal(metrics.totalVolume, 0.12);
  assert.equal(metrics.actualWeight, 5);
  assert.equal(metrics.volumetricWeight, 24);
  assert.equal(metrics.billableWeight, 24);
});

test('selects total actual weight when it is greater', () => {
  const metrics = calculateShipmentMetrics({ ...baseShipment, weightPerUnit: '20' }, 5000);

  assert.equal(metrics.actualWeight, 40);
  assert.equal(metrics.volumetricWeight, 24);
  assert.equal(metrics.billableWeight, 40);
});

test('rounds volumetric weight to two decimal places', () => {
  const metrics = calculateShipmentMetrics({
    quantity: '1',
    weightPerUnit: '1',
    lengthCm: '33',
    widthCm: '22',
    heightCm: '11',
  }, 5000);

  assert.equal(metrics.volumetricWeight, 1.6);
  assert.equal(metrics.billableWeight, 1.6);
});

test('keeps volume and actual weight available when settings are unavailable', () => {
  const metrics = calculateShipmentMetrics(baseShipment, null);

  assert.equal(metrics.totalVolume, 0.12);
  assert.equal(metrics.actualWeight, 5);
  assert.equal(metrics.volumetricWeight, null);
  assert.equal(metrics.billableWeight, null);
});

test('returns unavailable metrics for invalid shipment inputs', () => {
  const metrics = calculateShipmentMetrics({
    ...baseShipment,
    quantity: '0',
    lengthCm: '',
  }, 5000);

  assert.equal(metrics.unitVolume, null);
  assert.equal(metrics.totalVolume, null);
  assert.equal(metrics.actualWeight, null);
  assert.equal(metrics.volumetricWeight, null);
  assert.equal(metrics.billableWeight, null);
});

test('calculates per-unit parcels with heterogeneous dimensions and rate per kilo', () => {
  const shipmentWithUnits = {
    parcels: [
      { weightKg: '5.0', lengthCm: '40', widthCm: '30', heightCm: '20' }, // 24,000 cm3 = 0.024 m3 -> 4.8 kg vol
      { weightKg: '2.0', lengthCm: '60', widthCm: '50', heightCm: '40' }, // 120,000 cm3 = 0.12 m3 -> 24.0 kg vol
    ],
  };
  const metrics = calculateShipmentMetrics(shipmentWithUnits, 5000, 15.5);

  // Total actual weight = 7.0 kg
  // Total volume = 0.144 m3
  // Total volumetric weight = (24000 + 120000) / 5000 = 144000 / 5000 = 28.8 kg
  // Billable weight = max(7.0, 28.8) = 28.8 kg
  // Shipping fee = 28.8 * 15.5 = 446.40
  assert.equal(metrics.actualWeight, 7);
  assert.equal(metrics.totalVolume, 0.144);
  assert.equal(metrics.volumetricWeight, 28.8);
  assert.equal(metrics.billableWeight, 28.8);
  assert.equal(metrics.ratePerKilo, 15.5);
  assert.equal(metrics.shippingFee, 446.4);
});

test('computes shipping fee from actual weight when actual exceeds volumetric', () => {
  const shipmentWithHeavyUnits = {
    parcels: [
      { weightKg: '20.0', lengthCm: '20', widthCm: '20', heightCm: '20' }, // 8000 cm3 / 5000 = 1.6 kg
      { weightKg: '15.0', lengthCm: '20', widthCm: '20', heightCm: '20' }, // 8000 cm3 / 5000 = 1.6 kg
    ],
  };
  const metrics = calculateShipmentMetrics(shipmentWithHeavyUnits, 5000, 20.0);

  // Total actual weight = 35.0 kg
  // Volumetric weight = 3.2 kg
  // Billable weight = 35.0 kg
  // Shipping fee = 35.0 * 20.0 = 700.00
  assert.equal(metrics.actualWeight, 35);
  assert.equal(metrics.volumetricWeight, 3.2);
  assert.equal(metrics.billableWeight, 35);
  assert.equal(metrics.shippingFee, 700);
});

test('returns null shipping fee when ratePerKilo is not provided or zero', () => {
  const shipment = {
    parcels: [
      { weightKg: '5.0', lengthCm: '20', widthCm: '20', heightCm: '20' },
    ],
  };
  const metricsNoRate = calculateShipmentMetrics(shipment, 5000, null);
  assert.equal(metricsNoRate.shippingFee, null);

  const metricsZeroRate = calculateShipmentMetrics(shipment, 5000, 0);
  assert.equal(metricsZeroRate.shippingFee, null);
});

test('generatePaginationItems produces windowed pagination with max 7 items and ellipsis jump ranges for web', () => {
  // Small total: 4 pages
  const small = generatePaginationItems(1, 4);
  assert.equal(small.length, 4);
  assert.deepEqual(small.map((i) => i.label), ['1', '2', '3', '4']);
  assert.equal(small[1].isCurrent, true);

  // Large total: page 37 of 100
  const middle = generatePaginationItems(36, 100);
  assert.equal(middle.length, 7);
  assert.deepEqual(middle.map((i) => i.label), ['1', '...', '36', '37', '38', '...', '100']);
  assert.equal(middle[3].isCurrent, true);
  assert.equal(middle[1].pageIndex, 31);
  assert.equal(middle[5].pageIndex, 41);

  // Start & End
  const start = generatePaginationItems(0, 100);
  assert.deepEqual(start.map((i) => i.label), ['1', '2', '3', '4', '5', '...', '100']);
  const end = generatePaginationItems(99, 100);
  assert.deepEqual(end.map((i) => i.label), ['1', '...', '96', '97', '98', '99', '100']);
});

test('calculateTotalCents returns null for negative or non-decimal amounts and never silently coerces to zero', () => {
  assert.equal(calculateTotalCents('-10', '0'), null);
  assert.equal(calculateTotalCents('10.123', '0'), null);
  assert.equal(calculateTotalCents('abc', '0'), null);
  assert.equal(calculateTotalCents('10', '-5'), null);
  assert.equal(calculateTotalCents('10', '1.999'), null);
  assert.equal(calculateTotalCents('10', 'invalid'), null);
  // Valid zero amounts compute zero
  assert.equal(calculateTotalCents('0', '0'), 0);
  assert.equal(calculateTotalCents(0, 0), 0);
  assert.equal(calculateTotalCents('125.50', '24.50'), 15000);
});

test('parcel pagination helpers compute page count, clamping, and reverse index correctly', () => {
  assert.equal(PARCEL_PAGE_SIZE, 10);
  assert.equal(getParcelPageCount(0), 1);
  assert.equal(getParcelPageCount(1), 1);
  assert.equal(getParcelPageCount(10), 1);
  assert.equal(getParcelPageCount(11), 2);
  assert.equal(getParcelPageCount(25), 3);

  // Clamping
  assert.equal(clampParcelPage(-1, 25), 0);
  assert.equal(clampParcelPage(0, 25), 0);
  assert.equal(clampParcelPage(1, 25), 1);
  assert.equal(clampParcelPage(2, 25), 2);
  assert.equal(clampParcelPage(5, 25), 2);

  // Forward indexing
  assert.equal(getParcelPageIndex(0, 25, false), 0);
  assert.equal(getParcelPageIndex(9, 25, false), 0);
  assert.equal(getParcelPageIndex(10, 25, false), 1);
  assert.equal(getParcelPageIndex(24, 25, false), 2);

  // Reverse indexing (newest first)
  // For 25 units: index 24 (Unit #25) is at top of page 0
  assert.equal(getParcelPageIndex(24, 25, true), 0);
  // index 15 (Unit #16) is at bottom of page 0 (10th item)
  assert.equal(getParcelPageIndex(15, 25, true), 0);
  // index 14 (Unit #15) is at top of page 1
  assert.equal(getParcelPageIndex(14, 25, true), 1);
  // index 0 (Unit #1) is at bottom of page 2
  assert.equal(getParcelPageIndex(0, 25, true), 2);
});

test('createParcelPaginationModel delivers reverse unit ordering and off-page error detection', () => {
  const parcels = Array.from({ length: 15 }, (_, i) => ({
    id: `u-${i + 1}`,
    seq: i + 1,
    weightKg: '1.0',
    lengthCm: '20',
    widthCm: '20',
    heightCm: '20',
  }));

  // Page 0 requested with reverse = true
  const page0Model = createParcelPaginationModel(parcels, {}, 0, { reverse: true });
  assert.equal(page0Model.totalUnits, 15);
  assert.equal(page0Model.totalPages, 2);
  assert.equal(page0Model.activePage, 0);
  assert.equal(page0Model.visibleParcels.length, 10);
  // Newest unit at the top: Unit #15
  assert.equal(page0Model.visibleParcels[0].parcel.seq, 15);
  assert.equal(page0Model.visibleParcels[0].globalIndex, 14);
  // 10th item on page 0: Unit #6
  assert.equal(page0Model.visibleParcels[9].parcel.seq, 6);
  assert.equal(page0Model.visibleParcels[9].globalIndex, 5);

  // Page 1
  const page1Model = createParcelPaginationModel(parcels, {}, 1, { reverse: true });
  assert.equal(page1Model.activePage, 1);
  assert.equal(page1Model.visibleParcels.length, 5);
  // First item on page 1: Unit #5
  assert.equal(page1Model.visibleParcels[0].parcel.seq, 5);
  assert.equal(page1Model.visibleParcels[0].globalIndex, 4);
  // Last item on page 1: Unit #1
  assert.equal(page1Model.visibleParcels[4].parcel.seq, 1);
  assert.equal(page1Model.visibleParcels[4].globalIndex, 0);

  // Error detection: unit #2 (index 1) has an error, while viewing Page 0
  const errors = {
    parcel_1_weightKg: 'Required',
    'parcels[14].lengthCm': 'Required',
  };
  const modelWithErrors = createParcelPaginationModel(parcels, errors, 0, { reverse: true });
  // Unit index 14 is on page 0, visible
  // Unit index 1 is on page 1, off-page
  assert.deepEqual(modelWithErrors.offPageErrorUnitIndices, [1]);
  // Error pages: index 14 is on page 0, index 1 is on page 1
  assert.deepEqual(Array.from(modelWithErrors.errorPageIndices), [0, 1]);
});

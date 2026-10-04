import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShipmentMetrics } from '../src/features/shipments/registrationCalculations.mjs';

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


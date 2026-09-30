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

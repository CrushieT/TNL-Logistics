import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShipmentMetrics } from '../src/features/shipments/registrationCalculations.mjs';
import { calculateRegistration } from '../../frontend-mobile/src/features/shipments/registration.mjs';

const parcel = (weightKg, lengthCm = '0.1', widthCm = '0.1', heightCm = '0.1') => ({ weightKg, lengthCm, widthCm, heightCm });
const vectors = [
  { name: 'below half cent', parcels: [parcel('0.01')], rate: '100.49', fee: 1 },
  { name: 'at half cent', parcels: [parcel('0.06')], rate: '34.25', fee: 2.06 },
  { name: 'above half cent', parcels: [parcel('0.01')], rate: '100.51', fee: 1.01 },
  { name: 'heterogeneous parcels', parcels: [parcel('5', '40', '30', '20'), parcel('2', '60', '50', '40')], rate: '15.5', fee: 446.4 },
  { name: 'below volumetric boundary', parcels: [parcel('0.01', '50.24', '1', '100')], rate: '34.25', fee: 34.25 },
  { name: 'round volume before pricing', parcels: [parcel('0.01', '50.25', '1', '100')], rate: '34.25', fee: 34.59 },
  { name: 'above volumetric boundary', parcels: [parcel('0.01', '50.26', '1', '100')], rate: '34.25', fee: 34.59 },
  { name: 'large valid aggregate', parcels: Array.from({ length: 1000 }, () => parcel('50000')), rate: '0.01', fee: 500000 },
];

for (const vector of vectors) {
  test(`pricing parity: ${vector.name}`, () => {
    const input = { parcels: vector.parcels, quantity: String(vector.parcels.length), otherCharges: '0.29' };
    const web = calculateShipmentMetrics(input, 5000, vector.rate);
    const mobile = calculateRegistration(input, 5000, vector.rate);
    assert.equal(web.shippingFee, vector.fee);
    assert.equal(mobile.shippingFee, vector.fee);
    assert.equal(mobile.totalCents, Math.round(vector.fee * 100) + 29);
    for (const field of ['actualWeight', 'volumetricWeight', 'billableWeight', 'totalVolume']) {
      assert.equal(web[field], mobile[field], field);
    }
    assert.doesNotThrow(() => JSON.stringify(mobile));
  });
}

test('legacy pricing rounds half cents and retains missing settings behavior', () => {
  const measurements = { quantity: '1', lengthCm: '0.1', widthCm: '0.1', heightCm: '0.1' };
  assert.equal(calculateShipmentMetrics({ ...measurements, weightPerUnit: '0.06' }, 5000, 34.25).shippingFee, 2.06);
  assert.equal(calculateRegistration({ ...measurements, weightKg: '0.06', otherCharges: '0.29' }, 5000, 34.25).totalCents, 235);
  assert.equal(calculateShipmentMetrics({ parcels: [parcel('1')] }, null, 34.25).shippingFee, null);
  assert.equal(calculateRegistration({ parcels: [parcel('1')], quantity: '1' }, null, 34.25).totalAmount, null);
});

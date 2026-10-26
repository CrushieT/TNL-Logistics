import test from 'node:test';
import assert from 'node:assert/strict';
import { mapClientRecord } from '../src/features/clients/clientMapping.mjs';

test('maps client record with VIP ratePerKilo', () => {
  const raw = {
    clientId: 'CL-001',
    name: 'VIP Client',
    address: 'Manila',
    contactNumber: '09171234567',
    email: 'vip@test.ph',
    defaultRateType: 'PER_KILO',
    ratePerKilo: '85.50',
    active: true,
    totalShipments: 12,
    totalParcels: 24,
    totalCharges: 5000,
    totalPaid: 3000,
    outstandingBalance: 2000,
  };

  const mapped = mapClientRecord(raw);
  assert.equal(mapped.clientId, 'CL-001');
  assert.equal(mapped.name, 'VIP Client');
  assert.equal(mapped.ratePerKilo, 85.50);
  assert.equal(mapped.outstandingBalance, 2000);
});

test('maps client record without VIP rate (null ratePerKilo)', () => {
  const raw = {
    clientId: 'CL-002',
    name: 'Regular Client',
    ratePerKilo: null,
  };

  const mapped = mapClientRecord(raw);
  assert.equal(mapped.clientId, 'CL-002');
  assert.equal(mapped.ratePerKilo, null);
});

test('handles undefined input safely', () => {
  assert.equal(mapClientRecord(null), null);
  assert.equal(mapClientRecord(undefined), null);
});

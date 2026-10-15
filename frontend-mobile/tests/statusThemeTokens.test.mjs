import test from 'node:test';
import assert from 'node:assert/strict';
import { colors, getParcelStatusColor } from '../src/theme/index.js';

test('mobile getParcelStatusColor returns role-paired progression colors', () => {
  // Exception (Red)
  assert.equal(getParcelStatusColor('Registered', true), colors.danger);
  assert.equal(getParcelStatusColor('Completed', true), colors.danger);

  // Phase 3: Dispatch Staff Custody (Purple -> Green)
  assert.equal(getParcelStatusColor('Completed', false), colors.success);
  assert.equal(getParcelStatusColor('COMPLETED', false), colors.success);
  assert.equal(getParcelStatusColor('Delivered / Completed', false), colors.success);
  assert.equal(getParcelStatusColor('Loaded to Hauler', false), colors.purple);
  assert.equal(getParcelStatusColor('LOADED_TO_HAULER', false), colors.purple);

  // Phase 2: Courier Staff Custody (Amber -> Teal)
  assert.equal(getParcelStatusColor('Loaded on Truck', false), colors.amber);
  assert.equal(getParcelStatusColor('LOADED_ON_TRUCK', false), colors.amber);
  assert.equal(getParcelStatusColor('Arrived at TNL', false), colors.teal);
  assert.equal(getParcelStatusColor('ARRIVED_AT_TNL', false), colors.teal);

  // Phase 1: Receiving Staff Custody (Slate -> Blue)
  assert.equal(getParcelStatusColor('QR Generated', false), colors.info);
  assert.equal(getParcelStatusColor('QR_GENERATED', false), colors.info);
  assert.equal(getParcelStatusColor('Registered', false), colors.slate);
  assert.equal(getParcelStatusColor('REGISTERED', false), colors.slate);
});

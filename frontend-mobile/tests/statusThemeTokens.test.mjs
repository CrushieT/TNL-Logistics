import test from 'node:test';
import assert from 'node:assert/strict';
import { colors, formatParcelStatusDisplay, getParcelStatusBadgeStyle, getParcelStatusColor } from '../src/theme/index.js';

test('receiving shipment status badge matches web progression colors and arrival wording', () => {
  assert.deepEqual(getParcelStatusBadgeStyle('Arrived in Daet'), {
    color: colors.teal, backgroundColor: colors.tealSoft, borderColor: '#99F6E4',
  });
  assert.equal(getParcelStatusBadgeStyle('LOADED_TO_HAULER').color, colors.purple);
  assert.equal(getParcelStatusBadgeStyle('Completed').backgroundColor, colors.successSoft);
  assert.equal(formatParcelStatusDisplay('Arrived at TNL'), 'Arrived in Daet');
  assert.equal(formatParcelStatusDisplay('ARRIVED_AT_TNL'), 'Arrived in Daet');
});

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

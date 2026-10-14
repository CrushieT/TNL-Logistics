import test from 'node:test';
import assert from 'node:assert/strict';
import {
  colors,
  statusStyles,
  paymentStyles,
  collectionStyles,
  waybillStyles,
  labelStyles,
} from '../src/theme/index.js';

test('statusStyles maps tracking lifecycles to role-paired progression colors', () => {
  // Phase 1: Receiving Staff Custody (Slate -> Blue)
  assert.equal(statusStyles['Registered'].fg, colors.slate);
  assert.equal(statusStyles['REGISTERED'].fg, colors.slate);
  assert.equal(statusStyles['QR Generated'].fg, colors.info);
  assert.equal(statusStyles['QR_GENERATED'].fg, colors.info);

  // Phase 2: Courier Staff Custody (Amber -> Teal)
  assert.equal(statusStyles['Loaded on Truck'].fg, colors.amber);
  assert.equal(statusStyles['LOADED_ON_TRUCK'].fg, colors.amber);
  assert.equal(statusStyles['Arrived at TNL'].fg, colors.teal);
  assert.equal(statusStyles['ARRIVED_AT_TNL'].fg, colors.teal);

  // Phase 3: Dispatch Staff Custody (Purple -> Green)
  assert.equal(statusStyles['Loaded to Hauler'].fg, colors.purple);
  assert.equal(statusStyles['LOADED_TO_HAULER'].fg, colors.purple);
  assert.equal(statusStyles['Completed'].fg, colors.success);
  assert.equal(statusStyles['COMPLETED'].fg, colors.success);
  assert.equal(statusStyles['Delivered / Completed'].fg, colors.success);

  // Exception / Discrepancy (Red)
  assert.equal(statusStyles['Lost'].fg, colors.danger);
  assert.equal(statusStyles['LOST'].fg, colors.danger);
  assert.equal(statusStyles['With Loss'].fg, colors.danger);
});

test('paymentStyles links all keys to design tokens and separates Unpaid from Lost', () => {
  // Settled / Paid (Green)
  assert.equal(paymentStyles['Paid'].fg, colors.success);
  assert.equal(paymentStyles['PAID'].fg, colors.success);
  assert.equal(paymentStyles['Settled'].fg, colors.success);
  assert.equal(paymentStyles['SETTLED'].fg, colors.success);

  // Active Balance / Unpaid (Warm Amber)
  assert.equal(paymentStyles['Unpaid'].fg, colors.amber);
  assert.equal(paymentStyles['UNPAID'].fg, colors.amber);
  assert.equal(paymentStyles['Partial'].fg, colors.amber);
  assert.equal(paymentStyles['PARTIAL'].fg, colors.amber);
  assert.equal(paymentStyles['PARTIALLY_PAID'].fg, colors.amber);
  assert.equal(paymentStyles['For Collection'].fg, colors.amber);
  assert.equal(paymentStyles['FOR_COLLECTION'].fg, colors.amber);

  // Contrast invariant: Unpaid is distinct from Danger (Lost cargo)
  assert.notEqual(paymentStyles['Unpaid'].fg, colors.danger);
});

test('collectionStyles provides unified SOA statement lifecycle tokens', () => {
  // Staging: Ready for SOA (Blue)
  assert.equal(collectionStyles['READY_FOR_SOA'].fg, colors.info);
  assert.equal(collectionStyles['Ready for SOA'].fg, colors.info);

  // Outstanding: SOA Generated (Warm Amber)
  assert.equal(collectionStyles['SOA_GENERATED'].fg, colors.amber);
  assert.equal(collectionStyles['SOA Generated'].fg, colors.amber);

  // Terminal: Settled (Green)
  assert.equal(collectionStyles['SETTLED'].fg, colors.success);
  assert.equal(collectionStyles['Settled'].fg, colors.success);
});

test('waybillStyles aligns manifest stages with physical tracking and payments', () => {
  // Neutral Draft
  assert.equal(waybillStyles['Not Generated'].fg, colors.inkFaint);
  assert.equal(waybillStyles['NOT_GENERATED'].fg, colors.inkFaint);

  // Staged Manifest (Blue)
  assert.equal(waybillStyles['Generated'].fg, colors.info);
  assert.equal(waybillStyles['GENERATED'].fg, colors.info);

  // Carrier Transit (Purple, matching Loaded to Hauler)
  assert.equal(waybillStyles['Sent to Hauler'].fg, colors.purple);
  assert.equal(waybillStyles['SENT_TO_HAULER'].fg, colors.purple);

  // Signed & Closed (Green)
  assert.equal(waybillStyles['Signed / Completed'].fg, colors.success);
  assert.equal(waybillStyles['SIGNED_COMPLETED'].fg, colors.success);

  // Cargo Loss (Red)
  assert.equal(waybillStyles['Closed with Loss'].fg, colors.danger);
  assert.equal(waybillStyles['Closed as All Lost'].fg, colors.danger);
});

test('labelStyles maps Printed to success and Pending to neutral', () => {
  assert.equal(labelStyles['Printed'].fg, colors.success);
  assert.equal(labelStyles['PRINTED'].fg, colors.success);
  assert.equal(labelStyles['Pending'].fg, colors.inkFaint);
  assert.equal(labelStyles['PENDING'].fg, colors.inkFaint);
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCANNER_MODES,
  SCANNER_PHASES,
  BATCH_OPERATIONS,
  MAX_BATCH_SIZE,
  STATUS_LABELS,
  formatStatusLabel,
  normalizeTrackingId,
  addTrackingIdToBatch,
  removeTrackingIdFromBatch,
  buildSingleScanRequest,
  buildBatchScanRequest,
  canSubmitSingle,
  canSubmitBatch,
  canActivateCamera,
  initialScannerState,
  scannerReducer
} from '../src/features/scanner/scannerFlow.mjs';
import { invokeHapticSafely } from '../src/features/scanner/utils/hapticsCore.mjs';

describe('Scanner Flow & State Machine', () => {

  // 1. Valid Tracking IDs normalize to uppercase
  it('1. Valid Tracking IDs normalize to uppercase', () => {
    const result = normalizeTrackingId('trk-2026-000101');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.trackingId, 'TRK-2026-000101');
    assert.strictEqual(result.error, null);
  });

  // 2. Whitespace is removed
  it('2. Whitespace is removed from tracking ID', () => {
    const result = normalizeTrackingId('   TRK-2026-000102   ');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.trackingId, 'TRK-2026-000102');
  });

  // 3. URLs, shipment IDs, JSON, suffixes, and malformed IDs are rejected
  it('3. URLs, shipment IDs, JSON, suffixes, and malformed IDs are rejected', () => {
    const rejects = [
      'https://example.com/TRK-2026-000101',
      'http://tnl.com',
      'SHP-2026-000001',
      '{"trackingId":"TRK-2026-000101"}',
      'TRK-2026-000101-EXTRA',
      'TRK-202-0001',
      'INVALID-ID',
      '',
      null,
      undefined
    ];

    for (const val of rejects) {
      const res = normalizeTrackingId(val);
      assert.strictEqual(res.isValid, false, `Expected ${val} to be rejected`);
      assert.ok(res.error);
    }
  });

  // 4. Status labels match approved terminology
  it('4. Status labels match the approved terminology', () => {
    assert.strictEqual(formatStatusLabel('REGISTERED'), 'Registered');
    assert.strictEqual(formatStatusLabel('QR_GENERATED'), 'QR Generated');
    assert.strictEqual(formatStatusLabel('LOADED_ON_TRUCK'), 'Loaded on Truck');
    assert.strictEqual(formatStatusLabel('ARRIVED_AT_TNL'), 'Outload / Arrive TNL');
    assert.strictEqual(formatStatusLabel('LOADED_TO_HAULER'), 'Loaded to Hauler');
    assert.strictEqual(formatStatusLabel('COMPLETED'), 'Completed');
  });

  // 5. COMPLETED is never returned as a batch operation
  it('5. COMPLETED is never returned as a batch operation', () => {
    assert.strictEqual(BATCH_OPERATIONS.includes('COMPLETED'), false);
    assert.deepStrictEqual(BATCH_OPERATIONS, [
      'LOADED_ON_TRUCK',
      'ARRIVED_AT_TNL',
      'LOADED_TO_HAULER'
    ]);
  });

  // 6. Single payload uses trackingId and targetStatus
  it('6. Single payload uses trackingId and targetStatus', () => {
    const context = {
      trackingId: 'TRK-2026-000101',
      nextStatusCode: 'ARRIVED_AT_TNL',
      canScan: true
    };
    const payload = buildSingleScanRequest(context);
    assert.strictEqual(payload.trackingId, 'TRK-2026-000101');
    assert.strictEqual(payload.targetStatus, 'ARRIVED_AT_TNL');
    assert.strictEqual(payload.vehicleId, undefined);
  });

  // 7. Vehicle ID is present only for LOADED_ON_TRUCK
  it('7. Vehicle ID is present only for LOADED_ON_TRUCK', () => {
    const truckContext = {
      trackingId: 'TRK-2026-000101',
      nextStatusCode: 'LOADED_ON_TRUCK',
      canScan: true
    };
    const truckPayload = buildSingleScanRequest(truckContext, 'VH-001');
    assert.strictEqual(truckPayload.vehicleId, 'VH-001');

    const tnlContext = {
      trackingId: 'TRK-2026-000101',
      nextStatusCode: 'ARRIVED_AT_TNL',
      canScan: true
    };
    const tnlPayload = buildSingleScanRequest(tnlContext, 'VH-001');
    assert.strictEqual(tnlPayload.vehicleId, undefined);
  });

  // 8. Duplicate batch IDs are rejected
  it('8. Duplicate batch IDs are rejected', () => {
    const queue = ['TRK-2026-000101', 'TRK-2026-000102'];
    const res = addTrackingIdToBatch(queue, 'TRK-2026-000101');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isDuplicate, true);
    assert.strictEqual(res.queue.length, 2);
  });

  // 9. Batch insertion order is preserved
  it('9. Batch insertion order is preserved', () => {
    let queue = [];
    const ids = ['TRK-2026-000003', 'TRK-2026-000001', 'TRK-2026-000002'];
    for (const id of ids) {
      const res = addTrackingIdToBatch(queue, id);
      assert.strictEqual(res.success, true);
      queue = res.queue;
    }
    assert.deepStrictEqual(queue, ids);
  });

  // 10. Removing an ID leaves remaining order intact
  it('10. Removing an ID leaves remaining order intact', () => {
    const queue = ['TRK-2026-000003', 'TRK-2026-000001', 'TRK-2026-000002'];
    const updated = removeTrackingIdFromBatch(queue, 'TRK-2026-000001');
    assert.deepStrictEqual(updated, ['TRK-2026-000003', 'TRK-2026-000002']);
  });

  // 11. The 101st item is rejected
  it('11. The 101st item is rejected', () => {
    const fullQueue = [];
    for (let i = 1; i <= MAX_BATCH_SIZE; i++) {
      fullQueue.push(`TRK-2026-${String(i).padStart(6, '0')}`);
    }
    assert.strictEqual(fullQueue.length, 100);

    const res = addTrackingIdToBatch(fullQueue, 'TRK-2026-000999');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.queue.length, 100);
    assert.ok(res.error.includes('limit reached'));
  });

  // 12. Batch submission requires an operation
  it('12. Batch submission requires an operation', () => {
    const queue = ['TRK-2026-000001'];
    assert.throws(() => {
      buildBatchScanRequest(queue, null);
    }, /Valid target operation is required/);

    assert.strictEqual(canSubmitBatch(queue, null), false);
  });

  // 13. Loaded-on-truck batch submission requires a vehicle
  it('13. Loaded-on-truck batch submission requires a vehicle', () => {
    const queue = ['TRK-2026-000001'];
    assert.throws(() => {
      buildBatchScanRequest(queue, 'LOADED_ON_TRUCK', null);
    }, /Vehicle selection is required/);

    assert.strictEqual(canSubmitBatch(queue, 'LOADED_ON_TRUCK', null), false);
    assert.strictEqual(canSubmitBatch(queue, 'LOADED_ON_TRUCK', 'VH-001'), true);
  });

  // 14. Failed submissions preserve queue state in reducer
  it('14. Failed submissions preserve queue state in reducer', () => {
    const stateWithQueue = {
      ...initialScannerState,
      mode: SCANNER_MODES.BATCH,
      batchOperation: 'ARRIVED_AT_TNL',
      batchQueue: ['TRK-2026-000001', 'TRK-2026-000002'],
      isSubmitting: true
    };

    const newState = scannerReducer(stateWithQueue, {
      type: 'SET_ERROR',
      payload: 'Network timeout'
    });

    assert.strictEqual(newState.error, 'Network timeout');
    assert.strictEqual(newState.isSubmitting, false);
    assert.deepStrictEqual(newState.batchQueue, ['TRK-2026-000001', 'TRK-2026-000002']);
  });

  // 15. Successful submissions clear queue state in reducer
  it('15. Successful submissions clear queue state in reducer', () => {
    const stateWithQueue = {
      ...initialScannerState,
      mode: SCANNER_MODES.BATCH,
      batchOperation: 'ARRIVED_AT_TNL',
      batchQueue: ['TRK-2026-000001', 'TRK-2026-000002'],
      isSubmitting: true
    };

    const newState = scannerReducer(stateWithQueue, {
      type: 'SET_BATCH_RESULT',
      payload: { requestedCount: 2, transitionedCount: 2 }
    });

    assert.strictEqual(newState.isSubmitting, false);
    assert.deepStrictEqual(newState.batchQueue, []);
    assert.strictEqual(newState.phase, SCANNER_PHASES.RESULT);
    assert.ok(newState.batchResult);
  });

  // 16. Terminal contexts expose no mutation action
  it('16. Terminal contexts expose no mutation action', () => {
    const terminalContext = {
      trackingId: 'TRK-2026-000101',
      currentStatusCode: 'LOADED_TO_HAULER',
      nextStatusCode: null,
      canScan: false
    };
    assert.strictEqual(canSubmitSingle(terminalContext), false);
  });

  // 17. Mode or operation changes with a nonempty queue require discard confirmation
  it('17. Mode or operation changes with a nonempty queue require discard confirmation', () => {
    const stateWithQueue = {
      ...initialScannerState,
      mode: SCANNER_MODES.BATCH,
      batchOperation: 'LOADED_ON_TRUCK',
      batchQueue: ['TRK-2026-000001']
    };

    // Attempt mode switch to SINGLE
    const switchState = scannerReducer(stateWithQueue, {
      type: 'SET_MODE',
      payload: SCANNER_MODES.SINGLE
    });
    assert.strictEqual(switchState.showDiscardModal, true);
    assert.deepStrictEqual(switchState.pendingAction, {
      type: 'SWITCH_MODE',
      targetMode: SCANNER_MODES.SINGLE
    });
    // Queue should remain intact until confirmed
    assert.deepStrictEqual(switchState.batchQueue, ['TRK-2026-000001']);

    // Confirm discard
    const confirmedState = scannerReducer(switchState, { type: 'DISCARD_CONFIRMED' });
    assert.strictEqual(confirmedState.mode, SCANNER_MODES.SINGLE);
    assert.strictEqual(confirmedState.showDiscardModal, false);
    assert.deepStrictEqual(confirmedState.batchQueue, []);
  });

  // 18. Result summaries distinguish applied and idempotent responses
  it('18. Result summaries distinguish applied and idempotent responses', () => {
    const appliedResponse = {
      trackingId: 'TRK-2026-000101',
      previousStatusCode: 'QR_GENERATED',
      newStatusCode: 'LOADED_ON_TRUCK',
      transitionApplied: true
    };
    const idempotentResponse = {
      trackingId: 'TRK-2026-000101',
      previousStatusCode: 'LOADED_ON_TRUCK',
      newStatusCode: 'LOADED_ON_TRUCK',
      transitionApplied: false
    };

    assert.strictEqual(appliedResponse.transitionApplied, true);
    assert.strictEqual(idempotentResponse.transitionApplied, false);
    assert.strictEqual(appliedResponse.newStatusCode !== appliedResponse.previousStatusCode, true);
    assert.strictEqual(idempotentResponse.newStatusCode === idempotentResponse.previousStatusCode, true);
  });

  // 19. LOOKUP_STARTED enters LOOKUP and stores the normalized candidate
  it('19. LOOKUP_STARTED enters LOOKUP and stores the normalized candidate', () => {
    const state = scannerReducer(initialScannerState, {
      type: 'LOOKUP_STARTED',
      payload: 'TRK-2026-000101'
    });
    assert.strictEqual(state.phase, SCANNER_PHASES.LOOKUP);
    assert.strictEqual(state.failedLookupTrackingId, 'TRK-2026-000101');
    assert.strictEqual(state.error, null);
  });

  // 20. LOOKUP_FAILED returns to SCANNING, preserves candidate, and exposes error
  it('20. LOOKUP_FAILED returns to SCANNING, preserves candidate, and exposes error', () => {
    const lookupState = {
      ...initialScannerState,
      phase: SCANNER_PHASES.LOOKUP,
      failedLookupTrackingId: 'TRK-2026-000101'
    };

    const failedState = scannerReducer(lookupState, {
      type: 'LOOKUP_FAILED',
      payload: { trackingId: 'TRK-2026-000101', message: 'Parcel not found' }
    });

    assert.strictEqual(failedState.phase, SCANNER_PHASES.SCANNING);
    assert.strictEqual(failedState.failedLookupTrackingId, 'TRK-2026-000101');
    assert.strictEqual(failedState.manualInput, 'TRK-2026-000101');
    assert.strictEqual(failedState.error, 'Parcel not found');
  });

  // 21. Lookup retry re-enters LOOKUP
  it('21. Lookup retry re-enters LOOKUP', () => {
    const failedState = {
      ...initialScannerState,
      phase: SCANNER_PHASES.SCANNING,
      failedLookupTrackingId: 'TRK-2026-000101',
      error: 'Network error'
    };

    const retryState = scannerReducer(failedState, { type: 'LOOKUP_RETRY' });
    assert.strictEqual(retryState.phase, SCANNER_PHASES.LOOKUP);
    assert.strictEqual(retryState.error, null);
    assert.strictEqual(retryState.failedLookupTrackingId, 'TRK-2026-000101');
  });

  // 22. Scan-next clears failed lookup state
  it('22. Scan-next clears failed lookup state', () => {
    const failedState = {
      ...initialScannerState,
      phase: SCANNER_PHASES.SCANNING,
      failedLookupTrackingId: 'TRK-2026-000101',
      manualInput: 'TRK-2026-000101',
      error: 'Lookup failed'
    };

    const nextState = scannerReducer(failedState, { type: 'RESET_FOR_NEXT_SCAN' });
    assert.strictEqual(nextState.phase, SCANNER_PHASES.SCANNING);
    assert.strictEqual(nextState.failedLookupTrackingId, null);
    assert.strictEqual(nextState.manualInput, '');
    assert.strictEqual(nextState.error, null);
  });

  // 23. Single submission failure returns to SINGLE_REVIEW and preserves context and vehicle
  it('23. Single submission failure returns to SINGLE_REVIEW and preserves context and vehicle', () => {
    const submittingState = {
      ...initialScannerState,
      mode: SCANNER_MODES.SINGLE,
      phase: SCANNER_PHASES.SUBMITTING,
      currentContext: { trackingId: 'TRK-2026-000101', nextStatusCode: 'LOADED_ON_TRUCK' },
      selectedVehicleId: 'VH-001',
      isSubmitting: true
    };

    const failedState = scannerReducer(submittingState, {
      type: 'SUBMISSION_FAILED',
      payload: 'Server timeout'
    });

    assert.strictEqual(failedState.phase, SCANNER_PHASES.SINGLE_REVIEW);
    assert.strictEqual(failedState.isSubmitting, false);
    assert.strictEqual(failedState.error, 'Server timeout');
    assert.strictEqual(failedState.selectedVehicleId, 'VH-001');
    assert.deepStrictEqual(failedState.currentContext, { trackingId: 'TRK-2026-000101', nextStatusCode: 'LOADED_ON_TRUCK' });
  });

  // 24. Batch submission failure returns to BATCH_READY and preserves operation, vehicle, and queue
  it('24. Batch submission failure returns to BATCH_READY and preserves operation, vehicle, and queue', () => {
    const submittingState = {
      ...initialScannerState,
      mode: SCANNER_MODES.BATCH,
      phase: SCANNER_PHASES.BATCH_SUBMITTING,
      batchOperation: 'LOADED_ON_TRUCK',
      batchVehicleId: 'VH-001',
      batchQueue: ['TRK-2026-000001', 'TRK-2026-000002'],
      isSubmitting: true
    };

    const failedState = scannerReducer(submittingState, {
      type: 'SUBMISSION_FAILED',
      payload: 'Batch conflict'
    });

    assert.strictEqual(failedState.phase, SCANNER_PHASES.BATCH_READY);
    assert.strictEqual(failedState.isSubmitting, false);
    assert.strictEqual(failedState.error, 'Batch conflict');
    assert.strictEqual(failedState.batchOperation, 'LOADED_ON_TRUCK');
    assert.strictEqual(failedState.batchVehicleId, 'VH-001');
    assert.deepStrictEqual(failedState.batchQueue, ['TRK-2026-000001', 'TRK-2026-000002']);
  });

  // 25. REQUEST_LEAVE with a nonempty batch opens the discard modal
  it('25. REQUEST_LEAVE with a nonempty batch opens the discard modal', () => {
    const batchState = {
      ...initialScannerState,
      mode: SCANNER_MODES.BATCH,
      batchQueue: ['TRK-2026-000001']
    };

    const leaveState = scannerReducer(batchState, { type: 'REQUEST_LEAVE' });
    assert.strictEqual(leaveState.showDiscardModal, true);
    assert.deepStrictEqual(leaveState.pendingAction, { type: 'LEAVE_ROUTE' });
    assert.deepStrictEqual(leaveState.batchQueue, ['TRK-2026-000001']);
  });

  // 26. Cancelling leave preserves the queue
  it('26. Cancelling leave preserves the queue', () => {
    const modalState = {
      ...initialScannerState,
      mode: SCANNER_MODES.BATCH,
      batchQueue: ['TRK-2026-000001'],
      showDiscardModal: true,
      pendingAction: { type: 'LEAVE_ROUTE' }
    };

    const cancelState = scannerReducer(modalState, { type: 'DISCARD_CANCELLED' });
    assert.strictEqual(cancelState.showDiscardModal, false);
    assert.strictEqual(cancelState.pendingAction, null);
    assert.deepStrictEqual(cancelState.batchQueue, ['TRK-2026-000001']);
  });

  // 27. Confirming leave clears the queue and pending action
  it('27. Confirming leave clears the queue and pending action', () => {
    const modalState = {
      ...initialScannerState,
      mode: SCANNER_MODES.BATCH,
      batchOperation: 'LOADED_ON_TRUCK',
      batchVehicleId: 'VH-001',
      batchQueue: ['TRK-2026-000001'],
      showDiscardModal: true,
      pendingAction: { type: 'LEAVE_ROUTE' }
    };

    const confirmedState = scannerReducer(modalState, { type: 'DISCARD_CONFIRMED' });
    assert.strictEqual(confirmedState.showDiscardModal, false);
    assert.strictEqual(confirmedState.pendingAction, null);
    assert.deepStrictEqual(confirmedState.batchQueue, []);
    assert.strictEqual(confirmedState.batchOperation, null);
    assert.strictEqual(confirmedState.batchVehicleId, null);
  });

  // 28. Camera activation is false after mount failure
  it('28. Camera activation is false after mount failure', () => {
    const active = canActivateCamera({
      permissionGranted: true,
      isScreenFocused: true,
      cameraError: 'Camera preview unavailable',
      phase: SCANNER_PHASES.SCANNING,
      mode: SCANNER_MODES.SINGLE,
      batchOperation: null,
      batchVehicleId: null
    });
    assert.strictEqual(active, false);
  });

  // 29. Camera activation is false when a required batch vehicle is missing
  it('29. Camera activation is false when a required batch vehicle is missing', () => {
    const active = canActivateCamera({
      permissionGranted: true,
      isScreenFocused: true,
      cameraError: null,
      phase: SCANNER_PHASES.BATCH_READY,
      mode: SCANNER_MODES.BATCH,
      batchOperation: 'LOADED_ON_TRUCK',
      batchVehicleId: null
    });
    assert.strictEqual(active, false);

    const activeWithVehicle = canActivateCamera({
      permissionGranted: true,
      isScreenFocused: true,
      cameraError: null,
      phase: SCANNER_PHASES.BATCH_READY,
      mode: SCANNER_MODES.BATCH,
      batchOperation: 'LOADED_ON_TRUCK',
      batchVehicleId: 'VH-001'
    });
    assert.strictEqual(activeWithVehicle, true);
  });

  // 30. Camera activation resumes after camera retry when all other conditions pass
  it('30. Camera activation resumes after camera retry when all other conditions pass', () => {
    const errorState = {
      ...initialScannerState,
      cameraError: 'Camera mount failed'
    };

    const retriedState = scannerReducer(errorState, { type: 'CAMERA_RETRY_REQUESTED' });
    assert.strictEqual(retriedState.cameraError, null);

    const active = canActivateCamera({
      permissionGranted: true,
      isScreenFocused: true,
      cameraError: retriedState.cameraError,
      phase: retriedState.phase,
      mode: retriedState.mode,
      batchOperation: null,
      batchVehicleId: null
    });
    assert.strictEqual(active, true);
  });

  // 31. invokeHapticSafely absorbs a synchronous exception
  it('31. invokeHapticSafely absorbs a synchronous exception', async () => {
    const result = await invokeHapticSafely(() => {
      throw new Error('Native sync error');
    });
    assert.strictEqual(result, false);
  });

  // 32. invokeHapticSafely absorbs a rejected promise
  it('32. invokeHapticSafely absorbs a rejected promise', async () => {
    const result = await invokeHapticSafely(() => {
      return Promise.reject(new Error('Native async rejection'));
    });
    assert.strictEqual(result, false);
  });

  // 33. invokeHapticSafely resolves successfully for a supported call
  it('33. invokeHapticSafely resolves successfully for a supported call', async () => {
    const result = await invokeHapticSafely(() => {
      return Promise.resolve();
    });
    assert.strictEqual(result, true);
  });
});

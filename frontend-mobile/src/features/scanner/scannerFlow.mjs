/**
 * Pure business logic and state management for field staff camera scanner.
 * Free of React Native imports so it can be verified with Node's built-in test runner.
 */

export const SCANNER_MODES = {
  SINGLE: 'SINGLE',
  BATCH: 'BATCH'
};

export const SCANNER_PHASES = {
  SCANNING: 'SCANNING',
  LOOKUP: 'LOOKUP',
  SINGLE_REVIEW: 'SINGLE_REVIEW',
  VEHICLES_LOADING: 'VEHICLES_LOADING',
  SUBMITTING: 'SUBMITTING',
  RESULT: 'RESULT',
  BATCH_READY: 'BATCH_READY',
  BATCH_SUBMITTING: 'BATCH_SUBMITTING'
};

export const BATCH_OPERATIONS = [
  'LOADED_ON_TRUCK',
  'ARRIVED_AT_TNL',
  'LOADED_TO_HAULER'
];

export const MAX_BATCH_SIZE = 100;

export const STATUS_LABELS = {
  REGISTERED: 'Registered',
  QR_GENERATED: 'QR Generated',
  LOADED_ON_TRUCK: 'Loaded on Truck',
  ARRIVED_AT_TNL: 'Outload / Arrive TNL',
  LOADED_TO_HAULER: 'Loaded to Hauler',
  COMPLETED: 'Completed'
};

/**
 * Formats status code to approved human-readable mobile display label.
 */
export function formatStatusLabel(statusCode) {
  if (!statusCode) return 'Unknown';
  return STATUS_LABELS[statusCode] || statusCode;
}

/**
 * Normalizes and validates raw scanned or manually typed Tracking IDs.
 * Accepts only canonical uppercase pattern TRK-YYYY-NNNNNN.
 */
export function normalizeTrackingId(value) {
  if (value == null) {
    return { trackingId: null, error: 'Tracking ID is required', isValid: false };
  }
  const trimmed = String(value).trim().toUpperCase();
  if (!trimmed) {
    return { trackingId: null, error: 'Tracking ID is required', isValid: false };
  }
  // Reject URLs, JSON, shipment IDs (SHP-), compound QR payloads
  if (trimmed.startsWith('SHP-')) {
    return { trackingId: null, error: 'Shipment QR cannot be scanned. Please scan individual parcel QR.', isValid: false };
  }
  if (trimmed.startsWith('HTTP://') || trimmed.startsWith('HTTPS://') || trimmed.includes('{') || trimmed.includes('/')) {
    return { trackingId: null, error: 'Invalid QR payload. Expected TRK-YYYY-NNNNNN.', isValid: false };
  }
  const isMatch = /^TRK-\d{4}-\d{6}$/.test(trimmed);
  if (!isMatch) {
    return { trackingId: null, error: 'Invalid Tracking ID format. Expected TRK-YYYY-NNNNNN.', isValid: false };
  }
  return { trackingId: trimmed, error: null, isValid: true };
}

/**
 * Adds a tracking ID to the batch queue with duplicate and boundary checks.
 */
export function addTrackingIdToBatch(queue, rawValue) {
  const currentQueue = Array.isArray(queue) ? queue : [];
  const normalized = normalizeTrackingId(rawValue);
  if (!normalized.isValid) {
    return {
      success: false,
      error: normalized.error,
      isDuplicate: false,
      queue: currentQueue
    };
  }

  if (currentQueue.includes(normalized.trackingId)) {
    return {
      success: false,
      error: `Parcel ${normalized.trackingId} is already in the batch queue.`,
      isDuplicate: true,
      queue: currentQueue
    };
  }

  if (currentQueue.length >= MAX_BATCH_SIZE) {
    return {
      success: false,
      error: `Batch queue limit reached (maximum ${MAX_BATCH_SIZE} parcels).`,
      isDuplicate: false,
      queue: currentQueue
    };
  }

  return {
    success: true,
    error: null,
    isDuplicate: false,
    trackingId: normalized.trackingId,
    queue: [...currentQueue, normalized.trackingId]
  };
}

/**
 * Removes a tracking ID from the batch queue, maintaining order of remaining items.
 */
export function removeTrackingIdFromBatch(queue, trackingId) {
  if (!Array.isArray(queue)) return [];
  return queue.filter(id => id !== trackingId);
}

/**
 * Builds the payload for a single scan submission.
 */
export function buildSingleScanRequest(context, vehicleId) {
  if (!context || !context.trackingId || !context.nextStatusCode) {
    throw new Error('Valid scan context with next status is required');
  }
  const isVehicleRequired = context.nextStatusCode === 'LOADED_ON_TRUCK';
  if (isVehicleRequired && (!vehicleId || !String(vehicleId).trim())) {
    throw new Error('Vehicle selection is required for LOADED_ON_TRUCK');
  }

  const payload = {
    trackingId: context.trackingId,
    targetStatus: context.nextStatusCode,
    remarks: 'Mobile field QR scan'
  };

  if (isVehicleRequired) {
    payload.vehicleId = String(vehicleId).trim();
  }

  return payload;
}

/**
 * Builds the payload for a rapid batch scan submission.
 */
export function buildBatchScanRequest(queue, targetStatus, vehicleId) {
  if (!Array.isArray(queue) || queue.length === 0) {
    throw new Error('At least one tracking ID is required in batch queue');
  }
  if (!targetStatus || !BATCH_OPERATIONS.includes(targetStatus)) {
    throw new Error(`Valid target operation is required. Must be one of: ${BATCH_OPERATIONS.join(', ')}`);
  }
  const isVehicleRequired = targetStatus === 'LOADED_ON_TRUCK';
  if (isVehicleRequired && (!vehicleId || !String(vehicleId).trim())) {
    throw new Error('Vehicle selection is required for LOADED_ON_TRUCK');
  }

  const payload = {
    trackingIds: [...queue],
    targetStatus,
    remarks: 'Mobile rapid batch scan'
  };

  if (isVehicleRequired) {
    payload.vehicleId = String(vehicleId).trim();
  }

  return payload;
}

/**
 * Validates whether single scan can be confirmed.
 */
export function canSubmitSingle(context, vehicleId) {
  if (!context || !context.canScan || !context.nextStatusCode) return false;
  if (context.requiresVehicle && (!vehicleId || !String(vehicleId).trim())) return false;
  return true;
}

/**
 * Validates whether batch scan can be submitted.
 */
export function canSubmitBatch(queue, targetStatus, vehicleId) {
  if (!Array.isArray(queue) || queue.length === 0) return false;
  if (!targetStatus || !BATCH_OPERATIONS.includes(targetStatus)) return false;
  if (targetStatus === 'LOADED_ON_TRUCK' && (!vehicleId || !String(vehicleId).trim())) return false;
  return true;
}

/**
 * Pure selector that decides whether the camera preview should be active.
 */
export function canActivateCamera({
  permissionGranted,
  isScreenFocused,
  cameraError,
  phase,
  mode,
  batchOperation,
  batchVehicleId
}) {
  if (!permissionGranted) return false;
  if (!isScreenFocused) return false;
  if (Boolean(cameraError)) return false;
  if (phase !== SCANNER_PHASES.SCANNING && phase !== SCANNER_PHASES.BATCH_READY) return false;
  if (mode === SCANNER_MODES.BATCH) {
    if (!batchOperation) return false;
    if (batchOperation === 'LOADED_ON_TRUCK' && (!batchVehicleId || !String(batchVehicleId).trim())) {
      return false;
    }
  }
  return true;
}

export const initialScannerState = {
  mode: SCANNER_MODES.SINGLE,
  phase: SCANNER_PHASES.SCANNING,
  manualInput: '',
  failedLookupTrackingId: null,
  cameraError: null,
  // Single mode state
  currentContext: null,
  selectedVehicleId: null,
  singleResult: null,
  // Batch mode state
  batchOperation: null,
  batchVehicleId: null,
  batchQueue: [],
  batchResult: null,
  // Common state
  error: null,
  isSubmitting: false,
  showDiscardModal: false,
  pendingAction: null
};

export function scannerReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE': {
      if (state.mode === action.payload) return state;
      // If switching from batch with queued items, guard with modal
      if (state.mode === SCANNER_MODES.BATCH && state.batchQueue.length > 0) {
        return {
          ...state,
          showDiscardModal: true,
          pendingAction: { type: 'SWITCH_MODE', targetMode: action.payload }
        };
      }
      return {
        ...state,
        mode: action.payload,
        phase: action.payload === SCANNER_MODES.BATCH ? SCANNER_PHASES.BATCH_READY : SCANNER_PHASES.SCANNING,
        error: null,
        manualInput: ''
      };
    }

    case 'SET_PHASE':
      return { ...state, phase: action.payload };

    case 'SET_MANUAL_INPUT':
      return { ...state, manualInput: action.payload };

    case 'LOOKUP_STARTED':
      return {
        ...state,
        phase: SCANNER_PHASES.LOOKUP,
        failedLookupTrackingId: action.payload,
        error: null
      };

    case 'LOOKUP_FAILED':
      return {
        ...state,
        phase: SCANNER_PHASES.SCANNING,
        failedLookupTrackingId: action.payload?.trackingId || state.failedLookupTrackingId,
        manualInput: action.payload?.trackingId || state.manualInput,
        error: action.payload?.message || 'Lookup failed'
      };

    case 'LOOKUP_RETRY':
      return {
        ...state,
        phase: SCANNER_PHASES.LOOKUP,
        error: null
      };

    case 'SET_CONTEXT':
      return {
        ...state,
        currentContext: action.payload,
        selectedVehicleId: action.payload?.assignedVehicleId || null,
        phase: SCANNER_PHASES.SINGLE_REVIEW,
        failedLookupTrackingId: null,
        error: null,
        manualInput: ''
      };

    case 'SET_VEHICLE':
      if (state.mode === SCANNER_MODES.SINGLE) {
        return { ...state, selectedVehicleId: action.payload };
      }
      return { ...state, batchVehicleId: action.payload };

    case 'SET_SINGLE_RESULT':
      return {
        ...state,
        singleResult: action.payload,
        phase: SCANNER_PHASES.RESULT,
        isSubmitting: false,
        error: null
      };

    case 'SET_BATCH_OPERATION': {
      if (state.batchOperation === action.payload) return state;
      if (state.batchQueue.length > 0) {
        return {
          ...state,
          showDiscardModal: true,
          pendingAction: { type: 'CHANGE_OPERATION', targetOperation: action.payload }
        };
      }
      return {
        ...state,
        batchOperation: action.payload,
        batchVehicleId: action.payload === 'LOADED_ON_TRUCK' ? state.batchVehicleId : null,
        error: null
      };
    }

    case 'ADD_TO_BATCH': {
      const addResult = addTrackingIdToBatch(state.batchQueue, action.payload);
      if (!addResult.success) {
        return {
          ...state,
          error: addResult.error
        };
      }
      return {
        ...state,
        batchQueue: addResult.queue,
        error: null,
        manualInput: ''
      };
    }

    case 'REMOVE_FROM_BATCH':
      return {
        ...state,
        batchQueue: removeTrackingIdFromBatch(state.batchQueue, action.payload)
      };

    case 'CLEAR_BATCH':
      return {
        ...state,
        batchQueue: [],
        error: null
      };

    case 'SET_BATCH_RESULT':
      return {
        ...state,
        batchResult: action.payload,
        batchQueue: [],
        phase: SCANNER_PHASES.RESULT,
        isSubmitting: false,
        error: null
      };

    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.payload,
        phase: action.payload
          ? (state.mode === SCANNER_MODES.SINGLE ? SCANNER_PHASES.SUBMITTING : SCANNER_PHASES.BATCH_SUBMITTING)
          : state.phase
      };

    case 'SUBMISSION_FAILED':
      return {
        ...state,
        isSubmitting: false,
        phase: state.mode === SCANNER_MODES.SINGLE ? SCANNER_PHASES.SINGLE_REVIEW : SCANNER_PHASES.BATCH_READY,
        error: action.payload
      };

    case 'REQUEST_LEAVE':
      if (state.mode === SCANNER_MODES.BATCH && state.batchQueue.length > 0) {
        return {
          ...state,
          showDiscardModal: true,
          pendingAction: { type: 'LEAVE_ROUTE' }
        };
      }
      return state;

    case 'CAMERA_MOUNT_FAILED':
      return {
        ...state,
        cameraError: 'Camera preview unavailable. You can enter tracking IDs manually below.'
      };

    case 'CAMERA_RETRY_REQUESTED':
      return {
        ...state,
        cameraError: null
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isSubmitting: false
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'DISCARD_CONFIRMED': {
      const pending = state.pendingAction;
      if (!pending) {
        return { ...state, showDiscardModal: false };
      }
      if (pending.type === 'SWITCH_MODE') {
        return {
          ...state,
          mode: pending.targetMode,
          phase: pending.targetMode === SCANNER_MODES.BATCH ? SCANNER_PHASES.BATCH_READY : SCANNER_PHASES.SCANNING,
          batchQueue: [],
          batchOperation: null,
          batchVehicleId: null,
          showDiscardModal: false,
          pendingAction: null,
          error: null,
          manualInput: ''
        };
      }
      if (pending.type === 'CHANGE_OPERATION') {
        return {
          ...state,
          batchOperation: pending.targetOperation,
          batchVehicleId: pending.targetOperation === 'LOADED_ON_TRUCK' ? state.batchVehicleId : null,
          batchQueue: [],
          showDiscardModal: false,
          pendingAction: null,
          error: null
        };
      }
      if (pending.type === 'LEAVE_ROUTE') {
        return {
          ...state,
          batchQueue: [],
          batchOperation: null,
          batchVehicleId: null,
          showDiscardModal: false,
          pendingAction: null,
          error: null,
          manualInput: ''
        };
      }
      return { ...state, showDiscardModal: false, pendingAction: null };
    }

    case 'DISCARD_CANCELLED':
      return {
        ...state,
        showDiscardModal: false,
        pendingAction: null
      };

    case 'RESET_FOR_NEXT_SCAN':
      return {
        ...state,
        phase: state.mode === SCANNER_MODES.BATCH ? SCANNER_PHASES.BATCH_READY : SCANNER_PHASES.SCANNING,
        currentContext: null,
        failedLookupTrackingId: null,
        singleResult: null,
        batchResult: null,
        error: null,
        isSubmitting: false,
        manualInput: ''
      };

    default:
      return state;
  }
}

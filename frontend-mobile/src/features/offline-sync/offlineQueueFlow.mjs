import { normalizeTrackingId, BATCH_OPERATIONS } from '../scanner/scannerFlow.mjs';

export const OFFLINE_QUEUE_STATUSES = {
  PENDING: 'PENDING', SYNCING: 'SYNCING', RETRYABLE: 'RETRYABLE', STALE: 'STALE',
  CONFLICT: 'CONFLICT', REJECTED: 'REJECTED', BLOCKED: 'BLOCKED',
};

export const MAX_OFFLINE_QUEUE_ITEMS = 1000;
export const RETRY_DELAYS_MS = [5000, 30000, 120000, 600000, 1800000];
const TERMINAL_STATUSES = new Set(['STALE', 'CONFLICT', 'REJECTED', 'BLOCKED']);
const SAFE_REASONS = {
  VEHICLE_MISMATCH: 'The parcel is assigned to a different vehicle.',
  STALE_STATE: 'The parcel has already moved past this step.',
  INVALID_TRANSITION: 'This operation is not valid for the current parcel state.',
  PARCEL_NOT_FOUND: 'The tracking ID was not found.',
  VEHICLE_NOT_FOUND: 'The selected vehicle was not found.',
  VEHICLE_INACTIVE: 'The selected vehicle is inactive.',
  PRIOR_ITEM_FAILED: 'An earlier scan for this parcel needs review.',
  IDEMPOTENCY_KEY_REUSED: 'This scan ID was already used for another request.',
  ROLE_DENIED: 'This account cannot synchronize offline scans.',
  INVALID_LOCAL_SCAN: 'This saved scan is invalid. A new physical scan is required.',
  INVALID_SYNC_RESPONSE: 'The server response could not be verified. The scan will retry.',
  HTTP_400: 'The server rejected this batch.',
  HTTP_413: 'The batch is too large for the server.',
  HTTP_415: 'The server rejected the batch format.',
  HTTP_429: 'The server requested a delay before retrying.',
  TEMPORARY_FAILURE: 'Synchronization will retry when available.',
};

export function summarizeOfflineQueue(rows) {
  const summary = { pending: 0, retryable: 0, terminal: 0 };
  for (const row of rows || []) {
    if (row.queueStatus === 'PENDING' || row.queueStatus === 'SYNCING') summary.pending++;
    else if (row.queueStatus === 'RETRYABLE') summary.retryable++;
    else if (TERMINAL_STATUSES.has(row.queueStatus)) summary.terminal++;
  }
  return summary;
}

export function safeOfflineReason(code) {
  return Object.hasOwn(SAFE_REASONS, code) ? SAFE_REASONS[code] : null;
}

export function canManuallyRetry(row, isOnline, isAuthenticated, now = Date.now()) {
  if (!isOnline || !isAuthenticated || !['PENDING', 'RETRYABLE'].includes(row?.queueStatus)) return false;
  return row.lastOutcomeCode !== 'HTTP_429' || !row.nextAttemptAt || Date.parse(row.nextAttemptAt) <= now;
}
const RESULT_CODES = new Map([
  ['APPLIED', new Set(['TRANSITION_APPLIED'])],
  ['ALREADY_APPLIED', new Set(['STATE_ALREADY_APPLIED'])],
  ['STALE_STATE', new Set(['STALE_STATE'])],
  ['CONFLICT', new Set(['VEHICLE_MISMATCH'])],
  ['REJECTED', new Set(['INVALID_TRANSITION', 'PARCEL_NOT_FOUND', 'VEHICLE_NOT_FOUND', 'VEHICLE_INACTIVE', 'IDEMPOTENCY_KEY_REUSED'])],
  ['BLOCKED_BY_PRIOR_FAILURE', new Set(['PRIOR_ITEM_FAILED'])],
  ['RETRYABLE_ERROR', new Set(['TEMPORARY_FAILURE'])],
]);

export function isOfflineSingleScanBlocked(mode, isOnline, isNativeOfflineSupported) {
  return mode === 'SINGLE' && !isOnline && isNativeOfflineSupported;
}

export function buildOfflineQueueItem({ clientEventId, ownerUserId, trackingId, targetStatus, vehicleId, capturedAt, clientSequence }) {
  const normalized = normalizeTrackingId(trackingId);
  if (!normalized.isValid) throw new Error(normalized.error);
  if (!BATCH_OPERATIONS.includes(targetStatus)) throw new Error('Unsupported offline operation.');
  if (targetStatus === 'LOADED_ON_TRUCK' && !/^VH-\d{3,}$/.test(String(vehicleId || '').trim().toUpperCase())) {
    throw new Error('An active vehicle is required for offline loading.');
  }
  if (targetStatus !== 'LOADED_ON_TRUCK' && vehicleId) throw new Error('Vehicle is only allowed for truck loading.');
  if (!clientEventId || !ownerUserId || !Number.isInteger(clientSequence) || clientSequence <= 0) throw new Error('Offline queue metadata is invalid.');
  return {
    clientEventId, ownerUserId, trackingId: normalized.trackingId, targetStatus,
    vehicleId: targetStatus === 'LOADED_ON_TRUCK' ? String(vehicleId).trim().toUpperCase() : null,
    capturedAt: capturedAt || new Date().toISOString(), clientSequence,
    queueStatus: OFFLINE_QUEUE_STATUSES.PENDING, attemptCount: 0, nextAttemptAt: null,
  };
}

export function canQueueOfflineItem(rows, item) {
  const ownerRows = (Array.isArray(rows) ? rows : []).filter((row) => row.ownerUserId === item.ownerUserId && isUnresolved(row));
  if (ownerRows.length >= MAX_OFFLINE_QUEUE_ITEMS) return { allowed: false, reason: 'Offline queue is full.' };
  const duplicate = ownerRows.some((row) => row.trackingId === item.trackingId && row.targetStatus === item.targetStatus && row.vehicleId === item.vehicleId);
  return duplicate ? { allowed: false, reason: 'This offline scan is already queued.' } : { allowed: true, reason: null };
}

export function isUnresolved(row) {
  return [OFFLINE_QUEUE_STATUSES.PENDING, OFFLINE_QUEUE_STATUSES.SYNCING, OFFLINE_QUEUE_STATUSES.RETRYABLE].includes(row?.queueStatus);
}

export function buildSyncChunk(rows, ownerUserId, limit = 100, now = Date.now(), manual = false) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row.ownerUserId === ownerUserId
    && [OFFLINE_QUEUE_STATUSES.PENDING, OFFLINE_QUEUE_STATUSES.RETRYABLE].includes(row.queueStatus)
    && (!row.nextAttemptAt || Date.parse(row.nextAttemptAt) <= now || (manual && row.lastOutcomeCode !== 'HTTP_429')))
    .sort((left, right) => left.clientSequence - right.clientSequence).slice(0, Math.min(100, limit));
}

export function validateStoredQueueRow(row, ownerUserId, now = Date.now()) {
  if (row?.ownerUserId !== ownerUserId) return false;
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(row.clientEventId || '')) return false;
  if (!/^TRK-\d{4}-\d{6}$/.test(row.trackingId || '')) return false;
  if (!BATCH_OPERATIONS.includes(row.targetStatus)) return false;
  if (row.targetStatus === 'LOADED_ON_TRUCK') {
    if (typeof row.vehicleId !== 'string' || row.vehicleId.length > 20 || !/^VH-\d{3,}$/.test(row.vehicleId)) return false;
  } else if (row.vehicleId != null) return false;
  const capturedAt = typeof row.capturedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(row.capturedAt)
    ? Date.parse(row.capturedAt) : NaN;
  if (!Number.isFinite(capturedAt) || capturedAt < Date.parse('2000-01-01T00:00:00Z') || capturedAt > now + 86_400_000) return false;
  return Number.isSafeInteger(row.clientSequence) && row.clientSequence > 0;
}

export function validateSyncResponse(submittedRows, response) {
  const submitted = new Set((submittedRows || []).map((row) => row.clientEventId));
  const results = response?.results;
  if (!Array.isArray(results) || results.length !== submitted.size) return false;
  const received = new Set();
  for (const result of results) {
    if (!submitted.has(result?.clientEventId) || received.has(result.clientEventId)) return false;
    if (!RESULT_CODES.get(result.outcome)?.has(result.code)) return false;
    if (result.retryable !== (result.outcome === 'RETRYABLE_ERROR')) return false;
    if (result.serverStatus != null && !['REGISTERED', 'QR_GENERATED', 'LOADED_ON_TRUCK', 'ARRIVED_AT_TNL', 'LOADED_TO_HAULER', 'COMPLETED'].includes(result.serverStatus)) return false;
    if (result.serverVehicleId != null && (result.serverVehicleId.length > 20 || !/^VH-\d{3,}$/.test(result.serverVehicleId))) return false;
    received.add(result.clientEventId);
  }
  return received.size === submitted.size;
}

export function resolveRetryDelay(attemptCount, retryAfterSeconds, jitterMultiplier = 1) {
  const calculated = RETRY_DELAYS_MS[Math.min(Math.max(0, attemptCount), RETRY_DELAYS_MS.length - 1)];
  const jitteredDelay = Math.min(RETRY_DELAYS_MS.at(-1), Math.round(calculated * Math.min(1.2, Math.max(0.8, jitterMultiplier))));
  const serverDelay = Number(retryAfterSeconds) > 0 ? Number(retryAfterSeconds) * 1000 : 0;
  return Math.max(jitteredDelay, serverDelay);
}

export function retryTimerDelay(retryAt, now = Date.now()) {
  const deadline = Date.parse(retryAt);
  if (!Number.isFinite(deadline)) return null;
  return Math.min(RETRY_DELAYS_MS.at(-1), Math.max(0, deadline - now));
}

export function mapSyncOutcome(result) {
  if (result?.outcome === 'APPLIED' || result?.outcome === 'ALREADY_APPLIED') return { action: 'DELETE', queueStatus: null };
  if (result?.outcome === 'STALE_STATE') return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.STALE };
  if (result?.outcome === 'CONFLICT') return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.CONFLICT };
  if (result?.outcome === 'BLOCKED_BY_PRIOR_FAILURE') return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.BLOCKED };
  if (result?.retryable) return { action: 'RETRY', queueStatus: OFFLINE_QUEUE_STATUSES.RETRYABLE };
  return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.REJECTED };
}

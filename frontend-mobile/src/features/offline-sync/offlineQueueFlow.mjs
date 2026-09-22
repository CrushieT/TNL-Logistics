import { normalizeTrackingId, BATCH_OPERATIONS } from '../scanner/scannerFlow.mjs';

export const OFFLINE_QUEUE_STATUSES = {
  PENDING: 'PENDING', SYNCING: 'SYNCING', RETRYABLE: 'RETRYABLE', STALE: 'STALE',
  CONFLICT: 'CONFLICT', REJECTED: 'REJECTED', BLOCKED: 'BLOCKED',
};

export const MAX_OFFLINE_QUEUE_ITEMS = 1000;
export const RETRY_DELAYS_MS = [5000, 30000, 120000, 600000, 1800000];

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

export function buildSyncChunk(rows, ownerUserId, limit = 100, now = Date.now()) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row.ownerUserId === ownerUserId
    && [OFFLINE_QUEUE_STATUSES.PENDING, OFFLINE_QUEUE_STATUSES.RETRYABLE].includes(row.queueStatus)
    && (!row.nextAttemptAt || Date.parse(row.nextAttemptAt) <= now))
    .sort((left, right) => left.clientSequence - right.clientSequence).slice(0, Math.min(100, limit));
}

export function validateSyncResponse(submittedRows, response) {
  const submitted = new Set((submittedRows || []).map((row) => row.clientEventId));
  const results = response?.results;
  if (!Array.isArray(results) || results.length !== submitted.size) return false;
  const received = new Set();
  for (const result of results) {
    if (!submitted.has(result?.clientEventId) || received.has(result.clientEventId)) return false;
    received.add(result.clientEventId);
  }
  return received.size === submitted.size;
}

export function resolveRetryDelay(attemptCount, retryAfterSeconds, jitterMultiplier = 1) {
  const calculated = RETRY_DELAYS_MS[Math.min(Math.max(0, attemptCount), RETRY_DELAYS_MS.length - 1)];
  const jitteredDelay = Math.round(calculated * Math.min(1.2, Math.max(0.8, jitterMultiplier)));
  const serverDelay = Number(retryAfterSeconds) > 0 ? Math.min(Number(retryAfterSeconds) * 1000, RETRY_DELAYS_MS.at(-1)) : 0;
  return Math.max(jitteredDelay, serverDelay);
}

export function mapSyncOutcome(result) {
  if (result?.outcome === 'APPLIED' || result?.outcome === 'ALREADY_APPLIED') return { action: 'DELETE', queueStatus: null };
  if (result?.outcome === 'STALE_STATE') return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.STALE };
  if (result?.outcome === 'CONFLICT') return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.CONFLICT };
  if (result?.outcome === 'BLOCKED_BY_PRIOR_FAILURE') return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.BLOCKED };
  if (result?.retryable) return { action: 'RETRY', queueStatus: OFFLINE_QUEUE_STATUSES.RETRYABLE };
  return { action: 'RETAIN', queueStatus: OFFLINE_QUEUE_STATUSES.REJECTED };
}

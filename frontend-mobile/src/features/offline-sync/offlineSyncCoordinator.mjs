import { resolveRetryDelay } from './offlineQueueFlow.mjs';

export function createOfflineSyncCoordinator({ queue, submit, getEnvironment, onStateChange,
  onQueueChanged, onAcknowledged, onPasswordReauthentication, cancelRetry, scheduleNextRetry }) {
  let running = null;

  function canRun(environment, ownerUserId = environment?.ownerUserId) {
    return Boolean(environment?.isReady && environment.isAuthenticated && environment.isOnline
      && environment.isForeground && environment.ownerUserId === ownerUserId);
  }

  function retryAt(chunk, serverRetryAfterSeconds = 0) {
    const attemptCount = Math.max(0, ...chunk.map((row) => Number(row.attemptCount) || 0));
    const delay = resolveRetryDelay(attemptCount, serverRetryAfterSeconds, 0.8 + Math.random() * 0.4);
    return new Date(Date.now() + delay).toISOString();
  }

  async function run(manual) {
    const ownerUserId = getEnvironment().ownerUserId;
    if (!canRun(getEnvironment(), ownerUserId)) return;
    onStateChange('SYNCING');
    let shouldScheduleRetry = true;
    try {
      while (canRun(getEnvironment(), ownerUserId)) {
        const chunk = await queue.prepareOfflineSyncChunk(ownerUserId, Date.now(), manual);
        if (!chunk.length) break;
        if (!canRun(getEnvironment(), ownerUserId)) {
          await queue.returnChunkToPending(ownerUserId, chunk);
          break;
        }
        try {
          const response = await submit(chunk.map(({ clientEventId, trackingId, targetStatus, vehicleId, capturedAt, clientSequence }) =>
            ({ clientEventId, trackingId, targetStatus, vehicleId, capturedAt, clientSequence })));
          if (getEnvironment().ownerUserId !== ownerUserId || !getEnvironment().isAuthenticated) {
            await queue.returnChunkToPending(ownerUserId, chunk);
            break;
          }
          await queue.applyOfflineSyncResponse(ownerUserId, chunk, response, retryAt(chunk));
          if (response.results.some((result) => result.outcome === 'APPLIED' || result.outcome === 'ALREADY_APPLIED')) onAcknowledged();
          if (response.results.some((result) => result.retryable)) break;
        } catch (error) {
          const status = error?.status;
          const isSameOwner = getEnvironment().ownerUserId === ownerUserId;
          if (status === 401) {
            await queue.returnChunkToPending(ownerUserId, chunk);
            cancelRetry();
            shouldScheduleRetry = false;
            if (isSameOwner && error.code !== 'SESSION_REAUTH_REQUIRED') await onPasswordReauthentication();
          } else if (!isSameOwner || !getEnvironment().isAuthenticated) {
            await queue.returnChunkToPending(ownerUserId, chunk);
          } else if (status === 403) {
            await queue.rejectOwnerUnresolved(ownerUserId, 'ROLE_DENIED');
            cancelRetry();
            shouldScheduleRetry = false;
          } else if ([400, 413, 415].includes(status)) {
            await queue.rejectChunk(ownerUserId, chunk, `HTTP_${status}`);
          } else {
            const code = error?.code === 'INVALID_SYNC_RESPONSE' ? 'INVALID_SYNC_RESPONSE'
              : status === 429 ? 'HTTP_429' : 'TEMPORARY_FAILURE';
            await queue.returnChunkToRetryable(ownerUserId, chunk, code, retryAt(chunk, status === 429 ? error.retryAfterSeconds : 0));
          }
          break;
        }
      }
    } finally {
      onStateChange('IDLE');
      await onQueueChanged();
      if (shouldScheduleRetry && canRun(getEnvironment(), ownerUserId)) await scheduleNextRetry(ownerUserId);
    }
  }

  return {
    syncNow(manual = false) {
      if (!running) running = run(manual).finally(() => { running = null; });
      return running;
    },
  };
}

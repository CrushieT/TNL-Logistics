const WEB_UNAVAILABLE_MESSAGE = 'Offline scanning is unavailable on web.';

export async function initializeOfflineQueue() {
  return false;
}

export async function cacheVehicles() {}

export async function getCachedVehicles() {
  return [];
}

export async function queueOfflineScan() {
  throw new Error(WEB_UNAVAILABLE_MESSAGE);
}

export async function getQueueRows() {
  return [];
}

export async function prepareOfflineSyncChunk() {
  return [];
}

export async function applyOfflineSyncResponse() {}

export async function returnChunkToRetryable() {}

export async function acknowledgeOfflineQueueRow() {}

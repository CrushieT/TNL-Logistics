/**
 * Bounded Browser-Memory Response Cache for TNL Logistics admin pages.
 *
 * Requirements:
 * - Exactly 12 resource slots with max 1 entry per slot.
 * - Exact user, session generation, and canonical query parameter matching.
 * - 5-minute TTL (300,000 ms).
 * - 1 MiB (1,048,576 bytes) serialized UTF-8 payload limit per entry.
 * - 4 MiB (4,194,304 bytes) total cache limit with oldest-entry eviction.
 * - In-memory only: zero writes to localStorage, sessionStorage, or IndexedDB.
 * - Free of authentication imports to prevent circular dependencies.
 */

export const CACHE_SLOTS = Object.freeze({
  DASHBOARD: 'dashboard_summary',
  REPORTS: 'reports_summary',
  WEEKLY_COLLECTIONS: 'weekly_collections',
  TRACKING_LOGS_PAGE: 'tracking_logs_page',
  TRACKING_LOGS_METRICS: 'tracking_logs_metrics',
  COLLECTION_CYCLES: 'collection_cycles',
  SHIPMENTS: 'shipments',
  VEHICLES: 'vehicles',
  CLIENTS: 'clients',
  WAYBILLS: 'waybills',
  PAYMENTS: 'payments',
  STATEMENTS: 'statements',
});

const revisions = new Map();
const invalidationListeners = new Set();
export const getCacheRevision = slot => revisions.get(slot) || 0;
export function onCacheInvalidated(listener) {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

const financial = ['PAYMENTS', 'SHIPMENTS', 'STATEMENTS', 'WEEKLY_COLLECTIONS', 'DASHBOARD', 'REPORTS', 'CLIENTS', 'COLLECTION_CYCLES'];
const operational = [...financial, 'WAYBILLS', 'VEHICLES', 'TRACKING_LOGS_PAGE', 'TRACKING_LOGS_METRICS'];
export const INVALIDATION_DEPENDENCIES = Object.freeze({
  clients: [...financial, 'WAYBILLS'],
  vehicles: ['VEHICLES', 'SHIPMENTS', 'WAYBILLS', 'TRACKING_LOGS_PAGE', 'TRACKING_LOGS_METRICS'],
  shipments: operational,
  'parcel-units': operational,
  scans: operational,
  waybills: operational,
  payments: financial,
  soa: financial,
});
export function invalidateResources(resource) {
  const slots = (INVALIDATION_DEPENDENCIES[resource] || []).map(name => CACHE_SLOTS[name]);
  slots.forEach(slot => {
    revisions.set(slot, getCacheRevision(slot) + 1);
    cacheStorage.delete(slot);
  });
  if (slots.length) invalidationListeners.forEach(listener => listener(slots));
}
export function invalidateMutation(config = {}) {
  if (!['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) return;
  const resource = (config.url || '').replace(/^.*\/api\/v1\//, '/').split('/').filter(Boolean)[0]?.split('?')[0];
  invalidateResources(resource);
}
export function invalidateBusinessEvent(type) {
  const resource = {
    PAYMENT_RECORDED: 'payments', SOA_UPDATED: 'soa', SHIPMENT_CREATED: 'shipments',
    STATUS_UPDATE: 'shipments', LABEL_PRINTED: 'shipments', PARCEL_EXCEPTION: 'parcel-units', WAYBILL_UPDATE: 'waybills',
  }[type];
  if (resource) invalidateResources(resource);
}

export const MAX_ENTRY_BYTES = 1024 * 1024; // 1 MiB
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MiB
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const VALID_SLOTS = new Set(Object.values(CACHE_SLOTS));

/**
 * In-memory map holding at most one entry per valid resource slot.
 */
const cacheStorage = new Map();

/**
 * Normalizes query parameters into a structured, sorted array JSON string.
 * Delimiters, special characters, and ordering cannot collide.
 */
export function canonicalizeQueryParams(params) {
  if (!params || typeof params !== 'object') {
    return '[]';
  }
  const entries = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => [key, String(value).trim()]);
  return JSON.stringify(entries);
}

/**
 * Computes serialized UTF-8 payload byte length for a given data object.
 * Returns -1 if the object cannot be serialized to JSON.
 */
export function calculatePayloadBytes(data) {
  try {
    const jsonStr = JSON.stringify(data);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(jsonStr).length;
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.byteLength(jsonStr, 'utf8');
    }
    return encodeURI(jsonStr).split(/%..|./).length - 1;
  } catch (_) {
    return -1;
  }
}

/**
 * Calculates total serialized bytes currently stored across all cache slots.
 */
export function getTotalCacheBytes() {
  let total = 0;
  for (const entry of cacheStorage.values()) {
    total += entry.serializedBytes || 0;
  }
  return total;
}

/**
 * Retrieves a matching, unexpired cache entry for a given slot.
 * Returns null if slot is invalid, expired, or identity/query does not match.
 */
export function getCacheEntry(slot, { userId, sessionGeneration, queryParams, now = Date.now() } = {}) {
  if (!VALID_SLOTS.has(slot)) {
    return null;
  }

  const entry = cacheStorage.get(slot);
  if (!entry) {
    return null;
  }

  // Check TTL expiration
  if (now - entry.timestamp > CACHE_TTL_MS) {
    cacheStorage.delete(slot);
    return null;
  }

  // Exact user and session generation verification
  if (entry.userId !== userId || entry.sessionGeneration !== sessionGeneration) {
    return null;
  }

  // Canonical query parameter comparison
  const canonicalQuery = canonicalizeQueryParams(queryParams);
  if (entry.queryKey !== canonicalQuery) {
    return null;
  }

  return {
    data: entry.data,
    timestamp: entry.timestamp,
    serializedBytes: entry.serializedBytes,
    queryKey: entry.queryKey,
  };
}

/**
 * Stores a successful response in the specified resource slot.
 * Replaces any existing entry in that slot.
 * Respects 1 MiB per-entry limit and 4 MiB total limit with oldest eviction.
 */
export function setCacheEntry(slot, { userId, sessionGeneration, queryParams, data, revision = getCacheRevision(slot), now = Date.now() } = {}) {
  if (revision !== getCacheRevision(slot)) return false;
  if (!VALID_SLOTS.has(slot)) {
    return false;
  }

  if (userId === null || userId === undefined || sessionGeneration === null || sessionGeneration === undefined) {
    return false;
  }

  const serializedBytes = calculatePayloadBytes(data);
  if (serializedBytes < 0 || serializedBytes > MAX_ENTRY_BYTES) {
    // Skip caching oversized or unserializable response without throwing
    return false;
  }

  // Deduct current slot's bytes if it already exists before calculating total
  const existingEntry = cacheStorage.get(slot);
  let totalBytesWithoutCurrent = getTotalCacheBytes() - (existingEntry?.serializedBytes || 0);

  // Evict oldest entries until new entry fits within MAX_TOTAL_BYTES
  while (totalBytesWithoutCurrent + serializedBytes > MAX_TOTAL_BYTES && cacheStorage.size > 0) {
    let oldestSlot = null;
    let oldestTimestamp = Infinity;

    for (const [s, entry] of cacheStorage.entries()) {
      if (s !== slot && entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestSlot = s;
      }
    }

    if (oldestSlot) {
      const evicted = cacheStorage.get(oldestSlot);
      totalBytesWithoutCurrent -= evicted?.serializedBytes || 0;
      cacheStorage.delete(oldestSlot);
    } else {
      break;
    }
  }

  cacheStorage.set(slot, {
    resource: slot,
    userId,
    sessionGeneration,
    queryKey: canonicalizeQueryParams(queryParams),
    timestamp: now,
    data,
    serializedBytes,
  });

  return true;
}

/**
 * Clears all cached response slots and resets memory usage to zero.
 */
export function clearAllCache() {
  cacheStorage.clear();
}

/**
 * Clears a specific resource slot.
 */
export function clearCacheSlot(slot) {
  return cacheStorage.delete(slot);
}

/**
 * Returns diagnostic metadata about current cache state.
 */
export function getCacheStats() {
  return {
    entryCount: cacheStorage.size,
    totalBytes: getTotalCacheBytes(),
    slots: Array.from(cacheStorage.keys()),
  };
}

/**
 * Evaluates whether an in-flight response or error is acceptable to commit
 * to cache and UI state.
 *
 * Requirements:
 * 1. Current session must be authenticated and verified.
 * 2. Current user ID must strictly match the user ID captured at request start.
 * 3. Current session generation must strictly match the generation captured at request start.
 * 4. Currently active query must strictly match the query captured at request start.
 */
export function isResponseAcceptable({
  requestAuth,
  requestQuery,
  currentAuth,
  activeQuery,
} = {}) {
  if (!currentAuth || !currentAuth.isAuthenticated || currentAuth.isVerified !== true || currentAuth.userId === null || currentAuth.userId === undefined) {
    return false;
  }
  if (!requestAuth || requestAuth.userId === null || requestAuth.userId === undefined) {
    return false;
  }
  if (currentAuth.userId !== requestAuth.userId) {
    return false;
  }
  if (currentAuth.sessionGeneration !== requestAuth.sessionGeneration) {
    return false;
  }
  const canonicalRequestQuery = typeof requestQuery === 'string'
    ? requestQuery
    : canonicalizeQueryParams(requestQuery);
  const canonicalActiveQuery = typeof activeQuery === 'string'
    ? activeQuery
    : canonicalizeQueryParams(activeQuery);
  return canonicalRequestQuery === canonicalActiveQuery;
}

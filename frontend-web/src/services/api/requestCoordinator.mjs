import { CACHE_SLOTS, getCacheRevision } from './responseCache.mjs';

/**
 * Shared Request Coordinator for TNL Logistics admin pages.
 *
 * Provides:
 * - Deterministic canonical query key derivation
 * - In-flight overlap prevention (single active request per logical query)
 * - Obsolete request cancellation via AbortController on key change or unmount
 * - Generational response guarding to eliminate stale response overwrites
 * - At most one queued follow-up refresh to coalesce triggers during active requests
 * - 300 ms event burst debouncing
 * - Inactive route and hidden tab suspension with at most one catch-up refresh on resume
 * - Silent treatment of cancellation errors as normal cleanup without toast or retry
 */

export function isCancellationError(err) {
  if (!err) return false;
  return (
    err.name === 'AbortError' ||
    err.name === 'CanceledError' ||
    err.code === 'ERR_CANCELED' ||
    Boolean(err.isCanceled) ||
    Boolean(err.__CANCEL__)
  );
}

export function deriveKey(scope, params = {}) {
  if (!params || typeof params !== 'object') {
    return String(scope);
  }
  const entries = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${String(value).trim()}`);
  return entries.length > 0 ? `${scope}:${entries.join('&')}` : String(scope);
}

export function createRequestCoordinator({
  scope = 'default',
  onSuccess,
  onError,
  debounceMs = 300,
} = {}) {
  const slot = Object.values(CACHE_SLOTS).find(value => value === scope)
    || ({ dashboard: CACHE_SLOTS.DASHBOARD, reports: CACHE_SLOTS.REPORTS, 'tracking-metrics': CACHE_SLOTS.TRACKING_LOGS_METRICS, 'tracking-logs': CACHE_SLOTS.TRACKING_LOGS_PAGE, 'weekly-collections': CACHE_SLOTS.WEEKLY_COLLECTIONS })[scope];
  let currentKey = null;
  let generation = 0;
  let activeController = null;
  let inFlight = false;
  let queuedFollowUp = null;
  let debounceTimer = null;
  let isMounted = true;
  let isVisible = true;
  let hasMissedRefresh = false;
  let lastSuccessfulData = null;
  let resumeRequest = null;

  function cancelInFlight() {
    if (activeController) {
      try {
        activeController.abort();
      } catch (_) {}
      activeController = null;
    }
    inFlight = false;
  }

  function clearDebounce() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  async function executeRequest(key, fetcher, options = {}) {
    if (!isMounted) {
      return { status: 'unmounted' };
    }

    if (key !== currentKey) {
      cancelInFlight();
      clearDebounce();
      queuedFollowUp = null;
      currentKey = key;
      lastSuccessfulData = null;
      generation += 1;
    }

    if (!isVisible) {
      hasMissedRefresh = true;
      return { status: 'suspended' };
    }

    if (inFlight) {
      // Overlap prevention: retain at most ONE follow-up
      queuedFollowUp = { key, fetcher, options };
      return { status: 'queued' };
    }

    inFlight = true;
    generation += 1;
    const reqGen = generation;
    const requestRevision = getCacheRevision(slot);
    const controller = new AbortController();
    activeController = controller;

    try {
      const data = await fetcher(controller.signal);

      if (!isMounted || reqGen !== generation || controller.signal.aborted || requestRevision !== getCacheRevision(slot)) {
        return { status: 'stale' };
      }

      lastSuccessfulData = data;
      if (typeof onSuccess === 'function') {
        onSuccess(data, {
          requestAuth: options.requestAuth,
          requestQuery: options.requestQuery,
          key,
          generation: reqGen,
          isSilent: Boolean(options.isSilent),
          highlightDiff: Boolean(options.highlightDiff),
          requestRevision,
        });
      }
      return { status: 'success', data };
    } catch (err) {
      if (!isMounted || reqGen !== generation || controller.signal.aborted || requestRevision !== getCacheRevision(slot) || isCancellationError(err)) {
        return { status: 'cancelled' };
      }

      if (typeof onError === 'function') {
        onError(err, {
          requestAuth: options.requestAuth,
          requestQuery: options.requestQuery,
          key,
          generation: reqGen,
          isSilent: Boolean(options.isSilent),
          hasExistingData: Boolean(lastSuccessfulData),
        });
      }
      return { status: 'error', error: err };
    } finally {
      if (reqGen === generation) {
        inFlight = false;
        activeController = null;

        if (queuedFollowUp && isMounted) {
          const next = queuedFollowUp;
          queuedFollowUp = null;
          if (isVisible) {
            executeRequest(next.key, next.fetcher, next.options);
          } else {
            hasMissedRefresh = true;
          }
        }
      }
    }
  }

  function request(key, fetcher, options = {}) {
    if (!isMounted) {
      return Promise.resolve({ status: 'unmounted' });
    }

    options = {
      ...options,
      requestAuth: options.requestAuth ? { ...options.requestAuth } : undefined,
      requestQuery: options.requestQuery && typeof options.requestQuery === 'object'
        ? { ...options.requestQuery } : options.requestQuery,
    };
    resumeRequest = { key, fetcher, options };

    if (options.debounce) {
      clearDebounce();
      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          debounceTimer = null;
          const result = await executeRequest(key, fetcher, { ...options, debounce: false });
          resolve(result);
        }, debounceMs);
      });
    }

    clearDebounce();
    return executeRequest(key, fetcher, options);
  }

  function setVisibility(visible) {
    const wasVisible = isVisible;
    isVisible = visible;

    if (!wasVisible && visible && hasMissedRefresh && isMounted && currentKey) {
      hasMissedRefresh = false;
      if (resumeRequest) {
        const next = resumeRequest;
        return request(next.key, next.fetcher, { ...next.options, isSilent: true, debounce: false });
      }
    }
  }

  function cancel() {
    clearDebounce();
    queuedFollowUp = null;
    hasMissedRefresh = false;
    resumeRequest = null;
    lastSuccessfulData = null;
    cancelInFlight();
    generation += 1;
    inFlight = false;
    activeController = null;
  }

  function unmount() {
    isMounted = false;
    cancel();
  }

  function mount() {
    isMounted = true;
  }

  function invalidate() {
    if (!resumeRequest) return;
    const next = resumeRequest;
    cancel();
    return request(next.key, next.fetcher, { ...next.options, debounce: true });
  }

  return {
    deriveKey: (params) => deriveKey(scope, params),
    request,
    cancel,
    setVisibility,
    unmount,
    mount,
    invalidate,
    getInFlight: () => inFlight,
    getGeneration: () => generation,
    getCurrentKey: () => currentKey,
    hasQueuedFollowUp: () => Boolean(queuedFollowUp),
    hasMissedRefresh: () => hasMissedRefresh,
  };
}

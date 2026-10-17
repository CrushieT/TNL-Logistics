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
      generation += 1;
    }

    if (!isVisible) {
      hasMissedRefresh = true;
      if (options.isSilent) {
        return { status: 'suspended' };
      }
    }

    if (inFlight) {
      // Overlap prevention: retain at most ONE follow-up
      queuedFollowUp = { key, fetcher, options };
      return { status: 'queued' };
    }

    inFlight = true;
    generation += 1;
    const reqGen = generation;
    const controller = new AbortController();
    activeController = controller;

    try {
      const data = await fetcher(controller.signal);

      if (!isMounted || reqGen !== generation || controller.signal.aborted) {
        return { status: 'stale' };
      }

      lastSuccessfulData = data;
      if (typeof onSuccess === 'function') {
        onSuccess(data, {
          key,
          generation: reqGen,
          isSilent: Boolean(options.isSilent),
        });
      }
      return { status: 'success', data };
    } catch (err) {
      if (!isMounted || reqGen !== generation || controller.signal.aborted || isCancellationError(err)) {
        return { status: 'cancelled' };
      }

      if (typeof onError === 'function') {
        onError(err, {
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

    return executeRequest(key, fetcher, options);
  }

  function setVisibility(visible, resumeFetcher) {
    const wasVisible = isVisible;
    isVisible = visible;

    if (!wasVisible && visible && hasMissedRefresh && isMounted && currentKey) {
      hasMissedRefresh = false;
      if (typeof resumeFetcher === 'function') {
        request(currentKey, resumeFetcher, { isSilent: true });
      }
    }
  }

  function unmount() {
    isMounted = false;
    clearDebounce();
    queuedFollowUp = null;
    cancelInFlight();
    generation += 1;
  }

  return {
    deriveKey: (params) => deriveKey(scope, params),
    request,
    setVisibility,
    unmount,
    getInFlight: () => inFlight,
    getGeneration: () => generation,
    getCurrentKey: () => currentKey,
    hasQueuedFollowUp: () => Boolean(queuedFollowUp),
    hasMissedRefresh: () => hasMissedRefresh,
  };
}

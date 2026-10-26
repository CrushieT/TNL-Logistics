import { useRef, useEffect } from 'react';
import { createRequestCoordinator } from './requestCoordinator.mjs';
import { CACHE_SLOTS, onCacheInvalidated } from './responseCache.mjs';

/**
 * React hook integrating RequestCoordinator with component lifecycle,
 * document visibility, and window focus events.
 */
export function useRequestCoordinator({
  scope,
  onSuccess,
  onError,
  debounceMs = 300,
  onInvalidated,
}) {
  const invalidatedRef = useRef(onInvalidated);
  invalidatedRef.current = onInvalidated;
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);

  useEffect(() => {
    successRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  const coordinatorRef = useRef(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createRequestCoordinator({
      scope,
      onSuccess: (...args) => successRef.current?.(...args),
      onError: (...args) => errorRef.current?.(...args),
      debounceMs,
    });
  }

  useEffect(() => {
    coordinatorRef.current.mount();
    return () => coordinatorRef.current.unmount();
  }, []);

  useEffect(() => onCacheInvalidated(slots => {
    const slot = Object.values(CACHE_SLOTS).find(value => value === scope)
      || ({ dashboard: CACHE_SLOTS.DASHBOARD, reports: CACHE_SLOTS.REPORTS, 'tracking-metrics': CACHE_SLOTS.TRACKING_LOGS_METRICS, 'tracking-logs': CACHE_SLOTS.TRACKING_LOGS_PAGE, 'weekly-collections': CACHE_SLOTS.WEEKLY_COLLECTIONS })[scope];
    if (slots.includes(slot)) {
      invalidatedRef.current?.();
      coordinatorRef.current.invalidate();
    }
  }), [scope]);

  // Window focus and document visibility handling
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibility = () => {
      const isVisible = document.visibilityState !== 'hidden';
      coordinatorRef.current?.setVisibility(isVisible);
    };

    const handleFocus = () => {
      coordinatorRef.current?.setVisibility(document.visibilityState !== 'hidden');
    };

    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return {
    coordinator: coordinatorRef.current,
  };
}

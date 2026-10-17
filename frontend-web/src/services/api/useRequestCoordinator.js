import { useRef, useEffect, useCallback } from 'react';
import { createRequestCoordinator } from './requestCoordinator.mjs';

/**
 * React hook integrating RequestCoordinator with component lifecycle,
 * document visibility, and window focus events.
 */
export function useRequestCoordinator({
  scope,
  onSuccess,
  onError,
  debounceMs = 300,
}) {
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  const resumeFetcherRef = useRef(null);

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

  // Register resume fetcher for catch-up on visibility resume
  const setResumeFetcher = useCallback((fetcher) => {
    resumeFetcherRef.current = fetcher;
  }, []);

  // Window focus and document visibility handling
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibility = () => {
      const isVisible = document.visibilityState !== 'hidden';
      coordinatorRef.current?.setVisibility(isVisible, resumeFetcherRef.current);
    };

    const handleFocus = () => {
      coordinatorRef.current?.setVisibility(true, resumeFetcherRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      coordinatorRef.current?.unmount();
    };
  }, []);

  return {
    coordinator: coordinatorRef.current,
    setResumeFetcher,
  };
}

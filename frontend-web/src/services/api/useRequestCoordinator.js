import { useRef, useEffect } from 'react';
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

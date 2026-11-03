import { useState, useCallback } from 'react';
import { getPageState, savePageState } from './navigationState.mjs';

/**
 * React hook that persists and restores page filter and pagination state
 * across component mount/unmount lifecycles using navigationState.
 *
 * @param {string} pageKey Unique key identifying the directory/page.
 * @param {object} defaultState Default filter and pagination parameters.
 * @returns {[object, function]} Tuple of [state, updateState].
 */
export function useSavedPageState(pageKey, defaultState) {
  const [state, setState] = useState(() => {
    const saved = getPageState(pageKey);
    return saved && typeof saved === 'object' ? { ...defaultState, ...saved } : defaultState;
  });

  const updateState = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        savePageState(pageKey, next);
        return next;
      });
    },
    [pageKey]
  );

  return [state, updateState];
}

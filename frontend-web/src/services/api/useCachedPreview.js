import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionAuthContext } from './client';
import { useVerifiedAdminSession } from './useVerifiedAdminSession';
import { useRequestCoordinator } from './useRequestCoordinator';
import { subscribeRealtimeEvents } from './sseClient';
import { canonicalizeQueryParams, getCacheEntry, setCacheEntry, getCacheRevision, isResponseAcceptable } from './responseCache.mjs';

export function requirePage(data) {
  if (!Array.isArray(data) && !Array.isArray(data?.content)) throw new Error('Invalid directory response.');
  return data;
}

export function requireDirectory(data) {
  requirePage(data);
  return Array.isArray(data) ? data : data.content;
}

// Owns presentation and acceptance; all scheduling stays in the shared coordinator.
export function useCachedPreview({ slot, query = {}, fetcher, enabled = true, pollMs = 0, cache = true, debounceEntry = true }) {
  const sessionKey = useVerifiedAdminSession();
  const queryKey = canonicalizeQueryParams(query);
  const identity = JSON.stringify([sessionKey, queryKey, enabled]);
  const activeRef = useRef(null);
  activeRef.current = { identity, queryKey, query, fetcher, enabled, sessionKey };
  const [state, setState] = useState({ identity: null, data: null, phase: 'loading', timestamp: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const { coordinator } = useRequestCoordinator({
    scope: slot,
    onInvalidated: () => setState(previous => ({ ...previous, phase: previous.data !== null ? 'stale' : 'loading' })),
    onSuccess: (data, metadata) => {
      if (!activeRef.current.enabled || !activeRef.current.sessionKey) return;
      if (!isResponseAcceptable({ requestAuth: metadata.requestAuth, currentAuth: getSessionAuthContext(), requestQuery: metadata.requestQuery, activeQuery: activeRef.current.queryKey })) return;
      if (cache) setCacheEntry(slot, { ...metadata.requestAuth, queryParams: activeRef.current.query, data, revision: metadata.requestRevision });
      setState({ identity: activeRef.current.identity, data, phase: 'fresh', timestamp: Date.now(), revision: getCacheRevision(slot) });
    },
    onError: (error, metadata) => {
      if (!activeRef.current.enabled || !activeRef.current.sessionKey) return;
      if (!isResponseAcceptable({ requestAuth: metadata.requestAuth, currentAuth: getSessionAuthContext(), requestQuery: metadata.requestQuery, activeQuery: activeRef.current.queryKey })) return;
      setState(previous => ({ ...previous, phase: previous.data !== null ? 'stale' : 'error', error: error?.message || 'Request failed.' }));
    },
  });
  const refresh = useCallback((debounce = true) => {
    const active = activeRef.current;
    const requestAuth = getSessionAuthContext();
    if (!active.sessionKey || !active.enabled || !requestAuth.isVerified || !requestAuth.isAuthenticated
      || active.sessionKey !== JSON.stringify([requestAuth.userId, requestAuth.sessionGeneration])) return;
    setState(previous => ({ ...previous, phase: previous.data !== null ? 'refreshing' : 'loading', error: null }));
    return coordinator.request(JSON.stringify([active.sessionKey, active.queryKey]), signal => {
      if (!activeRef.current.enabled || !isResponseAcceptable({ requestAuth, currentAuth: getSessionAuthContext(), requestQuery: active.queryKey, activeQuery: activeRef.current.queryKey })) {
        const cancellation = new Error('Request session or query changed.');
        cancellation.name = 'AbortError';
        throw cancellation;
      }
      return active.fetcher(signal);
    }, {
      requestAuth, requestQuery: active.queryKey, debounce, isSilent: true,
    });
  }, [coordinator]);
  useEffect(() => {
    coordinator.cancel();
    const auth = getSessionAuthContext();
    const isVerifiedSession = auth.isAuthenticated && auth.isVerified && sessionKey === JSON.stringify([auth.userId, auth.sessionGeneration]);
    const entry = isVerifiedSession && enabled && cache ? getCacheEntry(slot, { ...auth, queryParams: query }) : null;
    setState({ identity, data: entry?.data ?? null, timestamp: entry?.timestamp ?? null, phase: entry ? 'preview' : 'loading' });
    if (sessionKey && enabled) refresh(debounceEntry);
    return () => coordinator.cancel();
  }, [identity, coordinator, slot, refresh, debounceEntry]);
  useEffect(() => {
    if (!sessionKey || !enabled) return;
    const unsubscribe = subscribeRealtimeEvents(() => {});
    const focus = () => { if (!coordinator.getInFlight()) refresh(); };
    if (typeof window !== 'undefined') window.addEventListener('focus', focus);
    const interval = pollMs ? setInterval(() => refresh(), pollMs) : null;
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('focus', focus);
      if (interval) clearInterval(interval);
    };
  }, [sessionKey, enabled, pollMs, refresh]);
  const currentAuth = getSessionAuthContext();
  const matching = state.identity === identity && sessionKey && enabled && currentAuth.isVerified
    && currentAuth.isAuthenticated && sessionKey === JSON.stringify([currentAuth.userId, currentAuth.sessionGeneration]);
  const data = matching ? state.data : null;
  const isFresh = Boolean(matching && state.phase === 'fresh' && state.revision === getCacheRevision(slot));
  const isCurrent = () => {
    const current = stateRef.current;
    const auth = getSessionAuthContext();
    return Boolean(auth.isVerified && auth.isAuthenticated && activeRef.current.sessionKey === JSON.stringify([auth.userId, auth.sessionGeneration])
      && current.identity === activeRef.current.identity && current.phase === 'fresh' && current.revision === getCacheRevision(slot));
  };
  return { ...state, data, phase: matching ? state.phase : 'loading', isFresh, isCurrent, loading: data === null && (!matching || state.phase === 'loading'), refresh, cancel: coordinator.cancel };
}

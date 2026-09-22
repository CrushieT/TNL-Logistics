import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform } from 'react-native';
import { useAuth } from '../../auth/context/AuthContext';
import { applyOfflineSyncResponse, getQueueRows, initializeOfflineQueue, prepareOfflineSyncChunk, queueOfflineScan, returnChunkToRetryable } from '../services/offlineQueueStore';
import { resolveRetryDelay } from '../offlineQueueFlow.mjs';
import { submitOfflineSync } from '../services/offlineSyncApi';

const OfflineSyncContext = createContext(null);

function retryAfterSeconds(error) {
  const value = error?.response?.headers?.['retry-after'] ?? error?.response?.headers?.['Retry-After'];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function OfflineSyncProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [rows, setRows] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);
  const retryTimerRef = useRef(null);
  const syncNowRef = useRef(null);
  const refresh = useCallback(async () => setRows(user?.userId ? await getQueueRows(user.userId) : []), [user?.userId]);

  const scheduleRetryAt = useCallback((retryAt) => {
    if (Platform.OS === 'web' || AppState.currentState !== 'active' || !retryAt) return;
    const delay = Math.max(0, Date.parse(retryAt) - Date.now());
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      void syncNowRef.current?.();
    }, delay);
  }, []);

  const scheduleNextRetry = useCallback(async () => {
    if (!user?.userId) return;
    const nextAttempt = (await getQueueRows(user.userId))
      .filter((row) => row.queueStatus === 'RETRYABLE' && row.nextAttemptAt && Date.parse(row.nextAttemptAt) > Date.now())
      .map((row) => Date.parse(row.nextAttemptAt))
      .sort((left, right) => left - right)[0];
    if (nextAttempt) scheduleRetryAt(new Date(nextAttempt).toISOString());
  }, [scheduleRetryAt, user?.userId]);

  const nextRetryAt = useCallback((chunk, serverRetryAfterSeconds = 0) => {
    const attemptCount = Math.max(0, ...chunk.map((row) => Number(row.attemptCount) || 0));
    const jitterMultiplier = 0.8 + Math.random() * 0.4;
    const delay = resolveRetryDelay(attemptCount, serverRetryAfterSeconds, jitterMultiplier);
    return new Date(Date.now() + delay).toISOString();
  }, []);

  const syncNow = useCallback(async () => {
    if (!isAuthenticated || !user?.userId || Platform.OS === 'web' || syncingRef.current) return;
    syncingRef.current = true;
    try {
      while (true) {
        const chunk = await prepareOfflineSyncChunk(user.userId);
        if (!chunk.length) break;
        try {
          const response = await submitOfflineSync(chunk.map(({ clientEventId, trackingId, targetStatus, vehicleId, capturedAt, clientSequence }) => ({ clientEventId, trackingId, targetStatus, vehicleId, capturedAt, clientSequence })));
          const hasRetryableResult = response.results?.some((result) => result.retryable);
          const retryAt = hasRetryableResult ? nextRetryAt(chunk) : null;
          await applyOfflineSyncResponse(user.userId, chunk, response, retryAt);
          if (hasRetryableResult) break;
        } catch (error) {
          const retryAt = nextRetryAt(chunk, retryAfterSeconds(error));
          const status = error?.response?.status;
          await returnChunkToRetryable(user.userId, chunk, status ? `HTTP_${status}` : 'TEMPORARY_FAILURE', retryAt);
          break;
        }
      }
    } finally {
      syncingRef.current = false;
      await refresh();
      await scheduleNextRetry();
    }
  }, [isAuthenticated, nextRetryAt, refresh, scheduleNextRetry, user?.userId]);

  syncNowRef.current = syncNow;

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;
    initializeOfflineQueue().then(async () => {
      await refresh();
      await scheduleNextRetry();
    });
  }, [isAuthenticated, refresh, scheduleNextRetry]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online) void syncNow();
    });
    return unsubscribe;
  }, [syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isOnline) void syncNow();
    });
    return () => subscription.remove();
  }, [isOnline, syncNow]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isAuthenticated && retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [isAuthenticated]);

  const enqueue = useCallback(async (scan) => {
    const item = await queueOfflineScan({ ...scan, ownerUserId: user?.userId });
    await refresh();
    return item;
  }, [refresh, user?.userId]);

  return <OfflineSyncContext.Provider value={{ isNativeOfflineSupported: Platform.OS !== 'web', isOnline, rows, syncNow, enqueue, refresh }}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const value = useContext(OfflineSyncContext);
  if (!value) throw new Error('useOfflineSync must be used inside OfflineSyncProvider');
  return value;
}

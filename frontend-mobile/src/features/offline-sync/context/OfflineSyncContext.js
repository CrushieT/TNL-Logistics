import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform } from 'react-native';
import { useAuth } from '../../auth/context/AuthContext';
import * as offlineQueueStore from '../services/offlineQueueStore';
import { createOfflineSyncCoordinator } from '../offlineSyncCoordinator.mjs';
import { retryTimerDelay } from '../offlineQueueFlow.mjs';
import { submitOfflineSync } from '../services/offlineSyncApi';

const OfflineSyncContext = createContext(null);

export function OfflineSyncProvider({ children }) {
  const { user, isAuthenticated, startPasswordReauthentication } = useAuth();
  const [rows, setRows] = useState([]);
  const [isOnline, setIsOnline] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [syncState, setSyncState] = useState('IDLE');
  const [otherOwnerCount, setOtherOwnerCount] = useState(0);
  const [syncRevision, setSyncRevision] = useState(0);
  const retryTimerRef = useRef(null);
  const environmentRef = useRef({});
  const callbacksRef = useRef({});
  const coordinatorRef = useRef(null);
  const hasNetworkEventRef = useRef(false);
  environmentRef.current = { ...environmentRef.current, ownerUserId: user?.userId, isAuthenticated,
    isOnline, isReady, isForeground: AppState.currentState === 'active' };

  const refresh = useCallback(async () => {
    if (!user?.userId || Platform.OS === 'web') {
      setRows([]);
      setOtherOwnerCount(0);
      return;
    }
    const [ownerRows, quarantinedCount] = await Promise.all([
      offlineQueueStore.getQueueRows(user.userId), offlineQueueStore.getOtherOwnerQueueCount(user.userId),
    ]);
    if (environmentRef.current.ownerUserId === user.userId) {
      setRows(ownerRows);
      setOtherOwnerCount(quarantinedCount);
    }
  }, [user?.userId]);

  const scheduleRetryAt = useCallback((retryAt) => {
    if (Platform.OS === 'web' || AppState.currentState !== 'active' || !retryAt) return;
    const delay = retryTimerDelay(retryAt);
    if (delay == null) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (Date.parse(retryAt) > Date.now()) scheduleRetryAt(retryAt);
      else void coordinatorRef.current?.syncNow();
    }, delay);
  }, []);

  const scheduleNextRetry = useCallback(async (ownerUserId) => {
    if (!ownerUserId) return;
    const nextAttempt = (await offlineQueueStore.getQueueRows(ownerUserId))
      .filter((row) => row.queueStatus === 'RETRYABLE' && row.nextAttemptAt && Date.parse(row.nextAttemptAt) > Date.now())
      .map((row) => Date.parse(row.nextAttemptAt))
      .sort((left, right) => left - right)[0];
    if (nextAttempt) scheduleRetryAt(new Date(nextAttempt).toISOString());
  }, [scheduleRetryAt]);

  callbacksRef.current = { refresh, scheduleNextRetry, startPasswordReauthentication };
  if (!coordinatorRef.current) {
    coordinatorRef.current = createOfflineSyncCoordinator({
      queue: offlineQueueStore,
      submit: submitOfflineSync,
      getEnvironment: () => environmentRef.current,
      onStateChange: setSyncState,
      onQueueChanged: () => callbacksRef.current.refresh(),
      onAcknowledged: () => setSyncRevision((revision) => revision + 1),
      onPasswordReauthentication: () => callbacksRef.current.startPasswordReauthentication(),
      cancelRetry: () => {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      },
      scheduleNextRetry: (ownerUserId) => callbacksRef.current.scheduleNextRetry(ownerUserId),
    });
  }
  const syncNow = useCallback((manual = false) => coordinatorRef.current.syncNow(manual), []);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') {
      environmentRef.current.isReady = false;
      setIsReady(false);
      return;
    }
    let active = true;
    hasNetworkEventRef.current = false;
    environmentRef.current.isReady = false;
    setIsReady(false);
    void (async () => {
      await offlineQueueStore.initializeOfflineQueue();
      const network = await NetInfo.fetch();
      if (!active) return;
      const online = hasNetworkEventRef.current
        ? environmentRef.current.isOnline
        : Boolean(network.isConnected && network.isInternetReachable !== false);
      environmentRef.current = { ...environmentRef.current, isReady: true, isOnline: online };
      setIsOnline(online);
      setIsReady(true);
      await refresh();
      if (online) void syncNow();
      else await scheduleNextRetry(user.userId);
    })().catch(() => { if (active) setSyncState('PAUSED'); });
    return () => { active = false; environmentRef.current.isReady = false; };
  }, [isAuthenticated, refresh, scheduleNextRetry, syncNow, user?.userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      hasNetworkEventRef.current = true;
      environmentRef.current.isOnline = online;
      setIsOnline(online);
      if (online && environmentRef.current.isReady) void syncNow();
    });
    return unsubscribe;
  }, [syncNow]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      environmentRef.current.isForeground = state === 'active';
      if (state === 'active' && environmentRef.current.isOnline) void syncNow();
    });
    return () => subscription.remove();
  }, [syncNow]);

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
    const item = await offlineQueueStore.queueOfflineScan({ ...scan, ownerUserId: user?.userId });
    await refresh();
    return item;
  }, [refresh, user?.userId]);

  const visibleRows = rows.filter((row) => row.ownerUserId === user?.userId);
  return <OfflineSyncContext.Provider value={{ isNativeOfflineSupported: Platform.OS !== 'web', isOnline, isReady,
    syncState, syncRevision, otherOwnerCount, rows: visibleRows, syncNow, enqueue, refresh }}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const value = useContext(OfflineSyncContext);
  if (!value) throw new Error('useOfflineSync must be used inside OfflineSyncProvider');
  return value;
}

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import MetricCard from '../components/common/MetricCard';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import DonutChart from '../components/common/DonutChart';
import BarChart from '../components/common/BarChart';
import ComparisonBars from '../components/common/ComparisonBars';
import ActivityRow from '../components/common/ActivityRow';
import CycleDropdown from '../features/collections/components/CycleDropdown';
import {
  MetricCardSkeleton,
  ChartSkeleton,
  ActivityRowSkeleton,
} from '../components/common/Skeleton';
import {
  CACHE_SLOTS,
  getCacheEntry,
  setCacheEntry,
  isResponseAcceptable,
} from '../services/api/responseCache.mjs';
import { isCancellationError } from '../services/api/requestCoordinator.mjs';
import {
  getSessionAuthContext,
  onSessionInvalidated,
} from '../services/api/client';
import { getActiveCollectionCycles } from '../features/collections/services/collectionsApi';
import { getRecentThursdays } from '../features/collections/utils/collectionsUtils';
import { getDashboardSummary, subscribeRealtimeEvents } from '../features/shipments';
import { useRequestCoordinator } from '../services/api/useRequestCoordinator';
import { useVerifiedAdminSession, getVerifiedAdminSessionKey } from '../services/api/useVerifiedAdminSession';
import { colors, fonts, spacing, radius } from '../theme';

export default function DashboardScreen() {
  const sessionKey = useVerifiedAdminSession();
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [cyclesSessionKey, setCyclesSessionKey] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState('');

  const activeCycleRef = useRef(selectedCycle);
  activeCycleRef.current = selectedCycle;

  const summaryRef = useRef(summary);
  summaryRef.current = summary;

  const { coordinator } = useRequestCoordinator({
    scope: 'dashboard',
    onSuccess: (data, meta) => {
      const currentAuth = getSessionAuthContext();
      const targetCycle = activeCycleRef.current;

      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: { cycle: targetCycle },
      })) {
        return;
      }

      setCacheEntry(CACHE_SLOTS.DASHBOARD, {
        userId: currentAuth.userId,
        sessionGeneration: currentAuth.sessionGeneration,
        queryParams: { cycle: targetCycle },
        data,
      });

      setSummary(data);
      setIsPreview(false);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorMessage(null);
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    },
    onError: (err, meta) => {
      if (isCancellationError(err)) return;
      const currentAuth = getSessionAuthContext();
      const targetCycle = activeCycleRef.current;

      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: { cycle: targetCycle },
      })) {
        return;
      }

      const msg = err?.response?.data?.message || err?.message || 'Dashboard metrics are temporarily unavailable';
      setErrorMessage(msg);
      setIsPreview(false);
      if (summaryRef.current) {
        setIsStale(true);
      } else {
        setInitialLoadFailed(true);
        setSummary(null);
      }
      setLoading(false);
    },
    debounceMs: 300,
  });

  // Session reset listener
  useEffect(() => {
    const resetSession = () => {
      coordinator.cancel();
      setSummary(null);
      setCycles([]);
      setCyclesSessionKey(null);
      setSelectedCycle('');
      setIsStale(false);
      setIsPreview(false);
      setInitialLoadFailed(false);
      setLastUpdated(null);
      setErrorMessage(null);
      setLoading(true);
    };
    resetSession();
    const unsubscribe = onSessionInvalidated(resetSession);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [coordinator, sessionKey]);

  // Fetch active cycles containing registered shipments (with preview cache)
  useEffect(() => {
    if (!sessionKey || sessionKey !== getVerifiedAdminSessionKey()) return;
    let mounted = true;
    const abortController = new AbortController();

    // Check cached collection cycles
    const auth = getSessionAuthContext();
    const cachedCycles = getCacheEntry(CACHE_SLOTS.COLLECTION_CYCLES, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: {},
    });
    if (cachedCycles?.data && cachedCycles.data.length > 0) {
      setCycles(cachedCycles.data);
      setCyclesSessionKey(sessionKey);
      setSelectedCycle((prev) => (prev && cachedCycles.data.some((c) => c.isoDate === prev) ? prev : cachedCycles.data[0].isoDate));
    }

    async function loadCycles() {
      const requestAuth = getSessionAuthContext();
      try {
        const activeCycles = await getActiveCollectionCycles({ signal: abortController.signal });
        if (!mounted || abortController.signal.aborted) return;
        const currentAuth = getSessionAuthContext();
        if (
          currentAuth.isAuthenticated && currentAuth.isVerified &&
          currentAuth.userId === requestAuth.userId &&
          currentAuth.sessionGeneration === requestAuth.sessionGeneration
        ) {
          if (activeCycles.length > 0) {
            setCacheEntry(CACHE_SLOTS.COLLECTION_CYCLES, {
              userId: currentAuth.userId,
              sessionGeneration: currentAuth.sessionGeneration,
              queryParams: {},
              data: activeCycles,
            });
            setCycles(activeCycles);
            setCyclesSessionKey(sessionKey);
            setSelectedCycle((prev) => (prev && activeCycles.some((c) => c.isoDate === prev) ? prev : activeCycles[0].isoDate));
          } else {
            const fallback = getRecentThursdays(1);
            setCycles(fallback);
            setCyclesSessionKey(sessionKey);
            setSelectedCycle(fallback[0]?.isoDate || '');
          }
        }
      } catch (err) {
        if (!mounted || abortController.signal.aborted || isCancellationError(err)) return;
        const currentAuth = getSessionAuthContext();
        if (
          currentAuth.isAuthenticated && currentAuth.isVerified &&
          currentAuth.userId === requestAuth.userId &&
          currentAuth.sessionGeneration === requestAuth.sessionGeneration
        ) {
          const fallback = getRecentThursdays(1);
          setCycles(fallback);
          setCyclesSessionKey(sessionKey);
          setSelectedCycle(fallback[0]?.isoDate || '');
        }
      }
    }
    loadCycles();

    const unsubscribe = onSessionInvalidated(() => {
      abortController.abort();
    });

    return () => {
      mounted = false;
      abortController.abort();
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [sessionKey]);

  const load = useCallback((cycleDate, showSpinner = true, debounce = false) => {
    if (!sessionKey || sessionKey !== getVerifiedAdminSessionKey() || cyclesSessionKey !== sessionKey || !cycleDate) return;
    if (showSpinner) {
      setLoading(true);
      setErrorMessage(null);
    }
    const key = coordinator.deriveKey({ cycle: cycleDate });
    const fetcher = (signal) => getDashboardSummary(cycleDate, { signal });
    const requestAuth = getSessionAuthContext();
    const requestQuery = { cycle: cycleDate };
    return coordinator.request(key, fetcher, {
      isSilent: !showSpinner,
      debounce,
      requestAuth,
      requestQuery,
    });
  }, [coordinator, sessionKey, cyclesSessionKey]);

  // Query key change with instant cached preview
  useEffect(() => {
    if (!sessionKey || sessionKey !== getVerifiedAdminSessionKey() || cyclesSessionKey !== sessionKey || !selectedCycle) return;

    const auth = getSessionAuthContext();
    const cached = getCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { cycle: selectedCycle },
    });

    if (cached?.data) {
      setSummary(cached.data);
      setIsPreview(true);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorMessage(null);
      setLastUpdated(new Date(cached.timestamp).toLocaleTimeString());
      setLoading(true);
      load(selectedCycle, false, false);
    } else {
      // Clear previous cycle's data immediately to prevent showing wrong cycle under new filter
      setSummary(null);
      setIsPreview(false);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorMessage(null);
      setLoading(true);
      load(selectedCycle, true, false);
    }
  }, [selectedCycle, load]);

  // Real-time SSE updates
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (['PARCEL_EXCEPTION', 'WAYBILL_UPDATE', 'STATUS_UPDATE', 'SHIPMENT_CREATED', 'PAYMENT_RECORDED', 'SOA_GENERATED'].includes(event.type)) {
        if (selectedCycle) {
          load(selectedCycle, false, true);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [selectedCycle, load]);

  const shipmentCount = summary?.shipmentCount ?? 0;
  const parcelCount = summary?.parcelCount ?? 0;
  const todayShipments = summary?.todayShipmentCount ?? summary?.registeredToday ?? 0;
  const todayDate = summary?.todayDateFormatted || summary?.registeredTodayDate || '-';
  const unpaidCount = summary?.unpaidTransactionCount ?? summary?.unpaidTransactions ?? 0;

  const forCollectionAmount = summary?.forCollection?.amount ?? 0;
  const forCollectionClients = summary?.forCollection?.clientCount ?? 0;
  const forCollectionDay = summary?.forCollection?.day || 'THU';

  const statusSegments = summary?.parcelUnitsByStatus || [];
  const weeklyVolume = summary?.weeklyShipmentVolume || summary?.weeklyRegistrations || [];
  const financialRows = summary?.outstandingVsCollected || [];
  const recentActivities = summary?.recentActivity || [];

  // Actions requiring fresh summary are disabled when loading, previewing, or stale
  const actionsDisabled = loading || isPreview || isStale || !summary;

  return (
    <AppShell>
      <PageHeader
        eyebrow="OPERATIONS"
        title="Dashboard"
        style={styles.pageHeader}
        right={
          <View style={styles.headerRightGroup}>
            {cycles.length > 0 ? (
              <CycleDropdown
                cycles={cycles}
                selectedCycle={selectedCycle}
                onSelectCycle={setSelectedCycle}
                minWidth={280}
              />
            ) : null}
            <Button
              label="Register Shipment"
              variant="primary"
              onPress={() => router.push('/register')}
            />
          </View>
        }
      />

      {/* Updating Preview Banner */}
      {loading && isPreview && (
        <View style={styles.updatingBanner}>
          <Text style={styles.updatingBannerText}>
            Updating; last updated {lastUpdated || 'recently'}
          </Text>
        </View>
      )}

      {/* Stale Warning Banner */}
      {isStale && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleBannerText}>
            Dashboard metrics are temporarily unavailable and may be stale (last updated: {lastUpdated || 'earlier'}).
          </Text>
          <Pressable onPress={() => load(selectedCycle, true, false)} style={styles.retryLink}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Main Content Area */}
      {loading && !summary ? (
        // State 1: Initial Loading with Section Skeletons
        <View aria-busy="true" accessibilityLabel="Loading dashboard metrics...">
          <View style={styles.metricsRow}>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton emphasis />
          </View>

          <View style={styles.chartsRow}>
            <Card title="Parcel Units by Status" style={styles.chartCard}>
              <ChartSkeleton height={180} />
            </Card>
            <Card title="Weekly Shipment Volume" style={styles.chartCard}>
              <ChartSkeleton height={180} />
            </Card>
            <Card title="Outstanding vs Collected" style={styles.chartCard}>
              <ChartSkeleton height={180} />
              <Button
                label="Prepare weekly collection"
                variant="secondary"
                disabled
                style={styles.collectionBtnDisabled}
              />
            </Card>
          </View>

          <Card title="Recent Activity">
            <ActivityRowSkeleton count={4} />
          </Card>
        </View>
      ) : initialLoadFailed && !summary ? (
        // State 5: Initial Load Error
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Dashboard Data Unavailable</Text>
          <Text style={styles.errorMessage}>
            {errorMessage || 'Unable to load live dashboard metrics from the server. Please check database or network connectivity.'}
          </Text>
          <Pressable onPress={() => load(selectedCycle, true, false)} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        // State 2, 3, or 4: Render Data Layout
        <>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Shipments"
              value={shipmentCount}
              sublabel={`${parcelCount} parcel units`}
              onPress={() => router.push('/shipments')}
            />
            <MetricCard
              label="Today's Shipments"
              value={todayShipments}
              sublabel={todayDate}
            />
            <MetricCard
              label="Unpaid Transactions"
              value={unpaidCount}
              sublabel="shipments with balance"
              onPress={() => router.push('/payments')}
            />
            <MetricCard
              label={`For Collection: ${forCollectionDay}`}
              value={`₱${Number(forCollectionAmount).toLocaleString()}`}
              sublabel={`${forCollectionClients} clients`}
              emphasis
              onPress={() => router.push(selectedCycle ? `/weekly-collections?cycle=${encodeURIComponent(selectedCycle)}` : '/weekly-collections')}
            />
          </View>

          <View style={styles.chartsRow}>
            <Card title="Parcel Units by Status" style={styles.chartCard}>
              <DonutChart segments={statusSegments} />
            </Card>
            <Card title="Weekly Shipment Volume" style={styles.chartCard}>
              <BarChart data={weeklyVolume} />
            </Card>
            <Card title="Outstanding vs Collected" style={styles.chartCard}>
              <ComparisonBars rows={financialRows} />
              <Button
                label="Prepare weekly collection"
                variant="secondary"
                disabled={actionsDisabled}
                onPress={() => !actionsDisabled && router.push(selectedCycle ? `/weekly-collections?cycle=${encodeURIComponent(selectedCycle)}` : '/weekly-collections')}
                style={[styles.collectionBtn, actionsDisabled && styles.collectionBtnDisabled]}
              />
            </Card>
          </View>

          <Card
            title="Recent Activity"
            right={
              <Text style={styles.viewAllLink} onPress={() => router.push('/tracking-logs')}>
                View all logs
              </Text>
            }
          >
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, idx) => (
                <ActivityRow
                  key={`${activity.trackingId}-${idx}`}
                  {...activity}
                  isLast={idx === recentActivities.length - 1}
                />
              ))
            ) : (
              <View style={styles.emptyActivity}>
                <Text style={styles.emptyText}>No recent tracking scans logged yet.</Text>
              </View>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    zIndex: 1000,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    zIndex: 1000,
  },
  updatingBanner: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
    marginBottom: spacing.md,
  },
  updatingBannerText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  staleBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  staleBannerText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },
  retryLink: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  retryLinkText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    zIndex: 1,
  },
  chartsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  chartCard: {
    flex: 1,
    minWidth: 280,
  },
  collectionBtn: {
    marginTop: spacing.md,
  },
  collectionBtnDisabled: {
    marginTop: spacing.md,
    opacity: 0.5,
  },
  viewAllLink: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
    cursor: 'pointer',
  },
  emptyActivity: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: spacing.xl,
    borderRadius: radius.sm,
    marginVertical: spacing.xl,
    alignItems: 'center',
  },
  errorTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: spacing.md,
    maxWidth: 500,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
  },
  retryBtnText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

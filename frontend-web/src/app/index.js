import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
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
import { getActiveCollectionCycles } from '../features/collections/services/collectionsApi';
import { getRecentThursdays } from '../features/collections/utils/collectionsUtils';
import { getDashboardSummary, subscribeRealtimeEvents } from '../features/shipments';
import { useRequestCoordinator } from '../services/api/useRequestCoordinator';
import { colors, fonts, spacing, radius } from '../theme';

export default function DashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');

  // Fetch active cycles containing registered shipments
  useEffect(() => {
    let mounted = true;
    async function loadCycles() {
      try {
        const activeCycles = await getActiveCollectionCycles();
        if (!mounted) return;
        if (activeCycles.length > 0) {
          setCycles(activeCycles);
          setSelectedCycle((prev) => (prev && activeCycles.some((c) => c.isoDate === prev) ? prev : activeCycles[0].isoDate));
        } else {
          const fallback = getRecentThursdays(1);
          setCycles(fallback);
          setSelectedCycle(fallback[0]?.isoDate || '');
        }
      } catch (err) {
        if (!mounted) return;
        const fallback = getRecentThursdays(1);
        setCycles(fallback);
        setSelectedCycle(fallback[0]?.isoDate || '');
      }
    }
    loadCycles();
    return () => {
      mounted = false;
    };
  }, []);

  const { coordinator, setResumeFetcher } = useRequestCoordinator({
    scope: 'dashboard',
    onSuccess: (data) => {
      setSummary(data);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorMessage(null);
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    },
    onError: (err, meta) => {
      console.warn('Dashboard summary fetch failed:', err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Dashboard metrics are temporarily unavailable';
      setErrorMessage(msg);
      if (meta.hasExistingData) {
        setIsStale(true);
      } else {
        setInitialLoadFailed(true);
        setSummary(null);
      }
      setLoading(false);
    },
    debounceMs: 300,
  });

  const load = useCallback((cycleDate, showSpinner = true, debounce = false) => {
    if (!cycleDate) return;
    if (showSpinner) {
      setLoading(true);
      setErrorMessage(null);
    }
    const key = coordinator.deriveKey({ cycle: cycleDate });
    const fetcher = (signal) => getDashboardSummary(cycleDate, { signal });
    setResumeFetcher(() => fetcher);
    return coordinator.request(key, fetcher, { isSilent: !showSpinner, debounce });
  }, [coordinator, setResumeFetcher]);

  useEffect(() => {
    if (selectedCycle) {
      load(selectedCycle, true, false);
    }
  }, [selectedCycle, load]);

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

      {isStale && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleBannerText}>
            Dashboard metrics are temporarily unavailable and may be stale (last updated: {lastUpdated || 'earlier'}).
          </Text>
          <Pressable onPress={() => load(selectedCycle)} style={styles.retryLink}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {loading && !summary ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.ink} />
          <Text style={styles.loadingText}>Loading dashboard metrics...</Text>
        </View>
      ) : initialLoadFailed && !summary ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Dashboard Data Unavailable</Text>
          <Text style={styles.errorMessage}>
            {errorMessage || 'Unable to load live dashboard metrics from the server. Please check database or network connectivity.'}
          </Text>
          <Pressable onPress={() => load(selectedCycle)} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
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
                onPress={() => router.push(selectedCycle ? `/weekly-collections?cycle=${encodeURIComponent(selectedCycle)}` : '/weekly-collections')}
                style={styles.collectionBtn}
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
    zIndex: 1,
  },
  chartCard: {
    flex: 1,
    minWidth: 280,
  },
  collectionBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderColor: 'transparent',
    paddingHorizontal: 0,
  },
  viewAllLink: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.accent,
  },
  emptyActivity: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  staleBannerText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  retryLink: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
    marginLeft: spacing.md,
  },
  retryLinkText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14,
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

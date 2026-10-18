import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import AppShell from '../components/layout/AppShell';
import Card from '../components/common/Card';
import {
  getReportSummary,
  ReportsHeader,
  ReportsKpiBar,
  ChargesVsCollectedChart,
  CollectionCycleSummaryCard,
  ReportsTabNav,
  FinancialRevenueTab,
  OperationalVolumeTab,
  ReceivablesAgingTab,
  PrintableReportModal,
} from '../features/reports';
import {
  ReportsKpiSkeleton,
  ChartSkeleton,
  CollectionSummarySkeleton,
  TableRowSkeleton,
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
import { subscribeRealtimeEvents } from '../features/shipments';
import { useRequestCoordinator } from '../services/api/useRequestCoordinator';
import { useVerifiedAdminSession, getVerifiedAdminSessionKey } from '../services/api/useVerifiedAdminSession';
import { colors, fonts, radius, spacing } from '../theme';

export default function ReportsScreen() {
  const sessionKey = useVerifiedAdminSession();
  const formatDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetDates = (presetId) => {
    const today = new Date();
    const endStr = formatDateString(today);

    switch (presetId) {
      case 'TODAY':
        return { start: endStr, end: endStr };
      case 'THIS_WEEK': {
        const dayOfWeek = today.getDay(); // 0 is Sunday
        const distanceToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - distanceToMonday);
        return { start: formatDateString(monday), end: endStr };
      }
      case 'THIS_MONTH': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: formatDateString(firstDay), end: endStr };
      }
      case 'LAST_30_DAYS': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return { start: formatDateString(thirtyDaysAgo), end: endStr };
      }
      default:
        return null;
    }
  };

  const initialPreset = 'THIS_MONTH';
  const initialDates = getPresetDates(initialPreset);

  const [activePreset, setActivePreset] = useState(initialPreset);
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [activeTab, setActiveTab] = useState('FINANCIAL');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [isLiveUpdating, setIsLiveUpdating] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const activeDatesRef = useRef({ startDate, endDate });
  activeDatesRef.current = { startDate, endDate };

  const reportDataRef = useRef(reportData);
  reportDataRef.current = reportData;



  const { coordinator } = useRequestCoordinator({
    scope: 'reports',
    onSuccess: (data, meta) => {
      const currentAuth = getSessionAuthContext();
      const currentQuery = activeDatesRef.current;
      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: currentQuery,
      })) {
        return;
      }

      setCacheEntry(CACHE_SLOTS.REPORTS, {
        userId: currentAuth.userId,
        sessionGeneration: currentAuth.sessionGeneration,
        queryParams: { startDate: currentQuery.startDate, endDate: currentQuery.endDate },
        data,
      });

      setReportData(data);
      setIsPreview(false);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorMessage(null);
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
      setIsLiveUpdating(false);
    },
    onError: (err, meta) => {
      if (isCancellationError(err)) return;
      const currentAuth = getSessionAuthContext();
      const currentQuery = activeDatesRef.current;
      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: currentQuery,
      })) {
        return;
      }

      const msg = err?.response?.data?.message || err?.message || 'Failed to load report data';
      setErrorMessage(msg);
      setIsPreview(false);
      if (reportDataRef.current) {
        setIsStale(true);
      } else {
        setInitialLoadFailed(true);
        setReportData(null);
      }
      setLoading(false);
      setIsLiveUpdating(false);
    },
    debounceMs: 300,
  });

  // Session reset listener
  useEffect(() => {
    const resetSession = () => {
      coordinator.cancel();
      setReportData(null);
      setIsPrintModalOpen(false);
      setIsStale(false);
      setIsPreview(false);
      setLastUpdated(null);
      setErrorMessage(null);
      setInitialLoadFailed(false);
      setLoading(true);
      setIsLiveUpdating(false);
    };
    resetSession();
    const unsubscribe = onSessionInvalidated(resetSession);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [coordinator, sessionKey]);

  const loadReport = useCallback((start, end, showSpinner = true, debounce = false) => {
    if (!sessionKey || sessionKey !== getVerifiedAdminSessionKey()) return;
    if (showSpinner) {
      setLoading(true);
    } else {
      setIsLiveUpdating(true);
    }
    const key = coordinator.deriveKey({ startDate: start, endDate: end });
    const fetcher = (signal) => getReportSummary({ startDate: start, endDate: end }, { signal });
    const requestAuth = getSessionAuthContext();
    const requestQuery = { startDate: start, endDate: end };
    return coordinator.request(key, fetcher, {
      isSilent: !showSpinner,
      debounce,
      requestAuth,
      requestQuery,
    });
  }, [coordinator, sessionKey]);

  // Initial load and filter change with preview cache lookup
  useEffect(() => {
    if (!sessionKey || sessionKey !== getVerifiedAdminSessionKey()) return;
    const auth = getSessionAuthContext();
    const cached = getCacheEntry(CACHE_SLOTS.REPORTS, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { startDate, endDate },
    });

    if (cached?.data) {
      setReportData(cached.data);
      setIsPreview(true);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorMessage(null);
      setLastUpdated(new Date(cached.timestamp).toLocaleTimeString());
      setLoading(true);
      loadReport(startDate, endDate, false, false);
    } else {
      // Clear previous date range's values immediately to avoid stale data under newly selected range
      setReportData(null);
      setIsPreview(false);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorMessage(null);
      setLoading(true);
      loadReport(startDate, endDate, true, false);
    }
  }, [startDate, endDate, loadReport]);

  // Real-Time SSE Auto-Sync with 300ms burst debounce and queued coalescing
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (
        ['PARCEL_EXCEPTION', 'WAYBILL_UPDATE', 'STATUS_UPDATE', 'SHIPMENT_CREATED', 'PAYMENT_RECORDED', 'SOA_GENERATED', 'SOA_UPDATED'].includes(event.type)
      ) {
        loadReport(startDate, endDate, false, true);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [startDate, endDate, loadReport]);

  const handleSelectPreset = (presetId) => {
    setActivePreset(presetId);
    if (presetId !== 'CUSTOM') {
      const dates = getPresetDates(presetId);
      if (dates) {
        setStartDate(dates.start);
        setEndDate(dates.end);
      }
    }
  };

  const handleCustomStartDateChange = (val) => {
    setActivePreset('CUSTOM');
    setStartDate(val);
  };

  const handleCustomEndDateChange = (val) => {
    setActivePreset('CUSTOM');
    setEndDate(val);
  };

  const dateRangeStr = `${startDate}_to_${endDate}`;

  // Actions requiring fresh report data are disabled during loading, preview, stale, or empty/failed states
  const actionsDisabled = loading || isPreview || isStale || !reportData || initialLoadFailed;

  return (
    <AppShell activeNav="Reports">
      <View style={styles.container}>
        {/* Header Toolbar */}
        <ReportsHeader
          activePreset={activePreset}
          onSelectPreset={handleSelectPreset}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleCustomStartDateChange}
          onEndDateChange={handleCustomEndDateChange}
          onPrintPress={() => {
            if (!actionsDisabled) setIsPrintModalOpen(true);
          }}
          isLiveUpdating={isLiveUpdating}
          printDisabled={actionsDisabled}
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
              Report metrics may be stale (last updated: {lastUpdated || 'earlier'}).
            </Text>
            <Pressable onPress={() => loadReport(startDate, endDate, true, false)} style={styles.retryLink}>
              <Text style={styles.retryLinkText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Error Notification Banner when no data available */}
        {initialLoadFailed && !reportData && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Unable to generate report aggregates: {errorMessage || 'Network or server error.'}
            </Text>
            <Pressable onPress={() => loadReport(startDate, endDate, true, false)} style={styles.errorRetryBtn}>
              <Text style={styles.errorRetryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Top 5 KPI Summary Ribbon or Skeleton */}
        {loading && !reportData ? (
          <ReportsKpiSkeleton />
        ) : (
          <ReportsKpiBar kpis={reportData?.kpis} loading={loading} />
        )}

        {/* Hero Row: Charges vs Collected Chart & Thursday Collections Summary Card */}
        {loading && !reportData ? (
          <View style={styles.heroRow}>
            <Card title="CHARGES VS COLLECTED (CLIENTS)" style={styles.heroCard}>
              <ChartSkeleton height={240} />
            </Card>
            <Card title="THIS THURSDAY'S COLLECTION SUMMARY" style={styles.heroCard}>
              <CollectionSummarySkeleton />
            </Card>
          </View>
        ) : (
          <View style={styles.heroRow}>
            <ChargesVsCollectedChart clientRevenue={reportData?.clientRevenue} />
            <CollectionCycleSummaryCard collectionSummary={reportData?.collectionSummary} />
          </View>
        )}

        {/* Detailed Domain Tab Navigation */}
        <ReportsTabNav activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Tab Content Display */}
        {loading && !reportData ? (
          <Card style={styles.tabSkeletonCard}>
            <TableRowSkeleton rows={6} columns={5} height={46} />
          </Card>
        ) : (
          <>
            {activeTab === 'FINANCIAL' && (
              <FinancialRevenueTab
                clientRevenue={reportData?.clientRevenue}
                paymentMethods={reportData?.paymentMethods}
                deductions={reportData?.deductions}
                dateRangeStr={dateRangeStr}
              />
            )}

            {activeTab === 'OPERATIONAL' && (
              <OperationalVolumeTab
                dailyVolume={reportData?.dailyVolume}
                statusDistribution={reportData?.statusDistribution}
                dateRangeStr={dateRangeStr}
              />
            )}

            {activeTab === 'AGING' && (
              <ReceivablesAgingTab
                receivablesAging={reportData?.receivablesAging}
                dateRangeStr={dateRangeStr}
              />
            )}
          </>
        )}

        {/* A4 Printable Document View Modal */}
        <PrintableReportModal
          visible={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          reportData={reportData}
          startDate={startDate}
          endDate={endDate}
        />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 64,
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
  heroRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  heroCard: {
    flex: 1,
    minWidth: 320,
  },
  tabSkeletonCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorBanner: {
    backgroundColor: '#FDE8E8',
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#9B1C1C',
    fontWeight: '600',
    flex: 1,
  },
  errorRetryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xs,
  },
  errorRetryBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

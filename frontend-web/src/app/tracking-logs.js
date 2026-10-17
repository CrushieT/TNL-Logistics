import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import {
  listTrackingLogs,
  getTrackingMetrics,
  TrackingLogsMetrics,
  TrackingLogsFilters,
  TrackingLogsTable,
  FloatingUpdatePill,
  exportTrackingLogsToCsv,
} from '../features/tracking-logs';
import Card from '../components/common/Card';
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
import { colors, fonts, radius, spacing } from '../theme';

export default function TrackingLogsScreen() {
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPagePreview, setIsPagePreview] = useState(false);
  const [lastLogsUpdated, setLastLogsUpdated] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [isMetricsPreview, setIsMetricsPreview] = useState(false);

  // Stale & error state
  const [isLogsStale, setIsLogsStale] = useState(false);
  const [logsErrorMessage, setLogsErrorMessage] = useState(null);
  const [initialLogsFailed, setInitialLogsFailed] = useState(false);

  const [isMetricsStale, setIsMetricsStale] = useState(false);
  const [metricsErrorMessage, setMetricsErrorMessage] = useState(null);
  const [initialMetricsFailed, setInitialMetricsFailed] = useState(false);

  // Success tracking for active query
  const hasActiveLogsSuccessRef = useRef(false);
  const hasActiveMetricsSuccessRef = useRef(false);
  const todayUtcRef = useRef(new Date().toISOString().slice(0, 10));

  // Pagination & filter state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Real-time SSE state
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [unreadLiveScans, setUnreadLiveScans] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const highlightTimers = useRef(new Map());

  const activeFilterRef = useRef({ page, pageSize, search, statusFilter });
  activeFilterRef.current = { page, pageSize, search, statusFilter };

  const { coordinator: logsCoordinator } = useRequestCoordinator({
    scope: 'tracking-logs',
    onSuccess: (data, meta) => {
      const currentAuth = getSessionAuthContext();
      const currentQuery = {
        page: activeFilterRef.current.page,
        size: activeFilterRef.current.pageSize,
        search: activeFilterRef.current.search.trim(),
        status: activeFilterRef.current.statusFilter,
      };

      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: currentQuery,
      })) {
        return;
      }

      hasActiveLogsSuccessRef.current = true;
      setCacheEntry(CACHE_SLOTS.TRACKING_LOGS_PAGE, {
        userId: currentAuth.userId,
        sessionGeneration: currentAuth.sessionGeneration,
        queryParams: currentQuery,
        data,
      });

      if (data) {
        const newContent = data.content || [];

        if (meta?.highlightDiff) {
          setLogs((prevLogs) => {
            const existingIds = new Set(prevLogs.map((item) => item.eventId));
            const newlyAddedIds = newContent
              .filter((item) => !existingIds.has(item.eventId))
              .map((item) => item.eventId);

            if (newlyAddedIds.length > 0) {
              setHighlightedIds((prev) => {
                const next = new Set(prev);
                newlyAddedIds.forEach((id) => next.add(id));
                return next;
              });

              newlyAddedIds.forEach((id) => {
                const timer = setTimeout(() => {
                  setHighlightedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                  highlightTimers.current.delete(id);
                }, 3500);
                highlightTimers.current.set(id, timer);
              });
            }
            return newContent;
          });
        } else {
          setLogs(newContent);
        }

        const pageMeta = data.page || {};
        setTotalElements(pageMeta.totalElements ?? data.totalElements ?? 0);
        setTotalPages(pageMeta.totalPages ?? data.totalPages ?? 0);
      }
      setIsPagePreview(false);
      setIsLogsStale(false);
      setInitialLogsFailed(false);
      setLogsErrorMessage(null);
      setLastLogsUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    },
    onError: (err, meta) => {
      if (isCancellationError(err)) return;
      const currentAuth = getSessionAuthContext();
      const currentQuery = {
        page: activeFilterRef.current.page,
        size: activeFilterRef.current.pageSize,
        search: activeFilterRef.current.search.trim(),
        status: activeFilterRef.current.statusFilter,
      };

      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: currentQuery,
      })) {
        return;
      }

      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to fetch tracking logs. Please check network connectivity.';
      setLogsErrorMessage(errorMsg);
      setIsPagePreview(false);
      if (hasActiveLogsSuccessRef.current) {
        setIsLogsStale(true);
      } else {
        setInitialLogsFailed(true);
        setLogs([]);
      }
      setLoading(false);
    },
    debounceMs: 300,
  });

  const { coordinator: metricsCoordinator } = useRequestCoordinator({
    scope: 'tracking-metrics',
    onSuccess: (data, meta) => {
      const currentAuth = getSessionAuthContext();
      const currentQuery = { metric: 'today', utcDate: todayUtcRef.current };

      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: currentQuery,
      })) {
        return;
      }

      hasActiveMetricsSuccessRef.current = true;
      setCacheEntry(CACHE_SLOTS.TRACKING_LOGS_METRICS, {
        userId: currentAuth.userId,
        sessionGeneration: currentAuth.sessionGeneration,
        queryParams: currentQuery,
        data,
      });

      if (data) {
        setMetrics(data);
      }
      setIsMetricsPreview(false);
      setIsMetricsStale(false);
      setInitialMetricsFailed(false);
      setMetricsErrorMessage(null);
      setMetricsLoading(false);
    },
    onError: (err, meta) => {
      if (isCancellationError(err)) return;
      const currentAuth = getSessionAuthContext();
      const currentQuery = { metric: 'today', utcDate: todayUtcRef.current };

      if (!isResponseAcceptable({
        requestAuth: meta?.requestAuth,
        requestQuery: meta?.requestQuery,
        currentAuth,
        activeQuery: currentQuery,
      })) {
        return;
      }

      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to fetch tracking metrics';
      setMetricsErrorMessage(errorMsg);
      setIsMetricsPreview(false);
      if (hasActiveMetricsSuccessRef.current) {
        setIsMetricsStale(true);
      } else {
        setInitialMetricsFailed(true);
      }
      setMetricsLoading(false);
    },
    debounceMs: 300,
  });

  // Session reset listener
  useEffect(() => {
    const unsubscribe = onSessionInvalidated(() => {
      logsCoordinator.cancel();
      metricsCoordinator.cancel();
      setLogs([]);
      setMetrics(null);
      setTotalElements(0);
      setTotalPages(0);
      setIsPagePreview(false);
      setIsMetricsPreview(false);
      setIsLogsStale(false);
      setInitialLogsFailed(false);
      setLogsErrorMessage(null);
      setIsMetricsStale(false);
      setInitialMetricsFailed(false);
      setMetricsErrorMessage(null);
      setLastLogsUpdated(null);
      setHighlightedIds(new Set());
      setUnreadLiveScans(0);
      hasActiveLogsSuccessRef.current = false;
      hasActiveMetricsSuccessRef.current = false;
      setLoading(false);
      setMetricsLoading(false);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [logsCoordinator, metricsCoordinator]);

  // Fetch paginated logs with optional diff highlighting
  const fetchLogs = useCallback(
    (targetPage, targetSize, targetSearch, targetStatus, showSpinner = true, highlightDiff = false, debounce = false) => {
      if (showSpinner) {
        setLoading(true);
        setLogsErrorMessage(null);
        setInitialLogsFailed(false);
      }
      const requestAuth = getSessionAuthContext();
      const requestQuery = {
        page: targetPage,
        size: targetSize,
        search: targetSearch.trim(),
        status: targetStatus,
      };
      const key = logsCoordinator.deriveKey(requestQuery);
      const fetcher = (signal) =>
        listTrackingLogs(
          {
            page: targetPage,
            size: targetSize,
            search: targetSearch,
            status: targetStatus,
          },
          { signal }
        );
      return logsCoordinator.request(key, fetcher, {
        isSilent: !showSpinner,
        debounce,
        highlightDiff,
        requestAuth,
        requestQuery,
      });
    },
    [logsCoordinator]
  );

  // Fetch today's summary metrics
  const fetchMetrics = useCallback(
    (debounce = false) => {
      const todayUtc = new Date().toISOString().slice(0, 10);
      todayUtcRef.current = todayUtc;
      setInitialMetricsFailed(false);
      setMetricsErrorMessage(null);
      const requestAuth = getSessionAuthContext();
      const requestQuery = { metric: 'today', utcDate: todayUtc };
      const key = metricsCoordinator.deriveKey(requestQuery);
      const fetcher = (signal) => getTrackingMetrics({ signal });
      return metricsCoordinator.request(key, fetcher, {
        isSilent: true,
        debounce,
        requestAuth,
        requestQuery,
      });
    },
    [metricsCoordinator]
  );

  // Initial load & whenever page / pageSize / statusFilter changes
  useEffect(() => {
    hasActiveLogsSuccessRef.current = false;
    setIsLogsStale(false);
    setLogsErrorMessage(null);
    setInitialLogsFailed(false);

    const auth = getSessionAuthContext();
    const queryParams = {
      page,
      size: pageSize,
      search: search.trim(),
      status: statusFilter,
    };
    const cached = getCacheEntry(CACHE_SLOTS.TRACKING_LOGS_PAGE, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams,
    });

    if (cached?.data) {
      hasActiveLogsSuccessRef.current = true;
      setLogs(cached.data.content || []);
      const pageMeta = cached.data.page || {};
      setTotalElements(pageMeta.totalElements ?? cached.data.totalElements ?? 0);
      setTotalPages(pageMeta.totalPages ?? cached.data.totalPages ?? 0);
      setIsPagePreview(true);
      setLastLogsUpdated(new Date(cached.timestamp).toLocaleTimeString());
      setLoading(true);
      fetchLogs(page, pageSize, search, statusFilter, false, false, false);
    } else {
      setLogs([]);
      setIsPagePreview(false);
      setLoading(true);
      fetchLogs(page, pageSize, search, statusFilter, true, false, false);
    }
  }, [page, pageSize, statusFilter]);

  // Initial metrics load with preview cache
  useEffect(() => {
    const auth = getSessionAuthContext();
    const todayUtc = new Date().toISOString().slice(0, 10);
    todayUtcRef.current = todayUtc;
    const cached = getCacheEntry(CACHE_SLOTS.TRACKING_LOGS_METRICS, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { metric: 'today', utcDate: todayUtc },
    });

    if (cached?.data) {
      hasActiveMetricsSuccessRef.current = true;
      setMetrics(cached.data);
      setIsMetricsPreview(true);
      setMetricsLoading(true);
      fetchMetrics(false);
    } else {
      hasActiveMetricsSuccessRef.current = false;
      setMetrics(null);
      setIsMetricsPreview(false);
      setMetricsLoading(true);
      fetchMetrics(false);
    }
  }, [fetchMetrics]);

  // Handle debounced search changes with cache lookup
  const handleSearchChange = (text) => {
    setSearch(text);
    setPage(0);
    setUnreadLiveScans(0);

    hasActiveLogsSuccessRef.current = false;
    setIsLogsStale(false);
    setLogsErrorMessage(null);
    setInitialLogsFailed(false);

    const auth = getSessionAuthContext();
    const queryParams = {
      page: 0,
      size: pageSize,
      search: text.trim(),
      status: statusFilter,
    };
    const cached = getCacheEntry(CACHE_SLOTS.TRACKING_LOGS_PAGE, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams,
    });

    if (cached?.data) {
      hasActiveLogsSuccessRef.current = true;
      setLogs(cached.data.content || []);
      const pageMeta = cached.data.page || {};
      setTotalElements(pageMeta.totalElements ?? cached.data.totalElements ?? 0);
      setTotalPages(pageMeta.totalPages ?? cached.data.totalPages ?? 0);
      setIsPagePreview(true);
      setLastLogsUpdated(new Date(cached.timestamp).toLocaleTimeString());
      fetchLogs(0, pageSize, text, statusFilter, false, false, true);
    } else {
      setLogs([]);
      setIsPagePreview(false);
      fetchLogs(0, pageSize, text, statusFilter, false, false, true);
    }
  };

  // Handle status filter pills
  const handleStatusFilterChange = (newStatus) => {
    if (newStatus === statusFilter) return;
    hasActiveLogsSuccessRef.current = false;
    setIsLogsStale(false);
    setLogsErrorMessage(null);
    setInitialLogsFailed(false);
    setStatusFilter(newStatus);
    setPage(0);
    setUnreadLiveScans(0);
  };

  // Handle page navigation
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  // Handle page size selector
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(0);
    setUnreadLiveScans(0);
  };

  // Real-time SSE synchronization with 300ms debounce
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.type === 'STATUS_UPDATE' || event.type === 'SHIPMENT_CREATED') {
        fetchMetrics(true);

        // If on Page 0 and no complex search is active, silently update in-place with highlight diff
        if (page === 0 && (!search || search.trim() === '')) {
          fetchLogs(0, pageSize, '', statusFilter, false, true, true);
        } else {
          // If viewing historical page or searching, notify user via floating pill
          const increment = (event.type === 'SHIPMENT_CREATED' && event.data?.quantity)
            ? Number(event.data.quantity)
            : 1;
          setUnreadLiveScans((prev) => prev + increment);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      highlightTimers.current.forEach((t) => clearTimeout(t));
      highlightTimers.current.clear();
    };
  }, [page, pageSize, search, statusFilter, fetchMetrics, fetchLogs]);

  // Jump to latest scans from floating pill
  const handleJumpToLatest = () => {
    setPage(0);
    setSearch('');
    setStatusFilter('ALL');
    setUnreadLiveScans(0);
    fetchLogs(0, pageSize, '', 'ALL', true);
  };

  // Export filtered logs to CSV (live request preserved)
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      // Fetch larger set of matching records for export
      const exportData = await listTrackingLogs({
        page: 0,
        size: 500,
        search,
        status: statusFilter,
      });

      const recordsToExport = exportData?.content || logs;
      exportTrackingLogsToCsv(recordsToExport);
    } catch (err) {
      console.warn('Failed to export CSV:', err?.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell activeNav="Tracking Logs">
      <View style={styles.container}>
        {/* Header Row */}
        <PageHeader
          eyebrow="OPERATIONS"
          title="Tracking Logs"
          right={
            <View style={styles.liveIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>LIVE AUDIT STREAM</Text>
            </View>
          }
        />

        {/* 4-Card Operational Metrics Bar */}
        <TrackingLogsMetrics metrics={metrics} loading={metricsLoading} />

        {/* Metrics Stale / Error Banner if metrics failed independently */}
        {initialMetricsFailed && !metrics && (
          <View style={styles.metricsBanner}>
            <Text style={styles.metricsErrorText}>
              Unable to load operational metrics: {metricsErrorMessage || 'Network error.'}
            </Text>
            <Pressable onPress={() => fetchMetrics(false)} style={styles.retryLink}>
              <Text style={styles.retryLinkText}>Retry</Text>
            </Pressable>
          </View>
        )}
        {isMetricsStale && (
          <View style={styles.metricsBanner}>
            <Text style={styles.staleBannerText}>
              Operational metrics may be stale.
            </Text>
            <Pressable onPress={() => fetchMetrics(false)} style={styles.retryLink}>
              <Text style={styles.retryLinkText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Updating Preview Banner for audit trail */}
        {loading && isPagePreview && (
          <View style={styles.updatingBanner}>
            <Text style={styles.updatingBannerText}>
              Updating audit trail; last updated {lastLogsUpdated || 'recently'}
            </Text>
          </View>
        )}

        {/* Stale Warning Banner for audit trail */}
        {isLogsStale && (
          <View style={styles.staleBanner}>
            <Text style={styles.staleBannerText}>
              Tracking logs may be stale (last updated: {lastLogsUpdated || 'earlier'}).
            </Text>
            <Pressable
              onPress={() => fetchLogs(page, pageSize, search, statusFilter, true, false, false)}
              style={styles.retryLink}
            >
              <Text style={styles.retryLinkText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Floating Notification for new scans when viewing historical pages */}
        <FloatingUpdatePill
          count={unreadLiveScans}
          onPress={handleJumpToLatest}
        />

        {/* Filter & Search Bar with CSV Export */}
        <TrackingLogsFilters
          searchQuery={search}
          onSearchChange={handleSearchChange}
          selectedStatus={statusFilter}
          onStatusChange={handleStatusFilterChange}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
        />

        {/* Paginated Audit Trail Table or Initial Error State */}
        {initialLogsFailed ? (
          <Card style={styles.initialErrorCard}>
            <Text style={styles.initialErrorTitle}>Unable to load tracking logs</Text>
            <Text style={styles.initialErrorMessage}>
              {logsErrorMessage || 'Network or server error. Please check your connection.'}
            </Text>
            <Pressable
              onPress={() => fetchLogs(page, pageSize, search, statusFilter, true, false, false)}
              style={styles.retryBtn}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </Card>
        ) : (
          <TrackingLogsTable
            logs={logs}
            loading={loading}
            page={page}
            pageSize={pageSize}
            totalElements={totalElements}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            highlightedEventIds={highlightedIds}
          />
        )}
      </View>
    </AppShell>
  );
}

function formatStatusLabel(status) {
  if (!status) return 'Registered';
  switch (status) {
    case 'QR_GENERATED':
      return 'QR Generated';
    case 'LOADED_ON_TRUCK':
      return 'Loaded on Truck';
    case 'ARRIVED_AT_TNL':
      return 'Outload / Arrive TNL';
    case 'LOADED_TO_HAULER':
      return 'Loaded to Hauler';
    case 'COMPLETED':
      return 'Completed';
    case 'REGISTERED':
    default:
      return 'Registered';
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  titleGroup: {
    flex: 1,
    minWidth: 200,
  },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fonts.sans,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981', // green pulse
  },
  liveText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.6,
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
    borderColor: '#FDE68A',
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
  metricsBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricsErrorText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
    flex: 1,
  },
  initialErrorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  initialErrorTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  initialErrorMessage: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
    maxWidth: 480,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.xs,
  },
  retryBtnText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

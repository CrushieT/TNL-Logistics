import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import AppShell from '../components/layout/AppShell';
import {
  listTrackingLogs,
  getTrackingMetrics,
  TrackingLogsMetrics,
  TrackingLogsFilters,
  TrackingLogsTable,
  FloatingUpdatePill,
  exportTrackingLogsToCsv,
} from '../features/tracking-logs';
import { subscribeRealtimeEvents } from '../features/shipments';
import { colors, fonts } from '../theme';

export default function TrackingLogsScreen() {
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);

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

  const searchDebounceTimer = useRef(null);
  const highlightTimers = useRef(new Map());

  // Fetch paginated logs with optional diff highlighting
  const fetchLogs = useCallback(
    async (targetPage, targetSize, targetSearch, targetStatus, showSpinner = true, highlightDiff = false) => {
      try {
        if (showSpinner) setLoading(true);
        const data = await listTrackingLogs({
          page: targetPage,
          size: targetSize,
          search: targetSearch,
          status: targetStatus,
        });

        if (data) {
          const newContent = data.content || [];

          if (highlightDiff) {
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
      } catch (err) {
        console.warn('Failed to fetch tracking logs:', err?.message);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    []
  );

  // Fetch today's summary metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const data = await getTrackingMetrics();
      if (data) {
        setMetrics(data);
      }
    } catch (err) {
      console.warn('Failed to fetch tracking metrics:', err?.message);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Initial load & whenever page / pageSize / statusFilter changes
  useEffect(() => {
    fetchLogs(page, pageSize, search, statusFilter, true);
  }, [page, pageSize, statusFilter]);

  // Initial metrics load
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Handle debounced search changes
  const handleSearchChange = (text) => {
    setSearch(text);
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    searchDebounceTimer.current = setTimeout(() => {
      setPage(0);
      setUnreadLiveScans(0);
      fetchLogs(0, pageSize, text, statusFilter, false);
    }, 300);
  };

  // Handle status filter pills
  const handleStatusFilterChange = (newStatus) => {
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

  // Real-time SSE synchronization + Window focus fallback
  useEffect(() => {
    const handleSilentSync = () => {
      fetchMetrics();
      if (page === 0 && (!search || search.trim() === '')) {
        fetchLogs(0, pageSize, '', statusFilter, false, true);
      }
    };

    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.type === 'STATUS_UPDATE' || event.type === 'SHIPMENT_CREATED') {
        fetchMetrics();

        // If on Page 0 and no complex search is active, silently update in-place with highlight diff
        if (page === 0 && (!search || search.trim() === '')) {
          fetchLogs(0, pageSize, '', statusFilter, false, true);
        } else {
          // If viewing historical page or searching, notify user via floating pill
          const increment = (event.type === 'SHIPMENT_CREATED' && event.data?.quantity)
            ? Number(event.data.quantity)
            : 1;
          setUnreadLiveScans((prev) => prev + increment);
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSilentSync);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSilentSync);
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

  // Export filtered logs to CSV
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
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.eyebrow}>IMMUTABLE AUDIT TRAIL</Text>
            <Text style={styles.pageTitle}>TRACKING LOGS</Text>
          </View>

          {/* Live SSE Pulse Indicator */}
          <View style={styles.liveIndicator}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveText}>LIVE AUDIT STREAM</Text>
          </View>
        </View>

        {/* 4-Card Operational Metrics Bar */}
        <TrackingLogsMetrics metrics={metrics} loading={metricsLoading} />

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

        {/* Paginated Audit Trail Table */}
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
    padding: 24,
    maxWidth: 1400,
    alignSelf: 'center',
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
});

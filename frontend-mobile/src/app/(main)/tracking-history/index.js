import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Icon } from 'react-native-paper';
import { useAuth } from '../../../features/auth/context/AuthContext';
import { colors, typography } from '../../../theme';
import { PersonalScanMetrics } from '../../../features/tracking-history/components/PersonalScanMetrics';
import { PersonalTrackingEventCard } from '../../../features/tracking-history/components/PersonalTrackingEventCard';
import { trackingHistoryApi } from '../../../features/tracking-history/services/trackingHistoryApi';
import {
  appendUniqueEvents,
  encodeTrackingId,
  HISTORY_PAGE_SIZE,
  replacePageZeroEvents,
} from '../../../features/tracking-history/trackingHistoryFlow.mjs';
import { createTrackingHistoryRequestCoordinator } from '../../../features/tracking-history/trackingHistoryRequestCoordinator.mjs';
import { useOfflineSync } from '../../../features/offline-sync/context/OfflineSyncContext';
import { summarizeOfflineQueue } from '../../../features/offline-sync/offlineQueueFlow.mjs';

export default function TrackingHistoryScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { rows: offlineRows, syncRevision, otherOwnerCount } = useOfflineSync();
  const offlineCounts = summarizeOfflineQueue(offlineRows);

  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState(null);

  const [events, setEvents] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [initialError, setInitialError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [appendError, setAppendError] = useState(null);

  const searchDebounceTimerRef = useRef(null);
  const searchQueryRef = useRef('');
  const activeSearchRef = useRef('');
  const metricsControllerRef = useRef(null);
  const requestCoordinatorRef = useRef(null);
  if (requestCoordinatorRef.current === null) {
    requestCoordinatorRef.current = createTrackingHistoryRequestCoordinator();
  }
  const requestCoordinator = requestCoordinatorRef.current;

  // Role Guard: Restrict strictly to FIELD_STAFF
  useEffect(() => {
    if (!authLoading && user && user.role !== 'FIELD_STAFF') {
      router.replace('/(main)');
    }
  }, [user, authLoading, router]);

  const fetchMetrics = useCallback(async () => {
    metricsControllerRef.current?.abort();
    const controller = new AbortController();
    metricsControllerRef.current = controller;

    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await trackingHistoryApi.getMyMetrics(controller.signal);
      if (metricsControllerRef.current !== controller || controller.signal.aborted) return;
      setMetrics(data);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (metricsControllerRef.current !== controller) return;
      setMetricsError(err.response?.data?.message || 'Failed to load metrics.');
    } finally {
      if (metricsControllerRef.current === controller) {
        metricsControllerRef.current = null;
        setMetricsLoading(false);
      }
    }
  }, []);

  const fetchPageZero = useCallback(async (search, isRefresh = false) => {
    const requestToken = requestCoordinator.beginPageZero();
    setLoadingMore(false);

    if (isRefresh) {
      setRefreshing(true);
      setInitialLoading(false);
      setRefreshError(null);
    } else {
      setInitialLoading(true);
      setRefreshing(false);
      setInitialError(null);
    }
    setAppendError(null);

    try {
      const data = await trackingHistoryApi.listMyEvents(
        { search, page: 0, size: HISTORY_PAGE_SIZE },
        requestToken.signal
      );

      if (!requestCoordinator.isCurrent(requestToken)) return;

      const incoming = data?.content || [];
      setEvents(replacePageZeroEvents(incoming));
      setCurrentPage(data?.page?.number ?? data?.number ?? 0);
      setTotalPages(data?.page?.totalPages ?? data?.totalPages ?? 0);
      setTotalElements(data?.page?.totalElements ?? data?.totalElements ?? 0);
      setActiveSearch(search);
      activeSearchRef.current = search;
      setRefreshError(null);
      setInitialError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (!requestCoordinator.isCurrent(requestToken)) return;
      const msg = err.response?.data?.message || 'Failed to load personal scan history.';
      if (isRefresh) {
        setRefreshError(msg);
      } else {
        setInitialError(msg);
      }
    } finally {
      if (requestCoordinator.finish(requestToken)) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [requestCoordinator]);

  const loadMoreEvents = useCallback(async () => {
    if (searchDebounceTimerRef.current) return;
    if (searchQueryRef.current !== activeSearchRef.current) return;
    if (currentPage >= totalPages - 1) return;

    const requestToken = requestCoordinator.beginPagination();
    if (!requestToken) return;

    setLoadingMore(true);
    setAppendError(null);

    const nextPage = currentPage + 1;
    const requestSearch = activeSearchRef.current;
    try {
      const data = await trackingHistoryApi.listMyEvents(
        {
          search: requestSearch,
          page: nextPage,
          size: HISTORY_PAGE_SIZE,
        },
        requestToken.signal
      );

      if (!requestCoordinator.isCurrent(requestToken)) return;

      const incoming = data?.content || [];
      setEvents((prev) => appendUniqueEvents(prev, incoming));
      setCurrentPage(data?.page?.number ?? data?.number ?? nextPage);
      setTotalPages(data?.page?.totalPages ?? data?.totalPages ?? totalPages);
      setTotalElements(data?.page?.totalElements ?? data?.totalElements ?? totalElements);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (!requestCoordinator.isCurrent(requestToken)) return;
      setAppendError(err.response?.data?.message || 'Failed to load more scans.');
    } finally {
      if (requestCoordinator.finish(requestToken)) {
        setLoadingMore(false);
      }
    }
  }, [currentPage, requestCoordinator, totalElements, totalPages]);

  // Refresh data on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchMetrics();
      fetchPageZero(searchQueryRef.current, false);

      return () => {
        if (searchDebounceTimerRef.current) {
          clearTimeout(searchDebounceTimerRef.current);
          searchDebounceTimerRef.current = null;
        }
        requestCoordinator.cancelAll();
        metricsControllerRef.current?.abort();
        metricsControllerRef.current = null;
        setLoadingMore(false);
      };
    }, [fetchMetrics, fetchPageZero, requestCoordinator, syncRevision])
  );

  // Debounced search effect
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    searchQueryRef.current = text;
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }
    requestCoordinator.cancelAll();
    setLoadingMore(false);
    searchDebounceTimerRef.current = setTimeout(() => {
      searchDebounceTimerRef.current = null;
      fetchPageZero(text, false);
    }, 250);
  };

  const handlePullToRefresh = () => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }
    fetchMetrics();
    fetchPageZero(searchQueryRef.current, true);
  };

  const handleSelectEvent = (event) => {
    if (!event || !event.trackingId) return;
    const encoded = encodeTrackingId(event.trackingId);
    router.push(`/(main)/tracking-history/${encoded}`);
  };

  if (authLoading || !user || user.role !== 'FIELD_STAFF') {
    return null;
  }

  const renderHeader = () => (
    <View>
      {offlineRows.length > 0 && (
        <TouchableOpacity style={styles.offlineBanner} onPress={() => router.push('/(main)/offline-queue')}>
          <Text style={styles.offlineBannerText}>{offlineCounts.pending + offlineCounts.retryable} PENDING | {offlineCounts.terminal} NEED REVIEW</Text>
          <Text style={styles.offlineBannerAction}>VIEW QUEUE</Text>
        </TouchableOpacity>
      )}
      {otherOwnerCount > 0 && <TouchableOpacity style={styles.offlineBanner} onPress={() => router.push('/(main)/offline-queue')}>
        <Text style={styles.offlineBannerText}>{otherOwnerCount} SCAN{otherOwnerCount === 1 ? '' : 'S'} FROM ANOTHER ACCOUNT ON THIS DEVICE</Text>
        <Text style={styles.offlineBannerAction}>VIEW QUEUE</Text>
      </TouchableOpacity>}
      <PersonalScanMetrics
        metrics={metrics}
        isLoading={metricsLoading}
        error={metricsError}
        onRetry={fetchMetrics}
      />

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Icon source="magnify" size={20} color={colors.inkFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tracking ID or status..."
            placeholderTextColor={colors.inkFaint}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={50}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity
              onPress={() => handleSearchChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon source="close-circle" size={18} color={colors.inkFaint} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {Boolean(refreshError) && (
        <View style={styles.inlineWarning}>
          <Text style={styles.warningText}>Refresh failed: {refreshError}</Text>
        </View>
      )}

      {Boolean(initialError) && (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Unable to Load Tracking History</Text>
          <Text style={styles.errorMessage}>{initialError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchPageZero(searchQueryRef.current, false)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingMoreText}>Loading more events...</Text>
        </View>
      );
    }

    if (appendError) {
      return (
        <View style={styles.appendErrorRow}>
          <Text style={styles.appendErrorText}>{appendError}</Text>
          <TouchableOpacity onPress={loadMoreEvents} style={styles.retryMoreButton}>
            <Text style={styles.retryMoreText}>Retry loading more</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return <View style={{ height: 20 }} />;
  };

  const renderEmpty = () => {
    if (initialLoading || initialError) return null;

    const message = activeSearch.trim()
      ? 'No personal scans match this search.'
      : 'No scans recorded for this account yet.';

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{message}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Safe Area Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon source="arrow-left" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TRACKING HISTORY</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {initialLoading && events.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, index) => String(item.eventId ?? `event-${index}`)}
          renderItem={({ item }) => (
            <PersonalTrackingEventCard event={item} onPress={handleSelectEvent} />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={loadMoreEvents}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  headerRightSpacer: {
    width: 32,
  },
  listContent: {
    backgroundColor: colors.canvas,
    minHeight: '100%',
    paddingBottom: 40,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 4,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offlineBannerText: { color: colors.warning, fontWeight: '800', fontSize: 11 },
  offlineBannerAction: { color: colors.warning, fontWeight: '800', fontSize: 11 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inlineWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 4,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 10,
  },
  warningText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
  },
  errorPanel: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 4,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 12,
    color: colors.inkFaint,
    marginLeft: 8,
  },
  appendErrorRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  appendErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginBottom: 6,
  },
  retryMoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryMoreText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

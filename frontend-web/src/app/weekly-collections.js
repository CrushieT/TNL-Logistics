import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import {
  getWeeklyCollections,
  generateBatchSoa,
  saveStatement,
  getRecentThursdays,
  getActiveCollectionCycles,
  formatCurrency,
  SearchableClientDropdown,
  CycleDropdown,
  WeeklyCollectionsTable,
  BatchSoaModal,
} from '../features/collections';
import { subscribeRealtimeEvents } from '../features/shipments';
import { useRequestCoordinator } from '../services/api/useRequestCoordinator';
import { colors, fonts, spacing, radius, type } from '../theme';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Status: All' },
  { value: 'READY_FOR_SOA', label: 'Ready for SOA' },
  { value: 'SOA_GENERATED', label: 'SOA Generated' },
  { value: 'SETTLED', label: 'Settled' },
];

export default function WeeklyCollectionsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [infoBanner, setInfoBanner] = useState(null);

  // Fetch only active cycles containing registered shipments
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
      } catch (cycleErr) {
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
    scope: 'weekly-collections',
    onSuccess: (data) => {
      setDashboardData(data);
      setIsStale(false);
      setInitialLoadFailed(false);
      setErrorBanner(null);
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    },
    onError: (err, meta) => {
      console.warn('Failed to load weekly collections:', err);
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to load weekly collection data. Please check network connectivity.';
      setErrorBanner(errorMsg);
      if (meta.hasExistingData) {
        setIsStale(true);
      } else {
        setInitialLoadFailed(true);
        setDashboardData(null);
      }
      setLoading(false);
    },
    debounceMs: 300,
  });

  // Load weekly collections data
  const loadData = useCallback((showSpinner = true, debounce = false) => {
    if (!selectedCycle) return;
    if (showSpinner) {
      setLoading(true);
      setErrorBanner(null);
    }
    const key = coordinator.deriveKey({ cycle: selectedCycle });
    const fetcher = (signal) => getWeeklyCollections(selectedCycle, { signal });
    setResumeFetcher(() => fetcher);
    return coordinator.request(key, fetcher, { isSilent: !showSpinner, debounce });
  }, [selectedCycle, coordinator, setResumeFetcher]);

  useEffect(() => {
    if (selectedCycle) {
      loadData(true, false);
    }
  }, [selectedCycle, loadData]);

  // Real-time SSE refresh with 300ms debounce
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents(() => {
      loadData(false, true);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadData]);

  // Filter clients based on search query and status filter
  const allItems = dashboardData?.items || [];
  const selectedCycleObj = useMemo(() => cycles.find((c) => c.isoDate === selectedCycle) || cycles[0] || null, [cycles, selectedCycle]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Exclude completely inactive clients (0 shipments and 0 balance) unless searched specifically
      const hasActivity = (item.shipmentsCount > 0) || (item.currentCharges > 0) || (item.balance > 0) || (item.unbilledShipmentsCount > 0);
      if (!hasActivity && !searchQuery.trim()) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const clean = searchQuery.trim().toLowerCase();
        const matchName = (item.clientName || '').toLowerCase().includes(clean);
        const matchCode = (item.clientCode || '').toLowerCase().includes(clean);
        const matchContact = (item.contactNumber || '').toLowerCase().includes(clean);
        return matchName || matchCode || matchContact;
      }

      return true;
    });
  }, [allItems, statusFilter, searchQuery]);

  // Active unbilled clients that need SOA generation for this cycle
  const unbilledClients = useMemo(() => {
    return allItems.filter(
      (item) =>
        !item.statementId &&
        (item.status === 'READY_FOR_SOA' ||
          Number(item.shipmentsCount || 0) > 0 ||
          Number(item.unbilledShipmentsCount || 0) > 0)
    );
  }, [allItems]);

  // Handle clicking "Generate All SOAs" button
  const handleBatchClick = () => {
    if (!dashboardData || isStale) {
      return;
    }
    setErrorBanner(null);
    setSuccessBanner(null);
    setInfoBanner(null);

    if (unbilledClients.length === 0) {
      setInfoBanner('All Statements of Account for this cycle are already generated. No pending SOAs.');
      return;
    }

    setBatchModalVisible(true);
  };

  // Handle Generate SOA or View Statement
  const handleReviewClient = async (clientItem, action = 'GENERATE_SOA') => {
    if (!dashboardData || isStale) {
      return;
    }
    const id = clientItem.clientId || clientItem.clientCode;
    const isAlreadyGenerated = Boolean(clientItem.statementId);

    if (!isAlreadyGenerated) {
      try {
        await saveStatement({
          clientId: id,
          targetDate: selectedCycle,
          cycleThursday: selectedCycle,
          deductionAmount: 0,
          deductionNote: '',
          collectedBy: null,
        });
      } catch (err) {
        console.warn('Auto SOA generation error before navigation:', err);
      }
    }

    router.push(`/statements?clientId=${encodeURIComponent(id)}&cycle=${encodeURIComponent(selectedCycle)}`);
  };

  // Handle Batch SOA Generation
  const handleConfirmBatch = async () => {
    if (!dashboardData || isStale) {
      return;
    }
    try {
      setErrorBanner(null);
      setSuccessBanner(null);
      setInfoBanner(null);

      let successCount = 0;
      for (const client of unbilledClients) {
        const id = client.clientId || client.clientCode;
        try {
          await saveStatement({
            clientId: id,
            targetDate: selectedCycle,
            cycleThursday: selectedCycle,
            deductionAmount: 0,
            deductionNote: '',
            collectedBy: null,
          });
          successCount++;
        } catch (clientErr) {
          console.warn(`Failed to generate SOA for client ${id}:`, clientErr);
        }
      }

      setSuccessBanner(`Successfully generated ${successCount} Statement(s) of Account for ${selectedCycle}.`);
      await loadData(false);
    } catch (err) {
      console.warn('Batch generation failed:', err);
      setErrorBanner(err?.response?.data?.message || 'Failed to generate batch SOAs. Please try again.');
    }
  };

  // Calculate summary statistics for the active view
  const summaryStats = useMemo(() => {
    if (!dashboardData) {
      return {
        clientsCount: '—',
        totalDue: null,
        outstanding: null,
      };
    }
    const clientsCount = filteredItems.length;
    const totalDue = filteredItems.reduce(
      (sum, item) => sum + Number(item.currentCharges || item.totalCharges || 0) + Number(item.previousBalance || 0),
      0
    );
    const outstanding = filteredItems.reduce(
      (sum, item) => sum + Number(item.balance ?? item.netAmountDue ?? 0),
      0
    );
    return {
      clientsCount,
      totalDue,
      outstanding,
    };
  }, [dashboardData, filteredItems]);

  return (
    <AppShell activeNav="Weekly Collections">
      <View style={styles.container}>
        {/* Header Row: Eyebrow + Title on left, 3 Summary metric cards on right */}
        <PageHeader
          eyebrow="BILLING & FINANCE"
          title="Weekly Collections"
          right={
            <View style={styles.topRightMetricsGroup}>
              <View style={styles.topRightMetricBox}>
                <Text style={styles.topRightMetricLabel}>CLIENTS</Text>
                <Text style={styles.topRightMetricValue}>
                  {summaryStats.clientsCount}
                </Text>
              </View>

              <View style={styles.topRightMetricBox}>
                <Text style={styles.topRightMetricLabel}>TOTAL DUE</Text>
                <Text style={styles.topRightMetricValue}>
                  {summaryStats.totalDue !== null ? formatCurrency(summaryStats.totalDue) : '—'}
                </Text>
              </View>

              <View style={styles.topRightMetricBox}>
                <Text style={styles.topRightMetricLabel}>OUTSTANDING</Text>
                <Text style={[styles.topRightMetricValue, styles.outstandingValue]}>
                  {summaryStats.outstanding !== null ? formatCurrency(summaryStats.outstanding) : '—'}
                </Text>
              </View>
            </View>
          }
        />

        {/* Notifications & Alerts */}
        {infoBanner ? (
          <View style={styles.infoAlert}>
            <Text style={styles.infoAlertText}>{infoBanner}</Text>
          </View>
        ) : null}

        {successBanner ? (
          <View style={styles.successAlert}>
            <Text style={styles.successAlertText}>{successBanner}</Text>
          </View>
        ) : null}

        {errorBanner ? (
          <View style={styles.errorAlert}>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorAlertText}>{errorBanner}</Text>
              {isStale && lastUpdated ? (
                <Text style={styles.staleAlertSubtext}>
                  Displaying last successful snapshot from {lastUpdated}. Financial actions are disabled until connection is restored.
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => loadData(true)} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Inline Search & Filter Toolbar */}
        <View style={[styles.toolbarRow, isMobile && styles.toolbarRowMobile]}>
          {/* Left: Searchable Combobox */}
          <View style={styles.searchSlot}>
            <SearchableClientDropdown
              clients={allItems}
              value={searchQuery}
              onChangeSearch={setSearchQuery}
              onSelectClient={(c) => setSearchQuery(c.name || c.clientName || '')}
              placeholder="Search clients..."
              maxWidth={360}
            />
          </View>

          {/* Middle: Cycle Dropdown & Status Filter */}
          <View style={styles.filtersGroup}>
            {/* Thursday Cycle Dropdown */}
            <CycleDropdown
              cycles={cycles}
              selectedCycle={selectedCycle}
              onSelectCycle={setSelectedCycle}
              minWidth={280}
              style={{ width: 280 }}
            />

            {/* Status Filter */}
            {Platform.OS === 'web' ? (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  backgroundColor: '#FAF9F5',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 2,
                  padding: '9px 12px',
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: '500',
                  color: colors.ink,
                  outline: 'none',
                  minWidth: 140,
                  height: 40,
                }}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : null}
          </View>

          {/* Right: Batch SOA Action */}
          <Pressable
            onPress={handleBatchClick}
            disabled={!dashboardData || isStale}
            style={({ hovered }) => [
              styles.batchBtn,
              (!dashboardData || isStale) && styles.batchBtnDisabled,
              hovered && dashboardData && !isStale && styles.batchBtnHovered,
            ]}
          >
            <Text style={[styles.batchBtnText, (!dashboardData || isStale) && styles.batchBtnTextDisabled]}>
              Generate All SOAs
            </Text>
          </Pressable>
        </View>

        {/* Main Weekly Collections Directory Table or Initial Error State */}
        {initialLoadFailed && !dashboardData ? (
          <View style={styles.initialErrorCard}>
            <Text style={styles.initialErrorTitle}>Collections Data Unavailable</Text>
            <Text style={styles.initialErrorMessage}>
              {errorBanner || 'Unable to retrieve collections data from server. Please verify network or database connectivity.'}
            </Text>
            <Pressable onPress={() => loadData(true)} style={styles.retryActionBtn}>
              <Text style={styles.retryActionBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <WeeklyCollectionsTable
            items={filteredItems}
            loading={loading}
            onReviewClient={handleReviewClient}
            isCurrentCycle={selectedCycleObj?.isCurrent}
            cycleLabel={selectedCycleObj?.label}
            actionsDisabled={!dashboardData || isStale}
          />
        )}
      </View>

      {/* Batch SOA Modal */}
      <BatchSoaModal
        visible={batchModalVisible}
        cycleDate={selectedCycleObj?.label}
        eligibleClients={unbilledClients}
        onClose={() => setBatchModalVisible(false)}
        onConfirmBatch={handleConfirmBatch}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 64,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  headerRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
  },
  titleColumn: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  topRightMetricsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  topRightMetricBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'flex-end',
    minWidth: 110,
  },
  topRightMetricLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  topRightMetricValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  outstandingValue: {
    color: '#DC2626',
  },
  batchBtn: {
    backgroundColor: colors.ink,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  batchBtnHovered: {
    opacity: 0.88,
  },
  batchBtnDisabled: {
    backgroundColor: '#8A897F',
    opacity: 0.5,
  },
  batchBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoAlert: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  infoAlertText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  successAlert: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  successAlertText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '700',
  },
  batchBtnTextDisabled: {
    color: '#D1D5DB',
  },
  errorAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorAlertText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  staleAlertSubtext: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#991B1B',
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xs,
    marginLeft: 12,
    alignSelf: 'center',
  },
  retryBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  initialErrorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.sm,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  initialErrorTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  initialErrorMessage: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 500,
  },
  retryActionBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.xs,
  },
  retryActionBtnText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    zIndex: 1000,
    position: 'relative',
  },
  toolbarRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    zIndex: 1000,
    position: 'relative',
  },
  searchSlot: {
    flex: 1,
    maxWidth: 360,
    zIndex: 1000,
    position: 'relative',
  },
  filtersGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 500,
  },
});

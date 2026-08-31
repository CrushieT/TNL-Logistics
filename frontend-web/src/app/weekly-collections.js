import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../components/layout/AppShell';
import {
  getWeeklyCollections,
  generateBatchSoa,
  getRecentThursdays,
  formatCurrency,
  SearchableClientDropdown,
  WeeklyCollectionsTable,
  BatchSoaModal,
} from '../features/collections';
import { subscribeRealtimeEvents } from '../features/shipments';
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

  const cycles = useMemo(() => getRecentThursdays(8), []);
  const [selectedCycle, setSelectedCycle] = useState(cycles[0]?.isoDate || '');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  // Load weekly collections data
  const loadData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      setErrorBanner(null);
      const data = await getWeeklyCollections(selectedCycle);
      setDashboardData(data);
    } catch (err) {
      console.warn('Failed to load weekly collections:', err);
      setErrorBanner('Failed to load weekly collection data. Please check network connectivity.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [selectedCycle]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Real-time SSE refresh
  useEffect(() => {
    const handleSilentRefresh = () => {
      loadData(false);
    };

    const unsubscribe = subscribeRealtimeEvents(() => {
      handleSilentRefresh();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSilentRefresh);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSilentRefresh);
      }
    };
  }, [loadData]);

  // Filter clients based on search query and status filter
  const allItems = dashboardData?.items || [];

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

  // Active eligible clients for batch generation
  const eligibleClients = useMemo(() => {
    return allItems.filter((i) => i.unbilledShipmentsCount > 0 || i.netAmountDue > 0);
  }, [allItems]);

  // Handle Review Client or View Statement
  const handleReviewClient = (clientItem, action = 'REVIEW') => {
    if (action === 'VIEW_SOA') {
      router.push('/statements');
    } else {
      router.push(`/clients/${clientItem.clientId}`);
    }
  };

  // Handle Batch SOA Generation
  const handleConfirmBatch = async () => {
    try {
      setErrorBanner(null);
      const payload = {
        targetThursday: selectedCycle,
        scope: 'ALL_UNBILLED',
      };
      const response = await generateBatchSoa(payload);
      const generatedCount = Array.isArray(response) ? response.length : eligibleClients.length;
      setSuccessBanner(`Successfully generated ${generatedCount} Statements of Account for ${selectedCycle}.`);
      loadData(false);
    } catch (err) {
      console.warn('Batch generation failed:', err);
      setErrorBanner(err?.response?.data?.message || 'Failed to generate batch SOAs. Please try again.');
    }
  };

  // Calculate summary statistics for the active view
  const summaryStats = useMemo(() => {
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
  }, [filteredItems]);

  const selectedCycleObj = cycles.find((c) => c.isoDate === selectedCycle) || cycles[0];

  return (
    <AppShell activeNav="Weekly Collections">
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header Row: Eyebrow + Title on left, 3 Summary metric cards on right */}
        <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
          <View style={styles.titleColumn}>
            <Text style={styles.eyebrow}>CONSOLIDATED BILLING · THURSDAY CYCLES</Text>
            <Text style={styles.pageTitle}>WEEKLY COLLECTIONS</Text>
          </View>

          {/* Top-Right Metric Cards (Clients, Total Due, Outstanding) */}
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
                {formatCurrency(summaryStats.totalDue)}
              </Text>
            </View>

            <View style={styles.topRightMetricBox}>
              <Text style={styles.topRightMetricLabel}>OUTSTANDING</Text>
              <Text style={[styles.topRightMetricValue, styles.outstandingValue]}>
                {formatCurrency(summaryStats.outstanding)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notifications & Alerts */}
        {successBanner ? (
          <View style={styles.successAlert}>
            <Text style={styles.successAlertText}>{successBanner}</Text>
          </View>
        ) : null}

        {errorBanner ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>{errorBanner}</Text>
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
            {Platform.OS === 'web' ? (
              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
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
                  minWidth: 200,
                  height: 40,
                }}
              >
                {cycles.map((c) => (
                  <option key={c.isoDate} value={c.isoDate}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : null}

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
            onPress={() => setBatchModalVisible(true)}
            disabled={eligibleClients.length === 0}
            style={({ hovered }) => [
              styles.batchBtn,
              eligibleClients.length === 0 && styles.batchBtnDisabled,
              hovered && eligibleClients.length > 0 && styles.batchBtnHovered,
            ]}
          >
            <Text style={styles.batchBtnText}>Generate All SOAs →</Text>
          </Pressable>
        </View>

        {/* Main Weekly Collections Directory Table */}
        <WeeklyCollectionsTable
          items={filteredItems}
          loading={loading}
          onReviewClient={handleReviewClient}
        />
      </ScrollView>

      {/* Batch SOA Modal */}
      <BatchSoaModal
        visible={batchModalVisible}
        cycleDate={selectedCycleObj?.label}
        eligibleClients={eligibleClients}
        onClose={() => setBatchModalVisible(false)}
        onConfirmBatch={handleConfirmBatch}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: spacing.xl,
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
  errorAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  errorAlertText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
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

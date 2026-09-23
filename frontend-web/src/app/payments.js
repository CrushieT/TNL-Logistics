import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import SearchFilterBar from '../components/common/SearchFilterBar';
import Toast from '../components/common/Toast';
import {
  PaymentsTable,
  RecordPaymentModal,
  PaymentHistoryModal,
  listPaymentShipments,
  recordPayment,
} from '../features/payments';
import { subscribeRealtimeEvents } from '../services/api/sseClient';
import { colors, fonts, spacing, radius, type } from '../theme';

const PAYMENT_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Payment: All' },
  { value: 'Unpaid', label: 'Payment: Unpaid' },
  { value: 'Partial', label: 'Payment: Partial' },
  { value: 'Paid', label: 'Payment: Paid' },
];

export default function PaymentsScreen() {
  const [shipments, setShipments] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Modal & Toast State
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isRecordModalVisible, setIsRecordModalVisible] = useState(false);
  const [historyShipment, setHistoryShipment] = useState(null);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [toast, setToast] = useState(null);

  const searchDebounceTimer = useRef(null);
  const filtersRef = useRef({
    page,
    pageSize,
    search,
    paymentFilter,
  });

  useEffect(() => {
    filtersRef.current = {
      page,
      pageSize,
      search,
      paymentFilter,
    };
  }, [page, pageSize, search, paymentFilter]);

  // Fetch paginated shipments with financial rollups
  const fetchShipmentsData = useCallback(
    async (currPage, currSize, currSearch, currPayment, showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);

        const params = {
          page: currPage,
          size: currSize,
        };

        if (currSearch && currSearch.trim()) {
          params.search = currSearch.trim();
        }

        if (currPayment && currPayment !== 'ALL') {
          params.paymentStatus = currPayment;
        }

        const data = await listPaymentShipments(params);

        if (data && data.content) {
          setShipments(data.content);
          setTotalPages(data.page?.totalPages ?? data.totalPages ?? 1);
          setTotalElements(data.page?.totalElements ?? data.totalElements ?? data.content.length);

          // Calculate total outstanding balance from uncollected items
          const sumOutstanding = data.content.reduce((acc, item) => {
            const bal = Number(item.balance || 0);
            return acc + (bal > 0 ? bal : 0);
          }, 0);
          setTotalOutstanding(sumOutstanding);
        } else if (Array.isArray(data)) {
          setShipments(data);
          setTotalPages(1);
          setTotalElements(data.length);
          const sumOutstanding = data.reduce((acc, item) => {
            const bal = Number(item.balance || 0);
            return acc + (bal > 0 ? bal : 0);
          }, 0);
          setTotalOutstanding(sumOutstanding);
        } else {
          setShipments([]);
          setTotalPages(1);
          setTotalElements(0);
          setTotalOutstanding(0);
        }
      } catch (err) {
        console.error('Failed to fetch payments data:', err);
        setToast({ type: 'error', message: 'Failed to load payments data.' });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    fetchShipmentsData(page, pageSize, search, paymentFilter, true);
  }, [page, pageSize, paymentFilter]);

  // Debounced search
  const handleSearchChange = (text) => {
    setSearch(text);
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    searchDebounceTimer.current = setTimeout(() => {
      setPage(0);
      fetchShipmentsData(0, pageSize, text, paymentFilter, false);
    }, 300);
  };

  const handlePaymentFilterChange = (filterVal) => {
    setPaymentFilter(filterVal);
    setPage(0);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(0);
  };

  // Real-time SSE subscription + Window focus listener + Visible-tab periodic fallback
  useEffect(() => {
    const handleSilentRefresh = () => {
      const { page: p, pageSize: ps, search: s, paymentFilter: pf } = filtersRef.current;
      fetchShipmentsData(p, ps, s, pf, false);
    };

    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (
        event.type === 'PAYMENT_RECORDED' ||
        event.type === 'SHIPMENT_CREATED' ||
        event.type === 'STATUS_UPDATE' ||
        event.type === 'LABEL_PRINTED'
      ) {
        handleSilentRefresh();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSilentRefresh);
    }

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleSilentRefresh();
      }
    }, 30000);

    return () => {
      if (unsubscribe) unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSilentRefresh);
      }
      clearInterval(intervalId);
    };
  }, [fetchShipmentsData]);

  // Open Record Payment Modal
  const handleOpenRecordModal = (shipment) => {
    setSelectedShipment(shipment);
    setIsRecordModalVisible(true);
  };

  // Open Payment History Modal
  const handleOpenHistoryModal = (shipment) => {
    setHistoryShipment(shipment);
    setIsHistoryModalVisible(true);
  };

  // Submit Payment Record
  const handleSubmitPayment = async (payload) => {
    await recordPayment(payload);
    const amountVal = payload.amountPaid ?? payload.amount ?? 0;
    setToast({
      type: 'success',
      message: `Payment of ₱${Number(amountVal).toLocaleString()} recorded for ${payload.shipmentId}.`,
    });
    // Refresh table immediately
    fetchShipmentsData(page, pageSize, search, paymentFilter, false);
  };

  const formattedOutstanding = `₱${Number(totalOutstanding || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

  return (
    <AppShell activeRoute="/payments">
      {/* Toast Feedback */}
      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {/* Main Container */}
      <View style={styles.container}>
        {/* Header Row: Title & Subtitle on Left, Outstanding Metric Card on Right */}
        <PageHeader
          eyebrow="BILLING & FINANCE"
          title="Payments"
          right={
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>OUTSTANDING</Text>
              <Text style={styles.metricValue}>{formattedOutstanding}</Text>
            </View>
          }
        />

        {/* Filter Toolbar */}
        <SearchFilterBar
          searchValue={search}
          onSearchChange={handleSearchChange}
          placeholder="Search shipments..."
          filters={[
            {
              label: 'Payment',
              value: paymentFilter,
              onChange: handlePaymentFilterChange,
              options: PAYMENT_FILTER_OPTIONS,
            },
          ]}
        />

        {/* Payments Table */}
        <PaymentsTable
          shipments={shipments}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onRecordPayment={handleOpenRecordModal}
          onViewHistory={handleOpenHistoryModal}
        />
      </View>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        visible={isRecordModalVisible}
        shipment={selectedShipment}
        onClose={() => {
          setIsRecordModalVisible(false);
          setSelectedShipment(null);
        }}
        onSubmitPayment={handleSubmitPayment}
      />

      {/* Payment History Modal */}
      <PaymentHistoryModal
        visible={isHistoryModalVisible}
        shipment={historyShipment}
        onClose={() => {
          setIsHistoryModalVisible(false);
          setHistoryShipment(null);
        }}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerLeft: {
    gap: 4,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'flex-end',
    minWidth: 140,
  },
  metricLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '800',
    color: '#DC2626',
  },
});

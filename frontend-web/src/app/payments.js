import PreviewStatus from '../components/common/PreviewStatus';
import { TableRowSkeleton, SkeletonBlock } from '../components/common/Skeleton';
import { useCachedPreview, requirePage } from '../services/api/useCachedPreview';
import { CACHE_SLOTS } from '../services/api/responseCache.mjs';
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import { colors, fonts, spacing, radius, type } from '../theme';

const PAYMENT_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Payment: All' },
  { value: 'Unpaid', label: 'Payment: Unpaid' },
  { value: 'Partial', label: 'Payment: Partial' },
  { value: 'Paid', label: 'Payment: Paid' },
  { value: 'Settled', label: 'Payment: Settled' },
];

export default function PaymentsScreen() {

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Modal & Toast State
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isRecordModalVisible, setIsRecordModalVisible] = useState(false);
  const [historyShipment, setHistoryShipment] = useState(null);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [toast, setToast] = useState(null);

  const query = { page, size: pageSize, search: search.trim(), paymentStatus: paymentFilter === 'ALL' ? undefined : paymentFilter };
  const resource = useCachedPreview({ slot: CACHE_SLOTS.PAYMENTS, query, pollMs: 30000,
    fetcher: async signal => requirePage(await listPaymentShipments(query, { signal })) });
  const shipments = Array.isArray(resource.data) ? resource.data : resource.data?.content || [];
  const loading = resource.loading;
  const totalPages = resource.data?.page?.totalPages ?? resource.data?.totalPages ?? 1;
  const totalElements = resource.data?.page?.totalElements ?? resource.data?.totalElements ?? shipments.length;
  const totalOutstanding = shipments.reduce((sum, item) => sum + Math.max(0, Number(item.collectibleBalance ?? item.balance ?? 0)), 0);
  const handleSearchChange = value => { setSearch(value); setPage(0); };
  const handlePaymentFilterChange = value => { setPaymentFilter(value); setPage(0); };
  const handlePageSizeChange = value => { setPageSize(value); setPage(0); };

  // Open Record Payment Modal
  const handleOpenRecordModal = (shipment) => {
    if (!resource.isCurrent()) return;
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
    if (!resource.isCurrent()) throw new Error('Refresh the payment list before recording.');
    await recordPayment(payload);
    const amountVal = payload.amountPaid ?? payload.amount ?? 0;
    setToast({
      type: 'success',
      message: `Payment of ₱${Number(amountVal).toLocaleString()} recorded for ${payload.shipmentId}.`,
    });
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
              {resource.data === null ? <SkeletonBlock width={100} height={24} /> : <Text style={styles.metricValue}>{formattedOutstanding}</Text>}
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
        <PreviewStatus resource={resource} label="Payments" />
        {loading ? <TableRowSkeleton /> : resource.data !== null ? <PaymentsTable
          shipments={shipments}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          canRecordPayment={resource.isFresh}
          onRecordPayment={handleOpenRecordModal}
          onViewHistory={handleOpenHistoryModal}
        /> : null}
      </View>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        visible={isRecordModalVisible}
        shipment={selectedShipment}
        onClose={() => {
          setIsRecordModalVisible(false);
          setSelectedShipment(null);
        }}
        canRecordPayment={resource.isFresh}
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

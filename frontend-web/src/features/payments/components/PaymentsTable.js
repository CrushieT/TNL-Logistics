import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import StatusBadge from '../../../components/common/StatusBadge';
import Button from '../../../components/common/Button';
import { colors, fonts, spacing, radius } from '../../../theme';

const COLUMNS = [
  { key: 'shipment', label: 'SHIPMENT', flex: 1.3 },
  { key: 'client', label: 'CLIENT', flex: 1.6 },
  { key: 'qty', label: 'QTY', flex: 0.5, align: 'center' },
  { key: 'amountDue', label: 'AMOUNT DUE', flex: 1.0, align: 'flex-end' },
  { key: 'paid', label: 'PAID', flex: 1.0, align: 'flex-end' },
  { key: 'balance', label: 'BALANCE', flex: 1.0, align: 'flex-end' },
  { key: 'status', label: 'STATUS', flex: 1.0 },
  { key: 'action', label: '', flex: 1.4, align: 'flex-end' },
];

export default function PaymentsTable({
  shipments = [],
  loading = false,
  page = 0,
  totalPages = 1,
  totalElements = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  onRecordPayment,
  onViewHistory,
}) {
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.table}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        {COLUMNS.map((col) => (
          <Text
            key={col.key}
            style={[
              styles.headerCell,
              { flex: col.flex },
              col.align === 'center' && styles.alignCenter,
              col.align === 'flex-end' && styles.alignRight,
            ]}
          >
            {col.label}
          </Text>
        ))}
      </View>

      {/* Table Body */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.ink} size="small" />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      ) : shipments.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No shipments found</Text>
          <Text style={styles.emptySub}>
            Try adjusting your search keywords or payment filter.
          </Text>
        </View>
      ) : (
        shipments.map((s, idx) => {
          const totalAmountNum = Number(s.totalAmount ?? s.amountDue ?? 0);
          const paidNum = Number(s.amountPaid ?? s.paid ?? 0);
          const balanceNum = s.balance !== undefined && s.balance !== null
            ? Number(s.balance)
            : Math.max(0, totalAmountNum - paidNum);
          const isSettled = balanceNum <= 0 || (s.payment && s.payment.toLowerCase() === 'paid');

          return (
            <View
              key={s.shipmentId}
              style={[
                styles.row,
                idx !== shipments.length - 1 && styles.rowDivider,
              ]}
            >
              {/* Shipment ID */}
              <View style={[styles.cell, { flex: COLUMNS[0].flex }]}>
                <Text style={styles.shipmentId}>{s.shipmentId}</Text>
              </View>

              {/* Client Name */}
              <View style={[styles.cell, { flex: COLUMNS[1].flex }]}>
                <Text style={styles.clientName}>{s.clientName || s.client || '—'}</Text>
              </View>

              {/* Quantity */}
              <View style={[styles.cell, { flex: COLUMNS[2].flex, alignItems: 'center' }]}>
                <Text style={styles.qtyText}>{s.quantity || 1}</Text>
              </View>

              {/* Amount Due */}
              <View style={[styles.cell, { flex: COLUMNS[3].flex, alignItems: 'flex-end' }]}>
                <Text style={styles.amountDueText}>{formatCurrency(totalAmountNum)}</Text>
              </View>

              {/* Paid Amount */}
              <View style={[styles.cell, { flex: COLUMNS[4].flex, alignItems: 'flex-end' }]}>
                <Text style={styles.paidText}>{formatCurrency(paidNum)}</Text>
              </View>

              {/* Balance */}
              <View style={[styles.cell, { flex: COLUMNS[5].flex, alignItems: 'flex-end' }]}>
                <Text style={styles.balanceText}>{formatCurrency(balanceNum)}</Text>
              </View>

              {/* Payment Status Badge */}
              <View style={[styles.cell, { flex: COLUMNS[6].flex }]}>
                <StatusBadge value={s.payment || 'Unpaid'} kind="payment" />
              </View>

              {/* Action Column */}
              <View style={[styles.cell, { flex: COLUMNS[7].flex, alignItems: 'flex-end' }]}>
                <View style={styles.actionGroup}>
                  <View style={styles.viewSlot}>
                    <Pressable
                      onPress={() => onViewHistory?.(s)}
                      style={({ hovered }) => [
                        styles.viewActionBtn,
                        hovered && styles.viewActionBtnHovered,
                      ]}
                    >
                      <Text style={styles.viewActionText}>View</Text>
                    </Pressable>
                  </View>

                  <View style={styles.recordSlot}>
                    {isSettled ? (
                      <View style={styles.settledTag}>
                        <Text style={styles.settledText}>Settled</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => onRecordPayment?.(s)}
                        style={({ hovered }) => [
                          styles.recordActionBtn,
                          hovered && styles.recordActionBtnHovered,
                        ]}
                      >
                        <Text style={styles.recordActionText}>Record →</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Pagination Footer */}
      <View style={styles.paginationFooter}>
        <View style={styles.paginationMeta}>
          <Text style={styles.paginationText}>
            Showing <Text style={styles.paginationStrong}>{shipments.length}</Text> of{' '}
            <Text style={styles.paginationStrong}>{totalElements}</Text> shipments · Page{' '}
            <Text style={styles.paginationStrong}>{page + 1}</Text> of{' '}
            <Text style={styles.paginationStrong}>{totalPages || 1}</Text>
          </Text>
        </View>

        <View style={styles.paginationControls}>
          {/* Page Size Dropdown on Web */}
          {Platform.OS === 'web' && onPageSizeChange ? (
            <View style={styles.pageSizeSelectWrap}>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                style={webPageSizeStyle}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </View>
          ) : null}

          {/* Navigation Buttons */}
          <Button
            label="Previous"
            variant="outline"
            disabled={page <= 0 || loading}
            onPress={() => onPageChange?.(page - 1)}
            style={styles.pageBtn}
          />
          <Button
            label="Next"
            variant="outline"
            disabled={page >= totalPages - 1 || loading}
            onPress={() => onPageChange?.(page + 1)}
            style={styles.pageBtn}
          />
        </View>
      </View>
    </View>
  );
}

const webPageSizeStyle = {
  fontFamily: fonts.mono,
  fontSize: 11.5,
  color: colors.inkSoft,
  backgroundColor: '#FAF9F5',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: '5px 8px',
  outline: 'none',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  table: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerCell: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  alignCenter: {
    textAlign: 'center',
  },
  alignRight: {
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: {
    justifyContent: 'center',
  },
  shipmentId: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  clientName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  qtyText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
  },
  amountDueText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  paidText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.inkSoft,
  },
  balanceText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  settledTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settledText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    fontWeight: '500',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 156,
    gap: 8,
  },
  viewSlot: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordSlot: {
    width: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAF9F5',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  viewActionBtnHovered: {
    backgroundColor: '#EBE9E1',
    borderColor: colors.borderStrong,
  },
  viewActionText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  recordActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  recordActionBtnHovered: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FDBA74',
  },
  recordActionText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
  },
  paginationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FAF9F5',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  paginationStrong: {
    fontWeight: '700',
    color: colors.ink,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageSizeSelectWrap: {
    marginRight: spacing.xs,
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import StatusBadge from '../../../components/common/StatusBadge';
import Button from '../../../components/common/Button';
import { colors, fonts, spacing, radius } from '../../../theme';

const COLUMNS = [
  { key: 'shipment', label: 'Shipment', flex: 1.6 },
  { key: 'recipient', label: 'Recipient', flex: 1.4 },
  { key: 'client', label: 'Client', flex: 1.4 },
  { key: 'qty', label: 'Qty', flex: 0.6 },
  { key: 'status', label: 'Status', flex: 1.6 },
  { key: 'payment', label: 'Payment', flex: 1 },
  { key: 'balance', label: 'Balance', flex: 1 },
  { key: 'action', label: '', flex: 0.7 },
];

export default function ShipmentsTable({
  shipments = [],
  loading = false,
  page = 0,
  totalPages = 1,
  totalElements = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  onView,
}) {
  return (
    <View style={styles.table}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        {COLUMNS.map((col) => (
          <Text key={col.key} style={[styles.headerCell, { flex: col.flex }]}>
            {col.label}
          </Text>
        ))}
      </View>

      {/* Loading Overlay or State */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.ink} size="small" />
          <Text style={styles.loadingText}>Loading shipments...</Text>
        </View>
      ) : shipments.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No shipments found</Text>
          <Text style={styles.emptySub}>
            Try changing your search query or filter selection.
          </Text>
        </View>
      ) : (
        /* Shipment Data Rows */
        shipments.map((s, idx) => (
          <View key={s.shipmentId} style={[styles.row, idx !== shipments.length - 1 && styles.rowDivider]}>
            <View style={[styles.cell, { flex: COLUMNS[0].flex }]}>
              <Text style={styles.shipmentId}>{s.shipmentId}</Text>
              <Text style={styles.dateLabel}>{s.dateLabel}</Text>
            </View>
            <View style={[styles.cell, { flex: COLUMNS[1].flex }]}>
              <Text style={styles.primaryText}>{s.recipientName}</Text>
              <Text style={styles.secondaryText}>{s.recipientContact}</Text>
            </View>
            <View style={[styles.cell, { flex: COLUMNS[2].flex }]}>
              <Text style={styles.primaryText}>{s.clientName || s.client}</Text>
            </View>
            <View style={[styles.cell, { flex: COLUMNS[3].flex }]}>
              <Text style={styles.primaryText}>{s.quantity} pcs</Text>
            </View>
            <View style={[styles.cell, { flex: COLUMNS[4].flex }]}>
              <StatusBadge value={s.status} kind="status" />
              {s.statusRollup ? <Text style={styles.rollupText}>{s.statusRollup}</Text> : null}
            </View>
            <View style={[styles.cell, { flex: COLUMNS[5].flex }]}>
              <StatusBadge value={s.payment} kind="payment" />
            </View>
            <View style={[styles.cell, { flex: COLUMNS[6].flex }]}>
              <Text style={styles.primaryText}>₱{Number(s.balance || 0).toLocaleString()}</Text>
            </View>
            <View style={[styles.cell, { flex: COLUMNS[7].flex, alignItems: 'flex-end' }]}>
              <Pressable onPress={() => onView?.(s)}>
                <Text style={styles.viewLink}>View →</Text>
              </Pressable>
            </View>
          </View>
        ))
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

        <View style={styles.paginationActions}>
          {/* Page Size Selector */}
          {Platform.OS === 'web' ? (
            <View style={styles.pageSizeSelectWrap}>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                style={webSelectStyle}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </View>
          ) : null}

          {/* Previous Button */}
          <Button
            label="← Previous"
            variant="secondary"
            disabled={page <= 0 || loading}
            onPress={() => onPageChange?.(page - 1)}
            style={styles.pageBtn}
          />

          {/* Next Button */}
          <Button
            label="Next →"
            variant="secondary"
            disabled={page >= totalPages - 1 || loading}
            onPress={() => onPageChange?.(page + 1)}
            style={styles.pageBtn}
          />
        </View>
      </View>
    </View>
  );
}

const webSelectStyle = {
  fontFamily: fonts.mono,
  fontSize: 11.5,
  color: colors.ink,
  border: `1px solid ${colors.border}`,
  backgroundColor: '#FFFFFF',
  padding: '6px 8px',
  borderRadius: 3,
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
    backgroundColor: colors.canvas,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCell: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
  },
  emptyBox: {
    paddingVertical: spacing.xxl,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
  },
  dateLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  primaryText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500',
  },
  secondaryText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: 2,
  },
  rollupText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 3,
  },
  viewLink: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.accent,
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  paginationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  paginationStrong: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.ink,
  },
  paginationActions: {
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
    minHeight: 32,
  },
});

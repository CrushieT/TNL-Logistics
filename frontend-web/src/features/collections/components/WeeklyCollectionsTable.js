import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius } from '../../../theme';
import { formatCurrency } from '../utils/collectionsUtils';

const COLLECTION_STATUS_STYLES = {
  READY_FOR_SOA: {
    fg: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
    dot: '#D97706',
    label: 'Ready for SOA',
  },
  SOA_GENERATED: {
    fg: '#1D4ED8',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    dot: '#2563EB',
    label: 'SOA Generated',
  },
  SETTLED: {
    fg: '#15803D',
    bg: '#F0FDF4',
    border: '#86EFAC',
    dot: '#16A34A',
    label: 'Settled',
  },
};

export default function WeeklyCollectionsTable({
  items = [],
  loading = false,
  onReviewClient,
  onGenerateClientSoa,
}) {
  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.tableHeader}>
          <Text style={[styles.thCell, { flex: 2.2 }]}>CLIENT</Text>
          <Text style={[styles.thCell, { flex: 1.2, textAlign: 'center' }]}>SHIPMENTS</Text>
          <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>TOTAL CHARGES</Text>
          <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>PAID</Text>
          <Text style={[styles.thCell, { flex: 1.1, textAlign: 'right' }]}>DEDUCTIONS</Text>
          <Text style={[styles.thCell, { flex: 1.3, textAlign: 'right' }]}>BALANCE</Text>
          <Text style={[styles.thCell, { flex: 1.3, textAlign: 'center' }]}>STATUS</Text>
          <Text style={[styles.thCell, { width: 170, textAlign: 'right', paddingRight: 10 }]}>ACTION</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.ink} style={{ marginBottom: 10 }} />
          <Text style={styles.loadingText}>Loading collection data...</Text>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.tableHeader}>
          <Text style={[styles.thCell, { flex: 2.2 }]}>CLIENT</Text>
          <Text style={[styles.thCell, { flex: 1.2, textAlign: 'center' }]}>SHIPMENTS</Text>
          <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>TOTAL CHARGES</Text>
          <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>PAID</Text>
          <Text style={[styles.thCell, { flex: 1.1, textAlign: 'right' }]}>DEDUCTIONS</Text>
          <Text style={[styles.thCell, { flex: 1.3, textAlign: 'right' }]}>BALANCE</Text>
          <Text style={[styles.thCell, { flex: 1.3, textAlign: 'center' }]}>STATUS</Text>
          <Text style={[styles.thCell, { width: 170, textAlign: 'right', paddingRight: 10 }]}>ACTION</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No clients found matching the search criteria.</Text>
          <Text style={styles.emptySubText}>
            Try selecting a different Thursday cycle or clearing active filters.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thCell, { flex: 2.2 }]}>CLIENT</Text>
        <Text style={[styles.thCell, { flex: 1.2, textAlign: 'center' }]}>SHIPMENTS</Text>
        <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>TOTAL CHARGES</Text>
        <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>PAID</Text>
        <Text style={[styles.thCell, { flex: 1.1, textAlign: 'right' }]}>DEDUCTIONS</Text>
        <Text style={[styles.thCell, { flex: 1.3, textAlign: 'right' }]}>BALANCE</Text>
        <Text style={[styles.thCell, { flex: 1.3, textAlign: 'center' }]}>STATUS</Text>
        <Text style={[styles.thCell, { width: 170, textAlign: 'right', paddingRight: 10 }]}>ACTION</Text>
      </View>

      {/* Table Rows */}
      {items.map((item, idx) => {
        const statusKey = item.status || (item.unbilledShipmentsCount > 0 ? 'READY_FOR_SOA' : 'SETTLED');
        const statusConfig = COLLECTION_STATUS_STYLES[statusKey] || COLLECTION_STATUS_STYLES.READY_FOR_SOA;
        const currentCharges = Number(item.currentCharges || item.totalCharges || 0);
        const paidAmount = Number(item.paid ?? item.totalPaid ?? item.amountPaid ?? 0);
        const balance = Number(item.balance ?? item.netAmountDue ?? 0);
        const shipmentsCount = item.shipmentsCount ?? item.unbilledShipmentsCount ?? 0;

        return (
          <View
            key={item.clientId || idx}
            style={[
              styles.tableRow,
              idx !== items.length - 1 && styles.rowDivider,
            ]}
          >
            {/* Client Info */}
            <View style={{ flex: 2.2 }}>
              <View style={styles.clientTitleRow}>
                <Text style={styles.clientNameText} numberOfLines={1}>
                  {item.clientName || 'Client'}
                </Text>
                {item.clientCode ? (
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{item.clientCode}</Text>
                  </View>
                ) : null}
              </View>
              {item.statementId ? (
                <Text style={styles.statementTag}>
                  SOA: {item.statementId}
                </Text>
              ) : item.contactNumber ? (
                <Text style={styles.clientContactText} numberOfLines={1}>
                  {item.contactNumber}
                </Text>
              ) : null}
            </View>

            {/* Shipments Count */}
            <View style={{ flex: 1.2, alignItems: 'center' }}>
              <View style={styles.unbilledBadge}>
                <Text style={styles.unbilledBadgeText}>
                  {shipmentsCount}
                </Text>
              </View>
            </View>

            {/* Charges */}
            <Text style={[styles.tdCell, styles.monoCell, { flex: 1.2, textAlign: 'right' }]}>
              {formatCurrency(currentCharges)}
            </Text>

            {/* Paid */}
            <Text style={[styles.tdCell, styles.monoCell, { flex: 1.2, textAlign: 'right', color: paidAmount > 0 ? '#15803D' : colors.inkSoft }]}>
              {formatCurrency(paidAmount)}
            </Text>

            {/* Deductions */}
            <Text
              style={[
                styles.tdCell,
                styles.monoCell,
                {
                  flex: 1.1,
                  textAlign: 'right',
                  color: Number(item.totalDeductions) > 0 ? '#DC2626' : colors.inkFaint,
                },
              ]}
            >
              {Number(item.totalDeductions) > 0 ? `-${formatCurrency(item.totalDeductions)}` : '—'}
            </Text>

            {/* Balance */}
            <Text
              style={[
                styles.tdCell,
                styles.monoCell,
                styles.netDueText,
                {
                  flex: 1.3,
                  textAlign: 'right',
                  color: balance > 0 ? '#DC2626' : '#15803D',
                },
              ]}
            >
              {formatCurrency(balance)}
            </Text>

            {/* Status Pill */}
            <View style={{ flex: 1.3, alignItems: 'center' }}>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: statusConfig.dot }]}
                />
                <Text style={[styles.statusPillText, { color: statusConfig.fg }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>

            {/* Actions Slot */}
            <View style={styles.actionGroup}>
              {item.statementId || statusKey === 'SOA_GENERATED' ? (
                <Pressable
                  onPress={() => onReviewClient?.(item, 'VIEW_SOA')}
                  style={({ hovered }) => [
                    styles.viewSoaBtn,
                    hovered && styles.viewSoaBtnHovered,
                  ]}
                >
                  <Text style={styles.viewSoaBtnText}>View SOA</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => onReviewClient?.(item, 'GENERATE_SOA')}
                  style={({ hovered }) => [
                    styles.reviewBtn,
                    hovered && styles.reviewBtnHovered,
                  ]}
                >
                  <Text style={styles.reviewBtnText}>Generate SOA →</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    minHeight: 380,
    zIndex: 1,
    position: 'relative',
  },
  loadingContainer: {
    minHeight: 280,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
  },
  emptyContainer: {
    minHeight: 280,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 4,
  },
  emptySubText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FCFBFA',
  },
  thCell: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clientTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clientNameText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  codeBadge: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  codeBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  clientContactText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  unbilledBadge: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unbilledBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  tdCell: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
  },
  monoCell: {
    fontFamily: fonts.mono,
  },
  netDueText: {
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  statementTag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    marginTop: 2,
  },
  actionGroup: {
    width: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  reviewBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  reviewBtnHovered: {
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  reviewBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  viewSoaBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  viewSoaBtnHovered: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  viewSoaBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});

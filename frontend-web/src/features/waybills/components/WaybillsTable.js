import React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import { colors, fonts, radius, spacing } from '../../../theme';

const COLUMNS = [
  { key: 'waybill', label: 'WAYBILL', flex: 1.5 },
  { key: 'shipment', label: 'SHIPMENT', flex: 1.2 },
  { key: 'parties', label: 'CLIENT / RECIPIENT', flex: 1.8 },
  { key: 'destination', label: 'DESTINATION', flex: 1.5 },
  { key: 'quantity', label: 'QTY', flex: 0.6 },
  { key: 'hauler', label: 'HAULER', flex: 1.3 },
  { key: 'status', label: 'STATUS', flex: 1.3 },
  { key: 'action', label: '', flex: 0.6 },
];

export default function WaybillsTable({
  waybills = [],
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
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scrollContent}>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          {COLUMNS.map((column) => (
            <Text key={column.key} style={[styles.headerCell, { flex: column.flex }]}>
              {column.label}
            </Text>
          ))}
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.ink} size="small" />
            <Text style={styles.stateText}>Loading waybills...</Text>
          </View>
        ) : waybills.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.emptyTitle}>No waybills found</Text>
            <Text style={styles.stateText}>Try changing your search query or filter selection.</Text>
          </View>
        ) : (
          waybills.map((waybill, index) => (
            <Pressable
              key={waybill.waybillId}
              accessibilityRole="link"
              accessibilityLabel={`View waybill ${waybill.waybillId}`}
              onPress={() => onView?.(waybill)}
              style={({ hovered, pressed }) => [
                styles.row,
                index !== waybills.length - 1 && styles.rowDivider,
                (hovered || pressed) && styles.rowActive,
              ]}
            >
              <View style={[styles.cell, { flex: COLUMNS[0].flex }]}>
                <Text style={styles.identifier}>{waybill.waybillId}</Text>
                <Text style={styles.secondaryText}>{waybill.generatedDate || '-'}</Text>
              </View>
              <View style={[styles.cell, { flex: COLUMNS[1].flex }]}>
                <Text style={styles.identifierSmall}>{waybill.shipmentId}</Text>
              </View>
              <View style={[styles.cell, { flex: COLUMNS[2].flex }]}>
                <Text style={styles.primaryText} numberOfLines={1}>{waybill.clientName || '-'}</Text>
                <Text style={styles.secondaryText} numberOfLines={1}>{waybill.recipientName || '-'}</Text>
              </View>
              <View style={[styles.cell, { flex: COLUMNS[3].flex }]}>
                <Text style={styles.primaryText} numberOfLines={2}>{waybill.destination || '-'}</Text>
              </View>
              <View style={[styles.cell, { flex: COLUMNS[4].flex }]}>
                <Text style={styles.identifierSmall}>{waybill.quantity ?? 0}</Text>
              </View>
              <View style={[styles.cell, { flex: COLUMNS[5].flex }]}>
                <Text style={styles.primaryText} numberOfLines={2}>{waybill.haulerName || '-'}</Text>
              </View>
              <View style={[styles.cell, { flex: COLUMNS[6].flex }]}>
                <StatusBadge value={waybill.statusLabel || waybill.status} kind="waybill" />
              </View>
              <View style={[styles.cell, styles.actionCell, { flex: COLUMNS[7].flex }]}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`View waybill ${waybill.waybillId}`}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onView?.(waybill);
                  }}
                >
                  <Text style={styles.viewLink}>View</Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}

        <View style={styles.paginationFooter}>
          <Text style={styles.paginationText}>
            Showing <Text style={styles.paginationStrong}>{waybills.length}</Text> of{' '}
            <Text style={styles.paginationStrong}>{totalElements}</Text> waybills | Page{' '}
            <Text style={styles.paginationStrong}>{page + 1}</Text> of{' '}
            <Text style={styles.paginationStrong}>{totalPages || 1}</Text>
          </Text>

          <View style={styles.paginationActions}>
            {Platform.OS === 'web' ? (
              <select
                aria-label="Waybills per page"
                value={pageSize}
                onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
                style={webSelectStyle}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            ) : null}
            <Button
              label="Previous"
              variant="secondary"
              disabled={page <= 0 || loading}
              onPress={() => onPageChange?.(page - 1)}
              style={styles.pageButton}
            />
            <Button
              label="Next"
              variant="secondary"
              disabled={page >= totalPages - 1 || loading}
              onPress={() => onPageChange?.(page + 1)}
              style={styles.pageButton}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const webSelectStyle = {
  fontFamily: fonts.mono,
  fontSize: 12.5,
  color: colors.inkSoft,
  backgroundColor: '#FAF9F5',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: '6px 10px',
  outline: 'none',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  table: {
    minWidth: 1120,
    flex: 1,
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCell: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.inkFaint,
  },
  stateBox: {
    minHeight: 150,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stateText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSoft },
  emptyTitle: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '700', color: colors.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    cursor: 'pointer',
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowActive: { backgroundColor: '#FAF9F5' },
  cell: { justifyContent: 'center', paddingRight: spacing.sm },
  actionCell: { alignItems: 'flex-end', paddingRight: 0 },
  identifier: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '800', color: colors.ink },
  identifierSmall: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '600', color: colors.ink },
  primaryText: { fontFamily: fonts.sans, fontSize: 13.5, fontWeight: '600', color: colors.ink },
  secondaryText: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  viewLink: { fontFamily: fonts.sans, fontSize: 13, fontWeight: '600', color: colors.accent },
  paginationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#FAF9F5',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationText: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.inkSoft },
  paginationStrong: { fontFamily: fonts.mono, fontWeight: '700', color: colors.ink },
  paginationActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageButton: { paddingVertical: 6, paddingHorizontal: 12 },
});

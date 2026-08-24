import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import StatusBadge from './common/StatusBadge';
import { colors, fonts, spacing } from '../constants/theme';

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

/**
 * shipments: [{
 *   shipmentId, dateLabel, recipientName, contactNumber, client, quantity,
 *   status, statusRollup, payment, balance
 * }]
 */
export default function ShipmentsTable({ shipments = [], onView }) {
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        {COLUMNS.map((col) => (
          <Text key={col.key} style={[styles.headerCell, { flex: col.flex }]}>
            {col.label}
          </Text>
        ))}
      </View>

      {shipments.map((s, idx) => (
        <View key={s.shipmentId} style={[styles.row, idx !== shipments.length - 1 && styles.rowDivider]}>
          <View style={[styles.cell, { flex: COLUMNS[0].flex }]}>
            <Text style={styles.shipmentId}>{s.shipmentId}</Text>
            <Text style={styles.dateLabel}>{s.dateLabel}</Text>
          </View>
          <View style={[styles.cell, { flex: COLUMNS[1].flex }]}>
            <Text style={styles.primaryText}>{s.recipientName}</Text>
            <Text style={styles.secondaryText}>{s.contactNumber}</Text>
          </View>
          <View style={[styles.cell, { flex: COLUMNS[2].flex }]}>
            <Text style={styles.primaryText}>{s.client}</Text>
          </View>
          <View style={[styles.cell, { flex: COLUMNS[3].flex }]}>
            <Text style={styles.primaryText}>{s.quantity}</Text>
          </View>
          <View style={[styles.cell, { flex: COLUMNS[4].flex }]}>
            <StatusBadge value={s.status} kind="status" />
            {s.statusRollup ? <Text style={styles.rollupText}>{s.statusRollup}</Text> : null}
          </View>
          <View style={[styles.cell, { flex: COLUMNS[5].flex }]}>
            <StatusBadge value={s.payment} kind="payment" showDot={false} />
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
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
});

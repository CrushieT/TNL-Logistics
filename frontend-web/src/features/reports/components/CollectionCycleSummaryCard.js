import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../../theme';

/**
 * Collection cycle table card matching prototype report page.png:
 * "THIS THURSDAY'S COLLECTION SUMMARY"
 */
export default function CollectionCycleSummaryCard({ collectionSummary }) {
  const router = useRouter();

  const items = collectionSummary?.items || [];

  // Filter or show clients with active shipments or outstanding balance
  const activeClients = items.filter(
    (item) => (item.shipmentsCount || 0) > 0 || Number(item.balance || item.currentCharges || 0) > 0
  );

  const totalShipments = activeClients.reduce((sum, item) => sum + (item.shipmentsCount || 0), 0);
  const totalOutstanding = activeClients.reduce(
    (sum, item) => sum + Number(item.balance || item.currentCharges || 0),
    0
  );

  const formatCurrency = (amount) =>
    `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <View style={styles.card}>
      {/* Header with Title and Link */}
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>THIS THURSDAY'S COLLECTION SUMMARY</Text>
        <TouchableOpacity
          onPress={() => router.push('/weekly-collections')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>View Collections →</Text>
        </TouchableOpacity>
      </View>

      {/* Table Container */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.headerCell, styles.clientCol]}>CLIENT</Text>
          <Text style={[styles.headerCell, styles.shipmentsCol]}>SHIPMENTS</Text>
          <Text style={[styles.headerCell, styles.outstandingCol]}>OUTSTANDING</Text>
        </View>

        {/* Table Body */}
        {activeClients.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No active collections for the current cycle</Text>
          </View>
        ) : (
          activeClients.map((item, idx) => (
            <View key={item.clientId || idx} style={styles.tableRow}>
              <Text style={[styles.cellText, styles.clientCol, styles.clientName]} numberOfLines={1}>
                {item.clientName || 'Unknown Client'}
              </Text>
              <Text style={[styles.cellText, styles.shipmentsCol, styles.shipmentsText]}>
                {item.shipmentsCount || 0}
              </Text>
              <Text style={[styles.cellText, styles.outstandingCol, styles.outstandingText]}>
                {formatCurrency(item.balance || item.currentCharges)}
              </Text>
            </View>
          ))
        )}

        {/* Total Footer Row */}
        {activeClients.length > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.clientCol]}>Total</Text>
            <Text style={[styles.totalValue, styles.shipmentsCol]}>{totalShipments}</Text>
            <Text style={[styles.totalValue, styles.outstandingCol]}>
              {formatCurrency(totalOutstanding)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  cardTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.inkFaint,
    textTransform: 'uppercase',
  },
  linkText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerCell: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
  },
  clientCol: {
    flex: 3,
    textAlign: 'left',
  },
  shipmentsCol: {
    flex: 1.5,
    textAlign: 'center',
  },
  outstandingCol: {
    flex: 2,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F3',
  },
  cellText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
  },
  clientName: {
    fontWeight: '600',
    color: colors.ink,
  },
  shipmentsText: {
    fontFamily: fonts.mono,
    color: colors.inkSoft,
  },
  outstandingText: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.ink,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1.5,
    borderTopColor: colors.borderStrong,
    marginTop: 4,
  },
  totalLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  totalValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  emptyRow: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
});

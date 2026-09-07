import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../theme';

export default function ReportsKpiBar({ kpis, loading }) {
  const formatCurrency = (val) => {
    if (val == null) return '₱0.00';
    return `₱${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const cards = [
    {
      label: 'TOTAL BILLED REVENUE',
      value: formatCurrency(kpis?.totalBilledRevenue),
      sublabel: `${kpis?.totalShipments || 0} shipments billed`,
      accentColor: colors.ink,
    },
    {
      label: 'TOTAL COLLECTED',
      value: formatCurrency(kpis?.totalCollectedRevenue),
      sublabel: 'recorded payments',
      accentColor: colors.success,
    },
    {
      label: 'OUTSTANDING RECEIVABLES',
      value: formatCurrency(kpis?.outstandingReceivables),
      sublabel: 'uncollected balance',
      accentColor: colors.accent,
    },
    {
      label: 'VOLUME HANDLED',
      value: `${(kpis?.totalParcels || 0).toLocaleString()} pcs`,
      sublabel: `across ${kpis?.totalShipments || 0} shipments`,
      accentColor: colors.info,
    },
    {
      label: 'DELIVERY SUCCESS RATE',
      value: `${kpis?.deliveryCompletionRate != null ? kpis.deliveryCompletionRate.toFixed(1) : '0.0'}%`,
      sublabel: 'completed parcels',
      accentColor: '#16A34A',
    },
  ];

  return (
    <View style={styles.container}>
      {cards.map((card, idx) => (
        <View key={idx} style={styles.card}>
          <Text style={styles.label}>{card.label}</Text>
          <Text style={[styles.value, { color: card.accentColor }]}>
            {loading && !kpis ? '—' : card.value}
          </Text>
          <Text style={styles.sublabel}>{card.sublabel}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  card: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  sublabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
  },
});

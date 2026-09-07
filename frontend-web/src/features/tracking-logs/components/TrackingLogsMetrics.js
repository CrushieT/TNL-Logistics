import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../theme';

export default function TrackingLogsMetrics({ metrics, loading }) {
  const stats = [
    {
      label: "TODAY'S SCANS",
      value: metrics ? Number(metrics.todayTotalScans || 0).toLocaleString() : '0',
      accent: false,
    },
    {
      label: 'ACTIVE COURIERS',
      value: metrics ? Number(metrics.activeCouriersCount || 0).toLocaleString() : '0',
      accent: false,
    },
    {
      label: 'LOADED ON TRUCK',
      value: metrics ? Number(metrics.loadedOnTruckToday || 0).toLocaleString() : '0',
      accent: true,
      color: colors.accent,
    },
    {
      label: 'HANDED TO HAULER',
      value: metrics ? Number(metrics.handedToHaulerToday || 0).toLocaleString() : '0',
      accent: false,
      color: colors.info,
    },
  ];

  return (
    <View style={styles.container}>
      {stats.map((stat, idx) => (
        <View key={idx} style={styles.metricCard}>
          <Text style={styles.metricLabel}>{stat.label}</Text>
          <Text style={[styles.metricValue, stat.color ? { color: stat.color } : null]}>
            {loading && !metrics ? '—' : stat.value}
          </Text>
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
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  metricLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
});

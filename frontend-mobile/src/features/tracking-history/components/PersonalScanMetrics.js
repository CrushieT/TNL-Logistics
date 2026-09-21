import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, typography } from '../../../theme';
import { normalizePersonalMetrics } from '../trackingHistoryFlow.mjs';

export function PersonalScanMetrics({ metrics, isLoading = false, error = null, onRetry }) {
  const normalized = normalizePersonalMetrics(metrics);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.metricValue}>{normalized.totalScans}</Text>
          <Text style={styles.metricLabel}>TOTAL SCANS TODAY</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.metricValue}>{normalized.loadedOnTruck}</Text>
          <Text style={styles.metricLabel}>LOADED ON TRUCK</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.metricValue}>{normalized.arrivedAtTnl}</Text>
          <Text style={styles.metricLabel}>ARRIVED AT TNL</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.metricValue}>{normalized.handedToHauler}</Text>
          <Text style={styles.metricLabel}>HANDED TO HAULER</Text>
        </View>
      </View>
      {Boolean(error) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Unable to refresh daily metrics.</Text>
          {Boolean(onRetry) && (
            <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.retryAction}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  retryAction: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

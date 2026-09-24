import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing, radius } from '../../../theme';
import { formatStatusLabel } from '../scannerFlow.mjs';

export default function ScanResultPanel({
  mode,
  singleResult,
  batchResult,
  onScanNext,
  onReturnHome
}) {
  const isSingle = mode === 'SINGLE';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Success Icon Header */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Icon source="check" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.titleText}>
            {isSingle ? 'Scan Processed' : 'Batch Submission Complete'}
          </Text>
        </View>

        {isSingle && singleResult && (
          <View style={styles.card}>
            {/* Tracking ID & Status */}
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>TRACKING ID</Text>
              <Text style={styles.trackingIdText}>{singleResult.trackingId}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>COMMITTED STATUS</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>
                  {formatStatusLabel(singleResult.newStatusCode || singleResult.newStatus)}
                </Text>
              </View>
            </View>

            {singleResult.vehiclePlateNumber && (
              <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
                <Text style={styles.metaLabel}>ASSIGNED VEHICLE</Text>
                <Text style={styles.metaValue}>
                  {singleResult.vehiclePlateNumber} ({singleResult.vehicleId})
                </Text>
              </View>
            )}

            {singleResult.statusRollup && (
              <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
                <Text style={styles.metaLabel}>SHIPMENT ROLLUP</Text>
                <Text style={styles.metaValue}>{singleResult.statusRollup}</Text>
              </View>
            )}

            {/* Idempotent Notice */}
            {singleResult.transitionApplied === false && (
              <View style={styles.idempotentBox}>
                <Icon source="information-outline" size={18} color={colors.warning} />
                <Text style={styles.idempotentText}>
                  Parcel was already at this status. No duplicate tracking event was created.
                </Text>
              </View>
            )}
          </View>
        )}

        {!isSingle && batchResult && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>OPERATION</Text>
              <Text style={styles.metaValue}>
                {formatStatusLabel(batchResult.targetStatus)}
              </Text>
            </View>

            {batchResult.vehiclePlateNumber && (
              <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
                <Text style={styles.metaLabel}>VEHICLE</Text>
                <Text style={styles.metaValue}>{batchResult.vehiclePlateNumber}</Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Counts Summary */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{batchResult.totalRequested || 0}</Text>
                <Text style={styles.statLabel}>Total Scanned</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.success }]}>
                  {batchResult.transitionedCount || 0}
                </Text>
                <Text style={styles.statLabel}>Updated</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.warning }]}>
                  {batchResult.idempotentCount || 0}
                </Text>
                <Text style={styles.statLabel}>Already Applied</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.scanNextButton} onPress={onScanNext}>
          <Text style={styles.scanNextButtonText}>
            {isSingle ? 'Scan Next Parcel' : 'Start New Batch'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.returnHomeButton} onPress={onReturnHome}>
          <Text style={styles.returnHomeButtonText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface
  },
  scrollContent: {
    padding: spacing.md
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: spacing.md
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  titleText: {
    ...typography.h2,
    textAlign: 'center',
    color: colors.ink
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  metaLabel: {
    ...typography.eyebrow
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  trackingIdText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.ink
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm
  },
  statusPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  idempotentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md
  },
  idempotentText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
    lineHeight: 16
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs
  },
  statBox: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink
  },
  statLabel: {
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs
  },
  scanNextButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  scanNextButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  returnHomeButton: {
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  returnHomeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft
  }
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

const SKELETON_COLOR = '#EAE7DD';
const SKELETON_COLOR_MUTED = '#F0EEE7';

/**
 * Base static skeleton placeholder block.
 * Uses design token neutral tones without heavy runtime animations.
 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = radius.xs || 4,
  style,
}) {
  return (
    <View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton placeholder for dashboard metric cards.
 */
export function MetricCardSkeleton({ emphasis = false, style }) {
  return (
    <View
      style={[
        styles.metricCard,
        emphasis && styles.metricCardEmphasis,
        style,
      ]}
      aria-busy="true"
      accessibilityLabel="Loading metric..."
    >
      <SkeletonBlock
        width="60%"
        height={11}
        style={emphasis ? styles.blockLight : null}
      />
      <SkeletonBlock
        width="80%"
        height={32}
        style={[styles.metricValueBlock, emphasis ? styles.blockLight : null]}
      />
      <SkeletonBlock
        width="45%"
        height={12}
        style={emphasis ? styles.blockLight : null}
      />
    </View>
  );
}

/**
 * Skeleton placeholder for charts and card bodies.
 */
export function ChartSkeleton({ height = 200, style }) {
  return (
    <View
      style={[styles.chartContainer, { height }, style]}
      aria-busy="true"
      accessibilityLabel="Loading chart..."
    >
      <View style={styles.chartBars}>
        <SkeletonBlock width="18%" height="60%" borderRadius={2} />
        <SkeletonBlock width="18%" height="90%" borderRadius={2} />
        <SkeletonBlock width="18%" height="45%" borderRadius={2} />
        <SkeletonBlock width="18%" height="75%" borderRadius={2} />
        <SkeletonBlock width="18%" height="30%" borderRadius={2} />
      </View>
    </View>
  );
}

/**
 * Skeleton placeholder for recent activity rows.
 */
export function ActivityRowSkeleton({ count = 4 }) {
  return (
    <View aria-busy="true" accessibilityLabel="Loading activities...">
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={[styles.activityRow, idx !== count - 1 && styles.rowDivider]}>
          <SkeletonBlock width={10} height={10} borderRadius={5} style={{ marginTop: 4 }} />
          <View style={styles.activityContent}>
            <SkeletonBlock width="70%" height={14} />
            <SkeletonBlock width="40%" height={11} style={{ marginTop: 6 }} />
          </View>
          <SkeletonBlock width={60} height={12} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton placeholder for table rows.
 */
export function TableRowSkeleton({ rows = 5, columns = 6, height = 44 }) {
  return (
    <View aria-busy="true" accessibilityLabel="Loading records...">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View
          key={rowIdx}
          style={[styles.tableRow, { height }, rowIdx !== rows - 1 && styles.rowDivider]}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <View key={colIdx} style={styles.tableCol}>
              <SkeletonBlock
                width={colIdx === 0 ? '80%' : colIdx === columns - 1 ? '50%' : '65%'}
                height={14}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton placeholder for top 5 Reports KPI bar.
 */
export function ReportsKpiSkeleton() {
  return (
    <View style={styles.kpiContainer} aria-busy="true" accessibilityLabel="Loading KPIs...">
      {Array.from({ length: 5 }).map((_, idx) => (
        <View key={idx} style={styles.kpiCard}>
          <SkeletonBlock width="75%" height={10} />
          <SkeletonBlock width="90%" height={24} style={{ marginVertical: 6 }} />
          <SkeletonBlock width="55%" height={11} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton placeholder for Thursday's collection summary card in Reports.
 */
export function CollectionSummarySkeleton() {
  return (
    <View style={styles.collectionSummaryBody} aria-busy="true" accessibilityLabel="Loading collection summary...">
      {Array.from({ length: 4 }).map((_, idx) => (
        <View key={idx} style={[styles.collectionSummaryRow, idx !== 3 && styles.rowDivider]}>
          <SkeletonBlock width="40%" height={14} />
          <SkeletonBlock width="20%" height={14} />
          <SkeletonBlock width="25%" height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: SKELETON_COLOR,
  },
  blockLight: {
    backgroundColor: '#333333',
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    minWidth: 160,
  },
  metricCardEmphasis: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  metricValueBlock: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chartContainer: {
    width: '100%',
    backgroundColor: SKELETON_COLOR_MUTED,
    borderRadius: radius.xs || 4,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  tableCol: {
    flex: 1,
    paddingHorizontal: 4,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm || 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  collectionSummaryBody: {
    padding: spacing.md,
  },
  collectionSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 4,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../constants/theme';

/**
 * "Outstanding vs collected" horizontal bars with a shared numeric axis.
 * rows: [{ label: 'Outstanding', value: 4670, color }]
 */
export default function ComparisonBars({ rows, axisMax, axisSteps = 5 }) {
  const max = axisMax || Math.max(...rows.map((r) => r.value), 1);
  const step = max / axisSteps;
  const axisValues = Array.from({ length: axisSteps + 1 }, (_, i) => Math.round(step * i));

  return (
    <View>
      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min((r.value / max) * 100, 100)}%`, backgroundColor: r.color },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.axisRow}>
        {axisValues.map((v) => (
          <Text key={v} style={styles.axisLabel}>
            {v.toLocaleString()}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    width: 74,
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkSoft,
    textAlign: 'right',
  },
  track: {
    flex: 1,
    height: 30,
    backgroundColor: colors.canvas,
  },
  fill: {
    height: '100%',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 74 + 8,
  },
  axisLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkFaint,
  },
});

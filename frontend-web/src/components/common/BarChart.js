import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../theme';

export default function BarChart({ data, height = 130, maxValue }) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const gridLines = 4;

  return (
    <View>
      <View style={[styles.chartArea, { height }]}>
        <View style={styles.gridLines}>
          {Array.from({ length: gridLines + 1 }).map((_, i) => (
            <View key={i} style={styles.gridLine} />
          ))}
        </View>
        <View style={styles.bars}>
          {data.map((d) => (
            <View key={d.label} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  { height: max ? (d.value / max) * (height - 20) : 0 },
                ]}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabelLeft}>0</Text>
        {data.map((d) => (
          <Text key={d.label} style={styles.axisLabel}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartArea: {
    justifyContent: 'flex-end',
    position: 'relative',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: colors.border,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '100%',
    paddingBottom: 20,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  bar: {
    width: 22,
    backgroundColor: colors.black,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xs,
  },
  axisLabelLeft: {
    position: 'absolute',
    left: 0,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.inkFaint,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.inkFaint,
  },
});

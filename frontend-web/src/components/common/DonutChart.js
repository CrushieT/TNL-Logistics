import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { fonts, spacing } from '../../theme';

export default function DonutChart({ segments, size = 176, thickness = 26 }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  let cursor = 0;
  const stops = segments.map((s) => {
    const start = (cursor / total) * 360;
    cursor += s.value;
    const end = (cursor / total) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  });

  const ringStyle =
    Platform.OS === 'web'
      ? { backgroundImage: `conic-gradient(${stops.join(', ')})` }
      : { backgroundColor: segments[0]?.color || '#ccc' };

  return (
    <View style={styles.wrap}>
      <View style={[styles.ringOuter, { width: size, height: size, borderRadius: size / 2 }, ringStyle]}>
        <View
          style={[
            styles.ringInner,
            {
              width: size - thickness * 2,
              height: size - thickness * 2,
              borderRadius: (size - thickness * 2) / 2,
            },
          ]}
        />
      </View>
      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  ringOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ringInner: {
    backgroundColor: '#FFFFFF',
  },
  legend: {
    width: '100%',
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: '#1A1A1A',
    flex: 1,
  },
  legendValue: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

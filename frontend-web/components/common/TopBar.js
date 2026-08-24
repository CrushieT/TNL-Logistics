import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../constants/theme';

function formatToday() {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Thin strip above the page content: "11 shipments · 16 parcels · One
 * shared system · PC ↔ Mobile" on the left, current date on the right.
 */
export default function TopBar({ shipmentCount, parcelCount }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.meta}>
        {shipmentCount != null ? `${shipmentCount} shipments` : '—'}
        {parcelCount != null ? ` · ${parcelCount} parcels` : ''}
        {' · One shared system · PC ↔ Mobile'}
      </Text>
      <Text style={styles.date}>{formatToday()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.canvas,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.accent,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkFaint,
  },
});

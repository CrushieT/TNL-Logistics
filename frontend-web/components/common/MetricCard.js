import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../constants/theme';

/**
 * One of the four top-row dashboard tiles: SHIPMENTS / REGISTERED TODAY /
 * UNPAID TRANSACTIONS / FOR COLLECTION. The last one in the prototype is
 * inverted (dark background) to flag it as the actionable item.
 */
export default function MetricCard({ label, value, sublabel, emphasis = false }) {
  return (
    <View style={[styles.card, emphasis && styles.cardEmphasis]}>
      <Text style={[type.label, emphasis && styles.labelEmphasis]}>{label}</Text>
      <Text style={[styles.value, emphasis && styles.valueEmphasis]}>{value}</Text>
      {sublabel ? (
        <Text style={[styles.sublabel, emphasis && styles.sublabelEmphasis]}>{sublabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    minWidth: 160,
  },
  cardEmphasis: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  labelEmphasis: {
    color: '#C9C9C9',
  },
  value: {
    fontFamily: fonts.sans,
    fontSize: 30,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  valueEmphasis: {
    color: '#FFFFFF',
  },
  sublabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: 3,
  },
  sublabelEmphasis: {
    color: '#B9B9B9',
  },
});

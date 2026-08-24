import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, statusStyles, paymentStyles, labelStyles } from '../../constants/theme';

const KIND_MAPS = {
  status: statusStyles,
  payment: paymentStyles,
  label: labelStyles,
};

/**
 * Small pill badge used for shipment status, payment status, and label
 * print status throughout the console (dashboard, shipment list, detail).
 *
 * kind: 'status' | 'payment' | 'label'
 * showDot: renders a leading dot for status pills, as in the prototype
 */
export default function StatusBadge({ value, kind = 'status', showDot = true }) {
  const map = KIND_MAPS[kind] || statusStyles;
  const style = map[value] || { fg: colors.inkSoft, bg: colors.canvas, dot: colors.inkFaint, outline: true };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: style.bg,
          borderColor: style.outline ? style.fg : 'transparent',
        },
      ]}
    >
      {showDot && kind === 'status' && (
        <View style={[styles.dot, { backgroundColor: style.dot || style.fg }]} />
      )}
      <Text style={[styles.text, { color: style.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

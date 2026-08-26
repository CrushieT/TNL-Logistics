import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, statusStyles, paymentStyles, labelStyles, waybillStyles } from '../../theme';

export default function StatusBadge({ value, kind = 'status', style }) {
  if (!value) return null;

  let cfg = { fg: colors.inkSoft, bg: colors.canvas, border: colors.border };

  if (kind === 'payment') {
    cfg = paymentStyles[value] || cfg;
  } else if (kind === 'label') {
    cfg = labelStyles[value] || cfg;
  } else if (kind === 'waybill') {
    cfg = waybillStyles[value] || cfg;
  } else {
    cfg = statusStyles[value] || cfg;
  }

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: cfg.bg },
        cfg.border ? { borderWidth: 1, borderColor: cfg.border } : null,
        style,
      ]}
    >
      {cfg.dot ? <View style={[styles.dot, { backgroundColor: cfg.dot }]} /> : null}
      <Text style={[styles.text, { color: cfg.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

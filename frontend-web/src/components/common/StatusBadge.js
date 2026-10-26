import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  radius,
  statusStyles,
  paymentStyles,
  labelStyles,
  waybillStyles,
  collectionStyles,
} from '../../theme';

function resolveStyle(map, key) {
  if (!map || !key) return null;
  if (map[key]) return map[key];
  const upper = String(key).toUpperCase();
  if (map[upper]) return map[upper];
  return null;
}

export default function StatusBadge({ value, kind = 'status', style }) {
  if (!value) return null;

  let cfg = { fg: colors.inkSoft, bg: colors.canvas, border: colors.border };

  if (kind === 'payment') {
    cfg = resolveStyle(paymentStyles, value) || cfg;
  } else if (kind === 'label') {
    cfg = resolveStyle(labelStyles, value) || cfg;
  } else if (kind === 'waybill') {
    cfg = resolveStyle(waybillStyles, value) || cfg;
  } else if (kind === 'collection') {
    cfg = resolveStyle(collectionStyles, value) || cfg;
  } else {
    cfg = resolveStyle(statusStyles, value) || (/^[0-9]+ Lost$/i.test(value) ? statusStyles.Lost : cfg);
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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../theme';

const ACTION_COLOR = {
  Registered: colors.accent,
  'QR Generated': colors.inkSoft,
  'Loaded on Truck': colors.warning,
  'Arrived at TNL': colors.success,
  'Loaded to Hauler': colors.success,
};

export default function ActivityRow({ date, time, action, trackingId, meta, isLast }) {
  return (
    <View style={[styles.row, !isLast && styles.divider]}>
      <Text style={styles.date}>
        {date} <Text style={styles.time}>· {time}</Text>
      </Text>
      <Text style={[styles.action, { color: ACTION_COLOR[action] || colors.ink }]}>{action}</Text>
      <Text style={styles.tracking}>{trackingId}</Text>
      <Text style={styles.meta}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    width: 150,
  },
  time: {
    color: colors.inkFaint,
  },
  action: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    width: 130,
  },
  tracking: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.ink,
    width: 150,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    flex: 1,
  },
});

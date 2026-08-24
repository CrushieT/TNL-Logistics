import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radius } from '../../constants/theme';

/**
 * Success confirmation toast pinned to bottom-right, matching the
 * "✓ Shipment SHP-2026-011 registered · 3 QR codes generated" prototype toast.
 */
export default function Toast({ visible, message, onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(t);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.black,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    maxWidth: 420,
  },
  check: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
});

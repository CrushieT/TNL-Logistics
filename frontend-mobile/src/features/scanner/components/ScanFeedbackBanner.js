import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, spacing, radius } from '../../../theme';

export default function ScanFeedbackBanner({
  kind = 'info',
  message,
  onDismiss,
  durationMs = 3000,
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!message || !['success', 'info'].includes(kind)) return undefined;
    const timer = setTimeout(() => dismissRef.current?.(), durationMs);
    return () => clearTimeout(timer);
  }, [kind, message, durationMs]);

  if (!message) return null;

  const color = kind === 'error' ? colors.danger : kind === 'warning' ? colors.warning
    : kind === 'success' ? colors.success : colors.accent;
  const backgroundColor = kind === 'error' ? colors.dangerSoft : kind === 'warning' ? colors.warningSoft
    : kind === 'success' ? colors.successSoft : colors.accentSoft;

  const badgeText = kind === 'success' ? 'OK'
    : kind === 'error' ? 'STOP'
    : kind === 'warning' ? 'WAIT'
    : kind === 'loading' ? 'CHECK'
    : 'INFO';

  return (
    <View
      style={[styles.banner, { backgroundColor, borderColor: color }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {kind === 'loading' ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon
          source={kind === 'success' ? 'check-circle-outline' : kind === 'info' ? 'information-outline' : 'alert-circle-outline'}
          size={22}
          color={color}
        />
      )}

      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{badgeText}</Text>
      </View>

      <Text style={[styles.message, { color }]}>{message}</Text>

      {onDismiss && kind !== 'loading' && (
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss scan feedback"
          style={styles.dismiss}
        >
          <Icon source="close" size={20} color={color} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  dismiss: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

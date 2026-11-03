import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, spacing, radius } from '../../../theme';

export default function ScanFeedbackBanner({ kind = 'info', message, onDismiss }) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!message || !['success', 'info'].includes(kind)) return undefined;
    const timer = setTimeout(() => dismissRef.current?.(), 3000);
    return () => clearTimeout(timer);
  }, [kind, message]);

  if (!message) return null;
  const color = kind === 'error' ? colors.danger : kind === 'warning' ? colors.warning
    : kind === 'success' ? colors.success : colors.accent;
  const backgroundColor = kind === 'error' ? colors.dangerSoft : kind === 'warning' ? colors.warningSoft
    : kind === 'success' ? colors.successSoft : colors.accentSoft;
  return (
    <View style={[styles.banner, { backgroundColor }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {kind === 'loading' ? <ActivityIndicator size="small" color={color} />
        : <Icon source={kind === 'success' ? 'check-circle-outline' : kind === 'info' ? 'information-outline' : 'alert-circle-outline'} size={20} color={color} />}
      <Text style={[styles.message, { color }]}>{message}</Text>
      {onDismiss && kind !== 'loading' && (
        <TouchableOpacity onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss scan feedback" style={styles.dismiss}>
          <Icon source="close" size={18} color={color} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  message: { flex: 1, fontSize: 13, fontWeight: '600' },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }
});

import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, radius, spacing } from '../../constants/theme';

const VARIANTS = {
  primary: {
    bg: colors.black,
    fg: '#FFFFFF',
    border: colors.black,
  },
  accent: {
    bg: colors.accent,
    fg: '#FFFFFF',
    border: colors.accent,
  },
  secondary: {
    bg: colors.surface,
    fg: colors.ink,
    border: colors.borderStrong,
  },
  ghost: {
    bg: 'transparent',
    fg: colors.inkSoft,
    border: colors.border,
  },
  danger: {
    bg: colors.surface,
    fg: colors.danger,
    border: colors.danger,
  },
};

export default function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}) {
  const v = VARIANTS[variant] || VARIANTS.secondary;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ hovered, pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : hovered ? 0.92 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, fonts, spacing, radius } from '../../theme';

export default function Toast({ visible, message, onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.toast}>
        <Text style={styles.icon}>✓</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 9999,
  },
  toast: {
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: {
    color: '#10B981',
    fontWeight: '900',
    marginRight: spacing.sm,
    fontSize: 14,
  },
  message: {
    fontFamily: fonts.sans,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

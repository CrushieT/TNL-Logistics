import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Icon } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { colors } from '../../theme';

/**
 * Universal back button component for navigation headers.
 * Provides a standardized 44x44 touch target with an arrow-left vector icon.
 */
export function BackButton({
  onPress,
  color = colors.ink,
  size = 22,
  style,
  accessibilityLabel = 'Go back',
  disabled = false,
}) {
  const router = useRouter();

  const handlePress = () => {
    if (disabled) return;
    if (typeof onPress === 'function') {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon source="arrow-left" size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.3,
  },
});

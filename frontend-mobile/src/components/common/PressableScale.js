import React, { useRef } from 'react';
import { Animated, Pressable, Platform } from 'react-native';

/**
 * High-performance pressable wrapper providing tactile micro-scale feedback.
 * Driven entirely on the compositor/native UI thread via Animated.spring to prevent frame drops.
 */
export function PressableScale({
  children,
  onPress,
  disabled = false,
  activeScale = 0.96,
  style,
  contentStyle,
  ...props
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: activeScale,
      speed: 60,
      bounciness: 4,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 50,
      bounciness: 6,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={style}
      accessibilityRole="button"
      {...props}
    >
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }] },
          contentStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

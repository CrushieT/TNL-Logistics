import { Platform, Vibration } from 'react-native';
import { invokeHapticSafely } from './hapticsCore.mjs';

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // Non-fatal if expo-haptics cannot be loaded in test or web environments
}

/**
 * Safe haptics wrapper that never throws on unsupported platforms
 * and safely absorbs asynchronous native promise rejections.
 * Drives physical motor vibration on Android in addition to software haptics.
 */
export const safeHaptics = {
  selection() {
    return invokeHapticSafely(() => Haptics?.selectionAsync?.());
  },
  heavy() {
    return invokeHapticSafely(() => {
      if (Haptics?.ImpactFeedbackStyle?.Heavy) {
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    });
  },
  success() {
    try {
      if (Platform?.OS !== 'web' && typeof Vibration?.vibrate === 'function') {
        Vibration.vibrate([0, 100, 50, 100]);
      }
    } catch {}
    return invokeHapticSafely(() => {
      if (Haptics?.NotificationFeedbackType?.Success) {
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  },
  warning() {
    try {
      if (Platform?.OS !== 'web' && typeof Vibration?.vibrate === 'function') {
        Vibration.vibrate([0, 200, 80, 200]);
      }
    } catch {}
    return invokeHapticSafely(() => {
      if (Haptics?.NotificationFeedbackType?.Warning) {
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });
  },
  error() {
    try {
      if (Platform?.OS !== 'web' && typeof Vibration?.vibrate === 'function') {
        Vibration.vibrate([0, 300, 100, 300]);
      }
    } catch {}
    return invokeHapticSafely(() => {
      if (Haptics?.NotificationFeedbackType?.Error) {
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    });
  }
};

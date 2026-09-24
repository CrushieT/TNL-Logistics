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
 */
export const safeHaptics = {
  selection() {
    return invokeHapticSafely(() => Haptics?.selectionAsync?.());
  },
  success() {
    return invokeHapticSafely(() => {
      if (Haptics?.NotificationFeedbackType?.Success) {
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  },
  warning() {
    return invokeHapticSafely(() => {
      if (Haptics?.NotificationFeedbackType?.Warning) {
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });
  },
  error() {
    return invokeHapticSafely(() => {
      if (Haptics?.NotificationFeedbackType?.Error) {
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    });
  }
};

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Animated,
  Easing,
  Pressable,
  Platform,
} from 'react-native';
import { colors } from '../../theme';
import { PressableScale } from './PressableScale';

/**
 * Minimalist, smoothly-animated modal dialog for notices and confirmations.
 * Features fluid cubic-bezier entry/exit transitions, refined typography,
 * subtle hairline borders, and zero visual clutter.
 */
export function StatusModal({
  visible = false,
  title,
  eyebrow = 'SECURITY NOTICE',
  message,
  confirmText = 'OK',
  cancelText,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}) {
  const [isRendered, setIsRendered] = useState(visible);
  const [cachedContent, setCachedContent] = useState({
    title,
    eyebrow,
    message,
    confirmText,
    cancelText,
    confirmVariant,
  });

  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Cache display content when visible so exit animation doesn't flash empty text
  useEffect(() => {
    if (visible) {
      setCachedContent({
        title,
        eyebrow,
        message,
        confirmText,
        cancelText,
        confirmVariant,
      });
    }
  }, [visible, title, eyebrow, message, confirmText, cancelText, confirmVariant]);

  // Smooth entry and exit orchestration
  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
        }
      });
    }
  }, [visible, anim]);

  if (!isRendered) {
    return null;
  }

  const activeTitle = visible ? title : cachedContent.title;
  const activeEyebrow = visible ? eyebrow : cachedContent.eyebrow;
  const activeMessage = visible ? message : cachedContent.message;
  const activeConfirmText = visible ? confirmText : cachedContent.confirmText;
  const activeCancelText = visible ? cancelText : cachedContent.cancelText;
  const activeConfirmVariant = visible ? confirmVariant : cachedContent.confirmVariant;

  const hasCancel = Boolean(activeCancelText);

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const cardOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const cardScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const cardTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <Modal
      visible={isRendered}
      transparent
      animationType="none"
      onRequestClose={hasCancel ? onCancel : onConfirm}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        {/* Backdrop tap dismisses only if cancellation is permitted */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={hasCancel ? onCancel : undefined}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal backdrop"
        />

        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
            },
          ]}
        >
          <View style={styles.cardContent}>
            {Boolean(activeEyebrow) && (
              <Text style={styles.eyebrow}>{activeEyebrow}</Text>
            )}
            <Text style={styles.title}>{activeTitle}</Text>
            <Text style={styles.message}>{activeMessage}</Text>

            {hasCancel ? (
              <View style={styles.buttonRow}>
                <PressableScale
                  style={styles.flexButton}
                  contentStyle={styles.cancelButton}
                  onPress={onCancel}
                  activeScale={0.96}
                >
                  <Text style={styles.cancelButtonText}>{activeCancelText}</Text>
                </PressableScale>

                <PressableScale
                  style={styles.flexButton}
                  contentStyle={[
                    styles.confirmButton,
                    activeConfirmVariant === 'danger'
                      ? styles.confirmButtonDanger
                      : styles.confirmButtonPrimary,
                  ]}
                  onPress={onConfirm}
                  activeScale={0.96}
                >
                  <Text style={styles.confirmButtonText}>{activeConfirmText}</Text>
                </PressableScale>
              </View>
            ) : (
              <PressableScale
                style={styles.fullWidthButton}
                contentStyle={[
                  styles.confirmButton,
                  activeConfirmVariant === 'danger'
                    ? styles.confirmButtonDanger
                    : styles.confirmButtonPrimary,
                ]}
                onPress={onConfirm}
                activeScale={0.97}
              >
                <Text style={styles.confirmButtonText}>{activeConfirmText}</Text>
              </PressableScale>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  cardContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.inkFaint,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  message: {
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 20,
    marginBottom: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  flexButton: {
    flex: 1,
  },
  fullWidthButton: {
    width: '100%',
  },
  cancelButton: {
    height: 42,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  cancelButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.inkSoft,
    letterSpacing: 0.3,
  },
  confirmButton: {
    height: 42,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  confirmButtonPrimary: {
    backgroundColor: colors.black,
  },
  confirmButtonDanger: {
    backgroundColor: colors.accent,
  },
  confirmButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});

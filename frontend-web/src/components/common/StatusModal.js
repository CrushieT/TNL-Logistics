import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../theme';

export default function StatusModal({
  visible = false,
  eyebrow = 'SHIPMENT REGISTRATION',
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
            </View>
            {onCancel ? (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {cancelText ? (
              <Pressable
                style={styles.cancelBtn}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.confirmBtn,
                confirmVariant === 'danger' && styles.dangerBtn,
                confirmVariant === 'accent' && styles.accentBtn,
                confirmVariant === 'primary' && styles.primaryBtn,
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              <Text
                style={[
                  styles.confirmBtnText,
                  confirmVariant === 'danger' && styles.dangerBtnText,
                ]}
              >
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 1100,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  headerCopy: {
    flex: 1,
    marginRight: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkFaint,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  closeBtn: {
    padding: 4,
    marginTop: -2,
  },
  closeBtnText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  message: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F6',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  confirmBtn: {
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  primaryBtn: {
    backgroundColor: colors.black,
  },
  dangerBtn: {
    backgroundColor: colors.accent,
  },
  accentBtn: {
    backgroundColor: colors.accent,
  },
  confirmBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  dangerBtnText: {
    color: '#FFFFFF',
  },
});

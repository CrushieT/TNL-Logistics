import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../../theme';

function EyeIcon({ visible, size = 18, color = colors.inkSoft }) {
  if (visible) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function ConfirmPasswordModal({
  visible,
  title = 'AUTHORIZE ACTION',
  warningTitle = 'SECURITY AUTHORIZATION',
  description,
  passwordLabel = 'ADMINISTRATOR PASSWORD *',
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onClose,
  onConfirm,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  if (!visible) return null;

  const handleConfirm = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Password is required.');
      return;
    }

    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(trimmed);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Password verification failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isButtonDisabled = !password.trim() || submitting;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} disabled={submitting}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Body */}
          <View style={styles.body}>
            {/* Warning Callout Box */}
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>{warningTitle}</Text>
              {description ? <Text style={styles.warningText}>{description}</Text> : null}
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{passwordLabel}</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter administrator password"
                  placeholderTextColor={colors.inkFaint}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  editable={!submitting}
                  returnKeyType="go"
                  onSubmitEditing={handleConfirm}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon visible={showPassword} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                confirmVariant === 'accent' ? styles.accentBtn : styles.primaryBtn,
                isButtonDisabled && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isButtonDisabled}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
              )}
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
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkFaint,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderBottomWidth: 1,
    borderBottomColor: '#F5C6CB',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  body: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  warningBox: {
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: '#F5C842',
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 6,
  },
  warningTitle: {
    ...type.label,
    fontSize: 10,
    color: '#92400E',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  warningText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.inkFaint,
    letterSpacing: 0.7,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: 12,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: '#FAF9F5',
    outlineStyle: 'none',
  },
  passwordInput: {
    paddingRight: 42,
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  primaryBtn: {
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 140,
  },
  accentBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 140,
  },
  confirmBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.35,
  },
});

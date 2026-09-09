import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../../theme';

function generateTemporaryPassword() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TNL-${randomSuffix}`;
}

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  OFFICE_STAFF: 'Office Staff',
  FIELD_STAFF: 'Field Staff',
};

export default function ResetPasswordModal({ visible, user, onClose, onRequestConfirm, onConfirm }) {
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    if (visible && user) {
      setTempPassword(generateTemporaryPassword());
      setCopied(false);
      setError(null);
    }
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, [visible, user]);

  if (!visible || !user) return null;

  const handleCopy = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(tempPassword);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch {
        // Clipboard write fallback
      }
    }
  };

  const handleRegenerate = () => {
    setTempPassword(generateTemporaryPassword());
    setCopied(false);
  };

  const handleSubmit = async () => {
    const trimmedPassword = tempPassword.trim();
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setError('Temporary password must be at least 6 characters.');
      return;
    }

    if (onRequestConfirm) {
      onClose();
      onRequestConfirm(user, trimmedPassword);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm?.(user.userId, trimmedPassword);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>RESET PASSWORD — {user.userId}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* User Info Bar */}
          <View style={styles.userBar}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.fullName}</Text>
              <Text style={styles.userMeta}>@{user.username}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{ROLE_LABELS[user.role] || user.role}</Text>
            </View>
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>SECURITY ENFORCEMENT</Text>
              <Text style={styles.noticeText}>
                Staff member will be prompted to configure a permanent password upon their next login.
                Existing active sessions will be revoked immediately.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TEMPORARY PASSWORD *</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={tempPassword}
                  onChangeText={setTempPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={colors.inkFaint}
                />
                <Pressable
                  style={[styles.utilityBtn, copied && styles.copiedBtn]}
                  onPress={handleCopy}
                >
                  <Text style={[styles.utilityBtnText, copied && styles.copiedBtnText]}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.utilityBtn}
                  onPress={handleRegenerate}
                >
                  <Text style={styles.utilityBtnText}>New</Text>
                </Pressable>
              </View>
              <Text style={styles.fieldHelper}>
                Minimum 6 characters. You may also type a custom password.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Reset Password</Text>
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
  closeBtn: { padding: 4 },
  closeBtnText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkFaint,
    fontWeight: '700',
  },
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  userName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  userMeta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkSoft,
  },
  roleBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  roleBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
    textTransform: 'uppercase',
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
    gap: spacing.md,
  },
  noticeBox: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  noticeText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.inkFaint,
    letterSpacing: 0.7,
  },
  passwordRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  utilityBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 54,
  },
  utilityBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  copiedBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  copiedBtnText: {
    color: '#15803D',
  },
  fieldHelper: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
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
  confirmBtn: {
    backgroundColor: colors.black,
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
  btnDisabled: { opacity: 0.5 },
});

import React, { useState, useEffect } from 'react';
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

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  OFFICE_STAFF: 'Office Staff',
  FIELD_STAFF: 'Field Staff',
};

export default function ConfirmActionModal({
  visible,
  user,
  title,
  warningTitle = 'SECURITY ACTION',
  description,
  bulletPoints = [],
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onClose,
  onConfirm,
}) {
  const [typedUserId, setTypedUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setTypedUserId('');
      setError(null);
    }
  }, [visible, user]);

  if (!visible || !user) return null;

  const targetUserId = (user.userId || '').trim().toUpperCase();
  const isMatch = typedUserId.trim().toUpperCase() === targetUserId;

  const handleConfirm = async () => {
    if (!isMatch || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to complete action.');
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
            <Text style={styles.title}>
              {title} — {user.userId}
            </Text>
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
            {/* Warning Box */}
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>{warningTitle}</Text>
              {description ? <Text style={styles.warningText}>{description}</Text> : null}
              {bulletPoints.map((point, index) => (
                <Text key={index} style={styles.bulletText}>
                  • {point}
                </Text>
              ))}
            </View>

            {/* Input Verification Prompt */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                TYPE USER ID <Text style={styles.requiredTarget}>{targetUserId}</Text> TO CONFIRM *
              </Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                placeholder={`Type ${targetUserId}`}
                placeholderTextColor={colors.inkFaint}
                value={typedUserId}
                onChangeText={setTypedUserId}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
              />
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                confirmVariant === 'danger' ? styles.dangerBtn : styles.primaryBtn,
                (!isMatch || submitting) && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isMatch || submitting}
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
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
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
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
  bulletText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 17,
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
  requiredTarget: {
    fontFamily: fonts.mono,
    fontWeight: '800',
    color: colors.danger,
  },
  input: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  monoInput: {
    fontFamily: fonts.mono,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
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
    minWidth: 160,
  },
  dangerBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 160,
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

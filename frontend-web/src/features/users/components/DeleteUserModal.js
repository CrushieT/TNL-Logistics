import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../../theme';

export default function DeleteUserModal({ visible, user, onClose, onConfirm }) {
  const [typedUserId, setTypedUserId] = useState('');
  const [deleting, setDeleting] = useState(false);
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
    if (!isMatch || deleting) return;

    try {
      setDeleting(true);
      setError(null);
      await onConfirm(user.userId);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to process the account removal.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>REMOVE / DEACTIVATE STAFF</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.body}>
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>SMART ACCOUNT REMOVAL</Text>
              <Text style={styles.warningText}>
                Processing{' '}
                <Text style={styles.boldText}>{user.fullName}</Text>
                {' '}({user.userId}):
              </Text>
              <Text style={styles.bulletText}>
                • If this account has{' '}
                <Text style={styles.boldText}>no linked scan or payment records</Text>
                , it will be permanently deleted from the database.
              </Text>
              <Text style={styles.bulletText}>
                • If this account has{' '}
                <Text style={styles.boldText}>existing activity records</Text>
                , it will be safely set to{' '}
                <Text style={styles.boldText}>Inactive</Text>
                {' '}to preserve the audit trail.
              </Text>
            </View>

            <Text style={styles.confirmNote}>
              The account will no longer be able to log in after this action.
            </Text>

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

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={deleting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmBtn,
                (!isMatch || deleting) && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isMatch || deleting}
            >
              {deleting
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.confirmBtnText}>Remove / Deactivate</Text>}
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
    shadowColor: '#000',
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
    fontSize: 14,
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
  warningBox: {
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: '#F5C842',
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  warningTitle: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.7,
  },
  warningText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 20,
  },
  bulletText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
    lineHeight: 19,
  },
  boldText: { fontWeight: '700' },
  confirmNote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
  fieldGroup: {
    gap: 6,
    marginTop: spacing.sm,
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
  confirmBtn: {
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
  btnDisabled: { opacity: 0.35 },
});

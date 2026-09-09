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

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  OFFICE_STAFF: 'Office Staff',
  FIELD_STAFF: 'Field Staff',
};

export default function ResetPinModal({ visible, user, onClose, onConfirm }) {
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const pinInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (visible && user) {
      setShowManualOverride(false);
      setPinDigits(['', '', '', '']);
      setError(null);
    }
  }, [visible, user]);

  if (!visible || !user) return null;

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const nextDigits = [...pinDigits];
    nextDigits[index] = value.slice(-1);
    setPinDigits(nextDigits);

    if (value && index < 3) {
      pinInputRefs[index + 1]?.current?.focus();
    }
  };

  const handleDigitKeyPress = (index, event) => {
    if (event.nativeEvent.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs[index - 1]?.current?.focus();
    }
  };

  const handleClearPin = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(user.userId, null, true);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to clear mobile PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualPinSubmit = async () => {
    const pinString = pinDigits.join('');
    if (pinString.length !== 4) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(user.userId, pinString, false);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update mobile PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const isManualPinReady = pinDigits.join('').length === 4;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>RESET MOBILE PIN — {user.userId}</Text>
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
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.statusLabel}>CURRENT ENROLLMENT STATUS</Text>
                {user.hasPinSet ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>PIN ACTIVE</Text>
                  </View>
                ) : (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>NO PIN CONFIGURED</Text>
                  </View>
                )}
              </View>
              <Text style={styles.statusDescription}>
                {user.hasPinSet
                  ? 'Courier currently has a 4-digit PIN configured for mobile terminal operations.'
                  : 'No mobile PIN is currently enrolled for this staff account.'}
              </Text>
            </View>

            {/* Primary Action Card (Option A) */}
            <View style={styles.actionCard}>
              <Text style={styles.actionCardTitle}>
                RECOMMENDED: CLEAR PIN & REQUIRE SETUP
              </Text>
              <Text style={styles.actionCardDescription}>
                For courier accountability and security, administrators should not know staff PINs.
                Clearing the PIN requires the staff member to configure their own secret 4-digit PIN
                upon next mobile login. Active mobile sessions will be revoked immediately.
              </Text>
              <Pressable
                style={[styles.primaryActionBtn, submitting && styles.btnDisabled]}
                onPress={handleClearPin}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Clear PIN & Require Setup</Text>
                )}
              </Pressable>
            </View>

            {/* Secondary Manual Override Section (Option B) */}
            <View style={styles.overrideSection}>
              <Pressable
                style={styles.overrideToggle}
                onPress={() => setShowManualOverride(!showManualOverride)}
              >
                <Text style={styles.overrideToggleText}>
                  {showManualOverride
                    ? '— Cancel manual PIN assignment'
                    : '+ Assign specific 4-digit PIN manually (Emergency Override)'}
                </Text>
              </Pressable>

              {showManualOverride ? (
                <View style={styles.overridePanel}>
                  <Text style={styles.overrideNote}>
                    Only use this override if the courier cannot complete initial setup on their terminal.
                  </Text>
                  <View style={styles.pinRow}>
                    {pinDigits.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={pinInputRefs[index]}
                        style={styles.pinBox}
                        value={digit}
                        onChangeText={(val) => handleDigitChange(index, val)}
                        onKeyPress={(e) => handleDigitKeyPress(index, e)}
                        keyboardType="number-pad"
                        maxLength={1}
                        secureTextEntry
                        textAlign="center"
                      />
                    ))}
                  </View>
                  <Pressable
                    style={[
                      styles.secondaryActionBtn,
                      (!isManualPinReady || submitting) && styles.btnDisabled,
                    ]}
                    onPress={handleManualPinSubmit}
                    disabled={!isManualPinReady || submitting}
                  >
                    <Text style={styles.secondaryActionBtnText}>Assign 4-Digit PIN</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.closeModalBtn} onPress={onClose}>
              <Text style={styles.closeModalBtnText}>Close</Text>
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
    maxWidth: 500,
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
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 6,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.inkFaint,
    letterSpacing: 0.7,
  },
  activeBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  activeBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  inactiveBadge: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  inactiveBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
  },
  statusDescription: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  actionCard: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  actionCardTitle: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.7,
  },
  actionCardDescription: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  primaryActionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryActionBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  overrideSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  overrideToggle: { alignSelf: 'flex-start' },
  overrideToggleText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  overridePanel: {
    gap: spacing.sm,
    paddingTop: 4,
  },
  overrideNote: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    lineHeight: 16,
  },
  pinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  pinBox: {
    width: 44,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: '#FAF9F5',
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  secondaryActionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  secondaryActionBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  closeModalBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  btnDisabled: { opacity: 0.5 },
});

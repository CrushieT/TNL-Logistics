import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../../theme';
import { STAFF_ROLE_OPTIONS, USER_ROLES } from '../userRoles.mjs';

function generateTemporaryPassword() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TNL-${randomSuffix}`;
}

export default function CreateUserModal({ visible, onClose, onSaved }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState(USER_ROLES.RECEIVING_STAFF);
  const [showManualPin, setShowManualPin] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const copyTimeoutRef = useRef(null);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (visible) {
      setFullName('');
      setUsername('');
      setPassword(generateTemporaryPassword());
      setCopied(false);
      setRole(USER_ROLES.RECEIVING_STAFF);
      setShowManualPin(false);
      setPin(['', '', '', '']);
      setError(null);
    }
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, [visible]);

  if (!visible) return null;

  const handleCopy = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(password);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch {
        // Clipboard fallback
      }
    }
  };

  const handleRegenerate = () => {
    setPassword(generateTemporaryPassword());
    setCopied(false);
  };

  const handlePinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...pin];
    next[index] = value.slice(-1);
    setPin(next);
    if (value && index < 3) {
      pinRefs[index + 1]?.current?.focus();
    }
  };

  const handlePinKeyPress = (index, key) => {
    if (key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1]?.current?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (fullName.trim().length > 150) {
      setError('Full name cannot exceed 150 characters.');
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (username.trim().length > 50) {
      setError('Username cannot exceed 50 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}$/.test(username.trim())) {
      setError('Username must start with a letter or number and contain only letters, numbers, periods, underscores, or hyphens.');
      return;
    }
    if (!password.trim() || password.trim().length < 6) {
      setError('Temporary password must be at least 6 characters.');
      return;
    }
    let pinPayload = undefined;
    if (showManualPin) {
      const pinValue = pin.join('');
      if (pinValue.length !== 4) {
        setError('Manual PIN must be exactly 4 digits, or cancel manual PIN assignment.');
        return;
      }
      pinPayload = pinValue;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = {
        fullName: fullName.trim(),
        username: username.trim(),
        password: password.trim(),
        role,
        pin: pinPayload,
      };
      await onSaved(payload);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>CREATE STAFF ACCOUNT</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FULL NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Maria Santos"
                placeholderTextColor={colors.inkFaint}
                value={fullName}
                onChangeText={setFullName}
                maxLength={150}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>USERNAME *</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                placeholder="e.g. msantos"
                placeholderTextColor={colors.inkFaint}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                maxLength={50}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TEMPORARY PASSWORD *</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Min. 6 characters"
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
                Minimum 6 characters. The staff member will be required to configure a permanent password on first login.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ROLE *</Text>
              <View style={styles.pillRow}>
                {STAFF_ROLE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.pill, role === opt.value && styles.pillActive]}
                    onPress={() => setRole(opt.value)}
                  >
                    <Text style={[styles.pillText, role === opt.value && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>MOBILE PIN</Text>

              {/* Option A: Recommended Default */}
              <View style={styles.pinNoticeCard}>
                <Text style={styles.pinNoticeTitle}>
                  RECOMMENDED: REQUIRE PIN SETUP ON FIRST LOGIN
                </Text>
                <Text style={styles.pinNoticeText}>
                  To uphold security and staff accountability, administrators should not handle private PINs. The staff member will configure a secret 4-digit PIN upon first mobile login.
                </Text>
              </View>

              {/* Option B: Manual Override Toggle */}
              <Pressable
                style={styles.overrideToggle}
                onPress={() => {
                  setShowManualPin(!showManualPin);
                  setPin(['', '', '', '']);
                }}
              >
                <Text style={styles.overrideToggleText}>
                  {showManualPin
                    ? 'Cancel manual PIN assignment'
                    : '+ Assign specific 4-digit PIN manually (Emergency Override)'}
                </Text>
              </Pressable>

              {showManualPin ? (
                <View style={styles.overridePanel}>
                  <Text style={styles.overrideNote}>
                    Only use this override if the staff member cannot complete initial setup on their terminal.
                  </Text>
                  <View style={styles.pinRow}>
                    {pin.map((digit, i) => (
                      <TextInput
                        key={i}
                        ref={pinRefs[i]}
                        style={styles.pinBox}
                        value={digit}
                        onChangeText={(v) => handlePinChange(i, v)}
                        onKeyPress={Platform.OS === 'web'
                          ? (e) => handlePinKeyPress(i, e.nativeEvent.key)
                          : undefined}
                        keyboardType="number-pad"
                        maxLength={1}
                        secureTextEntry
                        textAlign="center"
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.saveBtnText}>Create Account</Text>}
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
    maxWidth: 520,
    maxHeight: '85%',
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
  bodyScroll: { flexShrink: 1 },
  body: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  fieldGroup: { gap: 4 },
  fieldLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.inkFaint,
    letterSpacing: 0.7,
  },
  fieldHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 4,
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
    paddingVertical: 8,
  },
  monoInput: {
    fontFamily: fonts.mono,
    fontWeight: '700',
  },
  passwordRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    paddingVertical: 8,
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
  pinNoticeCard: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 4,
    marginTop: 2,
  },
  pinNoticeTitle: {
    ...type.label,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 0.6,
  },
  pinNoticeText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
    lineHeight: 16,
  },
  overrideToggle: {
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  overrideToggleText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  overridePanel: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  overrideNote: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  pillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  pillText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  pillTextActive: { color: '#FFFFFF' },
  pinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  pinBox: {
    width: 48,
    height: 52,
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
  saveBtn: {
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 140,
  },
  saveBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: { opacity: 0.5 },
});

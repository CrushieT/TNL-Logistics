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

const ROLE_OPTIONS = [
  { label: 'Administrator', value: 'ADMIN' },
  { label: 'Office Staff', value: 'OFFICE_STAFF' },
  { label: 'Field Staff', value: 'FIELD_STAFF' },
];

const STAFF_TYPE_OPTIONS = [
  { label: 'Internal Truck', value: 'INTERNAL_TRUCK' },
  { label: 'Hauler Staff', value: 'HAULER_STAFF' },
];

export default function CreateUserModal({ visible, onClose, onSaved }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('OFFICE_STAFF');
  const [staffType, setStaffType] = useState('INTERNAL_TRUCK');
  const [pin, setPin] = useState(['', '', '', '']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (visible) {
      setFullName('');
      setUsername('');
      setPassword('');
      setRole('OFFICE_STAFF');
      setStaffType('INTERNAL_TRUCK');
      setPin(['', '', '', '']);
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

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
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!username.trim()) { setError('Username is required.'); return; }
    if (!password.trim() || password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (role === 'FIELD_STAFF' && !staffType) { setError('Staff type is required for Field Staff.'); return; }

    const pinValue = pin.join('');
    if (pinValue.length > 0 && pinValue.length < 4) {
      setError('Mobile PIN must be exactly 4 digits, or leave all boxes empty.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = {
        fullName: fullName.trim(),
        username: username.trim(),
        password,
        role,
        staffType: role === 'FIELD_STAFF' ? staffType : undefined,
        pin: pinValue.length === 4 ? pinValue : undefined,
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
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TEMPORARY PASSWORD *</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.inkFaint}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ROLE *</Text>
              <View style={styles.pillRow}>
                {ROLE_OPTIONS.map((opt) => (
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

            {role === 'FIELD_STAFF' ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>STAFF TYPE *</Text>
                <View style={styles.pillRow}>
                  {STAFF_TYPE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.pill, staffType === opt.value && styles.pillActive]}
                      onPress={() => setStaffType(opt.value)}
                    >
                      <Text style={[styles.pillText, staffType === opt.value && styles.pillTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>MOBILE PIN (OPTIONAL — 4 DIGITS)</Text>
              <Text style={styles.fieldHint}>Leave empty to let the user set their own PIN on first mobile login.</Text>
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

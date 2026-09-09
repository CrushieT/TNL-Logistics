import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
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

export default function EditUserModal({ visible, userToEdit, onClose, onSaved, onResetPassword, onResetPin }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('OFFICE_STAFF');
  const [staffType, setStaffType] = useState('INTERNAL_TRUCK');
  const [active, setActive] = useState(true);

  // Inline reset sub-panels
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPinReset, setShowPinReset] = useState(false);
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userToEdit && visible) {
      setFullName(userToEdit.fullName || '');
      setUsername(userToEdit.username || '');
      setRole(userToEdit.role || 'OFFICE_STAFF');
      setStaffType(userToEdit.staffType || 'INTERNAL_TRUCK');
      setActive(userToEdit.active !== false);
      setShowPasswordReset(false);
      setShowPinReset(false);
      setNewPassword('');
      setNewPin(['', '', '', '']);
      setError(null);
    }
  }, [userToEdit, visible]);

  if (!visible || !userToEdit) return null;

  const handlePinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...newPin];
    next[index] = value.slice(-1);
    setNewPin(next);
    if (value && index < 3) pinRefs[index + 1]?.current?.focus();
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!username.trim()) { setError('Username is required.'); return; }
    if (role === 'FIELD_STAFF' && !staffType) { setError('Staff type is required for Field Staff.'); return; }

    try {
      setSaving(true);
      setError(null);
      await onSaved({
        fullName: fullName.trim(),
        username: username.trim(),
        role,
        staffType: role === 'FIELD_STAFF' ? staffType : undefined,
        active,
      }, userToEdit.userId);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onResetPassword(userToEdit.userId, newPassword);
      setShowPasswordReset(false);
      setNewPassword('');
    } catch (err) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  };

  const handlePinReset = async () => {
    const pinValue = newPin.join('');
    if (pinValue.length !== 4) { setError('PIN must be exactly 4 digits.'); return; }
    try {
      setSaving(true);
      setError(null);
      await onResetPin(userToEdit.userId, pinValue);
      setShowPinReset(false);
      setNewPin(['', '', '', '']);
    } catch (err) {
      setError(err?.message || 'Failed to reset PIN.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>EDIT STAFF ACCOUNT — {userToEdit.userId}</Text>
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
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor={colors.inkFaint}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>USERNAME *</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholderTextColor={colors.inkFaint}
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
              <Text style={styles.fieldLabel}>ACCOUNT STATUS</Text>
              <View style={styles.pillRow}>
                {[{ label: 'Active', value: true }, { label: 'Inactive', value: false }].map((opt) => (
                  <Pressable
                    key={String(opt.value)}
                    style={[styles.pill, active === opt.value && styles.pillActive]}
                    onPress={() => setActive(opt.value)}
                  >
                    <Text style={[styles.pillText, active === opt.value && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Password Reset Sub-Panel */}
            <View style={styles.resetSection}>
              <Pressable
                style={styles.resetToggle}
                onPress={() => { setShowPasswordReset(!showPasswordReset); setShowPinReset(false); }}
              >
                <Text style={styles.resetToggleText}>
                  {showPasswordReset ? '— Cancel Password Reset' : '+ Reset Password'}
                </Text>
              </Pressable>
              {showPasswordReset ? (
                <View style={styles.resetPanel}>
                  <Text style={styles.fieldLabel}>NEW TEMPORARY PASSWORD *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Min. 6 characters"
                    placeholderTextColor={colors.inkFaint}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                  <Pressable
                    style={[styles.resetApplyBtn, saving && styles.btnDisabled]}
                    onPress={handlePasswordReset}
                    disabled={saving}
                  >
                    <Text style={styles.resetApplyBtnText}>Apply Reset</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* PIN Reset Sub-Panel */}
            <View style={styles.resetSection}>
              <Pressable
                style={styles.resetToggle}
                onPress={() => { setShowPinReset(!showPinReset); setShowPasswordReset(false); }}
              >
                <Text style={styles.resetToggleText}>
                  {showPinReset ? '— Cancel PIN Reset' : '+ Reset Mobile PIN'}
                </Text>
              </Pressable>
              {showPinReset ? (
                <View style={styles.resetPanel}>
                  <Text style={styles.fieldLabel}>NEW 4-DIGIT PIN</Text>
                  <View style={styles.pinRow}>
                    {newPin.map((digit, i) => (
                      <TextInput
                        key={i}
                        ref={pinRefs[i]}
                        style={styles.pinBox}
                        value={digit}
                        onChangeText={(v) => handlePinChange(i, v)}
                        keyboardType="number-pad"
                        maxLength={1}
                        secureTextEntry
                        textAlign="center"
                      />
                    ))}
                  </View>
                  <Pressable
                    style={[styles.resetApplyBtn, saving && styles.btnDisabled]}
                    onPress={handlePinReset}
                    disabled={saving}
                  >
                    <Text style={styles.resetApplyBtnText}>Apply PIN Reset</Text>
                  </Pressable>
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
                : <Text style={styles.saveBtnText}>Save Changes</Text>}
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
  body: { padding: spacing.xl, gap: spacing.md },
  fieldGroup: { gap: 4 },
  fieldLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.inkFaint,
    letterSpacing: 0.7,
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
  monoInput: { fontFamily: fonts.mono, fontWeight: '700' },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: colors.black, borderColor: colors.black },
  pillText: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '600', color: colors.ink },
  pillTextActive: { color: '#FFFFFF' },
  resetSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  resetToggle: { alignSelf: 'flex-start' },
  resetToggleText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  resetPanel: { gap: spacing.sm, paddingTop: spacing.sm },
  resetApplyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1d4ed8',
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  resetApplyBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pinRow: { flexDirection: 'row', gap: spacing.sm },
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
  cancelBtnText: { fontFamily: fonts.sans, fontSize: 12.5, fontWeight: '700', color: colors.ink },
  saveBtn: {
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 130,
  },
  saveBtnText: { fontFamily: fonts.sans, fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
});

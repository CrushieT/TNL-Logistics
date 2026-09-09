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

const STAFF_ROLE_OPTIONS = [
  { label: 'Office Staff', value: 'OFFICE_STAFF' },
  { label: 'Field Staff', value: 'FIELD_STAFF' },
];

const STAFF_TYPE_OPTIONS = [
  { label: 'Internal Truck', value: 'INTERNAL_TRUCK' },
  { label: 'Hauler Staff', value: 'HAULER_STAFF' },
];

export default function EditUserModal({ visible, userToEdit, onClose, onSaved, onRequestResetPassword, onRequestResetPin }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('OFFICE_STAFF');
  const [staffType, setStaffType] = useState('INTERNAL_TRUCK');
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userToEdit && visible) {
      setFullName(userToEdit.fullName || '');
      setUsername(userToEdit.username || '');
      setRole(userToEdit.role || 'OFFICE_STAFF');
      setStaffType(userToEdit.staffType || 'INTERNAL_TRUCK');
      setActive(userToEdit.active !== false);
      setError(null);
    }
  }, [userToEdit, visible]);

  if (!visible || !userToEdit) return null;

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
              {userToEdit.role === 'ADMIN' ? (
                <View style={styles.readOnlyRoleBox}>
                  <View style={[styles.pill, styles.pillActive]}>
                    <Text style={[styles.pillText, styles.pillTextActive]}>Administrator (Owner)</Text>
                  </View>
                  <Text style={styles.readOnlyRoleHint}>
                    System owner role cannot be changed.
                  </Text>
                </View>
              ) : (
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
              )}
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

            {/* Security Shortcuts */}
            <View style={styles.securitySection}>
              <Text style={styles.fieldLabel}>SECURITY & CREDENTIALS</Text>
              <Text style={styles.securityText}>
                Passwords and Mobile PINs are managed through dedicated quick-action dialogs.
              </Text>
              <View style={styles.securityBtnRow}>
                <Pressable
                  style={styles.securityBtn}
                  onPress={() => {
                    onClose();
                    onRequestResetPassword?.(userToEdit);
                  }}
                >
                  <Text style={styles.securityBtnText}>Reset Password</Text>
                </Pressable>
                {role !== 'ADMIN' ? (
                  <Pressable
                    style={styles.securityBtn}
                    onPress={() => {
                      onClose();
                      onRequestResetPin?.(userToEdit);
                    }}
                  >
                    <Text style={styles.securityBtnText}>Reset Mobile PIN</Text>
                  </Pressable>
                ) : null}
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
  readOnlyRoleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  readOnlyRoleHint: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
  securitySection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  securityText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  securityBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  securityBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
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

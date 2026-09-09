import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../../theme';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  OFFICE_STAFF: 'Office Staff',
  FIELD_STAFF: 'Field Staff',
};

const STAFF_TYPE_LABELS = {
  INTERNAL_TRUCK: 'Internal Truck',
  HAULER_STAFF: 'Hauler Staff',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function ViewUserModal({ visible, user, onClose, onEdit }) {
  if (!visible || !user) return null;

  const rows = [
    { label: 'ID', value: user.userId, mono: true },
    { label: 'Full Name', value: user.fullName },
    { label: 'Username', value: user.username, mono: true },
    { label: 'Role', value: ROLE_LABELS[user.role] || user.role },
    { label: 'Staff Type', value: user.staffType ? STAFF_TYPE_LABELS[user.staffType] || user.staffType : '—' },
    { label: 'Status', value: user.active ? 'Active' : 'Inactive', statusColor: user.active ? colors.success : colors.danger },
    { label: 'PIN Set', value: user.hasPinSet ? 'Yes' : 'No' },
    { label: 'Must Change Password', value: user.mustChangePassword ? 'Yes' : 'No' },
    { label: 'Joined', value: formatDate(user.createdAt) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>STAFF PROFILE</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.fullName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>{user.fullName}</Text>
            <Text style={styles.profileRole}>{ROLE_LABELS[user.role] || user.role}</Text>
          </View>

          <View style={styles.body}>
            {rows.map((row) => (
              <View key={row.label} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{row.label}</Text>
                <Text style={[
                  styles.dataValue,
                  row.mono && styles.monoValue,
                  row.statusColor ? { color: row.statusColor, fontWeight: '700' } : null,
                ]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
            {onEdit ? (
              <Pressable style={styles.editBtn} onPress={() => { onClose(); onEdit(user); }}>
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            ) : null}
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
    maxWidth: 460,
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
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FAF9F5',
    gap: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  profileRole: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  body: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  dataLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '600',
    letterSpacing: 0.3,
    flex: 1,
  },
  dataValue: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
    fontWeight: '500',
    flex: 1.4,
    textAlign: 'right',
  },
  monoValue: {
    fontFamily: fonts.mono,
    fontWeight: '700',
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
  editBtn: {
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

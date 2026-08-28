import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../../theme';

const RATE_OPTIONS = [
  { value: 'FLAT', label: 'Flat (shipment-level)' },
  { value: 'PER_PARCEL', label: 'Per unit (parcel-level)' },
];

const STATUS_OPTIONS = ['Active', 'Inactive'];

export default function RegisterClientModal({ visible, clientToEdit, onClose, onSaved }) {
  const isEditing = Boolean(clientToEdit);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [defaultRateType, setDefaultRateType] = useState('FLAT');
  const [status, setStatus] = useState('Active');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (clientToEdit) {
      setName(clientToEdit.name || '');
      setAddress(clientToEdit.address || '');
      setContactNumber(clientToEdit.contactNumber || '');
      setEmail(clientToEdit.email || '');
      setDefaultRateType(clientToEdit.defaultRateType || 'FLAT');
      setStatus(clientToEdit.active ? 'Active' : 'Inactive');
      setError(null);
    } else {
      setName('');
      setAddress('');
      setContactNumber('');
      setEmail('');
      setDefaultRateType('FLAT');
      setStatus('Active');
      setError(null);
    }
  }, [clientToEdit, visible]);

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Client / Company name is required.');
      return;
    }
    if (!address.trim()) {
      setError('Billing address is required.');
      return;
    }
    if (!contactNumber.trim() || contactNumber.trim().length < 7) {
      setError('Valid contact number is required (min 7 digits).');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        address: address.trim(),
        contactNumber: contactNumber.trim(),
        email: email.trim() || null,
        defaultRateType,
        active: status === 'Active',
      };

      await onSaved(payload, clientToEdit?.clientId || clientToEdit?.id);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save client.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? `EDIT CLIENT (${clientToEdit.clientId || clientToEdit.code})` : 'REGISTER CLIENT'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form Body */}
          <View style={styles.body}>
            {/* Client ID Preview (if editing) */}
            {isEditing ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CLIENT ID</Text>
                <TextInput
                  style={[styles.input, styles.monoInput, styles.disabledInput]}
                  value={clientToEdit.clientId || clientToEdit.code}
                  editable={false}
                />
              </View>
            ) : null}

            {/* Company / Client Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>COMPANY / CLIENT NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Northbridge Trading"
                placeholderTextColor={colors.inkFaint}
                value={name}
                onChangeText={setName}
                autoFocus={!isEditing}
              />
            </View>

            {/* Billing Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>BILLING ADDRESS *</Text>
              <TextInput
                style={styles.input}
                placeholder="Complete street, city, province"
                placeholderTextColor={colors.inkFaint}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            {/* Contact Number & Email Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>CONTACT NUMBER *</Text>
                <TextInput
                  style={[styles.input, styles.monoInput]}
                  placeholder="0917-555-0148"
                  placeholderTextColor={colors.inkFaint}
                  value={contactNumber}
                  onChangeText={(val) => {
                    const sanitized = val.replace(/[^0-9+\-() ]/g, '');
                    setContactNumber(sanitized);
                  }}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="orders@company.ph"
                  placeholderTextColor={colors.inkFaint}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Rate Type & Status: Hide DEFAULT CHARGE MODEL in Edit mode */}
            {isEditing ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>STATUS</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={webSelectStyle}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={status}
                    onChangeText={setStatus}
                  />
                )}
              </View>
            ) : (
              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1.3 }]}>
                  <Text style={styles.fieldLabel}>DEFAULT CHARGE MODEL</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={defaultRateType}
                      onChange={(e) => setDefaultRateType(e.target.value)}
                      style={webSelectStyle}
                    >
                      {RATE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={defaultRateType}
                      onChangeText={setDefaultRateType}
                    />
                  )}
                </View>

                <View style={[styles.fieldGroup, { flex: 0.9 }]}>
                  <Text style={styles.fieldLabel}>STATUS</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={webSelectStyle}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={status}
                      onChangeText={setStatus}
                    />
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isEditing ? 'Save Changes' : 'Register Client'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const webSelectStyle = {
  fontFamily: fonts.sans,
  fontSize: 13,
  fontWeight: '500',
  color: colors.ink,
  backgroundColor: '#FAF9F5',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: '8px 12px',
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
};

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
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldGroup: {
    gap: 4,
  },
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
  monoInput: {
    fontFamily: fonts.mono,
    fontWeight: '700',
  },
  disabledInput: {
    backgroundColor: '#EFEFEA',
    color: colors.inkSoft,
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
    minWidth: 120,
  },
  saveBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

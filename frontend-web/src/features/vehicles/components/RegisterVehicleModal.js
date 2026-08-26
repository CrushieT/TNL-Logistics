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

const STANDARD_TYPES = [
  '6-Wheeler Forward',
  '10-Wheeler Wing Van',
  'Closed Van',
  '4-Wheeler Elf',
  'Pickup / Utility',
  'Other',
];

const STATUS_OPTIONS = ['Active', 'In Maintenance', 'Inactive'];

export default function RegisterVehicleModal({ visible, vehicleToEdit, onClose, onSaved }) {
  const isEditing = Boolean(vehicleToEdit);

  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleTypeSelect, setVehicleTypeSelect] = useState('6-Wheeler Forward');
  const [customVehicleType, setCustomVehicleType] = useState('');
  const [status, setStatus] = useState('Active');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (vehicleToEdit) {
      setPlateNumber(vehicleToEdit.plateNumber || '');
      const existingType = vehicleToEdit.vehicleType || '6-Wheeler Forward';
      if (STANDARD_TYPES.filter(t => t !== 'Other').includes(existingType)) {
        setVehicleTypeSelect(existingType);
        setCustomVehicleType('');
      } else {
        setVehicleTypeSelect('Other');
        setCustomVehicleType(existingType);
      }
      setStatus(vehicleToEdit.status || (vehicleToEdit.active ? 'Active' : 'Inactive'));
      setDescription(vehicleToEdit.description || '');
      setRemarks(vehicleToEdit.remarks && vehicleToEdit.remarks !== '—' ? vehicleToEdit.remarks : '');
      setError(null);
    } else {
      setPlateNumber('');
      setVehicleTypeSelect('6-Wheeler Forward');
      setCustomVehicleType('');
      setStatus('Active');
      setDescription('');
      setRemarks('');
      setError(null);
    }
  }, [vehicleToEdit, visible]);

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!plateNumber.trim()) {
      setError('Plate number is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    const finalVehicleType =
      vehicleTypeSelect === 'Other'
        ? (customVehicleType.trim() || 'Other')
        : vehicleTypeSelect;

    try {
      setSaving(true);
      setError(null);

      const payload = {
        plateNumber: plateNumber.trim().toUpperCase(),
        vehicleType: finalVehicleType,
        description: description.trim(),
        status,
        remarks: remarks.trim() || null,
        active: status !== 'Inactive',
      };

      await onSaved(payload, vehicleToEdit?.vehicleId);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save vehicle.');
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
              {isEditing ? `EDIT VEHICLE (${vehicleToEdit.vehicleId})` : 'REGISTER VEHICLE'}
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
            {/* Plate Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PLATE / REGISTRATION NO. *</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                placeholder="ABC-1234"
                placeholderTextColor={colors.inkFaint}
                value={plateNumber}
                onChangeText={setPlateNumber}
                autoCapitalize="characters"
              />
            </View>

            {/* Vehicle Type & Status Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={vehicleTypeSelect}
                    onChange={(e) => setVehicleTypeSelect(e.target.value)}
                    style={webSelectStyle}
                  >
                    {STANDARD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={vehicleTypeSelect}
                    onChangeText={setVehicleTypeSelect}
                  />
                )}
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
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

            {/* Dynamic Custom Vehicle Type Input (when "Other" is chosen) */}
            {vehicleTypeSelect === 'Other' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>SPECIFY VEHICLE TYPE *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Refrigerated Wing Van, Motorcycle with Sidecar"
                  placeholderTextColor={colors.inkFaint}
                  value={customVehicleType}
                  onChangeText={setCustomVehicleType}
                />
              </View>
            )}

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>DESCRIPTION *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Manila–Baguio line haul"
                placeholderTextColor={colors.inkFaint}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Remarks */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>REMARKS</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Brake service, Reserved"
                placeholderTextColor={colors.inkFaint}
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>
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
                  {isEditing ? 'Save Changes' : 'Register Vehicle'}
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

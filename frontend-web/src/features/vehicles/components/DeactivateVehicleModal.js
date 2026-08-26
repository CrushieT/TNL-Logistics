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

export default function DeactivateVehicleModal({ visible, vehicle, onClose, onConfirm }) {
  const [typedPlate, setTypedPlate] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTypedPlate('');
    setError(null);
  }, [visible, vehicle]);

  if (!visible || !vehicle) return null;

  const targetPlate = (vehicle.plateNumber || '').trim().toUpperCase();
  const isMatch = typedPlate.trim().toUpperCase() === targetPlate;

  const handleDeactivate = async () => {
    if (!isMatch) return;

    try {
      setDeactivating(true);
      setError(null);
      await onConfirm(vehicle.vehicleId);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to remove/deactivate vehicle.');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>DELETE / DEACTIVATE VEHICLE</Text>
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
            {/* Warning Callout */}
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>SMART FLEET DELETION</Text>
              <Text style={styles.warningText}>
                Confirming will process vehicle <Text style={styles.boldText}>{vehicle.vehicleId}</Text> (
                <Text style={styles.monoText}>{vehicle.plateNumber}</Text>):
              </Text>
              <Text style={styles.bulletText}>
                • If the vehicle has <Text style={styles.boldText}>no past deliveries</Text>, it will be permanently deleted from the database.
              </Text>
              <Text style={styles.bulletText}>
                • If the vehicle has <Text style={styles.boldText}>past delivery history</Text>, it will be safely marked <Text style={styles.boldText}>Inactive</Text> to preserve customer proof-of-delivery records.
              </Text>
            </View>

            {/* Input Verification Prompt */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                TYPE PLATE NUMBER <Text style={styles.requiredPlate}>{targetPlate}</Text> TO CONFIRM *
              </Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                placeholder={`Type ${targetPlate}`}
                placeholderTextColor={colors.inkFaint}
                value={typedPlate}
                onChangeText={setTypedPlate}
                autoCapitalize="characters"
                autoFocus
              />
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={deactivating}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.deactivateBtn,
                (!isMatch || deactivating) && styles.btnDisabled,
              ]}
              onPress={handleDeactivate}
              disabled={!isMatch || deactivating}
            >
              {deactivating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.deactivateBtnText}>Confirm Delete</Text>
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
    color: colors.danger,
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
    gap: spacing.lg,
  },
  warningBox: {
    backgroundColor: '#FDF4F0',
    borderWidth: 1,
    borderColor: '#F6D0C7',
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 6,
  },
  warningTitle: {
    ...type.label,
    fontSize: 10,
    color: colors.danger,
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
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
    color: colors.ink,
  },
  monoText: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.ink,
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
  requiredPlate: {
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
    letterSpacing: 1,
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
  deactivateBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 150,
  },
  deactivateBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.35,
  },
});

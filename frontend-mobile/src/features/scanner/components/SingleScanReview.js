import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing, radius } from '../../../theme';

export default function SingleScanReview({
  context,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  loadingVehicles,
  onRetryVehicles,
  onConfirm,
  onCancel,
  isSubmitting
}) {
  if (!context) return null;

  const isVehicleRequired = Boolean(context.requiresVehicle);
  const canConfirm = context.canScan && (!isVehicleRequired || Boolean(selectedVehicleId)) && !isSubmitting;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Badges */}
        <View style={styles.topRow}>
          <View style={styles.packageBadge}>
            <Text style={styles.packageBadgeText}>
              PACKAGE {context.packageIndex || 1} OF {context.packageCount || 1}
            </Text>
          </View>
          <View style={[styles.statusBadge, !context.canScan && styles.terminalBadge]}>
            <Text style={[styles.statusBadgeText, !context.canScan && styles.terminalBadgeText]}>
              {context.currentStatusLabel || context.currentStatusCode}
            </Text>
          </View>
        </View>

        {/* Identifier Information */}
        <View style={styles.idCard}>
          <Text style={styles.idLabel}>TRACKING ID</Text>
          <Text style={styles.idValue}>{context.trackingId}</Text>

          {context.shipmentId && (
            <View style={styles.shipmentRow}>
              <Text style={styles.shipmentLabel}>SHIPMENT:</Text>
              <Text style={styles.shipmentValue}>{context.shipmentId}</Text>
            </View>
          )}

          {context.assignedVehiclePlateNumber && (
            <View style={styles.assignedVehicleRow}>
              <Icon source="truck" size={16} color={colors.inkFaint} />
              <Text style={styles.assignedVehicleText}>
                Currently on {context.assignedVehiclePlateNumber} ({context.assignedVehicleId})
              </Text>
            </View>
          )}
        </View>

        {/* Transition Preview or Terminal Message */}
        {context.canScan ? (
          <View style={styles.transitionCard}>
            <Text style={styles.sectionTitle}>PROPOSED STATUS UPDATE</Text>
            <View style={styles.transitionRow}>
              <View style={styles.statusPillCurrent}>
                <Text style={styles.statusPillCurrentText}>{context.currentStatusLabel}</Text>
              </View>
              <Icon source="arrow-right" size={20} color={colors.accent} />
              <View style={styles.statusPillNext}>
                <Text style={styles.statusPillNextText}>{context.nextStatusLabel}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.terminalCard}>
            <Icon source="check-circle-outline" size={24} color={colors.success} />
            <Text style={styles.terminalTitle}>Final Scanner Status Reached</Text>
            <Text style={styles.terminalDescription}>
              This package is already at {context.currentStatusLabel}. Further status changes are managed by hauler delivery or waybill POD.
            </Text>
          </View>
        )}

        {/* Vehicle Selection for LOADED_ON_TRUCK */}
        {context.canScan && isVehicleRequired && (
          <View style={styles.vehicleSection}>
            <View style={styles.vehicleHeaderRow}>
              <Text style={styles.sectionTitle}>ASSIGN VEHICLE *</Text>
              {loadingVehicles && <ActivityIndicator size="small" color={colors.accent} />}
            </View>

            {loadingVehicles && vehicles.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingText}>Loading active vehicles...</Text>
              </View>
            ) : vehicles.length === 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>No active vehicles available.</Text>
                <TouchableOpacity style={styles.retryButton} onPress={onRetryVehicles}>
                  <Text style={styles.retryButtonText}>Retry Loading Vehicles</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.vehicleList}>
                {vehicles.map((v) => {
                  const isSelected = selectedVehicleId === v.vehicleId;
                  return (
                    <TouchableOpacity
                      key={v.vehicleId}
                      style={[styles.vehicleCard, isSelected && styles.vehicleCardSelected]}
                      onPress={() => onSelectVehicle(v.vehicleId)}
                      disabled={isSubmitting}
                    >
                      <View style={styles.vehicleCardHeader}>
                        <Text style={[styles.vehiclePlate, isSelected && styles.vehiclePlateSelected]}>
                          {v.plateNumber}
                        </Text>
                        <Text style={styles.vehicleId}>{v.vehicleId}</Text>
                      </View>
                      {v.description && (
                        <Text style={styles.vehicleDescription} numberOfLines={1}>
                          {v.description}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {context.canScan ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              disabled={!canConfirm}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Update</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.scanNextButton} onPress={onCancel}>
            <Text style={styles.scanNextButtonText}>Scan Next Package</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface
  },
  scrollContent: {
    padding: spacing.md
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  packageBadge: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  packageBadgeText: {
    ...typography.eyebrow,
    color: colors.ink
  },
  statusBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent
  },
  terminalBadge: {
    backgroundColor: colors.successSoft
  },
  terminalBadgeText: {
    color: colors.success
  },
  idCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md
  },
  idLabel: {
    ...typography.eyebrow,
    marginBottom: 2
  },
  idValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.ink
  },
  shipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs
  },
  shipmentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkFaint,
    marginRight: 6
  },
  shipmentValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.inkSoft
  },
  assignedVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  assignedVehicleText: {
    fontSize: 12,
    color: colors.inkSoft,
    marginLeft: 6
  },
  transitionCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md
  },
  sectionTitle: {
    ...typography.eyebrow,
    marginBottom: spacing.sm
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around'
  },
  statusPillCurrent: {
    backgroundColor: '#EAE8DE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm
  },
  statusPillCurrentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft
  },
  statusPillNext: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm
  },
  statusPillNextText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  terminalCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md
  },
  terminalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    marginTop: 6,
    marginBottom: 4
  },
  terminalDescription: {
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 16
  },
  vehicleSection: {
    marginBottom: spacing.md
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.canvas,
    borderRadius: radius.md
  },
  loadingText: {
    fontSize: 13,
    color: colors.inkSoft,
    marginLeft: spacing.sm
  },
  errorBox: {
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: spacing.xs
  },
  retryButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  vehicleList: {
    gap: spacing.xs
  },
  vehicleCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  vehicleCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  vehiclePlate: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  },
  vehiclePlateSelected: {
    color: colors.accent
  },
  vehicleId: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.inkFaint
  },
  vehicleDescription: {
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkSoft
  },
  confirmButton: {
    flex: 2,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  confirmButtonDisabled: {
    backgroundColor: '#D9D8D3'
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  scanNextButton: {
    backgroundColor: colors.ink,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  scanNextButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});

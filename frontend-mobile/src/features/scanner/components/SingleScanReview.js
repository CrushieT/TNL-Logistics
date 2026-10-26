import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing, radius } from '../../../theme';
import { canSubmitSingle, getSingleScanPermission } from '../scannerFlow.mjs';
import VehiclePicker from './VehiclePicker';

export default function SingleScanReview({
  context,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  loadingVehicles,
  onRetryVehicles,
  isLoadingMoreVehicles = false,
  hasMoreVehicles = false,
  vehicleLoadError = '',
  vehiclePageError = '',
  onLoadNextVehicles,
  vehicleSearchValue = '',
  onVehicleSearchChange,
  vehicleRecommendations = [],
  isLoadingVehicleRecommendations = false,
  vehicleRecommendationError = '',
  onRetryVehicleRecommendation,
  onConfirm,
  onCancel,
  isSubmitting,
  isOnline,
  role
}) {
  if (!context) return null;

  const isVehicleRequired = Boolean(context.requiresVehicle);
  const permission = getSingleScanPermission(context, role);
  const canConfirm = canSubmitSingle(context, selectedVehicleId, role) && !isSubmitting && isOnline;

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
          <View style={[styles.statusBadge, !context.canScan && styles.terminalBadge, context.lost && styles.lostBadge]}>
            <Text style={[styles.statusBadgeText, !context.canScan && styles.terminalBadgeText, context.lost && styles.lostBadgeText]}>
              {context.lost ? 'Lost' : context.currentStatusLabel || context.currentStatusCode}
            </Text>
          </View>
        </View>
        {context.lost && <Text style={styles.lastConfirmedStatus}>
          Last confirmed: {context.currentStatusLabel || context.currentStatusCode}
        </Text>}

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
                {context.lost ? 'Last confirmed on' : 'Currently on'} {context.assignedVehiclePlateNumber} ({context.assignedVehicleId})
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
          <View style={[styles.terminalCard, context.lost && styles.lostCard]}>
            <Icon source={context.lost ? 'alert-circle-outline' : 'check-circle-outline'} size={24}
              color={context.lost ? colors.danger : colors.success} />
            <Text style={[styles.terminalTitle, context.lost && styles.lostTitle]}>
              {context.lost ? 'Lost Parcel' : 'Final Scanner Status Reached'}
            </Text>
            <Text style={styles.terminalDescription}>
              {context.scanBlockedReason || `This package is already at ${context.currentStatusLabel}. Further status changes are managed by hauler delivery or waybill POD.`}
            </Text>
          </View>
        )}

        {permission.isPermissionDenied && (
          <View style={styles.permissionCard}>
            <Icon source="shield-lock-outline" size={24} color={colors.warning} />
            <Text style={styles.permissionTitle}>Read-Only Scan Result</Text>
            <Text style={styles.permissionDescription}>{permission.message}</Text>
          </View>
        )}

        {/* Vehicle Selection for LOADED_ON_TRUCK */}
        {permission.isAllowed && isVehicleRequired && (
          <VehiclePicker
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={onSelectVehicle}
            isLoadingVehicles={loadingVehicles}
            isLoadingMoreVehicles={isLoadingMoreVehicles}
            hasMoreVehicles={hasMoreVehicles}
            vehicleLoadError={vehicleLoadError}
            vehiclePageError={vehiclePageError}
            onLoadRecentVehicles={onRetryVehicles}
            onLoadNextVehicles={onLoadNextVehicles}
            searchValue={vehicleSearchValue}
            onSearchChange={onVehicleSearchChange}
            recommendations={vehicleRecommendations}
            isLoadingRecommendations={isLoadingVehicleRecommendations}
            recommendationError={vehicleRecommendationError}
            onRetryRecommendation={onRetryVehicleRecommendation}
            isOnline={isOnline}
            disabled={isSubmitting}
          />
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {context.canScan && permission.isAllowed ? (
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
  lostBadge: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  lostBadgeText: { color: colors.danger },
  lastConfirmedStatus: { ...typography.mono, color: colors.inkSoft, marginBottom: spacing.sm },
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
  lostCard: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  permissionCard: {
    backgroundColor: colors.warningSoft || colors.canvas,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 6,
    marginBottom: 4
  },
  permissionDescription: {
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 16
  },
  terminalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    marginTop: 6,
    marginBottom: 4
  },
  lostTitle: { color: colors.danger },
  terminalDescription: {
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 16
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

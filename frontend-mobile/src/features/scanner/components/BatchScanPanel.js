import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing, radius } from '../../../theme';
import { BATCH_OPERATIONS, formatStatusLabel, canSubmitBatch, MAX_BATCH_SIZE } from '../scannerFlow.mjs';

export default function BatchScanPanel({
  operation,
  onSelectOperation,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  loadingVehicles,
  onRetryVehicles,
  queue,
  onRemoveItem,
  onClearBatch,
  onSubmit,
  isSubmitting
}) {
  const isVehicleRequired = operation === 'LOADED_ON_TRUCK';
  const canSubmit = canSubmitBatch(queue, operation, selectedVehicleId) && !isSubmitting;

  const renderQueueItem = ({ item, index }) => (
    <View style={styles.queueItemRow}>
      <Text style={styles.queueIndex}>#{index + 1}</Text>
      <Text style={styles.queueTrackingId}>{item}</Text>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemoveItem(item)}
        disabled={isSubmitting}
        accessibilityLabel={`Remove ${item} from batch`}
      >
        <Icon source="close" size={16} color={colors.inkFaint} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Operation Selection Segment */}
      <View style={styles.operationSection}>
        <Text style={styles.sectionEyebrow}>TARGET OPERATION *</Text>
        <View style={styles.operationButtonsRow}>
          {BATCH_OPERATIONS.map((op) => {
            const isSelected = operation === op;
            return (
              <TouchableOpacity
                key={op}
                style={[styles.opButton, isSelected && styles.opButtonSelected]}
                onPress={() => onSelectOperation(op)}
                disabled={isSubmitting}
              >
                <Text style={[styles.opButtonText, isSelected && styles.opButtonTextSelected]}>
                  {formatStatusLabel(op)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Vehicle Selection when LOADED_ON_TRUCK is chosen */}
      {isVehicleRequired && (
        <View style={styles.vehicleSection}>
          <View style={styles.vehicleHeader}>
            <Text style={styles.sectionEyebrow}>ASSIGN VEHICLE *</Text>
            {loadingVehicles && <ActivityIndicator size="small" color={colors.accent} />}
          </View>
          {vehicles.length === 0 && !loadingVehicles ? (
            <View style={styles.vehicleErrorBox}>
              <Text style={styles.vehicleErrorText}>No active vehicles found.</Text>
              <TouchableOpacity onPress={onRetryVehicles} style={styles.retryLink}>
                <Text style={styles.retryLinkText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.vehicleChipsRow}>
              {vehicles.map((v) => {
                const isSelected = selectedVehicleId === v.vehicleId;
                return (
                  <TouchableOpacity
                    key={v.vehicleId}
                    style={[styles.vehicleChip, isSelected && styles.vehicleChipSelected]}
                    onPress={() => onSelectVehicle(v.vehicleId)}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.vehicleChipPlate, isSelected && styles.vehicleChipPlateSelected]}>
                      {v.plateNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Queue Header & Counter */}
      <View style={styles.queueHeaderRow}>
        <View style={styles.queueCountBadge}>
          <Text style={styles.queueCountText}>
            {queue.length} / {MAX_BATCH_SIZE} PARCELS
          </Text>
        </View>
        {queue.length > 0 && (
          <TouchableOpacity onPress={onClearBatch} disabled={isSubmitting}>
            <Text style={styles.clearBatchText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Queue List */}
      <View style={styles.queueListContainer}>
        {queue.length === 0 ? (
          <View style={styles.emptyQueueBox}>
            <Icon source="barcode-scan" size={28} color={colors.inkFaint} />
            <Text style={styles.emptyQueueTitle}>
              {!operation
                ? 'Select an operation above to begin scanning'
                : isVehicleRequired && !selectedVehicleId
                ? 'Select a vehicle above to begin scanning'
                : 'Ready to scan parcels into batch'}
            </Text>
            <Text style={styles.emptyQueueSub}>
              Scan barcodes with camera or enter tracking IDs manually below
            </Text>
          </View>
        ) : (
          <FlatList
            data={queue}
            keyExtractor={(item) => item}
            renderItem={renderQueueItem}
            contentContainerStyle={styles.queueFlatList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              Submit {queue.length > 0 ? `${queue.length} Parcels` : 'Batch'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface
  },
  operationSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs
  },
  sectionEyebrow: {
    ...typography.eyebrow,
    marginBottom: spacing.xs
  },
  operationButtonsRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  opButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center'
  },
  opButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  opButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
    textAlign: 'center'
  },
  opButtonTextSelected: {
    color: '#FFFFFF'
  },
  vehicleSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  vehicleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  vehicleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas
  },
  vehicleChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  vehicleChipPlate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft
  },
  vehicleChipPlateSelected: {
    color: colors.accent
  },
  vehicleErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  vehicleErrorText: {
    fontSize: 12,
    color: colors.danger
  },
  retryLink: {
    paddingVertical: 2
  },
  retryLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent
  },
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs
  },
  queueCountBadge: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  queueCountText: {
    ...typography.eyebrow,
    color: colors.ink
  },
  clearBatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger
  },
  queueListContainer: {
    flex: 1,
    paddingHorizontal: spacing.md
  },
  emptyQueueBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  emptyQueueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs
  },
  emptyQueueSub: {
    fontSize: 11,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 2
  },
  queueFlatList: {
    paddingVertical: spacing.xs
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4
  },
  queueIndex: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.inkFaint,
    width: 28
  },
  queueTrackingId: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.ink
  },
  removeButton: {
    padding: 4
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  },
  submitButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  submitButtonDisabled: {
    backgroundColor: '#D9D8D3'
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});

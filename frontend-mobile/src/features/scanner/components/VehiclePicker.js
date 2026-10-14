import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing, radius } from '../../../theme';
import { VEHICLE_SEARCH_MIN_LENGTH } from '../vehicleOptionsFlow.mjs';

export default function VehiclePicker({
  vehicles = [],
  selectedVehicleId = null,
  onSelectVehicle,
  isLoadingVehicles = false,
  isLoadingMoreVehicles = false,
  hasMoreVehicles = false,
  vehicleLoadError = '',
  vehiclePageError = '',
  onLoadRecentVehicles,
  onLoadNextVehicles,
  searchValue = '',
  onSearchChange,
  recommendations = [],
  isLoadingRecommendations = false,
  recommendationError = '',
  onRetryRecommendation,
  isOnline = true,
  disabled = false
}) {
  const [isChanging, setIsChanging] = useState(false);
  const isRecommendationSearchActive = (searchValue || '').trim().length >= VEHICLE_SEARCH_MIN_LENGTH;

  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return (
      vehicles.find((v) => v.vehicleId === selectedVehicleId) ||
      recommendations.find((v) => v.vehicleId === selectedVehicleId) ||
      { vehicleId: selectedVehicleId, plateNumber: selectedVehicleId }
    );
  }, [selectedVehicleId, vehicles, recommendations]);

  if (selectedVehicle && !isChanging) {
    return (
      <View style={styles.activeShipmentCard}>
        <View style={styles.activeShipmentHeader}>
          <View style={styles.shipmentBadge}>
            <Text style={styles.shipmentBadgeText}>VEHICLE</Text>
          </View>
          <Text style={styles.activeShipmentId}>
            {selectedVehicle.plateNumber || selectedVehicle.vehicleId}
          </Text>
          <TouchableOpacity
            style={styles.changeLink}
            onPress={() => setIsChanging(true)}
            disabled={disabled}
            accessibilityLabel="Change vehicle"
          >
            <Text style={styles.changeLinkText}>CHANGE</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.activeShipmentRecipient} numberOfLines={1}>
          {selectedVehicle.vehicleId}
          {selectedVehicle.description ? ` · ${selectedVehicle.description}` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionEyebrow}>ASSIGN VEHICLE *</Text>
        {isChanging && selectedVehicle ? (
          <TouchableOpacity onPress={() => setIsChanging(false)} disabled={disabled}>
            <Text style={styles.cancelLinkText}>CANCEL</Text>
          </TouchableOpacity>
        ) : (isLoadingVehicles || isLoadingRecommendations) ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : null}
      </View>

      <View style={styles.inputActionRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Plate or vehicle ID..."
          placeholderTextColor={colors.inkFaint}
          value={searchValue}
          onChangeText={onSearchChange}
          autoCapitalize="characters"
          maxLength={20}
          editable={isOnline && !disabled}
        />
        {Boolean(searchValue) && (
          <TouchableOpacity
            style={styles.actionButtonCompact}
            onPress={() => onSearchChange('')}
            disabled={disabled}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.actionButtonText}>CLEAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {isRecommendationSearchActive ? (
        <View style={styles.recommendationPanel}>
          <Text style={[styles.subtleLabel, styles.recommendationLabel]}>
            Vehicle Recommendations
          </Text>
          {isLoadingRecommendations ? (
            <View style={styles.inlineStateRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.inlineStateText}>Searching vehicles...</Text>
            </View>
          ) : recommendationError ? (
            <View style={styles.inlineStateRow}>
              <Text style={styles.inlineStateText}>{recommendationError}</Text>
              {onRetryRecommendation && (
                <TouchableOpacity onPress={onRetryRecommendation} disabled={!isOnline || disabled}>
                  <Text style={styles.inlineRetryText}>RETRY</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : recommendations.length === 0 ? (
            <Text style={[styles.inlineStateText, styles.recommendationEmptyText]}>
              No matching vehicles found.
            </Text>
          ) : (
            recommendations.map((v) => (
              <TouchableOpacity
                key={v.vehicleId}
                style={styles.recommendationRow}
                onPress={() => {
                  onSelectVehicle(v.vehicleId);
                  setIsChanging(false);
                }}
                disabled={!isOnline || disabled}
              >
                <View style={styles.recommendationTextGroup}>
                  <Text style={styles.shipmentChipId}>{v.plateNumber || v.vehicleId}</Text>
                  <Text style={styles.shipmentChipSub} numberOfLines={1}>
                    {v.vehicleId}{v.description ? ` · ${v.description}` : ''}
                  </Text>
                </View>
                <Icon source="chevron-right" size={18} color={colors.inkFaint} />
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={styles.chipListContainer}>
          <Text style={styles.subtleLabel}>Recent Vehicles</Text>
          {isLoadingVehicles && vehicles.length === 0 ? (
            <View style={styles.inlineStateRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.inlineStateText}>Loading active vehicles...</Text>
            </View>
          ) : vehicleLoadError && vehicles.length === 0 ? (
            <View style={styles.inlineStateRow}>
              <Text style={styles.inlineStateText}>{vehicleLoadError}</Text>
              <TouchableOpacity onPress={onLoadRecentVehicles} disabled={!isOnline || disabled}>
                <Text style={styles.inlineRetryText}>RETRY</Text>
              </TouchableOpacity>
            </View>
          ) : vehicles.length === 0 ? (
            <Text style={styles.inlineStateText}>No vehicles are available.</Text>
          ) : (
            <FlatList
              horizontal
              keyboardShouldPersistTaps="handled"
              data={vehicles}
              keyExtractor={(v) => v.vehicleId}
              renderItem={({ item: v }) => {
                const isSelected = selectedVehicleId === v.vehicleId;
                return (
                  <TouchableOpacity
                    style={[styles.shipmentChip, isSelected && styles.shipmentChipSelected]}
                    onPress={() => {
                      onSelectVehicle(v.vehicleId);
                      setIsChanging(false);
                    }}
                    disabled={!isOnline || disabled}
                  >
                    <Text style={[styles.shipmentChipId, isSelected && styles.shipmentChipIdSelected]}>
                      {v.plateNumber || v.vehicleId}
                    </Text>
                    <Text
                      style={[styles.shipmentChipSub, isSelected && styles.shipmentChipSubSelected]}
                      numberOfLines={1}
                    >
                      {v.vehicleId}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              showsHorizontalScrollIndicator={false}
              onEndReached={onLoadNextVehicles}
              onEndReachedThreshold={0.4}
              contentContainerStyle={styles.chipListContent}
              ListFooterComponent={(
                <View style={styles.railFooter}>
                  {isLoadingMoreVehicles || (isLoadingVehicles && vehicles.length > 0) ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : vehiclePageError ? (
                    <TouchableOpacity onPress={onLoadNextVehicles} disabled={!isOnline || disabled}>
                      <Text style={styles.inlineRetryText}>RETRY MORE</Text>
                    </TouchableOpacity>
                  ) : vehicleLoadError ? (
                    <TouchableOpacity onPress={onLoadRecentVehicles} disabled={!isOnline || disabled}>
                      <Text style={styles.inlineRetryText}>RETRY REFRESH</Text>
                    </TouchableOpacity>
                  ) : !hasMoreVehicles ? (
                    <Text style={styles.railEndText}>END</Text>
                  ) : null}
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionEyebrow: {
    ...typography.eyebrow,
    color: colors.inkFaint,
    fontSize: 11
  },
  cancelLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft
  },
  inputActionRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.ink
  },
  actionButtonCompact: {
    height: 40,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  chipListContainer: {
    marginTop: spacing.xs,
    gap: 4
  },
  subtleLabel: {
    fontSize: 11,
    color: colors.inkFaint
  },
  chipListContent: {
    alignItems: 'stretch'
  },
  shipmentChip: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  shipmentChipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1.5
  },
  shipmentChipId: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  shipmentChipIdSelected: {
    color: colors.accent
  },
  shipmentChipSub: {
    fontSize: 10,
    color: colors.inkSoft,
    maxWidth: 100
  },
  shipmentChipSubSelected: {
    color: colors.accent
  },
  railFooter: {
    minWidth: 52,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs
  },
  railEndText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8
  },
  inlineStateRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  inlineStateText: {
    flex: 1,
    fontSize: 11,
    color: colors.inkFaint
  },
  inlineRetryText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent
  },
  recommendationPanel: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden'
  },
  recommendationLabel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface
  },
  recommendationRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas
  },
  recommendationTextGroup: {
    flex: 1,
    gap: 1
  },
  recommendationEmptyText: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8
  },
  activeShipmentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
    marginBottom: spacing.xs
  },
  activeShipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  shipmentBadge: {
    backgroundColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2
  },
  shipmentBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },
  activeShipmentId: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  changeLink: {
    padding: 4
  },
  changeLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent
  },
  activeShipmentRecipient: {
    fontSize: 13,
    color: colors.inkSoft
  }
});

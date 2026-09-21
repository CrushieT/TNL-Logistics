import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { colors, typography } from '../../../theme';
import { SyncStatusBadge } from './SyncStatusBadge';
import { formatPackageDisplay, resolveTrackingStatusDisplay } from '../trackingHistoryFlow.mjs';

function getStatusBadgeStyle(statusCode) {
  switch (statusCode) {
    case 'REGISTERED':
      return { borderColor: '#2563EB', textColor: '#2563EB', dotColor: '#2563EB' };
    case 'ARRIVED_AT_TNL':
      return { borderColor: '#16A34A', textColor: '#16A34A', dotColor: '#16A34A' };
    case 'QR_GENERATED':
    case 'LOADED_ON_TRUCK':
    case 'LOADED_TO_HAULER':
    case 'COMPLETED':
    default:
      return { borderColor: colors.borderStrong, textColor: colors.ink, dotColor: null };
  }
}

export function PersonalParcelSummary({ parcel }) {
  if (!parcel) return null;

  const trackingId = parcel.trackingId || '—';
  const packageBadge = formatPackageDisplay(parcel.packageIndex, parcel.packageCount);
  const shipmentId = parcel.shipmentId || '—';
  const currentStatusDisplay = resolveTrackingStatusDisplay(
    parcel.currentStatusDisplay,
    parcel.currentStatusCode
  );
  const labelStatusDisplay = parcel.labelStatusDisplay
    || parcel.labelStatusCode
    || 'STATUS UNAVAILABLE';
  const currentVehicleDisplay = parcel.currentVehicleId
    ? parcel.currentVehiclePlateNumber
      ? `${parcel.currentVehicleId} · ${parcel.currentVehiclePlateNumber}`
      : parcel.currentVehicleId
    : null;

  const statusBadgeStyle = getStatusBadgeStyle(parcel.currentStatusCode);
  const isLabelPrinted = parcel.labelStatusCode === 'PRINTED' || parcel.labelStatusCode === 'REPRINTED';

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Tracking ID</Text>
      <Text style={styles.trackingId}>{trackingId}</Text>

      <View style={styles.packageBadgeWrapper}>
        <View style={styles.packageBadge}>
          <Text style={styles.packageBadgeText}>{packageBadge}</Text>
        </View>
      </View>

      <View style={styles.dataRow}>
        <Text style={styles.fieldLabel}>Shipment</Text>
        <Text style={styles.fieldValueMono}>{shipmentId}</Text>
      </View>

      {Boolean(currentVehicleDisplay) && (
        <View style={styles.dataRow}>
          <Text style={styles.fieldLabel}>Assigned Vehicle</Text>
          <Text style={styles.fieldValue}>{currentVehicleDisplay}</Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.statusRow}>
        <Text style={styles.statusFieldLabel}>Current Status</Text>
        <View style={[styles.statusBadge, { borderColor: statusBadgeStyle.borderColor }]}>
          {statusBadgeStyle.dotColor && (
            <View style={[styles.statusDot, { backgroundColor: statusBadgeStyle.dotColor }]} />
          )}
          <Text style={[styles.statusBadgeText, { color: statusBadgeStyle.textColor }]}>
            {currentStatusDisplay}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusFieldLabel}>Label Status</Text>
        <View
          style={[
            styles.statusBadge,
            {
              borderColor: isLabelPrinted ? '#16A34A' : colors.border,
            },
          ]}
        >
          {isLabelPrinted && <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />}
          <Text
            style={[
              styles.statusBadgeText,
              { color: isLabelPrinted ? '#16A34A' : colors.inkSoft },
            ]}
          >
            {`Label: ${labelStatusDisplay}`}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusFieldLabel}>Sync Status</Text>
        <SyncStatusBadge syncStatus="SYNCED" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  eyebrow: {
    ...typography.eyebrow,
    marginBottom: 4,
  },
  trackingId: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  packageBadgeWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  packageBadge: {
    backgroundColor: colors.black,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  packageBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '700',
  },
  fieldValueMono: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statusFieldLabel: {
    fontSize: 13,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

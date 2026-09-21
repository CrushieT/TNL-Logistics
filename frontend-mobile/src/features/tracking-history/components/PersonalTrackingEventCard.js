import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { colors, typography } from '../../../theme';
import { PressableScale } from '../../../components/common/PressableScale';
import { SyncStatusBadge } from './SyncStatusBadge';
import {
  formatHistoryTimestamp,
  formatPackageDisplay,
  resolveTrackingStatusDisplay,
} from '../trackingHistoryFlow.mjs';

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

export function PersonalTrackingEventCard({ event, onPress }) {
  if (!event) return null;

  const trackingId = event.trackingId || '—';
  const packageDisplay = formatPackageDisplay(event.packageIndex, event.packageCount);
  const statusDisplay = resolveTrackingStatusDisplay(event.statusDisplay, event.statusCode);
  const formattedTimestamp = formatHistoryTimestamp(event.timestamp);
  const badgeStyle = getStatusBadgeStyle(event.statusCode);

  const vehicleDisplay = event.vehicleId
    ? event.vehiclePlateNumber
      ? `${event.vehicleId} · ${event.vehiclePlateNumber}`
      : event.vehicleId
    : null;

  return (
    <PressableScale
      style={styles.container}
      contentStyle={styles.cardContent}
      onPress={() => onPress && onPress(event)}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`View tracking event for ${trackingId}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.trackingId}>{trackingId}</Text>
        <View style={[styles.statusBadge, { borderColor: badgeStyle.borderColor }]}>
          {badgeStyle.dotColor && <View style={[styles.statusDot, { backgroundColor: badgeStyle.dotColor }]} />}
          <Text style={[styles.statusText, { color: badgeStyle.textColor }]}>{statusDisplay}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{packageDisplay}</Text>
        <Text style={styles.metaDivider}>·</Text>
        <Text style={styles.metaText}>{formattedTimestamp}</Text>
      </View>

      {Boolean(vehicleDisplay) && (
        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleLabel}>Vehicle:</Text>
          <Text style={styles.vehicleValue}>{vehicleDisplay}</Text>
        </View>
      )}

      <View style={styles.bottomRow}>
        <SyncStatusBadge syncStatus={event.syncStatus || 'SYNCED'} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 5,
  },
  cardContent: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  trackingId: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  metaDivider: {
    marginHorizontal: 6,
    color: colors.inkFaint,
    fontSize: 12,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleLabel: {
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '600',
    marginRight: 6,
  },
  vehicleValue: {
    fontSize: 11,
    color: colors.ink,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
});

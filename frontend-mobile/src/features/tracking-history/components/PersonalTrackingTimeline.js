import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors } from '../../../theme';
import { SyncStatusBadge } from './SyncStatusBadge';
import { formatHistoryTimestamp, resolveTrackingStatusDisplay } from '../trackingHistoryFlow.mjs';

export function PersonalTrackingTimeline({ events = [] }) {
  if (!events || events.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No personal scan events recorded for this parcel.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const statusDisplay = resolveTrackingStatusDisplay(event.statusDisplay, event.statusCode);
        const formattedTimestamp = formatHistoryTimestamp(event.timestamp);
        const vehicleDisplay = event.vehicleId
          ? event.vehiclePlateNumber
            ? `${event.vehicleId} · ${event.vehiclePlateNumber}`
            : event.vehicleId
          : null;

        return (
          <View key={event.eventId ?? index} style={styles.timelineItem}>
            {/* Left rail with orange dot and vertical connector line */}
            <View style={styles.rail}>
              <View style={styles.dot} />
              {!isLast && <View style={styles.connector} />}
            </View>

            {/* Right content column */}
            <View style={[styles.content, !isLast && styles.contentSpaced]}>
              <Text style={styles.statusTitle}>{statusDisplay}</Text>
              <Text style={styles.timestampText}>{formattedTimestamp}</Text>

              {Boolean(vehicleDisplay) && (
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleLabel}>Vehicle:</Text>
                  <Text style={styles.vehicleValue}>{vehicleDisplay}</Text>
                </View>
              )}

              <View style={styles.syncRow}>
                <SyncStatusBadge syncStatus={event.syncStatus || 'SYNCED'} />
              </View>
            </View>
          </View>
        );
      })}
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
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: 12,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  rail: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingLeft: 12,
  },
  contentSpaced: {
    paddingBottom: 22,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  timestampText: {
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  vehicleLabel: {
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '600',
    marginRight: 4,
  },
  vehicleValue: {
    fontSize: 11,
    color: colors.ink,
    fontWeight: '700',
  },
  syncRow: {
    marginTop: 4,
  },
});

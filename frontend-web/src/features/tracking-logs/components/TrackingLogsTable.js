import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { colors, fonts, spacing, radius } from '../../../theme';

export default function TrackingLogsTable({
  logs = [],
  loading = false,
  page = 0,
  pageSize = 25,
  totalElements = 0,
  totalPages = 0,
  onPageChange,
  onPageSizeChange,
  highlightedEventIds = new Set(),
}) {
  const router = useRouter();

  const handleTrackingClick = (log) => {
    if (log.shipmentId && log.trackingId) {
      router.push(`/shipments/${log.shipmentId}/units/${log.trackingId}`);
    } else if (log.trackingId) {
      router.push(`/shipments?search=${encodeURIComponent(log.trackingId)}`);
    }
  };

  return (
    <Card style={styles.card}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.colTimestamp]}>TIMESTAMP</Text>
        <Text style={[styles.headerCell, styles.colEvent]}>EVENT</Text>
        <Text style={[styles.headerCell, styles.colTracking]}>TRACKING ID</Text>
        <Text style={[styles.headerCell, styles.colPackage]}>PACKAGE</Text>
        <Text style={[styles.headerCell, styles.colStaff]}>STAFF</Text>
      </View>

      {/* Loading State */}
      {loading && logs.length === 0 ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.ink} />
          <Text style={styles.stateText}>Loading audit trail...</Text>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyTitle}>No tracking events found</Text>
          <Text style={styles.emptySubtitle}>
            No parcel scans match your active filter or search criteria.
          </Text>
        </View>
      ) : (
        <View style={styles.tableBody}>
          {logs.map((log) => {
            const isHighlighted = highlightedEventIds.has(log.eventId);
            const isClickable = Boolean(log.trackingId);

            return (
              <View
                key={log.eventId || `${log.trackingId}-${log.timestamp}`}
                style={[
                  styles.tableRow,
                  isHighlighted && styles.rowHighlighted,
                ]}
              >
                {/* Timestamp */}
                <View style={styles.colTimestamp}>
                  <Text style={styles.timestampText}>
                    {log.formattedTimestamp || '—'}
                  </Text>
                </View>

                {/* Event Name + Vehicle Badge if applicable */}
                <View style={[styles.colEvent, styles.eventContainer]}>
                  <Text style={styles.eventText}>
                    {log.statusDisplay || log.status || '—'}
                  </Text>
                  {log.vehiclePlateNumber ? (
                    <View style={styles.vehicleBadge}>
                      <Text style={styles.vehicleBadgeText}>
                        {log.vehiclePlateNumber}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Tracking ID (Clickable) */}
                <View style={styles.colTracking}>
                  {isClickable ? (
                    <Pressable
                      onPress={() => handleTrackingClick(log)}
                      style={styles.trackingLink}
                    >
                      <Text style={styles.trackingIdText}>{log.trackingId}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.trackingIdText}>—</Text>
                  )}
                </View>

                {/* Package Progress (e.g. 1 of 2) */}
                <View style={styles.colPackage}>
                  <Text style={styles.packageText}>
                    {log.packageDisplay || '1 of 1'}
                  </Text>
                </View>

                {/* Staff Member */}
                <View style={styles.colStaff}>
                  <Text style={styles.staffText}>
                    {log.staffName || log.staffUsername || '—'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Pagination Footer */}
      {totalElements > 0 ? (
        <View style={styles.paginationFooter}>
          <View style={styles.paginationMeta}>
            <Text style={styles.paginationText}>
              Showing <Text style={styles.paginationStrong}>{logs.length}</Text> of{' '}
              <Text style={styles.paginationStrong}>{totalElements}</Text> events
              <Text style={styles.paginationDot}> · </Text>
              Page <Text style={styles.paginationStrong}>{page + 1}</Text> of{' '}
              <Text style={styles.paginationStrong}>{totalPages || 1}</Text>
            </Text>
          </View>

          <View style={styles.paginationActions}>
            {Platform.OS === 'web' && onPageSizeChange ? (
              <View style={styles.pageSizeSelectWrap}>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  style={webSelectStyle}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </View>
            ) : null}

            <Button
              label="← Previous"
              variant="secondary"
              disabled={page <= 0 || loading}
              onPress={() => onPageChange?.(page - 1)}
              style={styles.pageBtn}
            />

            <Button
              label="Next →"
              variant="secondary"
              disabled={page >= totalPages - 1 || loading}
              onPress={() => onPageChange?.(page + 1)}
              style={styles.pageBtn}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const webSelectStyle = {
  fontFamily: fonts.mono,
  fontSize: 11.5,
  color: colors.ink,
  border: `1px solid ${colors.border}`,
  backgroundColor: '#FFFFFF',
  padding: '6px 8px',
  borderRadius: 3,
  outline: 'none',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    padding: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#FAF9F5',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerCell: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  colTimestamp: {
    flex: 1.8,
    paddingRight: 12,
  },
  colEvent: {
    flex: 2.2,
    paddingRight: 12,
  },
  colTracking: {
    flex: 2.0,
    paddingRight: 12,
  },
  colPackage: {
    flex: 1.2,
    paddingRight: 12,
  },
  colStaff: {
    flex: 1.8,
  },
  tableBody: {
    backgroundColor: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 46,
  },
  rowHighlighted: {
    backgroundColor: '#FFF7ED', // subtle warm amber pulse for newly prepended SSE scans
  },
  timestampText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  eventContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  eventText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.accent, // Burnt orange from prototype
  },
  vehicleBadge: {
    backgroundColor: '#F3F2ED',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vehicleBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  trackingLink: {
    alignSelf: 'flex-start',
  },
  trackingIdText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.2,
  },
  packageText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  staffText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
    fontWeight: '500',
  },
  stateContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
    marginTop: 12,
  },
  emptyTitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkFaint,
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  paginationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  paginationStrong: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.ink,
  },
  paginationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageSizeSelectWrap: {
    marginRight: spacing.xs,
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
  },
});

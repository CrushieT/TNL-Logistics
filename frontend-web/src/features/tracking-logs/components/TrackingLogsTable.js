import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Card from '../../../components/common/Card';
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

  const startRecord = totalElements === 0 ? 0 : page * pageSize + 1;
  const endRecord = Math.min((page + 1) * pageSize, totalElements);

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
          <View style={styles.paginationInfo}>
            <Text style={styles.paginationInfoText}>
              Showing <Text style={styles.paginationInfoBold}>{startRecord}</Text>–
              <Text style={styles.paginationInfoBold}>{endRecord}</Text> of{' '}
              <Text style={styles.paginationInfoBold}>{totalElements}</Text> events
            </Text>

            {/* Page Size Selector */}
            <View style={styles.pageSizeWrapper}>
              <Text style={styles.pageSizeLabel}>Rows:</Text>
              {[10, 25, 50].map((size) => (
                <Pressable
                  key={size}
                  style={[
                    styles.pageSizeBtn,
                    pageSize === size && styles.pageSizeBtnActive,
                  ]}
                  onPress={() => onPageSizeChange(size)}
                >
                  <Text
                    style={[
                      styles.pageSizeBtnText,
                      pageSize === size && styles.pageSizeBtnTextActive,
                    ]}
                  >
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Prev / Next Controls */}
          <View style={styles.paginationControls}>
            <Pressable
              style={[
                styles.pageButton,
                page <= 0 && styles.pageButtonDisabled,
              ]}
              disabled={page <= 0 || loading}
              onPress={() => onPageChange(page - 1)}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  page <= 0 && styles.pageButtonTextDisabled,
                ]}
              >
                ← Prev
              </Text>
            </Pressable>

            <View style={styles.pageIndicator}>
              <Text style={styles.pageIndicatorText}>
                Page {page + 1} of {Math.max(1, totalPages)}
              </Text>
            </View>

            <Pressable
              style={[
                styles.pageButton,
                page >= totalPages - 1 && styles.pageButtonDisabled,
              ]}
              disabled={page >= totalPages - 1 || loading}
              onPress={() => onPageChange(page + 1)}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  page >= totalPages - 1 && styles.pageButtonTextDisabled,
                ]}
              >
                Next →
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
    flexWrap: 'wrap',
    gap: 12,
  },
  paginationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  paginationInfoText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  paginationInfoBold: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.ink,
  },
  pageSizeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageSizeLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '600',
  },
  pageSizeBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  pageSizeBtnActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  pageSizeBtnText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  pageSizeBtnTextActive: {
    color: '#FFFFFF',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  pageButtonTextDisabled: {
    color: colors.inkFaint,
  },
  pageIndicator: {
    paddingHorizontal: 8,
  },
  pageIndicatorText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkSoft,
  },
});

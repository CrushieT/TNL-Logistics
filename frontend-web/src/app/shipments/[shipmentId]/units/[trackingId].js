import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppShell from '../../../../components/layout/AppShell';
import Card from '../../../../components/common/Card';
import StatusBadge from '../../../../components/common/StatusBadge';
import QRCodeGenerator from '../../../../components/common/QRCodeGenerator';
import { getParcelUnit, subscribeRealtimeEvents } from '../../../../features/shipments';
import { colors, fonts, spacing, radius, type } from '../../../../theme';

const STATUS_FLOW = ['Registered', 'QR Generated', 'Loaded on Truck', 'Arrived at TNL', 'Loaded to Hauler'];

export default function ParcelUnitDetailScreen() {
  const router = useRouter();
  const { shipmentId, trackingId } = useLocalSearchParams();
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (showSpinner = true) => {
    if (!trackingId) return;
    try {
      if (showSpinner) setLoading(true);
      const data = await getParcelUnit(trackingId);
      if (data) {
        setUnit(data);
      }
    } catch (err) {
      console.warn('Parcel unit fetch failed:', err?.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [trackingId]);

  useEffect(() => {
    load(true);
  }, [load]);

  // Real-time SSE listener
  useEffect(() => {
    const handleSilentRefresh = () => {
      load(false);
    };

    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.data?.trackingId === trackingId || event.data?.shipmentId === shipmentId) {
        handleSilentRefresh();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSilentRefresh);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSilentRefresh);
      }
    };
  }, [load, trackingId, shipmentId]);

  if (loading) {
    return (
      <AppShell>
        <Pressable onPress={() => router.push(`/shipments/${shipmentId}`)}>
          <Text style={styles.backLink}>← {shipmentId}</Text>
        </Pressable>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.ink} size="large" />
          <Text style={styles.loadingText}>Loading parcel unit {trackingId}...</Text>
        </View>
      </AppShell>
    );
  }

  if (!unit) {
    return (
      <AppShell>
        <Pressable onPress={() => router.push(`/shipments/${shipmentId}`)}>
          <Text style={styles.backLink}>← {shipmentId}</Text>
        </Pressable>
        <Card>
          <Text style={styles.notFoundText}>Parcel unit {trackingId} was not found.</Text>
        </Card>
      </AppShell>
    );
  }

  const dimensionsLabel = `${unit.lengthCm || 20} × ${unit.widthCm || 10} × ${unit.heightCm || 15} cm`;
  const volumeLabel = `${Number(unit.volumeCbm || 0.003).toFixed(4)} m³`;
  const completedEvents = unit.history || [];

  // Find the single immediate next status in the sequence
  const completedEventNames = new Set(completedEvents.map((e) => e.event));
  const nextPendingStatus = STATUS_FLOW.find((s) => !completedEventNames.has(s));

  return (
    <AppShell>
      <Pressable onPress={() => router.push(`/shipments/${shipmentId}`)}>
        <Text style={styles.backLink}>← {shipmentId}</Text>
      </Pressable>

      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>
            {unit.trackingId} · PACKAGE {unit.packageIndex} OF {unit.packageCount}
          </Text>
          <Text style={styles.title}>{(unit.recipientName || '').toUpperCase()}</Text>
        </View>
        <View style={styles.badgeRow}>
          <StatusBadge value={unit.status} kind="status" />
          <StatusBadge value={unit.labelStatus} kind="label" />
        </View>
      </View>

      <View style={styles.row}>
        {/* Left Column: Metadata & Tracking History */}
        <View style={styles.mainCol}>
          {/* Card 1: Package & Recipient */}
          <Card title="PACKAGE & RECIPIENT" style={styles.cardSpacing}>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>TRACKING ID</Text>
                <Text style={styles.fieldValueMono}>{unit.trackingId}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>PACKAGE</Text>
                <Text style={styles.fieldValue}>{unit.packageIndex} of {unit.packageCount}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>SHIPMENT</Text>
                <Pressable onPress={() => router.push(`/shipments/${unit.shipmentId}`)}>
                  <Text style={styles.fieldValueOrange}>{unit.shipmentId}</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.gridRow, { marginTop: spacing.md }]}>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>CLIENT</Text>
                <Text style={styles.fieldValue}>{unit.client}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>DIMENSIONS · VOLUME</Text>
                <Text style={styles.fieldValue}>{dimensionsLabel} · {volumeLabel}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>ROUTE</Text>
                <Text style={styles.fieldValue}>{unit.route}</Text>
              </View>
            </View>
          </Card>

          {/* Card 2: Tracking History */}
          <Card
            title="TRACKING HISTORY"
            right={<Text style={styles.appendOnly}>append-only · this package only</Text>}
          >
            <View style={styles.timeline}>
              {/* Completed Events */}
              {completedEvents.map((entry, idx) => {
                const hasNextItem = idx < completedEvents.length - 1 || Boolean(nextPendingStatus);
                return (
                  <View key={`${entry.event}-${idx}`} style={styles.timelineItem}>
                    {/* Marker & Connecting Line */}
                    <View style={styles.timelineMarkerCol}>
                      <View style={styles.timelineDotFilled} />
                      {hasNextItem && <View style={styles.timelineLine} />}
                    </View>

                    {/* Event Content */}
                    <View style={[styles.timelineContent, hasNextItem && styles.timelineContentSpacing]}>
                      <View style={styles.eventTitleRow}>
                        <Text style={styles.eventTitle}>{entry.event}</Text>
                        <Text style={styles.eventTimestamp}>{entry.date} · {entry.time}</Text>
                      </View>
                      <Text style={styles.eventStaff}>by {entry.by}</Text>
                    </View>
                  </View>
                );
              })}

              {/* Single Immediate Next Pending Status */}
              {nextPendingStatus ? (
                <View style={styles.timelineItem}>
                  <View style={styles.timelineMarkerCol}>
                    <View style={styles.timelineDotHollow} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.pendingStatusText}>
                      {nextPendingStatus} — pending mobile scan
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </Card>
        </View>

        {/* Right Column: High-Contrast 2D QR Code & Label Printing Card */}
        <View style={styles.sideCol}>
          {/* QR Label Card */}
          <View style={styles.qrCard}>
            <Text style={styles.qrBrand}>TNL LOGISTICS</Text>
            <View style={styles.qrBox}>
              <QRCodeGenerator size={140} value={unit.trackingId} />
            </View>
            <Text style={styles.qrTracking}>{unit.trackingId}</Text>
            <View style={styles.dashedDivider} />
            <Text style={styles.qrScanHint}>SCAN TO TRACK</Text>
          </View>

          {/* Action Buttons */}
          <Pressable
            style={styles.reprintBtn}
            onPress={() => {
              if (typeof window !== 'undefined' && window.print) {
                window.print();
              }
            }}
          >
            <Text style={styles.reprintBtnText}>Reprint Label</Text>
          </Pressable>

          <Pressable
            style={styles.quickReprintBtn}
            onPress={() => {
              if (typeof window !== 'undefined' && window.print) {
                window.print();
              }
            }}
          >
            <Text style={styles.quickReprintText}>Quick Reprint ({unit.reprintCount || 0})</Text>
          </Pressable>

          {/* Label Printing Card */}
          <Card title="LABEL PRINTING" style={styles.printingCard}>
            <View style={styles.printBadgeRow}>
              <StatusBadge value={unit.printing?.status || 'Printed'} kind="label" />
            </View>
            <View style={styles.printDetailsRow}>
              <View>
                <Text style={styles.printType}>Print</Text>
                <Text style={styles.printDate}>{unit.printing?.date}</Text>
                <Text style={styles.printStaff}>
                  by {unit.printing?.by} · {unit.printing?.printer}
                </Text>
              </View>
              <Text style={styles.printLabelCount}>{unit.printing?.count || 1} label</Text>
            </View>
          </Card>
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.inkFaint,
  },
  notFoundText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.danger,
    padding: spacing.xl,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.inkFaint,
    fontWeight: '600',
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  mainCol: {
    flex: 1,
    minWidth: 280,
  },
  cardSpacing: {
    marginBottom: spacing.lg,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridCol: {
    flex: 1,
  },
  fieldLabel: {
    ...type.label,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.inkFaint,
    marginBottom: 4,
  },
  fieldValue: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.ink,
    fontWeight: '500',
  },
  fieldValueMono: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  fieldValueOrange: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.accent,
  },
  appendOnly: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  timeline: {
    paddingVertical: spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineMarkerCol: {
    width: 20,
    alignItems: 'center',
  },
  timelineDotFilled: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  timelineDotHollow: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: colors.accent,
    marginVertical: 3,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.sm,
  },
  timelineContentSpacing: {
    paddingBottom: spacing.lg,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  eventTitle: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  eventTimestamp: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkFaint,
  },
  eventStaff: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: 2,
  },
  eventRemarks: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  pendingStatusText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 1,
  },
  sideCol: {
    width: 280,
    gap: spacing.sm,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  qrBrand: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 6,
  },
  qrTracking: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.md,
  },
  dashedDivider: {
    width: 140,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderStyle: 'dashed',
    marginVertical: spacing.xs + 2,
  },
  qrScanHint: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  reprintBtn: {
    backgroundColor: colors.ink,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  reprintBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  quickReprintBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  quickReprintText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.ink,
  },
  printingCard: {
    marginTop: spacing.xs,
  },
  printBadgeRow: {
    marginBottom: spacing.sm,
  },
  printDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  printType: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  printDate: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  printStaff: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 1,
  },
  printLabelCount: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkFaint,
  },
});

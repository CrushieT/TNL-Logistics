import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppShell from '../../../../components/layout/AppShell';
import Card from '../../../../components/common/Card';
import Button from '../../../../components/common/Button';
import StatusBadge from '../../../../components/common/StatusBadge';
import QRCodeGenerator from '../../../../components/common/QRCodeGenerator';
import { getParcelUnit } from '../../../../features/shipments';
import { colors, fonts, spacing, type } from '../../../../theme';

const STATUS_SEQUENCE = ['Registered', 'QR Generated', 'Loaded on Truck', 'Arrived at TNL', 'Loaded to Hauler'];

const FALLBACK_UNIT = {
  trackingId: 'TRK-2026-000114',
  packageIndex: 1,
  packageCount: 3,
  recipientName: 'Aundray Tafalla',
  shipmentId: 'SHP-2026-011',
  status: 'Registered',
  labelStatus: 'Printed',
  client: 'Northbridge Trading',
  weight: 1,
  route: 'Manila → TNL Baguio',
  history: [
    { event: 'Registered', date: 'Aug 24, 2026', time: '5:01 PM', by: 'Andrea Lim', done: true },
    { event: 'QR Generated', date: 'Aug 24, 2026', time: '5:01 PM', by: 'Andrea Lim', done: true },
    { event: 'Loaded on Truck', pending: true, pendingNote: 'pending mobile scan' },
  ],
  printing: {
    status: 'Printed',
    date: 'Aug 24, 2026 · 5:01 PM',
    by: 'Maria Santos',
    printer: 'Brother RJ-2035B',
    count: 1,
  },
};

export default function ParcelUnitDetailScreen() {
  const router = useRouter();
  const { shipmentId, trackingId } = useLocalSearchParams();
  const [unit, setUnit] = useState(FALLBACK_UNIT);

  const load = useCallback(async () => {
    try {
      const data = await getParcelUnit(trackingId);
      if (data) setUnit(data);
    } catch (err) {
      console.warn('Parcel unit fetch failed, using fallback data.', err?.message);
    }
  }, [trackingId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <Pressable onPress={() => router.push(`/shipments/${shipmentId}`)}>
        <Text style={styles.backLink}>← {shipmentId}</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View>
          <Text style={type.eyebrow}>
            {unit.trackingId} · Package {unit.packageIndex} of {unit.packageCount}
          </Text>
          <Text style={[type.h1, styles.title]}>{unit.recipientName?.toUpperCase()}</Text>
        </View>
        <View style={styles.badgeRow}>
          <StatusBadge value={unit.status} kind="status" />
          <StatusBadge value={unit.labelStatus} kind="label" />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.mainCol}>
          <Card title="Package & Recipient" style={styles.cardSpacing}>
            <View style={styles.fieldGrid}>
              <Field label="Tracking ID" value={unit.trackingId} />
              <Field label="Package" value={`${unit.packageIndex} of ${unit.packageCount}`} />
              <Field label="Shipment" value={unit.shipmentId} accent />
              <Field label="Client" value={unit.client} />
              <Field label="Weight" value={`${unit.weight} kg`} />
              <Field label="Route" value={unit.route} />
            </View>
          </Card>

          <Card
            title="Tracking History"
            right={<Text style={styles.appendOnly}>append-only · this package only</Text>}
          >
            <View style={styles.timeline}>
              {STATUS_SEQUENCE.map((stepLabel, idx) => {
                const entry = unit.history?.find((h) => h.event === stepLabel);
                const isPending = !entry;
                const isLast = idx === STATUS_SEQUENCE.length - 1;
                return (
                  <View key={stepLabel} style={styles.timelineRow}>
                    <View style={styles.timelineMarkerCol}>
                      <View style={[styles.timelineDot, isPending && styles.timelineDotPending]} />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineLabel, isPending && styles.timelineLabelPending]}>
                        {stepLabel}
                      </Text>
                      {entry ? (
                        <>
                          <Text style={styles.timelineMeta}>
                            {entry.date} · {entry.time}
                          </Text>
                          <Text style={styles.timelineBy}>by {entry.by}</Text>
                        </>
                      ) : (
                        <Text style={styles.timelinePendingNote}>— pending mobile scan</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        <View style={styles.sideCol}>
          <Card>
            <View style={styles.qrWrap}>
              <Text style={styles.qrBrand}>TNL LOGISTICS</Text>
              <QRCodeGenerator size={160} value={unit.trackingId} />
              <Text style={styles.qrTracking}>{unit.trackingId}</Text>
              <Text style={styles.qrScan}>Scan to Track</Text>
            </View>
            <Button label="Reprint Label" variant="primary" fullWidth style={styles.reprintBtn} />
            <Button label="Quick Reprint (0)" variant="secondary" fullWidth style={styles.quickReprintBtn} />
          </Card>

          <Card title="Label Printing" style={styles.printingCard}>
            <StatusBadge value={unit.printing?.status} kind="label" />
            <View style={styles.printRow}>
              <View>
                <Text style={styles.printTitle}>Print</Text>
                <Text style={styles.printDate}>{unit.printing?.date}</Text>
                <Text style={styles.printBy}>
                  by {unit.printing?.by} · {unit.printing?.printer}
                </Text>
              </View>
              <Text style={styles.printCount}>{unit.printing?.count} label</Text>
            </View>
          </Card>
        </View>
      </View>
    </AppShell>
  );
}

function Field({ label, value, accent }) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <Text style={[styles.fieldValue, accent && styles.fieldValueAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  title: {
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  mainCol: {
    flex: 1,
  },
  cardSpacing: {
    marginBottom: spacing.lg,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  field: {
    width: '30%',
    minWidth: 150,
  },
  fieldValue: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    color: colors.ink,
    fontWeight: '600',
    marginTop: 3,
  },
  fieldValueAccent: {
    color: colors.accent,
  },
  appendOnly: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  timeline: {
    marginTop: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineMarkerCol: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  timelineDotPending: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  timelineLabel: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  timelineLabelPending: {
    color: colors.inkFaint,
    fontWeight: '600',
  },
  timelineMeta: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  timelineBy: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  timelinePendingNote: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: 2,
  },
  sideCol: {
    width: 300,
    gap: spacing.md,
  },
  qrWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  qrBrand: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  qrTracking: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.md,
  },
  qrScan: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  reprintBtn: {
    marginTop: spacing.md,
  },
  quickReprintBtn: {
    marginTop: spacing.sm,
  },
  printingCard: {
    gap: spacing.sm,
  },
  printRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  printTitle: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  printDate: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  printBy: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  printCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
  },
});

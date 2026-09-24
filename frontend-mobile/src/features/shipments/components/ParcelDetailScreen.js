import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../../theme';
import { shipmentApi } from '../services/shipmentApi';
import { StatusModal } from '../../../components/common/StatusModal';
import { BackButton } from '../../../components/common/BackButton';
import { usePrinter } from '../../printer/context/PrinterContext';
import { ThermalLabelPreviewModal } from '../../../components/common/ThermalLabelPreviewModal';
import { normalizeLabelData } from '../../printer/services/thermalLabelData';

function formatRoute(route) {
  if (!route) return 'Destination unavailable';
  return route.replace(/\s*(?:->|→)\s*/g, ' to ');
}

export function ParcelDetailScreen({ trackingId }) {
  const router = useRouter();
  const [parcel, setParcel] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const { isConnected, connectedDevice, printParcelLabels } = usePrinter();

  const fetchParcel = useCallback(async (signal) => {
    try {
      setError('');
      const data = await shipmentApi.getParcelUnit(trackingId, signal);
      setParcel(data);
      const shipmentData = await shipmentApi.getShipment(data.shipmentId, signal);
      setShipment(shipmentData);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.message || 'Failed to load parcel unit details.');
    } finally {
      setIsLoading(false);
    }
  }, [trackingId]);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      fetchParcel(controller.signal);
      return () => controller.abort();
    }, [fetchParcel])
  );

  const handleReprint = async () => {
    if (isReprinting || !parcel || !shipment) return;

    if (isConnected) {
      setIsReprinting(true);
      try {
        const canonicalUnit = shipment.units?.find((unit) => unit.trackingId === parcel.trackingId);
        if (!canonicalUnit) throw new Error('Parcel is missing from the canonical shipment details.');
        const result = await printParcelLabels(shipment, [canonicalUnit]);
        setStatusDialog({
          title: result.isVirtual ? 'Simulation Complete' : 'Label Reprint Sent',
          message: result.isVirtual
            ? `Simulated ${parcel.trackingId}. No parcel audit records were changed.`
            : `Reprint sent for ${parcel.trackingId}. Audit status: ${result.auditSyncStatus}.`,
        });
        fetchParcel();
      } catch (err) {
        setStatusDialog({
          title: 'Reprint Failed',
          message: err?.message || 'Unable to reprint label. Check connection and retry.',
        });
      } finally {
        setIsReprinting(false);
      }
    } else {
      // Option A: Seamless fallback to visual preview modal
      setPreviewVisible(true);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>PACKAGE DETAILS</Text>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !parcel) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>PACKAGE DETAILS</Text>
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error || 'Parcel not found'}</Text>
          <Pressable onPress={() => fetchParcel()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const pkgNum = parcel.packageIndex || 1;
  const pkgTotal = parcel.packageCount || 1;
  const isPrinted = parcel.labelStatus === 'Printed' || parcel.labelStatus === 'PRINTED';
  const history = parcel.history || [];
  const canonicalUnit = shipment?.units?.find((unit) => unit.trackingId === parcel.trackingId);
  let previewLabel = null;
  let labelDataError = null;
  try {
    if (shipment && canonicalUnit) {
      previewLabel = normalizeLabelData(
        shipment,
        canonicalUnit,
        canonicalUnit.packageIndex ? canonicalUnit.packageIndex - 1 : 0,
        shipment.units.length
      );
    }
  } catch (normalizationError) {
    labelDataError = normalizationError;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header matching prototype staff find-parcel units selected.png */}
      <View style={styles.header}>
        <BackButton accessibilityLabel="Back to shipment" />
        <Text accessibilityRole="header" style={styles.headerTitle}>
          PACKAGE {pkgNum} OF {pkgTotal}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Main Package Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>Tracking ID</Text>
          <Text selectable style={styles.trackingIdText}>{parcel.trackingId}</Text>

          <View style={styles.packageTag}>
            <Text style={styles.packageTagText}>PACKAGE {pkgNum} OF {pkgTotal}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Recipient</Text>
            <Text style={styles.metaValue}>{parcel.recipientName || '-'}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{parcel.client || '-'}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Shipment</Text>
            <Pressable
              onPress={() => router.push(`/(main)/shipments/${encodeURIComponent(parcel.shipmentId)}`)}
              style={styles.shipmentLink}
            >
              <Text style={styles.shipmentLinkText}>{parcel.shipmentId}</Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Destination</Text>
            <Text style={styles.metaValue}>{formatRoute(parcel.route)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.badgeRow}>
            <Text style={styles.metaLabel}>Current Status</Text>
            <View style={styles.statusBadge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>{parcel.status || 'QR Generated'}</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            <Text style={styles.metaLabel}>Label Status</Text>
            <View style={[styles.statusBadge, isPrinted ? styles.badgePrinted : styles.badgeNotPrinted]}>
              <View style={[styles.badgeDot, isPrinted ? styles.dotPrinted : styles.dotNotPrinted]} />
              <Text style={[styles.badgeText, isPrinted ? styles.textPrinted : styles.textNotPrinted]}>
                Label: {isPrinted ? 'Printed' : 'Not Printed'}
              </Text>
            </View>
          </View>

          {/* Additional Physical Dimensions Info */}
          <View style={styles.dimensionsBox}>
            <Text style={styles.dimLabel}>
              {parcel.weight ? `${parcel.weight} kg` : '1.00 kg'}, {parcel.lengthCm}x{parcel.widthCm}x{parcel.heightCm} cm, {Number(parcel.volumeCbm || 0).toFixed(4)} m³
            </Text>
          </View>
        </View>

        {/* Action Buttons: REPRINT LABEL | TRACKING HISTORY */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isReprinting || !previewLabel}
            onPress={handleReprint}
            style={[styles.actionBtn, isReprinting && styles.btnDisabled]}
          >
            {isReprinting ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Text style={styles.actionBtnText}>REPRINT LABEL</Text>
            )}
          </Pressable>
          {labelDataError ? <Text style={styles.errorText}>{labelDataError.message}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowHistory((prev) => !prev)}
            style={[styles.actionBtn, showHistory && styles.actionBtnActive]}
          >
            <Text style={[styles.actionBtnText, showHistory && styles.actionBtnTextActive]}>
              {showHistory ? 'HIDE HISTORY' : 'TRACKING HISTORY'}
            </Text>
          </Pressable>
        </View>

        {/* Expandable Tracking History Timeline */}
        {showHistory ? (
          <>
            <View style={styles.historyContainer}>
              {history.length === 0 ? (
                <Text style={styles.historyEmpty}>No tracking events logged yet.</Text>
              ) : (
                history.map((event, idx) => {
                  const staffName = event.by || event.staff || 'Andrea Lim';
                  const vehiclePart = event.vehiclePlate ? `, Truck ${event.vehiclePlate}` : '';
                  const subtitle = `${event.date} ${event.time}, ${staffName}${vehiclePart}`;
                  return (
                    <View key={idx} style={styles.timelineRow}>
                      <View style={styles.timelineLeftColumn}>
                        <View style={styles.timelineDot} />
                        {idx < history.length - 1 ? <View style={styles.timelineConnector} /> : null}
                      </View>
                      <View style={styles.timelineTextColumn}>
                        <Text style={styles.eventStatus}>{event.event || event.status}</Text>
                        <Text style={styles.eventSubtitle}>{subtitle}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Label Print Events Card matching prototype */}
            <View style={styles.printEventsCard}>
              <Text style={styles.printEventsHeading}>LABEL PRINT EVENTS</Text>
              {parcel.printEvents && parcel.printEvents.length > 0 ? (
                parcel.printEvents.map((pe, idx) => (
                  <View key={idx} style={styles.printEventRow}>
                    <Text style={styles.printEventLeft}>
                      {pe.kind || 'Print'}, {pe.staff || 'Andrea Lim'}
                    </Text>
                    <Text style={styles.printEventRight}>{pe.date}</Text>
                  </View>
                ))
              ) : isPrinted ? (
                <View style={styles.printEventRow}>
                  <Text style={styles.printEventLeft}>
                    Print, {parcel.printing?.by || 'Andrea Lim'}
                  </Text>
                  <Text style={styles.printEventRight}>
                    {parcel.printing?.date || '-'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.historyEmpty}>No label print events recorded.</Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <StatusModal
        visible={statusDialog !== null}
        eyebrow="LABEL AUDIT"
        title={statusDialog?.title || ''}
        message={statusDialog?.message || ''}
        confirmText="OK"
        onConfirm={() => setStatusDialog(null)}
      />

      <ThermalLabelPreviewModal
        visible={previewVisible}
        labelData={previewLabel}
        onClose={() => setPreviewVisible(false)}
        onAuditComplete={() => fetchParcel()}
        onPrintDirect={async () => {
          setPreviewVisible(false);
          await handleReprint();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: { ...typography.eyebrow, fontSize: 13, letterSpacing: 1, color: colors.ink },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorText: { ...typography.body, color: colors.danger, marginBottom: spacing.md },
  retryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardEyebrow: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginBottom: spacing.xs,
  },
  trackingIdText: {
    ...typography.h1,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  packageTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.black,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  packageTagText: {
    ...typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    alignItems: 'center',
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.inkFaint,
    width: '35%',
  },
  metaValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
    width: '65%',
    textAlign: 'right',
  },
  shipmentLink: {
    width: '65%',
    alignItems: 'flex-end',
  },
  shipmentLinkText: {
    ...typography.mono,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: colors.surface,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  badgeText: {
    ...typography.mono,
    fontSize: 11,
    color: colors.success,
    fontWeight: '600',
  },
  badgePrinted: {
    borderColor: colors.success,
  },
  dotPrinted: {
    backgroundColor: colors.success,
  },
  textPrinted: {
    color: colors.success,
  },
  badgeNotPrinted: {
    borderColor: colors.accent,
  },
  dotNotPrinted: {
    backgroundColor: colors.accent,
  },
  textNotPrinted: {
    color: colors.accent,
  },
  dimensionsBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  dimLabel: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  actionBtnActive: {
    backgroundColor: colors.black,
  },
  actionBtnText: {
    ...typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  actionBtnTextActive: {
    color: colors.surface,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  historyContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  historyEmpty: {
    ...typography.bodySmall,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineLeftColumn: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  timelineConnector: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  timelineTextColumn: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.lg,
  },
  eventStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  eventSubtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 3,
  },
  printEventsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  printEventsHeading: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  printEventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  printEventLeft: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'monospace',
  },
  printEventRight: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.inkFaint,
  },
});

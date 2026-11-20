import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { colors, getParcelStatusColor, spacing, typography } from '../../../theme';
import { usePrinter } from '../../printer/context/PrinterContext';
import { ThermalLabelPreviewModal } from '../../../components/common/ThermalLabelPreviewModal';
import { normalizeLabelData } from '../../printer/services/thermalLabelData';
import { StatusModal } from '../../../components/common/StatusModal';
import { shipmentApi } from '../services/shipmentApi';

function formatRoute(route) {
  if (!route) return '-';
  return route.replace(/\s*(?:->|→)\s*/g, ' to ');
}

export function RegistrationResult({ shipment, onRegisterAnother, onHome }) {
  const { isConnected, connectedDevice, printParcelLabels, isPrinting: isPrinterContextPrinting } = usePrinter();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);
  const [confirmReprintVisible, setConfirmReprintVisible] = useState(false);
  const [hasPrintedInSession, setHasPrintedInSession] = useState(false);
  const [canonicalShipment, setCanonicalShipment] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [detailsError, setDetailsError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const isPrintingRef = useRef(false);
  const cooldownIntervalRef = useRef(null);

  const trackingCount = shipment.trackingIds?.length || 1;

  const hasPrinted = hasPrintedInSession || Boolean(
    canonicalShipment?.units?.length > 0 &&
    canonicalShipment.units.every(
      (unit) => unit.labelStatus && String(unit.labelStatus).toUpperCase() !== 'NOT_PRINTED'
    )
  );

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  const loadCanonicalShipment = useCallback(async () => {
    setIsLoadingDetails(true);
    setDetailsError(null);
    try {
      setCanonicalShipment(await shipmentApi.getShipment(shipment.shipmentId));
    } catch (error) {
      setDetailsError(error?.message || 'Unable to load complete shipment details.');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [shipment.shipmentId]);

  useEffect(() => { loadCanonicalShipment(); }, [loadCanonicalShipment]);

  const startCooldownCountdown = useCallback((initialSeconds = 3) => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
    setCooldownSeconds(initialSeconds);
    isPrintingRef.current = true;

    let remaining = initialSeconds;
    cooldownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCooldownSeconds(remaining);
      } else {
        if (cooldownIntervalRef.current) {
          clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
        }
        setCooldownSeconds(0);
        isPrintingRef.current = false;
      }
    }, 1000);
  }, []);

  const executeActualPrint = useCallback(async () => {
    if (!canonicalShipment) {
      isPrintingRef.current = false;
      setIsPrinting(false);
      return;
    }
    const unitCount = canonicalShipment.units?.length || trackingCount || 1;
    const cooldownDuration = Math.max(3, Math.min(6, 2 + Math.ceil(unitCount * 0.4)));

    if (isConnected) {
      isPrintingRef.current = true;
      setIsPrinting(true);
      try {
        const result = await printParcelLabels(canonicalShipment);
        setHasPrintedInSession(true);
        setStatusDialog({
          title: result.isVirtual ? 'Simulation Complete' : 'Labels Printed',
          message: result.isVirtual
            ? `Simulated ${result.count} labels. No parcel audit records were changed.`
            : `Printed ${result.count} labels to ${result.device}. Audit status: ${result.auditSyncStatus}.`,
        });
        loadCanonicalShipment();
      } catch (err) {
        setStatusDialog({
          title: 'Print Failed',
          message: err?.message || 'Failed to print labels. Check connection and retry.',
        });
      } finally {
        setIsPrinting(false);
        // Start cooldown countdown immediately when popup dialog appears
        startCooldownCountdown(cooldownDuration);
      }
    } else {
      isPrintingRef.current = false;
      setIsPrinting(false);
      // Option A: Seamless fallback to visual preview modal
      setPreviewVisible(true);
    }
  }, [canonicalShipment, isConnected, loadCanonicalShipment, printParcelLabels, startCooldownCountdown, trackingCount]);

  const handlePrintLabels = useCallback(() => {
    if (isPrintingRef.current || isPrinting || isPrinterContextPrinting || cooldownSeconds > 0 || isLoadingDetails || !canonicalShipment) {
      return;
    }

    // Precautionary check: If labels have already been printed, prompt for confirmation
    if (hasPrinted) {
      setConfirmReprintVisible(true);
      return;
    }

    isPrintingRef.current = true;
    executeActualPrint();
  }, [canonicalShipment, cooldownSeconds, executeActualPrint, hasPrinted, isLoadingDetails, isPrinting, isPrinterContextPrinting]);

  // Alias for direct print dispatch compatibility
  const startPrintCountdown = executeActualPrint;

  const previewLabels = canonicalShipment
    ? (canonicalShipment.units || []).map((unit, index) =>
      normalizeLabelData(canonicalShipment, unit, index, canonicalShipment.units.length))
    : [];

  // Unified shipment data for display
  const displayShipment = canonicalShipment || shipment;
  const recipientName = displayShipment.recipientDetails?.fullName || displayShipment.recipientName || displayShipment.recipient || '-';
  const recipientContact = displayShipment.recipientDetails?.contactNumber || displayShipment.recipientContact;
  const recipientAddress = displayShipment.recipientDetails?.address || displayShipment.recipientAddress;
  const clientName = displayShipment.clientName || displayShipment.client || displayShipment.clientId || '-';
  const destination = displayShipment.destination || displayShipment.route;
  const contentsDesc = displayShipment.description
    ? `${displayShipment.description}, ${displayShipment.quantity || trackingCount} pcs`
    : (trackingCount > 1 ? `${trackingCount} parcel units` : '1 parcel unit');

  const totalAmount = Number(displayShipment.totalAmount != null ? displayShipment.totalAmount : shipment.totalAmount || 0);
  const isPaid = totalAmount === 0 || displayShipment.paidAtRegistration || String(displayShipment.payment).toUpperCase() === 'PAID';
  const isPartial = String(displayShipment.payment).toUpperCase() === 'PARTIALLY_PAID';
  const paymentBadgeText = isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid';
  const paymentSubtext = totalAmount === 0
    ? 'Paid · Free shipment'
    : (displayShipment.paidAtRegistration
      ? 'Paid at registration · Cash payment recorded'
      : (isPaid ? 'Paid' : 'Unpaid · To be billed in the statement of account'));

  const unitItems = (canonicalShipment?.units && canonicalShipment.units.length > 0)
    ? canonicalShipment.units
    : (shipment.trackingIds || []).map((tid, idx) => ({
      trackingId: tid,
      packageIndex: idx + 1,
      packageCount: trackingCount,
      status: 'QR Generated',
      labelStatus: hasPrintedInSession ? 'PRINTED' : 'NOT_PRINTED',
    }));

  const isBusy = isPrinting || isPrinterContextPrinting || isLoadingDetails;

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={unitItems}
        keyExtractor={(item, index) => (typeof item === 'string' ? item : (item.trackingId || String(index)))}
        ListHeaderComponent={
          <View>
            {/* Top Registration Success Banner */}
            <View style={styles.successBanner}>
              <View style={styles.successBar} />
              <View style={styles.successBannerContent}>
                <View style={styles.successHeaderRow}>
                  <View style={styles.successDot} />
                  <Text style={styles.eyebrow}>REGISTRATION COMPLETE</Text>
                </View>
                <Text style={styles.successMessage}>
                  Shipment registered. A tracking number has been assigned to each parcel unit.
                </Text>
              </View>
            </View>

            {/* Shipment Summary Card matching ShipmentDetailScreen */}
            <View style={styles.summaryCard}>
              <View style={styles.cardHeader}>
                <Text accessibilityRole="header" selectable style={styles.shipmentId}>{shipment.shipmentId}</Text>
                <Text style={styles.platformBadge}>REGISTERED ON MOBILE</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Client</Text>
                <Text style={styles.metaValue}>{clientName}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Recipient</Text>
                <Text style={styles.metaValue}>{recipientName}</Text>
              </View>

              {recipientContact ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Contact</Text>
                  <Text style={styles.metaValue}>{recipientContact}</Text>
                </View>
              ) : null}

              {recipientAddress ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Address</Text>
                  <Text style={styles.metaValue}>{recipientAddress}</Text>
                </View>
              ) : null}

              {destination ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Destination</Text>
                  <Text style={styles.metaValue}>{formatRoute(destination)}</Text>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Contents</Text>
                <Text style={styles.metaValue}>{contentsDesc}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Total</Text>
                <View style={styles.amountContainer}>
                  <Text style={styles.metaValueAmount}>
                    ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' '}
                    <Text style={[
                      styles.paymentBadge,
                      isPaid ? styles.paymentPaid : isPartial ? styles.paymentPartial : styles.paymentUnpaid,
                    ]}>
                      ({paymentBadgeText})
                    </Text>
                  </Text>
                  <Text style={styles.paymentSubtext}>
                    {paymentSubtext}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions Box */}
            <View style={styles.actions}>
              {/* Printer Connection Hint */}
              <View style={styles.printerNotice}>
                <View style={[styles.printerNoticeDot, { backgroundColor: isConnected ? colors.success : colors.inkFaint }]} />
                <Text style={styles.printerNoticeText}>
                  {isConnected
                    ? `Connected: ${connectedDevice?.name || 'Thermal Printer'}`
                    : 'Thermal printer offline · Preview mode available'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                style={[
                  styles.printAction,
                  (cooldownSeconds > 0 || isBusy || !canonicalShipment) && styles.coolingDownAction,
                ]}
                onPress={handlePrintLabels}
                disabled={isBusy || cooldownSeconds > 0 || !canonicalShipment}
              >
                {isBusy ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.surface} size="small" />
                    <Text style={styles.printActionText}>
                      {isLoadingDetails ? 'LOADING DETAILS...' : 'PRINTING LABELS...'}
                    </Text>
                  </View>
                ) : cooldownSeconds > 0 ? (
                  <Text style={styles.printActionText}>PLEASE WAIT ({cooldownSeconds}s)...</Text>
                ) : hasPrinted ? (
                  <Text style={styles.printActionText}>
                    REPRINT LABELS ({trackingCount})
                  </Text>
                ) : (
                  <Text style={styles.printActionText}>
                    PRINT LABELS ({trackingCount})
                  </Text>
                )}
              </Pressable>

              {detailsError ? (
                <View style={styles.detailsError}>
                  <Text style={styles.detailsErrorText}>{detailsError}</Text>
                  <Pressable accessibilityRole="button" onPress={loadCanonicalShipment}>
                    <Text style={styles.retryText}>Retry loading details</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable accessibilityRole="button" style={styles.primary} onPress={onRegisterAnother}>
                <Text style={styles.primaryText}>Register Another Shipment</Text>
              </Pressable>

              <Pressable accessibilityRole="button" style={styles.secondary} onPress={onHome}>
                <Text style={styles.secondaryText}>Back to Home</Text>
              </Pressable>
            </View>

            {/* Section Header */}
            <Text style={styles.sectionHeader}>PARCEL TRACKING NUMBERS · {trackingCount}</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const trackingId = typeof item === 'string' ? item : (item.trackingId || item.id || '');
          const packageIndex = (typeof item === 'object' && item.packageIndex) ? item.packageIndex : index + 1;
          const packageCount = (typeof item === 'object' && item.packageCount) ? item.packageCount : trackingCount;
          const unitStatus = (typeof item === 'object' && (item.currentStatus || item.status))
            ? (item.currentStatus || item.status)
            : 'QR Generated';
          const unitLabelStatus = typeof item === 'object' ? item.labelStatus : null;
          const isUnitPrinted = (unitLabelStatus && String(unitLabelStatus).toUpperCase() !== 'NOT_PRINTED') || hasPrintedInSession;
          const statusColor = getParcelStatusColor(unitStatus);

          return (
            <View style={styles.unitCard}>
              <View style={styles.unitLeft}>
                <Text selectable style={styles.unitTrackingId}>{trackingId}</Text>
                <Text style={styles.unitPackageNum}>Package {packageIndex} of {packageCount}</Text>
              </View>

              <View style={styles.unitRight}>
                <View style={[styles.unitBadge, { borderColor: statusColor }]}>
                  <View style={[styles.unitBadgeDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.unitBadgeText, { color: statusColor }]}>
                    {unitStatus}
                  </Text>
                </View>

                <View style={[styles.unitBadge, isUnitPrinted ? styles.badgePrinted : styles.badgeNotPrinted]}>
                  <View style={[styles.unitBadgeDot, isUnitPrinted ? styles.dotPrinted : styles.dotNotPrinted]} />
                  <Text style={[styles.unitBadgeText, isUnitPrinted ? styles.textPrinted : styles.textNotPrinted]}>
                    Label: {isUnitPrinted ? 'Printed' : 'Not Printed'}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Status Modal */}
      <StatusModal
        visible={Boolean(statusDialog)}
        title={statusDialog?.title}
        message={statusDialog?.message}
        onConfirm={() => setStatusDialog(null)}
      />

      {/* Reprint Confirmation Modal */}
      <StatusModal
        visible={confirmReprintVisible}
        eyebrow="REPRINT CONFIRMATION"
        title={trackingCount > 1 ? 'Reprint Parcel Labels?' : 'Reprint Parcel Label?'}
        message={
          trackingCount > 1
            ? `Labels for all ${trackingCount} parcel units have already been printed. An audit event will be recorded for this reprint. Are you sure you want to reprint?`
            : `The label for this shipment has already been printed. An audit event will be recorded for this reprint. Are you sure you want to reprint?`
        }
        confirmText="REPRINT"
        cancelText="CANCEL"
        confirmVariant="primary"
        onConfirm={() => {
          if (isPrintingRef.current || isBusy || cooldownSeconds > 0) return;
          setConfirmReprintVisible(false);
          isPrintingRef.current = true;
          executeActualPrint();
        }}
        onCancel={() => {
          setConfirmReprintVisible(false);
        }}
      />

      {/* Label Preview Modal (Option A) */}
      <ThermalLabelPreviewModal
        visible={previewVisible}
        labels={previewLabels}
        onClose={() => setPreviewVisible(false)}
        onAuditComplete={() => {
          setHasPrintedInSession(true);
          loadCanonicalShipment();
        }}
        onPrintDirect={async () => {
          setPreviewVisible(false);
          setHasPrintedInSession(true);
          await executeActualPrint();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: spacing.xxl,
  },
  successBanner: {
    flexDirection: 'row',
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: '#B8E2C8',
    borderRadius: 4,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  successBar: {
    width: 4,
    backgroundColor: colors.success,
  },
  successBannerContent: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  successHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  successDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  successMessage: {
    ...typography.bodySmall,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  shipmentId: {
    ...typography.h1,
    fontSize: 22,
    color: colors.ink,
  },
  platformBadge: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    alignItems: 'flex-start',
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.inkFaint,
    width: '32%',
  },
  metaValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
    width: '68%',
    textAlign: 'right',
  },
  metaValueAmount: {
    ...typography.body,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  amountContainer: {
    width: '68%',
    alignItems: 'flex-end',
  },
  paymentSubtext: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
    textAlign: 'right',
  },
  paymentBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkFaint,
  },
  paymentPaid: {
    color: colors.success,
  },
  paymentPartial: {
    color: colors.accent,
  },
  paymentUnpaid: {
    color: colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  printerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  printerNoticeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  printerNoticeText: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  printAction: {
    backgroundColor: colors.black,
    minHeight: 52,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  coolingDownAction: {
    opacity: 0.65,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  printActionText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.black,
    minHeight: 48,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  primaryText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  secondaryText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    ...typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    marginBottom: spacing.md,
    letterSpacing: 0.8,
  },
  unitCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitLeft: {
    flex: 1,
  },
  unitTrackingId: {
    ...typography.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  unitPackageNum: {
    ...typography.bodySmall,
    color: colors.inkSoft,
    fontSize: 11,
  },
  unitRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: 4,
    backgroundColor: colors.surface,
  },
  unitBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  unitBadgeText: {
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
  detailsError: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 4,
  },
  detailsErrorText: {
    ...typography.bodySmall,
    color: colors.danger,
  },
  retryText: {
    ...typography.mono,
    color: colors.ink,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
});

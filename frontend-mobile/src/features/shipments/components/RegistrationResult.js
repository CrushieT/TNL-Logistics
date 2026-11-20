import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '../../../theme';
import { usePrinter } from '../../printer/context/PrinterContext';
import { ThermalLabelPreviewModal } from '../../../components/common/ThermalLabelPreviewModal';
import { normalizeLabelData } from '../../printer/services/thermalLabelData';
import { StatusModal } from '../../../components/common/StatusModal';
import { shipmentApi } from '../services/shipmentApi';

export function RegistrationResult({ shipment, onRegisterAnother, onHome }) {
  const { isConnected, connectedDevice, printParcelLabels, isPrinting } = usePrinter();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);
  const [confirmReprintVisible, setConfirmReprintVisible] = useState(false);
  const [hasPrintedInSession, setHasPrintedInSession] = useState(false);
  const [canonicalShipment, setCanonicalShipment] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [detailsError, setDetailsError] = useState(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const isPrintingRef = useRef(false);
  const cooldownTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const trackingCount = shipment.trackingIds?.length || 1;

  const hasPrinted = hasPrintedInSession || Boolean(
    canonicalShipment?.units?.length > 0 &&
    canonicalShipment.units.every(
      (unit) => unit.labelStatus && String(unit.labelStatus).toUpperCase() !== 'NOT_PRINTED'
    )
  );

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(0);
    isPrintingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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

  const executeActualPrint = useCallback(async () => {
    setCountdown(0);
    if (!canonicalShipment) {
      isPrintingRef.current = false;
      return;
    }
    const unitCount = canonicalShipment.units?.length || trackingCount || 1;
    const cooldownMs = Math.min(8000, 1500 + unitCount * 200);

    if (isConnected) {
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
        setIsCoolingDown(true);
        cooldownTimerRef.current = setTimeout(() => {
          isPrintingRef.current = false;
          setIsCoolingDown(false);
        }, cooldownMs);
      }
    } else {
      isPrintingRef.current = false;
      // Option A: Seamless fallback to preview modal
      setPreviewVisible(true);
    }
  }, [canonicalShipment, isConnected, loadCanonicalShipment, printParcelLabels, trackingCount]);

  const startPrintCountdown = useCallback(() => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    // Start 3-second grace period countdown
    setCountdown(3);
    let secondsRemaining = 3;

    countdownIntervalRef.current = setInterval(() => {
      secondsRemaining -= 1;
      if (secondsRemaining > 0) {
        setCountdown(secondsRemaining);
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 1000);

    countdownTimerRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      executeActualPrint();
    }, 3000);
  }, [executeActualPrint]);

  const handlePrintLabels = useCallback(() => {
    if (isPrinting || isCoolingDown || isLoadingDetails || !canonicalShipment) return;

    // Accidental tap protection: If countdown is already active and pressed again, cancel!
    if (countdown > 0) {
      cancelCountdown();
      return;
    }

    // Precautionary check: If labels have already been printed, prompt for confirmation
    if (hasPrinted) {
      setConfirmReprintVisible(true);
      return;
    }

    startPrintCountdown();
  }, [cancelCountdown, canonicalShipment, countdown, hasPrinted, isCoolingDown, isLoadingDetails, isPrinting, startPrintCountdown]);

  const previewLabels = canonicalShipment
    ? (canonicalShipment.units || []).map((unit, index) =>
      normalizeLabelData(canonicalShipment, unit, index, canonicalShipment.units.length))
    : [];

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={shipment.trackingIds || []}
        keyExtractor={(trackingId) => trackingId}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>REGISTRATION COMPLETE</Text>
            <Text accessibilityRole="header" selectable style={styles.title}>{shipment.shipmentId}</Text>
            <Text style={styles.description}>Shipment registered. A tracking number has been assigned to each parcel unit.</Text>
            <View style={styles.summary}>
              <Text style={styles.label}>CLIENT / BILLING PARTY</Text>
              <Text style={styles.value}>{shipment.clientName || shipment.clientId}</Text>
              <Text style={styles.label}>RECIPIENT</Text>
              <Text style={styles.value}>{shipment.recipientName}</Text>
              <Text style={styles.label}>TOTAL AMOUNT</Text>
              <Text style={styles.amount}>₱{Number(shipment.totalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <Text style={styles.payment}>{Number(shipment.totalAmount) === 0 ? 'Paid · Free shipment' : (shipment.paidAtRegistration ? 'Paid at registration · Cash payment recorded' : 'Unpaid · To be billed in the statement of account')}</Text>
            </View>
            <View style={styles.actions}>
              {countdown > 0 ? (
                <View style={styles.countdownContainer}>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.printAction, styles.countdownAction]}
                    onPress={handlePrintLabels}
                  >
                    <Text style={styles.countdownActionText}>
                      PRINTING IN {countdown}S · TAP TO CANCEL
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.cancelAction}
                    onPress={cancelCountdown}
                  >
                    <Text style={styles.cancelActionText}>CANCEL PRINT</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.printAction, isCoolingDown && styles.coolingDownAction]}
                  onPress={handlePrintLabels}
                  disabled={isPrinting || isCoolingDown || isLoadingDetails || !canonicalShipment}
                >
                  {isPrinting || isLoadingDetails ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : isCoolingDown ? (
                    <Text style={styles.printActionText}>PLEASE WAIT...</Text>
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
              )}
              {detailsError ? (
                <View style={styles.detailsError}>
                  <Text style={styles.detailsErrorText}>{detailsError}</Text>
                  <Pressable accessibilityRole="button" onPress={loadCanonicalShipment}>
                    <Text style={styles.retryText}>Retry loading details</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable accessibilityRole="button" style={styles.primary} onPress={onRegisterAnother}>
                <Text style={styles.primaryText}>Register Another</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.secondary} onPress={onHome}>
                <Text style={styles.secondaryText}>Back to Home</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>PARCEL TRACKING NUMBERS · {trackingCount}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.unit}>
            <Text style={styles.unitLabel}>Unit {index + 1}</Text>
            <Text selectable style={styles.tracking}>{item}</Text>
          </View>
        )}
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
          if (isPrintingRef.current || isPrinting || isCoolingDown) return;
          setConfirmReprintVisible(false);
          startPrintCountdown();
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
  container: { flex: 1 },
  content: { padding: spacing.lg, width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: spacing.xxl },
  eyebrow: { ...typography.eyebrow, color: colors.success, marginTop: spacing.lg },
  title: { ...typography.h1, marginTop: spacing.sm },
  description: { ...typography.body, marginVertical: spacing.lg },
  summary: { padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { ...typography.eyebrow, marginTop: spacing.md, marginBottom: spacing.xs },
  value: { ...typography.body, color: colors.ink, fontWeight: '600' },
  amount: { ...typography.h1 },
  payment: { ...typography.body, marginTop: spacing.md },
  detailsError: { padding: spacing.sm, borderWidth: 1, borderColor: colors.danger },
  detailsErrorText: { ...typography.bodySmall, color: colors.danger },
  retryText: { ...typography.mono, color: colors.ink, textDecorationLine: 'underline', marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginVertical: spacing.xl },
  countdownContainer: { gap: spacing.xs },
  countdownAction: { backgroundColor: colors.amber, borderWidth: 1, borderColor: colors.amber },
  countdownActionText: { color: colors.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  cancelAction: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger, minHeight: 44, padding: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  cancelActionText: { color: colors.danger, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  printAction: { backgroundColor: colors.ink, minHeight: 52, padding: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  coolingDownAction: { opacity: 0.65 },
  printActionText: { color: colors.surface, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  primary: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.borderStrong, minHeight: 48, padding: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  primaryText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: colors.border, minHeight: 44, padding: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  secondaryText: { color: colors.inkFaint, fontSize: 13, fontWeight: '600' },
  unit: { paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, gap: spacing.xs },
  unitLabel: { ...typography.bodySmall },
  tracking: { ...typography.mono, fontSize: 15, color: colors.ink },
});

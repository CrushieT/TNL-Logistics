import React, { useCallback, useEffect, useState } from 'react';
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
  const [canonicalShipment, setCanonicalShipment] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [detailsError, setDetailsError] = useState(null);

  const trackingCount = shipment.trackingIds?.length || 1;

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

  const handlePrintLabels = async () => {
    if (!canonicalShipment) return;
    if (isConnected) {
      try {
        const result = await printParcelLabels(canonicalShipment);
        setStatusDialog({
          title: result.isVirtual ? 'Simulation Complete' : 'Labels Printed',
          message: result.isVirtual
            ? `Simulated ${result.count} labels. No parcel audit records were changed.`
            : `Printed ${result.count} labels to ${result.device}. Audit status: ${result.auditSyncStatus}.`,
        });
      } catch (err) {
        setStatusDialog({
          title: 'Print Failed',
          message: err?.message || 'Failed to print labels. Check connection and retry.',
        });
      }
    } else {
      // Option A: Seamless fallback to preview modal
      setPreviewVisible(true);
    }
  };

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
              <Text style={styles.payment}>{shipment.paidAtRegistration ? 'Paid at registration · Cash payment recorded' : 'Unpaid · To be billed in the statement of account'}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                style={styles.printAction}
                onPress={handlePrintLabels}
                disabled={isPrinting || isLoadingDetails || !canonicalShipment}
              >
                {isPrinting || isLoadingDetails ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
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

      {/* Label Preview Modal (Option A) */}
      <ThermalLabelPreviewModal
        visible={previewVisible}
        labels={previewLabels}
        onClose={() => setPreviewVisible(false)}
        onPrintDirect={async () => {
          setPreviewVisible(false);
          await handlePrintLabels();
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
  printAction: { backgroundColor: colors.ink, minHeight: 52, padding: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  printActionText: { color: colors.surface, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  primary: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.borderStrong, minHeight: 48, padding: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  primaryText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: colors.border, minHeight: 44, padding: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  secondaryText: { color: colors.inkFaint, fontSize: 13, fontWeight: '600' },
  unit: { paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, gap: spacing.xs },
  unitLabel: { ...typography.bodySmall },
  tracking: { ...typography.mono, fontSize: 15, color: colors.ink },
});

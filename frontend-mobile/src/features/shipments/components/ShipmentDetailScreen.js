import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../../theme';
import { shipmentApi } from '../services/shipmentApi';
import { StatusModal } from '../../../components/common/StatusModal';

export function ShipmentDetailScreen({ shipmentId }) {
  const router = useRouter();
  const [shipment, setShipment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);

  const fetchDetail = async (signal) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await shipmentApi.getShipment(shipmentId, signal);
      setShipment(data);
    } catch (err) {
      if (!signal?.aborted) {
        setError(err.response?.data?.message || 'Unable to load shipment details.');
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [shipmentId]);

  const handlePrintAll = async (isReprint = false) => {
    if (isPrinting || !shipment) return;
    setIsPrinting(true);
    try {
      await shipmentApi.printLabels(shipment.shipmentId);
      setStatusDialog({
        title: isReprint ? 'Labels Reprinted' : 'Labels Printed',
        message: `Label print audit recorded for all ${shipment.units?.length || shipment.quantity} parcel units.`,
      });
      // Refresh details to update label badges
      fetchDetail();
    } catch (err) {
      setStatusDialog({
        title: 'Print Recording Failed',
        message: err.response?.data?.message || 'Unable to update label status. Check connection and retry.',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>SHIPMENT</Text>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>SHIPMENT</Text>
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error || 'Shipment not found'}</Text>
          <Pressable onPress={() => fetchDetail()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const units = shipment.units || [];
  const registeredPlatform = shipment.registeredVia === 'MOBILE_FIELD' ? 'REGISTERED ON MOBILE' : 'REGISTERED ON PC';
  const contentsDesc = `${shipment.description || 'General Goods'} · ${shipment.quantity} pcs · ${shipment.chargeModel === 'PER_PARCEL' ? 'per unit' : 'flat'}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to find parcel"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>SHIPMENT</Text>
      </View>

      <FlatList
        data={units}
        keyExtractor={(item) => item.trackingId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            {/* Top Shipment Card matching prototype staff find-parcel units.png */}
            <View style={styles.summaryCard}>
              <View style={styles.cardHeader}>
                <Text selectable style={styles.shipmentId}>{shipment.shipmentId}</Text>
                <Text style={styles.platformBadge}>{registeredPlatform}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Recipient</Text>
                <Text style={styles.metaValue}>{shipment.recipient || shipment.recipientDetails?.fullName || '—'}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Client</Text>
                <Text style={styles.metaValue}>{shipment.client || shipment.clientId || '—'}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Contents</Text>
                <Text style={styles.metaValue}>{contentsDesc}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Destination</Text>
                <Text style={styles.metaValue}>{shipment.destination || shipment.route || 'TNL Baguio Hub'}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Total</Text>
                <Text style={styles.metaValueAmount}>
                  ₱{Number(shipment.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  {' '}
                  <Text style={styles.paymentBadge}>({shipment.payment || 'Unpaid'})</Text>
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Overall Status</Text>
                <Text style={styles.statusRollupValue}>{shipment.statusRollup || shipment.status || 'Registered'}</Text>
              </View>
            </View>

            {/* Section Heading */}
            <Text style={styles.sectionHeader}>
              PARCEL UNITS ({units.length}) — TAP TO VIEW
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isPrinted = item.labelStatus === 'Printed' || item.labelStatus === 'PRINTED';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Parcel unit ${item.trackingId}`}
              style={styles.unitCard}
              onPress={() => router.push(`/(main)/shipments/parcel/${encodeURIComponent(item.trackingId)}`)}
            >
              <View style={styles.unitLeft}>
                <Text selectable style={styles.unitTrackingId}>{item.trackingId}</Text>
                <Text style={styles.unitPackageNum}>Package {item.packageIndex || index + 1} of {item.packageCount || units.length}</Text>
              </View>

              <View style={styles.unitRight}>
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeDot}>●</Text>
                  <Text style={styles.unitBadgeText}>{item.currentStatus || item.status || 'QR Generated'}</Text>
                </View>

                <View style={[styles.unitBadge, isPrinted ? styles.badgePrinted : styles.badgeNotPrinted]}>
                  <Text style={[styles.unitBadgeDot, isPrinted ? styles.dotPrinted : styles.dotNotPrinted]}>●</Text>
                  <Text style={[styles.unitBadgeText, isPrinted ? styles.textPrinted : styles.textNotPrinted]}>
                    Label: {isPrinted ? 'Printed' : 'Not Printed'}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.actionsBox}>
            <Pressable
              accessibilityRole="button"
              disabled={isPrinting}
              onPress={() => handlePrintAll(false)}
              style={[styles.primaryBtn, isPrinting && styles.disabled]}
            >
              {isPrinting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryBtnText}>PRINT ALL LABELS ({units.length})</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isPrinting}
              onPress={() => handlePrintAll(true)}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>REPRINT ALL LABELS</Text>
            </Pressable>
          </View>
        }
      />

      <StatusModal
        visible={statusDialog !== null}
        eyebrow="LABEL AUDIT"
        title={statusDialog?.title || ''}
        message={statusDialog?.message || ''}
        confirmText="OK"
        onConfirm={() => setStatusDialog(null)}
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
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backArrow: { fontSize: 24, color: colors.ink, fontWeight: '700' },
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
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
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
    width: '68%',
    textAlign: 'right',
  },
  paymentBadge: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.inkFaint,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  statusRollupValue: {
    ...typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    width: '68%',
    textAlign: 'right',
  },
  sectionHeader: {
    ...typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
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
    fontSize: 8,
    color: colors.success,
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
    color: colors.success,
  },
  textPrinted: {
    color: colors.success,
  },
  badgeNotPrinted: {
    borderColor: colors.accent,
  },
  dotNotPrinted: {
    color: colors.accent,
  },
  textNotPrinted: {
    color: colors.accent,
  },
  actionsBox: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.black,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  primaryBtnText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  secondaryBtnText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.6,
  },
});

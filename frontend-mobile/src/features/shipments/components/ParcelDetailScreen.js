import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../../theme';
import { shipmentApi } from '../services/shipmentApi';
import { StatusModal } from '../../../components/common/StatusModal';

export function ParcelDetailScreen({ trackingId }) {
  const router = useRouter();
  const [parcel, setParcel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);

  const fetchParcel = async (signal) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await shipmentApi.getParcelUnit(trackingId, signal);
      setParcel(data);
    } catch (err) {
      if (!signal?.aborted) {
        setError(err.response?.data?.message || 'Unable to load parcel details.');
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchParcel(controller.signal);
    return () => controller.abort();
  }, [trackingId]);

  const handleReprint = async () => {
    if (isReprinting || !parcel) return;
    setIsReprinting(true);
    try {
      await shipmentApi.printLabels(parcel.shipmentId, [parcel.trackingId]);
      setStatusDialog({
        title: 'Label Reprint Recorded',
        message: `Reprint audit recorded for ${parcel.trackingId}.`,
      });
      fetchParcel();
    } catch (err) {
      setStatusDialog({
        title: 'Reprint Failed',
        message: err.response?.data?.message || 'Unable to update label status. Check connection and retry.',
      });
    } finally {
      setIsReprinting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
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
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header matching prototype staff find-parcel units selected.png */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
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
            <Text style={styles.metaValue}>{parcel.recipientName || '—'}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{parcel.client || '—'}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Shipment</Text>
            <Pressable
              onPress={() => router.push(`/(main)/shipments/${encodeURIComponent(parcel.shipmentId)}`)}
              style={styles.shipmentLink}
            >
              <Text style={styles.shipmentLinkText}>{parcel.shipmentId} →</Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Destination</Text>
            <Text style={styles.metaValue}>{parcel.route || 'TNL Baguio Hub'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.badgeRow}>
            <Text style={styles.metaLabel}>Current Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.badgeDot}>●</Text>
              <Text style={styles.badgeText}>{parcel.status || 'QR Generated'}</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            <Text style={styles.metaLabel}>Label Status</Text>
            <View style={[styles.statusBadge, isPrinted ? styles.badgePrinted : styles.badgeNotPrinted]}>
              <Text style={[styles.badgeDot, isPrinted ? styles.dotPrinted : styles.dotNotPrinted]}>●</Text>
              <Text style={[styles.badgeText, isPrinted ? styles.textPrinted : styles.textNotPrinted]}>
                Label: {isPrinted ? 'Printed' : 'Not Printed'}
              </Text>
            </View>
          </View>

          {/* Additional Physical Dimensions Info */}
          <View style={styles.dimensionsBox}>
            <Text style={styles.dimLabel}>
              {parcel.weight ? `${parcel.weight} kg` : '1.00 kg'} · {parcel.lengthCm}×{parcel.widthCm}×{parcel.heightCm} cm · {Number(parcel.volumeCbm || 0).toFixed(4)} m³
            </Text>
          </View>
        </View>

        {/* Action Buttons: REPRINT LABEL | TRACKING HISTORY */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isReprinting}
            onPress={handleReprint}
            style={[styles.actionBtn, isReprinting && styles.btnDisabled]}
          >
            {isReprinting ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Text style={styles.actionBtnText}>REPRINT LABEL</Text>
            )}
          </Pressable>

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
          <View style={styles.historyContainer}>
            <Text style={styles.historyHeading}>SCAN AUDIT TIMELINE</Text>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>No tracking events logged yet.</Text>
            ) : (
              history.map((event, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.eventStatus}>{event.status}</Text>
                    <Text style={styles.eventTime}>
                      {event.date} · {event.time} · {event.staff || 'Staff'}
                    </Text>
                    {event.remarks ? (
                      <Text style={styles.eventRemarks}>{event.remarks}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
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
    fontSize: 8,
    color: colors.success,
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
    marginBottom: spacing.xxl,
  },
  historyHeading: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  historyEmpty: {
    ...typography.bodySmall,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 5,
    marginRight: spacing.md,
  },
  timelineContent: {
    flex: 1,
  },
  eventStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  eventTime: {
    ...typography.bodySmall,
    color: colors.inkFaint,
    marginTop: 2,
  },
  eventRemarks: {
    ...typography.bodySmall,
    color: colors.inkSoft,
    marginTop: 2,
    fontStyle: 'italic',
  },
});

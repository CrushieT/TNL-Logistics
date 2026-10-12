import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import ExceptionAction from '../../components/common/ExceptionAction';
import apiClient from '../../services/api/client';
import { subscribeRealtimeEvents } from '../../services/api/sseClient';
import { getWaybillByNumber, WaybillManifestCard } from '../../features/waybills';
import { getCompanyBranding } from '../../features/settings/services/settingsApi';
import {
  buildWaybillPrintHtml,
  getRenderedWaybillLogoUri,
} from '../../features/waybills/services/waybillPrint.mjs';
import { colors, fonts, spacing } from '../../theme';

export default function WaybillDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const waybillId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [manifest, setManifest] = useState(null);
  const [reconciliationHistory, setReconciliationHistory] = useState([]);
  const [branding, setBranding] = useState(null);
  const [state, setState] = useState('loading');

  const loadManifest = useCallback(async (showSpinner = true) => {
    if (!waybillId) {
      setState('notFound');
      return;
    }
    if (showSpinner === true) setState('loading');
    try {
      const [result, brandingResult] = await Promise.all([
        getWaybillByNumber(waybillId),
        getCompanyBranding().catch(() => null),
      ]);
      setManifest(result);
      const { data: history } = await apiClient.get(`/waybills/${encodeURIComponent(waybillId)}/reconciliation-history`);
      setReconciliationHistory(history);
      if (brandingResult) setBranding(brandingResult);
      setState('ready');
    } catch (error) {
      if (showSpinner === false) return;
      const message = error?.response?.data?.message || '';
      const isNotFound = error?.response?.status === 404 || /waybill not found/i.test(message);
      setManifest(null);
      setState(isNotFound ? 'notFound' : 'error');
    }
  }, [waybillId]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  useEffect(() => subscribeRealtimeEvents((event) => {
    if (event.data?.shipmentId === manifest?.shipmentId) loadManifest(false);
  }), [loadManifest, manifest?.shipmentId]);

  const printManifest = () => {
    if (!manifest || typeof document === 'undefined') return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    printDocument.open();
    const logoUri = getRenderedWaybillLogoUri(document);
    printDocument.write(buildWaybillPrintHtml(manifest, logoUri, branding));
    printDocument.close();
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 60000);
    }, 300);
  };

  return (
    <AppShell>
      <Pressable accessibilityRole="link" onPress={() => router.push('/waybills')}>
        <Text style={styles.backLink}>Back to Waybills</Text>
      </Pressable>

      {state === 'loading' ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.ink} size="large" />
          <Text style={styles.stateText}>Loading waybill {waybillId || ''}...</Text>
        </View>
      ) : state === 'notFound' ? (
        <Card>
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Waybill not found</Text>
            <Text style={styles.stateText}>No manifest exists for {waybillId || 'this reference'}.</Text>
            <Button label="Retry" variant="secondary" onPress={loadManifest} style={styles.retryButton} />
          </View>
        </Card>
      ) : state === 'error' ? (
        <Card>
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Could not load this waybill</Text>
            <Text style={styles.stateText}>Check the connection and try again.</Text>
            <Button label="Retry" variant="secondary" onPress={loadManifest} style={styles.retryButton} />
          </View>
        </Card>
      ) : (
        <>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>WAYBILL {manifest.waybillId}</Text>
              <Text style={styles.title}>{manifest.shipmentId}</Text>
              <Text style={styles.subtitle}>Printable manifest for {manifest.recipientName || 'recipient'}</Text>
            </View>
            <View style={styles.headerActions}>
              <StatusBadge value={manifest.statusLabel || manifest.status} kind="waybill" />
              <Button label="Print two A4 copies" onPress={printManifest} />
              <ExceptionAction label="Close as All Lost" record={manifest}
                isAvailable={manifest.status !== 'SIGNED_COMPLETED' && manifest.lostCount > 0
                  && manifest.lostCount === manifest.totalQuantity}
                endpoint={`/waybills/${encodeURIComponent(waybillId)}/close-all-lost`}
                onRefresh={async () => {
                  const record = await getWaybillByNumber(waybillId);
                  const { data: history } = await apiClient.get(`/waybills/${encodeURIComponent(waybillId)}/reconciliation-history`);
                  setManifest(record);
                  setReconciliationHistory(history);
                  return record;
                }} />
            </View>
          </View>
          <View style={styles.reconciliationSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>DELIVERED</Text>
              <Text style={styles.summaryValue}>{manifest.deliveredCount ?? 0}</Text>
            </View>
            <View style={[styles.summaryItem, manifest.lostCount > 0 && styles.lostSummaryItem]}>
              <Text style={[styles.summaryLabel, manifest.lostCount > 0 && styles.lostSummaryText]}>LOST</Text>
              <Text style={[styles.summaryValue, manifest.lostCount > 0 && styles.lostSummaryText]}>{manifest.lostCount ?? 0}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>REMAINING</Text>
              <Text style={styles.summaryValue}>{manifest.remainingCount ?? 0}</Text>
            </View>
          </View>
          <WaybillManifestCard manifest={manifest} companyBranding={branding} />
          {reconciliationHistory.length > 0 && <Card title="RECONCILIATION HISTORY" style={styles.historyCard}>
            {reconciliationHistory.map((event) => <View key={event.eventId}
              style={[styles.historyEvent, event.outcome !== 'ALL_DELIVERED' && styles.lossHistoryEvent]}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, event.outcome !== 'ALL_DELIVERED' && styles.lossHistoryTitle]}>
                  {event.action === 'REOPENED' ? 'WAYBILL REOPENED'
                    : event.outcome === 'ALL_LOST' ? 'CLOSED AS ALL LOST'
                      : event.outcome === 'WITH_LOSS' ? 'CLOSED WITH LOSS' : 'ALL DELIVERED'}
                </Text>
                <Text style={styles.historyTime}>{new Date(event.occurredAt).toLocaleString()}</Text>
              </View>
              <Text style={styles.historyMeta}>By {event.actorId} | Previous custody: {event.custodyState}</Text>
              {event.signedBy && <Text style={styles.historyMeta}>Signed by {event.signedBy}</Text>}
              {event.reason && <Text style={styles.historyReason}>{event.reason}</Text>}
            </View>)}
          </Card>}
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  reconciliationSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  summaryItem: { flex: 1, minWidth: 120, backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
  lostSummaryItem: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  summaryLabel: { fontFamily: fonts.sans, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: colors.inkFaint },
  summaryValue: { fontFamily: fonts.mono, fontSize: 22, fontWeight: '800', color: colors.ink },
  lostSummaryText: { color: colors.danger },
  historyCard: { marginTop: spacing.lg },
  historyEvent: { borderLeftWidth: 3, borderLeftColor: colors.success, backgroundColor: colors.canvas,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  lossHistoryEvent: { borderLeftColor: colors.danger },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  historyTitle: { fontFamily: fonts.sans, fontSize: 10.5, fontWeight: '800', color: colors.success, letterSpacing: 0.7 },
  lossHistoryTitle: { color: colors.danger },
  historyTime: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkFaint },
  historyMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkSoft },
  historyReason: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    marginBottom: spacing.md,
  },
  stateContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  stateText: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkSoft },
  messageCard: { alignItems: 'flex-start', gap: spacing.sm, padding: spacing.lg },
  messageTitle: { fontFamily: fonts.sans, fontSize: 17, fontWeight: '700', color: colors.ink },
  retryButton: { marginTop: spacing.xs },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  headerCopy: { gap: 3 },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.inkFaint,
  },
  title: { fontFamily: fonts.sans, fontSize: 25, fontWeight: '800', color: colors.ink },
  subtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkSoft },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});

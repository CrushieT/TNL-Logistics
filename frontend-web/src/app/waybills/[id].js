import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
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
  const [branding, setBranding] = useState(null);
  const [state, setState] = useState('loading');

  const loadManifest = useCallback(async () => {
    if (!waybillId) {
      setState('notFound');
      return;
    }
    setState('loading');
    try {
      const [result, brandingResult] = await Promise.all([
        getWaybillByNumber(waybillId),
        getCompanyBranding().catch(() => null),
      ]);
      setManifest(result);
      if (brandingResult) setBranding(brandingResult);
      setState('ready');
    } catch (error) {
      const message = error?.response?.data?.message || '';
      const isNotFound = error?.response?.status === 404 || /waybill not found/i.test(message);
      setManifest(null);
      setState(isNotFound ? 'notFound' : 'error');
    }
  }, [waybillId]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

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
            </View>
          </View>
          <WaybillManifestCard manifest={manifest} companyBranding={branding} />
        </>
      )}
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

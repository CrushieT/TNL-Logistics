import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from 'react-native-paper';
import { ActionCard } from '../../../components/common/ActionCard';
import { PressableScale } from '../../../components/common/PressableScale';
import { MobileHeader } from '../../../components/layout/MobileHeader';
import { colors, typography } from '../../../theme';

export function FieldDashboard({ user, onAccount, onLock }) {
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MobileHeader role={user?.role} name={user?.fullName || user?.username} onAccount={onAccount} onLock={onLock} />
      <View style={styles.brandCard}>
        <Image source={require('../../../../assets/tracking-logo.png')} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
        <Text style={styles.brandSubtitle}>Field Courier & Transit Console</Text>
        <View style={styles.divider} />
        <PressableScale contentStyle={styles.statusRow} onPress={() => router.push('/(main)/scan')} activeScale={0.98} accessibilityRole="button" accessibilityLabel="Open camera scanner">
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Camera scanner active · Ready for scans</Text>
          <Icon source="chevron-right" size={16} color={colors.inkFaint} />
        </PressableScale>
      </View>
      <View style={styles.gridRow}>
        <ActionCard iconName="qrcode-scan" title="SCAN QR" subtitle="Advance parcel tracking" onPress={() => router.push('/(main)/scan')} />
        <ActionCard iconName="history" title="TRACKING HISTORY" subtitle="Recent parcels & events" onPress={() => router.push('/(main)/tracking-history')} />
      </View>
      <PressableScale style={styles.queueWrapper} contentStyle={styles.queueCard} onPress={() => router.push('/(main)/offline-queue')} activeScale={0.98} accessibilityRole="button" accessibilityLabel="Open offline scan queue">
        <Icon source="cloud-sync-outline" size={24} color={colors.accent} />
        <View style={styles.queueInfo}><Text style={styles.queueTitle}>OFFLINE QUEUE</Text><Text style={styles.queueSubtitle}>Review scans waiting to synchronize</Text></View>
        <Icon source="chevron-right" size={20} color={colors.inkFaint} />
      </PressableScale>
      <PressableScale style={styles.accountWrapper} contentStyle={styles.accountCard} onPress={onAccount} activeScale={0.98} accessibilityRole="button" accessibilityLabel="Open account and shift settings">
        <Icon source="account-circle-outline" size={24} color={colors.ink} />
        <View style={styles.accountInfo}><Text style={styles.accountTitle}>ACCOUNT & SHIFT</Text><Text style={styles.accountSubtitle}>Profile, device access and security</Text></View>
        <Icon source="chevron-right" size={20} color={colors.inkFaint} />
      </PressableScale>
      <View style={styles.footer}><Text style={styles.footerText}>TNL MOBILE · AUTHENTICATED FIELD ACCESS</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 14, paddingTop: 8, paddingBottom: 32 },
  brandCard: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginHorizontal: 6, marginBottom: 10, padding: 18 },
  brandLogo: { width: 140, height: 40, marginBottom: 8 }, brandTitle: { ...typography.eyebrow, fontSize: 12, letterSpacing: 2, color: colors.ink, fontWeight: '800' },
  brandSubtitle: { fontSize: 11, color: colors.inkFaint, marginTop: 2, fontFamily: 'monospace' }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 12, width: '100%' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8, backgroundColor: colors.success },
  statusText: { fontSize: 11.5, fontFamily: 'monospace', color: colors.inkSoft, fontWeight: '500', marginRight: 4 }, gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  queueWrapper: { marginHorizontal: 6, marginTop: 6 }, queueCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 16 },
  queueInfo: { flex: 1 }, queueTitle: { fontSize: 13.5, fontWeight: '800', color: colors.ink, marginBottom: 2 }, queueSubtitle: { fontSize: 11, color: colors.inkFaint },
  accountWrapper: { marginHorizontal: 6, marginTop: 6 }, accountCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 16 },
  accountInfo: { flex: 1 }, accountTitle: { fontSize: 13.5, fontWeight: '800', color: colors.ink, marginBottom: 2 }, accountSubtitle: { fontSize: 11, color: colors.inkFaint },
  footer: { marginTop: 36, alignItems: 'center' }, footerText: { fontSize: 10, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1, color: colors.inkFaint },
});

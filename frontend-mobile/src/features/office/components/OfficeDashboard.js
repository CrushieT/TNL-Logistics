import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from 'react-native-paper';
import { ActionCard } from '../../../components/common/ActionCard';
import { PressableScale } from '../../../components/common/PressableScale';
import { MobileHeader } from '../../../components/layout/MobileHeader';
import { colors, typography } from '../../../theme';
import { usePrinter } from '../../printer/context/PrinterContext';

export function OfficeDashboard({ user, onAccount, onLock }) {
  const router = useRouter();
  const { isConnected, connectedDevice } = usePrinter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MobileHeader role={user?.role} name={user?.fullName || user?.username} onAccount={onAccount} onLock={onLock} />
      <View style={styles.brandCard}>
        <Image source={require('../../../../assets/tracking-logo.png')} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
        <Text style={styles.brandSubtitle}>Office Intake & Dispatch Console</Text>
        <View style={styles.divider} />
        <PressableScale contentStyle={styles.statusRow} onPress={() => router.push('/(main)/printer')} activeScale={0.98} accessibilityRole="button" accessibilityLabel="Thermal printer setup">
          <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.success : colors.danger }]} />
          <Text style={styles.statusText}>{isConnected ? `${connectedDevice?.name || 'Configured printer'} connected` : 'Thermal printer not connected'}</Text>
        </PressableScale>
      </View>
      <View style={styles.gridRow}>
        <ActionCard iconName="magnify" title="FIND PARCEL" subtitle="PC or mobile records" onPress={() => router.push('/(main)/shipments')} />
        <ActionCard iconName="pencil-outline" title="REGISTER" subtitle="New shipment + labels" onPress={() => router.push('/(main)/register')} />
      </View>
      <PressableScale style={styles.accountWrapper} contentStyle={styles.accountCard} onPress={onAccount} activeScale={0.98} accessibilityRole="button" accessibilityLabel="Open account and shift settings">
        <Icon source="account-circle-outline" size={24} color={colors.ink} />
        <View style={styles.accountInfo}><Text style={styles.accountTitle}>ACCOUNT & SHIFT</Text><Text style={styles.accountSubtitle}>Profile, device access and security</Text></View>
        <Icon source="chevron-right" size={20} color={colors.inkFaint} />
      </PressableScale>
      <View style={styles.footer}><Text style={styles.footerText}>TNL MOBILE · AUTHENTICATED OFFICE ACCESS</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 14, paddingTop: 8, paddingBottom: 32 },
  brandCard: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginHorizontal: 6, marginBottom: 10, padding: 18 },
  brandLogo: { width: 140, height: 40, marginBottom: 8 }, brandTitle: { ...typography.eyebrow, fontSize: 12, letterSpacing: 2, color: colors.ink, fontWeight: '800' },
  brandSubtitle: { fontSize: 11, color: colors.inkFaint, marginTop: 2, fontFamily: 'monospace' }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 12, width: '100%' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 }, statusText: { fontSize: 11.5, fontFamily: 'monospace', color: colors.inkSoft, fontWeight: '500' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }, accountWrapper: { marginHorizontal: 6, marginTop: 6 },
  accountCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 16 },
  accountInfo: { flex: 1 }, accountTitle: { fontSize: 13.5, fontWeight: '800', color: colors.ink, marginBottom: 2 }, accountSubtitle: { fontSize: 11, color: colors.inkFaint },
  footer: { marginTop: 36, alignItems: 'center' }, footerText: { fontSize: 10, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1, color: colors.inkFaint },
});

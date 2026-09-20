import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from 'react-native-paper';
import { colors, typography } from '../../../theme';
import { MobileHeader } from '../../../components/layout/MobileHeader';
import { ActionCard } from '../../../components/common/ActionCard';
import { StatusModal } from '../../../components/common/StatusModal';
import { PressableScale } from '../../../components/common/PressableScale';

export function FieldDashboard({ user, onLogout, onLock }) {
  const router = useRouter();
  const [accountModalVisible, setAccountModalVisible] = useState(false);

  const handleScanQR = () => {
    router.push('/(main)/scan');
  };

  const handleTrackingHistory = () => {
    Alert.alert('Tracking History', "Courier's personal parcel scan log (Phase 6.5).");
  };

  const handleAccount = () => {
    setAccountModalVisible(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MobileHeader
        role={user?.role || 'FIELD_STAFF'}
        name={user?.fullName || user?.username || 'Carlo Reyes'}
        onLogout={onLogout}
        onLock={onLock}
      />

      {/* Brand Hero & Scanner Status Card */}
      <View style={styles.brandCard}>
        <View style={styles.brandHeader}>
          <Image
            source={require('../../../../assets/tracking-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
          <Text style={styles.brandSubtitle}>Field Courier & Transit Console</Text>
        </View>

        <View style={styles.brandDivider} />

        <PressableScale
          contentStyle={styles.scannerStatusRow}
          onPress={handleScanQR}
          activeScale={0.98}
          accessibilityRole="button"
          accessibilityLabel="Open camera scanner"
        >
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={styles.statusText}>Camera scanner active · Ready for scans</Text>
          <Icon source="chevron-right" size={16} color={colors.inkFaint} />
        </PressableScale>
      </View>

      {/* Primary Actions Grid */}
      <View style={styles.gridRow}>
        <ActionCard
          iconName="qrcode-scan"
          title="SCAN QR"
          subtitle="Advance parcel tracking"
          onPress={handleScanQR}
        />
        <ActionCard
          iconName="history"
          title="TRACKING HISTORY"
          subtitle="Recent parcels & events"
          onPress={handleTrackingHistory}
        />
      </View>

      {/* Secondary Account Action Tile */}
      <PressableScale
        style={styles.accountWrapper}
        contentStyle={styles.accountCard}
        onPress={handleAccount}
        activeScale={0.98}
      >
        <View style={styles.accountIconWrapper}>
          <Icon source="account-circle-outline" size={24} color={colors.ink} />
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountTitle}>ACCOUNT & SHIFT</Text>
          <Text style={styles.accountSubtitle}>Courier profile, security & station session</Text>
        </View>
        <Icon source="chevron-right" size={20} color={colors.inkFaint} />
      </PressableScale>


      {/* Grounded Terminal Footer */}
      <View style={styles.terminalFooter}>
        <Text style={styles.footerBrand}>TNL MOBILE · ONE SHARED SYSTEM</Text>
        <Text style={styles.footerStation}>Station: Field Courier · Terminal Active</Text>
      </View>

      {/* Account Profile Modal */}
      <StatusModal
        visible={accountModalVisible}
        eyebrow="COURIER PROFILE"
        title={user?.fullName || user?.username || 'Carlo Reyes'}
        message={`Username: ${user?.username || 'carlo'}\nRole: FIELD STAFF\nStaff Type: ${user?.staffType || 'INTERNAL_TRUCK'}\nStation: Field Courier Transit\nDevice: Bound Handheld Terminal`}
        confirmText="Done"
        onConfirm={() => setAccountModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: 14,
    paddingTop: 8,
    paddingBottom: 32,
  },
  brandCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    marginHorizontal: 6,
    marginBottom: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  brandHeader: {
    alignItems: 'center',
  },
  brandLogo: {
    width: 140,
    height: 40,
    marginBottom: 8,
  },
  brandTitle: {
    ...typography.eyebrow,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.ink,
    fontWeight: '800',
  },
  brandSubtitle: {
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  brandDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
    width: '100%',
  },
  scannerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.inkSoft,
    fontWeight: '500',
    marginRight: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  accountWrapper: {
    marginHorizontal: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  accountIconWrapper: {
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  accountSubtitle: {
    fontSize: 11,
    color: colors.inkFaint,
    lineHeight: 15,
  },
  terminalFooter: {
    marginTop: 36,
    alignItems: 'center',
    gap: 4,
  },
  footerBrand: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.inkFaint,
    textTransform: 'uppercase',
  },
  footerStation: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.inkFaint,
  },
});

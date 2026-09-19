import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Image } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, typography } from '../../../theme';
import { MobileHeader } from '../../../components/layout/MobileHeader';
import { ActionCard } from '../../../components/common/ActionCard';
import { StatusModal } from '../../../components/common/StatusModal';
import { PressableScale } from '../../../components/common/PressableScale';
import { usePrinter } from '../../printer/context/PrinterContext';

export function OfficeDashboard({ user, onLogout, onLock }) {
  const router = useRouter();
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const { isConnected, connectedDevice } = usePrinter();

  const handleFindParcel = () => {
    router.push('/(main)/shipments');
  };

  const handleRegister = () => {
    router.push('/(main)/register');
  };

  const handlePrinter = () => {
    router.push('/(main)/printer');
  };

  const handleAccount = () => {
    setAccountModalVisible(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MobileHeader
        role={user?.role || 'OFFICE_STAFF'}
        name={user?.fullName || user?.username || 'Andrea Lim'}
        onLogout={onLogout}
        onLock={onLock}
      />

      {/* Brand Hero & Hardware Status Card */}
      <View style={styles.brandCard}>
        <View style={styles.brandHeader}>
          <Image
            source={require('../../../../assets/tracking-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
          <Text style={styles.brandSubtitle}>Office Intake & Dispatch Console</Text>
        </View>

        <View style={styles.brandDivider} />

        <PressableScale
          contentStyle={styles.printerStatusRow}
          onPress={handlePrinter}
          activeScale={0.98}
          accessibilityRole="button"
          accessibilityLabel="Thermal printer setup"
        >
          <View
            style={[
              styles.printerDot,
              { backgroundColor: isConnected ? colors.success : colors.danger },
            ]}
          />
          <Text style={styles.printerStatusText}>
            {isConnected
              ? `${connectedDevice?.name || 'Brother RJ-2035B'} connected`
              : 'Thermal printer not connected'}
          </Text>
        </PressableScale>
      </View>

      {/* Primary Actions Grid */}
      <View style={styles.gridRow}>
        <ActionCard
          iconName="magnify"
          title="FIND PARCEL"
          subtitle="PC or mobile records"
          onPress={handleFindParcel}
        />
        <ActionCard
          iconName="pencil-outline"
          title="REGISTER"
          subtitle="New shipment + labels"
          onPress={handleRegister}
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
          <Text style={styles.accountSubtitle}>User profile, security & station session</Text>
        </View>
        <Icon source="chevron-right" size={20} color={colors.inkFaint} />
      </PressableScale>

      {/* Grounded Terminal Footer */}
      <View style={styles.terminalFooter}>
        <Text style={styles.footerBrand}>TNL MOBILE · ONE SHARED SYSTEM</Text>
        <Text style={styles.footerStation}>Station: Central Hub · Terminal Active</Text>
      </View>

      {/* Account Profile Modal */}
      <StatusModal
        visible={accountModalVisible}
        eyebrow="STAFF PROFILE"
        title={user?.fullName || user?.username || 'Andrea Lim'}
        message={`Username: ${user?.username || 'andrea'}\nRole: OFFICE STAFF\nStation: Central Office Hub\nDevice: Bound Handheld Terminal`}
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
  printerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.danger,
    marginRight: 8,
  },
  printerStatusText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.inkSoft,
    fontWeight: '500',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  accountWrapper: {
    marginHorizontal: 6,
    marginTop: 6,
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

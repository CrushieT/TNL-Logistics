import React from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { colors } from '../../../theme';
import { MobileHeader } from '../../../components/layout/MobileHeader';
import { NoticeBanner } from '../../../components/common/NoticeBanner';
import { ActionCard } from '../../../components/common/ActionCard';
import { MetricCard } from '../../../components/common/MetricCard';

export function FieldDashboard({ user, onLogout, onLock }) {
  const handleScanQR = () => {
    Alert.alert('Scan QR', 'Camera QR code scanner with truck selector (Phase 6.4).');
  };

  const handleTrackingHistory = () => {
    Alert.alert('Tracking History', "Courier's personal parcel scan log (Phase 6.5).");
  };

  const handleAccount = () => {
    Alert.alert(
      'Account Settings',
      `User: ${user?.fullName || user?.username}\nRole: FIELD_STAFF\nStaff Type: ${user?.staffType || 'INTERNAL_TRUCK'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MobileHeader
        role={user?.role || 'FIELD_STAFF'}
        name={user?.fullName || user?.username || 'Carlo Reyes'}
        onLogout={onLogout}
        onLock={onLock}
      />

      {/* Role Notice Banner */}
      <NoticeBanner
        title="FIELD STAFF · SCAN-ONLY"
        subtitle="Registration, printing & billing are office functions."
      />

      {/* Action Cards Grid */}
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

      <View style={styles.gridRow}>
        <ActionCard
          iconName="account-circle-outline"
          title="ACCOUNT"
          subtitle="Password · logout"
          onPress={handleAccount}
        />
        <View style={styles.spacerCard} />
      </View>

      {/* Bottom Summary Metric Counters */}
      <View style={styles.gridRow}>
        <MetricCard metric={0} label="Loaded today" />
        <MetricCard metric={0} label="Arrived today" />
      </View>
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
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  spacerCard: {
    flex: 1,
    margin: 6,
  },
});

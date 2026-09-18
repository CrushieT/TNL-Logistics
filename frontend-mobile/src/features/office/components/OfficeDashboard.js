import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { colors } from '../../../theme';
import { MobileHeader } from '../../../components/layout/MobileHeader';
import { ActionCard } from '../../../components/common/ActionCard';
import { MetricCard } from '../../../components/common/MetricCard';
import { PressableScale } from '../../../components/common/PressableScale';

export function OfficeDashboard({ user, onLogout, onLock }) {
  const router = useRouter();

  const handleFindParcel = () => {
    router.push('/(main)/shipments');
  };

  const handleRegister = () => {
    router.push('/(main)/register');
  };

  const handleScanQR = () => {
    Alert.alert('Scan QR', 'Camera QR code scanner (Phase 6.4).');
  };

  const handlePrinter = () => {
    Alert.alert('Printer Setup', 'Bluetooth thermal printer pairing (Phase 6.3).');
  };

  const handleNeedsLabel = () => {
    router.push({ pathname: '/(main)/shipments', params: { filter: 'needs_label' } });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MobileHeader
        role={user?.role || 'OFFICE_STAFF'}
        name={user?.fullName || user?.username || 'Andrea Lim'}
        onLogout={onLogout}
        onLock={onLock}
      />

      {/* Printer Status Pill */}
      <View style={styles.printerStatusWrapper}>
        <View style={styles.printerStatusPill}>
          <View style={styles.printerDot} />
          <Text style={styles.printerStatusText}>Printer not connected</Text>
        </View>
      </View>

      {/* Urgent Label Print Callout Banner */}
      <PressableScale
        contentStyle={styles.labelCalloutCard}
        onPress={handleNeedsLabel}
        activeScale={0.97}
      >
        <View style={styles.calloutHeader}>
          <Text style={styles.calloutTitle}>1 PARCEL NEED A LABEL</Text>
          <Text style={styles.calloutArrow}>→</Text>
        </View>
        <Text style={styles.calloutSubtitle}>
          Generate QR on PC, then print in the field
        </Text>
      </PressableScale>

      {/* 2x2 Grid of Actions */}
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
          subtitle="New shipment + tracking"
          onPress={handleRegister}
        />
      </View>

      <View style={styles.gridRow}>
        <ActionCard
          iconName="qrcode-scan"
          title="SCAN QR"
          subtitle="Advance tracking"
          onPress={handleScanQR}
        />
        <ActionCard
          iconName="printer"
          title="PRINTER"
          subtitle="Bluetooth thermal setup"
          onPress={handlePrinter}
        />
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
  printerStatusWrapper: {
    alignItems: 'flex-start',
    marginBottom: 12,
    marginHorizontal: 6,
  },
  printerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  printerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.danger,
    marginRight: 8,
  },
  printerStatusText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.ink,
    fontWeight: '500',
  },
  labelCalloutCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 4,
    padding: 14,
    marginHorizontal: 6,
    marginBottom: 14,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.3,
  },
  calloutArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  calloutSubtitle: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.inkSoft,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
});

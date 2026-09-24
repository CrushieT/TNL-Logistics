import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { colors, typography } from '../../theme';
import { BackButton } from '../../components/common/BackButton';
import { PressableScale } from '../../components/common/PressableScale';
import { StatusModal } from '../../components/common/StatusModal';
import { usePrinter } from '../../features/printer/context/PrinterContext';
import { ThermalLabelPreviewModal } from '../../components/common/ThermalLabelPreviewModal';
import { normalizeLabelData } from '../../features/printer/services/thermalLabelData';

export default function PrinterSetupScreen() {
  const {
    isConnected,
    connectedDevice,
    isVirtualMode,
    isScanning,
    availableDevices,
    isPrinting,
    scanDevices,
    connectPrinter,
    disconnectPrinter,
    toggleVirtualMode,
    printParcelLabels,
    pendingAuditCount,
    retryPendingAudits,
  } = usePrinter();

  const [statusDialog, setStatusDialog] = useState(null);
  const [samplePreviewVisible, setSamplePreviewVisible] = useState(false);

  // Sample label data matching prototype qr print.png
  const sampleLabelData = normalizeLabelData(
    {
      shipmentId: 'SHP-2026-001',
      recipientDetails: {
        fullName: 'Sample Recipient',
        contactNumber: '0917-555-0148',
        address: '148 Rizal Ave, Caloocan City',
      },
      destination: 'TNL Baguio Hub',
      description: 'Sample office supplies',
      client: 'Sample Client',
      route: 'Manila to TNL Baguio Hub',
      totalAmount: 500,
      quantity: 3,
    },
    {
      trackingId: 'TRK-2026-000101',
      packageIndex: 1,
    },
    0,
    3
  );

  const handleScan = async () => {
    try {
      await scanDevices();
    } catch (err) {
      setStatusDialog({
        title: 'Scan Failed',
        message: err?.message || 'Unable to scan for Bluetooth devices. Ensure Bluetooth is turned on.',
      });
    }
  };

  const handleConnect = async (device) => {
    try {
      await connectPrinter(device);
      setStatusDialog({
        title: 'Printer Connected',
        message: `Connected to ${device.name}. Ready for label printing.`,
      });
    } catch (err) {
      setStatusDialog({
        title: 'Connection Failed',
        message: err?.message || 'Failed to connect to printer.',
      });
    }
  };

  const handleDisconnect = async () => {
    await disconnectPrinter();
  };

  const handleTestPrint = async () => {
    if (isConnected) {
      try {
        const result = await printParcelLabels(
          {
            shipmentId: sampleLabelData.shipmentId,
            recipientDetails: {
              fullName: sampleLabelData.recipientName,
              contactNumber: sampleLabelData.contactNumber,
              address: sampleLabelData.address,
            },
            destination: sampleLabelData.destinationHub,
            description: sampleLabelData.contents,
            client: sampleLabelData.clientName,
            route: sampleLabelData.route,
            totalAmount: sampleLabelData.totalAmount,
            quantity: 1,
          },
          [
            {
              trackingId: sampleLabelData.trackingId,
              packageIndex: sampleLabelData.packageIndex,
            },
          ],
          { auditMode: 'NONE' }
        );
        setStatusDialog({
          title: result.isVirtual ? 'Simulation Complete' : 'Test Print Sent',
          message: result.isVirtual
            ? 'Sample label was simulated. No parcel audit records were changed.'
            : `Sample label printed to ${connectedDevice?.name || 'thermal printer'}.`,
        });
      } catch (err) {
        setStatusDialog({
          title: 'Print Error',
          message: err?.message || 'Failed to send print job.',
        });
      }
    } else {
      // Option A fallback: open sample preview modal
      setSamplePreviewVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>THERMAL PRINTER</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Active Connection Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>CURRENT HARDWARE STATUS</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? colors.success : colors.danger },
              ]}
            />
            <View style={styles.statusTextCol}>
              <Text style={styles.statusTitle}>
                {isConnected ? connectedDevice?.name : 'Thermal printer not connected'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isConnected
                  ? `${connectedDevice?.paperWidth || '58mm continuous roll'} · Status: Ready`
                  : 'Pair or select a Bluetooth thermal printer below'}
              </Text>
            </View>
          </View>

          {isConnected ? (
            <PressableScale
              style={styles.disconnectBtnWrapper}
              contentStyle={styles.disconnectBtn}
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </PressableScale>
          ) : null}
        </View>

        {/* Virtual Mode Switch Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Virtual Thermal Driver</Text>
              <Text style={styles.simulationBadge}>SIMULATION / VIRTUAL</Text>
              <Text style={styles.toggleSubtitle}>
                Simulate Brother RJ-2035B for hardware-free development and offline testing
              </Text>
            </View>
            <Switch
              value={isVirtualMode}
              onValueChange={toggleVirtualMode}
              trackColor={{ false: colors.border, true: colors.ink }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Test Print Action Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>VERIFICATION & DIAGNOSTICS</Text>
          <Text style={styles.diagnosticsDesc}>
            Print or preview the standard 1/4 sheet parcel tracking sticker matching the prototype.
          </Text>
          <PressableScale
            style={styles.testPrintBtnWrapper}
            contentStyle={styles.testPrintBtn}
            onPress={handleTestPrint}
          >
            {isPrinting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.testPrintBtnText}>Test Print Sample Label</Text>
            )}
          </PressableScale>
          <Text style={styles.pendingAuditText}>Pending print audits: {pendingAuditCount}</Text>
          <PressableScale
            contentStyle={styles.retryAuditBtn}
            onPress={retryPendingAudits}
          >
            <Text style={styles.retryAuditText}>Retry Pending Audits</Text>
          </PressableScale>
        </View>

        {/* Available Devices Section */}
        <View style={styles.devicesSection}>
          <View style={styles.devicesHeaderRow}>
            <Text style={styles.sectionTitle}>DISCOVERED PRINTERS</Text>
            <PressableScale
              style={styles.scanBtnWrapper}
              contentStyle={styles.scanBtn}
              onPress={handleScan}
            >
              {isScanning ? (
                <ActivityIndicator color={colors.ink} size="small" />
              ) : (
                <View style={styles.scanBtnInner}>
                  <Icon source="refresh" size={16} color={colors.ink} />
                  <Text style={styles.scanBtnText}>Scan</Text>
                </View>
              )}
            </PressableScale>
          </View>

          {availableDevices.map((device) => {
            const isThisConnected = connectedDevice?.address === device.address;
            return (
              <View key={device.address} style={styles.deviceCard}>
                <View style={styles.deviceIconCol}>
                  <Icon source="printer" size={24} color={colors.ink} />
                </View>
                <View style={styles.deviceInfoCol}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceMeta}>
                    {device.address} · {device.paperWidth || '58mm roll'}
                  </Text>
                </View>
                {isThisConnected ? (
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>CONNECTED</Text>
                  </View>
                ) : (
                  <PressableScale
                    contentStyle={styles.connectBtn}
                    onPress={() => handleConnect(device)}
                  >
                    <Text style={styles.connectBtnText}>Connect</Text>
                  </PressableScale>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Status Feedback Modal */}
      <StatusModal
        visible={Boolean(statusDialog)}
        title={statusDialog?.title}
        message={statusDialog?.message}
        onConfirm={() => setStatusDialog(null)}
      />

      {/* Sample Label Preview Modal (Option A) */}
      <ThermalLabelPreviewModal
        visible={samplePreviewVisible}
        labelData={sampleLabelData}
        onClose={() => setSamplePreviewVisible(false)}
        onPrintDirect={() => {
          setSamplePreviewVisible(false);
          handleTestPrint();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.eyebrow,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginLeft: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 16,
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.inkFaint,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusTextCol: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.2,
  },
  statusSubtitle: {
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  disconnectBtnWrapper: {
    marginTop: 14,
  },
  disconnectBtn: {
    height: 38,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disconnectBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.danger,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  simulationBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.ink,
    color: colors.surface,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
    lineHeight: 15,
  },
  diagnosticsDesc: {
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 16,
    marginBottom: 12,
  },
  testPrintBtnWrapper: {
    width: '100%',
  },
  testPrintBtn: {
    height: 44,
    backgroundColor: colors.black,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pendingAuditText: {
    marginTop: 12,
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.inkFaint,
  },
  retryAuditBtn: {
    marginTop: 8,
    height: 38,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryAuditText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  devicesSection: {
    marginTop: 8,
    gap: 8,
  },
  devicesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.inkFaint,
  },
  scanBtnWrapper: {},
  scanBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  scanBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 12,
    gap: 12,
  },
  deviceIconCol: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 4,
  },
  deviceInfoCol: {
    flex: 1,
  },
  deviceName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
  },
  deviceMeta: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.inkFaint,
    marginTop: 1,
  },
  connectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 3,
    backgroundColor: colors.black,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  connectedBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 2,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.success,
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.success,
  },
});

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
import { IS_VIRTUAL_PRINTER_ENABLED } from '../../features/printer/services/bluetoothPrinterService';

const SHOW_VIRTUAL_PRINTER_TOGGLE = false;

export default function PrinterSetupScreen() {
  const {
    isConnected,
    connectedDevice,
    rememberedDevice,
    connectionError,
    autoReconnectEnabled,
    reconnectPrinter,
    forgetPrinter,
    isVirtualMode,
    isScanning,
    isConnecting,
    availableDevices,
    scanNotice,
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
    try {
      await disconnectPrinter();
    } catch (error) {
      setStatusDialog({ title: 'Disconnect Failed', message: error?.message || 'Unable to disconnect. Try again.' });
    }
  };

  const handleReconnect = async () => {
    try {
      await reconnectPrinter();
    } catch (error) {
      setStatusDialog({ title: 'Connection Failed', message: error?.message || 'Check the printer and try again.' });
    }
  };

  const handleForget = () => setStatusDialog({
    title: 'Forget printer?',
    message: 'Remove the saved printer from this app. Android Bluetooth pairing will remain unchanged.',
    confirmText: 'Forget printer',
    onConfirm: async () => {
      setStatusDialog(null);
      try {
        await forgetPrinter();
      } catch (error) {
        setStatusDialog({ title: 'Forget Failed', message: error?.message || 'Unable to forget the printer. Try again.' });
      }
    },
  });

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

  const hasSecondaryActions = Boolean(
    (isConnected || isConnecting || connectionError || (rememberedDevice && autoReconnectEnabled)) ||
    rememberedDevice
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>THERMAL PRINTER</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Active Connection Hero Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardEyebrow}>CURRENT HARDWARE STATUS</Text>
            <View
              style={[
                styles.heroPill,
                isConnected
                  ? styles.heroPillSuccess
                  : isConnecting
                  ? styles.heroPillInfo
                  : styles.heroPillMuted,
              ]}
            >
              <View
                style={[
                  styles.heroPillDot,
                  {
                    backgroundColor: isConnected
                      ? colors.success
                      : isConnecting
                      ? colors.info
                      : colors.inkFaint,
                  },
                ]}
              />
              <Text
                style={[
                  styles.heroPillText,
                  {
                    color: isConnected
                      ? colors.success
                      : isConnecting
                      ? colors.info
                      : colors.inkSoft,
                  },
                ]}
              >
                {isConnected ? 'CONNECTED' : isConnecting ? 'CONNECTING' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          <View style={styles.heroDeviceRow}>
            <View
              style={[
                styles.heroIconBox,
                isConnected && styles.heroIconBoxConnected,
              ]}
            >
              <Icon
                source="printer"
                size={24}
                color={isConnected ? colors.accent : colors.inkSoft}
              />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.statusTitle}>
                {connectedDevice?.name || rememberedDevice?.name || 'Thermal printer not connected'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isConnected
                  ? `${connectedDevice?.paperWidth || '58mm continuous roll'} · Status: Ready`
                  : 'Pair or select a Bluetooth thermal printer below'}
              </Text>
              {rememberedDevice ? (
                <Text style={styles.deviceAddressMono}>{rememberedDevice.address}</Text>
              ) : null}
            </View>
          </View>

          {isConnecting ? (
            <View style={styles.connectingBanner}>
              <ActivityIndicator size="small" color={colors.ink} />
              <Text style={styles.connectingText}>Connecting to printer...</Text>
            </View>
          ) : null}

          {connectionError ? (
            <View style={styles.errorBanner}>
              <Icon source="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorBannerText} accessibilityRole="alert">
                {connectionError}
              </Text>
            </View>
          ) : null}

          {rememberedDevice && !autoReconnectEnabled && !isVirtualMode ? (
            <View style={styles.pausedBanner}>
              <Icon source="pause-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.pausedBannerText}>
                Automatic reconnection paused. Reconnect to resume.
              </Text>
            </View>
          ) : null}

          {/* Reconnect Action */}
          {!isConnected && rememberedDevice ? (
            <PressableScale
              style={styles.reconnectBtnWrapper}
              contentStyle={styles.reconnectBtn}
              onPress={handleReconnect}
              disabled={isPrinting || isScanning || isConnecting}
            >
              <View style={styles.btnRow}>
                <Icon source="bluetooth-connect" size={16} color="#FFFFFF" />
                <Text style={styles.reconnectBtnText}>Reconnect</Text>
              </View>
            </PressableScale>
          ) : null}

          {/* Secondary Actions (Disconnect & Forget) */}
          {hasSecondaryActions ? (
            <View style={styles.secondaryActionsRow}>
              {isConnected || isConnecting || connectionError || (rememberedDevice && autoReconnectEnabled) ? (
                <PressableScale
                  style={styles.secondaryBtnFlex}
                  contentStyle={styles.disconnectBtn}
                  onPress={handleDisconnect}
                  disabled={isPrinting}
                >
                  <View style={styles.btnRow}>
                    <Icon source="link-variant-off" size={15} color={colors.ink} />
                    <Text style={styles.disconnectBtnText}>Disconnect</Text>
                  </View>
                </PressableScale>
              ) : null}

              {rememberedDevice ? (
                <PressableScale
                  style={styles.secondaryBtnFlex}
                  contentStyle={styles.forgetBtn}
                  onPress={handleForget}
                  disabled={isPrinting}
                >
                  <View style={styles.btnRow}>
                    <Icon source="trash-can-outline" size={15} color={colors.danger} />
                    <Text style={styles.forgetBtnText}>Forget printer</Text>
                  </View>
                </PressableScale>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Development-only simulation controls */}
        {SHOW_VIRTUAL_PRINTER_TOGGLE && IS_VIRTUAL_PRINTER_ENABLED ? (
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <Text style={styles.toggleTitle}>Virtual Thermal Driver</Text>
                <Text style={styles.simulationBadge}>SIMULATION / VIRTUAL</Text>
                <Text style={styles.toggleSubtitle}>
                  Simulate thermal printing for hardware-free development and offline testing
                </Text>
              </View>
              <Switch
                value={isVirtualMode}
                onValueChange={toggleVirtualMode}
                disabled={isConnecting || isPrinting}
                trackColor={{ false: colors.border, true: colors.ink }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        ) : null}

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
            disabled={isConnecting || isPrinting}
          >
            {isPrinting ? (
              <View style={styles.btnRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.testPrintBtnText}>Printing Sample Label...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Icon source={isConnected ? 'printer-check' : 'eye-outline'} size={18} color="#FFFFFF" />
                <Text style={styles.testPrintBtnText}>Test Print Sample Label</Text>
              </View>
            )}
          </PressableScale>

          <View style={styles.auditDivider} />

          <View style={styles.auditRow}>
            <View style={styles.auditTextCol}>
              <Text style={styles.auditEyebrow}>OUTBOX AUDIT QUEUE</Text>
              <Text style={styles.pendingAuditText}>Pending print audits: {pendingAuditCount}</Text>
            </View>
            <PressableScale
              contentStyle={styles.retryAuditBtn}
              onPress={retryPendingAudits}
              disabled={isPrinting}
            >
              <View style={styles.btnRow}>
                <Icon source="sync" size={14} color={colors.ink} />
                <Text style={styles.retryAuditText}>Retry Pending Audits</Text>
              </View>
            </PressableScale>
          </View>
        </View>

        {/* Available Devices Section */}
        <View style={styles.devicesSection}>
          <View style={styles.devicesHeaderRow}>
            <Text style={styles.sectionTitle}>DISCOVERED PRINTERS</Text>
            <PressableScale
              style={styles.scanBtnWrapper}
              contentStyle={styles.scanBtn}
              onPress={handleScan}
              disabled={isScanning || isConnecting || isPrinting}
            >
              {isScanning ? (
                <ActivityIndicator color={colors.ink} size="small" />
              ) : (
                <View style={styles.scanBtnInner}>
                  <Icon source="refresh" size={15} color={colors.ink} />
                  <Text style={styles.scanBtnText}>Scan</Text>
                </View>
              )}
            </PressableScale>
          </View>

          {scanNotice ? (
            <View style={styles.scanNoticeBanner}>
              <Icon source="information-outline" size={16} color={colors.info} />
              <Text style={styles.scanNoticeText} accessibilityRole="alert">
                {scanNotice}
              </Text>
            </View>
          ) : null}

          {availableDevices.length === 0 && !isScanning ? (
            <View style={styles.emptyCard}>
              <Icon source="bluetooth-audio" size={32} color={colors.inkFaint} />
              <Text style={styles.emptyTitle}>NO PRINTERS DISCOVERED</Text>
              <Text style={styles.emptySubtitle}>
                Tap Scan above to search for nearby Bluetooth printers. Make sure the printer is turned on and paired in Android Settings.
              </Text>
            </View>
          ) : null}

          {availableDevices.map((device) => {
            const isThisConnected = connectedDevice?.address === device.address;
            return (
              <View key={device.address} style={styles.deviceCard}>
                <View style={styles.deviceIconCol}>
                  <Icon source="printer" size={22} color={colors.ink} />
                </View>
                <View style={styles.deviceInfoCol}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceMeta}>
                    {device.address} · {device.paperWidth || '58mm roll'}
                  </Text>
                </View>
                {isThisConnected ? (
                  <View style={styles.connectedBadge}>
                    <Icon source="check" size={13} color={colors.success} />
                    <Text style={styles.connectedBadgeText}>CONNECTED</Text>
                  </View>
                ) : (
                  <PressableScale
                    contentStyle={styles.connectBtn}
                    onPress={() => handleConnect(device)}
                    disabled={isConnecting || isScanning || isPrinting}
                  >
                    <Text style={styles.connectBtnText}>{isConnecting ? 'Connecting...' : 'Connect'}</Text>
                  </PressableScale>
                )}
              </View>
            );
          })}
        </View>

        {/* Industrial Dispatch Engine Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            TNL LOGISTICS · THERMAL HARDWARE DISPATCH ENGINE
          </Text>
        </View>
      </ScrollView>

      {/* Status Feedback Modal */}
      <StatusModal
        visible={Boolean(statusDialog)}
        title={statusDialog?.title}
        message={statusDialog?.message}
        confirmText={statusDialog?.confirmText || 'OK'}
        cancelText={statusDialog?.onConfirm ? 'Cancel' : undefined}
        confirmVariant={statusDialog?.confirmText === 'Forget printer' ? 'danger' : 'primary'}
        onCancel={() => setStatusDialog(null)}
        onConfirm={statusDialog?.onConfirm || (() => setStatusDialog(null))}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.eyebrow,
    fontSize: 12,
    color: colors.ink,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.inkFaint,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    gap: 6,
  },
  heroPillSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  heroPillInfo: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.info,
  },
  heroPillMuted: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
  },
  heroPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroPillText: {
    fontSize: 9.5,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 4,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconBoxConnected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  heroTextCol: {
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
    color: colors.inkSoft,
    marginTop: 2,
    lineHeight: 16,
  },
  deviceAddressMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.inkFaint,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  connectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 4,
  },
  connectingText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.info,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 4,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.danger,
    lineHeight: 16,
    fontWeight: '600',
  },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 4,
  },
  pausedBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.warning,
    lineHeight: 16,
    fontWeight: '600',
  },
  reconnectBtnWrapper: {
    marginTop: 14,
    width: '100%',
  },
  reconnectBtn: {
    height: 40,
    backgroundColor: colors.black,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconnectBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryBtnFlex: {
    flex: 1,
  },
  disconnectBtn: {
    height: 38,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  disconnectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  forgetBtn: {
    height: 38,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
  },
  forgetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    lineHeight: 17,
    marginBottom: 14,
  },
  testPrintBtnWrapper: {
    width: '100%',
  },
  testPrintBtn: {
    height: 42,
    backgroundColor: colors.black,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  auditDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  auditTextCol: {
    flex: 1,
  },
  auditEyebrow: {
    fontSize: 9.5,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.inkFaint,
  },
  pendingAuditText: {
    marginTop: 2,
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  retryAuditBtn: {
    paddingHorizontal: 12,
    height: 34,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  retryAuditText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  devicesSection: {
    gap: 10,
  },
  devicesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
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
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scanBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  scanNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 4,
  },
  scanNoticeText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.info,
    lineHeight: 16,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.ink,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 11.5,
    color: colors.inkFaint,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    maxWidth: 320,
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
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
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
    marginTop: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 2,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.success,
  },
  footerNote: {
    marginTop: 12,
    alignItems: 'center',
  },
  footerNoteText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.inkFaint,
  },
});

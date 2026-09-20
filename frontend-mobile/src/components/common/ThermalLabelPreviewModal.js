import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme';
import { QRCodeGenerator } from './QRCodeGenerator';
import { PressableScale } from './PressableScale';
import { usePrinter } from '../../features/printer/context/PrinterContext';
import { buildLabelHtml } from '../../features/printer/services/escposFormatter';
import { generateQRMatrix, generateQRSvgPath } from '../../utils/qr';
import * as Print from 'expo-print';
import * as Crypto from 'expo-crypto';

export function ThermalLabelPreviewModal({
  visible,
  labelData,
  labels,
  onClose,
  onPrintDirect,
  onAuditComplete,
}) {
  const router = useRouter();
  const { isConnected, connectedDevice, isVirtualMode, confirmSystemPrint } = usePrinter();
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [pendingConfirmation, setPendingConfirmation] = React.useState(null);
  const [confirmationNotice, setConfirmationNotice] = React.useState(null);

  const labelsList = labels && labels.length > 0 ? labels : labelData ? [labelData] : [];
  const currentLabel = labelsList[currentIndex] || labelsList[0] || null;

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setPendingConfirmation(null);
      setConfirmationNotice(null);
    }
  }, [visible]);

  if (!visible || !currentLabel) return null;

  const handleSystemPrint = async () => {
    try {
      const html = buildLabelHtml(labelsList);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        } else {
          window.print();
        }
      } else {
        // Native iOS & Android: invoke OS print spooler & Save as PDF
        await Print.printAsync({ html });
      }
      setPendingConfirmation({
        printJobId: Crypto.randomUUID(),
        shipmentId: labelsList[0].shipmentId,
        trackingIds: labelsList.map((label) => label.trackingId),
      });
    } catch (err) {
      console.warn('System print failed:', err);
    }
  };

  const handlePrintedSuccessfully = async () => {
    const auditStatus = await confirmSystemPrint(pendingConfirmation);
    setPendingConfirmation(null);
    onAuditComplete?.(auditStatus);
    if (auditStatus === 'SYNCED') {
      onClose();
    } else {
      setConfirmationNotice('Labels were printed, but the audit is pending. Retry it from Printer Setup without printing again.');
    }
  };

  const handleSavedAsPdf = () => {
    setPendingConfirmation(null);
    setConfirmationNotice('Saved as PDF. Parcel label status remains NOT_PRINTED.');
  };

  const handleCancelled = () => {
    setPendingConfirmation(null);
    setConfirmationNotice('No print audit was recorded.');
  };

  const handleConfigurePrinter = () => {
    onClose();
    router.push('/(main)/printer');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <View>
                <Text style={styles.dialogEyebrow}>THERMAL LABEL PREVIEW</Text>
                <Text style={styles.dialogTitle}>
                  {labelsList.length > 1
                    ? `${labelsList.length} Shipping Labels`
                    : '1/4 Sheet Shipping Sticker'}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close preview">
                <Text style={styles.closeBtnText}>X</Text>
              </Pressable>
            </View>

            {/* Multi-unit pagination switcher */}
            {labelsList.length > 1 ? (
              <View style={styles.carouselBar}>
                <Pressable
                  accessibilityLabel="Previous label"
                  disabled={currentIndex === 0}
                  onPress={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                  style={[styles.carouselBtn, currentIndex === 0 && styles.carouselBtnDisabled]}
                >
                  <Text
                    style={[
                      styles.carouselBtnText,
                      currentIndex === 0 && styles.carouselBtnTextDisabled,
                    ]}
                  >
                    {'<'}
                  </Text>
                </Pressable>

                <View style={styles.carouselInfo}>
                  <Text style={styles.carouselUnitText}>
                    UNIT {currentIndex + 1} OF {labelsList.length}
                  </Text>
                  <Text style={styles.carouselTrackingText}>
                    {currentLabel.trackingId}
                  </Text>
                </View>

                <Pressable
                  accessibilityLabel="Next label"
                  disabled={currentIndex === labelsList.length - 1}
                  onPress={() => setCurrentIndex((idx) => Math.min(labelsList.length - 1, idx + 1))}
                  style={[
                    styles.carouselBtn,
                    currentIndex === labelsList.length - 1 && styles.carouselBtnDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.carouselBtnText,
                      currentIndex === labelsList.length - 1 && styles.carouselBtnTextDisabled,
                    ]}
                  >
                    {'>'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Label Card faithfully reproducing prototype qr print.png */}
            <View style={styles.labelCard}>
              {/* Header */}
              <View style={styles.labelHeader}>
                <View style={styles.brandGroup}>
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandBadgeText}>T</Text>
                  </View>
                  <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
                </View>
                <View style={styles.pkgGroup}>
                  <View style={styles.pkgPill}>
                    <Text style={styles.pkgPillText}>
                      PKG {currentLabel.packageIndex} / {currentLabel.packageCount}
                    </Text>
                  </View>
                  <Text style={styles.scanText}>SCAN TO TRACK</Text>
                </View>
              </View>

              {/* Solid divider */}
              <View style={styles.solidDivider} />

              {/* Body: QR on left, metadata on right */}
              <View style={styles.labelBody}>
                <View style={styles.qrContainer}>
                  <QRCodeGenerator value={currentLabel.trackingId} size={110} />
                </View>

                <View style={styles.metaContainer}>
                  <Text style={styles.trackingIdText} selectable>
                    {currentLabel.trackingId}
                  </Text>
                  <Text style={styles.recipientNameText} numberOfLines={1}>
                    {currentLabel.recipientName}
                  </Text>
                  {currentLabel.contactNumber ? (
                    <Text style={styles.recipientContactText}>{currentLabel.contactNumber}</Text>
                  ) : null}
                  {currentLabel.address ? (
                    <Text style={styles.recipientAddressText} numberOfLines={2}>
                      {currentLabel.address}
                    </Text>
                  ) : null}
                  <Text style={styles.destinationHubText} numberOfLines={1}>
                    to {currentLabel.destinationHub}
                  </Text>
                </View>
              </View>

              {/* Dashed divider */}
              <View style={styles.dashedDivider} />

              {/* Footer: Metadata & Total */}
              <View style={styles.labelFooter}>
                <View style={styles.footerRow}>
                  <Text style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Contents: </Text>
                    {currentLabel.contents}
                  </Text>
                  <Text style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Shipment: </Text>
                    {currentLabel.shipmentId}
                  </Text>
                </View>
                <View style={styles.footerRow}>
                  <Text style={styles.footerItem} numberOfLines={1}>
                    <Text style={styles.footerLabel}>Client: </Text>
                    {currentLabel.clientName}
                  </Text>
                  <Text style={styles.footerItem} numberOfLines={1}>
                    <Text style={styles.footerLabel}>Route: </Text>
                    {currentLabel.route}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalText}>
                    <Text style={styles.footerLabel}>Total: </Text>
                    PHP {Number(currentLabel.totalAmount || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hardware Status Banner */}
            <View style={styles.hardwareBar}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? colors.success : colors.danger },
                ]}
              />
              <Text style={styles.hardwareText}>
                {isVirtualMode
                  ? 'SIMULATION / VIRTUAL DRIVER - no audit records will be changed'
                  : isConnected
                  ? `Printer Ready: ${connectedDevice?.name || 'Brother RJ-2035B'}`
                  : 'Thermal printer not connected'}
              </Text>
            </View>

            {confirmationNotice ? <Text style={styles.confirmationNotice}>{confirmationNotice}</Text> : null}

            {pendingConfirmation ? (
              <View style={styles.confirmationPanel}>
                <Text style={styles.confirmationTitle}>Confirm Label Printing</Text>
                <Text style={styles.confirmationText}>Did your labels print successfully on paper?</Text>
                <PressableScale contentStyle={styles.primaryBtn} onPress={handlePrintedSuccessfully}>
                  <Text style={styles.primaryBtnText}>Printed Successfully</Text>
                </PressableScale>
                <PressableScale contentStyle={styles.secondaryBtn} onPress={handleSavedAsPdf}>
                  <Text style={styles.secondaryBtnText}>Saved as PDF Only</Text>
                </PressableScale>
                <PressableScale contentStyle={styles.secondaryBtn} onPress={handleCancelled}>
                  <Text style={styles.secondaryBtnText}>Cancelled / Failed</Text>
                </PressableScale>
              </View>
            ) : null}

            {/* Action Buttons */}
            {!pendingConfirmation ? <View style={styles.actionRow}>
              {isConnected ? (
                <PressableScale
                  style={styles.actionBtnWrapper}
                  contentStyle={styles.primaryBtn}
                  onPress={onPrintDirect}
                >
                  <Text style={styles.primaryBtnText}>
                    {isVirtualMode
                      ? `Simulate Print (${labelsList.length})`
                      : labelsList.length > 1
                      ? `Print All (${labelsList.length}) to Thermal`
                      : 'Print to Thermal'}
                  </Text>
                </PressableScale>
              ) : (
                <PressableScale
                  style={styles.actionBtnWrapper}
                  contentStyle={styles.primaryBtn}
                  onPress={handleConfigurePrinter}
                >
                  <Text style={styles.primaryBtnText}>Setup Printer</Text>
                </PressableScale>
              )}

              <PressableScale
                style={styles.actionBtnWrapper}
                contentStyle={styles.secondaryBtn}
                onPress={handleSystemPrint}
              >
                <Text style={styles.secondaryBtnText}>Print via System / PDF</Text>
              </PressableScale>
            </View> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dialogEyebrow: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.inkFaint,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.canvas,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  carouselBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  carouselBtn: {
    width: 32,
    height: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselBtnDisabled: {
    opacity: 0.35,
    borderColor: colors.border,
  },
  carouselBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  carouselBtnTextDisabled: {
    color: colors.inkFaint,
  },
  carouselInfo: {
    alignItems: 'center',
  },
  carouselUnitText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.ink,
  },
  carouselTrackingText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.inkSoft,
    marginTop: 1,
  },
  labelCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 4,
    padding: 14,
  },
  labelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 22,
    height: 22,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  brandBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#000000',
    fontFamily: 'monospace',
  },
  pkgGroup: {
    alignItems: 'flex-end',
  },
  pkgPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  pkgPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  scanText: {
    fontSize: 8.5,
    fontFamily: 'monospace',
    color: '#666666',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  solidDivider: {
    height: 1.5,
    backgroundColor: '#000000',
    marginVertical: 10,
  },
  labelBody: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  qrContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 3,
    backgroundColor: '#FFFFFF',
  },
  metaContainer: {
    flex: 1,
    gap: 2,
  },
  trackingIdText: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: '#000000',
  },
  recipientNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  recipientContactText: {
    fontSize: 11,
    color: '#4B5563',
  },
  recipientAddressText: {
    fontSize: 10.5,
    color: '#4B5563',
    lineHeight: 14,
  },
  destinationHubText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#000000',
    marginTop: 2,
  },
  dashedDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    marginVertical: 10,
  },
  labelFooter: {
    gap: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerItem: {
    fontSize: 10,
    color: '#111111',
  },
  footerLabel: {
    color: '#6B7280',
  },
  totalRow: {
    alignItems: 'flex-end',
    marginTop: 2,
  },
  totalText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  hardwareBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hardwareText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: colors.inkSoft,
    fontWeight: '500',
  },
  confirmationNotice: {
    marginTop: 10,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  confirmationPanel: {
    marginTop: 16,
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  confirmationText: {
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtnWrapper: {
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: colors.black,
    height: 44,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    height: 44,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
});

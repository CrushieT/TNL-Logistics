import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import QRCodeGenerator from '../../../components/common/QRCodeGenerator';
import Button from '../../../components/common/Button';
import { colors, fonts, spacing, radius } from '../../../theme';
import {
  assertPrintAuditCapacityAvailable,
  retryPendingPrintAudits,
  submitPrintAudit,
} from '../services/printAuditOutbox';
import { normalizeLabelData, printThermalLabels } from '../services/labelPrintService';
import { getCompanyBranding } from '../../settings/services/settingsApi';

function createPrintJobId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function PrintLabelsModal({
  visible,
  shipment,
  onClose,
  onAuditComplete,
  initialTrackingId,
}) {
  const [branding, setBranding] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [printScope, setPrintScope] = useState('ALL');
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let mounted = true;
    getCompanyBranding()
      .then((data) => {
        if (mounted && data) setBranding(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const units = shipment?.units || [];
  const count = units.length;

  useEffect(() => {
    if (visible) {
      if (initialTrackingId) {
        const foundIdx = units.findIndex((u) => u.trackingId === initialTrackingId);
        setCurrentIndex(foundIdx >= 0 ? foundIdx : 0);
      } else {
        setCurrentIndex(0);
      }
      setPrintScope('ALL');
      setPendingConfirmation(null);
      setNotice(null);
      retryPendingPrintAudits().catch((error) => {
        setNotice(error?.message || 'Unable to retry pending print audits.');
      });
    }
  }, [visible, initialTrackingId, units]);

  if (!visible || !shipment || count === 0) return null;

  const currentUnit = units[currentIndex] || units[0];

  const brandTitle = (branding?.companyName || 'TNL LOGISTICS').toUpperCase();
  const brandBadge = brandTitle.trim().charAt(0) || 'T';

  const handlePrint = (scope = 'ALL') => {
    try {
      assertPrintAuditCapacityAvailable();
      setPrintScope(scope);
      const targetUnits = scope === 'CURRENT' ? [currentUnit] : units;

      const normalizedLabels = targetUnits.map((u, idx) =>
        normalizeLabelData(shipment, u, scope === 'CURRENT' ? currentIndex : idx, count)
      );

      printThermalLabels(normalizedLabels, branding);

      setPendingConfirmation({
        printJobId: createPrintJobId(),
        shipmentId: shipment.shipmentId,
        trackingIds: targetUnits.map((u) => u.trackingId),
      });
    } catch (error) {
      setNotice(error?.message || 'Printing is unavailable because audit storage could not be verified.');
    }
  };

  const handlePrintedSuccessfully = async () => {
    try {
      const status = await submitPrintAudit(pendingConfirmation);
      setPendingConfirmation(null);
      onAuditComplete?.(status);
      if (status === 'SYNCED') {
        onClose();
      } else {
        setNotice('The print audit was not synchronized. Retry the audit without printing again.');
      }
    } catch (error) {
      setNotice(error?.message || 'Unable to store the print audit. Do not print the labels again.');
    }
  };

  const renderLabelCard = (u) => (
    <View key={u.trackingId} style={styles.labelCard}>
      {/* Brand Header */}
      <View style={styles.labelHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>{brandBadge}</Text>
          </View>
          <Text style={styles.brandTitle}>{brandTitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.packagePill}>
            <Text style={styles.packagePillText}>
              PKG {u.packageIndex} / {u.packageCount}
            </Text>
          </View>
          <Text style={styles.scanText}>SCAN TO TRACK</Text>
        </View>
      </View>

      {/* Body: QR Code & Metadata */}
      <View style={styles.labelBody}>
        <View style={styles.qrBox}>
          <QRCodeGenerator value={u.trackingId} size={110} />
        </View>

        <View style={styles.metaCol}>
          <Text style={styles.trackingIdText}>{u.trackingId}</Text>
          <Text style={styles.recipientNameText} numberOfLines={1}>
            {shipment.recipientDetails?.fullName || shipment.recipient || 'Recipient'}
          </Text>
          {shipment.recipientDetails?.contactNumber ? (
            <Text style={styles.recipientSubText}>
              {shipment.recipientDetails.contactNumber}
            </Text>
          ) : null}
          <Text style={styles.recipientAddressText} numberOfLines={2}>
            {shipment.recipientDetails?.address || '-'}
          </Text>
          <Text style={styles.destinationHubText} numberOfLines={1}>
            to {shipment.destination || shipment.destinationHub || 'TNL Baguio Hub'}
          </Text>
        </View>
      </View>

      {/* Footer Details */}
      <View style={styles.labelFooter}>
        <View style={styles.footerRow}>
          <Text style={styles.footerItem}>
            <Text style={styles.footerMuted}>Contents: </Text>
            {shipment.description || ''}
          </Text>
          <Text style={styles.footerItem}>
            <Text style={styles.footerMuted}>Shipment: </Text>
            <Text style={styles.footerMono}>{shipment.shipmentId}</Text>
          </Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerItem} numberOfLines={1}>
            <Text style={styles.footerMuted}>Client: </Text>
            {shipment.client}
          </Text>
          <Text style={styles.footerItem}>
            <Text style={styles.footerMuted}>Route: </Text>
            {shipment.route || ''}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>
            <Text style={styles.footerMuted}>Total: </Text>PHP{' '}
            {Number(shipment.totalAmount || 0).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Interactive Modal Dialog Container (Staff Thermal Preview) */}
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogEyebrow}>THERMAL LABEL PREVIEW</Text>
              <Text style={styles.dialogTitle}>
                {count > 1 ? `${count} Shipping Labels` : '1/4 Sheet Shipping Sticker'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Carousel Switcher for Multi-Unit Shipments */}
          {count > 1 && (
            <View style={styles.carouselBar}>
              <TouchableOpacity
                disabled={currentIndex === 0}
                onPress={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                style={[styles.carouselBtn, currentIndex === 0 && styles.carouselBtnDisabled]}
                activeOpacity={0.7}
              >
                <Text style={[styles.carouselBtnText, currentIndex === 0 && styles.carouselBtnTextDisabled]}>
                  ‹
                </Text>
              </TouchableOpacity>

              <View style={styles.carouselInfo}>
                <Text style={styles.carouselUnitText}>
                  UNIT {currentIndex + 1} OF {count}
                </Text>
                <Text style={styles.carouselTrackingText}>{currentUnit.trackingId}</Text>
              </View>

              <TouchableOpacity
                disabled={currentIndex === count - 1}
                onPress={() => setCurrentIndex((idx) => Math.min(count - 1, idx + 1))}
                style={[styles.carouselBtn, currentIndex === count - 1 && styles.carouselBtnDisabled]}
                activeOpacity={0.7}
              >
                <Text style={[styles.carouselBtnText, currentIndex === count - 1 && styles.carouselBtnTextDisabled]}>
                  ›
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Centered High-Fidelity Thermal Label Card */}
          <View style={styles.cardWrapper}>
            {renderLabelCard(currentUnit)}
          </View>

          {/* Hardware & Spooler Ready Status Banner */}
          <View style={styles.hardwareBar}>
            <View style={styles.statusDot} />
            <Text style={styles.hardwareText}>
              Thermal Spooler Ready — A6 (105mm × 148mm) / 1/4 Sheet Sticker
            </Text>
          </View>

          {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

          {/* Post-Print Confirmation Panel */}
          {pendingConfirmation ? (
            <View style={styles.confirmationPanel}>
              <Text style={styles.confirmationTitle}>Confirm Label Printing</Text>
              <Text style={styles.confirmationSubtitle}>Did your labels print successfully on paper?</Text>
              <View style={styles.confirmationActions}>
                <Button label="Printed Successfully" variant="primary" onPress={handlePrintedSuccessfully} />
                <Button
                  label="Saved as PDF Only"
                  variant="secondary"
                  onPress={() => {
                    setPendingConfirmation(null);
                    setNotice('Saved as PDF. Parcel label status remains NOT_PRINTED.');
                  }}
                />
                <Button
                  label="Cancelled / Failed"
                  variant="secondary"
                  onPress={() => {
                    setPendingConfirmation(null);
                    setNotice('No print audit was recorded.');
                  }}
                />
              </View>
            </View>
          ) : (
            /* Action Buttons */
            <View style={styles.actionRow}>
              <Button label="Close" variant="secondary" onPress={onClose} />
              {count > 1 && (
                <Button
                  label={`Print Unit ${currentUnit.packageIndex} Only`}
                  variant="secondary"
                  onPress={() => handlePrint('CURRENT')}
                />
              )}
              <Button
                label={count > 1 ? `Print All (${count}) Labels` : 'Print Label'}
                variant="primary"
                onPress={() => handlePrint('ALL')}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    width: 440,
    maxWidth: '96vw',
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#111111',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dialogEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.inkFaint,
  },
  dialogTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  carouselBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  carouselBtn: {
    width: 30,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselBtnDisabled: {
    opacity: 0.35,
    borderColor: '#E5E7EB',
  },
  carouselBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 20,
  },
  carouselBtnTextDisabled: {
    color: '#9CA3AF',
  },
  carouselInfo: {
    alignItems: 'center',
  },
  carouselUnitText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#111827',
  },
  carouselTrackingText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 1,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 2,
    padding: 14,
  },
  labelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: '#000000',
    paddingBottom: 8,
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 20,
    height: 20,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  brandBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '900',
  },
  brandTitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#000000',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  packagePill: {
    backgroundColor: '#000000',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 2,
    alignSelf: 'flex-end',
  },
  packagePillText: {
    fontFamily: fonts.sans,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scanText: {
    fontFamily: fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginTop: 2,
    textAlign: 'right',
  },
  labelBody: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  qrBox: {
    width: 116,
    height: 116,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  trackingIdText: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 2,
  },
  recipientNameText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  recipientSubText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: '#4B5563',
  },
  recipientAddressText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 14,
  },
  destinationHubText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#111111',
    marginTop: 2,
  },
  labelFooter: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#6B7280',
    paddingTop: 8,
    gap: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: '#111111',
  },
  footerMono: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: '#111111',
  },
  footerMuted: {
    color: '#6B7280',
  },
  totalRow: {
    alignItems: 'flex-end',
    marginTop: 2,
  },
  totalText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
  },
  hardwareBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D46',
  },
  hardwareText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  noticeText: {
    marginTop: 10,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  confirmationPanel: {
    marginTop: 14,
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 4,
  },
  confirmationTitle: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
  },
  confirmationSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  confirmationActions: {
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
    paddingTop: 14,
    marginTop: 14,
  },
});

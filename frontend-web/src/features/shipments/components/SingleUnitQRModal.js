import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import QRCodeGenerator from '../../../components/common/QRCodeGenerator';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import { colors, fonts, spacing, radius } from '../../../theme';

export default function SingleUnitQRModal({
  visible,
  trackingId,
  packageIndex = 1,
  packageCount = 1,
  recipientName = 'Recipient',
  clientName = 'Client',
  status = 'Registered',
  labelStatus = 'Printed',
  onClose,
  onViewFull,
}) {
  if (!visible || !trackingId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>
                {trackingId} · Package {packageIndex} of {packageCount}
              </Text>
              <Text style={styles.title}>{recipientName.toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <StatusBadge value={status} kind="status" />
            <StatusBadge value={labelStatus} kind="label" />
          </View>

          {/* On-screen QR Card */}
          <View style={styles.qrCard}>
            <Text style={styles.qrBrand}>TNL LOGISTICS</Text>
            <View style={styles.qrBox}>
              <QRCodeGenerator value={trackingId} size={160} />
            </View>
            <Text style={styles.qrTracking}>{trackingId}</Text>
            <Text style={styles.qrScanHint}>SCAN TO TRACK · ON-SCREEN READY</Text>
          </View>

          <Text style={styles.instruction}>
            This high-contrast vector QR code can be scanned directly off your screen using the mobile field app in Phase 2.
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <Button label="Close" variant="secondary" onPress={onClose} />
            {onViewFull ? (
              <Button label="View Full Details →" variant="primary" onPress={onViewFull} />
            ) : null}
          </View>
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
    borderRadius: radius.sm,
    width: 420,
    maxWidth: '94vw',
    padding: spacing.xl,
    borderWidth: 1.5,
    borderColor: '#111111',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '700',
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  qrCard: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  qrBrand: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
  },
  qrTracking: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.md,
    letterSpacing: 0.3,
  },
  qrScanHint: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  instruction: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
    paddingTop: spacing.md,
  },
});

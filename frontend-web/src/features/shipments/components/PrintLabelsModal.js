import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import QRCodeGenerator from '../../../components/common/QRCodeGenerator';
import Button from '../../../components/common/Button';
import { colors, fonts, spacing, radius } from '../../../theme';

export default function PrintLabelsModal({ visible, shipment, onClose, onPrint }) {
  if (!visible || !shipment) return null;

  const units = shipment.units || [];
  const count = units.length;

  const handlePrint = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
    onPrint?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Modal Header */}
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogTitle}>
              PRINT · {count} {count === 1 ? 'LABEL' : 'LABELS'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.dialogSubtitle}>
            {count} parcel {count === 1 ? 'label' : 'labels'} will be printed — each carries its own unique QR + Tracking ID and package sequence.
          </Text>

          {/* Scrollable Label Cards Grid */}
          <ScrollView contentContainerStyle={styles.labelsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.labelsGrid}>
              {units.map((u) => (
                <View key={u.trackingId} style={styles.labelCard}>
                  {/* Brand Header */}
                  <View style={styles.labelHeader}>
                    <View style={styles.brandRow}>
                      <View style={styles.brandBadge}>
                        <Text style={styles.brandBadgeText}>T</Text>
                      </View>
                      <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
                    </View>
                    <Text style={styles.scanText}>SCAN TO TRACK</Text>
                  </View>

                  {/* Body: QR Code & Metadata */}
                  <View style={styles.labelBody}>
                    <View style={styles.qrBox}>
                      <QRCodeGenerator value={u.trackingId} size={110} />
                    </View>

                    <View style={styles.metaCol}>
                      <Text style={styles.trackingIdText}>{u.trackingId}</Text>
                      <View style={styles.packagePill}>
                        <Text style={styles.packagePillText}>
                          PACKAGE {u.packageIndex} OF {u.packageCount}
                        </Text>
                      </View>
                      <Text style={styles.recipientNameText} numberOfLines={1}>
                        {shipment.recipientDetails?.fullName || shipment.recipient}
                      </Text>
                      {shipment.recipientDetails?.contactNumber ? (
                        <Text style={styles.recipientSubText}>
                          {shipment.recipientDetails.contactNumber}
                        </Text>
                      ) : null}
                      <Text style={styles.recipientAddressText} numberOfLines={2}>
                        {shipment.recipientDetails?.address || '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Footer Details */}
                  <View style={styles.labelFooter}>
                    <View style={styles.footerRow}>
                      <Text style={styles.footerItem}>
                        <Text style={styles.footerMuted}>Contents: </Text>
                        {shipment.description || 'General Goods'}
                      </Text>
                      <Text style={styles.footerItem}>
                        <Text style={styles.footerMuted}>Shipment: </Text>
                        {shipment.shipmentId}
                      </Text>
                    </View>
                    <View style={styles.footerRow}>
                      <Text style={styles.footerItem} numberOfLines={1}>
                        <Text style={styles.footerMuted}>Client: </Text>
                        {shipment.client}
                      </Text>
                      <Text style={styles.footerItem}>
                        <Text style={styles.footerMuted}>Route: </Text>
                        {shipment.route || 'Manila → TNL Baguio'}
                      </Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalText}>
                        <Text style={styles.footerMuted}>Shipment Total: </Text>₱
                        {Number(shipment.totalAmount || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.dialogActions}>
            <Button label="Close" variant="secondary" onPress={onClose} />
            <Button label={`Print ${count} Labels`} variant="primary" onPress={handlePrint} />
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
    width: 860,
    maxWidth: '96vw',
    maxHeight: '90vh',
    padding: spacing.xl,
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
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    paddingBottom: spacing.sm,
  },
  dialogTitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#6B7280',
  },
  dialogSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 10,
    marginBottom: 16,
  },
  labelsScroll: {
    paddingVertical: 8,
  },
  labelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  labelCard: {
    width: 380,
    maxWidth: '100%',
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#111111',
    borderRadius: 2,
    padding: 14,
    marginBottom: 8,
  },
  labelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#111111',
    paddingBottom: 6,
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandBadge: {
    width: 18,
    height: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  brandBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '900',
  },
  brandTitle: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#111827',
  },
  scanText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  labelBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  qrBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 3,
    backgroundColor: '#FFFFFF',
  },
  metaCol: {
    flex: 1,
    justifyContent: 'center',
  },
  trackingIdText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  packagePill: {
    backgroundColor: '#000000',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  packagePillText: {
    fontFamily: fonts.sans,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  recipientNameText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  recipientSubText: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: '#4B5563',
  },
  recipientAddressText: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: '#4B5563',
    lineHeight: 14,
    marginTop: 2,
  },
  labelFooter: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    paddingTop: 6,
    gap: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerItem: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    color: '#111827',
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
    fontSize: 10.5,
    fontWeight: '800',
    color: '#111827',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
});

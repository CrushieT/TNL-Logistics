import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCodeGenerator from '../../../components/common/QRCodeGenerator';
import { colors, fonts, spacing, radius } from '../../../theme';

export default function LabelPreview({
  trackingId = 'TRK-2026-000101',
  packageIndex = 1,
  packageCount = 1,
  recipientName = 'Juan Dela Cruz',
  contactNumber = '0917-000-0000',
  address = 'Manila, Philippines',
  contents = 'General Goods',
  shipmentId = 'SHP-2026-001',
  client = 'Northbridge Trading',
  route = 'Manila → TNL Baguio',
  total = 500,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>T</Text>
          </View>
          <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
        </View>
        <Text style={styles.scanText}>SCAN TO TRACK</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.qrBox}>
          <QRCodeGenerator value={trackingId} size={110} />
        </View>

        <View style={styles.metaCol}>
          <Text style={styles.trackingIdText}>{trackingId}</Text>
          <View style={styles.packagePill}>
            <Text style={styles.packagePillText}>
              PACKAGE {packageIndex} OF {packageCount}
            </Text>
          </View>
          <Text style={styles.recipientNameText} numberOfLines={1}>
            {recipientName}
          </Text>
          {contactNumber ? <Text style={styles.recipientSubText}>{contactNumber}</Text> : null}
          <Text style={styles.recipientAddressText} numberOfLines={2}>
            {address}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerItem}>
            <Text style={styles.footerMuted}>Contents: </Text>
            {contents || 'General Goods'}
          </Text>
          <Text style={styles.footerItem}>
            <Text style={styles.footerMuted}>Shipment: </Text>
            {shipmentId}
          </Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerItem} numberOfLines={1}>
            <Text style={styles.footerMuted}>Client: </Text>
            {client || 'Northbridge Trading'}
          </Text>
          <Text style={styles.footerItem}>
            <Text style={styles.footerMuted}>Route: </Text>
            {route || 'Manila → TNL Baguio'}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>
            <Text style={styles.footerMuted}>Shipment Total: </Text>₱{Number(total || 0).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#111111',
    borderRadius: radius.sm,
    padding: 14,
    width: '100%',
    maxWidth: 380,
  },
  header: {
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
  body: {
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
  footer: {
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
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCodeGenerator from './common/QRCodeGenerator';
import { colors, fonts, spacing, radius } from '../constants/theme';

/**
 * Physical printable label preview matching prototype design:
 * Brand header, real vector QR code, tracking ID + sequence badge, recipient block,
 * and dashed metadata footer (contents, shipment, client, route, total).
 */
export default function LabelPreview({
  trackingId = 'TRK-2026-000101',
  packageIndex = 1,
  packageCount = 1,
  recipientName = '',
  contactNumber = '',
  address = '',
  contents = 'Office Supplies',
  shipmentId = 'SHP-2026-001',
  client = 'Northbridge Trading',
  route = 'Manila → TNL Baguio',
  total = 500,
  compact = false,
}) {
  const qrSize = compact ? 90 : 115;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {/* Top Brand Header */}
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>T</Text>
          </View>
          <Text style={styles.brandText}>TNL LOGISTICS</Text>
        </View>
        <Text style={styles.scanText}>SCAN TO TRACK</Text>
      </View>

      {/* Middle QR & Identification Row */}
      <View style={styles.qrRow}>
        <View style={styles.qrContainer}>
          <QRCodeGenerator value={trackingId} size={qrSize} />
        </View>
        <View style={styles.qrMeta}>
          <Text style={styles.trackingId}>{trackingId}</Text>
          {packageIndex != null && (
            <View style={styles.packagePill}>
              <Text style={styles.packagePillText}>
                PACKAGE {packageIndex} OF {packageCount}
              </Text>
            </View>
          )}
          {recipientName ? <Text style={styles.recipientName} numberOfLines={1}>{recipientName}</Text> : null}
          {contactNumber ? <Text style={styles.recipientMeta} numberOfLines={1}>{contactNumber}</Text> : null}
          {address ? <Text style={styles.recipientAddress} numberOfLines={2}>{address}</Text> : null}
        </View>
      </View>

      {/* Bottom Metadata Section */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>
            Contents: <Text style={styles.footerValue}>{contents || '—'}</Text>
          </Text>
          <Text style={styles.footerLabel}>
            Shipment: <Text style={styles.footerValueAccent}>{shipmentId}</Text>
          </Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>
            Client: <Text style={styles.footerValue}>{client}</Text>
          </Text>
          <Text style={styles.footerLabel}>
            Route: <Text style={styles.footerValue}>{route}</Text>
          </Text>
        </View>
        {total != null && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLine}>Shipment Total: ₱{Number(total).toLocaleString()}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#111111',
    borderRadius: 2,
    padding: 14,
    width: '100%',
  },
  cardCompact: {
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#111111',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoMark: {
    width: 20,
    height: 20,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  logoMarkText: {
    fontFamily: fonts.sans,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  brandText: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 13,
    color: '#111827',
    letterSpacing: 0.5,
  },
  scanText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: '#6B7280',
    letterSpacing: 0.8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  qrRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  qrContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  qrMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  trackingId: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  packagePill: {
    backgroundColor: '#000000',
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginBottom: 5,
  },
  packagePillText: {
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  recipientName: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
    marginTop: 1,
  },
  recipientMeta: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: '#4B5563',
  },
  recipientAddress: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: '#4B5563',
    lineHeight: 14,
    marginTop: 2,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#9CA3AF',
    borderStyle: 'dashed',
    paddingTop: 8,
    gap: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: '#6B7280',
  },
  footerValue: {
    fontFamily: fonts.sans,
    color: '#111827',
    fontWeight: '600',
  },
  footerValueAccent: {
    fontFamily: fonts.mono,
    color: colors.accent,
    fontWeight: '700',
  },
  totalRow: {
    alignItems: 'flex-end',
    marginTop: 2,
  },
  totalLine: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: '#111827',
    fontWeight: '800',
  },
});

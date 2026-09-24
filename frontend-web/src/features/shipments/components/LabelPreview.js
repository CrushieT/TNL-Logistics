import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCodeGenerator from '../../../components/common/QRCodeGenerator';
import { colors, fonts, spacing, radius } from '../../../theme';
import { getCompanyBranding } from '../../settings/services/settingsApi';

export default function LabelPreview({
  companyName: propCompanyName,
  trackingId = 'TRK-2026-000101',
  packageIndex = 1,
  packageCount = 1,
  recipientName = 'Juan Dela Cruz',
  contactNumber = '0917-000-0000',
  address = 'Manila, Philippines',
  destination = 'TNL Baguio Hub',
  contents = 'General Goods',
  shipmentId = 'SHP-2026-001',
  client = 'Northbridge Trading',
  route = 'Manila to TNL Baguio',
  total = 500,
}) {
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    if (!propCompanyName) {
      let mounted = true;
      getCompanyBranding()
        .then((data) => {
          if (mounted && data) setBranding(data);
        })
        .catch(() => {});
      return () => {
        mounted = false;
      };
    }
  }, [propCompanyName]);

  const brandTitle = (propCompanyName || branding?.companyName || 'TNL LOGISTICS').toUpperCase();
  const brandBadge = brandTitle.trim().charAt(0) || 'T';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>{brandBadge}</Text>
          </View>
          <Text style={styles.brandTitle}>{brandTitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.packagePill}>
            <Text style={styles.packagePillText}>
              PKG {packageIndex} / {packageCount}
            </Text>
          </View>
          <Text style={styles.scanText}>SCAN TO TRACK</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.qrBox}>
          <QRCodeGenerator value={trackingId} size={110} />
        </View>

        <View style={styles.metaCol}>
          <Text style={styles.trackingIdText}>{trackingId}</Text>
          <Text style={styles.recipientNameText} numberOfLines={1}>
            {recipientName}
          </Text>
          {contactNumber ? <Text style={styles.recipientSubText}>{contactNumber}</Text> : null}
          <Text style={styles.recipientAddressText} numberOfLines={2}>
            {address}
          </Text>
          <Text style={styles.destinationHubText} numberOfLines={1}>
            to {destination}
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
            <Text style={styles.footerMono}>{shipmentId}</Text>
          </Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerItem} numberOfLines={1}>
            <Text style={styles.footerMuted}>Client: </Text>
            {client || 'Northbridge Trading'}
          </Text>
          <Text style={styles.footerItem}>
            <Text style={styles.footerMuted}>Route: </Text>
            {route || 'Manila to TNL Baguio'}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>
            <Text style={styles.footerMuted}>Total: </Text>PHP {Number(total || 0).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 2,
    padding: 14,
    width: '100%',
    maxWidth: 380,
  },
  header: {
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
  body: {
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
  footer: {
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
});

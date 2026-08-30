import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, fonts, spacing, radius } from '../../../theme';

/**
 * Waybill Manifest Card component strictly matching prototype waybills page.png
 */
export default function WaybillManifestCard({ manifest, selectedHauler }) {
  if (!manifest) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No waybill manifest loaded.</Text>
      </View>
    );
  }

  const {
    waybillId,
    shipmentId,
    clientName,
    clientAddress,
    recipientName,
    recipientAddress,
    destinationHub,
    haulerName,
    vehiclePlate,
    description,
    totalQuantity = 1,
    parcels = [],
    generatedDate,
    signedBy,
    signedDate,
    releasedByAdminName,
  } = manifest;

  const displayDocNumber = waybillId ? `${waybillId} · ${shipmentId}` : shipmentId;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const displayDocDate = generatedDate && generatedDate !== '—' ? generatedDate : todayFormatted;

  const isCompleted = manifest.status === 'SIGNED_COMPLETED' || manifest.statusLabel === 'Signed / Completed';

  return (
    <View style={styles.manifestCard} id="printable-waybill-manifest" nativeID="printable-waybill-manifest">
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: landscape;
                  margin: 0;
                }

                html, body {
                  background-color: #FFFFFF !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                /* Hide all screen application layout chrome */
                body * {
                  visibility: hidden !important;
                }

                /* Ensure strictly printable manifest and its contents are visible */
                #printable-waybill-manifest,
                #printable-waybill-manifest * {
                  visibility: visible !important;
                }

                #printable-waybill-manifest {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  right: 0 !important;
                  bottom: 0 !important;
                  width: 100vw !important;
                  height: 100vh !important;
                  box-sizing: border-box !important;
                  margin: 0 !important;
                  padding: 12mm 16mm !important;
                  border: none !important;
                  border-width: 0 !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background-color: #FFFFFF !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `,
          }}
        />
      )}
      {/* Header Block */}
      <View style={styles.headerRow}>
        <View style={styles.brandCol}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>T</Text>
          </View>
          <View style={styles.brandInfo}>
            <Text style={styles.brandTitle}>TNL LOGISTICS</Text>
            <Text style={styles.brandSub}>Manila Central Hub · 0917-555-0000</Text>
          </View>
        </View>

        <View style={styles.docCol}>
          <Text style={styles.docTitle}>WAYBILL</Text>
          <Text style={styles.docNumber}>{displayDocNumber}</Text>
          <Text style={styles.docDate}>{displayDocDate}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Shipper & Consignee Columns */}
      <View style={styles.partiesRow}>
        <View style={styles.partyCol}>
          <Text style={styles.partyEyebrow}>SHIPPER / CLIENT</Text>
          <Text style={styles.partyName}>{clientName || '—'}</Text>
          <Text style={styles.partyAddress}>{clientAddress || '—'}</Text>
        </View>

        <View style={[styles.partyCol, styles.partyColRight]}>
          <Text style={styles.partyEyebrow}>CONSIGNEE / DESTINATION</Text>
          <Text style={styles.partyName}>{recipientName || '—'}</Text>
          <Text style={styles.partyHub}>{destinationHub || 'TNL Baguio Hub'}</Text>
          <Text style={styles.partyAddress}>{recipientAddress || '—'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Cargo Tracking Items Table */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.thCell, { flex: 2 }]}>TRACKING ID</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>PACKAGE</Text>
          <Text style={[styles.thCell, { flex: 2.5 }]}>CONTENTS</Text>
          <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>WEIGHT</Text>
        </View>

        {parcels.length > 0 ? (
          parcels.map((parcel, idx) => (
            <View key={parcel.trackingId || idx} style={styles.tableRow}>
              <Text style={[styles.tdCell, styles.monoText, { flex: 2 }]}>
                {parcel.trackingId}
              </Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>
                {parcel.packageNumber || `${idx + 1} of ${totalQuantity}`}
              </Text>
              <Text style={[styles.tdCell, { flex: 2.5 }]} numberOfLines={1}>
                {description || 'General Cargo'}
              </Text>
              <Text style={[styles.tdCell, styles.monoText, { flex: 1.2, textAlign: 'right' }]}>
                {parcel.weightKg !== undefined ? `${Number(parcel.weightKg).toFixed(1)} kg` : '2.5 kg'}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRow}>
            <Text style={[styles.tdCell, styles.monoText, { flex: 2 }]}>
              TRK-PENDING
            </Text>
            <Text style={[styles.tdCell, { flex: 1 }]}>1 of {totalQuantity}</Text>
            <Text style={[styles.tdCell, { flex: 2.5 }]}>{description || 'General Cargo'}</Text>
            <Text style={[styles.tdCell, styles.monoText, { flex: 1.2, textAlign: 'right' }]}>2.5 kg</Text>
          </View>
        )}
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Parcel Qty: </Text>
          <Text style={styles.summaryValue}>{totalQuantity}</Text>
        </Text>
        <Text style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Hauler: </Text>
          <Text style={styles.summaryValue}>{haulerName && haulerName !== '—' ? haulerName : (selectedHauler || '—')}</Text>
        </Text>
        <Text style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Truck: </Text>
          <Text style={styles.summaryValue}>{vehiclePlate || 'ABC-1234'}</Text>
        </Text>
      </View>

      {/* Signature Sections (2 Balanced Columns, Left & Right Aligned) */}
      <View style={styles.signaturesRow}>
        {/* Left: RELEASED BY */}
        <View style={styles.sigCol}>
          <Text style={styles.sigEyebrow}>RELEASED BY</Text>
          <View style={styles.sigLineContainer}>
            <Text style={styles.sigAdminName}>{releasedByAdminName || 'Maria Santos'}</Text>
            <View style={styles.sigLine} />
          </View>
          <Text style={styles.sigSubLabel}>Signature</Text>
        </View>

        {/* Right: CLIENT SIGNATURE AND PRINTED NAME */}
        <View style={[styles.sigCol, styles.sigColRight]}>
          <Text style={styles.sigEyebrow}>CLIENT SIGNATURE AND PRINTED NAME</Text>
          <View style={styles.sigLineContainer}>
            {isCompleted && signedBy ? (
              <Text style={styles.sigAdminName}>{signedBy}</Text>
            ) : (
              <View style={styles.sigBlankSpacer} />
            )}
            <View style={styles.sigLine} />
          </View>
          <View style={styles.sigClientMetaRight}>
            <Text style={styles.sigMetaLabel}>
              Date:{' '}
              <Text style={styles.sigMetaValue}>
                {isCompleted && signedDate ? signedDate : '_________________'}
              </Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1DFD5',
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkFaint,
  },
  manifestCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1DFD5',
    paddingHorizontal: 36,
    paddingVertical: 32,
    borderRadius: radius.sm,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
  },
  brandCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoMark: {
    width: 44,
    height: 44,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  logoMarkText: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
  },
  brandInfo: {
    gap: 2,
  },
  brandTitle: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 16,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  docCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  docTitle: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 17,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  docNumber: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  docDate: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E1DFD5',
    marginVertical: spacing.md + 2,
  },
  partiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xl,
    paddingVertical: spacing.xs,
  },
  partyCol: {
    flex: 1,
    gap: 3,
  },
  partyColRight: {
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  partyEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  partyName: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
  },
  partyHub: {
    fontFamily: fonts.sans,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  partyAddress: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  tableContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    marginBottom: 4,
  },
  thCell: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EFEA',
    alignItems: 'center',
  },
  tdCell: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
  },
  monoText: {
    fontFamily: fonts.mono,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E1DFD5',
    borderBottomWidth: 1,
    borderBottomColor: '#E1DFD5',
    marginVertical: spacing.sm,
  },
  summaryItem: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
  },
  summaryLabel: {
    color: colors.inkFaint,
    fontFamily: fonts.sans,
  },
  summaryValue: {
    fontFamily: fonts.sans,
    fontWeight: '700',
    color: colors.ink,
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sigCol: {
    flex: 1,
    gap: 4,
  },
  sigColRight: {
    alignItems: 'flex-end',
  },
  sigEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sigLineContainer: {
    marginTop: 16,
  },
  sigBlankSpacer: {
    height: 19,
  },
  sigAdminName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  sigLine: {
    width: 220,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    marginBottom: 6,
  },
  sigSubLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
  },
  sigClientMeta: {
    gap: 4,
  },
  sigClientMetaRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  sigMetaLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
  },
  sigMetaValue: {
    fontFamily: fonts.sans,
    fontWeight: '600',
    color: colors.ink,
  },
});

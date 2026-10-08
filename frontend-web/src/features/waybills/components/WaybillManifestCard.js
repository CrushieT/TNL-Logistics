import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCodeGenerator from '../../../components/common/QRCodeGenerator';
import { colors, fonts, spacing, radius } from '../../../theme';
import { getCompanyBranding } from '../../settings/services/settingsApi';
import { getWaybillQrPayload, paginateWaybillParcels, WAYBILL_ITEMS_PER_PAGE } from '../services/waybillPrint.mjs';

/**
 * Waybill Manifest Card component strictly matching prototype waybills page.png
 */
export default function WaybillManifestCard({ manifest, selectedHauler, companyBranding = null }) {
  const [branding, setBranding] = useState(companyBranding || null);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (companyBranding) {
      setBranding(companyBranding);
      return;
    }
    let mounted = true;
    getCompanyBranding()
      .then((res) => {
        if (mounted && res) setBranding(res);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [companyBranding]);

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

  const displayDocNumber = waybillId ? `${waybillId} | ${shipmentId}` : shipmentId;
  const returnQrPayload = waybillId ? getWaybillQrPayload(waybillId) : null;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const displayDocDate = generatedDate && generatedDate !== '-' ? generatedDate : todayFormatted;

  const brandName = (branding?.companyName || 'TC & CT INTEGRATED LOGISTICS').toUpperCase();
  const brandAddress = branding?.companyAddress || 'Manila Central Hub';
  const brandContact = branding?.companyContact || '0917-555-0000';
  const brandEmail = branding?.billingEmail || 'billing@tcct.ph';
  const brandSubtext = `${brandAddress} | ${brandContact} | ${brandEmail}`;

  const isCompleted = manifest.status === 'SIGNED_COMPLETED' || manifest.statusLabel === 'Signed / Completed';

  const paginatedPages = useMemo(() => paginateWaybillParcels(parcels), [parcels]);
  const totalPages = paginatedPages.length;

  return (
    <View style={styles.container}>
      {paginatedPages.map((pageItems, pageIndex) => {
        const pageNumber = pageIndex + 1;
        const isLastPage = pageIndex === totalPages - 1;

        return (
          <View
            key={`waybill-page-${pageIndex}`}
            style={[
              styles.manifestCard,
              totalPages > 1 && styles.stackedPaper,
            ]}
            id={pageIndex === 0 ? 'printable-waybill-manifest' : `printable-waybill-manifest-${pageIndex}`}
            nativeID={pageIndex === 0 ? 'printable-waybill-manifest' : `printable-waybill-manifest-${pageIndex}`}
          >
            {/* Top-Centered Letterhead Brand Header */}
            <View style={styles.letterheadBlock}>
              {logoFailed ? (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoFallbackText}>LOGISTICS</Text>
                </View>
              ) : (
                <View style={styles.letterheadLogoWrap}>
                  <Image
                    source={require('../../../../assets/tracking-logo.png')}
                    style={styles.brandLogo}
                    accessibilityLabel={brandName}
                    resizeMode="contain"
                    onError={() => setLogoFailed(true)}
                  />
                </View>
              )}
              <Text style={styles.companyNameCentered}>{brandName}</Text>
              <Text style={styles.companySubtextCentered}>{brandSubtext}</Text>
            </View>

            {/* Hairline Divider below Letterhead */}
            <View style={styles.letterheadDivider} />

            {/* Document Header Row: Waybill Metadata on Far Left, Return QR in Center, Consignee on Far Right */}
            <View style={styles.metaRow}>
              <View style={styles.metaCol}>
                <Text style={styles.documentTitle}>WAYBILL</Text>
                <View style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Waybill No. </Text>
                  <Text style={styles.metaValueMono}>{waybillId || '-'}</Text>
                </View>
                <View style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Shipment No. </Text>
                  <Text style={styles.metaValueMono}>{shipmentId || '-'}</Text>
                </View>
                <View style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Date: </Text>
                  <Text style={styles.metaValue}>{displayDocDate}</Text>
                </View>
              </View>

              {returnQrPayload ? (
                <View
                  style={styles.returnQrCol}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={returnQrPayload}
                >
                  <Text style={styles.returnQrLabel}>RETURN CONFIRMATION QR</Text>
                  <QRCodeGenerator value={returnQrPayload} size={88} quietZone={4} />
                </View>
              ) : null}

              <View style={styles.deliveryCol}>
                <Text style={styles.sectionEyebrow}>DELIVER TO / CONSIGNEE</Text>
                <Text style={styles.consigneeName}>{recipientName || '-'}</Text>
                {recipientAddress ? <Text style={styles.consigneeAddress}>{recipientAddress}</Text> : null}
                {manifest.recipientContact ? (
                  <View style={styles.consigneeMetaRow}>
                    <Text style={styles.consigneeMetaText}>
                      <Text style={styles.consigneeMetaLabel}>Contact: </Text>
                      <Text style={styles.consigneeMetaVal}>{manifest.recipientContact}</Text>
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Single Solid Black Divider */}
            <View style={styles.solidDivider} />

            {/* Cargo Tracking Items Table */}
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 2 }]}>TRACKING ID</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>PACKAGE</Text>
                <Text style={[styles.thCell, { flex: 2.5 }]}>CONTENTS</Text>
                <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>WEIGHT</Text>
              </View>

              {pageItems.length > 0 ? (
                pageItems.map((parcel, idx) => {
                  const overallIndex = pageIndex * WAYBILL_ITEMS_PER_PAGE + idx;
                  const seq = parcel.seq ?? parcel.packageIndex ?? (overallIndex + 1);
                  const total = parcel.packageCount ?? totalQuantity ?? parcels.length;
                  const packageDisplay = parcel.packageNumber || `${seq} of ${total}`;
                  const weightDisplay = parcel.weightKg !== undefined && parcel.weightKg !== null && parcel.weightKg !== ''
                    ? `${Number(parcel.weightKg).toFixed(1)} kg`
                    : '2.5 kg';

                  return (
                    <View key={parcel.trackingId || overallIndex} style={styles.tableRow}>
                      <Text style={[styles.tdCell, styles.monoText, { flex: 2 }]}>
                        {parcel.trackingId}
                      </Text>
                      <Text style={[styles.tdCell, { flex: 1 }]}>
                        {packageDisplay}
                      </Text>
                      <Text style={[styles.tdCell, { flex: 2.5 }]} numberOfLines={1}>
                        {description || 'General Cargo'}
                      </Text>
                      <Text style={[styles.tdCell, styles.monoText, { flex: 1.2, textAlign: 'right' }]}>
                        {weightDisplay}
                      </Text>
                    </View>
                  );
                })
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

            {/* Non-last page spacer */}
            {!isLastPage && <View style={styles.nonLastPageSpacer} />}

            {/* Final Page Summary and Signatures */}
            {isLastPage && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Parcel Qty: </Text>
                    <Text style={styles.summaryValue}>{totalQuantity}</Text>
                  </Text>
                  <Text style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Truck: </Text>
                    <Text style={styles.summaryValue}>{vehiclePlate || manifest.truckPlate || manifest.plateNumber || '-'}</Text>
                  </Text>
                </View>

                <View style={styles.signaturesRow}>
                  <View style={styles.sigCol}>
                    <Text style={styles.sigEyebrow}>RELEASED BY</Text>
                    <View style={styles.sigLineContainer}>
                      <Text style={styles.sigAdminName}>{releasedByAdminName || 'Hauler Staff'}</Text>
                      <View style={styles.sigLine} />
                    </View>
                    <Text style={styles.sigSubLabel}>Signature</Text>
                  </View>

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
              </>
            )}

            {/* Bottom Footnote on EVERY Sheet */}
            <View style={[styles.pageFootnoteRow, isLastPage && styles.pageFootnoteLast]}>
              <Text style={styles.pageFootnoteText}>
                Waybill {waybillId || shipmentId} | Manifest for {recipientName || 'Consignee'}
              </Text>
              <Text style={styles.pageNumberText}>
                Page {pageNumber} of {totalPages}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  stackedPaper: {
    marginBottom: spacing.lg,
  },
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
    maxWidth: 760,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  letterheadBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  letterheadLogoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  brandLogo: {
    width: 150,
    height: 48,
  },
  logoFallback: {
    width: 150,
    height: 48,
    borderWidth: 2,
    borderColor: '#111110',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  logoFallbackText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '900',
    color: '#111110',
  },
  companyNameCentered: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '900',
    color: '#111110',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  companySubtextCentered: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  letterheadDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E1DFD5',
    height: 0,
    marginTop: 6,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  metaCol: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: spacing.md,
  },
  deliveryCol: {
    flex: 1,
    alignItems: 'flex-end',
    paddingLeft: spacing.md,
  },
  documentTitle: {
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: '900',
    color: '#111110',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1.5,
  },
  metaLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkMuted,
  },
  metaValue: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#111110',
    fontWeight: '700',
  },
  metaValueMono: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: '#111110',
    fontWeight: '900',
  },
  returnQrCol: {
    alignItems: 'center',
    gap: 4,
    minWidth: 100,
  },
  returnQrLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  solidDivider: {
    borderTopWidth: 1.5,
    borderTopColor: '#111110',
    height: 0,
    marginVertical: 10,
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
    textAlign: 'right',
  },
  consigneeName: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#111110',
    textAlign: 'right',
  },
  consigneeAddress: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    marginTop: 1,
    textAlign: 'right',
  },
  consigneeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: 4,
  },
  consigneeMetaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink,
    textAlign: 'right',
  },
  consigneeMetaLabel: {
    color: colors.inkMuted,
  },
  consigneeMetaVal: {
    fontWeight: '700',
    color: '#111110',
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
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EFEA',
    alignItems: 'center',
  },
  tdCell: {
    fontFamily: fonts.sans,
    fontSize: 14,
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
    fontSize: 13,
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
    fontSize: 11,
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
    fontSize: 13.5,
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  nonLastPageSpacer: {
    minHeight: 140,
    flexGrow: 1,
  },
  pageFootnoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E1DFD5',
  },
  pageFootnoteLast: {
    marginTop: spacing.lg,
  },
  pageFootnoteText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  pageNumberText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
  },
});

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { colors, fonts, spacing, radius } from '../../../theme';
import { formatCurrency } from '../utils/collectionsUtils';
import {
  createStatementPrintSheetSequence,
  paginateStatementItems,
} from '../utils/statementPrintModel.mjs';

export { paginateStatementItems } from '../utils/statementPrintModel.mjs';

export const STATEMENT_LOGO_SOURCE = require('../../../../assets/tracking-logo.png');

function StatementLogo({ compact = false, forceFallback = false, size = 150 }) {
  const [hasLoadError, setHasLoadError] = React.useState(false);

  const logoWidth = compact ? 88 : size;
  const logoHeight = Math.round(logoWidth * (580 / 1800));

  if (forceFallback || hasLoadError) {
    return (
      <View style={[styles.logoFallback, { width: logoWidth, height: logoHeight }]}>
        <Text style={[styles.logoFallbackText, compact && styles.logoFallbackTextCompact]}>TNL</Text>
      </View>
    );
  }

  const asset = Image.resolveAssetSource ? Image.resolveAssetSource(STATEMENT_LOGO_SOURCE) : null;
  const logoUri = asset?.uri || (typeof STATEMENT_LOGO_SOURCE === 'string' ? STATEMENT_LOGO_SOURCE : (STATEMENT_LOGO_SOURCE?.uri || STATEMENT_LOGO_SOURCE?.default || ''));

  if (Platform.OS === 'web' && logoUri) {
    return (
      <img
        src={logoUri}
        alt="TNL Logistics"
        onError={() => setHasLoadError(true)}
        style={{
          width: logoWidth,
          height: logoHeight,
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto',
        }}
      />
    );
  }

  return (
    <Image
      source={STATEMENT_LOGO_SOURCE}
      resizeMode="contain"
      onError={() => setHasLoadError(true)}
      style={[{ width: logoWidth, height: logoHeight }]}
    />
  );
}

function PaymentInstructionsBox({ bankName, accountName, accountNumber }) {
  return (
    <View style={styles.paymentInstructionsBox}>
      <Text style={styles.paymentInstructionsTitle}>PAYMENT INSTRUCTIONS</Text>
      <Text style={styles.paymentInstructionsText}>
        Please settle the amount due on or before the stated collection date. Make checks payable to the account name below. For bank deposits or transfers, use the following details and include the SOA number as the payment reference.
      </Text>
      <View style={styles.bankDetailsGrid}>
        <View style={styles.bankDetailRow}>
          <Text style={styles.bankDetailLabel}>Bank:</Text>
          <Text style={styles.bankDetailValue}>{bankName}</Text>
        </View>
        <View style={styles.bankDetailRow}>
          <Text style={styles.bankDetailLabel}>Account Name:</Text>
          <Text style={styles.bankDetailValue}>{accountName}</Text>
        </View>
        <View style={styles.bankDetailRow}>
          <Text style={styles.bankDetailLabel}>Account Number:</Text>
          <Text style={styles.bankAccountNumber}>{accountNumber}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * StatementPaperCard renders stacked multi-page A4 Statement of Account documents
 * matching prototype soa page.png and prototype soa long printable .png.
 */
export default function StatementPaperCard({
  data,
  currentUser = { name: 'Maria Santos', role: 'Administrator' },
  liveDeduction,
  liveDeductionNote,
  liveCollectedBy,
  companyBranding = null,
  copies = 1,
  showLogo = true,
  logoLoadFailed = false,
}) {
  if (!data) return null;

  const {
    clientName = '-',
    clientAddress = '',
    clientContact = '',
    clientEmail = '',
    cycleRangeLabel = '',
    shipmentsCount = 0,
    soaNo = 'SOA-2026-000-W00',
    statementDate = '',
    collectionDate = '',
    totalCharges = 0,
    totalPaid = 0,
    items = [],
  } = data;

  const deductionVal = Number(liveDeduction ?? data.deductionAmount ?? 0);
  const deductionReason = liveDeductionNote ?? data.deductionNote ?? '';
  const collector = liveCollectedBy ?? data.collectedBy ?? '';

  const finalAmountDue = Math.max(0, Number(totalCharges || 0) - Number(totalPaid || 0) - deductionVal);

  const formattedStatementDate = statementDate
    ? new Date(statementDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '-';

  const formattedCollectionDate = collectionDate
    ? `${new Date(collectionDate).toLocaleDateString('en-US', { weekday: 'short' })}, ${new Date(collectionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : '-';

  const branding = companyBranding || data;
  const brandName = (branding.companyName || 'TNL LOGISTICS').toUpperCase();
  const brandAddress = branding.companyAddress || 'Manila Central Hub';
  const brandContact = branding.companyContact || '0917-555-0000';
  const brandEmail = branding.billingEmail || 'billing@tnllogistics.ph';
  const brandSubtext = `${brandAddress} | ${brandContact} | ${brandEmail}`;
  const bankName = data.soaBankName || 'Not configured';
  const accountName = data.soaAccountName || 'Not configured';
  const accountNumber = data.soaAccountNumber || 'Not configured';

  // Paginate statement items into distinct physical A4 sheets
  const paginatedPages = useMemo(() => paginateStatementItems(items), [items]);
  const totalPages = paginatedPages.length;
  const printSheets = useMemo(
    () => createStatementPrintSheetSequence(paginatedPages, copies),
    [paginatedPages, copies],
  );

  return (
    <View style={styles.container}>
      {printSheets.map(({ copyIndex, pageIndex, pageNumber, isLastPage, pageItems }) => {
        return (
          <View
            key={`soa-copy-${copyIndex}-sheet-${pageIndex}`}
            style={[
              styles.paper,
              totalPages > 1 && styles.stackedPaper,
            ]}
            className="soa-paper-sheet"
            nativeID={`soa-printable-sheet-${copyIndex}-${pageIndex}`}
          >
            {/* Top-Centered Letterhead Brand Header (Rendered on Every Page) */}
            <View style={styles.letterheadBlock}>
              {showLogo && (
                <View style={styles.letterheadLogoWrap}>
                  <StatementLogo forceFallback={logoLoadFailed} size={150} />
                </View>
              )}
              <Text style={styles.companyNameCentered}>{brandName}</Text>
              <Text style={styles.companySubtextCentered}>{brandSubtext}</Text>
            </View>

            {/* Hairline Divider below Letterhead */}
            <View style={styles.letterheadDivider} />

            {/* Document Meta Row: Title on Left, SOA Metadata on Right */}
            <View style={styles.metaRow}>
              <View style={styles.titleCol}>
                <Text style={styles.documentTitle}>STATEMENT OF ACCOUNT</Text>
              </View>

              <View style={styles.metaCol}>
                <Text style={styles.metaLine}>
                  <Text style={styles.metaLabel}>SOA No. </Text>
                  <Text style={styles.metaValueMono}>{soaNo}</Text>
                </Text>
                <Text style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Statement Date: </Text>
                  <Text style={styles.metaValue}>{formattedStatementDate}</Text>
                </Text>
                <Text style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Collection Date: </Text>
                  <Text style={styles.metaValue}>{formattedCollectionDate}</Text>
                </Text>
              </View>
            </View>

            {/* Bill To & Collection Week Information Row (Rendered on Every Page) */}
            <View style={styles.infoRow}>
              <View style={styles.billToCol}>
                <Text style={styles.sectionEyebrow}>BILL TO</Text>
                <Text style={styles.clientName}>{clientName}</Text>
                {clientAddress ? <Text style={styles.clientAddress}>{clientAddress}</Text> : null}
                {(clientContact || clientEmail) ? (
                  <Text style={styles.clientContact}>
                    {[clientContact, clientEmail].filter(Boolean).join(' | ')}
                  </Text>
                ) : null}
              </View>

              <View style={styles.weekCol}>
                <Text style={styles.sectionEyebrowRight}>COLLECTION WEEK</Text>
                <Text style={styles.weekRange}>{cycleRangeLabel || 'Current Billing Cycle'}</Text>
                <Text style={styles.outstandingCount}>
                  {shipmentsCount} {shipmentsCount === 1 ? 'outstanding shipment' : 'outstanding shipments'}
                </Text>
              </View>
            </View>

            {/* Single Solid Black Divider Line */}
            <View style={styles.solidDivider} />

            {/* Itemized Shipments Table */}
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thText, styles.colDate]}>DATE</Text>
                <Text style={[styles.thText, styles.colShipment]}>SHIPMENT</Text>
                <Text style={[styles.thText, styles.colQty]}>QTY</Text>
                <Text style={[styles.thText, styles.colCharges]}>CHARGES</Text>
                <Text style={[styles.thText, styles.colDue]}>DUE</Text>
                <Text style={[styles.thText, styles.colPaid]}>PAID</Text>
                <Text style={[styles.thText, styles.colBalance]}>BALANCE</Text>
              </View>
              <View style={styles.tableHeaderDivider} />

              {/* Table Body */}
              {pageItems.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No shipments found for this client in the selected cycle.</Text>
                </View>
              ) : (
                pageItems.map((item, rowIdx) => {
                  const itemChargesTotal = Number(item.charges || 0) + Number(item.otherCharges || 0);
                  return (
                    <View
                      key={item.shipmentId || rowIdx}
                      style={styles.tableRow}
                    >
                      <Text style={[styles.tdTextMono, styles.colDate]} numberOfLines={1}>{item.dateRegistered}</Text>
                      <Text style={[styles.tdTextMono, styles.colShipment]} numberOfLines={1}>{item.shipmentId}</Text>
                      <Text style={[styles.tdTextCenter, styles.colQty]}>{item.quantity}</Text>
                      <Text style={[styles.tdTextRight, styles.colCharges]}>{formatCurrency(itemChargesTotal)}</Text>
                      <Text style={[styles.tdTextRight, styles.colDue]}>{formatCurrency(item.due)}</Text>
                      <Text style={[styles.tdTextRight, styles.colPaid]}>{formatCurrency(item.paid)}</Text>
                      <Text style={[styles.tdTextRight, styles.colBalance]}>{formatCurrency(item.balance)}</Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Non-Final Page: Payment Instructions */}
            {!isLastPage && (
              <>
                <View style={styles.nonLastPageSpacer} />
                <PaymentInstructionsBox
                  bankName={bankName}
                  accountName={accountName}
                  accountNumber={accountNumber}
                />
              </>
            )}

            {/* Final Page Summary, Totals, Payment Instructions & Signatures */}
            {isLastPage && (
              <>
                <View style={styles.summaryRow}>
                  {/* Left: Deductions / Adjustments Note Box */}
                  <View style={styles.deductionsBox}>
                    <Text style={styles.deductionsBoxTitle}>DEDUCTIONS / ADJUSTMENTS</Text>
                    {deductionVal > 0 ? (
                      <View>
                        <Text style={styles.deductionAmountText}>-{formatCurrency(deductionVal)}</Text>
                        <Text style={styles.deductionReasonText}>{deductionReason || 'Adjustment credit applied'}</Text>
                      </View>
                    ) : (
                      <Text style={styles.deductionsEmptyText}>No deductions applied.</Text>
                    )}
                  </View>

                  {/* Right: Rollup Totals */}
                  <View style={styles.totalsBox}>
                    <View style={styles.totalLine}>
                      <Text style={styles.totalLabel}>Total Charges</Text>
                      <Text style={styles.totalVal}>{formatCurrency(totalCharges)}</Text>
                    </View>
                    <View style={styles.totalLine}>
                      <Text style={styles.totalLabel}>Total Paid</Text>
                      <Text style={styles.totalVal}>−{formatCurrency(totalPaid)}</Text>
                    </View>
                    <View style={styles.totalLine}>
                      <Text style={styles.totalLabel}>Deduction</Text>
                      <Text style={styles.totalVal}>−{formatCurrency(deductionVal)}</Text>
                    </View>
                    <View style={styles.totalDivider} />
                    <View style={styles.amountDueRow}>
                      <Text style={styles.amountDueLabel}>Amount Due</Text>
                      <Text style={styles.amountDueValue}>{formatCurrency(finalAmountDue)}</Text>
                    </View>
                    <Text style={finalAmountDue <= 0 ? styles.settledStatus : styles.collectionStatus}>
                      {finalAmountDue <= 0 ? 'SETTLED' : 'FOR COLLECTION'}
                    </Text>
                  </View>
                </View>

                <PaymentInstructionsBox
                  bankName={bankName}
                  accountName={accountName}
                  accountNumber={accountNumber}
                />

                {/* Printable Signature Blocks */}
                <View style={styles.printFooter}>
                  <View style={styles.signatureRow}>
                    {/* Signature 1: Prepared by */}
                    <View style={styles.sigCol}>
                      <View style={styles.sigNameWrap}>
                        <Text style={styles.sigNameText}>{currentUser?.name || 'Maria Santos'}</Text>
                      </View>
                      <View style={styles.sigLine} />
                      <Text style={styles.sigText}>Prepared by</Text>
                    </View>

                    {/* Signature 2: Collected by */}
                    <View style={styles.sigCol}>
                      <View style={styles.sigNameWrap}>
                        {collector ? <Text style={styles.sigNameText}>{collector}</Text> : null}
                      </View>
                      <View style={styles.sigLine} />
                      <Text style={styles.sigText}>Collected by</Text>
                    </View>

                    {/* Signature 3: Date collected */}
                    <View style={styles.sigCol}>
                      <View style={styles.sigNameWrap} />
                      <View style={styles.sigLine} />
                      <Text style={styles.sigText}>Date collected</Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* Bottom Footnote on EVERY Sheet (Left: Statement info, Right: Page X of Y) */}
            <View style={[styles.pageFootnoteRow, isLastPage && styles.pageFootnoteLast]}>
              <Text style={styles.pageFootnoteText}>Statement 1 | Page for {clientName}</Text>
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
    alignItems: 'center',
  },
  paper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 14,
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginTop: spacing.md,
  },
  stackedPaper: {
    marginBottom: 24,
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
    alignItems: 'flex-end',
    paddingTop: 4,
    marginBottom: 4,
  },
  titleCol: {
    justifyContent: 'flex-end',
  },
  logoFallback: {
    width: 150,
    height: 48,
    borderWidth: 2,
    borderColor: '#111110',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackCompact: {
    width: 88,
    height: 28,
  },
  logoFallbackText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '900',
    color: '#111110',
  },
  logoFallbackTextCompact: {
    fontSize: 9,
  },
  metaCol: {
    alignItems: 'flex-end',
    minWidth: 240,
  },
  documentTitle: {
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: '900',
    color: '#111110',
    letterSpacing: 0.5,
    marginBottom: 4,
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
  solidDivider: {
    borderTopWidth: 1.5,
    borderTopColor: '#111110',
    height: 0,
    marginVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: spacing.md,
  },
  billToCol: {
    flex: 1,
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  clientName: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#111110',
  },
  clientAddress: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    marginTop: 1,
  },
  clientContact: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 1,
  },
  weekCol: {
    alignItems: 'flex-end',
  },
  sectionEyebrowRight: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textAlign: 'right',
    marginBottom: 2,
  },
  weekRange: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: '#111110',
    textAlign: 'right',
  },
  outstandingCount: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'right',
    marginTop: 1,
  },

  tableContainer: {
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    marginTop: 4,
  },
  tableHeaderDivider: {
    borderTopWidth: 1.5,
    borderTopColor: '#111110',
    height: 0,
    width: '100%',
    marginBottom: 2,
  },
  thText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7.5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  nonLastPageSpacer: {
    height: 36,
  },
  tdText: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    color: '#111110',
  },
  tdTextMono: {
    fontFamily: fonts.mono,
    fontSize: 14.5,
    color: '#111110',
  },
  tdTextCenter: {
    fontFamily: fonts.mono,
    fontSize: 14.5,
    color: '#111110',
    textAlign: 'center',
    fontWeight: '600',
  },
  tdTextRight: {
    fontFamily: fonts.mono,
    fontSize: 14.5,
    color: '#111110',
    textAlign: 'right',
    fontWeight: '700',
  },
  emptyRow: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  colDate: { width: 110, flexShrink: 0 },
  colShipment: { width: 140, flexShrink: 0 },
  colQty: { width: 50, textAlign: 'center', flexShrink: 0 },
  colCharges: { flex: 1, textAlign: 'right' },
  colDue: { flex: 1, textAlign: 'right' },
  colPaid: { flex: 1, textAlign: 'right' },
  colBalance: { flex: 1, textAlign: 'right' },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 6,
  },
  deductionsBox: {
    backgroundColor: '#F8F7F4',
    borderWidth: 1,
    borderColor: '#EBE9E2',
    borderRadius: 3,
    padding: 10,
    minWidth: 250,
    maxWidth: 350,
    flex: 1,
  },
  deductionsBoxTitle: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.inkMuted,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  deductionsEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  deductionAmountText: {
    fontFamily: fonts.mono,
    fontSize: 16.5,
    fontWeight: '800',
    color: '#111110',
  },
  deductionReasonText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkMuted,
    marginTop: 1,
  },
  totalsBox: {
    minWidth: 250,
    alignItems: 'flex-end',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 250,
    marginBottom: 3,
  },
  totalLabel: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: '#111110',
    fontWeight: '700',
  },
  totalVal: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: '#111110',
    fontWeight: '800',
  },
  totalDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 0,
    width: 250,
    marginVertical: 5,
  },
  amountDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    width: 250,
    marginTop: 2,
  },
  amountDueLabel: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '900',
    color: '#111110',
  },
  amountDueValue: {
    fontFamily: fonts.mono,
    fontSize: 24,
    fontWeight: '900',
    color: '#111110',
  },
  settledStatus: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.success,
    marginTop: 3,
    letterSpacing: 0.8,
  },
  collectionStatus: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.warning,
    marginTop: 3,
    letterSpacing: 0.8,
  },

  paymentInstructionsBox: {
    borderWidth: 1.5,
    borderColor: '#111110',
    padding: 8,
    marginTop: 5,
    marginBottom: 6,
  },
  paymentInstructionsTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#111110',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  paymentInstructionsText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    color: '#111110',
    marginBottom: 4,
  },
  bankDetailsGrid: {
    gap: 2,
  },
  bankDetailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bankDetailLabel: {
    width: 110,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#111110',
  },
  bankDetailValue: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#111110',
  },
  bankAccountNumber: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: '#111110',
    letterSpacing: 0.5,
  },
  printFooter: {
    paddingTop: 6,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 28,
  },
  sigCol: {
    flex: 1,
    alignItems: 'center',
  },
  sigNameWrap: {
    minHeight: 18,
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  sigNameText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#111110',
    textAlign: 'center',
  },
  sigLine: {
    borderTopWidth: 1,
    borderTopColor: '#111110',
    width: '100%',
    marginBottom: 3,
  },
  sigText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkMuted,
    textAlign: 'center',
  },

  pageFootnoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 4,
    marginTop: 6,
  },
  pageFootnoteLast: {
    marginTop: 6,
  },
  pageFootnoteText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
  },
  pageNumberText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    fontWeight: '700',
  },
});

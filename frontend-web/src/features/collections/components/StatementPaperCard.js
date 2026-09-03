import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radius } from '../../../theme';
import { formatCurrency } from '../utils/collectionsUtils';

/**
 * Chunks shipments into physical A4 pages based on vertical capacity budgets.
 * - Single-page statement (<= 10 items): 1 page total (with summary & signatures).
 * - Multi-page statement:
 *     Page 1: up to 14 items
 *     Middle pages: up to 16 items
 *     Final page: up to 10 items (preserving space for summary & signatures).
 */
export function paginateStatementItems(items = []) {
  if (!items || items.length === 0) {
    return [[]];
  }
  // Single-page statement fits up to 10 items with summary and signatures
  if (items.length <= 10) {
    return [items];
  }

  const pages = [];
  let remaining = [...items];

  // Page 1 capacity: budget up to 18 items to comfortably fill Page 1
  const page1Count = Math.min(18, Math.max(14, remaining.length - 6));
  pages.push(remaining.slice(0, page1Count));
  remaining = remaining.slice(page1Count);

  while (remaining.length > 0) {
    // If remaining items fit on the final page with summary & signatures (<= 10)
    if (remaining.length <= 10) {
      pages.push(remaining);
      break;
    }
    // If remaining items are between 11 and 20:
    // Balance evenly between middle page and final page
    if (remaining.length <= 20) {
      const splitPoint = Math.ceil(remaining.length / 2);
      pages.push(remaining.slice(0, splitPoint));
      pages.push(remaining.slice(splitPoint));
      break;
    }
    // Full middle continuation page: up to 18 items
    pages.push(remaining.slice(0, 18));
    remaining = remaining.slice(18);
  }

  return pages;
}

/**
 * StatementPaperCard renders stacked multi-page A4 Statement of Account documents
 * matching prototype soa page.png and prototype soa long printable .png.
 */
export default function StatementPaperCard({
  data,
  currentUser = { name: 'Maria Santos', role: 'Administrator' },
  liveDeduction = 0,
  liveDeductionNote = '',
  liveCollectedBy = '',
}) {
  if (!data) return null;

  const {
    clientName = '—',
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
  const deductionReason = liveDeductionNote || data.deductionNote || '';
  const collector = liveCollectedBy || data.collectedBy || '';

  const finalAmountDue = Math.max(0, Number(totalCharges || 0) - Number(totalPaid || 0) - deductionVal);

  const formattedStatementDate = statementDate
    ? new Date(statementDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const formattedCollectionDate = collectionDate
    ? `Thu, ${new Date(collectionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : '—';

  // Paginate statement items into distinct physical A4 sheets
  const paginatedPages = useMemo(() => paginateStatementItems(items), [items]);
  const totalPages = paginatedPages.length;

  return (
    <View style={styles.container}>
      {paginatedPages.map((pageItems, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === totalPages - 1;
        const pageNumber = pageIdx + 1;

        return (
          <View
            key={`soa-sheet-${pageIdx}`}
            style={[
              styles.paper,
              totalPages > 1 && styles.stackedPaper,
            ]}
            className="soa-paper-sheet"
            nativeID={`soa-printable-sheet-${pageIdx}`}
          >
            {/* Page Header */}
            {isFirstPage ? (
              <>
                {/* Full Brand & Statement Header (Page 1) */}
                <View style={styles.headerRow}>
                  <View style={styles.brandCol}>
                    <View style={styles.brandRow}>
                      <View style={styles.logoMark}>
                        <Text style={styles.logoMarkText}>T</Text>
                      </View>
                      <View>
                        <Text style={styles.companyName}>TNL LOGISTICS</Text>
                        <Text style={styles.companySubtext}>Manila Central Hub · 0917-555-0000 · billing@tnllogistics.ph</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.metaCol}>
                    <Text style={styles.documentTitle}>STATEMENT OF ACCOUNT</Text>
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

                {/* Solid Black Divider Line */}
                <View style={styles.solidDivider} />

                {/* Bill To & Collection Week Information Row */}
                <View style={styles.infoRow}>
                  <View style={styles.billToCol}>
                    <Text style={styles.sectionEyebrow}>BILL TO</Text>
                    <Text style={styles.clientName}>{clientName}</Text>
                    {clientAddress ? <Text style={styles.clientAddress}>{clientAddress}</Text> : null}
                    {(clientContact || clientEmail) ? (
                      <Text style={styles.clientContact}>
                        {[clientContact, clientEmail].filter(Boolean).join(' · ')}
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
              </>
            ) : (
              <>
                {/* Streamlined Continuation Header (Page 2+) */}
                <View style={styles.continuationHeaderRow}>
                  <View style={styles.continuationBrand}>
                    <View style={styles.continuationLogoMark}>
                      <Text style={styles.continuationLogoText}>T</Text>
                    </View>
                    <Text style={styles.continuationTitle}>
                      TNL LOGISTICS · <Text style={styles.continuationSubTitle}>STATEMENT OF ACCOUNT (Continuation)</Text>
                    </Text>
                  </View>
                  <View style={styles.continuationMeta}>
                    <Text style={styles.continuationMetaText}>
                      <Text style={styles.continuationMetaMono}>{soaNo}</Text> · {clientName}
                    </Text>
                  </View>
                </View>
                <View style={styles.continuationDivider} />
              </>
            )}

            {/* Itemized Shipments Table */}
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thText, styles.colDate]}>DATE</Text>
                <Text style={[styles.thText, styles.colShipment]}>SHIPMENT</Text>
                <Text style={[styles.thText, styles.colDesc]}>DESCRIPTION</Text>
                <Text style={[styles.thText, styles.colQty]}>QTY</Text>
                <Text style={[styles.thText, styles.colCharges]}>CHARGES</Text>
                <Text style={[styles.thText, styles.colOther]}>OTHER</Text>
                <Text style={[styles.thText, styles.colDue]}>DUE</Text>
                <Text style={[styles.thText, styles.colPaid]}>PAID</Text>
                <Text style={[styles.thText, styles.colBalance]}>BALANCE</Text>
              </View>

              {/* Table Body */}
              {pageItems.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No shipments found for this client in the selected cycle.</Text>
                </View>
              ) : (
                pageItems.map((item, rowIdx) => (
                  <View key={item.shipmentId || rowIdx} style={styles.tableRow}>
                    <Text style={[styles.tdTextMono, styles.colDate]} numberOfLines={1}>{item.dateRegistered}</Text>
                    <Text style={[styles.tdTextMono, styles.colShipment]} numberOfLines={1}>{item.shipmentId}</Text>
                    <Text style={[styles.tdText, styles.colDesc]} numberOfLines={1}>{item.description}</Text>
                    <Text style={[styles.tdTextCenter, styles.colQty]}>{item.quantity}</Text>
                    <Text style={[styles.tdTextRight, styles.colCharges]}>{formatCurrency(item.charges)}</Text>
                    <Text style={[styles.tdTextRight, styles.colOther]}>{formatCurrency(item.otherCharges)}</Text>
                    <Text style={[styles.tdTextRight, styles.colDue]}>{formatCurrency(item.due)}</Text>
                    <Text style={[styles.tdTextRight, styles.colPaid]}>{formatCurrency(item.paid)}</Text>
                    <Text style={[styles.tdTextRight, styles.colBalance]}>{formatCurrency(item.balance)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Final Page Summary, Totals & Signatures */}
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
                  </View>
                </View>

                {/* Printable Remittance Instructions & Signature Blocks */}
                <View style={styles.printFooter}>
                  <Text style={styles.remittanceNote}>
                    Please settle on or before the collection date. Make cheques payable to TNL Logistics. For GCash/bank transfer, use SOA No. as reference.
                  </Text>

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
              <Text style={styles.pageFootnoteText}>Statement 1 · Page for {clientName}</Text>
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
    padding: 36,
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
    marginBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  brandCol: {
    flex: 1,
    minWidth: 260,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 36,
    height: 36,
    backgroundColor: '#111110',
    borderWidth: 1,
    borderColor: '#111110',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    fontFamily: fonts.sans,
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  companyName: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#111110',
    letterSpacing: 0.5,
  },
  companySubtext: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  metaCol: {
    alignItems: 'flex-end',
    minWidth: 240,
  },
  documentTitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: '#111110',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
  },
  metaValue: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: '#111110',
    fontWeight: '600',
  },
  metaValueMono: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#111110',
    fontWeight: '700',
  },
  solidDivider: {
    borderTopWidth: 1.5,
    borderTopColor: '#111110',
    height: 0,
    marginVertical: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: spacing.md,
  },
  billToCol: {
    flex: 1,
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  clientName: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: '#111110',
  },
  clientAddress: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink,
    marginTop: 2,
  },
  clientContact: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  weekCol: {
    alignItems: 'flex-end',
  },
  sectionEyebrowRight: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textAlign: 'right',
    marginBottom: 4,
  },
  weekRange: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: '#111110',
    textAlign: 'right',
  },
  outstandingCount: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    textAlign: 'right',
    marginTop: 2,
  },

  /* Continuation Page Styles */
  continuationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  continuationBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continuationLogoMark: {
    width: 24,
    height: 24,
    backgroundColor: '#111110',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continuationLogoText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  continuationTitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#111110',
  },
  continuationSubTitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  continuationMeta: {
    alignItems: 'flex-end',
  },
  continuationMetaText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
  },
  continuationMetaMono: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#111110',
  },
  continuationDivider: {
    borderTopWidth: 1,
    borderTopColor: '#111110',
    height: 0,
    marginTop: 10,
    marginBottom: 16,
  },

  tableContainer: {
    marginBottom: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111110',
  },
  thText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9.5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tdText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: '#111110',
  },
  tdTextMono: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: '#111110',
  },
  tdTextCenter: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: '#111110',
    textAlign: 'center',
  },
  tdTextRight: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: '#111110',
    textAlign: 'right',
  },
  emptyRow: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  colDate: { width: 78, flexShrink: 0 },
  colShipment: { width: 96, flexShrink: 0 },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 36, textAlign: 'center', flexShrink: 0 },
  colCharges: { width: 68, textAlign: 'right', flexShrink: 0 },
  colOther: { width: 52, textAlign: 'right', flexShrink: 0 },
  colDue: { width: 68, textAlign: 'right', flexShrink: 0 },
  colPaid: { width: 62, textAlign: 'right', flexShrink: 0 },
  colBalance: { width: 68, textAlign: 'right', flexShrink: 0 },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
    marginBottom: 24,
  },
  deductionsBox: {
    backgroundColor: '#F8F7F4',
    borderWidth: 1,
    borderColor: '#EBE9E2',
    borderRadius: 3,
    padding: 12,
    minWidth: 260,
    maxWidth: 340,
    flex: 1,
  },
  deductionsBoxTitle: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  deductionsEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  deductionAmountText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#111110',
  },
  deductionReasonText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  totalsBox: {
    minWidth: 220,
    alignItems: 'flex-end',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    marginBottom: 4,
  },
  totalLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkMuted,
  },
  totalVal: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: '#111110',
    fontWeight: '600',
  },
  totalDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 0,
    width: 220,
    marginVertical: 6,
  },
  amountDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    width: 220,
    marginTop: 2,
  },
  amountDueLabel: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '800',
    color: '#111110',
  },
  amountDueValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '800',
    color: '#111110',
  },

  printFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 16,
  },
  remittanceNote: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    lineHeight: 16,
    marginBottom: 24,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 32,
    marginBottom: 16,
  },
  sigCol: {
    flex: 1,
  },
  sigNameWrap: {
    minHeight: 22,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  sigNameText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#111110',
  },
  sigLine: {
    borderTopWidth: 1,
    borderTopColor: '#111110',
    height: 0,
    marginBottom: 6,
  },
  sigText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
  },
  pageFootnoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 8,
  },
  pageFootnoteLast: {
    borderTopWidth: 0,
    paddingTop: 4,
  },
  pageFootnoteText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.inkMuted,
  },
  pageNumberText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkMuted,
  },
});

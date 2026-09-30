import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../theme';
import { createPrintableReportModel } from '../utils/reportPrintModel.mjs';

function formatCurrency(value) {
  return `\u20B1${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatGeneratedAt(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-US');
}

function ClientRevenueTable({ block }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>
        CLIENT REVENUE & CHARGES STATEMENT{block.isContinuation ? ' — CONTINUED' : ''}
      </Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.clientColumn]}>CLIENT</Text>
          <Text style={[styles.th, styles.shipmentColumn]}>SHIPMENTS</Text>
          <Text style={[styles.th, styles.moneyColumn]}>BILLED</Text>
          <Text style={[styles.th, styles.moneyColumn]}>PAID</Text>
          <Text style={[styles.th, styles.moneyColumn]}>BALANCE</Text>
        </View>
        {block.rows.map((client, index) => (
          client.isEmpty ? (
            <View key="empty-client-row" style={styles.emptyTableRow}>
              <Text style={styles.emptyTableText}>No client activity for the selected period.</Text>
            </View>
          ) : (
            <View key={client.clientId || index} style={styles.tableRow}>
              <Text style={[styles.td, styles.clientColumn, styles.clientName]}>{client.clientName || '-'}</Text>
              <Text style={[styles.td, styles.shipmentColumn]}>{client.totalShipments || 0}</Text>
              <Text style={[styles.td, styles.moneyColumn]}>{formatCurrency(client.totalBilled)}</Text>
              <Text style={[styles.td, styles.moneyColumn]}>{formatCurrency(client.totalPaid)}</Text>
              <Text style={[styles.td, styles.moneyColumn, styles.balanceValue]}>{formatCurrency(client.balance)}</Text>
            </View>
          )
        ))}
      </View>
    </View>
  );
}

function WeeklyCollectionsTable({ block }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>
        WEEKLY COLLECTION CYCLE STATUS{block.isContinuation ? ' — CONTINUED' : ''}
      </Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.collectionClientColumn]}>CLIENT</Text>
          <Text style={[styles.th, styles.collectionShipmentColumn]}>SHIPMENTS</Text>
          <Text style={[styles.th, styles.collectionMoneyColumn]}>CYCLE CHARGES</Text>
          <Text style={[styles.th, styles.collectionMoneyColumn]}>CYCLE BALANCE</Text>
        </View>
        {block.rows.map((item, index) => (
          <View key={item.clientId || index} style={styles.tableRow}>
            <Text style={[styles.td, styles.collectionClientColumn, styles.clientName]}>{item.clientName || '-'}</Text>
            <Text style={[styles.td, styles.collectionShipmentColumn]}>{item.shipmentsCount || 0}</Text>
            <Text style={[styles.td, styles.collectionMoneyColumn]}>{formatCurrency(item.currentCharges)}</Text>
            <Text style={[styles.td, styles.collectionMoneyColumn, styles.balanceValue]}>
              {formatCurrency(item.balance ?? item.currentCharges)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ExecutiveSummary({ kpis }) {
  return (
    <View style={styles.executiveSummary}>
      <Text style={styles.sectionTitle}>EXECUTIVE SUMMARY</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>TOTAL BILLED</Text>
          <Text style={styles.kpiValue}>{formatCurrency(kpis.totalBilledRevenue)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>TOTAL COLLECTED</Text>
          <Text style={[styles.kpiValue, styles.collectedValue]}>{formatCurrency(kpis.totalCollectedRevenue)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>OUTSTANDING AR</Text>
          <Text style={[styles.kpiValue, styles.outstandingValue]}>{formatCurrency(kpis.outstandingReceivables)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>VOLUME (SHIPMENTS / PCS)</Text>
          <Text style={styles.kpiValue}>
            {Number(kpis.totalShipments || 0).toLocaleString('en-PH')} / {Number(kpis.totalParcels || 0).toLocaleString('en-PH')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Signatures() {
  return (
    <View nativeID="report-footer-signatures" style={styles.footerSignatureBlock}>
      <View style={styles.signatureBox}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureRole}>Prepared By (Operations / Billing)</Text>
      </View>
      <View style={styles.signatureBox}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureRole}>Approved By (Administration)</Text>
      </View>
    </View>
  );
}

export default function PrintableReportDocument({ reportData, startDate, endDate }) {
  const model = useMemo(
    () => createPrintableReportModel(reportData, startDate, endDate),
    [reportData, startDate, endDate],
  );

  return (
    <View nativeID="printable-report-document" style={styles.document}>
      {model.pages.map((page, pageIndex) => (
        <View
          nativeID={`report-print-page-${pageIndex + 1}`}
          key={`report-page-${pageIndex + 1}`}
          style={styles.printPage}
        >
          <View style={styles.letterhead}>
            <View>
              <Text style={styles.companyName}>TNL LOGISTICS EXPRESS</Text>
              <Text style={styles.reportDocTitle}>OPERATIONAL & FINANCIAL CONSOLIDATION REPORT</Text>
            </View>
            <View style={styles.docMeta}>
              <Text style={styles.metaLabel}>PERIOD: {model.startDate} TO {model.endDate}</Text>
              <Text style={styles.metaSub}>GENERATED: {formatGeneratedAt(model.generatedAt)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.pageContent}>
            {page.showExecutiveSummary ? <ExecutiveSummary kpis={model.kpis} /> : null}

            {page.tableBlocks.map((block, blockIndex) => (
              block.section === 'CLIENT_REVENUE' ? (
                <ClientRevenueTable key={`client-${blockIndex}`} block={block} />
              ) : (
                <WeeklyCollectionsTable key={`collection-${blockIndex}`} block={block} />
              )
            ))}

            {page.showSignatures ? <Signatures /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  document: {
    alignItems: 'center',
    width: '100%',
  },
  printPage: {
    width: 794,
    height: 1123,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 53,
    paddingVertical: 45,
    borderRadius: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    marginBottom: 24,
  },
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyName: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.5,
  },
  reportDocTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    marginTop: 4,
  },
  docMeta: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#111111',
  },
  metaSub: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkFaint,
    marginTop: 3,
  },
  divider: {
    height: 1.5,
    backgroundColor: '#111111',
    marginTop: 16,
    marginBottom: 14,
  },
  pageContent: {
    flex: 1,
  },
  executiveSummary: {
    marginBottom: 6,
  },
  sectionBlock: {
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 9,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  kpiBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 4,
    backgroundColor: '#F9FAFB',
  },
  kpiLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: colors.inkFaint,
  },
  kpiValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
    marginTop: 5,
  },
  collectedValue: {
    color: '#2E7D46',
  },
  outstandingValue: {
    color: colors.accent,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    minHeight: 28,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  th: {
    fontFamily: fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  td: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: '#111827',
    textAlign: 'right',
  },
  clientName: {
    fontFamily: fonts.sans,
    fontWeight: '700',
    textAlign: 'left',
  },
  balanceValue: {
    fontWeight: '800',
  },
  clientColumn: {
    flex: 3,
    textAlign: 'left',
  },
  shipmentColumn: {
    flex: 1.5,
    textAlign: 'right',
  },
  moneyColumn: {
    flex: 2,
    textAlign: 'right',
  },
  collectionClientColumn: {
    flex: 3,
    textAlign: 'left',
  },
  collectionShipmentColumn: {
    flex: 1.5,
    textAlign: 'center',
  },
  collectionMoneyColumn: {
    flex: 2,
    textAlign: 'right',
  },
  emptyTableRow: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  emptyTableText: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  footerSignatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 28,
  },
  signatureBox: {
    width: 240,
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#111111',
    marginBottom: 8,
  },
  signatureRole: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
});

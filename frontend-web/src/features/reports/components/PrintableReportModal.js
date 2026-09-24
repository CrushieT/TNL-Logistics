import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { colors, fonts } from '../../../theme';

export default function PrintableReportModal({ visible, onClose, reportData, startDate, endDate }) {
  if (!visible || !reportData) return null;

  const handleBrowserPrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const kpis = reportData.kpis || {};
  const clientRevenue = reportData.clientRevenue || [];
  const collectionItems = reportData.collectionSummary?.items || [];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View nativeID="report-print-backdrop" style={styles.backdrop}>
        {Platform.OS === 'web' && (
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @page {
                  size: A4 portrait;
                  margin: 12mm 14mm 12mm 14mm !important;
                }
                @media print {
                  * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  #report-print-toolbar,
                  div[id="report-print-toolbar"],
                  button,
                  div[style*="position: fixed"] {
                    display: none !important;
                    visibility: hidden !important;
                  }
                  html, body, #root, #__next,
                  #report-print-scroll,
                  div[id="report-print-scroll"],
                  div[style*="overflow"],
                  div[class*="r-overflow"] {
                    overflow: visible !important;
                    height: auto !important;
                    min-height: 0 !important;
                    max-height: none !important;
                    background-color: #FFFFFF !important;
                    background: #FFFFFF !important;
                  }
                  #report-print-backdrop,
                  div[id="report-print-backdrop"] {
                    position: static !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    display: block !important;
                    width: 100% !important;
                    height: auto !important;
                  }
                  #printable-report-sheet,
                  div[id="printable-report-sheet"] {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-height: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    background: #FFFFFF !important;
                  }
                  div[class*="tableRow"],
                  div[class*="kpiGrid"],
                  #report-footer-signatures,
                  div[id="report-footer-signatures"] {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                  }
                  div[class*="tableHeader"] {
                    break-after: avoid !important;
                    page-break-after: avoid !important;
                  }
                }
              `,
            }}
          />
        )}

        {/* Floating Action Controls (Hidden during print) */}
        <View nativeID="report-print-toolbar" style={styles.actionToolbar}>
          <TouchableOpacity style={styles.printActionBtn} onPress={handleBrowserPrint} activeOpacity={0.8}>
            <Text style={styles.printActionText}>Print Document (A4)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Printable Document Sheet */}
        <ScrollView nativeID="report-print-scroll" contentContainerStyle={styles.scrollWrapper}>
          <View nativeID="printable-report-sheet" style={styles.printSheet}>
            {/* Letterhead */}
            <View style={styles.letterhead}>
              <View>
                <Text style={styles.companyName}>TNL LOGISTICS EXPRESS</Text>
                <Text style={styles.reportDocTitle}>OPERATIONAL & FINANCIAL CONSOLIDATION REPORT</Text>
              </View>
              <View style={styles.docMeta}>
                <Text style={styles.metaLabel}>PERIOD: {startDate} TO {endDate}</Text>
                <Text style={styles.metaSub}>
                  GENERATED: {reportData.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : new Date().toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* KPI Summary Grid */}
            <Text style={styles.sectionTitle}>EXECUTIVE SUMMARY</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>TOTAL BILLED</Text>
                <Text style={styles.kpiValue}>{formatCurrency(kpis.totalBilledRevenue)}</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>TOTAL COLLECTED</Text>
                <Text style={[styles.kpiValue, { color: '#2E7D46' }]}>
                  {formatCurrency(kpis.totalCollectedRevenue)}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>OUTSTANDING AR</Text>
                <Text style={[styles.kpiValue, { color: colors.accent }]}>
                  {formatCurrency(kpis.outstandingReceivables)}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>VOLUME (SHIPMENTS / PCS)</Text>
                <Text style={styles.kpiValue}>
                  {kpis.totalShipments || 0} / {(kpis.totalParcels || 0).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Client Breakdown Section */}
            <Text style={styles.sectionTitle}>CLIENT REVENUE & CHARGES STATEMENT</Text>
            <View nativeID="report-client-table" style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 3 }]}>CLIENT</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>SHIPMENTS</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>BILLED</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>PAID</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>BALANCE</Text>
              </View>
              {clientRevenue.map((c, i) => (
                <View key={c.clientId || i} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 3, fontWeight: '700' }]}>{c.clientName}</Text>
                  <Text style={[styles.td, { flex: 1.5, textAlign: 'right', fontFamily: fonts.mono }]}>
                    {c.totalShipments || 0}
                  </Text>
                  <Text style={[styles.td, { flex: 2, textAlign: 'right', fontFamily: fonts.mono }]}>
                    {formatCurrency(c.totalBilled)}
                  </Text>
                  <Text style={[styles.td, { flex: 2, textAlign: 'right', fontFamily: fonts.mono }]}>
                    {formatCurrency(c.totalPaid)}
                  </Text>
                  <Text style={[styles.td, { flex: 2, textAlign: 'right', fontFamily: fonts.mono, fontWeight: '700' }]}>
                    {formatCurrency(c.balance)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Active Thursday Collection Snapshot */}
            {collectionItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>WEEKLY COLLECTION CYCLE STATUS</Text>
                <View nativeID="report-collection-table" style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 3 }]}>CLIENT</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>SHIPMENTS</Text>
                    <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>CYCLE CHARGES</Text>
                    <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>CYCLE BALANCE</Text>
                  </View>
                  {collectionItems.map((item, idx) => (
                    <View key={item.clientId || idx} style={styles.tableRow}>
                      <Text style={[styles.td, { flex: 3, fontWeight: '600' }]}>{item.clientName}</Text>
                      <Text style={[styles.td, { flex: 1.5, textAlign: 'center', fontFamily: fonts.mono }]}>
                        {item.shipmentsCount || 0}
                      </Text>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right', fontFamily: fonts.mono }]}>
                        {formatCurrency(item.currentCharges)}
                      </Text>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right', fontFamily: fonts.mono, fontWeight: '700' }]}>
                        {formatCurrency(item.balance || item.currentCharges)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Official Footer Signature Block */}
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
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  actionToolbar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  printActionBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  printActionText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  closeText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  scrollWrapper: {
    paddingBottom: 40,
  },
  printSheet: {
    width: 800,
    minHeight: 1050,
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkFaint,
    marginTop: 4,
  },
  docMeta: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#111111',
  },
  metaSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkFaint,
    marginTop: 2,
  },
  divider: {
    height: 1.5,
    backgroundColor: '#111111',
    marginVertical: 16,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  kpiBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    borderRadius: 4,
    backgroundColor: '#F9FAFB',
  },
  kpiLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.inkFaint,
  },
  kpiValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
    marginTop: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  th: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  td: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: '#111827',
  },
  footerSignatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 48,
    paddingTop: 24,
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
    fontSize: 11,
    color: colors.inkSoft,
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../../theme';
import { exportReceivablesAgingToCsv } from '../utils/exportReportsCsv';
import TablePaginationFooter from './TablePaginationFooter';

export default function ReceivablesAgingTab({ receivablesAging = [], dateRangeStr = '' }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const filteredAging = (receivablesAging || []).filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (item.clientName && item.clientName.toLowerCase().includes(term)) ||
      (item.clientId && item.clientId.toLowerCase().includes(term))
    );
  });

  // Reset to first page when search changes
  useEffect(() => {
    setPage(0);
  }, [search]);

  const pagedAging = filteredAging.slice(page * pageSize, (page + 1) * pageSize);

  const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Grand totals across all filtered debtors (preserves financial reconciliation)
  const totalCurrent = filteredAging.reduce((sum, r) => sum + Number(r.currentDue || 0), 0);
  const totalPastDue = filteredAging.reduce((sum, r) => sum + Number(r.pastDue || 0), 0);
  const totalOverdue = filteredAging.reduce((sum, r) => sum + Number(r.overdue || 0), 0);
  const grandTotal = filteredAging.reduce((sum, r) => sum + Number(r.totalOutstanding || 0), 0);

  // Top debtor highlight
  const topDebtor = filteredAging.length > 0 ? filteredAging[0] : null;

  return (
    <View style={styles.container}>
      {/* Search and CSV Export Bar */}
      <View style={styles.tableControls}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by client name..."
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => exportReceivablesAgingToCsv(filteredAging, dateRangeStr)}
          activeOpacity={0.8}
        >
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Top Debtor Callout Banner */}
      {topDebtor && (
        <View style={styles.topDebtorBanner}>
          <View>
            <Text style={styles.topDebtorLabel}>LARGEST OUTSTANDING EXPOSURE</Text>
            <Text style={styles.topDebtorName}>{topDebtor.clientName}</Text>
          </View>
          <View style={styles.topDebtorAmountBlock}>
            <Text style={styles.topDebtorAmount}>{formatCurrency(topDebtor.totalOutstanding)}</Text>
            <Text style={styles.topDebtorSub}>
              {topDebtor.unpaidShipmentsCount || 0} unpaid shipments
            </Text>
          </View>
        </View>
      )}

      {/* AR Aging Table Card */}
      <View style={styles.tableCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={styles.scrollWrapper}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.headerCell, styles.clientCol]}>CLIENT</Text>
              <Text style={[styles.headerCell, styles.numCol]}>CURRENT (0–7D)</Text>
              <Text style={[styles.headerCell, styles.numCol]}>PAST DUE (8–14D)</Text>
              <Text style={[styles.headerCell, styles.numCol]}>OVERDUE (15D+)</Text>
              <Text style={[styles.headerCell, styles.totalCol]}>TOTAL BALANCE</Text>
              <Text style={[styles.headerCell, styles.actionCol]}>ACTION</Text>
            </View>

            {/* Rows */}
            {pagedAging.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No accounts receivable aging records found</Text>
              </View>
            ) : (
              pagedAging.map((row, idx) => (
                <View key={row.clientId || idx} style={styles.tableRow}>
                  <View style={styles.clientCol}>
                    <Text style={styles.clientName}>{row.clientName}</Text>
                    <Text style={styles.clientContact}>{row.recipientContact || row.clientId}</Text>
                  </View>
                  <Text style={[styles.cellText, styles.numCol]}>{formatCurrency(row.currentDue)}</Text>
                  <Text style={[styles.cellText, styles.numCol, { color: '#B78103' }]}>
                    {formatCurrency(row.pastDue)}
                  </Text>
                  <Text style={[styles.cellText, styles.numCol, { color: colors.danger, fontWeight: '700' }]}>
                    {formatCurrency(row.overdue)}
                  </Text>
                  <Text style={[styles.cellText, styles.totalCol, styles.bold]}>
                    {formatCurrency(row.totalOutstanding)}
                  </Text>
                  <View style={styles.actionCol}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => router.push('/payments')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionButtonText}>Collect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Total Footer Row (Reconciles entire portfolio) */}
            {filteredAging.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalText, styles.clientCol]}>
                  Total Portfolio ({filteredAging.length} clients)
                </Text>
                <Text style={[styles.totalNum, styles.numCol]}>{formatCurrency(totalCurrent)}</Text>
                <Text style={[styles.totalNum, styles.numCol, { color: '#B78103' }]}>
                  {formatCurrency(totalPastDue)}
                </Text>
                <Text style={[styles.totalNum, styles.numCol, { color: colors.danger }]}>
                  {formatCurrency(totalOverdue)}
                </Text>
                <Text style={[styles.totalNum, styles.totalCol]}>{formatCurrency(grandTotal)}</Text>
                <View style={styles.actionCol} />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Client-side Pagination Footer */}
        {filteredAging.length > 0 && (
          <TablePaginationFooter
            totalItems={filteredAging.length}
            currentCount={pagedAging.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(0);
            }}
            pageSizeOptions={[10, 20, 50]}
            itemLabel="clients"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  tableControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    outlineStyle: 'none',
  },
  exportButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportButtonText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  topDebtorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF8F6',
    borderWidth: 1,
    borderColor: '#FFD7CC',
    borderRadius: 8,
    padding: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  topDebtorLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  topDebtorName: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  topDebtorAmountBlock: {
    alignItems: 'flex-end',
  },
  topDebtorAmount: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  topDebtorSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  scrollWrapper: {
    width: '100%',
  },
  scrollContent: {
    minWidth: '100%',
  },
  table: {
    width: '100%',
    minWidth: 840,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAF8',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    width: '100%',
  },
  headerCell: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
  },
  clientCol: {
    flex: 2.8,
    minWidth: 200,
    paddingRight: 12,
  },
  numCol: {
    flex: 1.4,
    minWidth: 120,
    textAlign: 'right',
    paddingRight: 16,
  },
  totalCol: {
    flex: 1.6,
    minWidth: 130,
    textAlign: 'right',
    paddingRight: 16,
  },
  actionCol: {
    flex: 1.0,
    minWidth: 85,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F3',
    width: '100%',
  },
  clientName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  clientContact: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.inkFaint,
  },
  cellText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.ink,
  },
  bold: {
    fontWeight: '800',
  },
  actionButton: {
    backgroundColor: '#F5F5F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F6',
    borderTopWidth: 1.5,
    borderTopColor: colors.borderStrong,
    width: '100%',
  },
  totalText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.ink,
  },
  totalNum: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.ink,
  },
  emptyRow: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
});

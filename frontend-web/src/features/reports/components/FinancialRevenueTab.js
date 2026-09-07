import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { colors, fonts } from '../../../theme';
import { exportClientRevenueToCsv } from '../utils/exportReportsCsv';
import TablePaginationFooter from './TablePaginationFooter';

export default function FinancialRevenueTab({ clientRevenue = [], paymentMethods = [], deductions = [], dateRangeStr = '' }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const filteredClients = (clientRevenue || []).filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (item.clientName && item.clientName.toLowerCase().includes(term)) ||
      (item.clientId && item.clientId.toLowerCase().includes(term))
    );
  });

  // Reset to first page when search filter updates
  useEffect(() => {
    setPage(0);
  }, [search]);

  // Paginated slice for current page
  const pagedClients = filteredClients.slice(page * pageSize, (page + 1) * pageSize);

  const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Grand totals across all filtered records (preserves accounting reconciliation)
  const totalBilled = filteredClients.reduce((sum, c) => sum + Number(c.totalBilled || 0), 0);
  const totalPaid = filteredClients.reduce((sum, c) => sum + Number(c.totalPaid || 0), 0);
  const totalBalance = filteredClients.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const totalShipments = filteredClients.reduce((sum, c) => sum + (c.totalShipments || 0), 0);

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'PAID':
        return { bg: '#E8F5E9', text: '#2E7D46', border: '#C8E6C9' };
      case 'PARTIAL':
        return { bg: '#FFF8E1', text: '#B78103', border: '#FFE082' };
      default:
        return { bg: '#FFEBEE', text: '#C0392B', border: '#FFCDD2' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Controls: Search and CSV Export */}
      <View style={styles.tableControls}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by client name or ID..."
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => exportClientRevenueToCsv(filteredClients, dateRangeStr)}
          activeOpacity={0.8}
        >
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Client Financial Table Card */}
      <View style={styles.tableCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={styles.scrollWrapper}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.headerCell, styles.clientCol]}>CLIENT</Text>
              <Text style={[styles.headerCell, styles.numCol]}>SHIPMENTS</Text>
              <Text style={[styles.headerCell, styles.numCol]}>BILLED</Text>
              <Text style={[styles.headerCell, styles.numCol]}>PAID</Text>
              <Text style={[styles.headerCell, styles.numCol]}>BALANCE</Text>
              <Text style={[styles.headerCell, styles.statusCol]}>STATUS</Text>
            </View>

            {/* Rows */}
            {pagedClients.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No client revenue records found</Text>
              </View>
            ) : (
              pagedClients.map((client, idx) => {
                const badge = getStatusBadgeStyle(client.paymentStatus);
                return (
                  <View key={client.clientId || idx} style={styles.tableRow}>
                    <View style={styles.clientCol}>
                      <Text style={styles.clientName}>{client.clientName}</Text>
                      <Text style={styles.clientId}>{client.clientId}</Text>
                    </View>
                    <Text style={[styles.cellText, styles.numCol]}>{client.totalShipments || 0}</Text>
                    <Text style={[styles.cellText, styles.numCol]}>{formatCurrency(client.totalBilled)}</Text>
                    <Text style={[styles.cellText, styles.numCol, { color: '#2E7D46' }]}>
                      {formatCurrency(client.totalPaid)}
                    </Text>
                    <Text style={[styles.cellText, styles.numCol, styles.bold]}>
                      {formatCurrency(client.balance)}
                    </Text>
                    <View style={styles.statusCol}>
                      <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                        <Text style={[styles.badgeText, { color: badge.text }]}>{client.paymentStatus || 'UNPAID'}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {/* Total Footer Row (Reconciles entire period totals across all pages) */}
            {filteredClients.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalText, styles.clientCol]}>Total ({filteredClients.length} clients)</Text>
                <Text style={[styles.totalNum, styles.numCol]}>{totalShipments}</Text>
                <Text style={[styles.totalNum, styles.numCol]}>{formatCurrency(totalBilled)}</Text>
                <Text style={[styles.totalNum, styles.numCol, { color: '#2E7D46' }]}>{formatCurrency(totalPaid)}</Text>
                <Text style={[styles.totalNum, styles.numCol]}>{formatCurrency(totalBalance)}</Text>
                <View style={styles.statusCol} />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Client-side Pagination Footer */}
        {filteredClients.length > 0 && (
          <TablePaginationFooter
            totalItems={filteredClients.length}
            currentCount={pagedClients.length}
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

      {/* Side-by-Side Breakdown Cards: Payment Methods & Deductions */}
      <View style={styles.bottomRow}>
        {/* Payment Methods Card */}
        <View style={styles.breakdownCard}>
          <Text style={styles.cardHeader}>PAYMENT METHODS BREAKDOWN</Text>
          <View style={styles.breakdownList}>
            {(paymentMethods || []).map((method, idx) => (
              <View key={method.method || idx} style={styles.breakdownItem}>
                <View style={styles.breakdownLabelRow}>
                  <Text style={styles.breakdownMethodName}>{method.method}</Text>
                  <Text style={styles.breakdownCount}>
                    {method.count || 0} txn ({method.percentage || 0}%)
                  </Text>
                </View>
                <Text style={styles.breakdownAmount}>{formatCurrency(method.totalAmount)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Deductions Audit Card */}
        <View style={styles.breakdownCard}>
          <Text style={styles.cardHeader}>INVOICE DEDUCTIONS & CLAIMS</Text>
          <View style={styles.breakdownList}>
            {(deductions || []).map((ded, idx) => (
              <View key={ded.category || idx} style={styles.breakdownItem}>
                <View style={styles.breakdownLabelRow}>
                  <Text style={styles.breakdownMethodName}>{ded.category.replace('_', ' ')}</Text>
                  <Text style={styles.breakdownCount}>{ded.count || 0} items</Text>
                </View>
                <Text style={[styles.breakdownAmount, { color: colors.danger }]}>
                  {formatCurrency(ded.totalAmount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
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
    minWidth: 780,
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
    flex: 2.5,
    minWidth: 200,
    paddingRight: 12,
  },
  numCol: {
    flex: 1.3,
    minWidth: 110,
    textAlign: 'right',
    paddingRight: 16,
  },
  statusCol: {
    flex: 1.0,
    minWidth: 95,
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
  clientId: {
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
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
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
  bottomRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  breakdownCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 18,
  },
  cardHeader: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.1,
    marginBottom: 14,
  },
  breakdownList: {
    gap: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F3',
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownMethodName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  breakdownCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  breakdownAmount: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
});

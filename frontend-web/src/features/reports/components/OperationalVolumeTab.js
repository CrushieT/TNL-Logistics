import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, fonts } from '../../../theme';
import { exportDailyVolumeToCsv } from '../utils/exportReportsCsv';
import TablePaginationFooter from './TablePaginationFooter';

export default function OperationalVolumeTab({ dailyVolume = [], statusDistribution = [], dateRangeStr = '' }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  const totalDays = (dailyVolume || []).length;
  const pagedDays = (dailyVolume || []).slice(page * pageSize, (page + 1) * pageSize);

  // Grand totals across all days in the period
  const totalShipments = (dailyVolume || []).reduce((sum, d) => sum + Number(d.shipmentsCount || 0), 0);
  const totalParcels = (dailyVolume || []).reduce((sum, d) => sum + Number(d.parcelsCount || 0), 0);
  const totalWeight = (dailyVolume || []).reduce((sum, d) => sum + Number(d.totalWeightKg || 0), 0);
  const totalVolume = (dailyVolume || []).reduce((sum, d) => sum + Number(d.totalVolumeCbm || 0), 0);
  const totalCompleted = (dailyVolume || []).reduce((sum, d) => sum + Number(d.completedDeliveries || 0), 0);

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return '#16A34A';
      case 'LOADED_TO_HAULER': return colors.info;
      case 'ARRIVED_AT_TNL': return '#6366F1';
      case 'LOADED_ON_TRUCK': return colors.accent;
      case 'QR_GENERATED': return '#F59E0B';
      default: return '#9CA3AF';
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Controls */}
      <View style={styles.tableControls}>
        <Text style={styles.sectionHeading}>DAILY OPERATIONS TIMELINE</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => exportDailyVolumeToCsv(dailyVolume, dateRangeStr)}
          activeOpacity={0.8}
        >
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Daily Volume Table Card */}
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
              <Text style={[styles.headerCell, styles.dateCol]}>DATE</Text>
              <Text style={[styles.headerCell, styles.numCol]}>SHIPMENTS</Text>
              <Text style={[styles.headerCell, styles.numCol]}>PARCELS</Text>
              <Text style={[styles.headerCell, styles.numCol]}>WEIGHT (KG)</Text>
              <Text style={[styles.headerCell, styles.numCol]}>VOLUME (CBM)</Text>
              <Text style={[styles.headerCell, styles.numCol]}>COMPLETED</Text>
            </View>

            {/* Rows */}
            {pagedDays.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No operational volume recorded for this period</Text>
              </View>
            ) : (
              pagedDays.map((day, idx) => (
                <View key={day.date || idx} style={styles.tableRow}>
                  <Text style={[styles.dateText, styles.dateCol]}>{day.dateLabel || day.date}</Text>
                  <Text style={[styles.cellText, styles.numCol]}>{day.shipmentsCount || 0}</Text>
                  <Text style={[styles.cellText, styles.numCol]}>{day.parcelsCount || 0}</Text>
                  <Text style={[styles.cellText, styles.numCol]}>
                    {Number(day.totalWeightKg || 0).toFixed(2)}
                  </Text>
                  <Text style={[styles.cellText, styles.numCol]}>
                    {Number(day.totalVolumeCbm || 0).toFixed(4)}
                  </Text>
                  <Text style={[styles.cellText, styles.numCol, { color: '#16A34A', fontWeight: '700' }]}>
                    {day.completedDeliveries || 0}
                  </Text>
                </View>
              ))
            )}

            {/* Total Footer Row (Reconciles entire period volume) */}
            {totalDays > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalText, styles.dateCol]}>Total ({totalDays} days)</Text>
                <Text style={[styles.totalNum, styles.numCol]}>{totalShipments}</Text>
                <Text style={[styles.totalNum, styles.numCol]}>{totalParcels}</Text>
                <Text style={[styles.totalNum, styles.numCol]}>{totalWeight.toFixed(2)}</Text>
                <Text style={[styles.totalNum, styles.numCol]}>{totalVolume.toFixed(4)}</Text>
                <Text style={[styles.totalNum, styles.numCol, { color: '#16A34A' }]}>{totalCompleted}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Client-side Pagination Footer */}
        {totalDays > 0 && (
          <TablePaginationFooter
            totalItems={totalDays}
            currentCount={pagedDays.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(0);
            }}
            pageSizeOptions={[15, 30, 60]}
            itemLabel="days"
          />
        )}
      </View>

      {/* Parcel Status Lifecycle Distribution Card */}
      <View style={styles.statusCard}>
        <Text style={styles.cardHeader}>PARCEL TRACKING LIFECYCLE DISTRIBUTION</Text>
        <View style={styles.statusList}>
          {(statusDistribution || []).map((item, idx) => {
            const barColor = getStatusColor(item.status);
            return (
              <View key={item.status || idx} style={styles.statusItem}>
                <View style={styles.statusTopRow}>
                  <Text style={styles.statusName}>{item.statusDisplay || item.status}</Text>
                  <Text style={styles.statusMeta}>
                    {item.count || 0} pcs ({item.percentage || 0}%)
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, Math.max(0, item.percentage || 0))}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
              </View>
            );
          })}
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
  sectionHeading: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.1,
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
    minWidth: 720,
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
  dateCol: {
    flex: 2.2,
    minWidth: 160,
    paddingRight: 12,
  },
  numCol: {
    flex: 1.2,
    minWidth: 100,
    textAlign: 'right',
    paddingRight: 16,
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
  dateText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  cellText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
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
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
  },
  cardHeader: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.1,
    marginBottom: 16,
  },
  statusList: {
    gap: 14,
  },
  statusItem: {
    gap: 6,
  },
  statusTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusName: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.ink,
  },
  statusMeta: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});

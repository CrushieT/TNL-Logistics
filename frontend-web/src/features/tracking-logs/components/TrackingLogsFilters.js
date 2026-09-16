import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../../theme';

const STATUS_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Registered', value: 'REGISTERED' },
  { label: 'QR Generated', value: 'QR_GENERATED' },
  { label: 'Loaded on Truck', value: 'LOADED_ON_TRUCK' },
  { label: 'Outload / Arrive TNL', value: 'ARRIVED_AT_TNL' },
  { label: 'Loaded to Hauler', value: 'LOADED_TO_HAULER' },
];

export default function TrackingLogsFilters({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  onExportCsv,
  isExporting,
}) {
  return (
    <View style={styles.container}>
      {/* Top Search & Actions Row */}
      <View style={styles.topRow}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, tracking ID, staff..."
            placeholderTextColor={colors.inkFaint}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery ? (
            <Pressable onPress={() => onSearchChange('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {onExportCsv ? (
          <Pressable
            style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
            onPress={onExportCsv}
            disabled={isExporting}
          >
            <Text style={styles.exportBtnText}>
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Persistent Status Filter Pills */}
      <View style={styles.pillsRow}>
        {STATUS_OPTIONS.map((opt) => {
          const isSelected = selectedStatus === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.pill, isSelected && styles.pillActive]}
              onPress={() => onStatusChange(opt.value)}
            >
              <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    outlineStyle: 'none',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    color: colors.inkFaint,
    fontSize: 12,
    fontWeight: '700',
  },
  exportBtn: {
    paddingHorizontal: 14,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.4,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  pillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  pillText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
});

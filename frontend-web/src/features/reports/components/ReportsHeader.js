import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors, fonts } from '../../../theme';

export default function ReportsHeader({
  activePreset,
  onSelectPreset,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onPrintPress,
  isLiveUpdating,
}) {
  const presets = [
    { id: 'TODAY', label: 'Today' },
    { id: 'THIS_WEEK', label: 'This Week' },
    { id: 'THIS_MONTH', label: 'This Month' },
    { id: 'LAST_30_DAYS', label: 'Last 30 Days' },
    { id: 'CUSTOM', label: 'Custom' },
  ];

  return (
    <View style={styles.container}>
      {/* Title & Eyebrow */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>OPERATIONAL & FINANCIAL</Text>
          <View style={styles.headingWithLive}>
            <Text style={styles.title}>REPORTS</Text>
            {isLiveUpdating && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE SYNC</Text>
              </View>
            )}
          </View>
        </View>

        {/* Print Action */}
        <TouchableOpacity style={styles.printButton} onPress={onPrintPress} activeOpacity={0.8}>
          <Text style={styles.printButtonText}>Print Report</Text>
        </TouchableOpacity>
      </View>

      {/* Date Presets and Custom Inputs Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.presetGroup}>
          {presets.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetButton, isActive && styles.presetButtonActive]}
                onPress={() => onSelectPreset(preset.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetButtonText, isActive && styles.presetButtonTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dateInputsContainer}>
          <View style={styles.dateInputWrapper}>
            <Text style={styles.dateLabel}>FROM</Text>
            <TextInput
              style={styles.dateInput}
              value={startDate}
              onChangeText={onStartDateChange}
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />
          </View>
          <Text style={styles.dateSeparator}>—</Text>
          <View style={styles.dateInputWrapper}>
            <Text style={styles.dateLabel}>TO</Text>
            <TextInput
              style={styles.dateInput}
              value={endDate}
              onChangeText={onEndDateChange}
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.inkFaint,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headingWithLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.5,
  },
  printButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  printButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  presetGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F3',
  },
  presetButtonActive: {
    backgroundColor: colors.ink,
  },
  presetButtonText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  presetButtonTextActive: {
    color: '#FFFFFF',
  },
  dateInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FAFAF8',
  },
  dateLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
  },
  dateInput: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
    minWidth: 85,
    padding: 0,
    outlineStyle: 'none',
  },
  dateSeparator: {
    fontFamily: fonts.mono,
    color: colors.inkFaint,
    fontSize: 12,
  },
});

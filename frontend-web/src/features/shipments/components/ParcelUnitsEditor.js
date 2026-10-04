import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import FormField from '../../../components/common/FormField';
import { colors, fonts, spacing, radius, type } from '../../../theme';

const PAGE_SIZE = 10;

function formatMeasure(value, digits, suffix) {
  return value === null ? 'Unavailable' : `${value.toFixed(digits)} ${suffix}`;
}

export default function ParcelUnitsEditor({
  parcels = [],
  errors = {},
  currentPage = 0,
  onPageChange,
  onUpdateParcelField,
  onRemoveUnit,
  pageSize = PAGE_SIZE,
}) {
  const totalUnits = parcels.length;
  const totalPages = Math.max(1, Math.ceil(totalUnits / pageSize));
  const activePage = Math.min(Math.max(0, currentPage), totalPages - 1);

  const startIndex = activePage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalUnits);
  const visibleParcels = parcels.slice(startIndex, endIndex);

  // Detect off-page validation errors
  const offPageErrorUnits = useMemo(() => {
    const errorIndices = new Set();
    Object.keys(errors).forEach((key) => {
      const match = key.match(/^parcel_(\d+)_(weightKg|lengthCm|widthCm|heightCm)$/);
      if (match) {
        const unitIndex = parseInt(match[1], 10);
        if (unitIndex < startIndex || unitIndex >= endIndex) {
          errorIndices.add(unitIndex);
        }
      }
    });

    return Array.from(errorIndices)
      .sort((a, b) => a - b)
      .map((idx) => ({
        index: idx,
        seq: parcels[idx]?.seq || idx + 1,
        pageIndex: Math.floor(idx / pageSize),
      }));
  }, [errors, startIndex, endIndex, parcels, pageSize]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>
          PARCEL UNITS ({totalUnits} {totalUnits === 1 ? 'UNIT' : 'UNITS'}) · PER-UNIT MEASUREMENTS
        </Text>
        {totalPages > 1 && (
          <View style={styles.paginationSummary}>
            <Text style={styles.paginationSummaryText}>
              Showing {startIndex + 1}–{endIndex} of {totalUnits} (Page {activePage + 1} of {totalPages})
            </Text>
          </View>
        )}
      </View>

      {/* Off-page error banner */}
      {offPageErrorUnits.length > 0 && (
        <View style={styles.offPageErrorBanner}>
          <Text style={styles.offPageErrorText}>
            Attention: Validation errors in off-page unit{offPageErrorUnits.length > 1 ? 's' : ''}:{' '}
            {offPageErrorUnits.map((item, idx) => (
              <Text
                key={item.seq}
                style={styles.offPageErrorLink}
                onPress={() => onPageChange?.(item.pageIndex)}
              >
                #{item.seq} (Pg {item.pageIndex + 1})
                {idx < offPageErrorUnits.length - 1 ? ', ' : ''}
              </Text>
            ))}
          </Text>
        </View>
      )}

      {/* Paginated unit cards */}
      <View style={styles.unitsScrollContainer}>
        {visibleParcels.map((parcel, localIndex) => {
          const globalIndex = startIndex + localIndex;
          const lNum = parseFloat(parcel.lengthCm);
          const wNum = parseFloat(parcel.widthCm);
          const hNum = parseFloat(parcel.heightCm);
          const hasDims = !isNaN(lNum) && lNum > 0 && !isNaN(wNum) && wNum > 0 && !isNaN(hNum) && hNum > 0;
          const unitVolume = hasDims ? (lNum * wNum * hNum) / 1000000 : null;

          return (
            <View key={parcel.id || `parcel-${globalIndex}`} style={styles.unitCard}>
              <View style={styles.unitCardTop}>
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeText}>UNIT #{parcel.seq}</Text>
                </View>
                {unitVolume !== null ? (
                  <Text style={styles.unitVolumeTag}>
                    {formatMeasure(unitVolume, 4, 'm³')}
                  </Text>
                ) : null}
                {totalUnits > 1 ? (
                  <TouchableOpacity
                    style={styles.removeUnitBtn}
                    onPress={() => onRemoveUnit?.(globalIndex)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove unit ${parcel.seq}`}
                  >
                    <Text style={styles.removeUnitBtnText}>✕ Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.unitFieldsRow}>
                <View style={styles.unitFieldCol}>
                  <FormField
                    label="Weight (kg)"
                    required
                    value={parcel.weightKg}
                    onChangeText={(val) => onUpdateParcelField?.(globalIndex, 'weightKg', val)}
                    numericOnly
                    placeholder="1.0"
                    maxLength={9}
                    suffix="kg"
                    error={errors[`parcel_${globalIndex}_weightKg`]}
                  />
                </View>
                <View style={styles.unitFieldCol}>
                  <FormField
                    label="Length (cm)"
                    required
                    value={parcel.lengthCm}
                    onChangeText={(val) => onUpdateParcelField?.(globalIndex, 'lengthCm', val)}
                    numericOnly
                    placeholder="20"
                    maxLength={9}
                    suffix="cm"
                    error={errors[`parcel_${globalIndex}_lengthCm`]}
                  />
                </View>
                <View style={styles.unitFieldCol}>
                  <FormField
                    label="Width (cm)"
                    required
                    value={parcel.widthCm}
                    onChangeText={(val) => onUpdateParcelField?.(globalIndex, 'widthCm', val)}
                    numericOnly
                    placeholder="10"
                    maxLength={9}
                    suffix="cm"
                    error={errors[`parcel_${globalIndex}_widthCm`]}
                  />
                </View>
                <View style={styles.unitFieldCol}>
                  <FormField
                    label="Height (cm)"
                    required
                    value={parcel.heightCm}
                    onChangeText={(val) => onUpdateParcelField?.(globalIndex, 'heightCm', val)}
                    numericOnly
                    placeholder="15"
                    maxLength={9}
                    suffix="cm"
                    error={errors[`parcel_${globalIndex}_heightCm`]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[styles.pageNavBtn, activePage === 0 && styles.pageNavBtnDisabled]}
            disabled={activePage === 0}
            onPress={() => onPageChange?.(activePage - 1)}
            accessibilityRole="button"
            accessibilityLabel="Previous page of parcel units"
          >
            <Text style={[styles.pageNavBtnText, activePage === 0 && styles.pageNavBtnTextDisabled]}>
              ← Previous
            </Text>
          </TouchableOpacity>

          <View style={styles.pagePillsRow}>
            {Array.from({ length: totalPages }, (_, pIdx) => {
              const isCurrent = pIdx === activePage;
              const pageHasError = offPageErrorUnits.some((e) => e.pageIndex === pIdx);
              return (
                <TouchableOpacity
                  key={`page-pill-${pIdx}`}
                  style={[
                    styles.pagePill,
                    isCurrent && styles.pagePillActive,
                    pageHasError && !isCurrent && styles.pagePillError,
                  ]}
                  onPress={() => onPageChange?.(pIdx)}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to page ${pIdx + 1}`}
                >
                  <Text
                    style={[
                      styles.pagePillText,
                      isCurrent && styles.pagePillTextActive,
                      pageHasError && !isCurrent && styles.pagePillTextError,
                    ]}
                  >
                    {pIdx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.pageNavBtn, activePage >= totalPages - 1 && styles.pageNavBtnDisabled]}
            disabled={activePage >= totalPages - 1}
            onPress={() => onPageChange?.(activePage + 1)}
            accessibilityRole="button"
            accessibilityLabel="Next page of parcel units"
          >
            <Text
              style={[
                styles.pageNavBtnText,
                activePage >= totalPages - 1 && styles.pageNavBtnTextDisabled,
              ]}
            >
              Next →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sectionHeader: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
  },
  paginationSummary: {
    alignSelf: 'flex-end',
  },
  paginationSummaryText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
  },
  offPageErrorBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  offPageErrorText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.danger,
    fontWeight: '600',
  },
  offPageErrorLink: {
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  unitsScrollContainer: {
    gap: spacing.md,
  },
  unitCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  unitCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  unitBadge: {
    backgroundColor: colors.black,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  unitBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  unitVolumeTag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
    flex: 1,
    marginLeft: spacing.sm,
  },
  removeUnitBtn: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  removeUnitBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  unitFieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  unitFieldCol: {
    flex: 1,
    minWidth: 120,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pageNavBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#FFFFFF',
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
    borderColor: colors.border,
  },
  pageNavBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  pageNavBtnTextDisabled: {
    color: colors.inkFaint,
  },
  pagePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  pagePill: {
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  pagePillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  pagePillError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  pagePillText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  pagePillTextActive: {
    color: '#FFFFFF',
  },
  pagePillTextError: {
    color: colors.danger,
  },
});

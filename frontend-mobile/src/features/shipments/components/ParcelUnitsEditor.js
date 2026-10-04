import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme';
import { createParcelPaginationModel, getParcelPageIndex } from '../parcelPagination.mjs';

const MEASUREMENT_ROWS = [
  [
    { fieldName: 'weightKg', label: 'WEIGHT (KG) *', placeholder: '1.0', accessibilityName: 'weight' },
    { fieldName: 'lengthCm', label: 'LENGTH (CM) *', placeholder: '20', accessibilityName: 'length' },
  ],
  [
    { fieldName: 'widthCm', label: 'WIDTH (CM) *', placeholder: '10', accessibilityName: 'width' },
    { fieldName: 'heightCm', label: 'HEIGHT (CM) *', placeholder: '15', accessibilityName: 'height' },
  ],
];

function formatVolume(value) {
  return `${value.toFixed(4)} m³`;
}

function ParcelMeasurementField({
  accessibilityName,
  errors,
  fieldName,
  fieldRefs,
  globalIndex,
  inputRefs,
  isSubmitting,
  label,
  onUpdateParcelField,
  parcel,
  placeholder,
}) {
  const fieldKey = `parcels[${globalIndex}].${fieldName}`;
  const error = errors[fieldKey];

  return (
    <View
      ref={(node) => { fieldRefs.current[fieldKey] = node; }}
      collapsable={false}
      style={styles.unitFieldCol}
    >
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={(node) => { inputRefs.current[fieldKey] = node; }}
        accessibilityLabel={`Unit ${parcel.seq} ${accessibilityName}`}
        value={parcel[fieldName]}
        onChangeText={(value) => onUpdateParcelField(globalIndex, fieldName, value)}
        editable={!isSubmitting}
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={9}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function PaginationControls({
  activePage,
  errorPageIndices,
  isBottom = false,
  onPageChange,
  paginationItems = [],
  totalPages,
}) {
  if (totalPages <= 1) return null;

  const isFirstPage = activePage === 0;
  const isLastPage = activePage >= totalPages - 1;

  return (
    <View style={isBottom ? styles.paginationRowBottom : styles.paginationRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isBottom ? 'Previous parcel page (bottom)' : 'Previous parcel page'}
        disabled={isFirstPage}
        onPress={() => onPageChange(Math.max(0, activePage - 1))}
        style={[styles.pageNavBtn, isFirstPage && styles.pageNavBtnDisabled]}
      >
        <Text style={[styles.pageNavBtnText, isFirstPage && styles.pageNavBtnTextDisabled]}>← Prev</Text>
      </Pressable>

      {isBottom ? (
        <Text style={styles.pageIndicatorText}>Page {activePage + 1} of {totalPages}</Text>
      ) : (
        <View style={styles.pagePillsContainer}>
          {paginationItems.map((item) => {
            const hasErrors = item.isEllipsis
              ? (item.coveredPageIndices || []).some((idx) => errorPageIndices.has(idx))
              : errorPageIndices.has(item.pageIndex);

            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={
                  item.isEllipsis
                    ? `Jump ${item.ellipsisDirection === 'left' ? 'back' : 'forward'} to parcel page ${item.pageIndex + 1}`
                    : `Go to parcel page ${item.pageIndex + 1}`
                }
                onPress={() => onPageChange(item.pageIndex)}
                style={[
                  styles.pagePill,
                  item.isCurrent && styles.pagePillActive,
                  hasErrors && !item.isCurrent && styles.pagePillError,
                ]}
              >
                <Text
                  style={[
                    styles.pagePillText,
                    item.isCurrent && styles.pagePillTextActive,
                    hasErrors && !item.isCurrent && styles.pagePillTextError,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isBottom ? 'Next parcel page (bottom)' : 'Next parcel page'}
        disabled={isLastPage}
        onPress={() => onPageChange(Math.min(totalPages - 1, activePage + 1))}
        style={[styles.pageNavBtn, isLastPage && styles.pageNavBtnDisabled]}
      >
        <Text style={[styles.pageNavBtnText, isLastPage && styles.pageNavBtnTextDisabled]}>Next →</Text>
      </Pressable>
    </View>
  );
}

export function ParcelUnitsEditor({
  currentPage,
  errors,
  fieldRefs,
  inputRefs,
  isSubmitting,
  onPageChange,
  onRequestRemoveUnit,
  onUpdateParcelField,
  parcels,
  shouldStack,
}) {
  const pageModel = createParcelPaginationModel(parcels, errors, currentPage);
  const firstOffPageErrorIndex = pageModel.offPageErrorUnitIndices[0];

  return (
    <View style={styles.unitsSection}>
      <View style={styles.unitsHeaderRow}>
        <Text style={styles.unitsHeaderTitle}>
          PARCEL UNITS ({pageModel.totalUnits} {pageModel.totalUnits === 1 ? 'UNIT' : 'UNITS'}) · PER-UNIT MEASUREMENTS
        </Text>
        {pageModel.totalPages > 1 ? (
          <Text style={styles.pageIndicatorText}>
            Page {pageModel.activePage + 1} of {pageModel.totalPages} ({pageModel.startIndex + 1}–{pageModel.endIndex})
          </Text>
        ) : null}
      </View>

      {pageModel.offPageErrorUnitIndices.length > 0 ? (
        <View style={styles.offPageErrorBanner}>
          <Text style={styles.offPageErrorText}>
            {pageModel.offPageErrorUnitIndices.length} unit{pageModel.offPageErrorUnitIndices.length === 1 ? '' : 's'} with errors on other pages.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onPageChange(getParcelPageIndex(firstOffPageErrorIndex))}
            style={styles.offPageErrorBtn}
          >
            <Text style={styles.offPageErrorBtnText}>
              Jump to Unit #{parcels[firstOffPageErrorIndex]?.seq || (firstOffPageErrorIndex + 1)} →
            </Text>
          </Pressable>
        </View>
      ) : null}

      <PaginationControls
        activePage={pageModel.activePage}
        errorPageIndices={pageModel.errorPageIndices}
        onPageChange={onPageChange}
        paginationItems={pageModel.paginationItems}
        totalPages={pageModel.totalPages}
      />

      {pageModel.visibleParcels.map(({ parcel, globalIndex }) => {
        const length = parseFloat(parcel.lengthCm);
        const width = parseFloat(parcel.widthCm);
        const height = parseFloat(parcel.heightCm);
        const hasDimensions = Number.isFinite(length) && length > 0
          && Number.isFinite(width) && width > 0
          && Number.isFinite(height) && height > 0;
        const unitVolume = hasDimensions ? (length * width * height) / 1000000 : null;

        return (
          <View key={parcel.id || `parcel-${globalIndex}`} style={styles.unitCard}>
            <View style={styles.unitCardHeader}>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>UNIT #{parcel.seq}</Text>
              </View>
              {unitVolume !== null ? <Text style={styles.unitVolumeTag}>{formatVolume(unitVolume)}</Text> : null}
              {pageModel.totalUnits > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove unit ${parcel.seq}`}
                  disabled={isSubmitting}
                  onPress={() => onRequestRemoveUnit(globalIndex)}
                  style={styles.removeUnitBtn}
                >
                  <Text style={styles.removeUnitBtnText}>× Remove</Text>
                </Pressable>
              ) : null}
            </View>

            {MEASUREMENT_ROWS.map((measurementRow) => (
              <View
                key={measurementRow[0].fieldName}
                style={[styles.row, shouldStack && styles.stacked]}
              >
                {measurementRow.map((measurement) => (
                  <ParcelMeasurementField
                    key={measurement.fieldName}
                    {...measurement}
                    errors={errors}
                    fieldRefs={fieldRefs}
                    globalIndex={globalIndex}
                    inputRefs={inputRefs}
                    isSubmitting={isSubmitting}
                    onUpdateParcelField={onUpdateParcelField}
                    parcel={parcel}
                  />
                ))}
              </View>
            ))}
          </View>
        );
      })}

      <PaginationControls
        activePage={pageModel.activePage}
        errorPageIndices={pageModel.errorPageIndices}
        isBottom
        onPageChange={onPageChange}
        paginationItems={pageModel.paginationItems}
        totalPages={pageModel.totalPages}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  unitsSection: { marginTop: spacing.sm },
  unitsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  unitsHeaderTitle: { ...typography.eyebrow, fontSize: 10.5, letterSpacing: 0.8, color: colors.inkFaint, marginBottom: spacing.sm },
  pageIndicatorText: { ...typography.mono, fontSize: 11, color: colors.inkSoft },
  offPageErrorBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  offPageErrorText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  offPageErrorBtn: { paddingVertical: 2, paddingHorizontal: spacing.sm, backgroundColor: colors.danger },
  offPageErrorBtnText: { fontSize: 11, fontWeight: '700', color: colors.surface },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  paginationRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  pageNavBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  pageNavBtnDisabled: { opacity: 0.35, borderColor: colors.border },
  pageNavBtnText: { fontSize: 11, fontWeight: '600', color: colors.ink },
  pageNavBtnTextDisabled: { color: colors.inkFaint },
  pagePillsContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    flexWrap: 'nowrap',
  },
  pagePill: {
    minWidth: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  pagePillActive: { backgroundColor: colors.black, borderColor: colors.black },
  pagePillError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  pagePillText: { ...typography.mono, fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  pagePillTextActive: { color: colors.surface, fontWeight: '700' },
  pagePillTextError: { color: colors.danger, fontWeight: '700' },
  unitCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  unitCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  unitBadge: { backgroundColor: colors.black, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  unitBadgeText: { ...typography.mono, color: colors.surface, fontSize: 11, fontWeight: '700' },
  unitVolumeTag: { ...typography.mono, fontSize: 11, color: colors.inkSoft, flex: 1, marginLeft: spacing.sm },
  removeUnitBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  removeUnitBtnText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  row: { flexDirection: 'row', gap: spacing.md },
  stacked: { flexDirection: 'column', gap: 0 },
  unitFieldCol: { flex: 1, minWidth: 100, marginBottom: spacing.sm },
  label: { ...typography.eyebrow, fontSize: 10, letterSpacing: 0.7, marginBottom: spacing.sm },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    fontSize: 16,
    backgroundColor: colors.canvas,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 12, lineHeight: 17, color: colors.danger, marginTop: spacing.xs },
});

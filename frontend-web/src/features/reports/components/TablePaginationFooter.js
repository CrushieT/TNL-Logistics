import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Button from '../../../components/common/Button';
import { colors, fonts, spacing } from '../../../theme';

export default function TablePaginationFooter({
  totalItems = 0,
  currentCount,
  page = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = 'items',
  loading = false,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const countOnPage =
    currentCount !== undefined
      ? currentCount
      : Math.min(pageSize, Math.max(0, totalItems - page * pageSize));

  return (
    <View style={styles.paginationFooter}>
      <View style={styles.paginationMeta}>
        <Text style={styles.paginationText}>
          Showing <Text style={styles.paginationStrong}>{countOnPage}</Text> of{' '}
          <Text style={styles.paginationStrong}>{totalItems}</Text> {itemLabel} · Page{' '}
          <Text style={styles.paginationStrong}>{page + 1}</Text> of{' '}
          <Text style={styles.paginationStrong}>{totalPages}</Text>
        </Text>
      </View>

      <View style={styles.paginationActions}>
        {Platform.OS === 'web' && onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 0 ? (
          <View style={styles.pageSizeSelectWrap}>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={webSelectStyle}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </View>
        ) : null}

        <Button
          label="← Previous"
          variant="secondary"
          disabled={page <= 0 || loading}
          onPress={() => onPageChange?.(page - 1)}
          style={styles.pageBtn}
        />

        <Button
          label="Next →"
          variant="secondary"
          disabled={page >= totalPages - 1 || loading}
          onPress={() => onPageChange?.(page + 1)}
          style={styles.pageBtn}
        />
      </View>
    </View>
  );
}

const webSelectStyle = {
  fontFamily: fonts.mono,
  fontSize: 11.5,
  color: colors.ink,
  border: `1px solid ${colors.border}`,
  backgroundColor: '#FFFFFF',
  padding: '6px 8px',
  borderRadius: 3,
  outline: 'none',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  paginationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  paginationStrong: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.ink,
  },
  paginationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageSizeSelectWrap: {
    marginRight: spacing.xs,
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
  },
});

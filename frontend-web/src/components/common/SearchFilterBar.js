import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { colors, fonts, spacing, radius } from '../../theme';

export default function SearchFilterBar({ searchValue, onSearchChange, placeholder, filters = [] }) {
  return (
    <View style={styles.row}>
      <View style={styles.searchBox}>
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkFaint}
          style={styles.searchInput}
        />
      </View>
      {filters.map((f) => (
        <View key={f.label} style={styles.selectBox}>
          {Platform.OS === 'web' ? (
            // eslint-disable-next-line jsx-a11y/no-onchange
            <select value={f.value} onChange={(e) => f.onChange(e.target.value)} style={webSelectStyle}>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const webSelectStyle = {
  fontFamily: fonts.mono,
  fontSize: 12.5,
  color: colors.ink,
  border: 'none',
  backgroundColor: 'transparent',
  padding: '9px 12px',
  outline: 'none',
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  searchInput: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.ink,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    outlineStyle: 'none',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    minWidth: 130,
    justifyContent: 'center',
  },
});

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../theme';

export default function SelectField({ label, required, value, onValueChange, options = [], helper, error }) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.selectBox, Boolean(error) && styles.selectBoxError]}>
        {Platform.OS === 'web' ? (
          // eslint-disable-next-line jsx-a11y/no-onchange
          <select
            value={value || (options[0]?.value || '')}
            onChange={(e) => onValueChange?.(e.target.value)}
            style={webSelectStyle}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <Text style={styles.nativeFallback}>{value}</Text>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const webSelectStyle = {
  fontFamily: fonts.sans,
  fontSize: 13.5,
  color: colors.ink,
  border: 'none',
  backgroundColor: 'transparent',
  width: '100%',
  padding: '10px 12px',
  outline: 'none',
  appearance: 'auto',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    width: '100%',
  },
  label: {
    ...type.label,
    marginBottom: spacing.xs + 2,
  },
  required: {
    color: colors.accent,
  },
  selectBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    width: '100%',
  },
  selectBoxError: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  nativeFallback: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.ink,
    padding: spacing.md,
  },
  helper: {
    ...type.bodySmall,
    color: colors.inkFaint,
    marginTop: spacing.xs,
    fontSize: 11,
  },
  errorText: {
    ...type.bodySmall,
    color: colors.danger,
    marginTop: spacing.xs,
    fontSize: 11,
    fontWeight: '600',
  },
});

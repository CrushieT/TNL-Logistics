import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../constants/theme';

/**
 * Dropdown field. On web this renders a real <select> (via react-native-web's
 * Picker fallback pattern using a plain HTML select for full fidelity with
 * the prototype's native-looking dropdowns).
 */
export default function SelectField({ label, required, value, onValueChange, options = [], helper }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.selectBox}>
        {Platform.OS === 'web' ? (
          // eslint-disable-next-line jsx-a11y/no-onchange
          <select
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
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
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
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
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
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
  },
  nativeFallback: {
    fontFamily: fonts.mono,
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
});

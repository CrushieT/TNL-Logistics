import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../theme';

export default function FormField({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  helper,
  error,
  multiline = false,
  editable = true,
  numericOnly = false,
  integerOnly = false,
  suffix,
  style,
  inputStyle,
}) {
  const handleChangeText = (text) => {
    if (!onChangeText) return;
    if (integerOnly) {
      const sanitized = text.replace(/[^0-9]/g, '');
      onChangeText(sanitized);
    } else if (numericOnly) {
      let sanitized = text.replace(/[^0-9.]/g, '');
      const parts = sanitized.split('.');
      if (parts.length > 2) {
        sanitized = `${parts[0]}.${parts.slice(1).join('')}`;
      }
      onChangeText(sanitized);
    } else {
      onChangeText(text);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            multiline && styles.multiline,
            !editable && styles.disabled,
            Boolean(error) && styles.inputError,
            inputStyle,
          ]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkFaint}
          keyboardType={keyboardType || (integerOnly || numericOnly ? 'numeric' : 'default')}
          multiline={multiline}
          editable={editable}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

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
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
  },
  input: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.canvas,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    paddingHorizontal: spacing.md,
    outlineStyle: 'none',
    width: '100%',
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  disabled: {
    color: colors.inkFaint,
    backgroundColor: '#F0EFEB',
  },
  suffix: {
    position: 'absolute',
    right: spacing.md,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
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

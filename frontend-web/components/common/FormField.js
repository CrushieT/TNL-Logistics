import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../constants/theme';

/**
 * Labeled input matching the prototype's "SELECT CLIENT", "FULL NAME",
 * "COMPLETE ADDRESS" style fields: uppercase small label above a boxed input.
 */
export default function FormField({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  helper,
  multiline = false,
  editable = true,
  suffix,
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, multiline && styles.multiline, !editable && styles.disabled]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkFaint}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

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
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
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
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  disabled: {
    color: colors.inkFaint,
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
});

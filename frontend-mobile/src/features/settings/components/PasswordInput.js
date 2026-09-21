import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../../theme';

export function PasswordInput({ label, value, onChangeText, editable = true, autoFocus = false }) {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="noExcludeDescendants"
          editable={editable}
          autoFocus={autoFocus}
          accessibilityLabel={label}
        />
        <Pressable
          style={styles.toggle}
          onPress={() => setIsVisible((current) => !current)}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={`${isVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          <Text style={styles.toggleText}>{isVisible ? 'HIDE' : 'SHOW'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { color: colors.inkSoft, fontFamily: 'monospace', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.9, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4 },
  input: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 14, paddingHorizontal: 12 },
  toggle: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: colors.inkSoft, fontFamily: 'monospace', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
});

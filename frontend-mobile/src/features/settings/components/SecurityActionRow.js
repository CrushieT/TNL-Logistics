import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors } from '../../../theme';
import { PressableScale } from '../../../components/common/PressableScale';

export function SecurityActionRow({ icon, title, subtitle, onPress, danger = false, disabled = false }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={title}
      contentStyle={[styles.row, danger && styles.dangerRow, disabled && styles.disabled]}
    >
      <View style={[styles.icon, danger && styles.dangerIcon]}>
        <Icon source={icon} size={21} color={danger ? colors.danger : colors.ink} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, danger && styles.dangerText]}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Icon source="chevron-right" size={20} color={danger ? colors.danger : colors.inkFaint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  dangerRow: { borderColor: '#F2B8B5' },
  disabled: { opacity: 0.55 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBE9E0', borderRadius: 4, marginRight: 12 },
  dangerIcon: { backgroundColor: colors.dangerSoft },
  copy: { flex: 1, marginRight: 10 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  dangerText: { color: colors.danger },
  subtitle: { color: colors.inkFaint, fontSize: 11.5, lineHeight: 16 },
});

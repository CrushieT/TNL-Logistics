import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors } from '../../theme';
import { PressableScale } from '../common/PressableScale';

export function MobileHeader({ role, name, onAccount, onLock }) {
  const roleDisplay = role ? role.replace(/_/g, ' ') : 'ROLE UNAVAILABLE';

  return (
    <View style={styles.header}>
      <PressableScale
        style={styles.userPressable}
        contentStyle={styles.userInfo}
        onPress={onAccount}
        activeScale={0.98}
        accessibilityRole="button"
        accessibilityLabel="Open account settings"
      >
        <View style={styles.accountIcon}><Icon source="account-outline" size={20} color={colors.ink} /></View>
        <View style={styles.identity}>
          <Text style={styles.eyebrow}>{roleDisplay}</Text>
          <Text style={styles.name}>{name || '—'}</Text>
        </View>
      </PressableScale>
      {Boolean(onLock) && (
        <PressableScale onPress={onLock} activeScale={0.93} contentStyle={styles.lockButton} accessibilityRole="button" accessibilityLabel="Lock app">
          <Icon source="lock-outline" size={16} color={colors.inkSoft} />
          <Text style={styles.lockText}>LOCK</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, marginBottom: 8 },
  userPressable: { flex: 1, marginRight: 10 },
  userInfo: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  accountIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, marginRight: 10 },
  identity: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.1, color: colors.inkFaint, fontWeight: '700', fontFamily: 'monospace', marginBottom: 2 },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  lockButton: { minWidth: 64, minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 3, backgroundColor: '#EBE9E0' },
  lockText: { fontSize: 10.5, fontWeight: '700', color: colors.inkSoft, letterSpacing: 0.7, fontFamily: 'monospace' },
});

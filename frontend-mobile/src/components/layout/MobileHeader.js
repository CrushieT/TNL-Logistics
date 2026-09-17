import React from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { colors } from '../../theme';
import { PressableScale } from '../common/PressableScale';

export function MobileHeader({ role, name, onLogout, onLock }) {
  const roleDisplay = role ? role.replace('_', ' ') : 'STAFF';

  const handleLogoutPress = () => {
    Alert.alert(
      'Log Out & Unbind Device',
      'This will remove account credentials from this device. You will need your username and password to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <View style={styles.header}>
      <View style={styles.userInfo}>
        <Text style={styles.eyebrow}>{roleDisplay}</Text>
        <Text style={styles.name}>{name || 'Staff User'}</Text>
      </View>
      <View style={styles.actions}>
        {Boolean(onLock) && (
          <PressableScale onPress={onLock} activeScale={0.93} contentStyle={styles.lockButton}>
            <Text style={styles.lockText}>LOCK</Text>
          </PressableScale>
        )}
        <PressableScale onPress={handleLogoutPress} activeScale={0.93} contentStyle={styles.logoutButton}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  lockButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: '#EBE9E0',
  },
  lockText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
    fontFamily: 'monospace',
  },
  logoutButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  logoutText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
    letterSpacing: 0.8,
    fontFamily: 'monospace',
  },
});

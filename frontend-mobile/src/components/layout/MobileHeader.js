import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../theme';

export function MobileHeader({ role, name, onLogout }) {
  const roleDisplay = role ? role.replace('_', ' ') : 'STAFF';

  return (
    <View style={styles.header}>
      <View style={styles.userInfo}>
        <Text style={styles.eyebrow}>{roleDisplay}</Text>
        <Text style={styles.name}>{name || 'Staff User'}</Text>
      </View>
      <TouchableOpacity onPress={onLogout} activeOpacity={0.7} style={styles.logoutButton}>
        <Text style={styles.logoutText}>LOGOUT</Text>
      </TouchableOpacity>
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
  logoutButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';

export function AccountIdentityCard({ account }) {
  return (
    <View style={styles.card}>
      <View style={styles.initials} accessibilityLabel={`Initials ${account.initials}`}>
        <Text style={styles.initialsText}>{account.initials}</Text>
      </View>
      <View style={styles.identity}>
        <Text style={styles.name}>{account.fullName}</Text>
        <Text style={styles.username}>{account.username}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>USER ID</Text>
          <Text style={styles.metaValue}>{account.userId}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>ROLE</Text>
          <Text style={styles.metaValue}>{account.role}</Text>
        </View>
        {account.staffType && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>STAFF TYPE</Text>
            <Text style={styles.metaValue}>{account.staffType}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 4, padding: 18, gap: 16 },
  initials: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black, borderRadius: 4 },
  initialsText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  identity: { flex: 1 },
  name: { color: colors.ink, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  username: { color: colors.inkFaint, fontFamily: 'monospace', fontSize: 12, marginBottom: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  metaLabel: { color: colors.inkFaint, fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  metaValue: { color: colors.inkSoft, flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'right' },
});

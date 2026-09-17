import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors } from '../../theme';

export function MetricCard({ metric = 0, label }) {
  return (
    <View style={styles.card}>
      <Text style={styles.metricText}>{metric}</Text>
      <Text style={styles.labelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 18,
    paddingHorizontal: 12,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  metricText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  labelText: {
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});

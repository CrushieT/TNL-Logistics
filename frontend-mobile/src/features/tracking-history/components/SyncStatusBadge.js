import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { getSyncStatusMeta } from '../trackingHistoryFlow.mjs';

export function SyncStatusBadge({ syncStatus, style }) {
  const meta = getSyncStatusMeta(syncStatus);

  return (
    <View style={[styles.badge, { backgroundColor: meta.bgColor, borderColor: meta.borderColor }, style]}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

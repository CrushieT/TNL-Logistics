import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../theme';

function formatToday() {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TopBar({ shipmentCount, parcelCount }) {
  const sc = shipmentCount != null ? shipmentCount : 10;
  const pc = parcelCount != null ? parcelCount : 13;

  return (
    <View style={styles.bar}>
      <Text style={styles.meta}>
        {`${sc} shipments · ${pc} parcels · One shared system · PC ↔ Mobile`}
      </Text>
      <Text style={styles.date}>{formatToday()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.canvas,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#444444',
    letterSpacing: 0.2,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#737373',
  },
});

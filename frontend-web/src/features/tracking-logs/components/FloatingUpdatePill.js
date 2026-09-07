import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { colors, fonts } from '../../../theme';

export default function FloatingUpdatePill({ count, onPress }) {
  if (!count || count <= 0) return null;

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.pill} onPress={onPress}>
        <View style={styles.dot} />
        <Text style={styles.text}>
          {count === 1 ? '1 new scan received' : `${count} new scans received`} · Jump to latest
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399', // live green
  },
  text: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

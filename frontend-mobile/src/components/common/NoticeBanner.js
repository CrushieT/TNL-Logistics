import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors } from '../../theme';

export function NoticeBanner({ title, subtitle }) {
  return (
    <View style={styles.banner}>
      <View style={styles.accentBar} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderRadius: 2,
    marginVertical: 12,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 16,
  },
});

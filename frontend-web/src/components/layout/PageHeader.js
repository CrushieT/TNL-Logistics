import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, type } from '../../theme';

export default function PageHeader({ eyebrow, title, right, style }) {
  return (
    <View style={[styles.header, style]}>
      <View>
        {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[type.h1, styles.title]}>{title}</Text>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  title: {
    marginTop: 4,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, type } from '../../constants/theme';

export default function PageHeader({ eyebrow, title, action }) {
  return (
    <View style={styles.row}>
      <View>
        {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[type.h1, styles.title]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  title: {
    marginTop: 2,
  },
});

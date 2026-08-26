import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppShell from '../layout/AppShell';
import PageHeader from '../layout/PageHeader';
import Card from './Card';
import { colors, fonts, spacing } from '../../theme';

export default function ComingSoon({ eyebrow, title }) {
  return (
    <AppShell>
      <PageHeader eyebrow={eyebrow} title={title} />
      <Card>
        <View style={styles.wrap}>
          <Text style={styles.text}>This section isn't wired up yet — the screen scaffold is ready for it.</Text>
        </View>
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.inkFaint,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppShell from './AppShell';
import PageHeader from './PageHeader';
import Card from './Card';
import { colors, fonts, spacing } from '../../constants/theme';

/**
 * Placeholder for sidebar sections not yet built out (Tracking Logs,
 * Clients, Payments, Weekly Collections, Statements, Reports, Users,
 * Settings). Swap each one out for a real screen as its backend endpoint
 * lands — the sidebar link and route already exist so nothing 404s.
 */
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

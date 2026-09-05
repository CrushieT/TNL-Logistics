import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, fonts, spacing, radius } from '../theme';
import { isAuthenticated } from '../services/api/client';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/common/Card';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const authenticated = isAuthenticated();

  const displayPath =
    (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.pathname) ||
    pathname ||
    '/unknown';

  const handleReturn = () => {
    if (authenticated) {
      router.replace('/');
    } else {
      router.replace('/login');
    }
  };

  // Authenticated operators: render inside AppShell with sidebar and topbar
  if (authenticated) {
    return (
      <AppShell>
        <PageHeader eyebrow="HTTP 404" title="Page Not Found" />

        <Card style={styles.authCard}>
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>UNRECOGNIZED OPERATIONAL ROUTE</Text>
            <Text style={styles.warningMessage}>
              The requested address does not match any registered operations, billing, or administration screens.
            </Text>
          </View>

          <View style={styles.pathSection}>
            <Text style={styles.pathLabel}>REQUESTED PATH</Text>
            <View style={styles.pathBadge}>
              <Text style={styles.pathText}>{displayPath}</Text>
            </View>
          </View>

          <View style={styles.authActionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.primaryButton}
              onPress={handleReturn}
            >
              <Text style={styles.primaryButtonText}>RETURN TO DASHBOARD</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </AppShell>
    );
  }

  // Unauthenticated visitors: render standalone card matching login layout
  return (
    <ScrollView
      contentContainerStyle={styles.standaloneScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.standaloneCard}>
        {/* Brand Header */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/tracking-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.dividerLine} />
          <View style={styles.badgeWrap}>
            <Text style={styles.systemBadge}>OPERATIONS CONSOLE</Text>
          </View>
        </View>

        {/* 404 Notice */}
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>HTTP 404 · ROUTE NOT FOUND</Text>
          <Text style={styles.warningMessage}>
            The operational page you requested does not exist or has been moved.
          </Text>
        </View>

        <View style={styles.pathSection}>
          <Text style={styles.pathLabel}>REQUESTED PATH</Text>
          <View style={styles.pathBadge}>
            <Text style={styles.pathText}>{displayPath}</Text>
          </View>
        </View>

        {/* Action */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.primaryButton}
          onPress={handleReturn}
        >
          <Text style={styles.primaryButtonText}>SIGN IN TO CONSOLE</Text>
        </TouchableOpacity>

        {/* Security Footer Notice */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Authorized Personnel Only · Internal Logistics Operations
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  authCard: {
    maxWidth: 680,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  warningBox: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.warning,
    borderWidth: 1,
    borderColor: '#F2D399',
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  warningTitle: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.warning,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  warningMessage: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  pathSection: {
    gap: 6,
  },
  pathLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  pathBadge: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  pathText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
  authActionRow: {
    marginTop: spacing.xs,
    alignItems: 'flex-start',
  },
  primaryButton: {
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    minWidth: 220,
  },
  primaryButtonText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.9,
  },
  standaloneScroll: {
    flexGrow: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: '100%',
  },
  standaloneCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 32,
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 18,
    elevation: 4,
    gap: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoImage: {
    width: 260,
    height: 84,
    maxWidth: '100%',
    marginBottom: spacing.xs,
  },
  dividerLine: {
    width: 64,
    height: 1,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 10,
  },
  badgeWrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EBE9E0',
    borderRadius: radius.sm,
    marginTop: 4,
  },
  systemBadge: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 1.4,
  },
  footerNote: {
    marginTop: spacing.sm,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});

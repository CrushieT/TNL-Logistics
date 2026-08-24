import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, fonts, spacing, radius, type } from '../../theme';

const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Register Shipment', href: '/register' },
      { label: 'Shipments', href: '/shipments' },
      { label: 'Tracking Logs', href: '/tracking-logs' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Clients', href: '/clients' },
      { label: 'Payments', href: '/payments' },
      { label: 'Weekly Collections', href: '/weekly-collections' },
      { label: 'Statements of Account', href: '/statements' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Reports', href: '/reports' },
      { label: 'Users / Staff', href: '/users' },
      { label: 'Settings', href: '/settings' },
    ],
  },
];

export default function Sidebar({ user = { name: 'Maria Santos', role: 'Administrator' } }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.sidebar}>
      <View>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>T</Text>
          </View>
          <View>
            <Text style={styles.brandName}>TNL LOGISTICS</Text>
            <Text style={styles.brandSub}>Admin Console</Text>
          </View>
        </View>

        {NAV_SECTIONS.map((section) => (
          <View key={section.label} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            {section.items.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href)}
                  style={[styles.navItem, active && styles.navItemActive]}
                >
                  <View style={[styles.activeBar, active && styles.activeBarVisible]} />
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.split(' ').map((n) => n[0]).join('')}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{user.role}</Text>
          </View>
        </View>
        <Pressable style={styles.switchBtn}>
          <Text style={styles.switchBtnText}>SWITCH PLATFORM</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
    height: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  logoMark: {
    width: 28,
    height: 28,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  logoMarkText: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  brandName: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    fontSize: 12.5,
    color: colors.ink,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkFaint,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...type.label,
    fontSize: 9.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: spacing.lg,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: colors.canvas,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'transparent',
  },
  activeBarVisible: {
    backgroundColor: colors.accent,
  },
  navLabel: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  navLabelActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  userName: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  userRole: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkFaint,
  },
  switchBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  switchBtnText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, fonts, spacing, radius, type } from '../../constants/theme';

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
              const active = pathname === item.href;
              return (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href)}
                  style={({ hovered }) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    !active && hovered && styles.navItemHover,
                  ]}
                >
                  <View style={[styles.navMarker, active && styles.navMarkerActive]} />
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {item.label}
                  </Text>
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
    width: 240,
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
    width: 30,
    height: 30,
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
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.inkFaint,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...type.label,
    fontSize: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    cursor: 'pointer',
  },
  navItemActive: {
    backgroundColor: colors.black,
  },
  navItemHover: {
    backgroundColor: colors.canvas,
  },
  navMarker: {
    width: 6,
    height: 6,
    backgroundColor: colors.border,
  },
  navMarkerActive: {
    backgroundColor: colors.accent,
  },
  navLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.accent,
  },
  userName: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  userRole: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
  },
  switchBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    cursor: 'pointer',
  },
  switchBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.inkSoft,
    fontWeight: '700',
  },
});

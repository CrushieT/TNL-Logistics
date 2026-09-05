import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, fonts, spacing, radius, type } from '../../theme';
import { getCurrentUser, logout } from '../../services/api/client';

const NAV_SECTIONS = [
  {
    id: 'operations',
    label: 'OPERATIONS',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Register Shipment', href: '/register' },
      { label: 'Shipments', href: '/shipments' },
      { label: 'Vehicles / Trucks', href: '/vehicles' },
      { label: 'Tracking Logs', href: '/tracking-logs' },
    ],
  },
  {
    id: 'billing',
    label: 'BILLING & FINANCE',
    items: [
      { label: 'Clients', href: '/clients' },
      { label: 'Payments', href: '/payments' },
      { label: 'Weekly Collections', href: '/weekly-collections' },
      { label: 'Statements of Account', href: '/statements' },
      { label: 'Waybills', href: '/waybills' },
    ],
  },
  {
    id: 'admin',
    label: 'ADMINISTRATION',
    items: [
      { label: 'Reports', href: '/reports' },
      { label: 'Users / Staff', href: '/users' },
      { label: 'Settings', href: '/settings' },
    ],
  },
];

export default function Sidebar({ user = { name: 'Admin Staff', role: 'ADMIN' } }) {
  const router = useRouter();
  const pathname = usePathname();

  const currentUser = getCurrentUser();
  const displayName = currentUser?.username || user?.name || 'Administrator';
  const displayRole = currentUser?.role
    ? currentUser.role.replace(/_/g, ' ')
    : user?.role || 'Administrator';
  const initials = displayName
    .split(/[\s_-]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    logout();
  };

  const visibleSections = NAV_SECTIONS.filter(
    (section) => section.id !== 'admin' || currentUser?.role === 'ADMIN'
  );

  return (
    <View style={styles.sidebar}>
      <View>
        {/* Brand Header with Clean Separator */}
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>T</Text>
          </View>
          <View style={styles.brandInfo}>
            <Text style={styles.brandName}>TNL LOGISTICS</Text>
            <View style={styles.badgeWrap}>
              <Text style={styles.brandBadge}>ADMIN CONSOLE</Text>
            </View>
          </View>
        </View>

        {/* Navigation Sections */}
        {visibleSections.map((section, sIdx) => (
          <View
            key={section.id}
            style={[
              styles.section,
              sIdx > 0 && styles.sectionDivider,
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{section.label}</Text>
            </View>

            <View style={styles.navGroup}>
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Pressable
                    key={item.href}
                    onPress={() => router.push(item.href)}
                    style={[styles.navItem, active && styles.navItemActive]}
                  >
                    {active ? <View style={styles.activeBar} /> : null}
                    <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {/* Footer / User Profile */}
      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userRole}>{displayRole}</Text>
          </View>
        </View>
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>SIGN OUT</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 252,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
    height: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E0D6',
  },
  logoMark: {
    width: 38,
    height: 38,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoMarkText: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  brandInfo: {
    gap: 2,
  },
  brandName: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 14.5,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
  },
  brandBadge: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#65635C',
    letterSpacing: 0.8,
  },
  section: {
    marginBottom: spacing.sm + 2,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E4E2D8',
    paddingTop: spacing.md + 4,
    marginTop: spacing.xs + 2,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#6E6C65',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  navGroup: {
    paddingHorizontal: spacing.sm + 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9.5,
    paddingHorizontal: spacing.md + 2,
    position: 'relative',
    borderRadius: radius.sm,
    marginVertical: 1,
  },
  navItemActive: {
    backgroundColor: '#EBE9E0',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  navLabel: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: '#3F3D38',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  navLabelActive: {
    color: colors.ink,
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E0D6',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.accent,
  },
  userName: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  userRole: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: 1,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  signOutBtnText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.6,
  },
});

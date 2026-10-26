import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, fonts, spacing, radius, type } from '../../theme';
import { getCurrentUser, logout } from '../../services/api/client';
import { getSavedNavScrollY, saveNavScrollY, resetNavScrollPosition } from './navScrollPosition.mjs';
import SignOutModal from './SignOutModal';

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
  const navScrollViewRef = useRef(null);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

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

  // Restore navigation scroll position on mount so navigation does not scroll back up
  useLayoutEffect(() => {
    const savedY = getSavedNavScrollY();
    if (savedY <= 0) return;

    const restoreScroll = () => {
      const scrollInstance = navScrollViewRef.current;
      if (!scrollInstance) return;

      if (typeof scrollInstance.scrollTo === 'function') {
        scrollInstance.scrollTo({ y: savedY, animated: false });
      }
      if (typeof scrollInstance.getScrollableNode === 'function') {
        const domNode = scrollInstance.getScrollableNode();
        if (domNode && typeof domNode.scrollTop === 'number') {
          domNode.scrollTop = savedY;
        }
      } else if (typeof scrollInstance.scrollTop === 'number') {
        scrollInstance.scrollTop = savedY;
      }
    };

    restoreScroll();
    const rafId = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame(restoreScroll)
      : null;
    const timerId = setTimeout(restoreScroll, 50);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, []);

  // Save latest scroll position on unmount
  useEffect(() => {
    return () => {
      try {
        const scrollInstance = navScrollViewRef.current;
        const domNode = scrollInstance?.getScrollableNode?.() || scrollInstance;
        if (domNode && typeof domNode.scrollTop === 'number' && Number.isFinite(domNode.scrollTop)) {
          saveNavScrollY(domNode.scrollTop);
        }
      } catch (_) {}
    };
  }, []);

  const handleScroll = (event) => {
    const offsetY = event?.nativeEvent?.contentOffset?.y;
    if (typeof offsetY === 'number' && Number.isFinite(offsetY)) {
      saveNavScrollY(offsetY);
    }
  };

  const handleNavigate = (href) => {
    try {
      const scrollInstance = navScrollViewRef.current;
      const domNode = scrollInstance?.getScrollableNode?.() || scrollInstance;
      if (domNode && typeof domNode.scrollTop === 'number' && Number.isFinite(domNode.scrollTop)) {
        saveNavScrollY(domNode.scrollTop);
      }
    } catch (_) {}
    router.push(href);
  };

  const handleOpenSignOutModal = () => {
    setSignOutModalVisible(true);
  };

  const handleCloseSignOutModal = () => {
    setSignOutModalVisible(false);
  };

  const handleConfirmSignOut = () => {
    setSignOutModalVisible(false);
    resetNavScrollPosition();
    logout();
  };

  const visibleSections = NAV_SECTIONS.filter(
    (section) => section.id !== 'admin' || currentUser?.role === 'ADMIN'
  );

  return (
    <View style={styles.sidebar}>
      {/* Brand Header with Clean Separator */}
      <Pressable
        onPress={() => handleNavigate('/')}
        style={({ hovered }) => [
          styles.brandRow,
          hovered && styles.brandRowHovered,
        ]}
      >
        <Image
          source={require('../../../assets/tracking-logo.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <View style={styles.badgeWrap}>
          <Text style={styles.brandBadge}>ADMIN CONSOLE</Text>
        </View>
      </Pressable>

      {/* Scrollable Navigation Sections */}
      <ScrollView
        ref={navScrollViewRef}
        style={styles.navScrollView}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
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
                    onPress={() => handleNavigate(item.href)}
                    style={({ hovered }) => [
                      styles.navItem,
                      hovered && !active && styles.navItemHovered,
                      active && styles.navItemActive,
                    ]}
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
      </ScrollView>

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
        <Pressable
          style={({ hovered }) => [
            styles.signOutBtn,
            hovered && styles.signOutBtnHovered,
          ]}
          onPress={handleOpenSignOutModal}
          accessibilityRole="button"
          accessibilityLabel="Sign out of Admin Console"
        >
          <Text style={styles.signOutBtnText}>SIGN OUT</Text>
        </Pressable>
      </View>

      <SignOutModal
        visible={signOutModalVisible}
        user={{
          name: displayName,
          role: displayRole,
          initials,
        }}
        onConfirm={handleConfirmSignOut}
        onClose={handleCloseSignOutModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: '100%',
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    height: '100%',
    flexDirection: 'column',
  },
  navScrollView: {
    flex: 1,
  },
  navScrollContent: {
    paddingVertical: spacing.xs,
  },
  brandRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E0D6',
    gap: 6,
    cursor: 'pointer',
  },
  brandRowHovered: {
    opacity: 0.88,
  },
  brandLogo: {
    width: 175,
    height: 56,
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  brandBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: spacing.sm + 2,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: '#EBE9E0',
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
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  navGroup: {
    paddingHorizontal: spacing.sm + 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md + 3,
    position: 'relative',
    borderRadius: radius.sm,
    marginVertical: 1.5,
  },
  navItemHovered: {
    backgroundColor: '#FAF9F5',
  },
  navItemActive: {
    backgroundColor: '#FAF9F5',
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
    fontSize: 14.5,
    color: '#3F3D38',
    fontWeight: '600',
    letterSpacing: 0,
  },
  navLabelActive: {
    color: colors.ink,
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#EBE9E0',
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
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
  },
  userName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  userRole: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkFaint,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    cursor: 'pointer',
  },
  signOutBtnHovered: {
    backgroundColor: '#F0EFE8',
    borderColor: '#D4D2C7',
  },
  signOutBtnText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.6,
  },
});

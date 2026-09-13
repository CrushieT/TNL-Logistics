import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions, TouchableOpacity, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { colors, fonts, spacing } from '../../theme';

export default function AppShell({ children, shipmentCount, parcelCount }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <View style={styles.frame}>
      {/* Mobile Top Navigation Header */}
      {isMobile ? (
        <View style={styles.mobileHeader}>
          <TouchableOpacity
            style={styles.mobileBrandRow}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../../assets/tracking-logo.png')}
              style={styles.mobileLogoImage}
              resizeMode="contain"
            />
            <View style={styles.mobileBadgeWrap}>
              <Text style={styles.mobileBadgeText}>ADMIN</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mobileMenuToggle}
            onPress={() => setMobileMenuOpen((prev) => !prev)}
          >
            <Text style={styles.mobileMenuIcon}>{mobileMenuOpen ? '✕' : '☰'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Main Container */}
      <View style={[styles.row, isMobile && styles.rowMobile]}>
        {/* Sidebar: Always visible on desktop/tablet, toggleable on mobile */}
        {(!isMobile || mobileMenuOpen) ? (
          <View style={[styles.sidebarWrap, isMobile && styles.sidebarMobile]}>
            <Sidebar />
          </View>
        ) : null}

        {/* Content Area */}
        <View style={styles.main}>
          <TopBar shipmentCount={shipmentCount} parcelCount={parcelCount} />
          <ScrollView
            contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: colors.canvas,
    minHeight: '100vh',
  },
  mobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  mobileBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileLogoImage: {
    width: 105,
    height: 32,
  },
  mobileBadgeWrap: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#EBE9E0',
    borderRadius: 2,
  },
  mobileBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  mobileMenuToggle: {
    padding: 6,
  },
  mobileMenuIcon: {
    fontSize: 18,
    color: colors.ink,
    fontWeight: '700',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100vh',
  },
  rowMobile: {
    flexDirection: 'column',
    minHeight: 'auto',
  },
  sidebarWrap: {
    width: 245,
    backgroundColor: '#FFFFFF',
  },
  sidebarMobile: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 64,
  },
  contentMobile: {
    padding: spacing.md,
    paddingBottom: 48,
  },
});

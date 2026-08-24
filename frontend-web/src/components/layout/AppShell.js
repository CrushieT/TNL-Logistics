import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { colors, fonts, spacing } from '../../theme';

export default function AppShell({ children, shipmentCount, parcelCount }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <View style={styles.frame}>
      {/* Mobile Top Navigation Header */}
      {isMobile ? (
        <View style={styles.mobileHeader}>
          <View style={styles.mobileBrandRow}>
            <View style={styles.mobileLogoMark}>
              <Text style={styles.mobileLogoText}>T</Text>
            </View>
            <Text style={styles.mobileBrandTitle}>TNL LOGISTICS</Text>
          </View>
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
    borderWidth: 1,
    borderColor: '#111111',
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
  mobileLogoMark: {
    width: 24,
    height: 24,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  mobileLogoText: {
    fontFamily: fonts.sans,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  mobileBrandTitle: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.5,
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
    width: 220,
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

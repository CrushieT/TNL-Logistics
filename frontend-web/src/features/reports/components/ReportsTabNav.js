import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../../../theme';

export default function ReportsTabNav({ activeTab, onSelectTab }) {
  const tabs = [
    { id: 'FINANCIAL', label: 'Financial & Revenue' },
    { id: 'OPERATIONAL', label: 'Operational Volume' },
    { id: 'AGING', label: 'Client Receivables Aging' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 20,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabButtonActive: {
    borderBottomColor: colors.ink,
  },
  tabText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkFaint,
  },
  tabTextActive: {
    fontWeight: '800',
    color: colors.ink,
  },
});

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { colors } from '../../constants/theme';

export default function AppShell({ children, shipmentCount, parcelCount }) {
  return (
    <View style={styles.frame}>
      <View style={styles.row}>
        <Sidebar />
        <View style={styles.main}>
          <TopBar shipmentCount={shipmentCount} parcelCount={parcelCount} />
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: colors.canvas,
    // The prototype frames the whole console in a thin black border
    borderWidth: 2,
    borderColor: '#111111',
    minHeight: '100vh',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100vh',
  },
  main: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 64,
  },
});

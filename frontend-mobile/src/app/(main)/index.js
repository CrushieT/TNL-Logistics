import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../features/auth/context/AuthContext';
import { OfficeDashboard } from '../../features/office/components/OfficeDashboard';
import { FieldDashboard } from '../../features/field/components/FieldDashboard';
import { colors } from '../../theme';

export default function MainHomeScreen() {
  const router = useRouter();
  const { user, lockSession } = useAuth();

  const isOfficeStaff = user?.role === 'OFFICE_STAFF';

  return (
    <SafeAreaView style={styles.safeArea}>
      {isOfficeStaff ? (
        <OfficeDashboard user={user} onAccount={() => router.push('/(main)/settings')} onLock={lockSession} />
      ) : (
        <FieldDashboard user={user} onAccount={() => router.push('/(main)/settings')} onLock={lockSession} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});

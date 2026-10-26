import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../features/auth/context/AuthContext';
import { OfficeDashboard } from '../../features/office/components/OfficeDashboard';
import { FieldDashboard } from '../../features/field/components/FieldDashboard';
import {
  getPrimaryMobileWorkflow,
  isSupportedMobileRole,
  PRIMARY_MOBILE_WORKFLOWS,
} from '../../features/auth/services/roleAccess.mjs';
import { colors } from '../../theme';

export default function MainHomeScreen() {
  const router = useRouter();
  const { user, lockSession } = useAuth();

  const primaryWorkflow = getPrimaryMobileWorkflow(user?.role);

  if (!isSupportedMobileRole(user?.role)) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {primaryWorkflow === PRIMARY_MOBILE_WORKFLOWS.RECEIVING ? (
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

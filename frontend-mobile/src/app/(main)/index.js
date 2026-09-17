import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../features/auth/context/AuthContext';
import { OfficeDashboard } from '../../features/office/components/OfficeDashboard';
import { FieldDashboard } from '../../features/field/components/FieldDashboard';
import { colors } from '../../theme';

export default function MainHomeScreen() {
  const { user, logout } = useAuth();

  const isOfficeStaff = user?.role === 'OFFICE_STAFF' || user?.role === 'ADMIN';

  return (
    <SafeAreaView style={styles.safeArea}>
      {isOfficeStaff ? (
        <OfficeDashboard user={user} onLogout={logout} />
      ) : (
        <FieldDashboard user={user} onLogout={logout} />
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

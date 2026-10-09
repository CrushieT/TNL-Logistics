import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { colors } from '../../theme';
import {
  canAccessMobileRoute,
  isSupportedMobileRole,
  MOBILE_ROUTES,
} from '../../features/auth/services/roleAccess.mjs';

import { PrinterProvider } from '../../features/printer/context/PrinterContext';

export default function MainLayout() {
  const {
    isAuthenticated,
    isLoading,
    isLocked,
    mustSetupPin,
    boundUser,
    user,
    clearInvalidDeviceSession,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (isLocked) {
      router.replace('/(auth)/pin');
      return;
    }

    if (mustSetupPin) {
      router.replace('/(auth)/setup-pin');
      return;
    }

    if (user && !isSupportedMobileRole(user.role)) {
      clearInvalidDeviceSession().finally(() => router.replace('/(auth)/login'));
      return;
    }

    if (!isAuthenticated) {
      if (boundUser) {
        router.replace('/(auth)/pin');
      } else {
        router.replace('/(auth)/login');
      }
      return;
    }

  }, [
    isLoading,
    isLocked,
    mustSetupPin,
    isAuthenticated,
    boundUser,
    user?.role,
    clearInvalidDeviceSession,
    router,
  ]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated || !isSupportedMobileRole(user?.role)) {
    return null;
  }

  const canUseReceivingWorkflows = canAccessMobileRoute(user.role, MOBILE_ROUTES.REGISTER);
  const canUseScanner = canAccessMobileRoute(user.role, MOBILE_ROUTES.SCAN);
  const canUseWaybills = canAccessMobileRoute(user.role, MOBILE_ROUTES.WAYBILLS);
  const canUseTrackingHistory = canAccessMobileRoute(user.role, MOBILE_ROUTES.TRACKING_HISTORY);

  return (
    <PrinterProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="printer" />
        <Stack.Protected guard={canUseReceivingWorkflows}>
          <Stack.Screen name="register" options={{ gestureEnabled: false }} />
          <Stack.Screen name="shipments/index" />
          <Stack.Screen name="shipments/[id]" />
          <Stack.Screen name="shipments/parcel/[trackingId]" />
        </Stack.Protected>
        <Stack.Protected guard={canUseScanner}>
          <Stack.Screen name="scan" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={canUseWaybills}>
          <Stack.Screen name="waybills" />
        </Stack.Protected>
        <Stack.Protected guard={canUseTrackingHistory}>
          <Stack.Screen name="tracking-history/index" />
          <Stack.Screen name="tracking-history/[trackingId]" />
        </Stack.Protected>
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/password" />
        <Stack.Screen name="settings/pin" />
      </Stack>
    </PrinterProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

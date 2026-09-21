import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { colors } from '../../theme';

import { PrinterProvider } from '../../features/printer/context/PrinterContext';

export default function MainLayout() {
  const { isAuthenticated, isLoading, isLocked, mustSetupPin, boundUser } = useAuth();
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

    if (!isAuthenticated) {
      if (boundUser) {
        router.replace('/(auth)/pin');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoading, isLocked, mustSetupPin, isAuthenticated, boundUser, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

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
        <Stack.Screen name="register" options={{ gestureEnabled: false }} />
        <Stack.Screen name="scan" options={{ gestureEnabled: false }} />
        <Stack.Screen name="printer" />
        <Stack.Screen name="shipments/index" />
        <Stack.Screen name="shipments/[id]" />
        <Stack.Screen name="shipments/parcel/[trackingId]" />
        <Stack.Screen name="tracking-history/index" />
        <Stack.Screen name="tracking-history/[trackingId]" />
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

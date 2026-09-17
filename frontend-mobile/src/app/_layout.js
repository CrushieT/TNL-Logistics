import React from 'react';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { colors } from '../theme';

/**
 * Root Layout for TNL Logistics Field Mobile application.
 * Mounts global SafeAreaProvider, PaperProvider, AuthProvider, and Stack navigator.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="(main)" />
          </Stack>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

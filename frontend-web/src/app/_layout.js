import React, { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { View, ActivityIndicator, Platform } from 'react-native';
import { isAuthenticated, validateSession } from '../services/api/client';
import { colors } from '../theme';

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function verifyAuth() {
      const authenticated = isAuthenticated();
      const isLoginPage = pathname === '/login';

      if (!authenticated) {
        if (!isLoginPage) {
          const redirectQuery =
            pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
          router.replace(`/login${redirectQuery}`);
        }
        if (!isCancelled) setIsCheckingAuth(false);
        return;
      }

      // Validate token against backend to handle server restarts
      const isValid = await validateSession();
      if (isCancelled) return;

      if (!isValid) {
        if (!isLoginPage) {
          const redirectQuery =
            pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
          router.replace(`/login${redirectQuery}`);
        }
      } else if (isLoginPage) {
        router.replace('/');
      }
      setIsCheckingAuth(false);
    }

    verifyAuth();

    return () => {
      isCancelled = true;
    };
  }, [pathname]);

  if (isCheckingAuth && Platform.OS === 'web') {
    const authenticated = isAuthenticated();
    const isLoginPage = pathname === '/login';
    if (!authenticated && !isLoginPage) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.canvas,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F3F2ED' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="shipments/index" />
      <Stack.Screen name="shipments/[shipmentId]/index" />
      <Stack.Screen name="shipments/[shipmentId]/units/[trackingId]" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="weekly-collections" />
      <Stack.Screen name="statements" />
      <Stack.Screen name="tracking-logs" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="users" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

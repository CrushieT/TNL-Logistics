import React, { useEffect } from 'react';
import { Stack, usePathname, useRouter, useRootNavigationState } from 'expo-router';
import { isAuthenticated, validateSession } from '../services/api/client';

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Ensure the root navigator is mounted before attempting navigation
    if (!navigationState?.key) {
      return;
    }

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
    }

    verifyAuth();

    return () => {
      isCancelled = true;
    };
  }, [navigationState?.key, pathname]);

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

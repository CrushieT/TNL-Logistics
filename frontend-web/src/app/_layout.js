import React, { useCallback, useEffect, useState } from 'react';
import { Platform, LogBox, StyleSheet, View } from 'react-native';
import { Stack, usePathname, useRouter, useRootNavigationState } from 'expo-router';
import {
  checkFirstBootStatus,
  getCurrentUser,
  getToken,
  hasVerifiedAdminSession,
  isAuthenticated,
  onSessionChanged,
  validateSession,
} from '../services/api/client';
import { retryPendingPrintAudits } from '../features/shipments/services/printAuditOutbox';

LogBox.ignoreLogs([
  'Failed to complete waybill',
  'Failed to dispatch to hauler',
  'Request failed with status code',
  'AxiosError',
]);

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [firstBootStatus, setFirstBootStatus] = useState(null);
  const [isAdminVerified, setIsAdminVerified] = useState(hasVerifiedAdminSession());

  const synchronizeAccess = useCallback(async () => {
    if (!navigationState?.key) return;

    if (hasVerifiedAdminSession()) {
      setIsAdminVerified(true);
    }

    const isFirstBoot = await checkFirstBootStatus();
    setFirstBootStatus(isFirstBoot);

    if (isFirstBoot !== false) {
      setIsAdminVerified(false);
      return;
    }

    if (!getToken()) {
      setIsAdminVerified(false);
      return;
    }

    if (hasVerifiedAdminSession()) {
      setIsAdminVerified(true);
      return;
    }

    const validationStatus = await validateSession();
    setIsAdminVerified(validationStatus === 'VALID' && hasVerifiedAdminSession());
  }, [navigationState?.key]);

  useEffect(() => {
    synchronizeAccess();

    const unsubscribe = onSessionChanged(synchronizeAccess);
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return unsubscribe;
    }

    window.addEventListener('focus', synchronizeAccess);
    window.addEventListener('online', synchronizeAccess);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', synchronizeAccess);
      window.removeEventListener('online', synchronizeAccess);
    };
  }, [synchronizeAccess]);

  useEffect(() => {
    if (!navigationState?.key || firstBootStatus === null) return;

    const isSetupPage = pathname === '/setup';
    const isLoginPage = pathname === '/login';
    const isChangePasswordPage = pathname === '/change-password';

    if (firstBootStatus) {
      if (!isSetupPage) router.replace('/setup');
      return;
    }

    if (isSetupPage) {
      router.replace(isAdminVerified ? '/' : '/login');
      return;
    }

    if (!isAuthenticated()) {
      if (!isLoginPage) {
        const redirectQuery = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
        router.replace(`/login${redirectQuery}`);
      }
      return;
    }

    if (!isAdminVerified) return;

    const mustChangePassword = Boolean(getCurrentUser()?.mustChangePassword);
    if (mustChangePassword && !isChangePasswordPage) {
      router.replace('/change-password');
    } else if (!mustChangePassword && (isChangePasswordPage || isLoginPage)) {
      router.replace('/');
    }
  }, [firstBootStatus, isAdminVerified, navigationState?.key, pathname, router]);

  useEffect(() => {
    if (!isAdminVerified || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const retryAudits = () => retryPendingPrintAudits().catch(() => undefined);
    retryAudits();
    window.addEventListener('focus', retryAudits);
    return () => window.removeEventListener('focus', retryAudits);
  }, [isAdminVerified]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'tnl-console-scrollbars';
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      ::-webkit-scrollbar { width: 7px; height: 7px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #D1D0C7; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: #A8A69E; }
      * { scrollbar-width: thin; scrollbar-color: #D1D0C7 transparent; }
    `;
    document.head.appendChild(styleEl);
  }, []);

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F3F2ED' },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Protected guard={firstBootStatus === true}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated()}>
          <Stack.Screen name="change-password" />
          <Stack.Screen name="index" />
          <Stack.Screen name="register" />
          <Stack.Screen name="shipments/index" />
          <Stack.Screen name="shipments/[shipmentId]/index" />
          <Stack.Screen name="shipments/[shipmentId]/units/[trackingId]" />
          <Stack.Screen name="clients" />
          <Stack.Screen name="payments" />
          <Stack.Screen name="weekly-collections" />
          <Stack.Screen name="statements" />
          <Stack.Screen name="statements/print" />
          <Stack.Screen name="tracking-logs" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="reports/print" />
          <Stack.Screen name="users" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="vehicles" />
          <Stack.Screen name="waybills/index" />
          <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

import React, { useEffect } from 'react';
import { Platform, LogBox } from 'react-native';
import { Stack, usePathname, useRouter, useRootNavigationState } from 'expo-router';
import { isAuthenticated, validateSession, getCurrentUser, checkFirstBootStatus } from '../services/api/client';
import { retryPendingPrintAudits } from '../features/shipments/services/printAuditOutbox';

// Suppress dev LogBox error overlays for expected API response errors
LogBox.ignoreLogs([
  'Failed to complete waybill',
  'Failed to dispatch to hauler',
  'Request failed with status code',
  'AxiosError',
]);

const ADMIN_ONLY_ROUTES = ['/users', '/settings'];
const SESSION_VALIDATION_THROTTLE_MS = 5 * 60 * 1000;

let cachedIsFirstBoot = null;
let lastSessionValidationTimestamp = 0;

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const retryAudits = () => retryPendingPrintAudits().catch(() => undefined);
    retryAudits();
    window.addEventListener('focus', retryAudits);
    return () => window.removeEventListener('focus', retryAudits);
  }, []);

  useEffect(() => {
    // Inject operational scrollbar styling for web consoles
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'tnl-console-scrollbars';
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      ::-webkit-scrollbar {
        width: 7px;
        height: 7px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #D1D0C7;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #A8A69E;
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: #D1D0C7 transparent;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  useEffect(() => {
    // Ensure the root navigator is mounted before attempting navigation
    if (!navigationState?.key) {
      return;
    }

    let isCancelled = false;

    async function verifyAuth() {
      // Check first-boot status to determine if system onboarding is needed (cached once resolved)
      let isFirstBoot = cachedIsFirstBoot;
      if (isFirstBoot === null || isFirstBoot === true) {
        isFirstBoot = await checkFirstBootStatus();
        if (isCancelled) return;
        if (!isFirstBoot) {
          cachedIsFirstBoot = false;
        }
      }

      const isSetupPage = pathname === '/setup';

      if (isFirstBoot) {
        if (!isSetupPage) {
          router.replace('/setup');
        }
        return;
      }

      // If already initialized and user navigates to /setup, bounce to login or dashboard
      if (isSetupPage) {
        if (isAuthenticated()) {
          router.replace('/');
        } else {
          router.replace('/login');
        }
        return;
      }

      const authenticated = isAuthenticated();
      const isLoginPage = pathname === '/login';
      const isChangePasswordPage = pathname === '/change-password';

      if (!authenticated) {
        lastSessionValidationTimestamp = 0;
        if (!isLoginPage) {
          const redirectQuery =
            pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
          router.replace(`/login${redirectQuery}`);
        }
        return;
      }

      // Validate token against backend to handle server restarts (throttled to avoid redundant network roundtrips)
      const now = Date.now();
      const shouldValidateSession = now - lastSessionValidationTimestamp > SESSION_VALIDATION_THROTTLE_MS;

      if (shouldValidateSession) {
        const isValid = await validateSession();
        if (isCancelled) return;

        if (!isValid && !isAuthenticated()) {
          lastSessionValidationTimestamp = 0;
          const redirectQuery =
            pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
          router.replace(`/login${redirectQuery}`);
          return;
        }

        lastSessionValidationTimestamp = now;
      }

      // Check mandatory password change requirement
      const currentUser = getCurrentUser();
      const mustChangePassword = Boolean(currentUser?.mustChangePassword);

      if (mustChangePassword) {
        if (!isChangePasswordPage) {
          router.replace('/change-password');
        }
        return;
      }

      // If password change is not required, bounce away from change-password or login
      if (isChangePasswordPage || isLoginPage) {
        router.replace('/');
        return;
      }

      // Enforce role-based access control (RBAC) on admin-only routes
      const isAdminOnly = ADMIN_ONLY_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );

      if (isAdminOnly && currentUser?.role !== 'ADMIN') {
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
      <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
      <Stack.Screen name="setup" />
      <Stack.Screen name="login" />
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
      <Stack.Screen name="tracking-logs" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="users" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

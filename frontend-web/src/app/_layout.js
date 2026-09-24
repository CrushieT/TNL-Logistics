import React, { useCallback, useEffect, useState } from 'react';
import { Platform, LogBox, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { colors, fonts, spacing } from '../theme';

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
  const [isVerifyingSession, setIsVerifyingSession] = useState(false);
  const [hasVerificationError, setHasVerificationError] = useState(false);

  const synchronizeAccess = useCallback(async () => {
    if (!navigationState?.key) return;

    const isFirstBoot = await checkFirstBootStatus();
    setFirstBootStatus(isFirstBoot);

    if (isFirstBoot !== false) {
      setIsAdminVerified(false);
      setHasVerificationError(isFirstBoot === null);
      return;
    }

    if (!getToken()) {
      setIsAdminVerified(false);
      setHasVerificationError(false);
      return;
    }

    if (hasVerifiedAdminSession()) {
      setIsAdminVerified(true);
      setHasVerificationError(false);
      return;
    }

    setIsVerifyingSession(true);
    setHasVerificationError(false);
    const validationStatus = await validateSession();
    setIsVerifyingSession(false);
    setIsAdminVerified(validationStatus === 'VALID' && hasVerifiedAdminSession());
    setHasVerificationError(validationStatus === 'UNVERIFIED');
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

  const shouldShowVerificationGate = firstBootStatus === null || (Boolean(getToken()) && !isAdminVerified);

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
        <Stack.Protected guard={isAdminVerified}>
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
          <Stack.Screen name="users" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="vehicles" />
          <Stack.Screen name="waybills/index" />
          <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
        </Stack.Protected>
      </Stack>
      {shouldShowVerificationGate ? (
        <View style={styles.verificationGate}>
          <Text style={styles.verificationTitle}>
            {isVerifyingSession ? 'VERIFYING ADMINISTRATOR SESSION' : 'CONNECTION VERIFICATION REQUIRED'}
          </Text>
          <Text style={styles.verificationMessage}>
            {hasVerificationError
              ? 'The console will remain locked until the server can confirm this session.'
              : 'Checking access before opening the operations console.'}
          </Text>
          {(hasVerificationError || !isVerifyingSession) ? (
            <TouchableOpacity style={styles.retryButton} onPress={synchronizeAccess}>
              <Text style={styles.retryButtonText}>RETRY</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  verificationGate: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.xl,
  },
  verificationTitle: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  verificationMessage: {
    color: colors.inkSoft,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginTop: spacing.sm,
    maxWidth: 360,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.accent,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
